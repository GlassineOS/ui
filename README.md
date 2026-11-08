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
make check-boards        # the design-board tools under node (no browser)
make contrast-check      # the contrast check of every component (Chromium; see "Contrast check")
make contrast-test       # its self-test and the known failures it must catch (Chromium)
make generate            # write the generated forms (tools/gen-interleaf, then tools/gen-voices)
make reference           # the Interleaf reference in out/reference/ (see "Reference")
make serve-reference     # build it and serve it on http://127.0.0.1:8000/
make references          # rendered images against their references (Chromium; see "References")
make references-update   # write them after an intended change: tools/in-alpine make references-update
```

Needs cairo, pango, librsvg, glib (dev), python3, PyGObject (Gtk 3, Pango), pycairo, and node 24 or later
(the board tests). CI runs `make check` in `alpine:3.24` (`.github/workflows/build.yml` lists the packages).

CI runs `make check` on main. On a pull request, `tools/ci-scope` reads the changed paths: when
none of them can reach the library (`src/`, `python/`, `voices/`, the build files, the library
tests), it runs `make check-forms` alone. A token change that reaches the library rewrites
`voices/voices.json`, so it always gets the full run. The boards job runs `make check-boards`,
`make boards-check` and `make references` on every change, in Alpine with the pinned Chromium and
without network; when it fails, the reports and the images of the differences are uploaded as the
`references` artifact. The contrast job runs `make contrast-check contrast-test` (its report,
`out/contrast.json`, is kept as the run's artifact).

`make check` runs:

- `tools/gen-interleaf --check`: the voices' scheme in `voices/voices.json` and the web form match
  the tokens.
- `tools/gen-voices --check`: the generated C table, `glassine-ui-scheme.h` and the Python module
  match the data, and the C icon map matches `glassine_ui.paint.ICONS`.
- `tools/ladder --check`: spec 002 FR-021: every E-ink colour is one of the 16 ladder greys and no
  style that applies on e-ink has a gradient or a blur (see "Interleaf", "The ladder").
- `test/test_ladder.py`: the ladder's mapping rule, and a known failure of each kind (a token, a
  shadow, a shared or voice style, the voice data, a GTK rule, a keyboard colour) refused.
- `test/test_voices.py`: sections, the fallback to White, a changed value (and a changed scheme token)
  reaching every form, `tools/gen-apps` (into a temporary tree).
- `test/test_interleaf.py`: aliases and theme fallbacks, the voices' scheme from the E-ink themes, a
  changed token reaching the voices' scheme and the web form, the stale-form check, the 27
  combinations and the variables the component styles read, the coverage check.
- `test/test_reference.py`: the reference builds (twice, the same), every token, type style,
  family and component appears, every preview loads the web form, the picker offers all 27
  combinations, every link and source resolves. No browser.
- `test/ci-scope.sh`: which changed paths `tools/ci-scope` sends to the library checks.
- `test/test_paint.py`: the Python drawing API call by call.
- `test/c-api.sh`: a separate program built with `pkg-config glassine-ui` against an installed copy.
- `test/pc-prefix.sh`: the installed `.pc` names the prefix it was installed with.
- `test/contrast/*.test.js` (node): the contrast check's arithmetic (WCAG ratios and targets, the
  PNG decoder, the worst colour beneath, the focus-ring measure). See "Contrast check".
- `test/boards/*.test.js` (node): the board reader (holes, attributes, props, the subset checks, the
  renderer without a DOM), the preview server and the import tool (see "Boards"), and the
  reference checks without a browser: PNG, the comparison, the store and the report (see
  "References").
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
| `interleaf/fonts/` | the text fonts, vendored (woff2, `fonts.css`, each licence; see "Fonts") |
| `interleaf/components/NAME/` | a component's guidelines (`README.md`; `Cover` has none yet) and live preview (`preview.html`, its first line the card marker `@dsCard`: group, height, subtitle) |

A theme is a voice and a scheme: `white-paper`, `white-night`, `editorial-paper`, `editorial-night`,
`stationery-paper`, `stationery-night`, `eink` (White and Editorial) and `stationery-eink`. A token's
value is one value for every theme, or one per theme (which values a theme must have: below). A
value `{name}` is an alias of another token in the same theme.

The voices' scheme (`voices/voices.json`, section `scheme`) is generated from the E-ink themes:
White and Editorial from `eink`, Stationery from `stationery-eink`, with every alias resolved and
shadow lists joined by `,` alone. Its keys are fixed (`SCHEME_COLOURS`, `SCHEME_SHADOWS` in
`tools/gen-interleaf`); a key without a value in the voice's E-ink theme (or `eink`, its fallback)
is an error, never the Paper value.

Changing a token: edit `interleaf/tokens.json`, run `make generate`, commit the tokens and the
generated files together.

A theme without a value of its own takes only its fallback's (`stationery-eink` takes `eink`'s),
never the first theme's. Every colour token has a value in every theme. A shadow token needs a value
only in the themes whose component styles read it: White reads `keycap`, Editorial `offset` and
`passe-partout`, Stationery `card-stack` and `sheet-stack`. `tools/gen-interleaf` works this out from
`bundle.css` (a rule under `[data-theme^="VOICE"]` or `[data-theme="THEME"]` replaces the same
property of the same selector without it) and fails on a value that is missing.

### The ladder

On e-ink every colour is exactly one of the 16 ladder greys (`#000000`, `#111111` … `#ffffff`) and no
style uses a gradient or a blur (spec 002 FR-021). `tools/ladder --check` (in `make check`) holds the
E-ink themes' tokens, the declarations of `bundle.css` that apply in an E-ink theme (the same cascade
as above: a rule under `[data-theme="stationery-eink"]` replaces the same property of the same
selector without it; the E-ink rules sit at the end of the file) and the voice data to it. A value
that waits for a design decision can be listed in its `PENDING` with its reason (none is now); it
prints them on every run and fails when one is no longer there.

The panel shows a grey at the level of its top nibble after the desktop's grey curve (gamma 1.8 by
default), so a grey off the ladder goes to the ladder grey on the same panel level (the voice's ink
where the ink is on it), or the nearest level (of two equally near, the higher) where no ladder grey
has it: `tools/ladder --map HEX`, `tools/ladder --map-apps` (the `apps` section; a translucent
keyboard colour first over the key face it is drawn on). The curve is `epd_grey_luma_lut`'s; the
desktop's default grey mode is luminance (`epd_grey_lum_lut`, `grey_lum = 1`), which gives the same
level for all 256 neutral greys. The gamma can be changed at runtime (`gamma=`, `eink.conf`) and the
ladder holds only at 1.8; `test/test_ladder.py` pins it.

## Web form

Contract: web form, version 1.

`web/` holds the generated web form, for pages that look like GlassineOS (the documentation site,
the hub, the design boards):

| File | What |
|---|---|
| `web/tokens.css` | the tokens as CSS custom properties: colours and shadows per theme, the pen selection, then spacing, radius, layout, stroke, the greys and the font families (`--font-plex`, ...) on `:root`, and a class per type style (`.il-type-display`, `.il-type-ed-body`, ...) |
| `web/bundle.css` | the component styles, as `interleaf/components/bundle.css` |
| `web/combinations.json` | the 27 combinations: `voice`, `scheme`, `pen` and the `attributes` that select each |
| `web/fonts/` | the fonts, as `interleaf/fonts/` (`fonts.css`, the woff2 files, their licences) |

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

Without either attribute a page gets `white-paper` and pen 1. The fonts come with it: `bundle.css`
imports `web/fonts/fonts.css` (one `@font-face` per file), so a page that loads the web form loads
nothing from another site. Serve `web/` as a whole.

### Fonts

`interleaf/fonts/` holds the text fonts the component styles use, as woff2, each family with its
licence (`OFL.txt`, SIL Open Font License 1.1): IBM Plex Sans and IBM Plex Mono (White), Source Serif
4 (Editorial), EB Garamond (Stationery), Kalam (White's hand). `tools/fetch-fonts` writes them.

- **IBM Plex** reserves the font name "Plex", and the OFL forbids that name on a modified version, so
  these files are IBM's web builds, byte for byte: `fonts/complete/woff2/` of the npm releases
  `@ibm/plex-sans` 1.1.0 and `@ibm/plex-mono` 2.5.0, with the licence from the same release, each
  checked by sha256. They are never cut or converted; `make check-forms` compares them with the
  release's checksums.
- **The other three** have no reserved name. They come from a pinned google/fonts commit (checked by
  sha256), cut to what the styles use: the weights and styles (variable fonts to that weight range),
  the Latin letters with their extensions, punctuation, arrows and symbols, and every OpenType feature
  (small caps). `tools/fetch-fonts` refuses to cut a family whose licence reserves a name.

The output is the same on every run. Characters a font lacks come from the system's fallback fonts.
`tools/gen-interleaf` copies the folder to `web/fonts/`, and `make check-forms` fails when the copy
differs.

Changing the fonts: edit the list in `tools/fetch-fonts`, run `tools/in-alpine tools/fetch-fonts`
(fontTools and brotli are in that image) and `make generate`, then regenerate the references
(README "References").

### Reference

`tools/gen-reference` builds a browsable reference of Interleaf from this repository (spec 002
FR-030, FR-031): the guidelines, every token (usage, the value in each theme, a swatch or sample),
every component with its guidelines and a live preview, and a voice, scheme and pen picker that
offers the combinations of `web/combinations.json` and sets them on the page and in every preview.
It is styled with the web form itself and needs python3 alone.

```
make reference           # write out/reference/ (open out/reference/index.html, or:)
make serve-reference     # serve it on 127.0.0.1:8000 (REFERENCE_HOST=, REFERENCE_PORT=)
```

The picker remembers the choice in the browser; `?voice=editorial&scheme=eink&pen=2` on any page
picks one. Every link is relative, so the same files work from disk, the local server and a
sub-path. `.github/workflows/reference.yml` builds it on every push to main and publishes it to
GitHub Pages (https://glassineos.github.io/ui/ once Pages uses GitHub Actions as its source).

## Contrast check

Spec 002 FR-020. `tools/contrast` (or `make contrast-check`, in Alpine: `tools/in-alpine make
contrast-check`) renders every component preview of `interleaf/components/` with the web form, in
all 27 combinations of `web/combinations.json`, at desktop (1280px) and phone (390px) width, in
headless Chromium, and measures it against the guidelines' targets (WCAG 2.2 AA):

- **Text**, 4.5:1 (3:1 at 24px, or 18.66px at weight 700): every visible text node, and the text the
  styles generate (`::before` and `::after` content such as the section numerals, list markers,
  `::first-letter`, placeholders). The text's colour is its computed colour (alpha and opacity
  included). The colour beneath is read from a render with all text and text decorations made
  transparent, over the box of the text's glyphs; of its darkest and lightest pixel the one with
  the lower ratio counts. So patterns, highlighter bands, tabs and images count with their worst
  colour. Text is read 2px inside the edges of every ancestor whose `overflow` is not `visible`,
  scrolling or not, so a frame's keyline does not count as beneath the letters cut off at it; what
  is left of a text under 2px wide or high there is not measured.
- **Focus rings**, 3:1: every link, button, field and summary is rendered with `:focus` and
  `:focus-visible` forced (CDP), and `:focus-within` on its ancestors, and without. Each pixel that
  changes has the ratio of its focused to its unfocused colour; the ring's ratio is the best one
  that as many pixels reach as a 1px line around the element has. A ring in the colour of what it
  covers measures 1:1, and a neighbour lying under part of a 2px ring does not hide it. The changed
  pixels are pooled: every pixel within 40px of the element that focus changes counts, the ring,
  its offset, a halo, a fill or a text colour alike. So a passing ring means that focus changes
  enough pixels by 3:1, not that a drawn ring does.
- **States**: default; hover (forced) and focus on every interactive element, in every pen; text
  inside an `aria-current` element is reported as `current`; every closed `<details>` is opened
  (`open`).
- **Disabled controls** (`:disabled`, `aria-disabled="true"`, the `dim` token) are exempt from WCAG:
  their cases are `info`, never failures.
- **E-ink** is measured on the token values as rendered; how the display engine turns them into
  panel levels is not part of the check.
- Requests that leave the local server are blocked; the web form's fonts are local.

The report (`--json FILE`) has one case per measurement: `result` (`pass`, `fail`, `open`, `info`),
`ratio`, `target`, `fg` and `bg` (the worst pair), `kind` (`text`, `generated`, `focus-ring`),
`pseudo`, `element`, `text`, `control` (the hovered or focused element), `state`, `component`,
`voice`, `scheme`, `pen`, `theme`, `width`. A short summary groups the failures. Options narrow the
run: `--component NAME`, `--theme ID|VOICE|SCHEME`, `--width desktop|phone`, `--jobs N`.

Known open failures on main are listed in `test/contrast/open.json`, each with its measurement and a
proposed fix: they are reported as `open` and do not fail the check. An entry that no longer fails is
stale and fails the check, so it goes with its fix.

Coverage: a page that measures nothing cannot fail, so the check also fails when a page measures
too little. Every page must measure at least one text case, and `test/contrast/coverage.json`
(`--coverage FILE`) gives each component the least number of text cases and focus rings each of its
pages must measure (the lowest counts on main). A preview whose stylesheets did not load, or loaded
empty, is an error. When a preview loses text or controls on purpose, its floor goes down with it.

`make contrast-test` runs `test/contrast/selftest.js` (a page of known answers: patterns, bands,
generated text, large text, the disabled exemption, rings, hover, current, open) and
`test/contrast/known-failures.js`: the acceptance set of known failures (spec 002 SC-002), one fixture
each in `test/contrast/known/` (listed in `known.json`, how each was built in its comment). Each is
injected on its own (`--inject`). A case is caught when it fails with the fixture and passes without
it, and every case the fixture's `expect` lists must be caught: its kind, theme, text, element and
state, its colours, and a ratio at most the one measured. The test prints the case that matched
each expectation.

Known limits of the measure (follow-ups):

- **The worst colour is the darker or the lighter extreme** of the backdrop under the glyphs. When
  the text's luminance lies between the two, a mid-tone between them (a mid-grey stripe, a
  gradient step) can be nearer to it than either, and is not found. At 4.5:1 that needs both
  extremes to pass with the text between them; at the 3:1 of large text the window is wider.
- **Generated text is found at the default state only.** `::before`, `::after` and `::marker` are
  read from the document tree once per page, so generated text that exists only on hover or focus,
  or only inside a `<details>` once it is opened, is probably not measured.
- **Text is read where it lies at scroll position 0.** Text scrolled out of a scroller's clip (the
  code block's long lines at phone width, and what lies under them on the highlighted line) is not
  measured.
- **`currentColor` drawings leave the backdrop with the text.** The backdrop makes all text
  transparent, so a border, outline, shadow or background drawn in `currentColor` disappears from
  it too, and a dark shape beneath text can drop out of the extremes. For focus rings that makes a
  false failure, not a false pass. Today the bundle's one use is the summary's chevron
  (`.il-details > summary::before`), which lies beside the text.
- **The colour is the computed `color`.** A style with `-webkit-text-fill-color` or a blend mode
  would paint another colour than the one measured; the bundle has none.

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

The `apps` values are the GTK and keyboard themes' own greys, not the scheme's roles: each is on the
ladder (`tools/ladder --map-apps` put them on the ladder grey of their panel level). The keyboard's
swipe trail is opaque: the grey the translucent trail showed over the key face.

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
tools/boards references DESIGN_DIR [--update] [--refs DIR] [--out DIR] [--json FILE|-] [--board FILE]... [--allow-empty]
tools/boards import  CANVAS_EXPORT_DIR DEST_DIR [--force]
tools/in-alpine CMD...      # CMD in alpine:3.24 with the pinned Chromium and node, as the calling user
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
  with `--allow-host` (the hub's name for this machine, for example).
- `check` renders every board of the folder in headless Chromium at its canvas size (else its
  `$preview` size) and writes a JSON report (`--json -` for stdout) and a summary: per board the render,
  script and load errors (`errors`), the features outside the subset (`unsupported`), console errors
  and uncaught exceptions (`console`), failed requests to the preview (`requests`) and requests to
  other sites (`external`). Boards render without network (see "References"), so every request to
  another site is refused and fails the board, except a Google Fonts stylesheet for a vendored family.
  It exits 1 when a board fails or a board on the canvas is missing. It needs Chromium and `puppeteer-core` (`npm ci`; the version is pinned in
  `package.json` and `package-lock.json`); `tools/in-alpine tools/boards check …` provides both.
  Chromium runs with its sandbox, except as root or in a container, where it can't start
  (`BOARDS_NO_SANDBOX=1` turns it off elsewhere).
- `import` copies a canvas exported from claude.ai into a design folder: boards, `canvas.json` and the
  sample data. It leaves out claude.ai's own files (`artifact-type/`, `SKILL.md`, `index.html`, any
  `support.js`), the embedded `ds/` copy (in any folder) and symbolic links (never followed), removes
  `designSystems` from `canvas.json`, and lists what it left out.

What a board can do: its logic is JavaScript from the export, and `preview` and `check` run it as it
is, so open only boards you would run anyway. A board page has the same origin as the preview's own
pages and API (`/_boards/`), so it can script them and read everything the server serves: the design
folder and Interleaf, nothing outside them. It can also load from and send to other sites. The
preview has no login: with `--host`, anyone who can reach the port can read the design folder.

`make boards-check` renders the samples in `boards/samples/` (every feature of the subset, against
this checkout's `interleaf/`; `BOARDS_INTERLEAF=DIR` for another copy) and clicks
through them (`test/boards/samples-e2e.js`: state, branches, links, the preview pages, and the boards
in `test/boards/unsupported/` failing with the right features); CI runs it in Alpine
(`tools/in-alpine make boards-check` locally).

Code: `boards/runtime/` (the reader `template.js`, shared with node; the browser runtime
`runtime.js`; Preact 10.29.8 under `vendor/`, MIT), `boards/lib/` (`server.js`, `import.js`,
`browser.js`: open Chromium, render one board and collect its errors, keeping the page open for
callers that take screenshots, `isolate()` (no network, Google Fonts from the vendored fonts) and
`steady()` (no motion, fonts loaded) for any page; `check.js`; `png.js`: PNG and the pixel
comparison; `references.js`: the reference store, the runner and the board references;
`previews.js`: the component previews), `boards/preview/` (the canvas and the board view).

- `references` renders every board at its declared sizes in the combinations the design folder lists
  and compares each with its reference image (see "References"); `--update` writes the references.

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
boards-references: | $(UI)
	$(UI)/tools/in-alpine $(UI)/tools/boards references design
boards-references-update: | $(UI)
	$(UI)/tools/in-alpine $(UI)/tools/boards references design --update
```

The references live in that repository (`design/references/`, set by `design/references.json`), not
here; a new ui version that changes pixels (Interleaf, the runtime, the pinned Chromium) shows up as
differences there, and the repository updates its references when it moves its pin.

## References

Contract: references, version 1 (the store's `index.json` `"contract"`, and the report's).

Rendered images compared with stored ones, for Interleaf's components (002 FR-022, FR-023) and for
design boards (003 FR-011, FR-012):

```
make references              # both, below; tools/in-alpine make references for the pinned Chromium
make previews-check          # tools/previews: every component, 27 combinations, desktop and phone
make boards-references       # tools/boards references boards/samples
make references-update       # write all of them (previews-update, boards-references-update)
tools/previews [--update] [--component NAME]... [--width desktop|phone]... [--combination THEME-PEN]...
               [--refs DIR] [--out DIR] [--json FILE|-] [--jobs N]
```

- **Components:** each `interleaf/components/NAME/preview.html`, with the web form loaded as a page
  that uses it does (`web/tokens.css`, `web/bundle.css`, and through it `web/fonts/`) and the
  combination's `data-theme` and `data-pen` on `<html>`, in all 27 combinations
  (`web/combinations.json`), at desktop width (1280px) and phone width (390px): 702 cases. A
  render is as tall as its content. References: `test/references/components/`.
- **Boards:** every board of a design folder at its declared size (the canvas size, else its
  `$preview` size), in the combinations the folder lists in `references.json` (default: one per board,
  the board's own props). References: `references/` in the design folder. In this repository the
  samples (`boards/samples/`) are the test corpus.

  ```json
  {
   "references": "references",
   "combinations": ["own"],
   "fonts": "fonts/fonts.css",
   "boards": {
    "Main.dc.html": { "combinations": ["own", "stationery-eink-1", "all"], "sizes": [{ "width": 390, "height": 760 }] },
    "Wip.dc.html": { "skip": true }
   }
  }
  ```

  A combination is `"own"` (the board's own props), `"all"` (the 27), a name from the web form
  (`VOICE-SCHEME-PEN`: `white-paper-1` … `stationery-eink-3`; it sets the board's `voice` or `theme`,
  `scheme` and `pen` props as the preview's picker does) or `{"name", "voice", "scheme", "pen",
  "props"}`. `fonts` names more vendored fonts (`@font-face` rules, URLs relative to that file), for
  families Interleaf does not ship (an icon font, for one).
- **No network.** A render may load only from the local server (and `data:`, `blob:`); every other
  request is refused and is an error of that case. A Google Fonts stylesheet is answered from the
  vendored fonts (Interleaf's, and the design's `fonts`), since boards from claude.ai link them; a
  family that is not vendored is an error naming it. A web font that fails to load is an error. CI
  runs these checks in a container without network.
- **Steady renders.** Reduced motion, animations and transitions at their end, no caret, focus
  dropped, device scale 1, Chromium's font hinting off, one raster thread and no CPU-specific Skia
  paths. Before the screenshot: every font and image loaded, none of the page's timers of up to 10 s
  pending (a board that fills itself in after a delay), and no change to the document for 250 ms,
  waiting at most 10 s. Each worker has its own browser with one tab: a tab that is not in front may
  get no frames, and its screenshot then never returns.
- **The report** (`out/references/components/report.json`, `out/references/boards/report.json`, or
  `--json`): per case its `status` (`pass`, `differs`, `no reference`, `bad reference`, `error`, or `updated` with
  `--update`), `differing` (pixels), `maxDelta` (the largest channel difference), `box` (where the
  differences are), the `reference`, the `actual` render and the `diff` image (paths, the last two
  below `out/references/` for failing cases), and `errors` (load and script errors, refused requests,
  fonts); a `summary` with `ok`; `stale`: references of cases that no longer exist (a full run only;
  `--update` removes them); `chromium`: the version of the references and the running one. The diff
  image shows the reference faded, the differing pixels red, and an area only one image has blue.
  The command exits 1 unless every case passes.
- **The store:** `index.json` (`contract`, `kind`, `chromium`, `tolerance`, and per case the file and
  its size) and the PNGs, each named by a hash of its pixels, so identical renders are stored once
  (the three pens of an E-ink scheme, for one). The PNGs are lossless and written small (greyscale or
  a palette where the colours allow, the best filter per row); `boards/lib/png.js` reads and writes
  them, no npm package. The components' 702 cases are 412 images, 7.5 MB.
- **Tolerance: none.** A pixel differs when any colour channel differs at all (threshold 0), and a
  case fails at one differing pixel. With the fonts vendored, the Chromium version pinned, the
  same fonts for fallback (DejaVu in Alpine), software rendering and device scale 1, renders are
  pixel-identical run to run. Measured on Chromium 156.0.8078.79 with six renders in parallel: all
  702 component cases, the 11 sample boards, and a second run against the first over the 65 boards
  of the hub's canvas and the 123 of the shell's matched exactly (the shell's with Material Symbols
  supplied through `fonts`). A tolerance would hide what these checks are
  for: a one-step grey change of an E-ink token moves a channel by 17, a token's hex typo by 1. If a
  case ever turns out unstable, fix the cause (an animation, a timer, a font) rather than widening
  the threshold.
- **Chromium is part of the contract.** References are valid for one Chromium build: the version in
  `tools/chromium.pin`, Alpine 3.24's package (`chromium=156.0.8078.79-r0`), installed by
  `tools/in-alpine` and by CI. A run with another version reports `chromiumMismatch` and fails, even
  when the pixels agree. Alpine updates Chromium in 3.24 every few weeks and drops the old package;
  then `tools/in-alpine` and CI fail to install the pin. Bumping it: set the new version in
  `tools/chromium.pin`, run `tools/in-alpine make references-update` (and the same in each
  repository with board references when it moves to this ui version), look at what changed, and
  commit the pin and the references together.
- **The text packages are recorded, not pinned.** Alpine's Chromium draws text with the system's
  freetype, harfbuzz and fontconfig, and falls back to font-dejavu and font-opensans. These float
  within 3.24, and old versions disappear from the mirrors, so a pin would break CI on its own. The
  store records their versions (`libraries` in `index.json`) and the report gives both (`libraries`:
  `references`, `running`, `differ`). A difference alone is no failure: pixels decide. When a run
  fails and the versions differ, the report sets `summary.librariesDiffer` and the summary names each
  package, so a failure in many cases explains itself; regenerate with the command below after
  looking at the differences. `tools/in-alpine` names its image after the pin and a hash of what
  Alpine ships today, so a cached image can't stand in for what CI installs; without network it
  uses the newest local image of the pin and says so.
- **A check that compares nothing fails:** an unknown `--board` or `--component` is an error, and no
  cases at all (a design folder with no boards, or every board `skip`) is a failure unless
  `--allow-empty` says it is intended.
- **Damaged stores:** a reference that can't be read is that case's failure (`bad reference`), and
  `--update` writes it again; an `index.json` that can't be read is reported (`storeError`), and
  `--update` writes a new one. PNGs that no case names are reported as `orphans` and fail the check.
  An update where a render fails while the Chromium or the text packages changed writes nothing
  (`summary.written` is false), so a store never mixes two sets.
- **Regenerating after an intended change** (a token, a component style, a font, a preview): one
  command, `tools/in-alpine make references-update`, then review the changed images
  (`git status test/references boards/samples/references`) and commit them with the change.
  `--component`, `--width`, `--combination` and `--board` narrow a run; a narrowed update keeps the
  other references. A full component run takes two to three minutes.

## Licence

GPL-2.0-or-later (`LICENSE`).
