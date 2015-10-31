__author__ = 'jjj'
# -*- coding:utf8 -*-
import time
import datetime
from os.path import expanduser

class Tracker:

    def __init__(self):
        self.enable = False

    # format the time_delta object by divide the total seconds
    def strfdelta(self, tdelta, fmt):
        d = {}
        d["hours"], rem = divmod(tdelta.seconds, 3600)
        d["minutes"], d["seconds"] = divmod(rem, 60)

        return fmt.format(**d)

    # do the math, and print the result
    def cal(self, a, b, fd):
        print a.strftime('%H:%M:%S') + ' - ' + b.strftime('%H:%M:%S')
        fd.write(a.strftime('%H:%M:%S') + ' - ' + b.strftime('%H:%M:%S') + "\n")
        c = b - a
        print self.strfdelta(c, "Duration {hours}:{minutes}:{seconds}")
        fd.write(self.strfdelta(c, "Duration {hours}:{minutes}:{seconds}") + "\n")

    def start(self):
        self.enable = True
        filename = "TR" + str(datetime.date.today())
        home = expanduser("~")

        # test weather the TR dir exists or create it 
        # if not find
        if not os.path.exists(home + "/TR"):
            os.makedirs(home + "/TR")

        while self.enable:
            task = raw_input("Enter to Start timing:")
            a = datetime.datetime.now()
            print "Working in %s" %(task)
            input = raw_input()
            b = datetime.datetime.now()

            with open(home + "/TR/" + filename, "a") as f:
                f.write(task + "   ")
                self.cal(a, b, f)

            if input == 'Q' or input == 'q':
                print "get the fuck out of here"
                return
