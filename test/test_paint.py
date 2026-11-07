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

# ---- measure measures what text draws -----------------------------------------------
s, cr = canvas(400, 100)
for f in (FONT, "16px sans-serif"):
    for kw in ({}, {"ls": .2}, {"ls": .2, "maxw": 60}, {"ls": .1, "maxw": 80, "wrap": True},
               {"caps": ("small-caps", "lowercase"), "ls": .08}):
        ok(P.measure(cr, "Sample text", f, **kw) == P.text(cr, "Sample text", f, 0, 0, "#111111", **kw),
           "measure = text for %s %s" % (f, kw))
ok(P.measure(cr, "Sample", FONT, ls=.2)[0] > P.measure(cr, "Sample", FONT)[0], "letter spacing widens")

# ---- degenerate boxes draw nothing (as in C) ----------------------------------------
for w, h in ((-20, 10), (0, 10), (20, 0), (20, -5)):
    s, cr = canvas()
    P.box(cr, 50, 50, w, h, "4px", "#111111", "3px 3px 0 #111111", "2px dotted #111111")
    ok(painted(s) == 0, "box %gx%g draws nothing" % (w, h))

# ---- the caller's line width, cap, join and dash stay ------------------------------
def line_state(cr):
    return cr.get_line_width(), cr.get_line_cap(), cr.get_line_join(), cr.get_dash()


for what, call in (("box dotted", lambda cr: P.box(cr, 10, 10, 60, 30, "4px", None, None, "2px dotted #111111")),
                   ("box dashed", lambda cr: P.box(cr, 10, 10, 60, 30, "4px", None, None, "2px dashed #111111")),
                   ("box double", lambda cr: P.box(cr, 10, 10, 60, 30, "4px", None, None, "3px double #111111")),
                   ("rule dotted", lambda cr: P.rule(cr, 10, 50, 60, "2px dotted #111111")),
                   ("rule dashed", lambda cr: P.rule(cr, 10, 50, 60, "2px dashed #111111")),
                   ("icon arrow_forward", lambda cr: P.icon(cr, "arrow_forward", 24, 50, 50, "#111111")),
                   ("icon error", lambda cr: P.icon(cr, "error", 24, 50, 50, "#111111"))):
    s, cr = canvas()
    cr.set_line_width(7)
    cr.set_line_cap(cairo.LINE_CAP_SQUARE)
    cr.set_line_join(cairo.LINE_JOIN_BEVEL)
    cr.set_dash([4, 1])
    before = line_state(cr)
    call(cr)
    ok(line_state(cr) == before and painted(s) > 0, what + ": draws, and the line state stays")

# ---- a font shorthand that isn't one raises, as tools/gen-voices does ---------------
for bad in ("bold 16px sans-serif", "16pt serif", "", "500 sans-serif", None):
    try:
        P.font(bad)
        ok(False, "font(%r) raises" % (bad,))
    except ValueError:
        ok(True, "font(%r) raises ValueError" % (bad,))
ok(P.font("italic 500 22px/1.1 'EB Garamond',serif")[1] == 1.1, "font: a shorthand parses")

print("paint: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
