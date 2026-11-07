# SectionHeading

The page title block (eyebrow, h1, lead) and numbered h2s. The numbers come from a CSS counter, so the markdown stays plain `##`.

- **Consumer provides:** headings only. Wrap the content in `.il-sections` (in MkDocs: `.md-typeset`) to reset the counter.
- **White:** circled numerals in the hand (`hand`, 700) in `pen`; at 1200px and wider they hang in the left margin (`.il-hang`).
- **Editorial:** `§ 1` in italic `pen`, the h2 under a 1px rule; the title sits on a 3px double rule; the lead opens with a drop cap in `accent`.
- **Stationery:** `I.` `II.` in italic `gold`, always inline; h2 in small caps (`st-section`); the title in italic over a double `gold` rule.
- Do: number only h2s, and only on pages whose sections are a real sequence (guides, decisions). Turn the counter off for reference pages.
- Don't: hang numerals on narrow screens; they sit on the heading line below 1200px.
