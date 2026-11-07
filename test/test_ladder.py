#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of tools/ladder (spec 002 FR-021, stdlib only).

- the mapping rule: panel levels at gamma 1.8, the ladder greys, the tie-breaks
- the check passes on this repository's tokens, styles and voice data
- known failures: one fixture per kind of fault, each put into a copy of the real data on
  its own, must be refused, naming where it is
- what is not a fault: a gradient in a Paper-only rule, a shared declaration that an E-ink
  rule replaces, radii that look like a shadow, prose
"""
import copy
import importlib.machinery
import importlib.util
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = 0


def ok(cond, what):
    global fails
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        fails += 1


loader = importlib.machinery.SourceFileLoader("ladder", os.path.join(ROOT, "tools", "ladder"))
L = importlib.util.module_from_spec(importlib.util.spec_from_loader("ladder", loader))
loader.exec_module(L)

TOKENS = json.load(open(L.TOKENS))
BUNDLE = open(L.BUNDLE).read()
VOICES = json.load(open(L.VOICES))

# ---- the rule ---------------------------------------------------------------------------

ok([L.level(17 * k) for k in range(16)] == [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 12, 14, 15],
   "ladder levels at gamma 1.8 (the panel's top nibble after the grey curve)")
ok([L.level(17 * k, 1.0) for k in range(16)] == list(range(16)), "at gamma 1.0 each ladder grey is its own level")
ok(L.to_ladder("#bdbdbd") == "#bbbbbb" and L.level(0xbd) == L.level(0xbb) == 9, "#bdbdbd -> #bbbbbb (same level)")
ok(L.to_ladder("#a0a0a0") == "#999999" and L.level(0xa0) == L.level(0x99) == 6, "#a0a0a0 -> #999999 (same level)")
ok(L.to_ladder("#b4b4b4") == "#bbbbbb" and L.level(0xb4) == 8,
   "#b4b4b4 (level 8, no ladder grey) -> #bbbbbb: of two equally near levels, the higher")
ok(L.to_ladder("#d0d0d0") == "#dddddd" and L.to_ladder("#e4e4e4") == "#eeeeee", "the same tie-break at levels 11 and 13")
ok(L.to_ladder("#1b1b1b") == "#222222" and L.to_ladder("#141414") == "#111111",
   "level 0 has four ladder greys: the nearest in value")
ok(L.to_ladder("#1b1b1b", ink="#111111") == "#111111" and L.to_ladder("#333333", ink="#111111") == "#111111",
   "a grey on the ink's level maps to the voice's ink")
ok(L.to_ladder("#4a4a4a", ink="#111111") == "#444444", "a grey on another level ignores the ink")
ok(L.over("111111", 0x60, "ffffff") == 165 and L.over("ffffff", 0x60, "dddddd") == 234,
   "a translucent grey over a face: the composite value")
ok(all(L.to_ladder(g) == g for g in L.LADDER), "a ladder grey maps to itself")
ok(L.lut(0xb4) == 136 and L.lut(0x80) == 74, "the grey curve rounds as lround(255 (v/255)^1.8)")
try:
    L.to_ladder("#b4b4b5")
    ok(False, "a colour that is not a grey is refused by the mapping")
except ValueError:
    ok(True, "a colour that is not a grey is refused by the mapping")

# ---- this repository --------------------------------------------------------------------

faults, seen = L.check()
ok(faults == [], "this repository's E-ink values are on the ladder%s"
   % ("" if not faults else ": " + "; ".join("%s: %s" % f[:2] for f in faults[:5])))
ok(L.PENDING == {} and seen == set(), "nothing is pending")
r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "ladder"), "--check"], capture_output=True, text=True)
ok(r.returncode == 0, "ladder --check passes")


# ---- known failures ---------------------------------------------------------------------

def token(t, name):
    for fam in ("color", "shadow"):
        for x in t.get(fam, {}).get("tokens", []):
            if x["name"] == name:
                return x
    raise KeyError(name)


def f_token_colour(t, b, v):
    token(t, "shade")["value"]["eink"] = "#b4b4b4"


def f_token_alias(t, b, v):
    token(t, "index-line")["value"]["stationery-eink"] = "rgba(0, 0, 0, 0.16)"
    token(t, "dim")["value"]["stationery-eink"] = "{index-line}"


def f_token_shadow_colour(t, b, v):
    token(t, "keycap")["value"]["eink"] = "0 3px 0 #b5b5b5"


def f_token_shadow_blur(t, b, v):
    token(t, "offset")["value"]["eink"] = "3px 3px 4px #111111"


def f_bundle_shared_gradient(t, b, v):
    return b.replace('[data-theme="eink"], [data-theme="white-eink"] { --v-link-bg: none; }', "")


def f_bundle_voice_blur(t, b, v):
    return b + '\n[data-theme^="stationery"] .il-btn { box-shadow: 0 2px 4px var(--ink); }\n'


def f_bundle_rgba(t, b, v):
    return b + '\n.il-footer { border-top-color: rgba(0, 0, 0, 0.5); }\n'


def f_bundle_named(t, b, v):
    return b + '\n[data-theme="stationery-eink"] .il-footer { color: silver; }\n'


def f_bundle_filter(t, b, v):
    return b + '\n.il-header { backdrop-filter: blur(4px); }\n'


def f_bundle_var_chain(t, b, v):
    return b + '\n.il-desk { --x: radial-gradient(var(--ink), var(--paper)); background: var(--x, none); }\n' \
        + ':root { --v-desk: var(--x2, conic-gradient(red, blue)); }\n'


def f_bundle_eink_rule(t, b, v):
    return b + '\n[data-theme="editorial-eink"] .il-mark { background: #f0f0f0; }\n'


def f_bundle_url_semicolon(t, b, v):
    return b + '\n.il-x { background: url(data:image/png;base64,AAAA), linear-gradient(#111111, #ffffff); }\n'


def f_bundle_important(t, b, v):
    return b + '\n.il-x { background: linear-gradient(#111111, #ffffff) !important; }\n' \
        + '[data-theme="eink"] .il-x, [data-theme="white-eink"] .il-x, [data-theme="editorial-eink"] .il-x, ' \
        + '[data-theme="stationery-eink"] .il-x { background: none; }\n'


def f_voice_shadow(t, b, v):
    v["voices"]["white"]["shell"]["btnSh"] = "inset 0 0 0 1.5px #111111,0 3px 0 #b4b4b4"


def f_voice_blur(t, b, v):
    v["voices"]["editorial"]["card"]["tabSh"] = "0 2px 3px #111111"


def f_voice_short_hex(t, b, v):
    v["voices"]["stationery"]["shell"]["gripLip"] = "#bbb"


def f_voice_rgba(t, b, v):
    v["voices"]["white"]["setup"]["netOnBg"] = "rgba(0, 0, 0, 0.1)"


def f_apps_rule_gradient(t, b, v):
    v["voices"]["white"]["apps"]["gtk3Rules"].append("headerbar { background-image: linear-gradient(#ffffff, #eeeeee); }")


def f_apps_rule_blur(t, b, v):
    v["voices"]["editorial"]["apps"]["gtk3Rules"].append("button { box-shadow: 0 1px 2px #111111; }")


def f_apps_rule_named(t, b, v):
    v["voices"]["editorial"]["apps"]["gtk3Rules"].append("row { color: gray; }")


def f_apps_colour(t, b, v):
    v["voices"]["stationery"]["apps"]["gtk4"]["line"] = "#141414"


def f_wvkbd_colour(t, b, v):
    v["voices"]["stationery"]["apps"]["wvkbd"]["stroke"] = "b0b0b0"


def f_wvkbd_alpha(t, b, v):
    v["voices"]["white"]["apps"]["wvkbd"]["press"] = "11111180"


FIXTURES = [
    (f_token_colour, "tokens: shade (eink)", "a colour token off the ladder in eink"),
    (f_token_alias, "tokens: dim (stationery-eink)", "a colour token aliasing a translucent one"),
    (f_token_shadow_colour, "tokens: keycap (eink)", "a shadow token's colour off the ladder"),
    (f_token_shadow_blur, "tokens: offset (eink)", "a shadow token with a blur"),
    (f_bundle_shared_gradient, "bundle.css (white-eink): :root { --v-link-bg }",
     "a shared gradient no E-ink rule replaces"),
    (f_bundle_voice_blur, "bundle.css (stationery-eink): .il-btn { box-shadow }", "a voice rule's blur"),
    (f_bundle_rgba, "bundle.css (editorial-eink): .il-footer { border-top-color }", "a shared rgba()"),
    (f_bundle_named, "bundle.css (stationery-eink): .il-footer { color }", "a named colour"),
    (f_bundle_filter, "bundle.css (eink): .il-header { backdrop-filter }", "a backdrop blur"),
    (f_bundle_var_chain, "bundle.css (white-eink): :root { --v-desk }", "a gradient behind a var() fallback"),
    (f_bundle_eink_rule, "bundle.css (editorial-eink): .il-mark { background }", "an E-ink rule's own colour"),
    (f_bundle_url_semicolon, "bundle.css (eink): .il-x { background }", "a gradient after a ; inside url()"),
    (f_bundle_important, "bundle.css (eink): .il-x { background }",
     "a shared !important gradient that a plain E-ink rule does not replace"),
    (f_voice_shadow, "white: shell.btnSh", "a voice shadow off the ladder"),
    (f_voice_blur, "editorial: card.tabSh", "a voice shadow with a blur"),
    (f_voice_short_hex, "stationery: shell.gripLip", "a three-digit colour"),
    (f_voice_rgba, "white: setup.netOnBg", "a translucent voice colour"),
    (f_apps_rule_gradient, "white: apps.gtk3Rules.", "a GTK rule with a gradient"),
    (f_apps_rule_blur, "editorial: apps.gtk3Rules.", "a GTK rule with a blur"),
    (f_apps_rule_named, "editorial: apps.gtk3Rules.", "a GTK rule with a named colour"),
    (f_apps_colour, "stationery: apps.gtk4.line", "a GTK 4 colour off the ladder"),
    (f_wvkbd_colour, "stationery: apps.wvkbd.stroke", "a keyboard colour (no #) off the ladder"),
    (f_wvkbd_alpha, "white: apps.wvkbd.press", "a keyboard colour with alpha"),
]

for fn, where, what in FIXTURES:
    t, v = copy.deepcopy(TOKENS), copy.deepcopy(VOICES)
    b = fn(t, BUNDLE, v)
    b = BUNDLE if b is None else b
    got, _ = L.check(t, b, v)
    ok(any(f[0].startswith(where) for f in got),
       "refused: %s (%s)%s" % (what, where, "" if got else ": nothing found"))

# a pending value is skipped while it is there; once gone, --check fails (PENDING stays true)
saved = dict(L.PENDING)
try:
    L.PENDING[("white: apps.wvkbd.swipe", "11111160")] = "a test"
    v = copy.deepcopy(VOICES)
    v["voices"]["white"]["apps"]["wvkbd"]["swipe"] = "11111160"
    got, seen = L.check(None, None, v)
    ok(not any(f[0] == "white: apps.wvkbd.swipe" for f in got) and seen == set(L.PENDING),
       "a pending value is seen and not reported as a fault")
    _, seen = L.check()
    ok(seen != set(L.PENDING), "a pending value that is gone is not seen (--check then fails)")
finally:
    L.PENDING.clear()
    L.PENDING.update(saved)

# ---- not faults -------------------------------------------------------------------------

b = BUNDLE + '\n[data-theme="stationery-paper"] .il-desk { background: linear-gradient(red, blue); filter: blur(2px); }\n'
ok(L.check(None, b, None)[0] == [], "a gradient and a blur scoped to a Paper theme do not apply on e-ink")
b = BUNDLE + '\n.il-desk { box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); }\n' \
    + '[data-theme="eink"] .il-desk, [data-theme="white-eink"] .il-desk, [data-theme="editorial-eink"] .il-desk, ' \
    + '[data-theme="stationery-eink"] .il-desk { box-shadow: none; }\n'
ok(L.check(None, b, None)[0] == [], "a shared blur that an E-ink rule replaces does not apply on e-ink")
b = BUNDLE + '\n.il-x { background: linear-gradient(#111111, #ffffff); }\n' \
    + '[data-theme="eink"] .il-x, [data-theme="white-eink"] .il-x, [data-theme="editorial-eink"] .il-x, ' \
    + '[data-theme="stationery-eink"] .il-x { background: none !important; }\n'
ok(L.check(None, b, None)[0] == [], "an !important E-ink rule replaces a shared gradient")
ok(L.shadow_blurs("0 10px 10px 0", need_colour=True) == [] and L.shadow_blurs("0 10px 10px 0") != [],
   "a radius list in the voice data is not a shadow")
v = copy.deepcopy(VOICES)
v["voices"]["white"]["c"]["_why"] = "the old #b4b4b4, linear-gradient() and 0 2px 3px #000 in prose"
ok(L.check(None, None, v)[0] == [], "prose (_why) is not checked")
ok(L.colour_faults("1px solid currentColor, transparent", css=True) == [], "currentColor and transparent are not colours")

# ---- --map-apps -------------------------------------------------------------------------

v = copy.deepcopy(VOICES)
v["voices"]["stationery"]["apps"]["gtk3"]["soft"] = "#c4c4c4"
v["voices"]["stationery"]["apps"]["wvkbd"]["stroke"] = "b0b0b0"
v["voices"]["stationery"]["apps"]["gtk3Rules"][0] = "button { box-shadow: inset 0 3px #d0d0d0; }"
v["voices"]["stationery"]["apps"]["gtk4"]["ink"] = "#1b1b1b"
v["voices"]["white"]["apps"]["wvkbd"]["swipe"] = "11111160"
ch = L.map_apps(v)
a = v["voices"]["stationery"]["apps"]
ok(a["gtk3"]["soft"] == "#bbbbbb" and a["wvkbd"]["stroke"] == "bbbbbb" and "#dddddd" in a["gtk3Rules"][0]
   and a["gtk4"]["ink"] == "#111111", "--map-apps rewrites the GTK colours, the GTK rules and the keyboard (without #)")
ok(v["voices"]["white"]["apps"]["wvkbd"]["swipe"] == "aaaaaaff" and len(ch) == 5,
   "--map-apps makes the swipe trail the opaque grey it showed over the key face")
ok(L.map_apps(copy.deepcopy(VOICES)) == [], "this repository's apps section is already mapped")

print("ladder: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
