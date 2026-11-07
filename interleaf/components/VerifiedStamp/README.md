# VerifiedStamp

Shows the docs' core rule, that every hardware fact carries a verification date, as a stamp you can find while scanning.

- **Consumer provides:** a paragraph with the device and an ISO date, marked `{ .gl-verified }` (attr_list). Without the class it renders as plain bold text, so it degrades safely.
- **White:** a `highlight` pill sticker with an `ink` keyline, tilted −1.5°, Plex Mono caps.
- **Editorial:** a square 1px `accent` box with small-caps text, no tilt.
- **Stationery:** a 26px `gold` ring seal followed by small-caps `gold` text. Flat, no foil.
- **Untested** (`from source, untested`): dashed outline in `ink-soft` in every voice.
- The date is always `ink` in Plex Mono, so it reads the same in every voice.
