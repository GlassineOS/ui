#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""sheet.py VOICE OUT.png CELLS.txt: the sample sheet in Python (glassine_ui.paint),
the same elements in the same cells as sheet.c, each drawn from the voice's CSS
values the way tools/gen-voices builds the C table from them (with the voice's
"c" values, so the comparison is of the drawing code, not of the data)."""
import sys

import cairo

from glassine_ui import paint as P
from glassine_ui import voices

CW, CH, COLS, NCELL = 170, 90, 4, 40


def main(name, out, cells):
    v = voices.voice(name)
    s = dict(v["shell"])
    over = {k: x for k, x in v["c"].items() if not k.startswith("_")}
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, CW * COLS * 2, CH * (NCELL // COLS) * 2)
    cr = cairo.Context(surf)
    cr.scale(2, 2)
    P.fill(cr, 0, 0, CW * COLS, CH * (NCELL // COLS), "#ffffff")
    names = []

    def cell(n):
        i = len(names)
        names.append(n)
        return (i % COLS) * CW + 20, (i // COLS) * CH + 20

    def B(n, w, h, r, bg, sh, bd=None):
        x, y = cell(n)
        bg = over.get(n + ".bg", bg)
        P.box(cr, x, y, w, h, r, bg, sh, bd)

    B("card", 120, 50, s["cardR"], s["cardBg"], s["cardSh"], s["cardBorder"])
    B("btn", 120, 44, s["btnR"], s["btnBg"], s["btnSh"])
    B("sel", 120, 44, s["btnR"], s["selBg"], s["selSh"])
    B("tog", 64, 36, s["togR"], s["btnBg"], s["btnSh"])
    B("togOn", 64, 36, s["togR"], s["togOnBg"], s["togOnSh"])
    B("tray", 120, 44, s["trayR"], s["trayBg"], s["traySh"])
    B("segOn", 60, 40, s["segR"], s["segOnBg"], s["segOnSh"])
    B("pwr", 120, 42, s["pwrR"], s["pwrBg"], s["pwrSh"])
    B("pad", 120, 50, s["padR"], s["padBg"], s["padSh"], s["padBorder"])
    B("folder", 120, 50, s["folderR"], s["cardBg"], s["folderSh"], s["cardBorder"])
    B("folderTab", 60, 20, s["folderTabR"], s["folderTabBg"], s["folderTabSh"])
    B("app", 120, 50, s["appR"], s["appBg"], s["appSh"])
    B("tabOn", 60, 40, s["tabR"], s["tabOnBg"], s["tabOnSh"])
    B("tabOff", 60, 40, s["tabR"], s["tabOffBg"], s["tabOffSh"])
    B("plateOn", 60, 30, s["plateR"], s["plateOnBg"], s["plateOnSh"])
    B("plateOff", 60, 30, s["plateR"], None, s["plateOffSh"])
    for n in ("sep", "sepSoft", "headRule"):
        x, y = cell(n)
        b = P.border(s[n])
        P.rule(cr, x, y + 20 + (b[0] if b else 0), 120, s[n])
    for n, f, var, case, ls in (("text-lbl", "lblFont", "lblVar", "lblCase", "lblLs"),
                                ("text-name", "nameFont", None, None, None),
                                ("text-head", "headFont", "headVar", None, "headLs"),
                                ("text-date", "dateFont", None, None, None),
                                ("text-seg", "segFont", None, None, None),
                                ("text-appName", "appNameFont", "appNameVar", None, "appNameLs"),
                                ("text-tab", "tabFont", "tabVar", None, "tabLs"),
                                ("text-search", "searchFont", None, None, None)):
        x, y = cell(n)
        caps = (s[var] if var else "normal", s[case] if case else "none")
        P.text(cr, "Sample 0123", s[f], x, y, s["ink"], caps=caps, ls=P.ls_em(s[ls]) if ls else 0.0)
    x, y = cell("icon")
    P.icon(cr, "go-next-symbolic", 20 / .86, x + 20, y + 20, s["ink"])
    surf.write_to_png(out)
    with open(cells, "w") as fh:
        fh.write("".join(n + "\n" for n in names))


if __name__ == "__main__":
    main(*sys.argv[1:4])
