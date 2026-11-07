#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""compare.py DIR: the C and the Python sample sheets per voice and element
(FR-012: the same pixels within one grey step of the 16-grey ladder, 255/15).

A cell passes when no pixel differs by more than one grey step in any colour
channel. The known differences of the two drawing codes are listed in EXPECTED
with their cause (README "Python API", "Where C and Python differ"), and each
is bounded, so that a regression in a listed cell still fails:

- a shape (rings, rules) by the most pixels that may differ: they are drawn the
  same on every host (Arch and alpine:3.24 count the same), with a margin of a
  twentieth (at least 8 px);
- text by where and how it differs, since its pixels depend on the host's fonts
  (on alpine:3.24 C's small capitals have up to 2.6x Python's ink): every
  differing pixel lies within the ink of the two sheets (the bounding boxes of
  their pixels darker than mid-grey, grown by GROW px for the antialiased
  edges), both have ink, of the same darkest grey (one step), and neither has
  more than INK_RATIO x the other's. This fails missing text, text in another
  grey or much larger, and a change in the paper around it; it can't tell a
  stray dark mark in a text cell from text.

A listed cell that is the same now fails too, so the list stays true."""
import os
import sys

import cairo

STEP = 255 / 15
CW, CH, COLS = 170, 90, 4
GROW = 4                # px (device) around the ink a text difference may reach
INK_RATIO = 3.0         # the most one sheet's ink may be of the other's, in a text cell

# (voice or "*", element): (why C and Python differ, the most px that may differ, or TEXT_MASK)
TEXT = ("text: C draws on its own Pango context (grey antialias, slight hinting, metrics off, "
        "PANGO_VARIANT_SMALL_CAPS); Python on the surface's options with the font features lnum/smcp "
        "and a CSS line height (half-leading)")
UNDER = ("outer rings: C clips them out from under the box, Python paints them below it "
         "(seen through a transparent box, or as an antialiased seam at round corners)")
TEXT_MASK = "text"


def under(n):
    """a shape's bound: the count measured on the hosts above, and a twentieth more (at least 8 px)"""
    return (UNDER, bound(n))


def bound(n):
    return n + max(8, n // 20)


EXPECTED = {("*", "text-" + n): (TEXT, TEXT_MASK)
            for n in ("lbl", "name", "head", "date", "seg", "appName", "tab", "search")}
EXPECTED.update({
    ("white", "sep"): ("dotted rules: C 1:1 square dots, Python round dots (0, 2w+1)", bound(320)),
    ("stationery", "sep"): ("dashed rules: C dashes 3:2, Python 3:3", bound(369)),
    ("white", "pwr"): under(1),
    ("editorial", "tog"): under(6987), ("editorial", "pwr"): under(17632),
    ("stationery", "card"): under(28), ("stationery", "segOn"): under(53), ("stationery", "folder"): under(31),
    ("stationery", "app"): under(26), ("stationery", "tabOn"): under(4),
})


def grey(surf):
    surf.flush()
    w, h, st = surf.get_width(), surf.get_height(), surf.get_stride()
    d = surf.get_data()
    return w, h, st, d


def ink(buf, st, x0, y0):
    """a cell's ink, its pixels darker than mid-grey: their bounding box (or None),
    their count, the darkest green value"""
    box, n, dark = None, 0, 255
    for y in range(y0, y0 + CH * 2):
        r = y * st
        for x in range(x0, x0 + CW * 2):
            g = buf[r + x * 4 + 1]
            dark = min(dark, g)
            if g < 128:
                box = (x, y, x, y) if box is None else (min(box[0], x), min(box[1], y), max(box[2], x), max(box[3], y))
                n += 1
    return box, n, dark


def text_ok(a, st, b, st2, x0, y0, diffs):
    """why a text cell's differences are not those of text, or None"""
    ba, na, da = ink(a, st, x0, y0)
    bb, nb, db = ink(b, st2, x0, y0)
    if not na or not nb:
        return "no ink in the %s sheet" % ("C" if not na else "Python")
    if abs(da - db) > STEP:
        return "the darkest grey differs (C %d, Python %d)" % (da, db)
    if max(na, nb) > INK_RATIO * min(na, nb):
        return "the ink differs more than %gx (C %d px, Python %d px)" % (INK_RATIO, na, nb)
    out = [(x, y) for x, y in diffs
           if not any(bx[0] - GROW <= x <= bx[2] + GROW and bx[1] - GROW <= y <= bx[3] + GROW for bx in (ba, bb))]
    if out:
        return "%d differing px outside the text (first at %d,%d in the cell)" % (len(out), out[0][0] - x0, out[0][1] - y0)
    return None


def main(d):
    fails = 0
    for v in ("white", "editorial", "stationery"):
        c = cairo.ImageSurface.create_from_png(os.path.join(d, "sheet-c-%s.png" % v))
        p = cairo.ImageSurface.create_from_png(os.path.join(d, "sheet-py-%s.png" % v))
        cn = open(os.path.join(d, "sheet-c-%s.txt" % v)).read().split()
        pn = open(os.path.join(d, "sheet-py-%s.txt" % v)).read().split()
        if cn != pn:
            print("FAIL %s: the sheets' cells differ: %s / %s" % (v, cn, pn))
            fails += 1
            continue
        w, h, st, a = grey(c)
        _, _, st2, b = grey(p)
        for i, name in enumerate(cn):
            x0, y0 = (i % COLS) * CW * 2, (i // COLS) * CH * 2
            diffs, worst = [], 0
            for y in range(y0, y0 + CH * 2):
                ra, rb = y * st, y * st2
                for x in range(x0, x0 + CW * 2):
                    # B, G, R, A (premultiplied, the sheets are opaque): the colour channels
                    da = max(abs(a[ra + x * 4 + k] - b[rb + x * 4 + k]) for k in (0, 1, 2))
                    if da > STEP:
                        diffs.append((x, y))
                    worst = max(worst, da)
            bad = len(diffs)
            why, limit = EXPECTED.get((v, name)) or EXPECTED.get(("*", name)) or (None, None)
            if bad and why:
                wrong = (text_ok(a, st, b, st2, x0, y0, diffs) if limit == TEXT_MASK else
                         None if bad <= limit else "%d px differ, more than the %d listed" % (bad, limit))
                if wrong:
                    print("FAIL %s %s: differs beyond what is listed: %s (%s)" % (v, name, wrong, why))
                    fails += 1
                else:
                    print("ok   %s %s: differs as expected (%d px, max %d, bound %s): %s"
                          % (v, name, bad, worst, "text mask" if limit == TEXT_MASK else limit, why))
            elif bad:
                print("FAIL %s %s: %d px differ by more than one grey step (max %d)" % (v, name, bad, worst))
                fails += 1
            elif why:
                print("FAIL %s %s: the same now, but listed as a difference: update EXPECTED" % (v, name))
                fails += 1
            else:
                print("ok   %s %s: the same within one grey step (max %d)" % (v, name, worst))
    print("sheet: %s" % ("C and Python agree (listed differences apart)" if not fails else "%d FAILED" % fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
