# CodeBlock

Fenced code with an optional title and a copy button (Material `content.code.copy`, `title=`, `hl_lines=`).

- **Consumer provides:** the fence, an optional `title` and highlighted lines.
- **Highlighting:** by weight and slant only. Keywords `.k` 600, comments `.c` italic `ink-soft`, highlighted lines `.hl` on `highlight`. No syntax colours, so code reads the same on e-ink.
- **White:** `sheet` with a 1.5px `ink` keyline and `radius-ui`; a dotted rule under the title.
- **Editorial:** square, 1px `ink` frame, hairline under the title.
- **Stationery:** an index card on `paper`, a red rule (`index-red`) under the title, and ruled `index-line`s every 28px that the code sits on. The lines switch off on e-ink.
- Do: keep long lines scrolling inside the block (`overflow-x: auto`), never the page.
