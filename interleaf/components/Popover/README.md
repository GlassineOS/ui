# Popover

A quiet icon button and the card it opens under itself: a few details about what is on screen and
a few rows that lead on. It replaces a permanent status line: the details are one tap away, and
the screen keeps its space. A tool button in the card's head (the Cog menu's cog) may turn the same
card into a menu, with a back button in its head.

- **Consumer provides:** the button (`il-iconbtn`, an `svg` in `currentColor`, `aria-label` that
  says what is inside, `aria-expanded`, `aria-controls`), an optional count
  (`il-iconbtn__count`, also said in the label), and the card (`il-popover`, `role="dialog"`): a
  head (`il-popover__head` with `il-popover__label` and any tool button), details as a `dl` of
  `il-popover__fact`, a section label (`il-popover__section`) and rows (`il-popover__row`, links
  with an icon, the words and a chevron).
- **The count:** a small number for something the person should know without opening the card
  (for the planner: entries the layout doesn't show). It changes only when the number does.
- **White:** a card edge; the button has no edge until open. **Editorial:** 1px edges.
  **Stationery:** a 1px `ink` edge with the shade below.
- **E-ink:** one rectangle refresh opens it and one closes it; turning it into a menu redraws only
  its own rectangle. Nothing slides or fades.
- Do: put the button at the end of a bar, apart from the navigation groups.
- Don't: give the closed button an edge, or put actions that change data in the details.
- **In libglassine-ui:** yes; Home and Settings can hold a page's details the same way.
