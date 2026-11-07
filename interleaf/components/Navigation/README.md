# Navigation

The site sidebar and the phone/tablet drawer: section labels over links, with the current page marked with `aria-current="page"`.

- **Consumer provides:** groups of links (Material's `navigation.sections`), each with an `il-label` heading; below 1220px the same nav inside `.il-drawer` with an `.il-drawer__title`.
- **White:** the current page sits on a `highlight` swipe, tilted −1.2°, with uneven radii like a marker stroke.
- **Editorial:** the current page is italic `accent` with a 2px underline. No fill.
- **Stationery:** the nav sits on the leather desk (`accent`) in `on-accent` text; labels in `gilt`; nested levels in `on-accent-soft`; the current page is a flat `gilt` tab.
- **The drawer paints leather on every panel.** Material gives each drawer level (`.md-nav`, `.md-nav__list`) the page background. In Stationery each one must get `accent` too, because the cream text is only legible on leather. The audit measured cream on paper at 1.08:1. The drawer title is `gilt` on `leather-dark`; the audit measured dark ink there at 1.06–1.16:1.
- **Hover:** every link keeps its own text colour and gains a 2px underline. On leather that colour is `on-accent` (or `on-accent-soft` for labels and nested levels), never `pen`: in MkDocs, set Material's `--md-accent-fg-color` to `on-accent` on the leather sidebars and drawer, since Material's `.md-nav__link[href]:hover` paints the accent. The navy pen on leather measured 1.01–1.13:1.
- **Focus:** `focus-on-leather` (flat gold) wherever the nav sits on leather; never the pen.
- Do: keep link rows at least 32px tall and the whole tap target 44px on touch screens.
- Don't: mark the current page with colour alone; the swipe, underline or tab is the marker.
