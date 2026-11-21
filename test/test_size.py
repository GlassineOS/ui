#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Host tests of the interface size (README "Interface size"; GlassineOS/shell spec 012):
the factor, the files, the text size and the minimums, in Python (glassine_ui.size) and,
with --cli PROGRAM (test/size-cli.c on the built library), in C: the same vectors
(test/size-vectors.json) and the same cases go through both, and the two must agree.

    test_size.py [--cli out/test/size-cli] [--out DIR]

--out DIR keeps the list of the elements that reach a minimum (size-minimums.txt).
python3 alone without --cli."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "python"))
from glassine_ui import _voices  # noqa: E402
from glassine_ui import size as Z  # noqa: E402

EPS = 1e-9
FONT = re.compile(r"^(?:italic\s+)?(?:\d{3}\s+)?([\d.]+)px(?:/[\d.]+(?:px)?)?\s+'")   # a CSS font shorthand of the voice data
fails = 0


def ok(cond, what):
    global fails
    if not cond:
        print("FAIL " + what)
        fails += 1
    return cond


def near(a, b):
    return abs(a - b) <= EPS * max(1.0, abs(b))


class Py:
    """glassine_ui.size"""
    name = "python"

    def step_ok(self, p): return Z.step_ok(p)
    def text_size_ok(self, p): return Z.text_size_ok(p)
    def plausible(self, *a): return Z.plausible(*a)
    def density(self, *a): return Z.density(*a)
    def factor(self, d, p): return Z.factor(d, p)
    def mm(self, f, d): return Z.mm_per_px(f, d)
    def devpx(self, l, f): return Z.device_px(l, f)
    def key(self, *a): return Z.output_key(*a)
    def text_px_at(self, *a): return Z.text_px_at(*a)

    def state(self, mm, t, body, row, px):
        Z.set_metrics(mm, t, body, row)
        r = Z.metrics() + (Z.text_px(px), Z.text_px(px), Z.grow(40, px, 2, 1.5), Z.min_tap())
        Z.set_metrics()
        return r

    def voice(self, name):
        v = dict(_voices.VOICES[name])
        Z.set_voice_metrics(v, 0.2, 1.25)
        m = Z.metrics()
        Z.set_metrics()
        return (Z.body_px(v), Z.row_px(v), Z.sub_px(v), m[2], m[3])

    def paths(self):
        return [Z.ui_size_path(), Z.text_size_path(), Z.output_density_path(), Z.output_scale_path()]

    def size_read(self, path, key): return Z.ui_size(key, path)

    def size_write(self, path, key, p):
        try:
            Z.write_ui_size(key, p, path)
            return 0
        except (OSError, ValueError):
            return -1

    def text_read(self, path): return Z.read_text_size(path)

    def text_write(self, path, p):
        try:
            Z.write_text_size(p, path)
            return 0
        except (OSError, ValueError):
            return -1

    def density_read(self, path, key): return Z.read_output_density(path).get(key, 0)
    def scale_read(self, path): return {k: list(v) for k, v in Z.read_output_scale(path).items()}

    def scale_write(self, path, entries):
        try:
            Z.write_output_scale(entries, path)
            return 0
        except (OSError, ValueError):
            return -1


class C:
    """the C library through test/size-cli.c"""
    name = "c"

    def __init__(self, cli):
        self.p = subprocess.Popen([cli], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1)

    def ask(self, *f):
        self.p.stdin.write("\t".join("-" if x is None else repr(x) if isinstance(x, float) else str(x) for x in f) + "\n")
        self.p.stdin.flush()
        return self.p.stdout.readline().rstrip("\n")

    def restart(self, cli, env):
        self.p.stdin.close()
        self.p.wait()
        self.p = subprocess.Popen([cli], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1, env=env)

    def step_ok(self, p): return self.ask("step", p) == "1"
    def text_size_ok(self, p): return self.ask("textok", p) == "1"
    def plausible(self, *a): return self.ask("plausible", *a) == "1"

    def density(self, wp, hp, wm, hm, kept):
        d, s = self.ask("density", wp, hp, wm, hm, kept or 0).split()
        return float(d), s

    def factor(self, d, p): return float(self.ask("factor", d, p))
    def mm(self, f, d): return float(self.ask("mm", f, d))
    def devpx(self, l, f): return int(self.ask("devpx", l, f))
    def key(self, *a): return self.ask("key", *a)
    def text_px_at(self, *a): return float(self.ask("textpx", *a))
    def state(self, *a): return tuple(float(x) for x in self.ask("state", *a).split())
    def voice(self, name): return tuple(float(x) for x in self.ask("voice", name).split())
    def paths(self): return [None if x == "-" else x for x in self.ask("paths").split("\t")]
    def size_read(self, path, key): return int(self.ask("size-read", path, key))
    def size_write(self, path, key, p): return int(self.ask("size-write", path, key, p))
    def text_read(self, path): return int(self.ask("text-read", path))
    def text_write(self, path, p): return int(self.ask("text-write", path, p))
    def density_read(self, path, key): return float(self.ask("density-read", path, key))

    def scale_read(self, path):
        f = self.ask("scale-read", path).split("\t")
        r = {}
        for x in f[1:]:
            fac, d, src, k = x.split("|", 3)
            r[k] = [float(fac), float(d), src]
        ok(int(f[0]) == len(r), "c: scale-read counts its outputs")
        return r

    def scale_write(self, path, entries):
        flat = [x for e in entries for x in e]
        return int(self.ask("scale-write", path, *flat))


def put(path, text):
    with open(path, "w", newline="") as f:
        f.write(text)


def get(path):
    with open(path, newline="") as f:
        return f.read()


# ---- the vectors ------------------------------------------------------------------------

def vectors(im, V):
    n = im.name
    u = V["unit"]
    for p, want in V["step_ok"]:
        ok(im.step_ok(p) == want, "%s: step_ok(%d)" % (n, p))
    for p, want in V["text_size_ok"]:
        ok(im.text_size_ok(p) == want, "%s: text_size_ok(%d)" % (n, p))
    for c in V["plausible"]:
        ok(im.plausible(c["w_px"], c["h_px"], c["w_mm"], c["h_mm"]) == c["ok"], "%s: plausible: %s" % (n, c["why"]))
    for c in V["density"]:
        d, s = im.density(c["w_px"], c["h_px"], c["w_mm"], c["h_mm"], c["kept"])
        ok(near(d, c["density"]) and s == c["source"], "%s: density: %s (%r %s)" % (n, c["why"], d, s))
    for c in V["factor"]:
        f = im.factor(c["density"], c["percent"])
        ok(near(f, c["factor"]), "%s: factor: %s (%r)" % (n, c["why"], f))
        if c["factor"] == int(c["factor"]):
            ok(f == c["factor"], "%s: factor: %s: exactly whole" % (n, c["why"]))
    for c in V["output_key"]:
        ok(im.key(c["make"], c["model"], c["serial"], c["name"]) == c["key"], "%s: output key %r" % (n, c["key"]))
    for c in V["text_px"]:
        g = im.text_px_at(c["px"], c["text"], c["body"], c["row"], c["mm"])
        ok(near(g, c["drawn"]), "%s: text size: %s (%r)" % (n, c["why"], g))
    # a design pixel on the glass: the unit at Default, the step's share of it otherwise
    for p in u["steps"]:
        for d in (3.6, 5.0, 7.3, 13.4):
            f = im.factor(d, p)
            if f != int(f):
                ok(near(im.mm(f, d), u["mm_per_px"] * p / 100), "%s: %g px/mm at %d %%: %g mm per design px" % (n, d, p, u["mm_per_px"] * p / 100))
    ok(near(im.mm(2, 8.943), 2 / 8.943) and im.mm(0, 8.943) == 0 and im.mm(2, 0) == 0, n + ": mm per design px after the snap; 0 when unknown")
    ok(near(im.factor(u["fallback_density"], 100), 1) and near(u["fallback_density"], 1 / u["mm_per_px"]),
       n + ": the fallback density is one device pixel per design pixel at Default")
    ok(im.devpx(702, 1.6) == 1123 and im.devpx(702, 2) == 1404 and im.devpx(884, 1.8) == 1591, n + ": a logical length in device pixels")


# ---- the files ---------------------------------------------------------------------------

def files(im, V, tmp):
    n = im.name
    d = os.path.join(tmp, n)
    os.makedirs(d)
    f = os.path.join(d, "ui-size")
    ok(im.size_read(f, "A B 1") == 100, n + ": ui-size: no file is Default")
    for c in V["ui_size_file"]:
        put(f, c["text"])
        keys = set(c["sizes"]) | {"A B 1", "C D 2", "E F 3", "G H 4", "I J 5", "nobody"}
        got = {k: im.size_read(f, k) for k in keys}
        ok(got == {k: c["sizes"].get(k, 100) for k in keys}, "%s: ui-size: %s (%r)" % (n, c["why"], got))
    os.unlink(f)

    # writes: into a directory that is not there yet
    f = os.path.join(d, "conf", "glassine", "ui-size")
    ok(im.size_write(f, "A B 1", 80) == 0 and get(f) == "80 A B 1\n", n + ": ui-size: the first write makes the file and its directory")
    ok(os.listdir(os.path.dirname(f)) == ["ui-size"], n + ": ui-size: no temporary file left")
    keep = "# the sizes\n\n85 not a step\n90 C D 2\nwords\n"
    put(f, keep + "80 A B 1\n120 E F 3\n")
    ok(im.size_write(f, "A B 1", 120) == 0 and get(f) == keep + "120 A B 1\n120 E F 3\n", n + ": ui-size: a write replaces the output's line and keeps every other line")
    ok(im.size_write(f, "G H 4", 90) == 0 and get(f) == keep + "120 A B 1\n120 E F 3\n90 G H 4\n", n + ": ui-size: a new output's line goes at the end")
    ok(im.size_write(f, "A B 1", 100) == 0 and get(f) == keep + "120 E F 3\n90 G H 4\n", n + ": ui-size: Default removes the output's line")
    ok(im.size_read(f, "A B 1") == 100 and im.size_read(f, "G H 4") == 90, n + ": ui-size: an output without a line is at Default")
    ok(im.size_write(f, "nobody", 100) == 0 and get(f) == keep + "120 E F 3\n90 G H 4\n", n + ": ui-size: Default for an output without a line changes nothing")
    put(f, "80 A B 1\n90 C D 2\n120 A B 1\n")
    ok(im.size_write(f, "A B 1", 90) == 0 and get(f) == "90 A B 1\n90 C D 2\n", n + ": ui-size: two lines for one key become one")
    put(f, "80 Acme  Wide Panel 10  S 1\n")
    ok(im.size_write(f, "Acme  Wide Panel 10  S 1", 120) == 0 and get(f) == "120 Acme  Wide Panel 10  S 1\n"
       and im.size_read(f, "Acme  Wide Panel 10  S 1") == 120, n + ": ui-size: a key with spaces")
    put(f, "80 A B 1")
    ok(im.size_write(f, "C D 2", 90) == 0 and get(f) == "80 A B 1\n90 C D 2\n", n + ": ui-size: a last line without an end stays a line")
    before = get(f)
    ok(im.size_write(f, "A B 1", 85) == -1 and im.size_write(f, "", 80) == -1 and get(f) == before, n + ": ui-size: no step, no key: refused, nothing written")
    ok(os.listdir(os.path.dirname(f)) == ["ui-size"], n + ": ui-size: no temporary file left after the writes")
    blocked = os.path.join(f, "under-a-file", "ui-size")
    ok(im.size_write(blocked, "A B 1", 80) == -1 and os.listdir(os.path.dirname(f)) == ["ui-size"], n + ": ui-size: a write that fails says so and leaves nothing")
    if os.geteuid() != 0:
        ro = os.path.join(d, "ro")
        os.makedirs(ro)
        put(os.path.join(ro, "ui-size"), "80 A B 1\n")
        os.chmod(ro, 0o500)
        ok(im.size_write(os.path.join(ro, "ui-size"), "A B 1", 90) == -1 and get(os.path.join(ro, "ui-size")) == "80 A B 1\n"
           and os.listdir(ro) == ["ui-size"], n + ": ui-size: a directory that can't be written: the file stays, no temporary file")
        os.chmod(ro, 0o700)

    # the text size
    f = os.path.join(d, "conf", "glassine", "text-size")
    ok(im.text_read(f) == 100, n + ": text-size: no file is 100")
    for c in V["text_size_file"]:
        put(f, c["text"])
        ok(im.text_read(f) == c["percent"], "%s: text-size: %s" % (n, c["why"]))
    for p in range(100, 151, 5):
        ok(im.text_write(f, p) == 0 and get(f) == "%d\n" % p and im.text_read(f) == p, "%s: text-size: %d written and read" % (n, p))
    ok(im.text_write(f, 95) == -1 and im.text_write(f, 155) == -1 and im.text_write(f, 112) == -1 and get(f) == "150\n",
       n + ": text-size: out of range, not a multiple of 5: refused")
    ok(sorted(os.listdir(os.path.dirname(f))) == ["text-size", "ui-size"], n + ": text-size: no temporary file left")

    # the kept densities (GlassineOS/shell spec 011's file, read only)
    f = os.path.join(d, "output-density")
    ok(im.density_read(f, "A B 1") == 0, n + ": output-density: no file, none kept")
    put(f, "# measured\n3.78 A B 1\n0.5 C D 2\n101 E F 3\n5,5 G H 4\n5.5 I J 5\n6 I J 5\n")
    ok([im.density_read(f, k) for k in ("A B 1", "C D 2", "E F 3", "G H 4", "I J 5", "nobody")] == [3.78, 0, 0, 0, 6, 0],
       n + ": output-density: a line per output, out of range and bad numbers skipped, the later of two")

    # the runtime file
    f = os.path.join(d, "run", "glassine", "output-scale")
    ok(im.scale_read(f) == {}, n + ": output-scale: no file, no outputs")
    for c in V["output_scale_file"]:
        os.makedirs(os.path.dirname(f), exist_ok=True)
        put(f, c["text"])
        ok(im.scale_read(f) == c["outputs"], "%s: output-scale: %s (%r)" % (n, c["why"], im.scale_read(f)))
    shutil.rmtree(os.path.dirname(f))
    two = [(1.6, 1404 / 157, "reported", "Acme Panel 10 A1B2"), (1.2, 1 / 0.224, "fallback", "HDMI-A-1")]
    ok(im.scale_write(f, two) == 0 and get(f) == "1.6 8.942675 reported Acme Panel 10 A1B2\n1.2 4.464286 fallback HDMI-A-1\n",
       n + ": output-scale: two outputs of different densities and sizes, the directory made")
    ok(im.scale_read(f) == {"Acme Panel 10 A1B2": [1.6, 8.942675, "reported"], "HDMI-A-1": [1.2, 4.464286, "fallback"]}, n + ": output-scale: read back")
    ok(im.scale_write(f, [(2.0, 5.5, "measured", "HDMI-A-1")]) == 0 and get(f) == "2 5.5 measured HDMI-A-1\n",
       n + ": output-scale: replaced as a whole after a change")
    ok(im.scale_write(f, [(1 + 73 / 120, 8.9, "reported", "A B 1")]) == 0 and get(f) == "1.608333 8.9 reported A B 1\n",
       n + ": output-scale: a factor of the compositor's 1/120 steps keeps six decimals")
    ok(im.scale_write(f, []) == 0 and get(f) == "", n + ": output-scale: no outputs, an empty file")
    ok(im.scale_write(f, [(0.0, 5.5, "measured", "A B 1")]) == -1 and im.scale_write(f, [(2.0, 5.5, "measured", "")]) == -1 and get(f) == "",
       n + ": output-scale: no factor, no key: refused, nothing written")
    ok(os.listdir(os.path.dirname(f)) == ["output-scale"], n + ": output-scale: no temporary file left")


def cross(a, b, tmp):
    """what one writes the other reads"""
    d = os.path.join(tmp, "cross-" + a.name)
    os.makedirs(d)
    f = os.path.join(d, "ui-size")
    a.size_write(f, "Acme Panel 10 A1B2", 80)
    a.size_write(f, "HDMI-A-1", 120)
    ok(b.size_read(f, "Acme Panel 10 A1B2") == 80 and b.size_read(f, "HDMI-A-1") == 120, "ui-size written by %s, read by %s" % (a.name, b.name))
    b.size_write(f, "HDMI-A-1", 100)
    ok(a.size_read(f, "HDMI-A-1") == 100 and a.size_read(f, "Acme Panel 10 A1B2") == 80, "ui-size changed by %s, read by %s" % (b.name, a.name))
    f = os.path.join(d, "text-size")
    a.text_write(f, 135)
    ok(b.text_read(f) == 135, "text-size written by %s, read by %s" % (a.name, b.name))
    f = os.path.join(d, "output-scale")
    a.scale_write(f, [(1.8, 8.942675, "reported", "Acme Panel 10 A1B2"), (0.9, 4.464286, "fallback", "HDMI-A-1")])
    ok(b.scale_read(f) == {"Acme Panel 10 A1B2": [1.8, 8.942675, "reported"], "HDMI-A-1": [0.9, 4.464286, "fallback"]},
       "output-scale written by %s, read by %s" % (a.name, b.name))


def paths(make, tmp):
    """the files' own places: make(env) gives an implementation running with that environment"""
    base = {k: v for k, v in os.environ.items() if k not in ("XDG_CONFIG_HOME", "XDG_RUNTIME_DIR")}
    im = make(base)
    home = os.path.join(tmp, "home-" + im.name)
    im = make(dict(base, HOME=home))
    ok(im.paths() == [home + "/.config/glassine/ui-size", home + "/.config/glassine/text-size",
                      home + "/.config/glassine/output-density", None], im.name + ": the files under ~/.config; no runtime file without XDG_RUNTIME_DIR")
    ok(im.scale_read(None) == {} and im.scale_write(None, [(2.0, 8.9, "reported", "A B 1")]) == -1, im.name + ": no XDG_RUNTIME_DIR: nothing read, nothing written")
    ok(im.size_read(None, "A B 1") == 100 and im.text_read(None) == 100, im.name + ": no files yet: Default, 100")
    ok(im.size_write(None, "A B 1", 80) == 0 and im.text_write(None, 120) == 0 and get(home + "/.config/glassine/ui-size") == "80 A B 1\n"
       and get(home + "/.config/glassine/text-size") == "120\n" and im.size_read(None, "A B 1") == 80 and im.text_read(None) == 120,
       im.name + ": written to and read from the files' own places")
    conf, run = os.path.join(tmp, "xdg-" + im.name), os.path.join(tmp, "run-" + im.name)
    im = make(dict(base, HOME=home, XDG_CONFIG_HOME=conf, XDG_RUNTIME_DIR=run))
    ok(im.paths() == [conf + "/glassine/ui-size", conf + "/glassine/text-size", conf + "/glassine/output-density",
                      run + "/glassine/output-scale"], im.name + ": XDG_CONFIG_HOME and XDG_RUNTIME_DIR")
    ok(im.scale_write(None, [(2.0, 8.9, "reported", "A B 1")]) == 0 and im.scale_read(None) == {"A B 1": [2.0, 8.9, "reported"]},
       im.name + ": the runtime file in its own place")
    im = make(dict(base, HOME=home, XDG_CONFIG_HOME="relative/conf", XDG_RUNTIME_DIR="relative/run"))
    ok(im.paths()[0] == home + "/.config/glassine/ui-size" and im.paths()[3] is None, im.name + ": a relative XDG directory does not count")
    make(dict(os.environ))


# ---- the text size and the minimums -----------------------------------------------------------

def styles():
    """{voice: [(name, design px)]}: its Interleaf type styles (its own group and Code), its row
    label and its secondary text, and every font of its voice data (the shell's, the settings
    card's, the setup's); {voice: (body, row, sub)}"""
    tok = json.load(open(os.path.join(ROOT, "interleaf", "tokens.json")))
    groups = {g["name"]: [(s["name"], float(s["fontSize"][:-2])) for s in g["styles"]] for g in tok["type"]["groups"]}
    st, sizes = {}, {}
    for v in _voices.ORDER:
        voice = dict(_voices.VOICES[v])
        own = groups[voice["title"]]
        body = [px for name, px in own if name == "body" or name.endswith("-body")]
        ok(len(body) == 1 and body[0] == Z.body_px(voice), v + ": the body size of the voice data is the token's")
        sizes[v] = (Z.body_px(voice), Z.row_px(voice), Z.sub_px(voice))
        st[v] = own + groups["Code"] + [("row label", sizes[v][1]), ("secondary text", sizes[v][2])]
        for sec in ("shell", "card", "setup"):
            for k, val in sorted(voice[sec].items()):
                m = FONT.match(val) if isinstance(val, str) else None
                if m:
                    st[v].append(("%s.%s" % (sec, k), float(m.group(1))))
        ok(len(st[v]) > 8 + 18 + 8 + 14 - 1, v + ": the voice data's fonts are measured too")
    ok(sum(len(g) for g in groups.values()) == 16 and set(groups) == {"White", "Editorial", "Stationery", "Code"}, "every Interleaf type style: 16 in 4 groups")
    return st, sizes


def growth(im, st, sizes):
    n = im.name
    ok([sizes[v][0] for v in _voices.ORDER] == [17, 18.5, 20], "the body sizes: 17, 18.5, 20")
    for v in _voices.ORDER:
        body, row, sub = sizes[v]
        ok(im.voice(v) == (body, row, sub, body, row), "%s: %s: body %g, row %g, secondary %g, and the metrics of the voice" % (n, v, body, row, sub))
        for name, px in st[v] + [("twice the body", 2 * body)]:
            for t in (1.0, 1.25, 1.5):
                g = im.text_px_at(px, t, body, row, 0)
                if t == 1:
                    ok(g == px, "%s: %s %s at 100 %%: the design's size exactly" % (n, v, name))
                elif px <= body:
                    ok(near(g, px * t), "%s: %s %s (%g px) at %d %%: by the full factor" % (n, v, name, px, t * 100))
                else:               # as many pixels more as the body gets
                    ok(near(g - px, (t - 1) * body) and g / px < t, "%s: %s %s (%g px) at %d %%: less than the body's factor" % (n, v, name, px, t * 100))
                if px == 2 * body:
                    ok(near(g / px - 1, (t - 1) / 2), "%s: %s twice the body at %d %%: by half of it" % (n, v, t * 100))
    # the process's state: what the drawing reads
    r = im.state(0.1792, 1.25, 17, 16, 11.5)
    ok(r[:4] == (0.1792, 1.25, 17, 16) and near(r[4], 14.375) and near(r[5], 14.375) and near(r[6], 40 + 2 * 1.5 * 2.875) and near(r[7], 7 / 0.1792),
       n + ": the metrics: a font's size, a box that grows with two lines of it, the tap minimum")
    r = im.state(0, 1, 17, 16, 11.5)
    ok(r[4] == 11.5 and r[5] == 11.5 and r[6] == 40 and r[7] == 0, n + ": no millimetres, 100 %: the design's sizes, no tap minimum")
    r = im.state(0.224, 1.7, 17, 16, 17)
    ok(r[1] == 1.5 and near(r[4], 25.5), n + ": a text size over 150 % is 150 %")
    r = im.state(-1, 0.5, -3, -4, 17)
    ok(r[:4] == (0, 1, 0, 0) and r[4] == 17, n + ": values out of range: no minimums, 100 %")


def minimums(im, st, sizes, V, out):
    """every type style, row label and secondary text at each step and density, in
    millimetres on the glass after both factors; the ones that reach a minimum listed"""
    n = im.name
    u = V["unit"]
    densities = [float(d) for d in range(3, 26)] + [8.943]
    reached, checked = [], 0
    for v in _voices.ORDER:
        body, row, sub = sizes[v]
        for step in u["steps"]:
            for d in densities:
                f = im.factor(d, step) if im.name == "python" else Z.factor(d, step)
                mm = f / d
                for name, px in st[v]:
                    least = u["text_mm_row"] if px >= row else u["text_mm_min"]
                    for t in (1.0, 1.25, 1.5):
                        g = im.text_px_at(px, t, body, row, mm)
                        free = Z.text_px_at(px, t, body, row, 0)
                        checked += 1
                        if not (g * mm >= least - 1e-9):
                            ok(False, "%s: %s %s at %d %%, %g px/mm, text %d %%: %.3f mm, under %.1f" % (n, v, name, step, d, t * 100, g * mm, least))
                        if free * mm >= least:
                            if g != free:
                                ok(False, "%s: %s %s at %d %%, %g px/mm: over its minimum, yet changed" % (n, v, name, step, d))
                        else:
                            if not near(g * mm, least):
                                ok(False, "%s: %s %s at %d %%, %g px/mm: at its minimum exactly" % (n, v, name, step, d))
                            if t == 1:
                                reached.append((v, name, px, step, d, px * mm, least))
    ok(checked == sum(len(st[v]) for v in _voices.ORDER) * 4 * 24 * 3, "%s: the minimums: %d sizes measured" % (n, checked))
    # the panel this desktop was drawn for, at Default: nothing changes
    ok(not [r for r in reached if r[3] == 100 and r[4] == 8.943], n + ": Default at 8.943 px/mm: no style reaches a minimum")
    names = sorted({(r[0], r[1], r[2]) for r in reached})
    inter = [x for x in names if "." not in x[1]]
    ok(not inter, n + ": no Interleaf type style, row label or secondary text reaches a minimum at any step: " + repr(inter))
    ok(all(px < sizes[v][2] for v, _, px in names), n + ": only fonts under the voice's secondary text reach a minimum at any step")
    if out:
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "size-minimums-%s.txt" % n), "w") as fh:
            fh.write("# the elements that reach a minimum at a text size of 100 %% (%s):\n" % n)
            fh.write("# voice, element, design px, step %, density px/mm, design size in mm, minimum mm\n")
            for r in reached:
                fh.write("%s\t%s\t%g\t%d\t%g\t%.3f\t%.1f\n" % r)
            fh.write("# by element: %s\n" % "; ".join("%s %s (%g px)" % x for x in names))
    print("     %s: %d of %d reach a minimum at 100 %%: %s" % (n, len(reached), checked // 3, ", ".join("%s %s" % x[:2] for x in names)))
    # a control that takes a tap
    for step in u["steps"]:
        for d in (3.0, 8.943, 25.0):
            mm = Z.factor(d, step) / d
            r = im.state(mm, 1, 17, 16, 17)
            ok(near(r[7] * mm, u["tap_mm"]), "%s: the tap minimum at %d %%, %g px/mm is 7 mm" % (n, step, d))


def main(argv):
    cli = out = None
    while argv:
        a = argv.pop(0)
        if a == "--cli":
            cli = argv.pop(0)
        elif a == "--out":
            out = argv.pop(0)
        else:
            print(__doc__)
            return 2
    V = json.load(open(os.path.join(ROOT, "test", "size-vectors.json")))
    ok(V["contract"] == 1 and V["unit"] == {"mm_per_px": Z.MM_PER_PX, "steps": list(Z.STEPS), "fallback_density": Z.FALLBACK_DENSITY,
                                            "factor_snap": Z.FACTOR_SNAP, "text_mm_row": Z.TEXT_MM_ROW, "text_mm_min": Z.TEXT_MM_MIN,
                                            "tap_mm": Z.TAP_MM}, "the vectors' unit is the library's")
    impls = [Py()]
    if cli:
        impls.append(C(cli))
    st, sizes = styles()
    tmp = tempfile.mkdtemp(prefix="size-", dir=out if out and os.path.isdir(out) else None)
    try:
        for im in impls:
            before = fails
            vectors(im, V)
            files(im, V, tmp)
            growth(im, st, sizes)
            minimums(im, st, sizes, V, out)
            print(("ok   " if fails == before else "FAIL ") + im.name + ": the factor, the files, the text size, the minimums")
        if cli:
            cross(impls[0], impls[1], tmp)
            cross(impls[1], impls[0], tmp)
            c = impls[1]

            def make_c(env):
                c.restart(cli, env)
                return c
            paths(make_c, tmp)
        saved = dict(os.environ)

        def make_py(env):
            os.environ.clear()
            os.environ.update(env)
            return impls[0]
        paths(make_py, tmp)
        os.environ.clear()
        os.environ.update(saved)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("test_size: %s" % ("all passed" if not fails else "%d FAILED" % fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
