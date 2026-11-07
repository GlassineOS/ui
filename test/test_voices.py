#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of the voice data and its generated forms (stdlib only).

- every voice has every section, the shell section every key the C table reads
- unknown names fall back to White (FR-004)
- a change to the data reaches the C table and the Python module (scenario 2),
  and --check notices the stale forms (FR-003)
"""
import importlib.machinery
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
fails = 0


def ok(cond, what):
    global fails
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        fails += 1


def load_gen():
    path = os.path.join(ROOT, "tools", "gen-voices")
    loader = importlib.machinery.SourceFileLoader("gen_voices", path)
    spec = importlib.util.spec_from_loader("gen_voices", loader)
    mod = importlib.util.module_from_spec(spec)
    loader.exec_module(mod)
    return mod


gen = load_gen()
data = json.load(open(os.path.join(ROOT, "voices", "voices.json")))
ok(data["contract"] == 1, "voice data contract 1")
ok(list(data["voices"]) == list(gen.ORDER), "voices in order: " + ", ".join(gen.ORDER))
for name, v in data["voices"].items():
    ok(set(v) == {"title", "scheme", "shell", "c", "card", "setup", "inline", "apps"}, name + ": sections")
    try:
        gen.c_voice(name, v)
        ok(True, name + ": the C table reads every shell value it needs")
    except (KeyError, ValueError) as e:
        ok(False, "%s: the C table: %r" % (name, e))
    for k in v["c"]:
        ok(k.startswith("_") or "_why" in v["c"], name + ": c." + k + " says why")

# what UiVoice can't hold is refused, not dropped
def refused(key, value):
    """White's shell.key = value: does the C table refuse it?"""
    v = json.loads(json.dumps(data["voices"]["white"]))
    v["shell"][key] = value
    try:
        gen.c_table({"voices": dict(data["voices"], white=v)})
        return False
    except ValueError:
        return True


ok(refused("barShadow", "0 2px 0 #111111, 0 4px 0 #888888"), "barShadow: a second shadow is refused")
ok(refused("barShadow", "2px 2px 0 #111111") and refused("barShadow", "0 2px 0 1px #111111")
   and refused("barShadow", "inset 0 2px 0 #111111"), "barShadow: an x offset, a spread, inset are refused")
ok(not refused("barShadow", "0 3px 0 #111111"), "barShadow: one shadow below the bar is taken")
ok(refused("grooveSh", ", ".join(["0 0 0 1px #111111"] * 4)), "grooveSh: a fourth ring is refused")
ok(not refused("grooveSh", ", ".join(["0 0 0 1px #111111"] * 3)), "grooveSh: three rings are taken")
ok(refused("cardSh", ", ".join(["0 0 0 1px #111111"] * 9)), "a box: a ninth ring (UI_NRING) is refused")

from glassine_ui import voices  # noqa: E402

ok(voices.NAMES == ("white", "editorial", "stationery"), "Python: NAMES")
ok(voices.voice("stationery")["title"] == "Stationery", "Python: voice by name")
ok(voices.voice("nope")["name"] == "white" and voices.voice(None)["name"] == "white", "Python: unknown -> White")
ok(voices.voice("editorial")["scheme"] == data["voices"]["editorial"]["scheme"], "Python: the data's values")

# scenario 2: a designer changes the Stationery card edge
tmp = tempfile.mkdtemp()
try:
    for d in ("tools", "voices", "src", "python"):
        shutil.copytree(os.path.join(ROOT, d), os.path.join(tmp, d))
    gv = [sys.executable, os.path.join(tmp, "tools", "gen-voices")]
    ok(subprocess.run(gv + ["--check"]).returncode == 0, "generated forms are current")
    p = os.path.join(tmp, "voices", "voices.json")
    d = json.load(open(p))
    d["voices"]["stationery"]["shell"]["cardSh"] = "0 0 0 2px #111111"
    json.dump(d, open(p, "w"), indent=2)
    r = subprocess.run(gv + ["--check"], capture_output=True, text=True)
    ok(r.returncode == 1 and "glassine-ui-voices.c" in r.stderr and "_voices.py" in r.stderr,
       "--check fails on a changed card edge, naming the C and Python forms")
    subprocess.run(gv, check=True, capture_output=True)
    c = open(os.path.join(tmp, "src", "glassine-ui-voices.c")).read()
    py = open(os.path.join(tmp, "python", "glassine_ui", "_voices.py")).read()
    ok("{ 0, 0, 2, UI_RGB(0x111111), 0 }" in c, "the C table has the new edge")
    ok("'cardSh': '0 0 0 2px #111111'" in py, "the Python data has the new edge")

    # gen-apps: the GTK themes and the scripts' marked lines, into a root file system tree
    rf = os.path.join(tmp, "rootfs")
    os.makedirs(os.path.join(rf, "usr", "bin"))
    for s, ind in (("glassine-theme-apply", "    "), ("glassine-wvkbd", "            ")):
        with open(os.path.join(rf, "usr", "bin", s), "w") as fh:
            fh.write("#!/bin/sh\ncase $t in\n%s# >>> gen-apps\n%sold) ;;\n%s# <<< gen-apps\nesac\n" % (ind, ind, ind))
    ga = [sys.executable, os.path.join(tmp, "tools", "gen-apps")]
    r = subprocess.run(ga + ["--check", rf], capture_output=True, text=True)
    ok(r.returncode == 1 and "gtk4/white.css" in r.stderr, "gen-apps --check: missing files are out of date")
    subprocess.run(ga + [rf], check=True, capture_output=True)
    ok(subprocess.run(ga + ["--check", rf]).returncode == 0, "gen-apps: current after writing")
    # shell's make check runs `gen-apps --check`: a mistyped flag must not turn it into a writer
    gtk4_white = os.path.join(rf, "usr", "share", "glassine", "gtk4", "white.css")
    os.remove(gtk4_white)
    for bad in (["--chek", rf], ["--check", "--chek", rf], ["--", rf], ["--check"], [], [rf, rf]):
        r = subprocess.run(ga + bad, capture_output=True, text=True)
        ok(r.returncode == 2 and "gen-apps ROOTFS" in r.stderr and not r.stdout and not os.path.exists(gtk4_white),
           "gen-apps %s: usage, exit 2, nothing written" % (" ".join(bad).replace(rf, "ROOTFS") or "(no argument)"))
    r = subprocess.run(ga + ["--chek", rf], capture_output=True, text=True)
    ok("--chek" in r.stderr, "gen-apps: the unknown flag is named")
    subprocess.run(ga + [rf], check=True, capture_output=True)
    ok(os.path.exists(gtk4_white), "gen-apps: the plain call still writes")
    g4 = open(os.path.join(rf, "usr", "share", "glassine", "gtk4", "stationery.css")).read()
    g3 = open(os.path.join(rf, "usr", "share", "themes", "glassine-editorial", "gtk-3.0", "gtk.css")).read()
    ok("${" not in g4 and '"stationery" theme' in g4 and "toast { box-shadow: none; background-color: #141414;" in g4,
       "gen-apps: the GTK 4 template filled (stationery)")
    ok("@define-color glassine_btn transparent;" in g3 and "base.css" in g3, "gen-apps: the GTK 3 theme (editorial)")
    ta = open(os.path.join(rf, "usr", "bin", "glassine-theme-apply")).read()
    wv = open(os.path.join(rf, "usr", "bin", "glassine-wvkbd")).read()
    ok("old)" not in ta and '    stationery) font="EB Garamond 11" ;;\n    # <<< gen-apps\nesac' in ta,
       "gen-apps: the theme-apply fonts between the markers, the rest kept")
    ok('            *) set -- --fn "IBM Plex Sans Medium 16" -R 6' in wv and "editorial) set -- " in wv,
       "gen-apps: the keyboard looks, White as the fallback")
    # wvkbd's options are spliced into a shell script: what could change it is refused, with a message
    good = open(p).read()
    for what, key, value, msg in (
            ("a quote in a value", "fn", 'a"b', "'a\"b'"),
            ("a quote and a space in a value", "fn", 'a "b', "'a \"b'"),
            ("a shell character in a value", "fn", "a;b", "'a;b'"),
            ("a $ in a value", "fn", "$HOME", "'$HOME'"),
            ("an empty value", "fn", "", "''"),
            ("a number as a value", "R", 6, "must be a string"),
            ("null as a value", "R", None, "must be a string"),
            ("a command in a key", "fn; touch /tmp/x #", "1", "not an option name"),
            ("a key that starts with a dash", "-x", "1", "not an option name"),
            ("an empty key", "", "1", "not an option name")):
        d = json.loads(good)
        d["voices"]["editorial"]["apps"]["wvkbd"][key] = value
        json.dump(d, open(p, "w"), indent=2)
        r = subprocess.run(ga + [rf], capture_output=True, text=True)
        ok(r.returncode == 1 and "Traceback" not in r.stderr and msg in r.stderr and "editorial" in r.stderr,
           "gen-apps: " + what + " is refused, naming the voice")
    open(p, "w").write(good)
    ok(subprocess.run(ga + ["--check", rf]).returncode == 0, "gen-apps: the refusals wrote nothing; the data restored, it is current")
    # the voices come from the data, not a second list in gen-apps: a fourth voice gets its files, its
    # font line and a keyboard case, and the first stays the fallback
    d = json.loads(good)
    d["voices"]["fourth"] = json.loads(json.dumps(d["voices"]["editorial"]))
    json.dump(d, open(p, "w"), indent=2)
    r = subprocess.run(ga + ["--check", rf], capture_output=True, text=True)
    ok(r.returncode == 1 and "glassine-fourth/gtk-3.0/gtk.css" in r.stderr and "gtk4/fourth.css" in r.stderr and
       "glassine-theme-apply" in r.stderr and "glassine-wvkbd" in r.stderr,
       "gen-apps --check: a voice added to the data is stale in every form")
    subprocess.run(ga + [rf], check=True, capture_output=True)
    ta = open(os.path.join(rf, "usr", "bin", "glassine-theme-apply")).read()
    wv = open(os.path.join(rf, "usr", "bin", "glassine-wvkbd")).read()
    ok('    fourth) font="%s" ;;' % d["voices"]["editorial"]["apps"]["gtkFont"] in ta and "            fourth) set -- " in wv and
       wv.index("fourth) set --") < wv.index("*) set --") and wv.count("*) set --") == 1,
       "gen-apps: a voice added to the data has a font line and a keyboard case, the first voice the fallback")
    ok(os.path.exists(os.path.join(rf, "usr", "share", "themes", "glassine-fourth", "gtk-3.0", "gtk.css")) and
       os.path.exists(os.path.join(rf, "usr", "share", "glassine", "gtk4", "fourth.css")),
       "gen-apps: a voice added to the data has its GTK 3 and GTK 4 files")
    open(p, "w").write(good)
    shutil.rmtree(os.path.join(rf, "usr", "share", "themes", "glassine-fourth"))
    os.remove(os.path.join(rf, "usr", "share", "glassine", "gtk4", "fourth.css"))
    subprocess.run(ga + [rf], check=True, capture_output=True)
    ok(subprocess.run(ga + ["--check", rf]).returncode == 0, "gen-apps: the data restored, it is current")
    d = json.load(open(p))
    d["voices"]["stationery"]["apps"]["gtk4"]["line"] = "#222222"
    json.dump(d, open(p, "w"), indent=2)
    r = subprocess.run(ga + ["--check", rf], capture_output=True, text=True)
    ok(r.returncode == 1 and "gtk4/stationery.css" in r.stderr and "white.css" not in r.stderr,
       "gen-apps --check names the one stale file")
    with open(os.path.join(rf, "usr", "bin", "glassine-wvkbd"), "w") as fh:
        fh.write("#!/bin/sh\n")
    r = subprocess.run(ga + [rf], capture_output=True, text=True)
    ok(r.returncode != 0 and "gen-apps" in r.stderr, "gen-apps: a script without its markers is an error")

    # the shared scheme tokens: a change reaches glassine-ui-scheme.h, and one
    # voice alone can't change them
    d = json.load(open(p))
    for v in d["voices"].values():
        v["scheme"]["dim"] = "#a0a0a0"
    json.dump(d, open(p, "w"), indent=2)
    r = subprocess.run(gv + ["--check"], capture_output=True, text=True)
    ok(r.returncode == 1 and "glassine-ui-scheme.h" in r.stderr, "--check fails on a changed scheme token, naming scheme.h")
    subprocess.run(gv, check=True, capture_output=True)
    ok("#define UI_DIM UI_RGB(0xa0a0a0)" in open(os.path.join(tmp, "src", "glassine-ui-scheme.h")).read(),
       "scheme.h has the new token")
    d["voices"]["editorial"]["scheme"]["dim"] = "#b4b4b4"
    json.dump(d, open(p, "w"), indent=2)
    r = subprocess.run(gv, capture_output=True, text=True)
    ok(r.returncode != 0 and "scheme dim differs between voices" in r.stderr, "a scheme token one voice changes alone is refused")
finally:
    shutil.rmtree(tmp)

print("voices: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
