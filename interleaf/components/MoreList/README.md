# More list

Rows under rules that never scroll: when a list has more rows than room, it shows what fits, keeps
one empty row to write in, and ends with a quiet "+n more" that opens the whole list. Nothing is
lost: the count is the way to every hidden row.

- **Consumer provides:** the rows (`li`, a tick `il-morelist__tick` for to-dos, the row's ink as
  an `il-inkfield__ink`), `is-done` on done rows, and the link `il-morelist__more` with the count
  in words ("+3 more").
- **Which rows give way:** done rows first, then the oldest open ones; the empty row stays.
- **White:** square ticks with a 1.5px edge. **Editorial:** the same with 1px rules.
  **Stationery:** round ticks with a 1px edge.
- **E-ink:** a done row is told by the filled tick and the line through the ink, not by grey ink.
- Do: say the number in the link; let the link open the whole list in one refresh.
- Don't: shrink the rows to make them fit, or hide the empty row.
- **In libglassine-ui:** yes; Home's lists and Settings' long lists truncate the same way.
