# GlassineOS/ui

The look of the GlassineOS desktop in one place: the three voices (White, Editorial, Stationery) as
design tokens, and the drawing code built on them.

- **Tokens:** one source for every voice's colours, type, rules and boxes, from the Interleaf design
  system on the e-ink scheme. Everything else is generated from it.
- **C library:** cairo + pango drawing in the voices (boxes, rules, text, icons), for native programs
  such as the shell and Home.
- **Python module:** the same for the GTK/cairo programs, such as Settings and first-run setup.

**Status:** empty. The code moves here from `GlassineOS/shell`, which holds the C drawing code and two
generated Python copies of the voices today.

## Build and test

```
make check
```

## Licence

GPL-2.0-or-later (`LICENSE`).
