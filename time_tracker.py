__author__ = 'jjj'
# -*- coding:utf8 -*-
import time
import datetime

class Tracker:

    def __init__(self):
        self.enable = False

    def strfdelta(self, tdelta, fmt):
        d = {}
        d["hours"], rem = divmod(tdelta.seconds, 3600)
        d["minutes"], d["seconds"] = divmod(rem, 60)
        return fmt.format(**d)

    def cal(self, a, b):
        print a.strftime('%H:%M:%S') + ' - ' + b.strftime('%H:%M:%S')
        c = b - a
        print self.strfdelta(c, "Duration {hours}:{minutes}:{seconds}")

    def start(self):
        self.enable = True
        while self.enable:
            task = raw_input("Enter to Start timing:")
            a = datetime.datetime.now()
            print "Working in %s" %(task)
            input = raw_input()
            b = datetime.datetime.now()
            self.cal(a, b)
            if input == 'Q' or input == 'q':
                print "get the fuck out of here"
                return
