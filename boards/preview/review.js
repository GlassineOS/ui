// SPDX-License-Identifier: GPL-2.0-or-later
// The review of a proposal (003 FR-055..FR-057): the boards it adds, changes and removes
// (api/review.json), each compared with the main line's copy (review.json "base") side by side, with
// a divider, faded over each other, or as the regions that differ (the precomputed diffs). "Seen"
// marks live in this browser's localStorage only, keyed by the proposal's address and by each
// board's hash, so a board that changes after it was marked shows as changed since.
(function () {
  'use strict';

  // ---- seen marks: pure, also loaded by the node tests ------------------------------------------
  const Seen = {
    // the storage key of a proposal's marks: its export's path on the site (the part before _boards/)
    key: function (pathname) {
      const i = pathname.lastIndexOf('/_boards/');
      return 'boards.seen.' + (i >= 0 ? pathname.slice(0, i + 1) : pathname);
    },
    // 'seen' (marked at this hash), 'since' (marked, and the board changed after), 'unseen'
    status: function (marks, b) {
      if (!marks || !Object.prototype.hasOwnProperty.call(marks, b.file)) return 'unseen';
      return marks[b.file] === b.hash ? 'seen' : 'since';
    },
    mark: function (marks, b) { const m = Object.assign({}, marks); m[b.file] = b.hash; return m; },
    unmark: function (marks, b) { const m = Object.assign({}, marks); delete m[b.file]; return m; },
    toggle: function (marks, b) { return Seen.status(marks, b) === 'seen' ? Seen.unmark(marks, b) : Seen.mark(marks, b); },
    counts: function (boards, marks) {
      const c = { total: boards.length, seen: 0, since: 0, unseen: 0 };
      for (const b of boards) c[Seen.status(marks, b)]++;
      return c;
    },
    // the next board after file (wrapping round) that is not seen at its current hash, or null
    next: function (boards, marks, file) {
      const i = boards.findIndex(function (b) { return b.file === file; });
      for (let k = 1; k <= boards.length; k++) {
        const b = boards[(i + k + boards.length) % boards.length];
        if (b.file !== file && Seen.status(marks, b) !== 'seen') return b.file;
      }
      return null;
    },
    // marks read from a stored string: an object of strings, anything else is no marks
    parse: function (s) {
      let v;
      try { v = JSON.parse(s); } catch (e) { return {}; }
      if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
      const out = {};
      for (const k of Object.keys(v)) if (typeof v[k] === 'string') out[k] = v[k];
      return out;
    },
  };
  // the regions of a combination as boxes in percent of the board
  function boxes(rec) {
    if (!rec || !rec.regions) return [];
    return rec.regions.map(function (r, i) {
      return { n: i + 1, l: 100 * r.x / rec.width, t: 100 * r.y / rec.height, w: 100 * r.width / rec.width, h: 100 * r.height / rec.height, r: r };
    });
  }
  if (typeof module === 'object' && module.exports) module.exports = { Seen: Seen, boxes: boxes };
  if (typeof document === 'undefined') return;

  // ---- the page ---------------------------------------------------------------------------------
  const B = window.Boards, el = B.el;
  const MODES = [['side', 'Side by side', 'Main and the proposal next to each other'], ['slider', 'Slider', 'Drag the divider'],
    ['overlay', 'Overlay', 'The proposal faded over main'], ['changes', 'Changes', 'The regions that differ, marked and counted']];
  const RENDER = [['voice', ['white', 'editorial', 'stationery']], ['scheme', ['paper', 'night', 'eink']], ['pen', ['1', '2', '3']]];
  const MARK = { added: '⊞', changed: '◉', removed: '⊟' };
  const WORDS = { added: 'Added', changed: 'Changed', removed: 'Removed' };
  let review = null, after = null, before = null, diffs = null, marks = {}, split = 50;
  const storeKey = Seen.key(location.pathname);

  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } }
  function q() { return new URLSearchParams(location.search); }
  function set(changes, push) {
    const s = q();
    for (const k of Object.keys(changes)) { if (changes[k] === null || changes[k] === '') s.delete(k); else s.set(k, changes[k]); }
    history[push ? 'pushState' : 'replaceState'](null, '', '?' + s.toString());
    show();
  }
  function render() {
    const s = q(), out = {};
    let stored = {};
    try { stored = JSON.parse(load('boards.render') || '{}') || {}; } catch (e) { stored = {}; }
    for (const [k, opts] of RENDER) { const v = s.get(k) || stored[k]; out[k] = opts.indexOf(String(v)) >= 0 ? String(v) : opts[0]; }
    return out;
  }
  function mode() { const m = q().get('compare'); return MODES.some(function (x) { return x[0] === m; }) ? m : 'side'; }
  function current() {
    const f = q().get('board');
    return review.boards.find(function (b) { return b.file === f; }) || review.boards[0] || null;
  }
  function info(desc, file) { return desc && desc.boards.find(function (b) { return b.file === file; }) || null; }
  function statesOf(b) {
    const a = info(after, b.file), m = info(before, b.file);
    return ((a && a.states) || (m && m.states) || []);
  }
  function stateId(b) {
    const s = q().get('state');
    return s && statesOf(b).some(function (x) { return x.id === s; }) ? s : null;
  }
  // a board's page on one side: the render, the state, and the state's props for a runtime that
  // does not read state= yet (the same values: a state is its props)
  function frameSrc(side, b) {
    const desc = side === 'after' ? after : before, r = render(), st = stateId(b);
    const s = new URLSearchParams(r);
    const bi = info(desc, b.file), state = st && bi && (bi.states || []).find(function (x) { return x.id === st; });
    if (state) {
      s.set('state', st);
      for (const k of Object.keys(state.props || {})) { const v = state.props[k]; s.set('p.' + k, typeof v === 'string' ? v : JSON.stringify(v)); }
    }
    const file = b.file.split('/').map(encodeURIComponent).join('/');
    return (side === 'after' ? '../' : review.base) + file + '?' + s.toString();
  }
  function size(b, side) {
    const bi = info(side === 'after' ? after : before, b.file) || info(after, b.file) || info(before, b.file);
    return bi && bi.size || { width: 1280, height: 800 };
  }
  function comboKey(b) { const r = render(), st = stateId(b); return r.voice + '-' + r.scheme + '-' + r.pen + (st ? '@' + st : ''); }
  function diffOf(b) { return diffs && diffs.boards[b.file] ? diffs.boards[b.file].combos[comboKey(b)] || null : null; }

  function frame(side, b, w, h, scale) {
    const f = el('iframe', { title: (side === 'after' ? 'The proposal: ' : 'Main: ') + b.title, src: frameSrc(side, b), loading: 'lazy' });
    f.style.width = w + 'px'; f.style.height = h + 'px'; f.style.transform = 'scale(' + scale + ')';
    const box = el('div', { class: 'rv-sheet' }, [f]);
    box.style.width = Math.round(w * scale) + 'px'; box.style.height = Math.round(h * scale) + 'px';
    return box;
  }
  function absent(b, w, h, scale, side) {
    const box = el('div', { class: 'rv-sheet rv-empty' }, [
      el('b', { text: side === 'before' ? 'Not on main' : 'Removed' }),
      el('span', { class: 'rv-small rv-soft', text: side === 'before' ? 'A new board in this proposal' : 'Gone from the design with this proposal' })]);
    box.style.width = Math.round(w * scale) + 'px'; box.style.height = Math.round(h * scale) + 'px';
    return box;
  }
  function fitScale(w, h, aw, ah) { return Math.max(0.05, Math.min(1, aw / w, ah / h)); }

  function bar() {
    // the viewer's bar (preview-common.js) when there is one: it returns its element, or places it itself
    if (typeof B.bar === 'function') {
      const own = document.getElementById('bar'), got = B.bar('review');
      if (got && got.nodeType) own.replaceWith(got); else own.remove();
      return;
    }
    document.getElementById('design').textContent = after ? after.title : '';
    document.getElementById('rev').textContent = '#' + review.pr.number;
    const form = document.getElementById('render');
    form.textContent = '';
    const r = render();
    for (const [k, opts] of RENDER) {
      const sel = el('select', { name: k, 'aria-label': k });
      for (const o of opts) { const op = el('option', { value: o, text: o }); if (r[k] === o) op.selected = true; sel.append(op); }
      sel.onchange = function () {
        const now = render(); now[k] = sel.value;
        save('boards.render', JSON.stringify(now));
        const c = {}; c[k] = sel.value; set(c);
      };
      form.append(sel);
    }
    const t = document.getElementById('chrome');
    const apply = function () { const night = load('boards.chrome') === 'white-night'; document.documentElement.dataset.theme = night ? 'white-night' : 'white-paper'; t.textContent = night ? 'Paper' : 'Night'; };
    t.onclick = function () { save('boards.chrome', load('boards.chrome') === 'white-night' ? 'white-paper' : 'white-night'); apply(); };
    apply();
  }

  function header() {
    const pr = review.pr, c = Seen.counts(review.boards, marks);
    const box = document.getElementById('pr');
    box.textContent = '';
    box.append(el('span', { class: 'rv-pr__n', text: '#' + pr.number }), el('span', { class: 'rv-pr__title', text: pr.title }));
    if (pr.head) box.append(el('span', { class: 'rv-tag rv-mono', title: 'The proposal’s latest commit', text: pr.head.slice(0, 7) }));
    if (pr.checks === 'passed') box.append(el('span', { class: 'rv-tag rv-tag--ok', text: 'checks passed' }));
    if (pr.checks === 'failed') box.append(el('span', { class: 'rv-tag rv-tag--bad', text: 'checks failed' }));
    box.append(el('span', { class: 'rv-grow' }));
    if (c.since) box.append(el('span', { class: 'rv-tag rv-tag--ink', title: 'Boards you had marked that changed afterwards lost the mark',
      text: c.since + ' changed since you looked' }));
    const pct = c.total ? Math.round(100 * c.seen / c.total) : 0;
    const bar = el('span', { class: 'rv-progress__bar' }, [el('i')]);
    bar.firstChild.style.width = pct + '%';
    box.append(el('div', { class: 'rv-progress', id: 'progress' }, [bar, el('b', { text: c.seen + ' of ' + c.total }), ' seen']));
    box.append(el('a', { class: 'rv-btn rv-btn--flat', href: pr.url, target: '_blank', rel: 'noopener', text: 'The proposal ↗' }));
    document.getElementById('total').textContent = String(c.total);
  }

  function what(b) {
    if (b.change !== 'changed') return b.change === 'added' ? 'New in this proposal' : 'Not in this proposal';
    const d = diffs && diffs.boards[b.file] && diffs.boards[b.file].combos[comboKey(b)];
    if (!diffs) return 'Its file, an import or a file it loads differs';
    if (!d || !d.computed) return 'Differences not computed for this render';
    if (!d.differing) return 'The same pixels in this render';
    return d.regions.length + (d.regions.length === 1 ? ' region' : ' regions') + ' differ in this render';
  }

  function list(cur) {
    const nav = document.getElementById('list');
    nav.textContent = '';
    if (!review.boards.length) { nav.append(el('p', { class: 'rv-soft', text: 'This proposal changes no board of this design.' })); return; }
    for (const b of review.boards) {
      const st = Seen.status(marks, b);
      const s = new URLSearchParams(location.search); s.set('board', b.file); s.delete('state');
      const a = el('a', { href: '?' + s.toString(), 'aria-current': b === cur ? 'true' : null, 'data-file': b.file, 'data-seen': st }, [
        el('span', { class: 'rv-mk rv-mk--' + b.change, title: WORDS[b.change], 'aria-label': WORDS[b.change], text: MARK[b.change] }),
        el('span', { class: 'rv-t', text: b.title }),
        el('span', { class: 'rv-row' }, [
          b.issues ? el('span', { class: 'rv-err', title: b.issues + ' check issue' + (b.issues > 1 ? 's' : ''), text: String(b.issues) }) : null,
          el('button', { type: 'button', class: 'rv-seen' + (st === 'seen' ? ' rv-seen--on' : ''), 'aria-pressed': st === 'seen' ? 'true' : 'false',
            title: st === 'seen' ? 'Seen: click to clear' : 'Mark seen', 'aria-label': 'Seen' })]),
        el('span', { class: 'rv-what' }, [st === 'since' ? el('b', { text: 'Changed since you looked · ' }) : null, WORDS[b.change] + ' · ' + what(b)]),
      ]);
      a.onclick = function (ev) {
        ev.preventDefault();
        if (ev.target.closest('.rv-seen')) { toggle(b); return; }
        set({ board: b.file, state: null }, true);
      };
      nav.append(a);
    }
  }

  function compareBar(b) {
    const cb = document.getElementById('cbar');
    cb.textContent = '';
    cb.append(el('span', { class: 'rv-mk rv-mk--' + b.change, 'aria-label': WORDS[b.change], text: MARK[b.change] }),
      el('b', { class: 'rv-cur', text: b.title }), el('span', { class: 'rv-tag rv-mono', text: b.file }), el('span', { class: 'rv-grow' }));
    const states = statesOf(b);
    if (states.length) {
      const cur = stateId(b);
      const seg = el('div', { class: 'rv-seg', role: 'group', 'aria-label': 'State' });
      const opt = function (id, name) {
        const x = el('button', { type: 'button', 'aria-pressed': cur === id ? 'true' : 'false', text: name });
        x.onclick = function () { set({ state: id }); };
        seg.append(x);
      };
      opt(null, 'Default');
      for (const s of states) opt(s.id, s.name);
      cb.append(el('span', { class: 'rv-small rv-soft', text: 'State' }), seg);
    }
    const m = mode();
    const seg = el('div', { class: 'rv-seg rv-modes', role: 'group', 'aria-label': 'Comparison' });
    for (const [id, name, tip] of MODES) {
      const x = el('button', { type: 'button', 'aria-pressed': m === id ? 'true' : 'false', title: tip, 'data-mode': id, text: name });
      x.onclick = function () { set({ compare: id }); };
      seg.append(x);
    }
    cb.append(seg);
  }

  function stage(b) {
    const st = document.getElementById('stage');
    st.textContent = '';
    const m = mode(), aw = st.clientWidth - 40, ah = st.clientHeight - 60;
    const hasBefore = b.change !== 'added' && !!review.base, hasAfter = b.change !== 'removed';
    const sa = size(b, 'after'), sb = size(b, 'before');
    if (m === 'side' || (!hasBefore || !hasAfter) && m !== 'changes') {
      const scale = fitScale(Math.max(sa.width, sb.width), Math.max(sa.height, sb.height), (aw - 28) / 2, ah - 30);
      const col = function (side, has, sz) {
        const cap = el('div', { class: 'rv-cap' }, side === 'before'
          ? [el('span', { class: 'rv-tag', text: 'before' }), el('span', { class: 'rv-mono rv-small', text: 'main' })]
          : [el('span', { class: 'rv-tag rv-tag--ink', text: 'after' }), el('span', { class: 'rv-mono rv-small', text: '#' + review.pr.number + (review.pr.head ? ' · ' + review.pr.head.slice(0, 7) : '') })]);
        return el('div', { class: 'rv-side', 'data-side': side }, [cap, has ? frame(side, b, sz.width, sz.height, scale) : absent(b, sz.width, sz.height, scale, side)]);
      };
      st.append(col('before', hasBefore, hasBefore ? sb : sa), col('after', hasAfter, hasAfter ? sa : sb));
      if (m !== 'side') st.append(el('p', { class: 'rv-small rv-soft rv-only', text: 'Only one side has this board: shown side by side.' }));
      return;
    }
    if (m === 'slider' || m === 'overlay') {
      const scale = fitScale(Math.max(sa.width, sb.width), Math.max(sa.height, sb.height), aw, ah - 50);
      const wrap = el('div', { class: 'rv-sheet rv-stack rv-' + m });
      wrap.style.width = Math.round(Math.max(sa.width, sb.width) * scale) + 'px'; wrap.style.height = Math.round(Math.max(sa.height, sb.height) * scale) + 'px';
      const one = function (side, sz) { const f = frame(side, b, sz.width, sz.height, scale); f.className = 'rv-layer'; return f; };
      const lower = one('before', sb), upper = one('after', sa);
      upper.classList.add('rv-upper');
      wrap.append(lower, upper);
      const range = el('input', { type: 'range', min: '0', max: '100', value: String(split), 'aria-label': m === 'slider' ? 'Divider' : 'Fade', class: 'rv-range' });
      const handle = el('div', { class: 'rv-handle' });
      const apply = function () {
        if (m === 'slider') { upper.style.clipPath = 'inset(0 0 0 ' + split + '%)'; handle.style.left = split + '%'; }
        else upper.style.opacity = String(split / 100);
        range.value = String(split);
      };
      range.oninput = function () { split = Number(range.value); apply(); };
      if (m === 'slider') {
        // the frames take no pointer here: a drag anywhere moves the divider
        const grab = el('div', { class: 'rv-grab', title: 'Drag the divider' });
        const move = function (ev) { const r = wrap.getBoundingClientRect(); split = Math.max(0, Math.min(100, 100 * (ev.clientX - r.left) / r.width)); apply(); };
        grab.onpointerdown = function (ev) { grab.setPointerCapture(ev.pointerId); move(ev); grab.onpointermove = move; };
        grab.onpointerup = function () { grab.onpointermove = null; };
        wrap.append(handle, grab, el('span', { class: 'rv-ltag', text: 'before' }), el('span', { class: 'rv-rtag', text: 'after' }));
      }
      apply();
      st.append(el('div', { class: 'rv-col' }, [wrap, el('div', { class: 'rv-row rv-small' }, [el('span', { text: 'before' }), range, el('span', { text: 'after' })])]));
      return;
    }
    // changes: the proposal with the regions that differ
    const scale = fitScale(sa.width, sa.height, aw - 300, ah);
    const pane = el('div', { class: 'rv-pane' });
    if (!hasAfter || !hasBefore) {
      st.append(hasAfter ? frame('after', b, sa.width, sa.height, scale) : absent(b, sb.width, sb.height, scale, 'after'), pane);
      pane.append(el('b', { text: hasAfter ? 'A new board' : 'A removed board' }),
        el('span', { class: 'rv-soft', text: 'Only one side has it, so there is nothing to compare.' }));
      return;
    }
    const rec = diffOf(b);
    const sheet = frame('after', b, sa.width, sa.height, scale);
    st.append(sheet, pane);
    if (!review.diffs) { pane.append(el('b', { text: 'Not computed' }), el('span', { class: 'rv-soft', text: 'This copy of the proposal was published without difference images. Compare side by side, with the slider or the overlay.' })); return; }
    if (!rec || !rec.computed) {
      const r = render();
      pane.append(el('b', { text: 'Not computed for this render' }),
        el('span', { class: 'rv-soft', text: 'Differences are computed at pen 1 for every voice and scheme, in the default state and each named state both sides have' +
          (rec && rec.computed === false && rec.errors ? ' (a render of this one failed).' : '.') }));
      if (r.pen !== '1') { const go = el('button', { type: 'button', class: 'rv-btn rv-btn--flat', text: 'Show pen 1' }); go.onclick = function () { set({ pen: '1' }); }; pane.append(go); }
      const miss = diffs && diffs.boards[b.file] && diffs.boards[b.file].missingStates || [];
      if (miss.length) pane.append(el('span', { class: 'rv-small rv-soft', text: 'States only one side has: ' + miss.join(', ') }));
      return;
    }
    sheet.append(el('div', { class: 'rv-veil' }));
    const bx = boxes(rec);
    for (const x of bx) {
      const d = el('div', { class: 'rv-box' }, [el('b', { text: String(x.n) })]);
      d.style.left = x.l + '%'; d.style.top = x.t + '%'; d.style.width = x.w + '%'; d.style.height = x.h + '%';
      sheet.append(d);
    }
    const pct = rec.total ? 100 * rec.differing / rec.total : 0;
    pane.append(el('b', { class: 'rv-count', text: rec.differing ? bx.length + (bx.length === 1 ? ' region · ' : ' regions · ') + (pct < 0.1 ? '< 0.1' : pct.toFixed(1)) + ' % of the board' : 'No pixel differs' }),
      el('span', { class: 'rv-soft', text: rec.differing ? 'Pixels that differ, grouped into regions, in the voice, scheme, pen and state chosen above.' : 'In this render main and the proposal look the same; the change is elsewhere (another render or state, or nothing visible).' }));
    for (const x of bx) pane.append(el('span', { class: 'rv-row' }, [el('span', { class: 'rv-num', text: String(x.n) }),
      x.r.width + ' × ' + x.r.height + ' at ' + x.r.x + ', ' + x.r.y + ' · ' + x.r.pixels.toLocaleString('en') + ' px']));
    if (rec.image) pane.append(el('a', { class: 'rv-link', href: '../' + review.diffs + rec.image, target: '_blank', rel: 'noopener', text: 'The difference image ↗' }));
    if (rec.errors && rec.errors.after && rec.errors.after.length) pane.append(el('span', { class: 'rv-small rv-bad', text: 'The proposal’s render reported: ' + rec.errors.after.slice(0, 3).join('; ') }));
  }

  function foot(b) {
    const f = document.getElementById('foot');
    f.textContent = '';
    const rec = diffOf(b);
    const errs = (rec && rec.errors && rec.errors.after) || [];
    if (b.issues || errs.length) {
      f.append(el('div', { class: 'rv-errbox' }, [el('b', { text: (b.issues ? b.issues + ' check issue' + (b.issues > 1 ? 's' : '') : 'Render errors') + ' on this board' }),
        el('code', { text: errs.length ? errs[0] : 'tools/boards check lists ' + (b.issues > 1 ? 'them' : 'it') })]));
    }
    const addr = el('input', { class: 'rv-addr', readonly: '', value: location.href, 'aria-label': 'The address of this board in the review', title: 'Quote it in a comment on the proposal' });
    const copy = el('button', { type: 'button', class: 'rv-btn rv-btn--flat', text: 'Copy address' });
    copy.onclick = function () {
      addr.select();
      const done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy address'; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, function () { document.execCommand('copy'); done(); });
      else { document.execCommand('copy'); done(); }
    };
    const st = Seen.status(marks, b);
    const seen = el('button', { type: 'button', class: 'rv-btn rv-btn--flat', id: 'mark', 'aria-pressed': st === 'seen' ? 'true' : 'false' }, [st === 'seen' ? 'Seen ✓ ' : 'Mark seen ', el('span', { class: 'rv-key', text: 'S' })]);
    seen.onclick = function () { toggle(b); };
    const next = el('button', { type: 'button', class: 'rv-btn rv-btn--primary rv-btn--flat', id: 'next', title: 'Marks this board seen and opens the next one not seen' }, ['Next unseen ', el('span', { class: 'rv-key', text: 'N' })]);
    next.onclick = nextUnseen;
    f.append(el('span', { class: 'rv-grow' }), addr, copy,
      el('a', { class: 'rv-btn rv-btn--flat', href: review.pr.url, target: '_blank', rel: 'noopener', text: 'Comment on the proposal ↗' }), seen, next);
  }

  function storeMarks() { save(storeKey, JSON.stringify(marks)); }
  function toggle(b) { marks = Seen.toggle(marks, b); storeMarks(); show(); }
  function nextUnseen() {
    const b = current();
    if (!b) return;
    marks = Seen.mark(marks, b);
    storeMarks();
    const n = Seen.next(review.boards, marks, b.file);
    if (n) set({ board: n, state: null }, true); else show();
  }
  function step(d) {
    const b = current(), i = review.boards.indexOf(b), n = review.boards[(i + d + review.boards.length) % review.boards.length];
    if (n && n !== b) set({ board: n.file, state: null }, true);
  }

  function show() {
    if (!review) return;
    marks = Seen.parse(load(storeKey));
    const b = current();
    header();
    list(b);
    if (!b) { document.getElementById('cbar').textContent = ''; document.getElementById('stage').textContent = ''; document.getElementById('foot').textContent = ''; return; }
    document.title = b.title + ' · review #' + review.pr.number;
    compareBar(b);
    stage(b);
    foot(b);
  }

  document.addEventListener('keydown', function (ev) {
    if (!review || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input, select, textarea')) return;
    const b = current();
    if (!b) return;
    const k = ev.key.toLowerCase();
    if (k === 'n') nextUnseen();
    else if (k === 's') toggle(b);
    else if (k === 'j') step(1);
    else if (k === 'k') step(-1);
    else if (k === 'c') { const i = MODES.findIndex(function (m) { return m[0] === mode(); }); set({ compare: MODES[(i + 1) % MODES.length][0] }); }
    else if (k === 't') {
      const ids = [null].concat(statesOf(b).map(function (s) { return s.id; }));
      if (ids.length > 1) set({ state: ids[(ids.indexOf(stateId(b)) + 1) % ids.length] });
    } else if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && (mode() === 'slider' || mode() === 'overlay')) {
      split = Math.max(0, Math.min(100, split + (ev.key === 'ArrowLeft' ? -5 : 5)));
      const r = document.querySelector('.rv-range');
      if (r) { r.value = String(split); r.oninput(); }
    } else return;
    ev.preventDefault();
  });
  window.addEventListener('popstate', show);
  // another tab marked a board: the same marks here
  window.addEventListener('storage', function (ev) { if (ev.key === storeKey) show(); });
  let resizing = null;
  window.addEventListener('resize', function () { clearTimeout(resizing); resizing = setTimeout(function () { const b = current(); if (b) stage(b); }, 150); });

  function json(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ': HTTP ' + r.status); return r.json(); }); }
  json('api/review.json').then(function (r) {
    review = r;
    return Promise.all([
      B.canvas().catch(function () { return null; }),
      r.base ? json(new URL(r.base + '_boards/api/canvas.json', location.href).href).catch(function () { return null; }) : null,
      r.diffs ? json('../' + r.diffs + 'index.json').catch(function () { return null; }) : null,
    ]);
  }).then(function (got) {
    after = got[0]; before = got[1]; diffs = got[2];
    bar();
    show();
  }).catch(function (e) {
    document.getElementById('stage').append(el('div', { class: 'rv-pane' }, [el('b', { text: 'No review here' }),
      el('span', { class: 'rv-soft', text: 'Only the published copy of a proposal has one (api/review.json): ' + String(e && e.message || e) })]));
  });
})();
