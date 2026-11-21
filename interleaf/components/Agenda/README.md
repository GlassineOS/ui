# Agenda

The hours of a day as rules, timed events as keyline blocks with their time, all-day events above
the hours, and a now line. Times come only from the agenda itself: an event moves in 30-minute
steps by dragging it, and its length by dragging its lower edge. A title is the person's ink.

- **Consumer provides:** the all-day row (`il-agenda__allday`), one `il-agenda__hour` per hour
  with its label in `b`, the events (`il-agenda__ev`, placed by `top`/`height` from the hour
  pitch) with the title ink and the time in `il-agenda__when`, the now line (`il-agenda__now`),
  and a count for events outside the shown hours (`il-agenda__edge`, "2 later").
- **While held:** `is-held` (a 3px edge; no fill behind the ink) and an `is-ghost` (dashed)
  where it was. No animation; each step redraws only the strip the block leaves and enters.
- **White:** a 1.5px edge. **Editorial:** 1px with a 3px rule on the left. **Stationery:** a 1px
  `ink-soft` edge, 3px corners.
- **E-ink:** the hour pitch may shrink to a minimum; below it the agenda shows a window of hours
  and counts the rest at its edge.
- Don't: ask for times in handwriting, or move an event without the drag look.
- **In libglassine-ui:** yes; Home's "Next" widget and a calendar app draw the same hours.
