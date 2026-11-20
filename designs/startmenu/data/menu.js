/* The start menu's texts, icons and sample record (GlassineOS/loader spec 004; the
 * deployment list as glassine-deploy writes it into the loader record, each labelled
 * "<version> <date>": the base's image version, YYYY.MM.DD, and the day the deployment
 * was made; where two labels would read the same, both also carry the time it was made,
 * "HH:MM", or "HH:MM:SS" when the minute matches too). The loader's menu follows these
 * boards: every text, icon and size here is the one it draws. */
window.STARTMENU = (function () {
  /* Icons: strokes on a 24-unit grid, 1.5 units wide, round ends, no fill (Interleaf:
   * stroke icons in ink). The loader draws each as a 96-pixel mask (6-pixel strokes). */
  var icons = {
    previous: 'M5.2 9.2A7.5 7.5 0 1 1 4.5 12M4.6 4.8v4.6h4.6M12 8v4l2.8 1.8',
    more: 'M8 4.5h9.5a2 2 0 0 1 2 2V17M6.5 7.5h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z',
    kernel: 'M8.5 7h7a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 15.5v-7A1.5 1.5 0 0 1 8.5 7zM10 4v3M14 4v3M10 17v3M14 17v3M4 10h3M4 14h3M17 10h3M17 14h3',
    other: 'M8.5 3h7a2.5 2.5 0 0 1 2.5 2.5v13a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 18.5v-13A2.5 2.5 0 0 1 8.5 3zM11 17.5h2',
    recovery: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17zM12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM6 6l3.5 3.5M18 6l-3.5 3.5M6 18l3.5-3.5M18 18l-3.5-3.5',
    deployment: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8.5 8h7M8.5 12h7M8.5 16h4',
    back: 'M19 12H5M11 6l-6 6l6 6',
    clock: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17zM12 7.5V12l3 2'
  };

  /* The sample record, in the form glassine-deploy writes (GlassineOS/boot
   * docs/boot-partition.md, deploy<n>). The two kept ones of 28 October share a base
   * and a day, so their labels carry the time. */
  var record = {
    previous: '2026.11.12 2026-11-15',
    more: [
      { state: 'candidate', label: '2026.11.18 2026-11-18' },
      { state: 'failed', label: '2026.11.16 2026-11-16' },
      { state: 'kept', label: '2026.11.01 2026-11-01' }
    ],
    manyKept: ['2026.10.28 2026-10-28 09:12', '2026.10.28 2026-10-28 16:40', '2026.10.20 2026-10-20', '2026.10.02 2026-10-12']
  };

  /* One card per entry: the icon, the name (the entry's own word) and one plain line
   * about what it does. The loader logs its entries by their old labels; only what is
   * drawn is here. */
  function main(opts) {
    var o = opts || {};
    var out = [
      { id: 'glassineos', icon: 'mark', name: 'GlassineOS', line: 'The usual start, chosen for you', isDefault: true },
      { id: 'previous', icon: 'previous', name: 'Previous deployment', line: record.previous + ' · as before the last update' },
      { id: 'more', icon: 'more', name: 'More deployments', line: 'Other versions kept on this device' }
    ];
    if (o.kernel) out.push({ id: 'kernel', icon: 'kernel', name: 'Previous kernel', line: 'The kernel from before the last update' });
    if (o.android) out.push({ id: 'android', icon: 'other', name: 'Android', line: 'Start Android this once' });
    out.push({ id: 'recovery', icon: 'recovery', name: 'Recovery', line: 'Repair, reset or back up GlassineOS' });
    return out;
  }

  var stateLine = {
    candidate: 'New, not started yet',
    failed: 'Didn’t finish starting last time',
    kept: 'Kept on this device'
  };

  function more(opts) {
    var o = opts || {};
    var list = record.more.slice();
    if (o.many) record.manyKept.forEach(function (l) { list.push({ state: 'kept', label: l }); });
    var out = list.map(function (d, i) {
      return { id: 'deploy' + i, icon: 'deployment', name: d.label, line: stateLine[d.state] };
    });
    out.push({ id: 'back', icon: 'back', name: 'Back', line: 'To the start menu' });
    return out;
  }

  var text = {
    title: 'Start GlassineOS',
    titleMore: 'More deployments',
    reason: {
      request: 'Choose how to start.',
      failed: 'The last start didn’t finish, so this menu opened. Choose how to start this time.',
      more: 'Choose a version to start once.'
    },
    foot: 'If you don’t choose, GlassineOS starts by itself in a minute.',
    lineNoTouch: 'Starts by itself in a minute',
    footNoTouch: 'Touch isn’t working this time. GlassineOS starts by itself in a minute.',
    footCut: 'Older versions that don’t fit here stay kept.',
    footPc: '\u2191 \u2193 to choose, Enter to start, Esc to close the list.'
  };

  return { icons: icons, record: record, main: main, more: more, text: text };
})();
