/* The planner's boards (GlassineOS/planner spec 001): sample entries, templates, the fluid
 * grid and the synthetic ink. Every entry is made up. The ink is set in Kalam with a wobble
 * per word (as the handwriting boards do), never anyone's writing; Autograph, the person's
 * font, is stood in for by the same face set straight on the line.
 *
 * window.PLANNER.page(opts) returns everything one screen draws: the bar, the widgets with
 * their rectangles and content, the hidden counts, and the overlays. */
(function () {
  'use strict';
  const P = {};

  /* ---------- The sample month: March, the 1st a Monday (no year). Today: Thursday 11. ---------- */
  const DOW = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DOW2 = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const DOW3 = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MONTH = { name: 'March', days: 31, first: 0, today: 11 };
  const WEEK = { n: 10, from: 8, to: 14 }; // the week of today
  const wd = d => (MONTH.first + d - 1) % 7;
  P.DOW = DOW; P.DOW2 = DOW2; P.MONTH = MONTH; P.WEEK = WEEK;

  /* ---------- Entries: keyed by date or period, kind and (for notes) slot (FR-020, FR-022) ---------- */
  // events: day, start and end in half hours from 0:00 (all-day when allDay)
  const EV = [
    { id: 'e1', day: 11, s: 14, e: 15, t: 'run' },
    { id: 'e2', day: 11, s: 19, e: 21, t: 'team call' },
    { id: 'e3', day: 11, s: 28, e: 30, t: 'dentist' },
    { id: 'e4', day: 11, s: 35, e: 36, t: 'pick up the parcel' },
    { id: 'e5', day: 11, allDay: true, t: 'bin day' },
    { id: 'e6', day: 8, s: 36, e: 38, t: 'yoga' },
    { id: 'e7', day: 9, s: 24, e: 25, t: 'haircut' },
    { id: 'e8', day: 10, s: 32, e: 33, t: 'call the landlord' },
    { id: 'e9', day: 12, s: 40, e: 44, t: 'cinema' },
    { id: 'e10', day: 13, s: 18, e: 22, t: 'market' },
    { id: 'e11', day: 14, s: 25, e: 28, t: 'lunch at home' },
    { id: 'e12', day: 9, s: 17, e: 18, t: 'dentist check' },
    { id: 'e13', day: 2, s: 20, e: 22, t: 'plumber' },
    { id: 'e14', day: 5, s: 38, e: 41, t: 'book club' },
    { id: 'e15', day: 17, s: 12, e: 17, t: 'flight' },
    { id: 'e16', day: 19, s: 39, e: 44, t: 'concert' },
    { id: 'e17', day: 23, s: 30, e: 31, t: 'eye test' },
    { id: 'e18', day: 26, allDay: true, t: 'visitors' },
    { id: 'e19', day: 27, allDay: true, t: 'visitors' },
    { id: 'e20', day: 30, allDay: true, t: 'rent' },
    { id: 'e21', day: 22, s: 19, e: 20, t: 'team call' },
    { id: 'e22', day: 15, s: 19, e: 20, t: 'team call' },
    { id: 'e23', day: 3, s: 36, e: 38, t: 'yoga' },
    { id: 'e24', day: 24, s: 36, e: 38, t: 'yoga' }
  ];
  // to-dos: of a day, a week or a month, with a done state and an age (older first to go)
  const TODO = {
    day: [
      { t: 'call the bank about the card', read: 'call the bonk about the card', age: 3 },
      { t: 'buy stamps', done: true, age: 2 },
      { t: 'post the letter', age: 1 }
    ],
    week: [
      { t: 'book train tickets', age: 7 },
      { t: 'water the plants', done: true, age: 6 },
      { t: 'pay the gas bill', age: 5 },
      { t: 'return the library books', age: 4 },
      { t: 'fix the bike light', done: true, age: 3 },
      { t: 'order printer ink', age: 2 },
      { t: 'sort the photos', age: 1 }
    ],
    month: [
      { t: 'renew the passport', age: 3 },
      { t: 'plan the garden', age: 2 },
      { t: 'clear the attic', age: 1 }
    ]
  };
  // notes (journal entries) by period and slot; lines separated by |
  const NOTE = {
    day: { morning: 'slept well, a slow start|coffee by the window', evening: 'a long walk after dinner|read two chapters|early to bed|call back about the shelf', notes: 'ask about the parcel|bring the blue folder' },
    week: { notes: 'a quiet week|finish the shelf on Sunday' },
    month: { notes: 'more walks, less screen|start the seedlings' }
  };
  const PRIO = {
    day: ['finish the report', 'call the bank'],
    week: ['finish the report', 'tax papers', 'clean the flat'],
    month: ['tax papers', 'spring cleaning', 'start running again']
  };
  // habit marks: habit -> set of days
  const HABITS = [
    { t: 'read', marks: [1, 2, 3, 5, 6, 8, 9, 10, 11] },
    { t: 'walk', marks: [1, 3, 4, 8, 10] },
    { t: 'water', marks: [2, 5, 9] },
    { t: 'no phone in bed', marks: [1, 2, 4, 5, 6, 7, 8, 9, 10] }
  ];

  /* ---------- Synthetic ink ---------- */
  // A small seeded generator, so every board draws the same ink.
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rnd = seed => () => { seed = (Math.imul(seed ^ (seed >>> 15), 1 | seed) + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 7), 61 | t) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* One line of ink as words. mode: raw (as written), neat (neatened), font (set in Autograph).
     edited: words (by index) the person changed in text mode, set in Autograph in their place.
     The style is an inline transform: a word's wobble off the line, its tilt and slant, its size. */
  P.ink = function (text, opts) {
    const o = opts || {}, mode = o.mode || 'raw', fs = o.fs || 20, edited = o.edited || {};
    const r = rnd(hash(text + (o.salt || '')));
    const k = mode === 'raw' ? 1 : mode === 'neat' ? 0.28 : 0;
    return String(text).split(' ').filter(Boolean).map((t, i) => {
      const dy = (r() * 2 - 1) * fs * 0.16, rot = (r() * 2 - 1) * 3.2, sk = -2 - r() * 12, sz = 0.9 + r() * 0.22, gap = r() * 0.25;
      const set = mode === 'font' || edited[i] != null;
      const word = edited[i] != null ? edited[i] : t;
      const kk = set ? 0 : k;
      const st = 'font-size:' + (fs * (set ? 1 : 1 + (sz - 1) * kk)).toFixed(1) + 'px;transform:translateY(' + (dy * kk).toFixed(1) + 'px) rotate(' + (rot * kk).toFixed(1) +
        'deg) skewX(' + (set ? 0 : mode === 'neat' ? -6 : sk).toFixed(1) + 'deg);margin-right:' + (fs * (0.3 + gap * kk)).toFixed(1) + 'px';
      return { t: word, st, cls: set ? 'pl-w pl-w--set' : 'pl-w' };
    });
  };

  /* ---------- Widgets: what each declares (FR-041) ----------
     Width: min, preferred, weight (from the template), grow. Height: min, and the content's need.
     Two kinds: the agenda compresses (its hour pitch shrinks to a minimum); lists and notes
     truncate (a "+n more" mark), and their minimum keeps room for the mark and one empty row. */
  const ROW = 34, HEAD = 34, MORE = 24, PAD = 10;
  P.ROW = ROW;
  const WG = {
    agenda: { name: 'Day agenda', kind: 'compresses', minW: 200, prefW: 360, minH: c => HEAD + (c.allDay ? 26 : 0) + 6 * 20, needH: c => HEAD + (c.allDay ? 26 : 0) + c.hours * 34 },
    cagenda: { name: 'Day agenda (compact)', kind: 'compresses', minW: 84, prefW: 100, minH: c => 30 + 6 * 16, needH: c => 30 + c.hours * 26 },
    todo: { name: 'To-do list', kind: 'truncates', minW: 180, prefW: 300, minH: () => HEAD + 2 * ROW + MORE, needH: c => HEAD + (c.n + 1) * ROW + PAD },
    notes: { name: 'Notes', kind: 'truncates', minW: 200, prefW: 400, minH: () => HEAD + 2 * ROW + MORE, needH: c => HEAD + Math.max(c.n + 1, 2) * ROW + PAD },
    habits: { name: 'Habit tracker', kind: 'truncates', minW: 240, prefW: 360, minH: () => HEAD + 22 + 2 * 30 + MORE, needH: c => HEAD + 22 + (c.n + 1) * 30 + PAD },
    minimonth: { name: 'Mini month', kind: 'compresses', minW: 170, prefW: 230, minH: () => HEAD + 22 + 6 * 22, needH: () => HEAD + 22 + 6 * 26 },
    weekov: { name: 'Week overview', kind: 'truncates', minW: 260, prefW: 420, minH: () => HEAD + 7 * 30, needH: () => HEAD + 7 * 58 },
    priorities: { name: 'Priorities', kind: 'truncates', minW: 180, prefW: 300, minH: () => HEAD + 2 * ROW + MORE, needH: c => HEAD + (c.n + 1) * ROW + PAD }
  };
  P.WG = WG;

  /* ---------- Templates (several per kind; FR-030) ----------
     A tree of rows and columns; a node may turn from column to row in landscape (land). */
  const T = {
    'day-lists': { kind: 'day', name: 'Agenda and lists', note: 'The hours beside the mini month and the day’s to-dos; the week’s to-dos and notes underneath',
      root: { k: 'col', land: 'row', c: [
        { k: 'row', w: 3, c: [
          { wg: 'agenda', w: 3, grow: true, from: 7, to: 21 },
          { k: 'col', w: 2, c: [{ wg: 'minimonth' }, { wg: 'todo', period: 'day', title: 'Today', grow: true }] }] },
        { k: 'row', land: 'col', w: 1, c: [{ wg: 'todo', period: 'week', title: 'This week', w: 1 }, { wg: 'notes', period: 'day', slot: 'notes', title: 'Notes', grow: true, w: 1 }] }] } },
    'day-diary': { kind: 'day', name: 'Diary', note: 'Priorities and habits on top; the hours beside a morning and an evening slot',
      root: { k: 'col', land: 'row', c: [
        { k: 'row', land: 'col', w: 1, c: [{ wg: 'priorities', period: 'day', title: 'Priorities', w: 1 }, { wg: 'habits', period: 'day', title: 'Habits', w: 1 }] },
        { k: 'row', w: 3, grow: true, c: [
          { wg: 'agenda', from: 7, to: 21, w: 2 },
          { k: 'col', w: 3, c: [{ wg: 'notes', period: 'day', slot: 'morning', title: 'Morning', grow: true }, { wg: 'notes', period: 'day', slot: 'evening', title: 'Evening', grow: true }] }] }] } },
    'day-agenda': { kind: 'day', name: 'Agenda only', note: 'Only the hours: to-dos and notes are kept and counted as hidden',
      root: { k: 'col', c: [{ wg: 'agenda', grow: true, from: 6, to: 23 }] } },
    'week-columns': { kind: 'week', name: 'Seven columns', note: 'A compact agenda per day over the week’s lists',
      root: { k: 'col', c: [
        { k: 'row', w: 3, grow: true, c: [0, 1, 2, 3, 4, 5, 6].map(i => ({ wg: 'cagenda', day: WEEK.from + i, from: 8, to: 21 })) },
        { k: 'row', w: 1, c: [{ wg: 'todo', period: 'week', title: 'This week', w: 2 }, { wg: 'notes', period: 'week', slot: 'notes', title: 'Notes', w: 2 }] }] } },
    'week-spread': { kind: 'week', name: 'Spread', note: 'The days in short on the left, the week’s lists on the right',
      root: { k: 'row', land: 'row', c: [
        { wg: 'weekov', w: 3, grow: true },
        { k: 'col', w: 2, c: [{ wg: 'priorities', period: 'week', title: 'Priorities' }, { wg: 'todo', period: 'week', title: 'This week', grow: true }, { wg: 'habits', period: 'week', title: 'Habits' }] }] } },
    'week-lists': { kind: 'week', name: 'Lists and notes', note: 'No hours: the week’s events are counted as hidden',
      root: { k: 'col', c: [
        { k: 'row', c: [{ wg: 'minimonth', w: 1 }, { wg: 'todo', period: 'week', title: 'This week', w: 2 }] },
        { wg: 'notes', period: 'week', slot: 'notes', title: 'Notes', grow: true }] } },
    'month-grid': { kind: 'month', name: 'Calendar', note: 'The month as a grid of days with their events, its lists beneath',
      root: { k: 'col', land: 'row', c: [
        { wg: 'minimonth', large: true, grow: true, w: 3 },
        { k: 'row', land: 'col', w: 1, c: [{ wg: 'todo', period: 'month', title: 'This month', w: 1 }, { wg: 'priorities', period: 'month', title: 'Priorities', w: 1 }] }] } },
    'month-goals': { kind: 'month', name: 'Goals', note: 'Priorities and habits for the month, a mini month and notes',
      root: { k: 'col', c: [
        { k: 'row', c: [{ wg: 'minimonth', w: 1 }, { wg: 'priorities', period: 'month', title: 'Priorities', w: 2 }] },
        { wg: 'habits', period: 'month', title: 'Habits' },
        { wg: 'notes', period: 'month', slot: 'notes', title: 'Notes', grow: true }] } }
  };
  // editor-only variants: more weight for the agenda; two widgets added (too small to save)
  const clone = x => JSON.parse(JSON.stringify(x));
  T['day-lists-w'] = Object.assign(clone(T['day-lists']), { hidden: true });
  T['day-lists-w'].root.c[0].c[0].w = 4;
  T['day-lists-x'] = Object.assign(clone(T['day-lists']), { hidden: true });
  T['day-lists-x'].root.c[0].c[1].c.push({ wg: 'habits', period: 'day', title: 'Habits' }, { wg: 'priorities', period: 'day', title: 'Priorities' }, { wg: 'weekov', title: 'This week' });
  P.T = T;
  P.byKind = kind => Object.keys(T).filter(id => T[id].kind === kind && !T[id].hidden);

  /* ---------- What a widget shows (content need and rows) ---------- */
  function content(n, view) {
    const per = n.period || view;
    switch (n.wg) {
      case 'agenda': return { hours: n.to - n.from, allDay: EV.some(e => e.day === MONTH.today && e.allDay) };
      case 'cagenda': return { hours: n.to - n.from };
      case 'todo': return { n: (TODO[per] || []).length + (P._add && P._add.settled && per === 'day' ? 1 : 0) };
      case 'notes': return { n: ((NOTE[per] || {})[n.slot] || '').split('|').filter(Boolean).length };
      case 'habits': return { n: HABITS.length };
      case 'priorities': return { n: (PRIO[per] || []).length };
      default: return {};
    }
  }

  /* ---------- The fluid grid ----------
     Along a row: widths from declarations. Along a column: heights from content. Three steps:
     every child gets its minimum; then it grows towards its need, by weight; the rest goes to
     the children marked grow (by weight). Nothing is ever below its minimum: when the space
     can't hold the minimums, the layout reports it (the editor says so before saving). */
  function measure(n, view, axis, empty) {
    if (n.wg) {
      const d = WG[n.wg], c = empty ? emptyContent(n) : content(n, view);
      if (axis === 'w') return { min: d.minW, need: n.large ? d.prefW + 400 : d.prefW }; // the month grid wants room for ink in each day
      const min = d.minH(c), need = Math.max(min, d.needH(c));
      return { min, need: n.large ? need + 300 : need };
    }
    const kids = n.c.map(ch => measure(ch, view, axis, empty));
    const along = (n.k === 'row') === (axis === 'w');
    const G = 10 * Math.max(0, kids.length - 1);
    if (along) return { min: kids.reduce((a, b) => a + b.min, 0) + G, need: kids.reduce((a, b) => a + b.need, 0) + G };
    return { min: Math.max(...kids.map(k => k.min)), need: Math.max(...kids.map(k => k.need)) };
  }
  function emptyContent(n) { return n.wg === 'agenda' || n.wg === 'cagenda' ? { hours: n.to - n.from } : { n: 0 }; }
  function share(total, items) {
    const s = items.map(i => i.min);
    let R = total - s.reduce((a, b) => a + b, 0);
    const short = R < 0;
    for (let pass = 0; pass < 8 && R > 0.5; pass++) {
      const act = items.map((it, i) => s[i] < it.need ? i : -1).filter(i => i >= 0);
      if (!act.length) break;
      const W = act.reduce((a, i) => a + items[i].w, 0);
      let used = 0;
      for (const i of act) { const add = Math.min(R * items[i].w / W, items[i].need - s[i]); s[i] += add; used += add; }
      R -= used;
    }
    if (R > 0.5) {
      const g = items.map((it, i) => it.grow ? i : -1).filter(i => i >= 0);
      const W = g.reduce((a, i) => a + items[i].w, 0);
      for (const i of g) s[i] += R * items[i].w / W;
      if (g.length) R = 0;
    }
    return { s, short, deficit: short ? -R : 0, left: Math.max(0, R) };
  }
  function place(n, x, y, w, h, view, land, out, empty, path) {
    if (n.wg) { out.push({ n, x, y, w, h, path }); return; }
    const kind = land && n.land ? n.land : n.k;
    const axis = kind === 'row' ? 'w' : 'h';
    const total = (axis === 'w' ? w : h) - 10 * (n.c.length - 1);
    const items = n.c.map(ch => {
      const m = measure(ch, view, axis, empty);
      return { min: m.min, need: axis === 'w' ? m.need : m.need, w: ch.w || 1, grow: !!ch.grow || (axis === 'w') };
    });
    // widths: every child may grow along a row (weights share the rest); heights: only "grow"
    if (axis === 'h') n.c.forEach((ch, i) => { items[i].grow = !!ch.grow || hasGrow(ch); });
    const r = share(total, items);
    if (r.short) { out.short = true; out.deficit = Math.max(out.deficit || 0, Math.round(r.deficit)); }
    let p = axis === 'w' ? x : y;
    n.c.forEach((ch, i) => {
      const sz = Math.max(items[i].min, r.s[i]);
      if (axis === 'w') place(ch, Math.round(p), y, Math.round(sz), h, view, land, out, empty, path + '.' + i);
      else place(ch, x, Math.round(p), w, Math.round(sz), view, land, out, empty, path + '.' + i);
      p += sz + 10;
    });
  }
  const hasGrow = n => !!n.grow || (n.c || []).some(hasGrow);
  P.layout = function (tid, W, H, opts) {
    const o = opts || {}, t = T[tid], out = [];
    place(t.root, 0, 0, W, H, t.kind, !!o.land, out, !!o.empty, 'r');
    return out;
  };

  /* ---------- Hidden entries (FR-028): what the period holds that no widget shows ---------- */
  function shown(tid) {
    const S = new Set();
    const walk = n => { if (n.wg) {
      if (n.wg === 'agenda' || n.wg === 'cagenda' || n.wg === 'weekov' || (n.wg === 'minimonth' && n.large)) S.add('event');
      if (n.wg === 'todo') S.add('todo:' + n.period);
      if (n.wg === 'notes') S.add('note:' + n.period + ':' + n.slot);
      if (n.wg === 'priorities') S.add('prio:' + n.period);
      if (n.wg === 'habits') S.add('habit');
      if (n.wg === 'weekov') S.add('todo:day');
    } else n.c.forEach(walk); };
    walk(T[tid].root);
    return S;
  }
  P.hidden = function (tid) {
    const kind = T[tid].kind, S = shown(tid), out = [];
    const evs = kind === 'day' ? EV.filter(e => e.day === MONTH.today) : kind === 'week' ? EV.filter(e => e.day >= WEEK.from && e.day <= WEEK.to) : EV;
    if (!S.has('event') && evs.length) out.push({ n: evs.length, kind: 'event', one: 'event', many: 'events', items: evs.slice(0, 6).map(e => ({ t: e.t, when: e.allDay ? 'all day' : hm(e.s) + '–' + hm(e.e) + (kind === 'day' ? '' : ' · ' + DOW3[wd(e.day)] + ' ' + e.day) })) });
    const per = kind;
    if (!S.has('todo:' + per) && TODO[per]) out.push({ n: TODO[per].length, kind: 'todo', one: 'to-do', many: 'to-dos', items: TODO[per].map(x => ({ t: x.t, when: x.done ? 'done' : '' })) });
    if (kind === 'day' && !S.has('todo:week') && false) out.push({});
    for (const slot of Object.keys(NOTE[per] || {})) if (!S.has('note:' + per + ':' + slot)) {
      const lines = NOTE[per][slot].split('|');
      out.push({ n: 1, kind: 'note', slot, one: (slot === 'notes' ? 'note' : slot + ' note'), many: slot + ' notes', items: [{ t: lines[0], when: SLOTNAME[slot] }] });
    }
    if (!S.has('prio:' + per) && PRIO[per]) out.push({ n: PRIO[per].length, kind: 'prio', one: 'priority', many: 'priorities', items: PRIO[per].map((t, i) => ({ t, when: String(i + 1) })) });
    const inP = d => kind === 'day' ? d === MONTH.today : kind === 'week' ? d >= WEEK.from && d <= WEEK.to : true;
    const marks = HABITS.map(h => ({ t: h.t, n: h.marks.filter(inP).length })).filter(h => h.n);
    if (!S.has('habit') && marks.length) out.push({ n: marks.reduce((a, h) => a + h.n, 0), kind: 'habit', one: 'habit mark', many: 'habit marks', items: marks.map(h => ({ t: h.t, when: kind === 'day' ? 'marked' : h.n + ' days' })) });
    return out.map(h => ({ ...h, label: h.n + ' ' + (h.n === 1 ? h.one : h.many) }));
  };
  const SLOTNAME = { morning: 'morning', evening: 'evening', notes: 'notes' };
  const hm = hh => String(Math.floor(hh / 2)).padStart(2, '0') + ':' + (hh % 2 ? '30' : '00');
  P.hm = hm;

  /* ---------- Widget content for drawing ---------- */
  // rows that fit: lists keep one empty row; rows hide in this order: done, then the oldest open.
  P.fitRows = function (items, cap) {
    if (items.length + 1 <= cap) return { rows: items.slice(), more: 0 };
    const keep = Math.max(0, cap - 1); // the empty row stays
    const order = items.map((x, i) => ({ x, i })).sort((a, b) => (b.x.done ? 1 : 0) - (a.x.done ? 1 : 0) || (b.x.age || 0) - (a.x.age || 0));
    const drop = new Set(order.slice(0, items.length - keep).map(o => o.i));
    return { rows: items.filter((x, i) => !drop.has(i)), more: drop.size };
  };
  function widget(r, view, o) {
    let n = r.n;
    const d = WG[n.wg], per = n.period || view, empty = !!o.empty;
    const base = { x: r.x, y: r.y, w: r.w, h: r.h, kind: n.wg, title: n.title || d.name, tag: n.slot ? 'slot · ' + n.slot : n.period ? 'of the ' + n.period : '', path: r.path, sel: o.sel === r.path };
    const fs = o.fs || 19;
    const inkMode = o.inkMode || 'raw';
    const ink = (t, extra) => P.ink(t, Object.assign({ fs, mode: inkMode }, extra || {}));
    if (n.wg === 'todo' || n.wg === 'priorities') {
      let src = empty ? [] : n.wg === 'todo' ? (TODO[per] || []) : (PRIO[per] || []).map((t, i) => ({ t, age: 10 - i }));
      const add = o.add && n.wg === 'todo' && per === 'day' ? o.add : null;
      if (add && add.settled) src = src.concat([{ t: add.t, age: 0 }]);
      const cap = Math.max(1, Math.floor((r.h - HEAD - PAD + 3) / ROW));
      const capM = Math.max(1, Math.floor((r.h - HEAD - MORE + 3) / ROW));
      let f = P.fitRows(src, cap);
      if (f.more) f = P.fitRows(src, capM);
      const rows = f.rows.map((x, i) => ({ words: ink(x.t, o.edit && o.edit.t === x.t ? { edited: o.edit.words } : null), done: !!x.done, num: String(src.indexOf(x) + 1), cls: 'pl-row' + (x.done ? ' is-done' : ''), text: o.textMode, value: o.edit && o.edit.t === x.t ? o.edit.value : (x.read || x.t) }));
      rows.push({ words: add && !add.settled ? ink(add.partial) : [], done: false, num: String(src.length + 1), cls: 'pl-row is-empty', empty: true, text: false });
      return Object.assign(base, { list: rows, more: f.more, moreLabel: '+' + f.more + ' more', numbered: n.wg === 'priorities', ticks: n.wg === 'todo' });
    }
    if (n.wg === 'notes') {
      const lines = empty ? [] : ((NOTE[per] || {})[n.slot] || '').split('|').filter(Boolean);
      const cap = Math.max(1, Math.floor((r.h - HEAD - PAD + 3) / ROW));
      let shownL = lines, more = 0;
      if (lines.length + 1 > cap) { shownL = lines.slice(0, Math.max(0, cap - 2)); more = lines.length - shownL.length; }
      const rows = shownL.map(t => ({ words: ink(t), cls: 'pl-line' }));
      const lineCount = Math.max(1, Math.floor((r.h - HEAD - (more ? MORE : 0) - PAD) / ROW));
      const guides = []; for (let i = 0; i < lineCount; i++) guides.push({ y: (i + 1) * ROW - 6 });
      return Object.assign(base, { lines: rows, guides, more, moreLabel: '+' + more + ' more lines' });
    }
    if (n.wg === 'habits') {
      const days = per === 'day' ? [MONTH.today] : per === 'week' ? [8, 9, 10, 11, 12, 13, 14] : Array.from({ length: Math.min(MONTH.days, Math.floor((r.w - 120) / 15)) }, (_, i) => i + 1);
      const cap = Math.max(1, Math.floor((r.h - HEAD - 22 - PAD + 3) / 30));
      const src = empty ? [] : HABITS;
      const f = src.length + 1 <= cap ? { rows: src, more: 0 } : { rows: src.slice(0, Math.max(0, cap - 2)), more: src.length - Math.max(0, cap - 2) };
      const cw = per === 'month' ? 15 : per === 'day' ? 40 : 26;
      return Object.assign(base, { cw, heads: days.map(dd => ({ t: per === 'month' ? (dd % 5 === 1 ? String(dd) : '') : per === 'day' ? 'today' : DOW2[wd(dd)], today: dd === MONTH.today })),
        habits: f.rows.map(h => ({ words: ink(h.t, { fs: fs - 2 }), cells: days.map(dd => ({ cls: 'pl-hab' + (h.marks.includes(dd) ? ' is-on' : '') + (dd > MONTH.today ? ' is-ahead' : '') })) })).concat([{ words: [], cells: [], add: true }]),
        more: f.more, moreLabel: '+' + f.more + ' more habits' });
    }
    if (n.wg === 'minimonth') {
      const large = !!n.large;
      const cells = [];
      for (let i = 0; i < MONTH.first; i++) cells.push({ t: '', cls: 'pl-mm-d is-out', evs: [] });
      for (let dd = 1; dd <= MONTH.days; dd++) {
        const evs = empty ? [] : EV.filter(e => e.day === dd);
        const inWeek = dd >= WEEK.from && dd <= WEEK.to;
        let shownE = [], more = 0;
        if (large) { const capE = Math.max(0, Math.floor(((r.h - HEAD - 22) / 6 - 22) / 20)); shownE = evs.slice(0, capE); more = evs.length - shownE.length; }
        cells.push({ t: String(dd), cls: 'pl-mm-d' + (dd === MONTH.today ? ' is-today' : '') + (evs.length ? ' has' : '') + (inWeek && view === 'week' ? ' in-week' : ''),
          dot: !large && evs.length > 0, evs: shownE.map(e => ({ words: ink(e.t, { fs: 14, salt: e.id }) })), more: more > 0, moreLabel: '+' + more });
      }
      while (cells.length % 7) cells.push({ t: '', cls: 'pl-mm-d is-out', evs: [] });
      return Object.assign(base, { large, title: large ? MONTH.name : n.title || MONTH.name, tag: '', heads: DOW2.map(t => ({ t })), cells, rows: cells.length / 7 });
    }
    if (n.wg === 'weekov') {
      const rowH = (r.h - HEAD - PAD) / 7;
      const days = [0, 1, 2, 3, 4, 5, 6].map(i => {
        const dd = WEEK.from + i, evs = empty ? [] : EV.filter(e => e.day === dd);
        const cap = Math.max(1, Math.floor((rowH - 4) / 22));
        const sh = evs.slice(0, cap);
        return { name: DOW3[i], num: String(dd), today: dd === MONTH.today, cls: 'pl-wk-day' + (dd === MONTH.today ? ' is-today' : ''), h: Math.floor(rowH),
          evs: sh.map(e => ({ when: e.allDay ? 'all day' : hm(e.s), words: ink(e.t, { fs: 16, salt: e.id }) })), more: evs.length - sh.length, moreLabel: '+' + (evs.length - sh.length) + ' more' };
      });
      return Object.assign(base, { title: 'Week ' + WEEK.n, days });
    }
    if (n.wg === 'agenda' || n.wg === 'cagenda') {
      const compact = n.wg === 'cagenda', day = n.day || MONTH.today;
      const top = (!compact && EV.some(e => e.day === day && e.allDay) && !empty ? 30 : 6);
      // compresses: the hour pitch shrinks to its minimum; below that, a window of hours around
      // now, and the events outside it as a count at the top or bottom edge
      const minP = compact ? 16 : 20, avail = r.h - HEAD - top - 6, span = n.to - n.from;
      let pitch = avail / span, ws = n.from, we = n.to;
      if (pitch < minP) { pitch = minP; const vis = Math.max(1, Math.floor(avail / minP)); ws = Math.max(n.from, Math.min(n.to - vis, 13)); we = ws + vis; }
      const hrs = [];
      for (let hh = ws; hh <= we; hh++) hrs.push({ t: compact ? (hh % 3 === 0 ? String(hh) : '') : String(hh).padStart(2, '0'), y: Math.round(top + (hh - ws) * pitch), half: Math.round(top + (hh - ws + 0.5) * pitch), last: hh === we });
      const evs = (empty ? [] : EV.filter(e => e.day === day && !e.allDay)).map(e => Object.assign({}, e, o.move && o.move.id === e.id ? { s: o.move.s, e: o.move.e } : {}));
      const inside = evs.filter(e => e.e > ws * 2 && e.s < we * 2);
      const before = evs.filter(e => e.e <= ws * 2).length, after = evs.filter(e => e.s >= we * 2).length;
      n = Object.assign({}, n, { from: ws, to: we });
      const blocks = inside.map(e => {
        const y1 = top + (Math.max(e.s, n.from * 2) / 2 - n.from) * pitch, y2 = top + (Math.min(e.e, n.to * 2) / 2 - n.from) * pitch;
        return { id: e.id, y: Math.round(y1) + 1, h: Math.max(8, Math.round(y2 - y1) - 2), words: compact ? ink(e.t, { fs: 13, salt: e.id }) : ink(e.t, { fs: Math.min(fs, Math.max(14, (y2 - y1) - 8)), salt: e.id }),
          when: hm(e.s) + '–' + hm(e.e), cls: 'pl-ev' + (y2 - y1 < 24 ? ' is-short' : '') };
      });
      const allDay = compact || empty ? [] : EV.filter(e => e.day === day && e.allDay).map(e => ({ words: ink(e.t, { fs: 15, salt: e.id }) }));
      return Object.assign(base, { compact, title: compact ? DOW2[wd(day)] + ' ' + day : 'Agenda', tag: compact ? '' : hm(n.from * 2) + '–' + hm(n.to * 2), today: day === MONTH.today, hrs, blocks, allDay, hasAllDay: allDay.length > 0,
        before, after, beforeLabel: compact ? '↑' + before : '↑ ' + before + ' earlier', afterLabel: compact ? '↓' + after : '↓ ' + after + ' later', pitch, top, from: n.from });
    }
    return base;
  }

  /* ---------- One screen ---------- */
  P.page = function (o) {
    const tid = o.tmpl, t = T[tid], view = t.kind, land = !!o.land;
    const W = o.W, H = o.H;
    P._add = o.add || null;
    const rects = P.layout(tid, W, H, { land, empty: o.empty });
    P._add = null;
    const widgets = rects.map(r => widget(r, view, o));
    return { widgets, short: !!rects.short, deficit: rects.deficit || 0, hidden: o.empty ? [] : P.hidden(tid), view, title: P.title(view), t };
  };
  P.title = function (view) {
    if (view === 'day') return { main: DOW[wd(MONTH.today)] + ' ' + MONTH.today, sub: MONTH.name + ' · week ' + WEEK.n };
    if (view === 'week') return { main: 'Week ' + WEEK.n, sub: WEEK.from + '–' + WEEK.to + ' ' + MONTH.name };
    return { main: MONTH.name, sub: '5 weeks' };
  };
  P.data = { EV, TODO, NOTE, PRIO, HABITS };
  window.PLANNER = P;
})();
