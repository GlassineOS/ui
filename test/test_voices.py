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
    ok(set(v) == {"title", "scheme", "shell", "c", "card", "setup"}, name + ": sections")
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
    # the design importer: dumps made of the current values change nothing
    sd = {n: {"il": {"--il-" + k: x for k, x in v["scheme"].items()},
              "t": dict(v["shell"], ink="var(--il-ink)"), "k": v["card"]}
          for n, v in data["voices"].items()}
    ud = {n: {"il": {"--il-" + k: x for k, x in v["scheme"].items()}, "k": v["setup"]}
          for n, v in data["voices"].items()}
    json.dump(sd, open(os.path.join(tmp, "sd.json"), "w"))
    json.dump(ud, open(os.path.join(tmp, "ud.json"), "w"))
    before = open(p).read()
    subprocess.run([sys.executable, os.path.join(tmp, "tools", "import-design"), os.path.join(tmp, "sd.json"),
                    os.path.join(tmp, "ud.json")], check=True, capture_output=True)
    ok(open(p).read() == before, "import-design: the current values (one through a var()) round-trip unchanged")
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
