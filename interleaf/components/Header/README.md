# Header

The site bar: the GlassineOS mark and name, search, and the appearance picker with three buttons for Voice, Scheme and Pen.

- **Consumer provides:** the brand link, a search input with a visually hidden label, and the three picker buttons. In MkDocs this is Material's header plus a `partials/header.html` override for the picker. Give the search dialog an accessible name (`aria-label="Search"`); Material leaves it unnamed.
- **White:** `paper` bar, 1.5px `ink` keyline bottom, `keycap` buttons.
- **Editorial:** `paper` bar over a 3px double rule; search is an underline field; buttons are square with a hard `offset`.
- **Stationery:** `leather-dark` bar with two lines of `gilt` stitching (`stroke-stitch`, inset 7px); the name in `gilt` small caps; cream buttons with a 1px `gilt` outline.
- **Focus in Stationery:** links on the bar use `focus-on-leather`. The cream search field and buttons use a `focus-on-cream` ring with a `focus-on-leather` halo, so the ring contrasts with the field and the halo with the leather. The pen ring measured 1.01–1.46:1 here.
- The Pen button shows the current pair: a `highlight` stripe under an `accent` dot.
- Do: keep every button at least 44px tall; wrap the row on narrow screens.
- Don't: add gradients or brass effects to the Stationery buttons; on e-ink they must be one grey.
