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


# ---- the CSS readers ---------------------------------------------------------------
ok(P.color("#111") == P.color("#111111") == (17 / 255, 17 / 255, 17 / 255, 1.0), "color: #rgb and #rrggbb")
ok(P.color("rgba(17,17,17,.5)") == (17 / 255, 17 / 255, 17 / 255, .5), "color: rgba()")
ok(P.color("transparent") is None and P.color("none") is None and P.color(None) is None, "color: transparent -> None")
ok(P.px("12px") == 12 and P.px("50%", 30) == 15 and P.px("0") == 0, "px: px, percent, 0")
ok(P.radii("4px", 100, 40) == [4] * 4 and P.radii("4px 8px", 100, 40) == [4, 8, 4, 8]
   and P.radii("999px", 100, 40) == [20] * 4, "radii: one, two values, clamped to half the short side")
ok(P.border("1.5px dashed #111111") == (1.5, "dashed", P.color("#111111")) and P.border("none") is None,
   "border: width, style, colour; none")
ok(P.shadows("inset 0 0 0 2px #111111, 3px 3px 0 #111111")
   == [(True, 0, 0, 2, P.color("#111111")), (False, 3, 3, 0, P.color("#111111"))], "shadows: CSS order, inset")
ok(P.ls_em(".08em") == .08 and P.ls_em("0") == 0, "ls_em")

# ---- box: the background, an outer ring below it, a border inside -------------------
s, cr = canvas()
P.box(cr, 20, 20, 60, 40, "0", "#ffffff", "0 0 0 2px #111111", "1px solid #888888")
s.flush()
px_at = lambda x, y: s.get_data()[y * s.get_stride() + x * 4 + 1]     # noqa: E731
ok(px_at(19, 40) == 0x11 and px_at(20, 40) == 0x88 and px_at(50, 40) == 0xff and px_at(17, 40) == 0xff,
   "box: the ring outside, the border on its edge, the background inside")

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

# ---- the text size and the minimums (glassine_ui.size) reach every text call --------
from glassine_ui import size as Z  # noqa: E402


def text_shot(f=FONT, **kw):
    s, cr = canvas(400, 100)
    r = P.text(cr, "Sample 0123", f, 10, 10, "#111111", **kw)
    return bytes(s.get_data()), r, P.measure(cr, "Sample 0123", f, **kw)


def sz(f, **kw):
    return P.font(f, **kw)[0].get_size() / 1024


plain, r0, m0 = text_shot()
ok(sz(FONT) == 16, "font: the design's size without metrics")
Z.set_metrics(2 / 8.943, 1.0, 17, 16)
same = text_shot()
ok(same[0] == plain and same[1] == r0 and sz(FONT) == 16, "Default at 8.943 px/mm, text 100 %: the same pixels and the same measure")
Z.set_metrics(0, 1.25, 17, 16)
big, r1, m1 = text_shot()
ok(sz(FONT) == 20 and sz(FONT, grow=False) == 16 and sz("600 34px sans-serif") == 34 + .25 * 17,
   "text at 125 %: 16 px drawn at 20, a 34 px heading at 38.25; grow=False gives the design's size")
ok(big != plain and abs(r1[0] / r0[0] - 1.25) < .05 and abs(r1[1] / r0[1] - 1.25) < .001 and m1 == r1,
   "text at 125 %: the text is a quarter wider, its line box (line-height 1.2) a quarter taller, measure agrees")
ok(abs(P.measure(cr, "Sample", "500 16px/24px sans-serif")[1] - 30) < .001, "a line-height in px grows with its text")
Z.set_metrics()
plain_ls = text_shot(ls=.1)[1][0]
Z.set_metrics(0, 1.5, 17, 16)
ok(abs(text_shot(ls=.1)[1][0] / plain_ls - 1.5) < .05, "letter spacing in em follows the drawn size")
Z.set_metrics(0.1792, 1.0, 17, 16)
ok(abs(sz("500 10px sans-serif") - 2.0 / 0.1792) < 1e-3 and sz("500 16px sans-serif") == 16
   and abs(sz("500 15px sans-serif") - 15) < 1e-9 and abs(Z.min_tap() - 7 / 0.1792) < 1e-9,
   "the minimums: 10 px drawn at 2.0 mm, 16 px (a row label, 2.87 mm) as it is; the tap minimum")
Z.set_metrics()
back = text_shot()
ok(back[0] == plain and back[1] == r0 and sz(FONT) == 16, "the metrics cleared: the same pixels as before")

# ---- whole device pixels at a fractional scale ----------------------------------------


def scaled(sc, dev=1.0):
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, 320, 200)
    cr = cairo.Context(s)
    cr.set_source_rgb(1, 1, 1)
    cr.paint()
    s.set_device_scale(dev, dev)
    cr = cairo.Context(s)
    cr.scale(sc, sc)
    return s, cr


def colours(s):
    s.flush()
    d = bytes(s.get_data())
    return {d[i:i + 3] for i in range(0, len(d), 4)}


INK, PAPER = b"\x11\x11\x11", b"\xff\xff\xff"
for sc, dev in ((1.6, 1), (1.8, 1), (2.4, 1), (0.8, 1), (0.8, 2), (1.2, 2)):
    s, cr = scaled(sc, dev)
    P.fill(cr, 10.3, 10.3, 50.3, 20.3, "#111111")
    P.rule(cr, 10.3, 50.3, 80.3, "1px solid #111111")
    P.rule(cr, 10.3, 60.3, 80.3, "0.5px solid #111111")
    P.rule(cr, 10.3, 70.3, 80.3, "3px double #111111")
    P.box(cr, 10.3, 80.3, 60.3, 20.3, "0", None, "0 2px 0 #111111", "1.5px solid #111111")
    ok(colours(s) == {INK, PAPER}, "scale %g (device scale %g): fill, rule and a square box are whole device pixels (no grey between)" % (sc, dev))
    ok(abs(P.dev_scale(cr) - sc * dev) < 1e-9, "dev_scale: %g" % (sc * dev))
    t = sc * dev
    ok(abs(P.snap_x(cr, 10.3) * t - round(10.3 * t)) < 1e-9 and abs(P.snap_len(cr, 1.5) * t - max(1, round(1.5 * t))) < 1e-9
       and abs(P.snap_len(cr, 0.2) * t - 1) < 1e-9 and P.snap_len(cr, 0) == 0 and abs(P.snap_len(cr, -1) * t + max(1, round(t))) < 1e-9,
       "snap_x, snap_len at %g: a device pixel edge; whole device pixels, at least one; 0 stays 0; the sign kept" % t)
s, cr = scaled(1.6)
P.rule(cr, 10, 50.3, 100, "0.5px solid #111111")
s.flush()
rows = {i // s.get_stride() for i in range(0, len(s.get_data()), 4) if bytes(s.get_data()[i:i + 3]) == INK}
ok(len(rows) == 1, "a rule of half a design pixel at 1.6 is one device pixel thick")
# a whole scale draws the values as given: the same pixels as cairo alone
s, cr = scaled(2)
P.fill(cr, 10.25, 10.25, 50.25, 20.25, "#111111")
s2, cr2 = scaled(2)
cr2.set_source_rgba(*P.color("#111111"))
cr2.rectangle(10.25, 10.25, 50.25, 20.25)
cr2.fill()
ok(bytes(s.get_data()) == bytes(s2.get_data()) and len(colours(s)) > 2, "scale 2: a fill off the grid stays as given (antialiased)")
cr.rotate(.3)
ok(P.snap_x(cr, 10.3) == 10.3 and P.snap_len(cr, 1.5) == 1.5, "a turned context: the snaps give the values back")
# an icon at a fractional scale: drawn at the device resolution, on whole device pixels
s, cr = scaled(1.6)
ok(P.icon(cr, "go-next-symbolic", 24, 50, 50, "#111111") and painted(s) > 0 and not P.icon(cr, "no-such-icon-anywhere", 24, 50, 50, "#111111"),
   "an icon at 1.6 draws; no such icon: False")
s, cr = scaled(0.8, 2)
ok(P.icon(cr, "go-next-symbolic", 24, 50, 50, "#111111") and painted(s) > 0, "an icon at 0.8 on a surface of device scale 2 draws")

print("paint: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
