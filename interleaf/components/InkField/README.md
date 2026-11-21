# Ink field

A handwriting field: ruled lines, the person's own ink on them in `pen`, and one empty line kept
to write in. Words the person typed in text mode are set in their own font (Autograph) in place;
the other words keep their ink. In text mode the field is an ordinary text input.

- **Consumer provides:** the ink (strokes or a rendering of them) in `il-inkfield__ink`, the
  set words marked `is-set`, the empty line (`il-inkfield__line is-empty`), and in text mode an
  `input` or `textarea` with class `il-inkfield__text` and a label.
- **Never** shows the recognised text in ink mode: what the program reads stays behind the ink.
- **White:** dotted `rule` lines. **Editorial / Stationery:** the same lines; the voice changes
  only the type of the text-mode field.
- **E-ink:** writing refreshes only the ink's own box; the field does not lay out again while the
  pen is down or for a pause after it lifts.
- Do: keep one empty line at the end, always.
- Don't: mark the set words with a fill or an underline, or put program text in `pen`.
- **In libglassine-ui:** the frame (lines, the empty line, the text-mode box). The ink and the
  reading belong to the writing regions and their client.
