#!/usr/bin/python
# -*- coding:utf8 -*-
__author__ = 'jjj'
import time
import datetime
from os.path import expanduser
import os
import threading

input = None

# format the time_delta object by divide the total seconds
def strfdelta(tdelta, fmt):
    d = {}
    d["hours"], rem = divmod(tdelta.seconds, 3600)
    d["minutes"], d["seconds"] = divmod(rem, 60)

    return fmt.format(**d)

def timer(task):
    a = datetime.datetime.now()
    while input is None:
        _ = os.system('clear')
        b = datetime.datetime.now()
        print "Working on %s" %(task)
        c = b - a
        print strfdelta(c, "Duration {hours}:{minutes}:{seconds}")
        time.sleep(1)


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
        if fd is not None:
            print a.strftime('%H:%M:%S') + ' - ' + b.strftime('%H:%M:%S')
            fd.write(a.strftime('%H:%M:%S') + '~' + b.strftime('%H:%M:%S') + "\n")
        c = b - a
        print self.strfdelta(c, "Duration {hours}:{minutes}:{seconds}")
        if fd is not None:
            fd.write(self.strfdelta(c, "Duration {hours}:{minutes}:{seconds}") + "\n")

    def start(self):
        global input
        self.enable = True
        filename = datetime.date.today().strftime('%Y%m%d')
        home = expanduser("~")

        # test weather the TR dir exists or create it 
        # if not find
        if not os.path.exists(home + "/TR"):
            os.makedirs(home + "/TR")

        while self.enable:
            input = None
            task = raw_input("Enter the project ur working,q to quit:")

            if task == 'Q' or task == 'q':
                print "get the fuck out of here"
                return

            a = datetime.datetime.now()
            t1 = threading.Thread(target=timer, args=(task, ))
            t1.start()
            input = raw_input()

            b = datetime.datetime.now()
            with open(home + "/TR/" + filename, "a") as f:
                f.write(task + " ")
                self.cal(a, b, f)
            t1.join()

if __name__ == "__main__":
        tracker = Tracker()
        tracker.start()
