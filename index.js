const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const Q = require('q');
const moment = require('moment');
const homedir = require('os').homedir();
const _ = require('lodash');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), listMajors);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error while trying to retrieve access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
function listMajors(auth) {
    // generate the filename by date
    const filename = moment().format('YYYYMMDD');
    const sheets = google.sheets({version: 'v4', auth});
    const request4AddSheet = {
        spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
        resource: {
            requests: [{
                addSheet: {
                    properties: {
                        title: filename
                    }
                }
            }]
        }
    };

    // trying to promisify functions
    const batchUpdate = Q.denodeify(sheets.spreadsheets.batchUpdate);
    const sheetGet = Q.denodeify(sheets.spreadsheets.get);
    const sheetAppend = Q.denodeify(sheets.spreadsheets.values.append);

    return sheetGet({spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0'})
    .then((res) => {

        // to test weather the sheet exist or not,if it does then delete it
        const sheetFilter = res.data.sheets.filter((sheet) => sheet.properties.title == filename);
        return Q.fcall(() => {
            if (sheetFilter.length != 0) {
                const request4DeleteSheet = {
                    spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                    resource: {
                        requests: [{
                            deleteSheet: {
                                sheetId: sheetFilter[0].properties.sheetId
                            }
                        }]
                    }
                };
                return batchUpdate(request4DeleteSheet)
            }
        })
        .then(() => {
            return batchUpdate(request4AddSheet)
            .then((row) => {
                const values = [["Subject", "起始與結束時間", "Duration", "Duration(seconds)"]]; // values for write into sheet
                const newSheetId = row.data.replies[0].addSheet.properties.sheetId;

                const rl = readline.createInterface({
                    input: fs.createReadStream(`${homedir}/TR/${filename}`)
                });

                rl.on('line', (line) => {
                    if (line.startsWith('Duration')) {
                        const durations = line.split(' ');
                        values[values.length -1].push(durations[1]);
                        values[values.length -1].push(Number(durations[2]));
                    } else {
                        values.push(line.split(' '));
                    }
                });

                rl.on('close', (line) => {

                    // filter the index 0 of values and get the subject item for statistics
                    const subjects = _.uniq(values.filter((v, k) => {
                        if (k == 0) return false;
                        return true})
                    .map((v) => {
                        return v[0]
                    }));

                    const request4AppendData = {
                        spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                        range: `${filename}!A1:D5`,
                        valueInputOption: 'RAW',
                        resource: {
                            majorDimension: 'ROWS',
                            values: values
                        }
                    }

                    return sheetAppend(request4AppendData)
                    .then(() => {
                        // this phrase is to append the subjects for statistics
                        const request4Statistics = {
                            spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                            range: `${filename}!E1:E2`,
                            valueInputOption: 'USER_ENTERED',
                            resource: {
                                majorDimension: 'ROWS',
                                values: [['=unique(transpose(split(ArrayFormula(concatenate($A2:A&" "))," ")))']]
                            }
                        }

                        return sheetAppend(request4Statistics);
                    })
                    .then(() => {
                        // this phrase append sumif to sum the same subjects' seconds
                        const sumifData = []; // for statistic the sum of same subject
                        for ( let i = 1; i <= subjects.length ; i++) {
                            sumifData.push([`=SUMIF(A2:A,E${i},D2:D)`]);
                        }
                        const request4Sumif = {
                            spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                            range: `${filename}!F1:F`,
                            valueInputOption: 'USER_ENTERED',
                            resource: {
                                majorDimension: 'ROWS',
                                values: sumifData
                            }
                        }

                        return sheetAppend(request4Sumif);
                    })
                    .then(() => {
                        // this phrase append formula to convert seconds to readable time format
                        const convertFormat = [];
                        for ( let i = 1; i <= subjects.length ; i++) {
                            convertFormat.push([`=CONCATENATE(IF(FLOOR(DIVIDE(F${i}, 3600), 1) = 0, "", FLOOR(DIVIDE(F${i}, 3600), 1)), IF(FLOOR(DIVIDE(F${i}, 3600), 1) = 0, "", "H"), FLOOR(DIVIDE(MOD(F${i},3600),60), 1), "M")`]);
                        }
                        const request4ConvertFormat = {
                            spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                            range: `${filename}!G1:G`,
                            valueInputOption: 'USER_ENTERED',
                            resource: {
                                majorDimension: 'ROWS',
                                values: convertFormat
                            }
                        }

                        return sheetAppend(request4ConvertFormat);
                    })
                    .catch((err) => {
                        console.log('The API returned an error: ' + err);
                    })
                })

                // the code below use copyandpaste request
                // const request4CopyandPaste = {
                //     spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                //     resource: {
                //         requests: [{
                //             copyPaste: {
                //                 source: {
                //                     sheetId: 0,
                //                     startRowIndex: 0,
                //                     endRowIndex: 1,
                //                     startColumnIndex: 0,
                //                     endColumnIndex: 3
                //                 },
                //                 destination: {
                //                     sheetId: newSheetId,
                //                     startRowIndex: 0,
                //                     endRowIndex: 1,
                //                     startColumnIndex: 0,
                //                     endColumnIndex: 3
                //                 },
                //                 pasteType: "PASTE_NORMAL",
                //                 pasteOrientation: "NORMAL"
                //             }
                //         }]
                //     }
                // };
                // return batchUpdate(request4CopyandPaste)
            })
        })
    })
    .catch((err) => {
        console.log('The API returned an error: ' + err);
    })
}
