# GlassineOS/ui

The look of the GlassineOS desktop in one place: the three voices (White, Editorial, Stationery) as
data, and the drawing code built on them, for every program that draws itself (the shell's bar and
panels, Settings, the first-run setup, Home).

- **Voice data:** `voices/voices.json`, the single source, from the Interleaf design system on the
  E-ink scheme. The C table and the Python module are generated from it (`tools/gen-voices`);
  `make check` fails when they are out of date.
- **C library:** `libglassine-ui` (pkg-config `glassine-ui`): cairo + pango + librsvg drawing in the
  voices (boxes, rules, text, icons), for native programs such as the shell and Home.
- **Python package:** `glassine_ui` (`voices`, `paint`): the same for the GTK/cairo programs, such as
  Settings and the first-run setup.

GlassineOS is a hobby project, written largely with AI coding agents and not reviewed by experts.
Verified so far: the host tests below. Nothing has been checked on hardware from this repository yet.

## Build and test

```
make                     # out/libglassine-ui.so, out/glassine-ui.pc
make install             # PREFIX=/usr/local DESTDIR= PYTHONDIR=<site-packages under PREFIX>
make check               # generated forms current, the library, the tests
```

Needs cairo, pango, librsvg, glib (dev), python3, PyGObject (Gtk 3, Pango), pycairo. CI runs
`make check` in `alpine:3.24` (`.github/workflows/build.yml` lists the packages).

`make check` runs:

- `tools/gen-voices --check`: the generated C table and Python module match the data.
- `test/test_voices.py`: sections, the fallback to White, a changed value reaching both forms, the
  design importer.
- `test/c-api.sh`: a separate program built with `pkg-config glassine-ui` against an installed copy.
- `test/sheet.sh`: the sample sheet (every box, rule, text style and an icon in the three voices) drawn
  by the C library and by the Python module, compared cell by cell (one grey step = 255/15). The known
  differences are listed in `test/compare.py` with their cause; see "Where C and Python differ".

## Voices

Contract: voice data, version 1 (`"contract": 1` in the file).

`voices/voices.json` has `voices.white`, `voices.editorial`, `voices.stationery`, in that order. A voice
is chosen by name; unknown names give White (in C and in Python). Each voice has:

| Section | What |
|---|---|
| `title` | the name shown to people: White, Editorial, Stationery |
| `scheme` | the design's E-ink scheme tokens: the 16-grey ladder by role (`paper`, `sheet`, `ink`, `ink-soft`, `rule`, `shade`, `highlight`, `dim`, `accent`, `on-accent`, ...), the Stationery extras (`leather-dark`, `gilt`, `gold`, `wax`), the focus colours and the named shadows (`offset`, `keycap`, `card-stack`, `passe-partout`) |
| `shell` | the desktop shell's surfaces: bar, plates, cards, buttons, toggles, slider, trays, segments, power button, pads, folders, app tiles, tabs, rules, fonts, and the voice's own words (`qsTitle`, `oTitle`, ...) |
| `c` | the few values the C table takes instead of the CSS value: `"field.part": value`, with `_why` |
| `card` | the settings card (rows, heads, tabs, segments, keyboard) |
| `setup` | the first-run setup (header, steps, fields, keycaps, packs) |

Values are the design's CSS with every `var(--il-*)` resolved: colours `#rrggbb` (greys of the E-ink
scheme), `box-shadow` lists (hard edges only: a blur fails the generator), borders (`1.5px solid
#111111`, `dotted`, `dashed`, `double`), font shorthands (`italic 500 22px/1.1 'EB Garamond',serif`)
with `*Var` (small-caps), `*Ls` (letter spacing, em) and `*Case`, radii in px or `50%`.

The same key can mean different things in `shell`, `card` and `setup`: each is its own surface in the
design (`headH`, `cardR`, `sep`, ...), so they are kept apart, not merged.

Changing a voice: edit `voices/voices.json` (or refresh it from the design with `tools/import-design`,
which reads the dumps of `tools/design/*.js`), run `make generate`, commit the data and the generated
files together.

## C API

Contract: C API, version 1 (`GLASSINE_UI_API` in `glassine-ui.h`). `#include <glassine-ui.h>`,
`pkg-config --cflags --libs glassine-ui`, soname `libglassine-ui.so.1`.

- Types: `ui_col` (0xAARRGGBB, 0 = transparent; `UI_RGB(0xrrggbb)`), `UiRing` (x, y, spread, colour,
  inset), `UiBox` (background, border width/colour/dashed, four radii with `UI_HALF` = 50%, up to
  `UI_NRING` rings in CSS order), `UiFont` (family, weight, italic, px, small caps, letter spacing in
  em, case `UI_CASE_*`), `UiVoice` (one voice: the fields of the `shell` section, see the header),
  `UiGc` (cairo context, paint or layout pass, voice).
- Voices: `ui_voices[]`, `ui_nvoices`, `ui_voice_find(name)` (unknown names and NULL give White);
  `UI_RULE`, `UI_DIM`.
- Drawing (logical px; the caller's cairo matrix carries the device scale): `ui_draw_init()` once
  (the first text or icon call does it if the caller didn't), then `ui_box`, `ui_box_bg`, `ui_fill_rect`, `ui_rrect`, `ui_stroke_rrect` (solid or dashed),
  `ui_hline` (solid, dashed, dotted), `ui_text` (placed, aligned, elided), `ui_text_w` (measured),
  `ui_text_wrap` (wrapped, at most n lines), `ui_icon` (an icon of glassine-mono, Adwaita, hicolor, the
  Flatpak exports or pixmaps at a pixel size; line art and `-symbolic` icons recoloured; rasterized once
  and cached), `ui_font_with`, `ui_font_px`.
- Nothing animates or redraws by itself: a call draws once. In the layout pass (`paint = 0`) the
  calls only measure, and `ui_icon` answers as in the paint pass. The calls leave the context's line
  width and dash as they were.

## Python API

Contract: Python API, version 1 (`glassine_ui.API`).

- `glassine_ui.voices`: `NAMES`, `voice(name)` (a dict: `name`, `title`, `scheme`, `shell`, `c`,
  `card`, `setup`; unknown names give White), `title(name)`, `CONTRACT`. The section dicts are shared:
  copy one before changing it.
- `glassine_ui.paint` (needs PyGObject with Gtk 3 and Pango, and pycairo): the CSS readers `color`,
  `px`, `radii`, `shadows`, `border`, `font`; `box(cr, x, y, w, h, radius, bg, shadow, border)`,
  `rule(cr, x, y, w, border)` (its lower edge at y), `fill`, `rrect`; `layout`, `size`, `baseline`,
  `text`, `measure`, `ls_em`; `icon(cr, name, size, cx, cy, colour)` (the design's Material names,
  mapped to icon-theme names in `ICONS`, or a theme name). A transparent colour (`None`,
  `'transparent'`) draws nothing, as 0 does in C: `text` still measures, `icon` still says whether
  there is such an icon. `box` draws nothing for a width or height <= 0, as in C; `box`, `rule` and
  `icon` leave the context's line width, cap, join and dash as they were; `font` raises `ValueError`
  for anything that isn't a CSS font shorthand, as `tools/gen-voices` does.

### Where C and Python differ

The two drawing codes came from two programs and are kept as they were, so that no program's pixels
change in the move. `test/compare.py` lists what differs by more than one grey step, and why:

- Text: C draws on its own Pango context (grey antialias, slight hinting, metrics off,
  `PANGO_VARIANT_SMALL_CAPS`); Python uses the surface's options, the font features `lnum`/`smcp`
  and the CSS line height (half-leading).
- Outer rings: C clips them out from under the box, Python paints them below it. They show through a
  transparent box (Editorial's toggle and power button); elsewhere they leave an antialiased seam at
  round corners.
- Rules: dotted is 1:1 square dots in C, round dots in Python; dashed is 3:2 in C, 3:3 in Python.

Making them agree changes the pixels of the programs that use them, so it is a separate change.

## Licence

GPL-2.0-or-later (`LICENSE`).
