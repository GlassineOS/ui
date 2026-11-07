#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of the Interleaf tokens and their forms (stdlib only).

- aliases resolve, a theme without a value takes its fallback's (spec 002)
- the voices' scheme comes from the E-ink themes (002 FR-002), the rest of the voice data is kept
- a changed token reaches the voices' scheme and the web form; --check notices stale forms (002 FR-011)
- the web form: 27 combinations, every variable the component styles read is declared (002 FR-010)
- export-claude stages the claude.ai design-system layout (002 FR-040)
"""
import importlib.machinery
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
ok(tok.raw("passe-partout", "white-night") == tok.raw("passe-partout", "white-paper"),
   "fallback: any other theme takes the first theme's")
ok(tok.raw("passe-partout", "stationery-eink", eink_only=True) == tok.raw("passe-partout", "eink"),
   "fallback for the voices: E-ink themes only")
ok(tok.raw("dim", "white-paper") is None, "dim: no value outside the E-ink themes")
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
ok('[data-pen="2"]:is(:root, [data-theme]), [data-pen="2"] [data-theme] { --accent: var(--accent-2); '
   '--highlight: var(--highlight-2); }' in css and css.index('[data-pen="2"]') > css.index('[data-theme="stationery-eink"] {'),
   "tokens.css: pen 2 after the themes")
ok("--pen: var(--accent);" in css and "--on-accent-soft: var(--ink-soft);" in css, "tokens.css: aliases as var()")
declared = set(re.findall(r"(--[a-z0-9-]+)\s*:", css + bundle))
used = set(re.findall(r"var\((--[a-z0-9-]+)", bundle))
missing = sorted(u for u in used - declared if not u.startswith("--sw-"))   # --sw-*: a swatch's own, with a fallback
ok(not missing, "every variable bundle.css reads is declared%s" % (": missing " + ", ".join(missing) if missing else ""))
ok(bundle == "/* GENERATED by tools/gen-interleaf from interleaf/components/bundle.css: do not edit by hand. */\n"
   + open(os.path.join(ROOT, "interleaf", "components", "bundle.css")).read(), "web/bundle.css: the component styles")
ok(".il-type-body {" in css and not re.search(r"^\.body ", css, re.M), "type styles: classes .il-type-NAME")

# the component sources: a README and a preview whose first line is claude.ai's card marker
comp = os.path.join(ROOT, "interleaf", "components")
names = sorted(n for n in os.listdir(comp) if os.path.isdir(os.path.join(comp, n)))
ok(len(names) == 13, "13 components")
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
    open(tp, "w").write(good)

    # export-claude (002 FR-040)
    ex = os.path.join(tmp, "claude")
    r = run([sys.executable, os.path.join(ROOT, "tools", "export-claude"), ex])
    ok(r.returncode == 0, "export-claude runs")
    got = sorted(os.path.relpath(os.path.join(dp, f), ex) for dp, _, fs in os.walk(ex) for f in fs)
    want = ["README.md", "components/bundle.css", "design-system.json", "tokens.json"]
    for n in names:
        want += ["components/%s/%s" % (n, f) for f in ("README.md", "preview.html") if os.path.exists(os.path.join(comp, n, f))]
    ok(got == sorted(want), "export-claude: README.md, tokens.json, components/..., design-system.json and nothing else")
    ok(all(open(os.path.join(ex, "components", n, "preview.html")).read() == open(os.path.join(comp, n, "preview.html")).read()
           for n in names) and open(os.path.join(ex, "README.md")).read() == open(os.path.join(ROOT, "interleaf", "README.md")).read()
       and open(os.path.join(ex, "components", "bundle.css")).read() == open(os.path.join(comp, "bundle.css")).read(),
       "export-claude: guidelines, previews (with their @dsCard line) and styles as they are")
    et = gen.Tokens(json.load(open(os.path.join(ex, "tokens.json"))))
    sh = [t for t in et.data["shadow"]["tokens"] if t["name"] == "passe-partout"][0]
    ok(sh["value"].get("stationery-eink") == tok.raw("passe-partout", "eink"),
       "export-claude: stationery-eink's fallback written out (claude.ai falls back to the first theme)")
    ok(all(et.raw(n, th) == tok.raw(n, th) for n in gen.themed(tok) for th in tok.themes),
       "export-claude: every token as the web form has it, in every theme")
    ds = json.load(open(os.path.join(ex, "design-system.json")))
    ok(ds["v"] == 3 and ds["layout"] == "files" and ds["namespace"] == "Interleaf" and ds["docs"]["readme"] == "project/README.md",
       "export-claude: design-system.json")
    r = run([sys.executable, os.path.join(ROOT, "tools", "export-claude"), ex])
    ok(r.returncode != 0 and "not empty" in r.stderr, "export-claude: a non-empty directory is refused")
finally:
    shutil.rmtree(tmp)

print("interleaf: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
