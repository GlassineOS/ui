#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""compare.py DIR: the C and the Python sample sheets per voice and element
(FR-012: the same pixels within one grey step of the 16-grey ladder, 255/15).

A cell passes when no pixel differs by more than one grey step. The known
differences of the two drawing codes are listed in EXPECTED with their cause
(README "Python API", "Where C and Python differ"); one of them that passes
now fails the test too, so the list stays true."""
import os
import sys

import cairo

STEP = 255 / 15
CW, CH, COLS = 170, 90, 4

# (voice or "*", element): why C and Python differ
TEXT = ("text: C draws on its own Pango context (grey antialias, slight hinting, metrics off, "
        "PANGO_VARIANT_SMALL_CAPS); Python on the surface's options with the font features lnum/smcp "
        "and a CSS line height (half-leading)")
UNDER = ("outer rings: C clips them out from under the box, Python paints them below it "
         "(seen through a transparent box, or as an antialiased seam at round corners)")
EXPECTED = {("*", "text-" + n): TEXT for n in ("lbl", "name", "head", "date", "seg", "appName", "tab", "search")}
EXPECTED.update({
    ("white", "sep"): "dotted rules: C 1:1 square dots, Python round dots (0, 2w+1)",
    ("stationery", "sep"): "dashed rules: C dashes 3:2, Python 3:3",
    ("white", "togOn"): UNDER, ("white", "segOn"): UNDER, ("white", "pwr"): UNDER,
    ("editorial", "tog"): UNDER, ("editorial", "pwr"): UNDER,
    ("stationery", "card"): UNDER, ("stationery", "segOn"): UNDER, ("stationery", "folder"): UNDER,
    ("stationery", "app"): UNDER, ("stationery", "tabOn"): UNDER,
})


def grey(surf):
    surf.flush()
    w, h, st = surf.get_width(), surf.get_height(), surf.get_stride()
    d = surf.get_data()
    return w, h, st, d


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
            bad, worst = 0, 0
            for y in range(y0, y0 + CH * 2):
                ra, rb = y * st, y * st2
                for x in range(x0, x0 + CW * 2):
                    # B, G, R, A (premultiplied, the sheets are opaque): the green channel
                    da = abs(a[ra + x * 4 + 1] - b[rb + x * 4 + 1])
                    if da > STEP:
                        bad += 1
                    worst = max(worst, da)
            why = EXPECTED.get((v, name)) or EXPECTED.get(("*", name))
            if bad and why:
                print("ok   %s %s: differs as expected (%d px, max %d): %s" % (v, name, bad, worst, why))
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
