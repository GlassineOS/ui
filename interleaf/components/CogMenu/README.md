# Cog menu

One small cog without an edge, in `ink-soft`, and the menu it opens. It holds a program's
maintenance so that its main chrome holds only navigation and content. In the planner it sits in
the head of a Popover, and the menu takes the popover's place.

- **Consumer provides:** the cog button (`il-cog`, an `svg` in `currentColor`, `aria-label`,
  `aria-expanded`), the menu (`il-cogmenu`, an optional head `il-cogmenu__h`), and its rows
  (`il-cogmenu__row`: an icon, the name and one line in `small`). A row that turns something on
  is a `menuitemcheckbox` with `aria-checked` and an `i.il-cogmenu__switch`; a row that opens more
  ends with a chevron. A developer-build row is `is-dev`, under a dashed rule.
- **White:** a card edge. **Editorial:** the card's 1px edge. **Stationery:** a 1px `ink` edge
  with the shade below.
- **E-ink:** one rectangle refresh opens it and one closes it; nothing slides.
- Do: keep it to the few maintenance rows; show developer rows only in developer builds.
- Don't: put the cog in the bar beside the navigation, or give it an edge that makes it look like
  a button of the bar.
- **In libglassine-ui:** yes; any program that hides its maintenance the same way.
