# Footer

The page foot: the licence line and the generator credit (Material's copyright partial).

- **Consumer provides:** the copyright text and any links.
- **White and Editorial:** `paper` with the voice's bar rule on top; text in `ink-soft`, links underlined and `ink` on hover.
- **Stationery:** on `leather-dark`. Text in `on-accent-soft`, links in `on-accent` (cream), `gilt` on hover. Never `ink-soft` on leather: the audit measured 2.17–2.37:1 for it, and 1.94:1 on e-ink.
- **Hover** on leather keeps `on-accent` with the 2px underline, or goes to `gilt` (the docs use `gilt`); never `ink` (1.06–1.16:1 on `leather-dark`). In MkDocs, Material's `html .md-footer-meta.md-typeset a:hover` uses `--md-footer-fg-color`: map it to the footer's hover token, `--md-footer-fg-color--light` to its link colour and `--lighter` to its text.
- In MkDocs, make the generator link's own selector (`.gl-generator a`) carry the voice colour. Material's `.md-typeset .md-copyright a` otherwise wins.
- Focus ring: `focus-on-leather` in Stationery.
