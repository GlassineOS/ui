# Button

An action on the page: `il-btn`, in its default, pressed and disabled states.

- **Consumer provides:** a `button` with the class `il-btn` and a label that says what it does. A
  toggle carries `aria-pressed`.
- **Default:** `paper` behind `ink`, at least 44px high, with the voice's control edge
  (`v-ui-edge`: White a `keycap`, Editorial a hard `offset` and no fill, Stationery its paper edge).
- **Pressed:** `aria-pressed="true"` fills it with `accent` behind `on-accent`.
- **Disabled:** a button that can't be used now. Its label and icon are in `dim`, it has no fill
  and no edge (no keycap, no offset), and it is outlined with a 1.5px dashed `dim` line. So it
  differs by shape as well as by grey, and on e-ink it is plainly not a key. The pointer shows
  "not allowed". The size stays the same, so nothing moves when it turns on or off.
- **Say why.** A disabled button always says why it can't be used and what would change that, for
  example "Merge: checks running". Put the reason next to it or in a line below, and link it with
  `aria-describedby`.
- **Which attribute:** use `aria-disabled="true"` when the reason matters, which is the usual case.
  The button stays in the tab order, so a keyboard or screen reader user reaches it and hears the
  reason. The page then ignores its clicks. Use the native `disabled` only where nobody needs to
  reach it, for example a step of a form that the next field unlocks. Both look the same.
- **Contrast:** a disabled control is exempt from the WCAG text contrast rule, and the contrast
  check reports it as information only. Its reason is ordinary text and must pass.
- Do: keep a disabled primary button in place and in the same state as its siblings, so the
  layout doesn't change.
- Don't: hide a button that will come back, tell disabled from enabled by grey alone, or disable a
  button without a reason the reader can find.
