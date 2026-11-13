# Dialog

A modal question over the page: one title, what answering it changes, and two or three answers.
Use it only when going on without an answer would do something the reader has to agree to first.

- **Consumer provides:** the title as a question (`il-dialog__title`), an optional label above it
  (`il-label`), the body (`il-dialog__body`: what changes, in plain words, with a list or a table
  where there are several things), and the answers (`il-dialog__actions`). The answer that goes
  ahead is `il-btn il-btn--primary` and says what it does ("Confirm and resume", not "OK"); the
  other keeps things as they are and says so. Closing the dialog is the same as that answer.
- **Markup:** `il-dialog-scrim` around `section.il-dialog` with `role="dialog"`,
  `aria-modal="true"` and `aria-labelledby` naming the title. Focus moves to the dialog and stays in
  it; Escape answers with the answer that changes nothing.
- **Scrim:** the page dims behind it (`grey-0` at 45%). On e-ink it is one flat `shade`, so the
  panel draws two greys and no ghost of the page through it.
- **Voice:** the sheet takes the voice's card edge: White `keycap` under a 1.5px `ink` keyline,
  Editorial the hard `offset`, Stationery the `card-stack` on `radius-paper`. The rule under the
  title is the voice's title rule; the rule above the answers its row rule.
- **Phone:** below 560px the sheet fills the width less `space-4`, and the answers stack, the one
  that goes ahead on top, each full width and at least 44px high.
- **Primary button:** `il-btn--primary` is `accent` behind `on-accent` and 600 weight, so it is
  told from the other answers by weight as well as fill (on e-ink: black with white text).
- Do: put a warning inside the body as an Admonition, with its way out.
- Don't: stack a dialog on a dialog, or use one for news that asks for nothing.
