Interleaf is the shared design system of GlassineOS, a Linux distribution for e-ink tablets: its shell and its documentation site (MkDocs + Material). Glassine is the thin, translucent sheet bound between a book's pages to protect its plates. The system behaves the same way: it sits over the work, keeps it clean, and never competes with it.

**Structure buys freedom.** A strict, still frame (greys, grid, rules, one reading measure) so the content and the reader's own marks can be expressive.

## The three layers

1. **Structure** is fixed and shared by shell and docs: the 16-grey ladder (`grey-0` … `grey-15`), the 4px unit (`space-1`), a 68-character measure (`measure`), the token names, and the rule that meaning is never carried by colour alone.
2. **Voice** is one of three design languages, chosen by the reader and shared with the shell's Appearance setting. It changes type, edges, rules, numbering and vocabulary, never layout.
   - **White** — the instrument. IBM Plex Sans, Plex Mono labels in caps, 1.5px ink keylines with a flat 3px `keycap` offset, dotted rules, circled hand-written section numbers.
   - **Editorial** — the journal. Source Serif 4, small-caps labels in `accent` (rubrication), square corners (`radius-none`), double rules, `passe-partout` frames, `§ 1` numerals, a red drop cap.
   - **Stationery** — the desk, the skeuomorphic voice. EB Garamond, small caps, a leather desk and header with gold-thread stitching, a laid-paper reading sheet with a gilt edge, a wax-seal dot on warnings, code on an index card. All of it in **flat** colours.
3. **Pen** is the colour layer: each voice owns three options that belong to it, plus a highlighter. The theme picks option 1 (`accent`, `highlight`); swap in `accent-2`/`highlight-2` or `accent-3`/`highlight-3` when the reader picks another.

| Voice | `accent` (house) | `accent-2` | `accent-3` | `pen` |
|---|---|---|---|---|
| White | Cobalt + marigold | Signal + apricot | Graphite (no colour) | = accent |
| Editorial | Rubric red + blush | Blue pencil | Green ink | = accent |
| Stationery | Oxblood leather | Bottle-green leather | Navy leather | blue-black fountain ink |

## Themes

A theme is voice × scheme: `white-paper`, `white-night`, `editorial-paper`, `editorial-night`, `stationery-paper`, `stationery-night`, `eink`, `stationery-eink`. Component styles read the voice from the theme id's prefix (`white-`, `editorial-`, `stationery-`); `eink` uses the White structure.

- **Paper** is the default on LCD and phones.
- **Night** follows `prefers-color-scheme`. Never pure black: `paper` is `#121212` or a warm near-black.
- **E-ink** uses only the ladder. `pen` becomes ink, highlighters `grey-12`, Stationery leather `grey-2`, gold `grey-11`/`grey-5`, wax `grey-3`. Textures, drop shadows and tilts switch off. Selected automatically with `@media (update: slow)` or by the reader.

## Colour rules

- Body text is `ink` on `paper` or `sheet`. Secondary text is `ink-soft`. Both hold at least 5:1 in every theme.
- `pen` is for the reader's hand: links, margin notes, drawn marks, White and Editorial numerals. Never for body copy.
- `highlight` sits only *behind* `ink` text (link underlay in White, search hits, current nav item, `hl_lines`). Never as text colour.
- Text on an `accent` fill is `on-accent`, never literal white.
- In Stationery, `accent` is leather: a surface, not text. Gold text on paper is `gold`. `gilt` is decorative gold for leather and edges only.
- Every colour is flat. No gradients: each must map to exactly one grey on a 16-level panel. The laid-paper and index-card lines are the only patterns, and they switch off on e-ink.
- Admonition types are told apart by shape: note = soft outline, warning = heavy outline + label, danger = heaviest outline (or double / wax ring), tip = dashed. Colour adds to that, never replaces it.
- **Every colour pair is chosen by the surface it sits on.** On paper and sheet use `ink`, `ink-soft`, `pen`, `gold`. On Stationery leather use `on-accent`, `on-accent-soft`, `gilt`, and never `ink-soft` or `pen`. On a cream control use `ink` set by its own token.
- **Never pair a fixed colour with a themed one.** A fixed text colour over a theme-aware background (or the reverse) breaks in the theme nobody checked. Background and text come from tokens that change together.
- **Hover keeps the surface.** On leather, nav and footer links keep their own text colour on hover and only add the 2px underline, or go to `gilt`. Never to `pen` or `ink`: they belong to paper. The navy pen on leather measured 1.01–1.13:1 in every leather, and page ink on the footer leather 1.06–1.16:1.
- **Text on leather needs leather on every layer.** Any panel that holds cream text (the drawer and each nested drawer level, the footer, the desk nav) paints `accent` or `leather-dark` itself. It never inherits the page's paper.
- Keyboard focus: a 2px solid ring with a 2px offset on every interactive element. Its colour depends on the surface: `focus` on paper and sheet, `focus-on-leather` on leather, `focus-on-cream` on cream controls in the leather header.

## Type

Set text in the voice's styles: White `display`, `section`, `body`, `label`, `note`; Editorial `ed-display` … `ed-note`; Stationery `st-display` … `st-note`. Code in every voice is `code` (IBM Plex Mono). Highlighting is by weight (keywords 600) and slant (comments italic), never colour.

- Body sizes are larger than web defaults (17 / 18.5 / 20px) because a 300 ppi panel is held at reading distance; Garamond reads small and gets the most.
- Labels: White in caps with +0.08em; Editorial and Stationery in lowercase small caps with +0.1em.
- The hand (`hand`, Kalam) appears only in White, only in the pen layer: margin notes and section numerals. Editorial's hand is italic Source Serif, Stationery's italic Garamond led by ❧.
- Keep running text to `measure` (68ch). Headings use `text-wrap: balance`.

## Space, edges, layout

- Space in steps of `space-1` (4px): `space-2` within groups, `space-6` between blocks, `space-8` above an h2, `space-16` between nav and content. The side gutter is never less than `space-4`.
- Corners: White `radius-ui` (controls) and `radius-card`; Editorial `radius-none`; Stationery `radius-paper` and `radius-chip`.
- Edges: White `keycap` under a 1.5px ink outline; Editorial `passe-partout` frames and a hard `offset`; Stationery `sheet-stack` and `card-stack`.
- Layout comes from Material for MkDocs and is not changed. Decorations take no layout space below 1200px: margin notes (`note-column`) drop inline under their paragraph, numerals sit on the heading line, Stationery's sheet padding falls to `space-4` on phones.
- No motion in the frame. One hover per element (links thicken their underline). Touch targets are at least 44px.

## Accessibility

Targets (WCAG 2.2 AA): text 4.5:1 (3:1 at 24px+ or bold 18.66px+), focus rings, control edges and meaningful icons 3:1. These hold for **every voice × scheme × pen** (27 combinations), not only the defaults.

- Check each change in all 27 combinations on desktop and at phone width with the drawer open. Include the current nav item and opened `details`.
- **Hover and focus states count, in every pen, not just the house one.** Hover each link and control on each surface (sidebar, drawer, contents list, header, footer, page) in all three pens or leathers of every voice and scheme, and measure the hovered colour against the surface beneath. The house pen alone hides failures: the hover failures of 2026-10-31 hit all three leathers alike. Count text over textures and highlighter bands against the worst colour beneath it, and count CSS-generated text (section numerals) too.
- The 2026-10-31 audit of docs.glassine.org found White and Editorial clean in all 18 of their combinations. Every failure was in Stationery: the drawer (cream nav on paper), Night `details` summaries, the focus rings on leather and cream, the footer credit, and Night code comments. Each one is fixed in these tokens and rules: `on-accent-soft`, the three focus tokens, Stationery Night `ink-soft` raised to `#ccbfa4`, and the Details, Footer and Navigation guidelines.
- Material's own gaps to cover in the theme: give the search dialog an accessible name, and give the primary and section navs distinct labels.

## Content fundamentals

- **Facts, present tense, forward-looking.** Say what is true and what to do. History goes in Dead ends or a decision record.
- **Every hardware fact carries a verification date** — render it with the verified stamp (`{ .gl-verified }`). Untested facts say *from source, untested*.
- **Warnings come with an exit.** Every "this can brick your device" names the way back.
- **Plain language.** Short sentences, terms explained once, tables for comparisons. Sentence case in English headings.
- No emoji. Glyphs that belong to a voice are fine: ❧ (Stationery), § (Editorial), ← → arrows in White's hand.
- Vocabulary follows the voice, as in the shell: White *Overview · Quick settings · Apps · Notifications*; Editorial *Windows · Controls · Applications · Notices*; Stationery *The spread · The desk · Index · The post*. In the docs: White "On this page · Search", Editorial "contents · search the guides…", Stationery "the index · look up in the index".

## Iconography

The shell uses Material Symbols Outlined; the docs use Material for MkDocs' bundled icons. Icons are stroke icons in `ink` (or `pen` when they mark the reader's action), 18–20px, never filled colour blobs and never emoji. The GlassineOS mark (two overlapping sheets, the front one in `highlight` with a `pen` stroke) is drawn inline; no logo file is part of this system yet.

## Implementation

- **Docs (MkDocs Material):** one `extra.css` maps these tokens to `--md-default-bg-color` (`paper`), `--md-default-fg-color` (`ink`), `--md-default-fg-color--light` (`ink-soft`), `--md-default-fg-color--lightest` (`rule`), `--md-code-bg-color` (`sheet`), `--md-accent-fg-color` by surface (`pen` on paper and sheet; `on-accent` wherever text sits on leather: in Stationery the sidebars and drawer, the header and the footer), `--md-text-font` and `--md-code-font`. Voice, scheme and pen are three attributes on `<body>` (`data-gl-voice`, `data-md-color-scheme`, `data-gl-pen`) set by a small header picker and remembered per reader. Set the accent on those containers, don't outrank Material's link rules: `.md-nav__link[href]:hover` and the footer's `a:hover` read `--md-accent-fg-color` and `--md-footer-fg-color` and win over a theme's plain selectors. Map the footer variables to the footer's own tokens (link, text, and `gilt` for hover in Stationery). Opt-in markdown: `{ .gl-verified }`, `[text]{ .gl-note }`, `md_in_html` for the home cards.
- **Shell:** the `themes()` keys map one-to-one: `fontUI` → voice text family, `lblFont` → label style, `cardSh`/`btnSh` → `keycap` / `passe-partout` / `card-stack`, `sep` → the stroke tokens, `togOnBg`/`selBg` → `accent`/`highlight`. On the device the bundled browser passes the shell's voice and pen to the docs.
- Component class names (`.il-*`) in `components/bundle.css` show each pattern; previews follow the selected theme.
