"""The size of the interface (README "Interface size"): the design pixel's length, an
output's density and factor, the kept settings and the session's runtime file, and
the text size with its minimums. The same as the C library's ui_size_* / ui_metrics_*
calls; python3 alone (no Gtk, no cairo).

    MM_PER_PX, STEPS, FALLBACK_DENSITY, FACTOR_SNAP, TEXT_MM_ROW, TEXT_MM_MIN, TAP_MM
    step_ok(percent), text_size_ok(percent)
    plausible(w_px, h_px, w_mm, h_mm)      does a reported physical size count?
    density(w_px, h_px, w_mm, h_mm, kept)  -> (px per mm, 'reported' | 'measured' | 'fallback')
    factor(density, percent=100)           device px per design px, a near-whole one whole
    mm_per_px(factor, density)             the millimetres of a design px on the glass
    output_key(make, model, serial, name)  an output's key in the files
    device_px(logical, factor)             a logical length in device px, rounded

The files (a path of None is the file's own place; a write keeps the other lines, is
written beside the file and renamed over it):
    ui_size_path(), read_ui_size(path) -> {key: percent}, ui_size(key, path),
    write_ui_size(key, percent, path)      100 removes the output's line
    text_size_path(), read_text_size(path), write_text_size(percent, path)
    output_density_path(), read_output_density(path) -> {key: density}
    output_scale_path(), read_output_scale(path) -> {key: (factor, density, source)},
    write_output_scale(entries, path)      entries: [(factor, density, source, key)]

The text size and the minimums, one state for the process, read by glassine_ui.paint:
    set_metrics(mm_per_px, text_factor, body_px, row_px), set_voice_metrics(voice, ...),
    metrics(), body_px(voice), row_px(voice), sub_px(voice),
    text_px_at(px, text_factor, body_px, row_px, mm_per_px), text_px(px),
    grow(h, px, lines, lh), min_tap()
"""
# SPDX-License-Identifier: GPL-2.0-or-later
import math
import os
import re

MM_PER_PX = 0.224                       # a design pixel at the interface size Default
STEPS = (80, 90, 100, 120)              # Smaller, Small, Default, Large
FALLBACK_DENSITY = 1 / MM_PER_PX        # an output of unknown size: 4.464 px per mm
FACTOR_SNAP = 0.03                      # a factor this near a whole number is it
TEXT_MM_ROW = 2.8                       # running text and row labels, em size
TEXT_MM_MIN = 2.0                       # any other text
TAP_MM = 7.0                            # a control that takes a tap, both ways
SOURCES = ("reported", "measured", "fallback")
_RATIOS = ((16, 9), (16, 10), (160, 90), (160, 100))


def step_ok(percent):
    return percent in STEPS


def text_size_ok(percent):
    return isinstance(percent, int) and 100 <= percent <= 150 and percent % 5 == 0


# ---- density and factor -------------------------------------------------------------

def plausible(w_px, h_px, w_mm, h_mm):
    """does a reported physical size count? Both ways within 1..100 px/mm, and not the
    aspect ratio in centimetres (16 x 9, 16 x 10, 160 x 90, 160 x 100 mm, either way up)"""
    try:
        w_mm, h_mm = float(w_mm), float(h_mm)
    except (TypeError, ValueError):
        return False
    if w_px <= 0 or h_px <= 0 or not (w_mm > 0 and h_mm > 0) or not (math.isfinite(w_mm) and math.isfinite(h_mm)):
        return False
    if not (1 <= w_px / w_mm <= 100 and 1 <= h_px / h_mm <= 100):
        return False
    return (w_mm, h_mm) not in _RATIOS and (h_mm, w_mm) not in _RATIOS


def density(w_px, h_px, w_mm, h_mm, kept=None):
    """an output's density and where it comes from: its reported size when plausible
    (w_px / w_mm), else the kept one (1..100), else the fallback"""
    if plausible(w_px, h_px, w_mm, h_mm):
        return w_px / float(w_mm), "reported"
    if kept and math.isfinite(kept) and 1 <= kept <= 100:
        return float(kept), "measured"
    return FALLBACK_DENSITY, "fallback"


def factor(dens, percent=100):
    """device px per design px: density x MM_PER_PX x percent / 100; within FACTOR_SNAP of
    a whole number (1 or more) it is that number. A percent that is no step counts as 100."""
    if not dens or not math.isfinite(dens) or dens <= 0:
        dens = FALLBACK_DENSITY
    if percent not in STEPS:
        percent = 100
    f = dens * MM_PER_PX * percent / 100.0
    r = math.floor(f + 0.5)
    if r >= 1 and abs(f - r) <= FACTOR_SNAP * r:
        return float(r)
    return f


def mm_per_px(fac, dens):
    return fac / dens if fac > 0 and dens > 0 else 0.0


def device_px(logical, fac):
    return int(math.floor(logical * fac + 0.5))


def output_key(make, model, serial, name=""):
    """"MAKE MODEL SERIAL" (a missing part is "Unknown"), or the connector name when
    all three are unknown"""
    parts = [p or "Unknown" for p in (make, model, serial)]
    if all(p == "Unknown" for p in parts):
        return name or ""
    return " ".join(parts)


# ---- the files ------------------------------------------------------------------------

def _config(name):
    x = os.environ.get("XDG_CONFIG_HOME") or ""
    if x.startswith("/"):
        return os.path.join(x, "glassine", name)
    h = os.environ.get("HOME") or ""
    return os.path.join(h, ".config", "glassine", name) if h else None


def ui_size_path():
    return _config("ui-size")


def text_size_path():
    return _config("text-size")


def output_density_path():
    return _config("output-density")


def output_scale_path():
    x = os.environ.get("XDG_RUNTIME_DIR") or ""
    return os.path.join(x, "glassine", "output-scale") if x.startswith("/") else None


def _lines(path):
    if not path:
        return None
    try:
        with open(path, encoding="utf-8", errors="surrogateescape", newline="") as f:
            text = f.read()
    except OSError:
        return None
    lines = text.split("\n")
    if lines and not lines[-1]:
        lines.pop()
    return [l[:-1] if l.endswith("\r") else l for l in lines]


def _split(line):
    """"VALUE KEY" -> (value, key) without the blanks around them; None for a comment, a
    blank line or a line without a key"""
    line = line.lstrip(" \t")
    if not line or line.startswith("#"):
        return None
    v, sp, k = line.partition(" ")
    k = k.strip(" \t")
    return (v, k) if sp and k else None


def _whole(s):
    return int(s) if s and len(s) <= 6 and s.isascii() and s.isdigit() else -1


def _decimal(s):
    if not s or s.count(".") > 1 or not s.replace(".", "").isascii() or not s.replace(".", "").isdigit():
        return -1.0
    return float(s)


def _fmt(v):
    """at most six decimals, no trailing zeros"""
    return ("%.6f" % v).rstrip("0").rstrip(".")


def _replace(path, text):
    os.makedirs(os.path.dirname(path), mode=0o700, exist_ok=True)
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8", errors="surrogateescape", newline="") as f:
            f.write(text)
        os.replace(tmp, path)
    except OSError:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def read_ui_size(path=None):
    """{output key: percent}: the lines whose number is a step; of two for one key the later"""
    r = {}
    for l in _lines(path or ui_size_path()) or []:
        p = _split(l)
        if p and _whole(p[0]) in STEPS:
            r[p[1]] = _whole(p[0])
    return r


def ui_size(key, path=None):
    """the output's step; 100 (Default) without a line"""
    return read_ui_size(path).get(key, 100)


def write_ui_size(key, percent, path=None):
    """the output's line set to percent (100: removed); every other line kept"""
    path = path or ui_size_path()
    if not path or not key or percent not in STEPS:
        raise ValueError("ui-size: %r %r" % (percent, key))
    out, placed = [], percent == 100
    for l in _lines(path) or []:
        p = _split(l)
        if p and p[1] == key:
            if not placed:
                out.append("%d %s" % (percent, key))
            placed = True
            continue
        out.append(l)
    if not placed:
        out.append("%d %s" % (percent, key))
    _replace(path, "".join(l + "\n" for l in out))


def read_text_size(path=None):
    """the text size in percent; 100 without a file or with any other content"""
    path = path or text_size_path()
    try:
        with open(path, encoding="utf-8", errors="surrogateescape") as f:
            p = _whole(f.read().strip(" \t\r\n\f\v"))
    except (OSError, TypeError):
        return 100
    return p if text_size_ok(p) else 100


def write_text_size(percent, path=None):
    path = path or text_size_path()
    if not path or not text_size_ok(percent):
        raise ValueError("text-size: %r" % (percent,))
    _replace(path, "%d\n" % percent)


def read_output_density(path=None):
    """{output key: density} of GlassineOS/shell spec 011's file (read only here)"""
    r = {}
    for l in _lines(path or output_density_path()) or []:
        p = _split(l)
        if p and 1 <= _decimal(p[0]) <= 100:
            r[p[1]] = _decimal(p[0])
    return r


def read_output_scale(path=None):
    """{output key: (factor, density, source)}: what the session applied to each output"""
    r = {}
    for l in _lines(path or output_scale_path()) or []:
        l = l.lstrip(" \t")
        if not l or l.startswith("#"):
            continue
        p = l.split(" ", 3)
        if len(p) != 4:
            continue
        f, d, k = _decimal(p[0]), _decimal(p[1]), p[3].strip(" \t")
        if f > 0 and d > 0 and p[2] in SOURCES and k and len(k.encode("utf-8", "surrogateescape")) < 256:
            r[k] = (f, d, p[2])
    return r


def write_output_scale(entries, path=None):
    """the whole file: entries = [(factor, density, source, key)], one line per output"""
    path = path or output_scale_path()
    if not path:
        raise ValueError("output-scale: no XDG_RUNTIME_DIR")
    out = []
    for f, d, src, k in entries:
        if not (f > 0 and d > 0) or src not in SOURCES or not k or "\n" in k:
            raise ValueError("output-scale: %r" % ((f, d, src, k),))
        out.append("%s %s %s %s\n" % (_fmt(f), _fmt(d), src, k))
    _replace(path, "".join(out))


# ---- the text size and the minimums ------------------------------------------------------

_M = [0.0, 1.0, 0.0, 0.0]               # mm per design px, text factor, body px, row px
_FONT_PX = re.compile(r"(?:^|\s)([\d.]+)px")


def set_metrics(mm=0.0, text_factor=1.0, body=0.0, row=0.0):
    """mm: the millimetres of a design px on the glass (mm_per_px(); 0: unknown, no
    minimums); text_factor: 1.0 to 1.5; body, row: the voice's body size and row label
    size. A program that draws for outputs of different factors sets it before it draws
    for each."""
    _M[0] = float(mm) if mm and mm > 0 and math.isfinite(mm) else 0.0
    _M[1] = min(1.5, float(text_factor)) if text_factor and text_factor >= 1 and math.isfinite(text_factor) else 1.0
    _M[2] = float(body) if body and body > 0 else 0.0
    _M[3] = float(row) if row and row > 0 else 0.0


def metrics():
    return tuple(_M)


def _font_px(shorthand):
    return float(_FONT_PX.search(shorthand).group(1))


def body_px(voice):
    """the voice's Interleaf body size (voice: a glassine_ui.voices.voice() dict)"""
    return float(voice["type"]["body"][:-2])


def row_px(voice):
    """the voice's row label size: the smaller of the settings card's and the setup's"""
    return min(_font_px(voice[s]["row"]) for s in ("card", "setup"))


def sub_px(voice):
    """the voice's secondary text size: the smaller of the settings card's and the setup's"""
    return min(_font_px(voice[s]["sub"]) for s in ("card", "setup"))


def set_voice_metrics(voice, mm=0.0, text_factor=1.0):
    set_metrics(mm, text_factor, body_px(voice), row_px(voice))


def text_px_at(px, text_factor, body, row, mm):
    """the size a type style of px design pixels is drawn at:
    px x (1 + (text_factor - 1) x min(1, body / px)), and at least its minimum:
    TEXT_MM_ROW for px >= row, TEXT_MM_MIN for smaller ones (and for every style while
    row is 0), in design pixels at mm per design px (0: no minimum)"""
    if not px > 0:
        return px
    g = px
    if text_factor != 1:
        share = body / px if 0 < body < px else 1
        g = px * (1 + (text_factor - 1) * share)
    if mm > 0:
        g = max(g, (TEXT_MM_ROW if row > 0 and px >= row else TEXT_MM_MIN) / mm)
    return g


def text_px(px):
    """text_px_at with the process's metrics: px itself when nothing applies. For layouts:
    glassine_ui.paint draws every font at this size itself."""
    return text_px_at(px, _M[1], _M[2], _M[3], _M[0])


def grow(h, px, lines=1, lh=1.0):
    """the height of a box that holds lines of text of px once the text has grown:
    h + lines x lh x (text_px(px) - px); lh: the line height as a factor of the font size.
    Spacing and icons keep their size."""
    return h + (lines if lines > 0 else 1) * (lh if lh and lh > 0 else 1) * (text_px(px) - px)


def min_tap():
    """the least width and height of a control that takes a tap, in design pixels
    (TAP_MM); 0 while the millimetres of a design pixel are unknown"""
    return TAP_MM / _M[0] if _M[0] > 0 else 0.0
