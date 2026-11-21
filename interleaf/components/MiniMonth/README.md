# Mini month

A month as seven columns of days: a dot under days that have entries, today ringed, the shown
week on `highlight`. A tap on a day opens it. At a large size the same grid is the month view,
with each day's entries in ink and "+n" when they run out of room.

- **Consumer provides:** the weekday heads (`il-minimonth__h`), one link per day
  (`il-minimonth__d`, the number in a `span`), `has` on days with entries, `in-week` on the shown
  week, `aria-current="date"` on today, `is-out` on the blank cells before the 1st.
- **White / Editorial / Stationery:** the voice changes the type of the numbers only.
- **E-ink:** the ring and the dot carry today and entries; the week's fill is `grey-12` behind
  `ink`, so it holds on the ladder.
- Do: keep the dot below the number so the number stays readable.
- Don't: tell days apart by fill alone.
- **In libglassine-ui:** yes; a Home calendar widget and the date pickers use it.
