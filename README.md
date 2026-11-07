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
make generate            # write the generated forms (tools/gen-interleaf, then tools/gen-voices)
make export-claude       # Interleaf staged for claude.ai in out/claude/interleaf
```

Needs cairo, pango, librsvg, glib (dev), python3, PyGObject (Gtk 3, Pango), pycairo, and node 24 or later
(the board tests). CI runs `make check` in `alpine:3.24` (`.github/workflows/build.yml` lists the packages).

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
- `test/test_paint.py`: the Python drawing API call by call.
- `test/c-api.sh`: a separate program built with `pkg-config glassine-ui` against an installed copy.
- `test/pc-prefix.sh`: the installed `.pc` names the prefix it was installed with.
- `test/boards/*.test.js` (node): the board reader (holes, attributes, props, the subset checks, the
  renderer without a DOM), the preview server and the import tool. See "Boards".
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

## Boards

The design boards of the shell and the hub (spec 003) are files in claude.ai's design-component format
(`*.dc.html` with a `canvas.json`). This repository renders, previews and checks them without claude.ai;
the boards themselves live in the repository whose program they describe.

### Supported subset

Contract: board subset, version 1 (`SUBSET_VERSION` in `boards/runtime/template.js`; `tools/boards
version`). A board that uses anything else fails visibly: the board shows a red box naming the board,
the line and the feature, and the check reports it as `unsupported`.

- The file: `<html>` with a `<head>` of `<meta>`, `<title>` and `<script src>` (local; `./support.js` is
  where the runtime comes in, the others, such as `data/fixtures.js`, run before the logic class), and a
  `<body>` holding one `<x-dc>` template and one `<script type="text/x-dc" data-dc-script>`.
- `<helmet>` at the top of the template: `<link>`, `<style>`, `<meta>`, moved into the page's head.
- Holes `{{ dotted.path }}` (whitespace inside the braces allowed), `{{ $index }}` and the literals
  `true`, `false`, `null`, `undefined` and numbers; no expressions. In text: strings and numbers are
  shown, `null`, `undefined` and booleans show nothing, an object is a render error.
- Attributes: a literal is a string; one whole hole passes the raw value (function, number, object);
  text with holes is an interpolated string (also inside `style="…"`). `class` and `for` (and
  `className`, `htmlFor`) set the class and the label target. `value`, `checked`, `disabled`, `aria-*`,
  `data-*` and the other attributes take holes. `<textarea>`'s text (with holes) is its initial value.
- Events: JSX camelCase attributes bound to one hole: `onClick`, `onDoubleClick`, `onChange` (every
  edit for text inputs and textareas, as in React), `onInput`, `onSubmit`, `onKeyDown`/`Up`/`Press`,
  `onFocus`/`onBlur` (bubbling), the mouse, pointer, touch, drag and clipboard events, `onWheel`,
  `onScroll`, `onContextMenu`, `onToggle`, `onLoad`, `onError`.
- `ref="{{ fn }}"` (a callback or a ref object).
- `<sc-if value="{{ x }}" hint-placeholder-val="…">` and `<sc-for list="{{ xs }}" as="x"
  hint-placeholder-count="…">`, nested; a loop's `as` name and `$index` are in scope inside it.
- The template is read as HTML is, with the implied end tags of `li`, `option`, `dt`/`dd`, table
  rows and cells, and `p` (closed by a block start tag); an end tag left over after that is reported.
- `<dc-import name="X" …>` mounts `X.dc.html` beside the importing board (so `history/A.dc.html`
  imports `history/X.dc.html`); every other attribute is a prop, kebab-case to camelCase
  (`on-fit` → `onFit`); `style` styles the block that holds the child (`position: relative` unless the
  style says otherwise); `hint-size="W,H"` sizes it until the child has loaded. An imported board gets
  only the props written on the tag. A board that ends up importing itself (`A` → `B` → `A`) is
  unsupported; the report names the `<dc-import>` line that closes the cycle, and a missing board
  names the line that imports it.
- The logic: `class Component extends DCLogic` (plain JavaScript, no `import`/`export`, no
  `render()`), with `renderVals()`, `this.props`, `state` as a class field or set in the constructor,
  `setState` (object or function), `forceUpdate()`, `componentDidMount`/`DidUpdate`/`WillUnmount`,
  static members, and the browser's own APIs (timers, `fetch`, `matchMedia`, `ResizeObserver`, ...).
  The class is evaluated once per board file, so its static members are shared by every copy of it.
- `data-props` (single- or double-quoted; entities are decoded before the JSON is read): per-prop
  `editor`, `default`, `options`; `$preview: {width, height}`. The board opened on its own gets the
  `default`s as props, as an editor seeds them.
- Links `<a href="Other.dc.html">` move to that board (relative to the board that holds the link; a
  leading `/` is the design folder); the preview's voice, scheme and pen go along. `#id` scrolls; `http`
  and `https` links to other sites open a new tab, other schemes (`javascript:`, `data:`) do nothing.
- `fetch('ds/interleaf/…')` reads Interleaf from this repository (see below).

### Commands

```
tools/boards preview DESIGN_DIR [--port 4790] [--host 127.0.0.1] [--allow-host NAME]... [--interleaf DIR]
tools/boards check   DESIGN_DIR [--interleaf DIR] [--json out/boards-check.json|-] [--board FILE]...
tools/boards import  CANVAS_EXPORT_DIR DEST_DIR [--force]
tools/in-alpine CMD...      # CMD in alpine:3.24 with Chromium and node, as the calling user
```

- `preview` serves the design folder at `/` and the canvas at `/_boards/`: the pages of `canvas.json`
  with every board at its place and size, the notes, interactive boards marked, boards not on the
  canvas listed below it, and live thumbnails on request. A board opens in a view with its own size
  (shrunk to fit, or filling the window for `"expand": "fill"`), a voice, scheme and pen picker (it
  sets the board's `voice` or `theme`, `scheme` and `pen` props when the board has them), and the
  board's own enum and boolean props. Every file a board loads as `support.js` is the runtime;
  `ds/interleaf/*` at any depth comes from Interleaf (default: this checkout's `interleaf/`;
  `--interleaf DIR` serves another copy as it is), never from a copy in the design folder. The tokens
  are served as `interleaf/tokens.json` has them: a board that reads a theme's value applies the
  theme fallback itself (`stationery-eink` takes `eink`'s value where it has none). Saving a board,
  the canvas or Interleaf reloads the page. Node only, no npm packages.
- The preview serves only files below the design folder (and Interleaf, and its own pages): no names
  starting with `.`, no symbolic link that leads outside, no NUL in a path. It listens on 127.0.0.1;
  `--host 0.0.0.0` lets the hub reach it. It answers only requests whose `Host` (and `Origin`, when
  sent) is localhost, the bound address (every local address when bound to all), or a name given
  with `--allow-host` (the hub's name for this machine, for example). Boards are code from a canvas
  export: they run in the browser with the preview's origin, so they can reach its pages and the
  canvas API, and they may load from other sites (fonts). Preview only designs you would run.
- `check` renders every board of the folder in headless Chromium at its canvas size (else its
  `$preview` size) and writes a JSON report (`--json -` for stdout) and a summary: per board the render,
  script and load errors (`errors`), the features outside the subset (`unsupported`), console errors
  and uncaught exceptions (`console`), failed requests to the preview (`requests`) and to other sites
  (`external`, such as fonts: listed, not failures). It exits 1 when a board fails or a board on the
  canvas is missing. It needs Chromium and `puppeteer-core` (`npm ci`; the version is pinned in
  `package.json` and `package-lock.json`); `tools/in-alpine tools/boards check …` provides both.
  Chromium runs with its own sandbox, except as root or with `BOARDS_NO_SANDBOX=1` (`tools/in-alpine`
  sets it: the container is the sandbox there).
- `import` copies a canvas exported from claude.ai into a design folder: boards, `canvas.json` and the
  sample data. It leaves out claude.ai's own files (`artifact-type/`, `SKILL.md`, `index.html`, any
  `support.js`), the embedded `ds/` copies (at any depth) and every symbolic link (never followed, so
  nothing outside the export is copied), removes `designSystems` from `canvas.json`, and lists what it
  left out.

`make boards-check` renders the samples in `boards/samples/` (every feature of the subset, against
this checkout's `interleaf/`; `BOARDS_INTERLEAF=DIR` for another copy) and clicks
through them (`test/boards/samples-e2e.js`: state, branches, links, the preview pages, and the boards
in `test/boards/unsupported/` failing with the right features); CI runs it in Alpine
(`tools/in-alpine make boards-check` locally).

Code: `boards/runtime/` (the reader `template.js`, shared with node; the browser runtime
`runtime.js`; Preact 10.29.8 under `vendor/`, MIT), `boards/lib/` (`server.js`, `import.js`,
`browser.js`: open Chromium, render one board and collect its errors, keeping the page open for
callers that take screenshots; `check.js`), `boards/preview/` (the canvas and the board view).

### From another repository

A repository with boards uses a pinned version of this one, never a copy (003 FR-020):

```make
UI_REF = <tag or commit of GlassineOS/ui>
UI = $(HOME)/.cache/glassine/ui/$(UI_REF)
$(UI):
	git clone -q https://github.com/GlassineOS/ui $@
	git -C $@ checkout -q $(UI_REF)
boards-preview: | $(UI)
	$(UI)/tools/boards preview design
boards-check: | $(UI)
	$(UI)/tools/in-alpine $(UI)/tools/boards check design
```

## Licence

GPL-2.0-or-later (`LICENSE`).
