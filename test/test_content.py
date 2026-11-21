#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of glassine_ui.content: importing the package asks the session's GTK
module to name this process's repaints (and only this process's), an environment
that decides stays, and say() leaves exactly one kind on the window."""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))

fails = 0


def ok(cond, what):
    global fails
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        fails += 1


def child(env_value):
    """GLASSINE_CONTENT after 'import glassine_ui' in a fresh interpreter, and its pid."""
    env = dict(os.environ)
    env.pop("GLASSINE_CONTENT", None)
    if env_value is not None:
        env["GLASSINE_CONTENT"] = env_value
    env["PYTHONPATH"] = os.path.join(ROOT, "python")
    out = subprocess.run([sys.executable, "-c",
                          "import os, glassine_ui; print(os.environ.get('GLASSINE_CONTENT'), os.getpid())"],
                         env=env, capture_output=True, text=True, check=True).stdout.split()
    return out[0], out[1]


v, pid = child(None)
ok(v == "auto:" + pid, "importing the package asks for this process (auto:PID)")
v, pid = child("off")
ok(v == "off", "GLASSINE_CONTENT=off stays off")
v, pid = child("auto")
ok(v == "auto", "GLASSINE_CONTENT=auto (every program) stays")
v, pid = child("auto:1")
ok(v == "auto:" + pid, "a parent's mark is replaced by this process's own")


class Ctx:
    def __init__(self):
        self.classes = set()

    def has_class(self, c):
        return c in self.classes

    def add_class(self, c):
        self.classes.add(c)

    def remove_class(self, c):
        self.classes.discard(c)


class Widget:
    def __init__(self):
        self.ctx = Ctx()

    def get_toplevel(self):
        return self

    def get_style_context(self):
        return self.ctx


from glassine_ui import content  # noqa: E402

w = Widget()
content.say(w, "page")
ok(w.ctx.classes == {"glassine-content-page"}, "say page: the window's class")
content.say(w, "motion")
ok(w.ctx.classes == {"glassine-content-motion"}, "say motion: replaces it")
content.say(w, "none")
ok(w.ctx.classes == {"glassine-content-none"}, "say none: nothing is said for the next repaint")
try:
    content.say(w, "fast")
    ok(False, "an unknown kind raises")
except ValueError:
    ok(w.ctx.classes == {"glassine-content-none"}, "an unknown kind raises and changes nothing")

print("content: %s" % ("FAILED" if fails else "all passed"))
sys.exit(1 if fails else 0)
