# Details

A collapsible block (`??? info "Title"`, open with `???+`). The summary is a button-like pill that the reader taps to open it.

- **Consumer provides:** a short title (the summary) and the hidden body. Never hide a warning's way out inside a closed block.
- **Colour pairing:** the summary is always `sheet` behind `ink`, two theme-aware tokens that change together. Never give it a fixed text colour over a themed background, or the reverse: that is what made the Stationery Night summary invisible (#2a2420 on #2a241d, 1:1).
- **Specificity:** in MkDocs, Material clears admonition and details title backgrounds with `:is(.admonition, details)[class] > :is(.admonition-title, summary)`. A voice rule must match or beat that selector (`details[class] > summary`), or its background silently disappears.
- **White:** a pill with a 1.5px `ink` outline. **Editorial:** square, italic, hard `offset`. **Stationery:** a `radius-chip` tab on `sheet` with a 1px `gilt` edge, italic.
- The chevron is drawn in `currentColor`, so it always matches the text.
- Minimum height 44px; `focus` ring on `:focus-visible`.
