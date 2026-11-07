#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""compare-selftest.py DIR: compare.py fails a regression in a listed cell. Each
case changes a copy of the Python sheet of one voice (DIR/sheet-py-*.png, from
sheet.sh) in one listed cell, and compare.py must fail it."""
import os
import shutil
import sys
import tempfile

import cairo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import compare  # noqa: E402

CW, CH, COLS = compare.CW, compare.CH, compare.COLS


def cell(d, voice, name):
    names = open(os.path.join(d, "sheet-c-%s.txt" % voice)).read().split()
    i = names.index(name)
    return (i % COLS) * CW * 2, (i // COLS) * CH * 2


def run(src, voice, name, paint):
    tmp = tempfile.mkdtemp()
    try:
        for f in os.listdir(src):
            if f.startswith("sheet-") and (f.endswith(".png") or f.endswith(".txt")):
                shutil.copy(os.path.join(src, f), tmp)
        p = os.path.join(tmp, "sheet-py-%s.png" % voice)
        s = cairo.ImageSurface.create_from_png(p)
        cr = cairo.Context(s)
        x0, y0 = cell(src, voice, name)
        paint(cr, x0, y0)
        s.write_to_png(p)
        out = sys.stdout
        sys.stdout = open(os.devnull, "w")
        try:
            return compare.main(tmp)
        finally:
            sys.stdout.close()
            sys.stdout = out
    finally:
        shutil.rmtree(tmp)


def rect(grey, x, y, w, h):
    def paint(cr, x0, y0):
        cr.set_source_rgb(grey, grey, grey)
        cr.rectangle(x0 + x, y0 + y, w, h)
        cr.fill()
    return paint


def recolour(grey):
    """the text drawn again in another grey: its dark pixels lighter"""
    def paint(cr, x0, y0):
        s = cr.get_target()
        s.flush()
        d, st = s.get_data(), s.get_stride()
        v = int(grey * 255)
        for y in range(y0, y0 + CH * 2):
            for x in range(x0, x0 + CW * 2):
                o = y * st + x * 4
                if d[o + 1] < 128:
                    d[o:o + 3] = bytes((v, v, v))
        s.mark_dirty()
    return paint


def repaper(grey):
    """the white paper of the cell in a light grey"""
    def paint(cr, x0, y0):
        s = cr.get_target()
        s.flush()
        d, st = s.get_data(), s.get_stride()
        v = int(grey * 255)
        for y in range(y0, y0 + CH * 2):
            for x in range(x0, x0 + CW * 2):
                o = y * st + x * 4
                if d[o:o + 3] == b"\xff\xff\xff":
                    d[o:o + 3] = bytes((v, v, v))
        s.mark_dirty()
    return paint


CASES = [
    ("editorial", "pwr", "a ring drawn wrong: 40x40 px more", rect(0, 20, 120, 40, 40)),
    ("stationery", "card", "a seam grown to a line", rect(0, 20, 170, 60, 1)),
    ("white", "sep", "a rule drawn twice", rect(0, 40, 100, 240, 3)),
    ("white", "text-name", "a light grey paper under the text", repaper(0.8)),
    ("editorial", "text-head", "no text", rect(1, 0, 0, CW * 2, CH * 2)),
    ("stationery", "text-seg", "text in another grey", recolour(0.5)),
    ("white", "text-lbl", "text four times larger", rect(0, 40, 40, 260, 120)),
]


def main(d):
    fails = 0
    for voice, name, what, paint in CASES:
        r = run(d, voice, name, paint)
        print("%s %s %s: %s" % ("ok  " if r else "FAIL", voice, name, what + (" fails" if r else " passes")))
        fails += not r
    print("compare-selftest: %s" % ("all passed" if not fails else "%d FAILED" % fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
