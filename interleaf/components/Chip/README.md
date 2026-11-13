# Chip

A short state label beside a name: the state of a session, a check, a step. One or two words,
optionally a glyph before them and a softer part after them (`il-chip__sub`).

- **Consumer provides:** the state word, a glyph if it helps (`svg` in `currentColor`), and the
  modifier for the kind of state. The word is always there: the edge supports it, never replaces it.
- **Kinds, by edge:** `il-chip` solid (holds), `--moving` dashed (between two states, being
  checked), `--waits` heavy edge on `highlight` (waits for someone: say who in the word),
  `--up` double edge (sent up to someone else), `--over` hairline on `sheet` in `ink-soft`
  (finished, nothing more will happen). `--lg` is the size for a heading.
- **White:** a pill, Plex Mono, 1.5px `ink` edge. **Editorial:** square, small caps, 1px edge.
  **Stationery:** `radius-chip`, Garamond small caps, a 1px `gold` edge; the kinds that ask for
  attention take an `ink` edge.
- **E-ink:** the kinds are told apart by the edge and the word, so they hold on the ladder;
  `highlight` is `grey-12` behind `ink`.
- Do: keep it to one line; a long state goes into the text beside the chip, not into the chip.
- Don't: use the fill as the only difference between two kinds, or put `pen` text in a chip.
