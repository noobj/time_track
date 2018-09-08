const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
const Q = require('q');
const moment = require('moment');
const homedir = require('os').homedir();

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
                const values = [["Subject", "起始與結束時間", "Duration"]]; // values for write into sheet
                const newSheetId = row.data.replies[0].addSheet.properties.sheetId;

                const rl = readline.createInterface({
                    input: fs.createReadStream(`${homedir}/TR/${filename}`)
                });

                rl.on('line', (line) => {
                    if (line.startsWith('Duration')) {
                        const durations = line.split(' ')[1];
                        values[values.length -1].push(durations);
                    } else {
                        values.push(line.split(' '));
                    }
                });

                rl.on('close', (line) => {
                    const request4AppendData = {
                        spreadsheetId: '1UaD2wxlY0v6Jx0kNSdkWHrv9Wc6W_-hfQpgyQRfpFR0',
                        range: `${filename}!A1:D5`,
                        valueInputOption: 'RAW',
                        resource: {
                            majorDimension: 'ROWS',
                            values: values
                        }
                    }

                    return sheets.spreadsheets.values.append(request4AppendData);
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
