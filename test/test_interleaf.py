#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of the Interleaf tokens and their forms (stdlib only).

- aliases resolve, a theme without a value takes its fallback's (spec 002)
- the voices' scheme comes from the E-ink themes (002 FR-002), the rest of the voice data is kept
- a changed token reaches the voices' scheme and the web form; --check notices stale forms (002 FR-011)
- the web form: 27 combinations, every variable the component styles read is declared (002 FR-010)
- coverage: every colour in every theme, every shadow where a theme's component styles read it
- the README's web form contract names every per-voice variable (--v-*) bundle.css sets
"""
import importlib.machinery
import hashlib
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = 0


def ok(cond, what):
    global fails
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        fails += 1


def load(name, rel):
    loader = importlib.machinery.SourceFileLoader(name, os.path.join(ROOT, rel))
    mod = importlib.util.module_from_spec(importlib.util.spec_from_loader(name, loader))
    loader.exec_module(mod)
    return mod


def raises(fn, text):
    try:
        fn()
    except (KeyError, ValueError) as e:
        return text in str(e)
    return False


gen = load("gen_interleaf", "tools/gen-interleaf")
tokens = json.load(open(os.path.join(ROOT, "interleaf", "tokens.json")))
tok = gen.Tokens(tokens)
voices = json.load(open(os.path.join(ROOT, "voices", "voices.json")))

# aliases and fallbacks
ok(tok.raw("on-accent-soft", "eink") == "{ink-soft}" and tok.resolve("on-accent-soft", "eink") == "#444444",
   "alias: on-accent-soft -> {ink-soft} on e-ink")
ok(tok.resolve("focus", "white-paper") == tok.resolve("accent", "white-paper") == "#2747b8",
   "alias chain: focus -> {pen} -> {accent}")
ok(tok.resolve("focus-on-leather", "eink") == "#111111", "alias: focus-on-leather -> {focus}")
ok(tok.raw("keycap", "stationery-eink") == tok.raw("keycap", "eink"),
   "fallback: stationery-eink takes eink's value where it has none")
ok(tok.raw("passe-partout", "white-night") is None,
   "no fallback to the first theme: white-night has no passe-partout (the White styles do not read it)")
ok(tok.resolve("dim", "stationery-night") == tok.resolve("rule", "stationery-night") and tok.resolve("dim", "eink") == "#bbbbbb",
   "dim: the rule in Paper and Night, its own grey on e-ink")
bad = json.loads(json.dumps(tokens))
for t in bad["color"]["tokens"]:
    if t["name"] == "pen":
        t["value"]["eink"] = "{focus}"
    if t["name"] == "focus":
        t["value"]["eink"] = "{pen}"
ok(raises(lambda: gen.Tokens(bad).resolve("pen", "eink"), "alias cycle"), "an alias cycle is refused")
ok(raises(lambda: gen.Tokens(bad).resolve("nope", "eink"), "no token"), "an unknown token is refused")
ok(gen.shadow_list("0 0 0 5px #ffffff, 0 0 0 6px #111111") == "0 0 0 5px #ffffff,0 0 0 6px #111111" and
   gen.shadow_list("0 0 0 1px rgba(0, 0, 0, 0.5), 0 3px 0 #111111") == "0 0 0 1px rgba(0, 0, 0, 0.5),0 3px 0 #111111",
   "shadow lists: joined by ',' alone, a function's commas kept")
ok(gen.shadow_list("0 0 0 1px color-mix(in srgb, rgb(1,2,3) 50%, red), 0 3px 0 #111111")
   == "0 0 0 1px color-mix(in srgb, rgb(1,2,3) 50%, red),0 3px 0 #111111"
   and gen.shadow_list("0 3px 0 #111111") == "0 3px 0 #111111", "shadow lists: nested functions are not split")

# the voices' scheme (002 FR-002)
for name, v in voices["voices"].items():
    ok(gen.scheme(tok, name) == v["scheme"], name + ": voices.json's scheme is the tokens' " + gen.VOICE_THEME[name])
no_offset = json.loads(json.dumps(tokens))
for t in no_offset["shadow"]["tokens"]:
    if t["name"] == "offset":
        del t["value"]["eink"]
ok(raises(lambda: gen.scheme(gen.Tokens(no_offset), "stationery"), "offset: no value in the E-ink theme"),
   "a scheme token without an E-ink value is refused, not taken from the first theme")
rgba = json.loads(json.dumps(tokens))
for t in rgba["color"]["tokens"]:
    if t["name"] == "gilt":
        t["value"]["stationery-eink"] = "rgba(0, 0, 0, 0.3)"
ok(raises(lambda: gen.scheme(gen.Tokens(rgba), "stationery"), "gilt (stationery-eink): not an e-ink colour"),
   "a scheme colour that is not #rrggbb is refused")
ok(raises(lambda: gen.scheme(tok, "fourth"), "voice fourth"), "a voice without an E-ink theme is refused")

# the web form (002 FR-010)
css = open(os.path.join(ROOT, "web", "tokens.css")).read()
bundle = open(os.path.join(ROOT, "web", "bundle.css")).read()
combos = json.load(open(os.path.join(ROOT, "web", "combinations.json")))["combinations"]
keys = {(c["voice"], c["scheme"], c["pen"]) for c in combos}
ok(len(combos) == 27 and len(keys) == 27, "web form: 27 voice x scheme x pen combinations")
ok(len({(c["attributes"]["data-theme"], c["attributes"]["data-pen"]) for c in combos}) == 27,
   "web form: each combination has its own attributes")
for c in combos:
    th = c["attributes"]["data-theme"]
    if not th.startswith(c["voice"] + "-"):
        ok(False, "web form: %s's theme %s does not start with the voice (bundle.css reads the prefix)" % (c["voice"], th))
    if '[data-theme="%s"]' % th not in css:
        ok(False, "web form: no selector for %s" % th)
ok(all(c["attributes"]["data-theme"].startswith(c["voice"] + "-") and '[data-theme="%s"]' % c["attributes"]["data-theme"] in css
       for c in combos), "web form: every combination's theme has a selector and names its voice")
ok(css.startswith("/* GENERATED") and ':root, [data-theme="white-paper"] {' in css,
   "tokens.css: the first theme on :root")
ok('[data-theme="eink"], [data-theme="white-eink"], [data-theme="editorial-eink"] {' in css,
   "tokens.css: White and Editorial on e-ink share the eink theme")


def cascade(css_text, chain):
    """the custom properties computed on the last element of chain (a list of attribute dicts,
    the first being <html>), by CSS's rules for what tokens.css uses: compound selectors of
    :root and [attr] / [attr="v"], specificity then source order, custom properties inherited
    as computed values, var(--x) substituted where it is declared"""
    rules = []
    for sels, body in re.findall(r"([^{}]+)\{([^{}]*)\}", re.sub(r"/\*.*?\*/", "", css_text, flags=re.S)):
        decls = re.findall(r"(--[a-z0-9-]+)\s*:\s*([^;]+);", body)
        if decls and sels.strip().startswith((":root", "[")):
            for sel in sels.split(","):
                rules.append((sel.strip(), decls))

    def matches(sel, i, attrs):
        for part in re.findall(r":root|\[[^\]]+\]", sel):
            if part == ":root":
                if i != 0:
                    return False
                continue
            name, _, val = part[1:-1].partition("=")
            if name not in attrs or (val and attrs[name] != val.strip('"')):
                return False
        return True

    computed = {}
    for i, attrs in enumerate(chain):
        hit = sorted(((len(re.findall(r":root|\[", sel)), n, sel) for n, (sel, _) in enumerate(rules)
                      if matches(sel, i, attrs)))
        declared = {}
        for _, n, _ in hit:
            declared.update(dict(rules[n][1]))
        mine = dict(computed)
        for prop, v in declared.items():
            mine[prop] = v.strip()
        for prop in declared:
            while "var(" in mine[prop]:
                mine[prop] = re.sub(r"var\((--[a-z0-9-]+)\)", lambda m: mine[m.group(1)], mine[prop])
        computed = mine
    return computed


def pen_of(*chain):
    return cascade(css, [dict(a) for a in chain])["--accent"]


T = lambda theme, **kw: dict({"data-theme": theme}, **kw)
page = {"data-theme": "white-paper", "data-pen": "3"}
ok(pen_of({}) == tok.raw("accent", "white-paper") and pen_of({"data-pen": "2"}) == tok.raw("accent-2", "white-paper"),
   "pen: <html data-pen> picks the default theme's pen")
ok(pen_of(page) == tok.raw("accent-3", "white-paper"), "pen: data-pen next to data-theme")
ok(pen_of(page, T("white-paper", **{"data-pen": "2"})) == tok.raw("accent-2", "white-paper"),
   "pen: a nested data-theme element's pen 2 beats the ancestor's pen 3")
ok(pen_of(page, T("white-paper", **{"data-pen": "1"})) == tok.raw("accent", "white-paper"),
   "pen: a nested data-theme element's pen 1 beats the ancestor's pen 3")
ok(pen_of(page, T("white-paper")) == tok.raw("accent", "white-paper"),
   "pen: a nested data-theme element without a pen has pen 1, not its ancestor's")
ok(pen_of(page, {"data-pen": "2"}) == tok.raw("accent-3", "white-paper"),
   "pen: a data-pen without data-theme does nothing (the ancestor's computed value is inherited)")
ok(pen_of(T("white-paper", **{"data-pen": "1"}), T("editorial-paper", **{"data-pen": "2"}))
   == tok.raw("accent-2", "editorial-paper"), "pen: another voice nested, its own pen")
ok(cascade(css, [page, T("editorial-paper", **{"data-pen": "2"})])["--pen"] == tok.raw("accent-2", "editorial-paper")
   and cascade(css, [page, T("editorial-paper")])["--pen"] == tok.raw("accent", "editorial-paper"),
   "pen: the aliases (--pen) follow the nested element's pen")
ok(pen_of(T("white-night", **{"data-pen": "3"})) == tok.raw("accent-3", "white-night"),
   "pen: the pen on a non-default theme's element")
ok("--pen: var(--accent);" in css and "--on-accent-soft: var(--ink-soft);" in css, "tokens.css: aliases as var()")
declared = set(re.findall(r"(--[a-z0-9-]+)\s*:", css + bundle))
used = set(re.findall(r"var\((--[a-z0-9-]+)", bundle))
missing = sorted(u for u in used - declared if not u.startswith("--sw-"))   # --sw-*: a swatch's own, with a fallback
ok(not missing, "every variable bundle.css reads is declared%s" % (": missing " + ", ".join(missing) if missing else ""))
src_bundle = open(os.path.join(ROOT, "interleaf", "components", "bundle.css")).read()
ok(bundle == "/* GENERATED by tools/gen-interleaf from interleaf/components/bundle.css: do not edit by hand. */\n"
   + src_bundle.replace('@import url("../fonts/fonts.css");', '@import url("fonts/fonts.css");'),
   "web/bundle.css: the component styles, the font import pointed at web/fonts/")

# the fonts: vendored, loaded locally, every family the tokens name first has its faces
fonts_dir = os.path.join(ROOT, "interleaf", "fonts")
fonts_css = open(os.path.join(fonts_dir, "fonts.css")).read()
ok(not re.search(r"https?:", src_bundle + bundle + css + fonts_css),
   "no style loads anything from another site (the fonts are vendored)")
faces = re.findall(r'@font-face \{ font-family: "([^"]+)"; font-style: (\w+); font-weight: ([\d ]+);[^}]*url\("([^"]+)"\)', fonts_css)
ok(faces and all(os.path.isfile(os.path.join(fonts_dir, f)) and f.endswith(".woff2") for _, _, _, f in faces),
   "fonts.css: every face's file is there, as woff2")
ok(all(os.path.isfile(os.path.join(fonts_dir, f.split("/")[0], "OFL.txt")) for _, _, _, f in faces),
   "fonts: each family's licence beside its fonts")
named = {re.match(r'\s*"?([^",]+)"?', v).group(1) for v in tokens["type"]["families"].values()}
ok(named == {fam for fam, _, _, _ in faces}, "fonts: the families the tokens name first, and no others (%s)" % ", ".join(sorted(named)))
def covers(fam, style, w):
    for f, st, wt, _ in faces:
        lo, hi = (wt.split() + wt.split())[:2]
        if f == fam and st == style and int(lo) <= w <= int(hi):
            return True
    return False
used = [("IBM Plex Sans", "normal", w) for w in (400, 500, 600)] + [("IBM Plex Sans", "italic", 400)] \
    + [("IBM Plex Mono", "normal", w) for w in (400, 500, 600)] + [("IBM Plex Mono", "italic", 400)] \
    + [("Source Serif 4", st, w) for st in ("normal", "italic") for w in (400, 600)] \
    + [("EB Garamond", "normal", w) for w in (400, 500, 600)] + [("EB Garamond", "italic", w) for w in (400, 500)] \
    + [("Kalam", "normal", w) for w in (400, 700)]
gaps = ["%s %s %d" % u for u in used if not covers(*u)]
ok(not gaps, "fonts: every weight and style the styles use has a face%s" % (": missing " + ", ".join(gaps) if gaps else ""))
# IBM Plex reserves its font name, so its files are IBM's, byte for byte; only families with no
# reserved name may be cut
fetch = load("fetch_fonts", "tools/fetch-fonts")
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
bad = [n for _, folder, _, _, _, _, fs in fetch.PLEX for _, s, n, _, _ in fs if sha(os.path.join(fonts_dir, folder, n)) != s]
ok(not bad, "IBM Plex: every file is IBM's release file, byte for byte%s" % (": " + ", ".join(bad) if bad else ""))
ok(all(sha(os.path.join(fonts_dir, folder, "OFL.txt")) == ls for _, folder, _, _, _, ls, _ in fetch.PLEX),
   "IBM Plex: the licence is the one from that release")
reserved = [f for _, f, _, _ in fetch.FAMILIES if b"with Reserved Font Name" in open(os.path.join(fonts_dir, f, "OFL.txt"), "rb").read()]
ok(not reserved, "fonts: no family that is cut reserves its name%s" % (": " + ", ".join(reserved) if reserved else ""))
web_fonts = os.path.join(ROOT, "web", "fonts")
same = sorted(os.listdir(web_fonts)) == sorted(os.listdir(fonts_dir)) and all(
    open(os.path.join(web_fonts, f, n) if os.path.isdir(os.path.join(fonts_dir, f)) else os.path.join(web_fonts, f), "rb").read()
    == open(os.path.join(fonts_dir, f, n) if os.path.isdir(os.path.join(fonts_dir, f)) else os.path.join(fonts_dir, f), "rb").read()
    for f in os.listdir(fonts_dir) for n in (os.listdir(os.path.join(fonts_dir, f)) if os.path.isdir(os.path.join(fonts_dir, f)) else [None]))
ok(same, "web/fonts/ is interleaf/fonts/")
ok(".il-type-body {" in css and not re.search(r"^\.body ", css, re.M), "type styles: classes .il-type-NAME")

# coverage: a theme reads what its component styles read, and nothing is borrowed from the first theme
bsrc = open(os.path.join(ROOT, "interleaf", "components", "bundle.css")).read()
shadows = lambda web: sorted(n for n in gen.reads(tok, web, bsrc) if tok.by_name[n][0] == "shadow")
ok(shadows("white-night") == ["keycap"] and shadows("editorial-eink") == ["offset", "passe-partout"]
   and shadows("stationery-paper") == ["card-stack", "sheet-stack"],
   "coverage: each voice's styles read its own shadows (a voice's rule replaces the shared one)")
ok(gen.coverage(tok) is None, "coverage: the tokens have every value their themes read")
def without(fam, name, theme):
    d = json.loads(json.dumps(tokens))
    for t in d[fam]["tokens"]:
        if t["name"] == name:
            del t["value"][theme]
    return gen.Tokens(d)
ok(raises(lambda: gen.coverage(without("shadow", "offset", "editorial-night")),
          "offset (editorial-night, read by the editorial styles)"),
   "coverage: a shadow a theme's styles read, without a value there, is refused")
ok(gen.coverage(without("shadow", "offset", "white-paper")) is None,
   "coverage: a shadow no style of that theme reads may be left out")
ok(raises(lambda: gen.coverage(without("color", "gilt", "white-night")), "gilt (white-night)"),
   "coverage: a colour without a value in some theme is refused")
ok(raises(lambda: gen.coverage(tok, '[data-theme="white-night"] .x { box-shadow: var(--sheet-stack); }'),
          "sheet-stack (white-night"),
   "coverage: a theme-specific rule counts for that theme")
ok(gen.coverage(tok, '.x { box-shadow: var(--sheet-stack); } [data-theme^="white"] .x { box-shadow: var(--keycap); }'
                     '[data-theme^="editorial"] .x { box-shadow: none; }') is None,
   "coverage: a shared rule every voice without the shadow replaces is fine")

# the component sources: a README and a preview whose first line is claude.ai's card marker
comp = os.path.join(ROOT, "interleaf", "components")
names = sorted(n for n in os.listdir(comp) if os.path.isdir(os.path.join(comp, n)))
ok(len(names) == 16, "16 components")
# a component has a README; Cover's is not written yet (the import had none), and no other may be missing
no_readme = [n for n in names if not os.path.exists(os.path.join(comp, n, "README.md"))]
ok(set(no_readme) <= {"Cover"}, "every component but Cover has a README%s" % (": missing " + ", ".join(no_readme) if set(no_readme) - {"Cover"} else ""))
ok(all(open(os.path.join(comp, n, "preview.html")).readline().startswith("<!-- @dsCard ") for n in names),
   "every preview starts with its @dsCard line")

# a changed token reaches every form; the stale ones are named
os.makedirs(os.path.join(ROOT, "out", "test"), exist_ok=True)
tmp = tempfile.mkdtemp(dir=os.path.join(ROOT, "out", "test"))
try:
    for d in ("interleaf", "tools", "voices", "web", "src", "python"):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d))
    gi = [sys.executable, os.path.join(tmp, "tools", "gen-interleaf")]
    gv = [sys.executable, os.path.join(tmp, "tools", "gen-voices")]
    run = lambda cmd: subprocess.run(cmd, capture_output=True, text=True)
    ok(run(gi + ["--check"]).returncode == 0, "gen-interleaf: the forms are current")
    tp = os.path.join(tmp, "interleaf", "tokens.json")
    good = open(tp).read()
    d = json.loads(good)
    for t in d["color"]["tokens"]:
        if t["name"] == "ink-soft":
            t["value"]["stationery-eink"] = "#555555"
    json.dump(d, open(tp, "w"), indent=2)
    r = run(gi + ["--check"])
    ok(r.returncode == 1 and "voices/voices.json" in r.stderr and "web/tokens.css" in r.stderr
       and "bundle.css" not in r.stderr, "--check fails on a changed token, naming the voices and tokens.css")
    ok(run(gi).returncode == 0, "gen-interleaf writes")
    vd = json.load(open(os.path.join(tmp, "voices", "voices.json")))
    ok(vd["voices"]["stationery"]["scheme"]["ink-soft"] == "#555555" and vd["voices"]["white"]["scheme"]["ink-soft"] == "#444444",
       "the changed token is in Stationery's scheme, White's unchanged")
    ok(vd["voices"]["stationery"]["scheme"]["on-accent-soft"] == "#bbbbbb", "a value of its own is not the alias's")
    tc = open(os.path.join(tmp, "web", "tokens.css")).read()
    block = tc[tc.index('[data-theme="stationery-eink"] {'):]
    ok("--ink-soft: #555555;" in block[:block.index("}")], "the changed token is in tokens.css's stationery-eink")
    r = run(gv + ["--check"])
    ok(r.returncode == 1 and "_voices.py" in r.stderr, "then gen-voices --check names the Python data")
    run(gv)
    ok("'ink-soft': '#555555'" in open(os.path.join(tmp, "python", "glassine_ui", "_voices.py")).read(),
       "the changed token reaches the Python data")
    # the voice data outside "scheme" is kept as it is
    vp = os.path.join(tmp, "voices", "voices.json")
    vd["voices"]["editorial"]["shell"]["ink"] = "#222222"
    vd["voices"]["editorial"]["scheme"]["ink"] = "#999999"
    json.dump(vd, open(vp, "w"), indent=2)
    r = run(gi + ["--check"])
    ok(r.returncode == 1 and "voices/voices.json" in r.stderr, "--check fails on a scheme edited by hand")
    run(gi)
    vd = json.load(open(vp))
    ok(vd["voices"]["editorial"]["shell"]["ink"] == "#222222" and vd["voices"]["editorial"]["scheme"]["ink"] == "#111111",
       "gen-interleaf: the scheme rewritten from the tokens, shell kept")
    open(tp, "w").write(good)
    vd["voices"]["editorial"]["shell"]["ink"] = voices["voices"]["editorial"]["shell"]["ink"]
    json.dump(vd, open(vp, "w"), indent=2)
    run(gi)
    ok(open(vp).read() == open(os.path.join(ROOT, "voices", "voices.json")).read(),
       "the tokens restored: voices.json is byte for byte the repository's")
    # stale web form: an edit by hand, a changed component style
    wb = os.path.join(tmp, "web", "bundle.css")
    open(wb, "a").write("/* by hand */\n")
    r = run(gi + ["--check"])
    ok(r.returncode == 1 and "web/bundle.css" in r.stderr, "--check fails on a web form edited by hand")
    run(gi)
    open(os.path.join(tmp, "interleaf", "components", "bundle.css"), "a").write(".il-x { color: var(--ink); }\n")
    r = run(gi + ["--check"])
    ok(r.returncode == 1 and "web/bundle.css" in r.stderr and "tokens.css" not in r.stderr,
       "--check fails on a changed component style, naming web/bundle.css")
    # the fonts' copy in web/: a changed font, a font left over
    open(os.path.join(tmp, "interleaf", "fonts", "kalam", "OFL.txt"), "a").write("\n")
    open(os.path.join(tmp, "web", "fonts", "Old.woff2"), "w").write("x")
    r = run(gi + ["--check"])
    ok(r.returncode == 1 and "web/fonts/kalam/OFL.txt" in r.stderr and "web/fonts/Old.woff2" in r.stderr,
       "--check names a changed font and a font left over in web/fonts/")
    run(gi)
    ok(not os.path.exists(os.path.join(tmp, "web", "fonts", "Old.woff2")) and run(gi + ["--check"]).returncode == 0,
       "gen-interleaf: the copy in web/fonts/ follows interleaf/fonts/")
    os.remove(os.path.join(tmp, "web", "combinations.json"))
    r = run(gi + ["--check"])
    ok(r.returncode == 1 and "combinations.json" in r.stderr and not os.path.exists(os.path.join(tmp, "web", "combinations.json")),
       "--check: a missing form is out of date, and --check writes nothing")
    r = run(gi + ["--chek"])
    ok(r.returncode == 2 and "usage" in r.stderr and not os.path.exists(os.path.join(tmp, "web", "combinations.json")),
       "gen-interleaf --chek: usage, exit 2, nothing written")
    # a broken token is an error with a message, not a traceback
    d = json.loads(good)
    for t in d["color"]["tokens"]:
        if t["name"] == "gold":
            t["value"]["eink"] = "{nope}"
    json.dump(d, open(tp, "w"), indent=2)
    r = run(gi)
    ok(r.returncode == 1 and "Traceback" not in r.stderr and "nope" in r.stderr, "an alias of no token: an error naming it")
    # the same outside the E-ink scheme tokens: the web form is not written with a broken var()
    d = json.loads(good)
    for t in d["color"]["tokens"]:
        if t["name"] == "pen":
            t["value"]["white-night"] = "{nope}"
    json.dump(d, open(tp, "w"), indent=2)
    r = run(gi)
    ok(r.returncode == 1 and "Traceback" not in r.stderr and "nope" in r.stderr and "--pen: var(--nope)" not in
       open(os.path.join(tmp, "web", "tokens.css")).read(), "an alias of no token in a Night theme: an error, nothing written")
    d = json.loads(good)
    for t in d["color"]["tokens"]:
        if t["name"] == "gilt":
            t["value"]["editorial-paper"] = "{gold}"
        if t["name"] == "gold":
            t["value"]["editorial-paper"] = "{gilt}"
    json.dump(d, open(tp, "w"), indent=2)
    r = run(gi)
    ok(r.returncode == 1 and "Traceback" not in r.stderr and "alias cycle" in r.stderr and "gilt" in r.stderr
       and "--gilt: var(--gold)" not in open(os.path.join(tmp, "web", "tokens.css")).read(),
       "an alias cycle in a Paper theme: an error, nothing written")
    d = json.loads(good)
    for t in d["color"]["tokens"]:
        if t["name"] == "grey-0":
            t["value"] = "{nope}"
    json.dump(d, open(tp, "w"), indent=2)
    ok(run(gi).returncode == 1, "an alias of no token in a token without themes: an error")
    open(tp, "w").write(good)
finally:
    shutil.rmtree(tmp)

# the per-voice variables are part of the web form contract: the README names each one bundle.css sets
readme = open(os.path.join(ROOT, "README.md")).read()
vvars = sorted(set(re.findall(r"--v-[a-z0-9-]+", open(os.path.join(ROOT, "web", "bundle.css")).read())))
unnamed = [v for v in vvars if "`%s`" % v not in readme]
ok(vvars and not unnamed, "README names every --v-* variable of bundle.css (%d)%s" % (len(vvars), ": missing " + " ".join(unnamed) if unnamed else ""))

print("interleaf: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
