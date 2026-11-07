# GlassineOS/ui

The look of GlassineOS in one place: the Interleaf design system, the three voices (White, Editorial,
Stationery) as data, and the drawing code built on them, for every program that draws itself (the
shell's bar and panels, Settings, the first-run setup, Home).

- **Interleaf:** `interleaf/`, the design system's only source: the tokens, the guidelines and the
  components. Its web form (`web/`: the CSS variables of every theme and the component styles) and
  the voices' scheme tokens are generated from it (`tools/gen-interleaf`); `make check` fails when
  they are out of date.
- **Voice data:** `voices/voices.json`: the voices' scheme (generated from Interleaf's E-ink themes)
  and the drawn programs' own values (kept here by hand). The C table and the Python module are
  generated from it (`tools/gen-voices`); `make check` fails when they are out of date. The GTK themes and the on-screen keyboard's look,
  for the programs that do not draw with this repository, are generated from it too
  (`tools/gen-apps`, into GlassineOS/shell's `rootfs/`; the shell's `make check` fails when its
  copy is out of date).
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
make check-forms         # the tokens, the voice data and their generated forms only (python3, seconds)
make check-lib           # the library build and its tests (the sample sheet takes most of the time)
make generate            # write the generated forms (tools/gen-interleaf, then tools/gen-voices)
make export-claude       # Interleaf staged for claude.ai in out/claude/interleaf
```

Needs cairo, pango, librsvg, glib (dev), python3, PyGObject (Gtk 3, Pango), pycairo. CI runs
`make check` in `alpine:3.24` (`.github/workflows/build.yml` lists the packages).

CI runs `make check` on main. On a pull request, `tools/ci-scope` reads the changed paths: when
none of them can reach the library (`src/`, `python/`, `voices/`, the build files, the library
tests), it runs `make check-forms` alone. A token change that reaches the library rewrites
`voices/voices.json`, so it always gets the full run.

`make check` runs:

- `tools/gen-interleaf --check`: the voices' scheme in `voices/voices.json` and the web form match
  the tokens.
- `tools/gen-voices --check`: the generated C table, `glassine-ui-scheme.h` and the Python module
  match the data, and the C icon map matches `glassine_ui.paint.ICONS`.
- `test/test_voices.py`: sections, the fallback to White, a changed value (and a changed scheme token)
  reaching every form, `tools/gen-apps` (into a temporary tree).
- `test/test_interleaf.py`: aliases and theme fallbacks, the voices' scheme from the E-ink themes, a
  changed token reaching the voices' scheme and the web form, the stale-form check, the 27
  combinations and the variables the component styles read, the `tools/export-claude` layout.
- `test/ci-scope.sh`: which changed paths `tools/ci-scope` sends to the library checks.
- `test/test_paint.py`: the Python drawing API call by call.
- `test/c-api.sh`: a separate program built with `pkg-config glassine-ui` against an installed copy.
- `test/pc-prefix.sh`: the installed `.pc` names the prefix it was installed with.
- `test/sheet.sh`: the sample sheet (every box, rule, text style and an icon in the three voices) drawn
  by the C library and by the Python module, compared cell by cell in every colour channel (one grey
  step = 255/15). The known differences are listed in `test/compare.py` with their cause (see "Where C
  and Python differ"), each bounded: a shape by how many pixels may differ, text by a mask (the
  differences within its ink, the same darkest grey, ink within 3x). So FR-012's one grey step holds
  for the cells not listed; the listed ones are held to these bounds, and
  `test/compare-selftest.py` checks that a regression in one fails.

## Interleaf

Contract: Interleaf tokens, version 1 (`"version": 1` in `interleaf/tokens.json`).

Interleaf is the design system of GlassineOS: three voices (White, Editorial, Stationery), each in
three schemes (Paper, Night, E-ink), with three pens. `interleaf/` holds it:

| Path | What |
|---|---|
| `interleaf/tokens.json` | the tokens: `color` (the themes and a value per theme), `type` (families, type styles per voice), `spacing`, `radius`, `shadow` (a value per theme), `layout`, `stroke`; each with its `usage` |
| `interleaf/README.md` | the guidelines: the three layers, themes, colour rules, accessibility targets, type, edges |
| `interleaf/components/bundle.css` | the component styles (`.il-*`); they read the tokens' variables and the voice from the theme id's prefix |
| `interleaf/components/NAME/` | a component's guidelines (`README.md`; `Cover` has none yet) and live preview (`preview.html`, its first line the card marker claude.ai reads) |

A theme is a voice and a scheme: `white-paper`, `white-night`, `editorial-paper`, `editorial-night`,
`stationery-paper`, `stationery-night`, `eink` (White and Editorial) and `stationery-eink`. A token's
value is one value for every theme, or one per theme. Where a theme has no value of its own,
`stationery-eink` takes `eink`'s, and every theme then takes the first theme's (`white-paper`'s): a
Night theme without its own `passe-partout` has Paper's. A value `{name}` is an alias of another
token in the same theme.

The voices' scheme (`voices/voices.json`, section `scheme`) is generated from the E-ink themes:
White and Editorial from `eink`, Stationery from `stationery-eink`, with every alias resolved and
shadow lists joined by `,` alone. Its keys are fixed (`SCHEME_COLOURS`, `SCHEME_SHADOWS` in
`tools/gen-interleaf`); a key without a value in the voice's E-ink theme (or `eink`, its fallback)
is an error, never the Paper value.

Changing a token: edit `interleaf/tokens.json`, run `make generate`, commit the tokens and the
generated files together.

`make export-claude` stages the system in the file layout of a claude.ai design-system project
(`README.md`, `tokens.json`, `components/`, `design-system.json`) in `out/claude/interleaf`, for
publishing it there. claude.ai has no theme fallback other than the first theme, so the staged
`tokens.json` has the `stationery-eink` values it takes from `eink` written out. It writes files only;
nothing is read from claude.ai.

## Web form

Contract: web form, version 1.

`web/` holds the generated web form, for pages that look like GlassineOS (the documentation site,
the hub, the design boards):

| File | What |
|---|---|
| `web/tokens.css` | the tokens as CSS custom properties: colours and shadows per theme, the pen selection, then spacing, radius, layout, stroke, the greys and the font families (`--font-plex`, ...) on `:root`, and a class per type style (`.il-type-display`, `.il-type-ed-body`, ...) |
| `web/bundle.css` | the component styles, as `interleaf/components/bundle.css` |
| `web/combinations.json` | the 27 combinations: `voice`, `scheme`, `pen` and the `attributes` that select each |

Load `tokens.css`, then `bundle.css`. Two attributes choose the look:

- `data-theme`: the voice and scheme. Paper and Night are the tokens' theme ids
  (`white-paper`, ..., `stationery-night`). E-ink is `white-eink`, `editorial-eink` and
  `stationery-eink`: White and Editorial share the tokens' `eink` theme (`eink` itself is White), and
  the component styles take the voice from the id's prefix.
- `data-pen`: `1` (or no attribute: the house pen), `2` or `3`: `accent` and `highlight` become
  `accent-N` and `highlight-N`, and the tokens that alias them (`pen`, `wax`, `focus`, ...) follow.
  It goes on the element that has `data-theme` (or on `<html>`, for the page's default theme), not on
  an ancestor of it: a pen is not inherited, so a `data-theme` element without its own `data-pen` has
  pen 1, and a nested `data-theme` element with `data-pen="1|2|3"` has that pen whatever its
  ancestors have. A `data-pen` on an element with no `data-theme` does nothing. On e-ink the three
  pens are the same greys.

Without either attribute a page gets `white-paper` and pen 1. The fonts are loaded as the component
styles do it (an `@import` of Google Fonts at the top of `bundle.css`).

## Voices

Contract: voice data, version 1 (`"contract": 1` in the file).

`voices/voices.json` has `voices.white`, `voices.editorial`, `voices.stationery`, in that order. A voice
is chosen by name; unknown names give White (in C and in Python). Each voice has:

| Section | What |
|---|---|
| `title` | the name shown to people: White, Editorial, Stationery |
| `scheme` | generated from Interleaf's E-ink themes (see "Interleaf"): the 16-grey ladder by role (`paper`, `sheet`, `ink`, `ink-soft`, `rule`, `shade`, `highlight`, `dim`, `accent`, `on-accent`, ...), the Stationery extras (`leather-dark`, `gilt`, `gold`, `wax`), the focus colours and the named shadows (`offset`, `keycap`, `card-stack`, `passe-partout`) |
| `shell` | the desktop shell's surfaces: bar, plates, cards, buttons, toggles, slider, trays, segments, power button, pads, folders, app tiles, tabs, rules, fonts, and the voice's own words (`qsTitle`, `oTitle`, ...) |
| `c` | the few values the C table takes instead of the CSS value: `"field.part": value`, with `_why` |
| `card` | the settings card (rows, heads, tabs, segments, keyboard) |
| `setup` | the first-run setup (header, steps, fields, keycaps, packs) |
| `inline` | the values the designs write in their components' code: the keyboard's focus ring (`focusW`, `focusOff`, `focusR`: the outer radius), setup's voice miniatures (`mini*`), setup's chosen network row (`netOnBg`) |
| `apps` | the look of the programs that do not draw with this repository, for `tools/gen-apps`: the GTK text face (`gtkFont`), the GTK 3 theme (`gtk3` colours, `gtk3Note`, `gtk3Rules`), the GTK 4 / libadwaita colours (`gtk4`, into `voices/gtk4.css.in`), the on-screen keyboard (`wvkbd`: its options) |

Values are the design's CSS with every `var(--il-*)` resolved: colours `#rrggbb` (greys of the E-ink
scheme), `box-shadow` lists (hard edges only: a blur fails the generator), borders (`1.5px solid
#111111`, `dotted`, `dashed`, `double`), font shorthands (`italic 500 22px/1.1 'EB Garamond',serif`)
with `*Var` (small-caps), `*Ls` (letter spacing, em) and `*Case`, radii in px or `50%`.

The same key can mean different things in `shell`, `card` and `setup`: each is its own surface in the
design (`headH`, `cardR`, `sep`, ...), so they are kept apart, not merged. `shell` also has the C
table's own keys (`gripGap`, `gripLip` for glassine-swayd's drag handles).

The `apps` values are the GTK and keyboard themes as they were, not the scheme's greys: several are
not on the 16-grey ladder (`#1b1b1b`, `#141414`, `#a0a0a0`, `#d0d0d0`, `#c4c4c4`, `#4a4a4a`, `#b5b5b5`,
`#bdbdbd`), and Stationery's GTK ink is `#1b1b1b` where the voice's is `#111111`. Bringing them onto
the scheme changes pixels, so it is a separate change.

Changing a voice: a scheme token is changed in `interleaf/tokens.json`; every other section is
edited in `voices/voices.json`. Then run `make generate` and commit the data and the generated files
together.

## C API

Contract: C API, version 1 (`GLASSINE_UI_API` in `glassine-ui.h`). `#include <glassine-ui.h>`,
`pkg-config --cflags --libs glassine-ui`, soname `libglassine-ui.so.1`.

- Types: `ui_col` (0xAARRGGBB, 0 = transparent; `UI_RGB(0xrrggbb)`), `UiRing` (x, y, spread, colour,
  inset), `UiBox` (background, border width/colour/dashed, four radii with `UI_HALF` = 50%, up to
  `UI_NRING` rings in CSS order), `UiFont` (family, weight, italic, px, small caps, letter spacing in
  em, case `UI_CASE_*`), `UiVoice` (one voice: the fields of the `shell` section, the focus ring of
  `inline`, the drag handles; see the header),
  `UiGc` (cairo context, paint or layout pass, voice).
- Voices: `ui_voices[]`, `ui_nvoices`, `ui_voice_find(name)` (unknown names and NULL give White);
  `UI_RULE`, `UI_DIM`, `UI_PAPER`, `UI_HIGHLIGHT`.
- Drawing (logical px; the caller's cairo matrix carries the device scale): `ui_draw_init()` once
  (the first text or icon call does it if the caller didn't), then `ui_box`, `ui_box_bg`, `ui_fill_rect`, `ui_rrect`, `ui_stroke_rrect` (solid or dashed),
  `ui_hline` (solid, dashed, dotted), `ui_text` (placed, aligned, elided), `ui_text_w` (measured),
  `ui_text_wrap` (wrapped, at most n lines), `ui_icon` (an icon of glassine-mono, Adwaita, hicolor, the
  Flatpak exports or pixmaps at a pixel size; line art and `-symbolic` icons recoloured; rasterized once
  and cached), `ui_icon_material` (an icon named as the design names it, in Material Symbols, through
  the same map as the Python `ICONS`/`ISCALE`, generated into `src/glassine-ui-icons.c`), `ui_hatch`
  (parallel lines inside a rounded rect: the design's hatched outlines), `ui_font_with`, `ui_font_px`.
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
