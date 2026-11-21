#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""scale.py DIR: the sample sheets test/size.sh drew at the fractional factors (0.8, 1.6,
1.8, 2.4), by the C library (c-VOICE-SCALE.png) and by the Python module (py-...):

- every rule (sep, sepSoft, headRule) is at least one device pixel thick: it has a pixel
  row of exactly its colour (Python's dotted rule has round dots: a pixel nearer its colour
  than the paper); a solid one is whole device pixels thick, its colour alone;
- every box has its straight edges on whole device pixels: along the lines through its
  middle, across and down, every pixel is a grey of the 16-grey ladder (an edge between
  two pixels; an antialiased one would leave a grey between the steps). A line that
  meets the box where it is round (a pill's ends) is left out;
- the text of the sheet at a text size of 150 % has more ink than at 100 %.

The check itself is checked: a border drawn with cairo alone at 1.6 is caught."""
import os
import sys

import cairo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
from glassine_ui import paint as P  # noqa: E402
from glassine_ui import voices  # noqa: E402

CW, CH, COLS = 170, 90, 4
SCALES = ("0.8", "1.6", "1.8", "2.4")
BOXES = {"card": (120, 50), "btn": (120, 44), "sel": (120, 44), "tog": (64, 36), "togOn": (64, 36), "tray": (120, 44),
         "segOn": (60, 40), "pwr": (120, 42), "pad": (120, 50), "folder": (120, 50), "folderTab": (60, 20),
         "app": (120, 50), "tabOn": (60, 40), "tabOff": (60, 40), "plateOn": (60, 30), "plateOff": (60, 30)}
RADIUS = {"card": "cardR", "btn": "btnR", "sel": "btnR", "tog": "togR", "togOn": "togR", "tray": "trayR", "segOn": "segR",
          "pwr": "pwrR", "pad": "padR", "folder": "folderR", "folderTab": "folderTabR", "app": "appR", "tabOn": "tabR",
          "tabOff": "tabR", "plateOn": "plateR", "plateOff": "plateR"}
RULES = ("sep", "sepSoft", "headRule")
fails = 0


def ok(cond, what):
    global fails
    if not cond:
        print("FAIL " + what)
        fails += 1
    return cond


class Img:
    def __init__(self, surf):
        surf.flush()
        self.w, self.h, self.st, self.d = surf.get_width(), surf.get_height(), surf.get_stride(), bytes(surf.get_data())

    def px(self, x, y):
        o = y * self.st + x * 4
        return (self.d[o + 2], self.d[o + 1], self.d[o])


def ladder(c):
    return c[0] == c[1] == c[2] and c[0] % 17 == 0


def off_ladder(im, x0, y0, x1, y1):
    """the pixels of a line (x0, y0)..(x1, y1), across or down, that are between the ladder's greys"""
    if y0 == y1:
        return [(x, y0) for x in range(max(0, x0), min(im.w, x1)) if not ladder(im.px(x, y0))]
    return [(x0, y) for y in range(max(0, y0), min(im.h, y1)) if not ladder(im.px(x0, y))]


def cell_rect(i, s):
    x, y = (i % COLS) * CW, (i // COLS) * CH
    return int(x * s) + 1, int(y * s) + 1, int((x + CW) * s) - 1, int((y + CH) * s) - 1


def rgb(c):
    return tuple(int(round(v * 255)) for v in c[:3])


def sheet(d, form, v, sc, names):
    im = Img(cairo.ImageSurface.create_from_png(os.path.join(d, "%s-%s-%s.png" % (form, v, sc))))
    s = float(sc)
    shell = voices.voice(v)["shell"]
    what = "%s %s at %s" % (form, v, sc)
    bad = 0
    for i, n in enumerate(names):
        x0, y0, x1, y1 = cell_rect(i, s)
        if n in RULES:
            b = P.border(shell[n])
            if not b or not b[2]:
                continue
            col = rgb(b[2])
            rows = [y for y in range(y0, y1) if any(im.px(x, y) != (255, 255, 255) for x in range(x0, x1))]
            if form == "py" and b[1] == "dotted":
                full = [y for y in rows if any(im.px(x, y)[0] <= (255 + col[0]) / 2 for x in range(x0, x1))]
            else:
                full = [y for y in rows if any(im.px(x, y) == col for x in range(x0, x1))]
            if not ok(len(full) >= 1, "%s: %s: no pixel row of its colour %r: thinner than a device pixel" % (what, n, col)):
                bad += 1
            if b[1] == "solid":
                ink = {im.px(x, y) for y in rows for x in range(x0, x1)} - {(255, 255, 255)}
                want = max(1, int(b[0] * s + 0.5))
                if not ok(ink == {col} and len(rows) == want, "%s: %s: a solid rule of %g px: %d device pixels of its colour alone (%d rows, %r)"
                          % (what, n, b[0], want, len(rows), sorted(ink))):
                    bad += 1
        elif n in BOXES:
            if n == "pad" and "dashed" in (shell.get("padBorder") or ""):
                continue                    # a dashed border: its dashes end where the path's length puts them
            w, h = BOXES[n]
            cx, cy = (i % COLS) * CW + 20, (i // COLS) * CH + 20
            my, mx = int((cy + h / 2) * s), int((cx + w / 2) * s)
            r = max(P.radii(shell[RADIUS[n]], w, h))
            off = (off_ladder(im, x0, my, x1, my) if r < h / 2 - 0.01 else []) + (off_ladder(im, mx, y0, mx, y1) if r < w / 2 - 0.01 else [])
            if not ok(not off, "%s: %s: %d pixels between the ladder's greys on its middle lines (the first at %r): an edge off the pixel grid"
                      % (what, n, len(off), off[:1])):
                bad += 1
    return bad


def ink(path, names):
    """dark pixels of the text cells"""
    im = Img(cairo.ImageSurface.create_from_png(path))
    n = 0
    for i, name in enumerate(names):
        if name.startswith("text-"):
            x0, y0, x1, y1 = cell_rect(i, 2)
            n += sum(1 for y in range(y0, y1) for x in range(x0, x1) if im.px(x, y)[0] < 128)
    return n


def selftest():
    """the check catches what it is for: a 1.5 px border and a 1 px rule with cairo alone at 1.6"""
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, 200, 100)
    cr = cairo.Context(surf)
    cr.set_source_rgb(1, 1, 1)
    cr.paint()
    cr.scale(1.6, 1.6)
    cr.set_source_rgb(17 / 255, 17 / 255, 17 / 255)
    cr.set_line_width(1.5)
    cr.rectangle(10.75, 10.75, 80, 30)
    cr.stroke()
    ok(off_ladder(Img(surf), 0, 40, 200, 40), "self-test: an edge off the pixel grid is caught")
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, 200, 100)
    cr = cairo.Context(surf)
    cr.set_source_rgb(1, 1, 1)
    cr.paint()
    cr.scale(1.6, 1.6)
    P.box(cr, 10.3, 10.3, 80.2, 30.2, "0", "#eeeeee", "0 2px 0 #bbbbbb, inset 0 0 0 1px #888888", "1.5px solid #111111")
    im = Img(surf)
    ok(not off_ladder(im, 0, 40, 200, 40) and not off_ladder(im, 80, 0, 80, 100), "self-test: the same box drawn by paint.box is on the grid")


def main(d):
    names = open(os.path.join(d, "cells.txt")).read().split()
    selftest()
    for v in voices.NAMES:
        for form in ("c", "py"):
            for sc in SCALES:
                if not sheet(d, form, v, sc, names):
                    print("ok   %s %s at %s: rules of whole device pixels, box edges on the pixel grid" % (form, v, sc))
            a, b = ink(os.path.join(d, "%s-%s-plain.png" % (form, v)), names), ink(os.path.join(d, "%s-%s-text150.png" % (form, v)), names)
            if ok(b > a * 1.3, "%s %s: the text at 150 %% has more ink than at 100 %% (%d, %d)" % (form, v, b, a)):
                print("ok   %s %s: the text grows with the text size (%d -> %d dark pixels)" % (form, v, a, b))
    print("scale: %s" % ("all passed" if not fails else "%d FAILED" % fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
