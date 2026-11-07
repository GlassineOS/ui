#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-or-later
"""Smoke test of the Interleaf reference (tools/gen-reference, spec 002 FR-030); stdlib only, no browser.

- the build runs and writes the guidelines, the token and the component pages
- every token, type style and family appears, every component has a section and a preview
- each preview loads the web form and still has its own content; the picker offers all 27 combinations
- every relative link and source resolves to a file, and every #fragment to an id in it;
  no link is root-relative (the site is published under a sub-path)
- two builds are byte for byte the same
"""
import html.parser
import importlib.machinery
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from urllib.parse import urlsplit, unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEN = os.path.join(ROOT, "tools", "gen-reference")
TMP = os.path.join(ROOT, "out", "test", "reference")
fails = 0


def ok(cond, what):
    global fails
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        fails += 1


class Page(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.refs, self.options = set(), [], {}
        self._select = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for k in ("href", "src"):
            if a.get(k) is not None:
                self.refs.append((tag, k, a[k]))
        if tag == "select":
            self._select = a.get("name")
            self.options[self._select] = []
        if tag == "option" and self._select:
            self.options[self._select].append(a.get("value"))

    def handle_endtag(self, tag):
        if tag == "select":
            self._select = None


def parse(path):
    p = Page()
    p.feed(open(path, encoding="utf-8").read())
    return p


def load_generator():
    loader = importlib.machinery.SourceFileLoader("gen_reference", GEN)
    mod = importlib.util.module_from_spec(importlib.util.spec_from_loader("gen_reference", loader))
    loader.exec_module(mod)
    return mod


def build(dest):
    return subprocess.run([sys.executable, GEN, "--out", dest], capture_output=True, text=True)


if os.path.isdir(TMP):
    shutil.rmtree(TMP)
os.makedirs(TMP)
try:
    a, b = os.path.join(TMP, "a"), os.path.join(TMP, "b")
    r = build(a)
    ok(r.returncode == 0, "the build runs" + ("" if r.returncode == 0 else ": " + r.stderr.strip()))
    if r.returncode:
        raise SystemExit(1)
    for f in ("index.html", "tokens.html", "components.html", "reference.css", "web/tokens.css", "web/bundle.css",
              "web/combinations.json"):
        ok(os.path.isfile(os.path.join(a, f)), "written: " + f)
    def same(x, y):
        """the same files and directories under both, byte for byte (filecmp.dircmp trusts size and mtime)"""
        def tree(d):
            files, dirs = {}, set()
            for dirpath, dnames, fnames in os.walk(d):
                rel = os.path.relpath(dirpath, d)
                dirs.update(os.path.normpath(os.path.join(rel, n)) for n in dnames)
                for n in fnames:
                    with open(os.path.join(dirpath, n), "rb") as fh:
                        files[os.path.normpath(os.path.join(rel, n))] = fh.read()
            return files, dirs
        return tree(x) == tree(y)
    ok(same(os.path.join(ROOT, "web"), os.path.join(a, "web")), "web/ copied as it is")
    probe = os.path.join(TMP, "probe")
    shutil.copytree(os.path.join(a, "web"), probe, copy_function=shutil.copy2)
    pf = os.path.join(probe, "combinations.json")
    data = open(pf, "rb").read()
    st = os.stat(pf)
    with open(pf, "wb") as fh:
        fh.write(data[:-1] + (b" " if data[-1:] != b" " else b"\n"))
    os.utime(pf, ns=(st.st_atime_ns, st.st_mtime_ns))
    ok(not same(os.path.join(a, "web"), probe), "the comparison sees a change of one byte that keeps size and mtime")

    pages = {}
    for dirpath, _, files in os.walk(a):
        for f in files:
            if f.endswith(".html"):
                rel = os.path.relpath(os.path.join(dirpath, f), a).replace(os.sep, "/")
                pages[rel] = parse(os.path.join(dirpath, f))

    # the guidelines: every h2 of interleaf/README.md
    guide = open(os.path.join(ROOT, "interleaf", "README.md"), encoding="utf-8").read()
    heads = re.findall(r"^## +(.+)$", guide, re.M)
    index = open(os.path.join(a, "index.html"), encoding="utf-8").read()
    ok(heads and all(">%s</h2>" % h.replace("&", "&amp;") in index for h in heads),
       "guidelines: all %d sections of interleaf/README.md" % len(heads))

    # every token
    tokens = json.load(open(os.path.join(ROOT, "interleaf", "tokens.json"), encoding="utf-8"))
    tp = pages["tokens.html"]
    names = [t["name"] for fam in ("color", "shadow", "spacing", "radius", "layout", "stroke") for t in tokens[fam]["tokens"]]
    missing = [n for n in names if "token-" + n not in tp.ids]
    ok(not missing, "tokens: all %d colour, shadow, space, radius, layout and stroke tokens%s"
       % (len(names), "" if not missing else " (missing %s)" % ", ".join(missing)))
    styles = [s["name"] for g in tokens["type"]["groups"] for s in g["styles"]]
    ok(all("type-" + s in tp.ids for s in styles), "tokens: all %d type styles" % len(styles))
    ok(all("family-" + f in tp.ids for f in tokens["type"]["families"]), "tokens: every font family")
    themes = [t["id"] for t in tokens["color"]["themes"]]
    ttext = open(os.path.join(a, "tokens.html"), encoding="utf-8").read()
    ok(all('data-tt="%s"' % t in ttext for t in themes), "tokens: a column per theme")

    # every component
    cdir = os.path.join(ROOT, "interleaf", "components")
    comps = sorted(n for n in os.listdir(cdir) if os.path.isdir(os.path.join(cdir, n)))
    cp = pages["components.html"]
    ok(comps and all(c in cp.ids for c in comps), "components: a section for each of the %d" % len(comps))
    frames = [v for t, k, v in cp.refs if t == "iframe"]
    ok(sorted(frames) == sorted("previews/%s.html" % c for c in comps), "components: a live preview for each")
    badp = []
    for c in comps:
        src = open(os.path.join(cdir, c, "preview.html"), encoding="utf-8").read()
        out = open(os.path.join(a, "previews", c + ".html"), encoding="utf-8").read()
        body = src[src.index("<body"):]
        good = ('href="../web/tokens.css"' in out and out.index("tokens.css") < out.index("bundle.css")
                and "@dsCard" not in out and body in out)
        if not good:
            badp.append(c)
    ok(not badp, "previews: the web form loaded, the @dsCard line gone, their own body kept"
       + ("" if not badp else " (not in %s)" % ", ".join(badp)))
    def card_height(c):  # the card as the generator reads it: leading whitespace and blank lines allowed
        src = open(os.path.join(cdir, c, "preview.html"), encoding="utf-8").read()
        card = re.match(r"\s*<!--\s*@dsCard\b(.*?)-->", src, re.S)
        return card and re.search(r"height=(\d+)", card.group(1))
    heights = {c: card_height(c) for c in comps}
    ctext = open(os.path.join(a, "components.html"), encoding="utf-8").read()
    ok(all(m is None or 'data-height="%s"' % m.group(1) in ctext for m in heights.values()), "previews: sized by @dsCard")

    # the picker: the combinations of web/combinations.json
    combos = json.load(open(os.path.join(ROOT, "web", "combinations.json"), encoding="utf-8"))["combinations"]
    for page in ("index.html", "tokens.html", "components.html"):
        o = pages[page].options
        ok(sorted(o.get("voice", [])) == sorted({c["voice"] for c in combos})
           and sorted(o.get("scheme", [])) == sorted({c["scheme"] for c in combos})
           and sorted(o.get("pen", [])) == sorted({str(c["pen"]) for c in combos}),
           "%s: the picker offers every voice, scheme and pen" % page)
    m = re.search(r"window\.INTERLEAF_COMBINATIONS = (\[.*?\]);", index)
    ok(m and len(json.loads(m.group(1))) == len(combos) == 27, "the page carries all 27 combinations")

    # links
    bad = []
    for rel, p in sorted(pages.items()):
        base = os.path.dirname(rel)
        for tag, k, v in p.refs:
            u = urlsplit(v)
            if u.scheme or u.netloc:
                if u.scheme not in ("https", "mailto", "data"):
                    bad.append("%s: %s=%s (not https)" % (rel, k, v))
                continue
            if v.startswith("/"):
                bad.append("%s: %s=%s is root-relative" % (rel, k, v))
                continue
            target = os.path.normpath(os.path.join(base, unquote(u.path))).replace(os.sep, "/") if u.path else rel
            if not os.path.isfile(os.path.join(a, target)):
                bad.append("%s: %s=%s: no file" % (rel, k, v))
                continue
            if u.fragment and target.endswith(".html") and u.fragment not in pages[target].ids:
                bad.append("%s: %s=%s: no id %s" % (rel, k, v, u.fragment))
    ok(not bad, "links: every href and src resolves" + ("" if not bad else ":\n     " + "\n     ".join(bad[:20])))

    r = build(b)
    ok(r.returncode == 0 and same(a, b), "two builds are the same")

    # --out replaces only a directory this tool wrote
    keep = os.path.join(TMP, "keep")
    os.makedirs(os.path.join(keep, "sub"))
    for f in ("keepme", os.path.join("sub", "deep")):
        open(os.path.join(keep, f), "w").close()
    r = build(keep)
    ok(r.returncode != 0 and "not empty" in r.stderr and os.path.isfile(os.path.join(keep, "keepme"))
       and os.path.isfile(os.path.join(keep, "sub", "deep")) and not os.path.exists(os.path.join(keep, "index.html")),
       "--out: a non-empty directory of someone else's is refused, untouched")
    fresh = os.path.join(TMP, "fresh")
    os.makedirs(fresh)
    r = build(fresh)
    ok(r.returncode == 0 and os.path.isfile(os.path.join(fresh, "index.html")), "--out: an empty directory is used")
    open(os.path.join(a, "stale.html"), "w").close()
    r = build(a)
    ok(r.returncode == 0 and not os.path.exists(os.path.join(a, "stale.html")) and same(a, b),
       "--out: an earlier build is replaced, stale files gone")

    # the generator's own functions
    G = load_generator()
    link = G.inline('[x](http://a/b"onmouseover="alert(1)) and [y](http://a/?p=1&q=<2>)')
    ok('href="http://a/b&quot;onmouseover=&quot;alert(1"' in link and 'onmouseover="' not in link
       and 'href="http://a/?p=1&amp;q=&lt;2&gt;"' in link,
       "links: a quote in the target cannot end the href, & and < are escaped once")

    def injected(src):
        try:
            return G.preview_page({"name": "T", "preview": src})
        except ValueError as e:
            return e
    ok(isinstance(injected("<html><body><header class=x>h</header></body></html>"), ValueError),
       "previews: <header> is not taken for <head>")
    ok(all(isinstance(injected(s), str) and "../web/tokens.css" in injected(s) for s in
           ("<html><head><title>t</title></head><body></body></html>", "<HTML><HEAD lang=en>\n<title>t</title></HEAD>",
            "<html><head\n data-x=1><title>t</title></head>")),
       "previews: a <head> with attributes or in capitals still gets the web form")
finally:
    shutil.rmtree(TMP, ignore_errors=True)

print("reference: %s" % ("all passed" if not fails else "%d FAILED" % fails))
sys.exit(1 if fails else 0)
