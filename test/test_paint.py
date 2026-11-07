#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of the Python drawing API (glassine_ui.paint), call by call: what
each draws, what it measures, and what it leaves on the caller's context."""
import os
import sys

import cairo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
from glassine_ui import paint as P  # noqa: E402

fails = 0
FONT = "500 16px/1.2 sans-serif"


def ok(cond, what):
    global fails
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        fails += 1


def canvas(w=200, h=100):
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    cr = cairo.Context(s)
    P.fill(cr, 0, 0, w, h, "#ffffff")
    return s, cr


def painted(s):
    """pixels that aren't the white paper"""
    s.flush()
    d, st = s.get_data(), s.get_stride()
    return sum(1 for y in range(s.get_height()) for x in range(s.get_width())
               if d[y * st + x * 4: y * st + x * 4 + 3] != b"\xff\xff\xff")


# ---- transparent colours draw nothing (as in C, where 0 skips the draw) ------------
s, cr = canvas()
w0, h0 = P.text(cr, "Sample", FONT, 10, 10, "#111111")
ok(painted(s) > 0, "text in ink draws")
for col in ("transparent", None):
    s, cr = canvas()
    ok(P.text(cr, "Sample", FONT, 10, 10, col) == (w0, h0) and painted(s) == 0,
       "text in %r draws nothing and measures the same" % (col,))
    s, cr = canvas()
    ok(P.text(cr, "Sample", "16px sans-serif", 10, 10, col)[0] > 0 and painted(s) == 0,
       "text without a line height in %r draws nothing" % (col,))
s, cr = canvas()
ok(P.icon(cr, "go-next-symbolic", 24, 50, 50, "#111111") and painted(s) > 0, "an icon in ink draws")
for name in ("go-next-symbolic", "arrow_forward", "error", "radio_button_unchecked"):
    s, cr = canvas()
    ok(P.icon(cr, name, 24, 50, 50, "transparent") and painted(s) == 0,
       "icon %s in transparent: there is one, nothing drawn" % name)
s, cr = canvas()
ok(not P.icon(cr, "no-such-icon-anywhere", 24, 50, 50, "transparent"), "no such icon: False, transparent or not")

print("paint: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
