// SPDX-License-Identifier: GPL-2.0-or-later
// The canvas (003 FR-004, FR-010, FR-051, FR-052): the pages of canvas.json in a rail, each board at
// its place and size with a readable label and its marks, the title notes as section heads, a map
// of the page, fit / 1:1 / zoom, and an inspector for the chosen board (size, states, props, links
// in and out, issues, the shot command). Address: index.html?page=ID&board=FILE&state=ID&voice=
// &scheme=&pen=&p.NAME= (state and props apply to the chosen board).
//
// A click on a board chooses it, a double click or ⏎ opens it in the board view, and so does its
// title. With "Use in place" the live boards take clicks and keys on the canvas itself. The middle
// button drags the canvas; ctrl+wheel and a pinch zoom it around the pointer, also over a board in use.
(function () {
  'use strict';
  const B = window.Boards, L = B.logic, el = B.el;
  const bar = B.bar('canvas');
  const zoom = document.getElementById('zoom'), pct = document.getElementById('pct');
  const live = document.getElementById('live'), use = document.getElementById('use'), changedOnly = document.getElementById('changed-only');
  const box = document.getElementById('canvas'), sizer = document.getElementById('sizer'), plane = document.getElementById('plane');
  const insp = document.getElementById('insp'), filter = document.getElementById('filter');
  const MIN = Number(zoom.min) / 100, MAX = Number(zoom.max) / 100;
  let data = null, rv = null, changes = {};
  let addr = B.address();
  let page = addr.page, chosen = addr.board;
  let scale = Number(zoom.value) / 100, planeW = 0, planeH = 0, ox = 0, oy = 0;
  let items = [], tiles = new Map(), errors = new Map();
  // the parts whose text keeps a readable size at every zoom: [element, smallest px, px at scale 1]
  let readable = [];
  let storedZoom = Number(B.get('boards.zoom')) || 0;
  if (storedZoom) scale = storedZoom / 100;
  live.checked = B.get('boards.live') !== '0';
  use.checked = B.get('boards.use') === '1';
  changedOnly.checked = B.get('boards.changedOnly') === '1';

  function clamp(s) { return Math.min(MAX, Math.max(MIN, s)); }
  function renderNow() { return B.render(); }
  function keepRender() { const r = renderNow(); return { voice: r.voice, scheme: r.scheme, pen: r.pen }; }
  function viewHref(file) {
    const own = file === chosen ? { state: addr.state, props: addr.props } : {};
    return 'view.html' + L.serialise(Object.assign({ board: file }, own, keepRender()));
  }
  function byFile(f) { return data && data.boards.find(function (b) { return b.file === f; }); }
  function issues(b) { return (b.issues || []).length + (errors.get(b.file) || []).length; }
  function writeAddress(push) {
    addr.page = page; addr.board = chosen;
    const r = renderNow();
    addr.voice = r.voice; addr.scheme = r.scheme; addr.pen = r.pen;
    B.setAddress(addr, push);
  }

  // ---- zoom: only the plane's transform, the scroll area and the readable text change, so live boards
  // keep their state; (cx, cy), a point in the canvas box, stays where it is
  function setScale(s, cx, cy) {
    s = clamp(s);
    if (cx === undefined) { cx = box.clientWidth / 2; cy = box.clientHeight / 2; }
    const px = (box.scrollLeft + cx) / scale, py = (box.scrollTop + cy) / scale;
    scale = s;
    plane.style.transform = 'scale(' + s + ')';
    sizer.style.width = planeW * s + 'px';
    sizer.style.height = planeH * s + 'px';
    for (const r of readable) r[0].style.fontSize = Math.max(r[1], r[2] / s) + 'px';
    box.scrollLeft = px * s - cx;
    box.scrollTop = py * s - cy;
    zoom.value = String(Math.round(s * 100));
    pct.textContent = Math.round(s * 100) + '%';
    B.put('boards.zoom', String(Math.round(s * 1000) / 10));
    drawView();
  }
  function fit() {
    if (!planeW) return;
    const s = Math.min((box.clientWidth - 24) / planeW, (box.clientHeight - 24) / planeH);
    setScale(s, 0, 0);
    box.scrollLeft = Math.max(0, (planeW * scale - box.clientWidth) / 2);
    box.scrollTop = 0;
    drawView();
  }

  function useBoards() { return live.checked && use.checked; }
  function syncUse() {
    use.disabled = !live.checked;
    use.parentElement.classList.toggle('unused', !live.checked);
    document.body.classList.toggle('using', useBoards());
  }

  // ---- the rail -----------------------------------------------------------------------------------
  function drawRail(pages) {
    const nav = document.getElementById('pages');
    nav.textContent = '';
    document.getElementById('npages').textContent = pages[0].id ? String(pages.length) : '';
    for (const p of pages) {
      const n = L.onPage(data, p.id).length;
      const a = el('a', { href: 'index.html' + L.serialise(Object.assign({ page: p.id }, keepRender())), 'aria-current': p.id === page ? 'page' : null }, [el('span', { class: 'vw-t', text: p.name }), el('span', { class: 'vw-n', text: String(n) })]);
      a.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        if (p.id === page) return;
        page = p.id; chosen = null; addr.state = null; addr.props = {};
        writeAddress(true);
        draw(true);
      });
      nav.append(a);
    }
    outline();
    const off = data.boards.filter(function (b) { return !b.onCanvas; });
    const gone = (rv && rv.boards || []).filter(function (x) { return x.change === 'removed' && !byFile(x.file); });
    const extra = document.getElementById('extra'), list = document.getElementById('extra-list');
    extra.hidden = !off.length && !gone.length;
    list.textContent = '';
    document.getElementById('nextra').textContent = String(off.length + gone.length);
    for (const b of off) list.append(el('a', { href: viewHref(b.file), title: b.file }, [B.mark(b.interactive ? 'interactive' : 'still'), el('span', { class: 'vw-t', text: b.file }), el('span')]));
    for (const x of gone) list.append(el('a', { href: 'review.html' + L.serialise({ board: x.file }), title: x.file + ': removed by the proposal' }, [B.mark('removed'), el('span', { class: 'vw-t', text: x.file }), el('span')]));
  }
  function matches(b) {
    const q = filter.value.trim().toLowerCase();
    return !q || b.title.toLowerCase().indexOf(q) >= 0 || b.file.toLowerCase().indexOf(q) >= 0;
  }
  function marks(b) {
    const m = [];
    if (changes[b.file]) m.push(B.mark(changes[b.file], changes[b.file] + (rv && rv.pr ? ' in #' + rv.pr.number : '')));
    m.push(B.mark(b.interactive ? 'interactive' : 'still'));
    return m;
  }
  function outline() {
    const list = document.getElementById('outline');
    list.textContent = '';
    const shown = items.filter(matches);
    document.getElementById('nboards').textContent = shown.length === items.length ? String(items.length) : shown.length + ' of ' + items.length;
    for (const b of shown) {
      const n = issues(b);
      const a = el('a', { href: viewHref(b.file), role: 'option', 'aria-selected': b.file === chosen ? 'true' : 'false', 'data-file': b.file, title: b.title + ' · ' + b.file },
        [el('span', { class: 'vw-mks' }, marks(b)), el('span', { class: 'vw-t', text: b.title }), n ? B.errMark(n) : el('span')]);
      a.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        choose(b.file, true);
      });
      a.addEventListener('dblclick', function () { location.href = viewHref(b.file); });
      list.append(a);
    }
    for (const b of items) { const t = tiles.get(b.file); if (t) t.classList.toggle('vw-tile--dim', !matches(b) || changedOnly.checked && !changes[b.file]); }
  }

  // ---- the canvas ---------------------------------------------------------------------------------
  function tileSrc(b) {
    const own = b.file === chosen ? { state: addr.state, props: addr.props } : {};
    return L.boardSrc(b.file, Object.assign({ render: renderNow() }, own));
  }
  function frameFor(b, t) {
    const f = el('iframe', { src: tileSrc(b), loading: 'lazy', title: b.title });
    f.style.width = b.w + 'px';
    f.style.height = b.h + 'px';
    f.addEventListener('load', function () { forward(f); });
    B.frameErrors(f, function (errs) {
      if (errs === null) return;
      errors.set(b.file, errs);
      tileErr(b, t);
      if (b.file === chosen) inspector();
      outline();
    });
    return f;
  }
  function tileErr(b, t) {
    const lab = t.querySelector('.label');
    const old = lab.querySelector('.vw-err');
    if (old) old.remove();
    const n = issues(b);
    if (n) lab.append(B.errMark(n, n + ' issue' + (n === 1 ? '' : 's') + ': ' + (b.issues || []).concat(errors.get(b.file) || []).map(function (e) { return e.feature || e.kind; }).join(', ')));
  }

  function draw(fitAfter) {
    readable = [];
    tiles = new Map();
    plane.textContent = '';
    const pages = L.pagesOf(data);
    if (!pages.some(function (p) { return p.id === page; })) {
      const of = chosen && byFile(chosen);
      page = of && of.onCanvas && of.page || data.launch && data.launch.page || pages[0].id;
      if (!pages.some(function (p) { return p.id === page; })) page = pages[0].id;
    }
    items = L.readingOrder(L.onPage(data, page));
    if (chosen && !items.some(function (b) { return b.file === chosen; })) chosen = null;
    const notes = Object.keys(data.notes || {}).map(function (k) { return data.notes[k]; }).filter(function (n) { return n.page === page || !n.page && !pages[0].id; });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of items) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y - 40); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
    for (const n of notes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + (n.w || 400)); maxY = Math.max(maxY, n.y + (n.kind === 'title1' ? 60 : 200)); if (n.kind === 'title1') minY = Math.min(minY, n.y - 260); }
    if (minX === Infinity) { minX = minY = 0; maxX = maxY = 400; }
    const pad = 80;
    ox = pad - minX; oy = pad - minY;
    planeW = maxX - minX + 2 * pad;
    planeH = maxY - minY + 2 * pad;
    plane.style.width = planeW + 'px';
    plane.style.height = planeH + 'px';
    for (const n of notes) {
      const big = n.kind === 'title1';
      const d = el('div', { class: big ? 'vw-section note title1' : 'vw-note note', text: n.text || '' });
      d.style.left = (n.x + ox) + 'px';
      // a section head grows upwards from its line as the zoom shrinks, away from the boards below it
      if (big) d.style.bottom = (planeH - (n.y + oy + 40)) + 'px'; else d.style.top = (n.y + oy) + 'px';
      if (n.w && !big) d.style.width = n.w + 'px';
      readable.push(big ? [d, 40, 22] : [d, 14, 12]);
      plane.append(d);
    }
    for (const b of items) {
      const t = el('div', { class: 'board vw-tile' + (b.interactive ? ' interactive' : ''), 'data-file': b.file, 'aria-selected': b.file === chosen ? 'true' : 'false' });
      t.style.left = (b.x + ox) + 'px';
      t.style.top = (b.y + oy) + 'px';
      t.style.width = b.w + 'px';
      t.style.height = b.h + 'px';
      const label = el('div', { class: 'label vw-tile__label' }, [el('span', { class: 'vw-mks' }, marks(b)),
        el('a', { class: 'open vw-t', href: viewHref(b.file), title: 'Open ' + b.title + ' in the board view', text: b.title }),
        b.exists ? null : el('span', { class: 'vw-tag vw-tag--bad', text: 'missing' })]);
      readable.push([label, 14, 12]);
      t.append(label);
      const frame = el('div', { class: 'vw-tile__frame' });
      if (live.checked && b.exists) frame.append(frameFor(b, t));
      else {
        const th = el('div', { class: 'thumb' }, [el('div', { class: 'vw-mono', text: b.file }), el('div', { class: 'vw-soft', text: b.w + ' × ' + b.h }), (b.states || []).length ? el('div', { class: 'vw-soft', text: b.states.length + ' states' }) : null]);
        readable.push([th, 14, 12]);
        frame.append(th);
      }
      t.append(frame);
      if ((b.states || []).length) t.append(el('div', { class: 'vw-tile__states', 'aria-hidden': 'true' }, b.states.slice(0, 6).map(function (s) { return el('i', { class: s.id === (b.file === chosen && addr.state) ? 'on' : null }); })));
      // a click chooses the board, a double click opens it; with a modifier or the middle button the
      // link opens as links do (a new tab)
      const tip = b.title + (b.interactive ? ' (interactive)' : '');
      const hit = el('a', { class: 'hit', href: viewHref(b.file), 'aria-label': tip, title: tip });
      hit.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        choose(b.file, false);
      });
      hit.addEventListener('dblclick', function (e) { e.preventDefault(); location.href = viewHref(b.file); });
      t.append(hit);
      tileErr(b, t);
      tiles.set(b.file, t);
      plane.append(t);
    }
    drawRail(pages);
    document.getElementById('changed-only-l').hidden = !rv;
    syncUse();
    drawMap();
    if (fitAfter || !storedZoom) { storedZoom = 1; fit(); } else setScale(scale, 0, 0);
    inspector();
    writeAddress(false);
  }

  // ---- choosing a board: the tile, the outline, the inspector, the address ----------------------------
  function choose(file, reveal) {
    const was = chosen;
    if (file === was) return;
    chosen = file;
    addr.state = null; addr.props = {};
    for (const [f, t] of tiles) t.setAttribute('aria-selected', f === file ? 'true' : 'false');
    // a tile that showed a state or props of its own goes back to the board's defaults
    if (was) resetTile(was);
    document.querySelectorAll('#outline a').forEach(function (a) { a.setAttribute('aria-selected', a.dataset.file === file ? 'true' : 'false'); });
    if (reveal && file) revealTile(file);
    writeAddress(false);
    inspector();
    drawMap();
  }
  function resetTile(file) {
    const b = byFile(file), t = tiles.get(file);
    if (!b || !t) return;
    const f = t.querySelector('iframe');
    if (f && f.getAttribute('src') !== tileSrc(b)) f.setAttribute('src', tileSrc(b));
    const dots = t.querySelectorAll('.vw-tile__states i');
    dots.forEach(function (d, i) { d.className = b.states[i] && b.states[i].id === (file === chosen && addr.state) ? 'on' : ''; });
  }
  function revealTile(file) {
    const b = byFile(file);
    if (!b) return;
    const x = (b.x + ox) * scale, y = (b.y + oy - 40) * scale, w = b.w * scale, h = (b.h + 40) * scale;
    const inX = x >= box.scrollLeft && x + w <= box.scrollLeft + box.clientWidth, inY = y >= box.scrollTop && y + h <= box.scrollTop + box.clientHeight;
    if (!inX) box.scrollLeft = x + w / 2 - box.clientWidth / 2;
    if (!inY) box.scrollTop = Math.max(0, y + Math.min(h, box.clientHeight) / 2 - box.clientHeight / 2);
    drawView();
  }
  function step(d) {
    const list = items.filter(matches);
    if (!list.length) return;
    const i = list.findIndex(function (b) { return b.file === chosen; });
    const n = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length;
    choose(list[n].file, true);
  }

  // ---- the inspector ------------------------------------------------------------------------------
  const GLOBAL = ['voice', 'theme', 'scheme', 'pen'];
  function seg(label, opts, cur, set) {
    const g = el('div', { class: 'vw-seg', role: 'group', 'aria-label': label });
    for (const o of opts) g.append(el('button', { type: 'button', 'aria-pressed': o[0] === cur ? 'true' : 'false', title: o[2] || null, onclick: function () { set(o[0]); } }, [o[1]]));
    return g;
  }
  function inspector() {
    const b = chosen && byFile(chosen);
    document.body.classList.toggle('inspecting', !!b);
    insp.hidden = !b;
    insp.textContent = '';
    if (!b) return;
    const r = renderNow(), change = changes[b.file];
    const head = el('section', {}, [
      el('div', { class: 'vw-row vw-insp__file' }, marks(b).concat([el('span', { class: 'vw-mono vw-soft vw-small vw-t', text: b.file }), el('span', { class: 'vw-grow' }),
        el('button', { type: 'button', class: 'vw-icon-btn', 'aria-label': 'Close (Esc)', title: 'Close (Esc)', onclick: function () { choose(null); } }, ['×'])])),
      el('h2', { text: b.title }),
      el('div', { class: 'vw-row vw-wrap' }, [el('span', { class: 'vw-tag vw-tag--ink', text: b.interactive ? '▶ clickable' : '○ picture only' }), el('span', { class: 'vw-tag', text: b.size.width + ' × ' + b.size.height }),
        b.expand ? el('span', { class: 'vw-tag', text: 'expand: ' + b.expand }) : null,
        change ? el('span', { class: 'vw-tag vw-tag--ink', text: change + (rv && rv.pr ? ' in #' + rv.pr.number : '') }) : null]),
      el('div', { class: 'vw-actions' }, [
        el('a', { class: 'vw-btn vw-btn--primary', href: viewHref(b.file), 'aria-keyshortcuts': 'Enter' }, ['Open ', el('span', { class: 'vw-key vw-key--on', text: '⏎' })]),
        el('a', { class: 'vw-btn', href: 'matrix.html' + L.serialise(Object.assign({ board: b.file, state: addr.state }, keepRender())), title: 'Every combination (M)', 'aria-keyshortcuts': 'm' }, ['Matrix']),
        change && rv ? el('a', { class: 'vw-btn', href: 'review.html' + L.serialise({ board: b.file, state: addr.state }), text: 'Compare' }) : null]),
    ]);
    insp.append(head);
    if (b.states.length) {
      const s = el('section', {}, [el('h3', {}, ['States', el('span', { text: String(b.states.length) })])]);
      const opts = [[null, 'Default', 'the board\'s own defaults']].concat(b.states.map(function (x) { return [x.id, x.name || x.id, x.id]; }));
      s.append(seg('States', opts, addr.state, function (v) { addr.state = v; writeAddress(false); resetTile(b.file); inspector(); }),
        el('p', { class: 'vw-soft vw-small', text: 'Named in the board\'s $states; the tile and the board view follow the one chosen here.' }));
      insp.append(s);
    }
    const own = Object.keys(b.props || {}).filter(function (k) { const p = b.props[k]; return (p.editor === 'enum' || p.editor === 'boolean') && GLOBAL.indexOf(k) < 0; });
    const ps = el('section', {}, [el('h3', {}, ['Props', el('span', { text: own.length ? 'the board\'s own' : 'none to choose' })])]);
    for (const k of own) {
      const p = b.props[k], cur = k in addr.props ? addr.props[k] : String(p.default);
      const set = function (v) { if (v === String(p.default)) delete addr.props[k]; else addr.props[k] = v; writeAddress(false); resetTile(b.file); inspector(); };
      const opts = p.editor === 'boolean' ? [['true', 'On'], ['false', 'Off']] : (p.options || []).map(function (o) { return [String(o), String(o)]; });
      let ctl;
      if (opts.length <= 4) ctl = seg(k, opts, cur, set);
      else {
        ctl = el('select', { 'aria-label': k });
        for (const o of opts) { const opt = el('option', { value: o[0], text: o[1] }); if (o[0] === cur) opt.selected = true; ctl.append(opt); }
        ctl.onchange = function () { set(ctl.value); };
      }
      ps.append(el('div', { class: 'vw-field' }, [el('span', { class: 'vw-t', text: k, title: k }), ctl]));
    }
    ps.append(el('div', { class: 'vw-field' }, [el('span', { text: 'Render' }), el('span', { class: 'vw-small' }, ['as every board · ', el('a', { class: 'vw-link', href: viewHref(b.file), text: 'differ in its view' })])]));
    insp.append(ps);
    const out = b.links || [], into = L.linksIn(data, b.file);
    const ls = el('section', { class: 'vw-links' }, [el('h3', {}, ['Links', el('span', { text: String(out.length + into.length) })])]);
    const link = function (dir, file, text) {
      const t = byFile(file);
      const a = el('a', { href: viewHref(file), title: (dir === 'out' ? 'to ' : 'from ') + file }, [el('span', { class: 'vw-arrow', text: dir === 'out' ? '→' : '←' }), el('span', { class: 'vw-t', text: t ? t.title : file }), text ? el('span', { class: 'vw-soft vw-small', text: '“' + text + '”' }) : null]);
      a.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || !t || !t.onCanvas) return;
        e.preventDefault();
        if (t.page !== page) { page = t.page; chosen = file; addr.state = null; addr.props = {}; writeAddress(true); draw(true); revealTile(file); }
        else choose(file, true);
      });
      return a;
    };
    for (const l of out) ls.append(link('out', l.to, l.text));
    for (const l of into) ls.append(link('in', l.file, l.text));
    if (!out.length && !into.length) ls.append(el('p', { class: 'vw-soft vw-small', text: 'No board links here, and this board links nowhere.' }));
    ls.append(el('a', { class: 'vw-link vw-small', href: 'flow.html' + L.serialise(Object.assign({ page: page, from: b.file }, keepRender())), text: 'See it in the flow' }));
    insp.append(ls);
    const all = (b.issues || []).concat(errors.get(b.file) || []);
    const cs = el('section', {}, [el('h3', {}, ['Check', el('span', { text: all.length ? String(all.length) : '' })])]);
    if (!all.length) cs.append(el('div', { class: 'vw-row' }, [el('span', { class: 'vw-tag vw-tag--ok', text: 'no errors' }), el('span', { class: 'vw-soft vw-small', text: live.checked ? 'as rendered here' : 'from the source; turn Live on to render' })]));
    for (const e of all.slice(0, 8)) cs.append(el('div', { class: 'vw-errbox' }, [el('b', { text: (e.kind || 'error') + (e.feature ? ': ' + e.feature : '') }), el('code', { text: [e.board && e.board !== b.file ? e.board : null, e.line ? 'line ' + e.line : null, e.detail, e.message].filter(Boolean).join(' · ') })]));
    insp.append(cs);
    const cmd = L.shotCommand(B.boardPath(data, b.file), r, addr.state);
    const copyBtn = el('button', { type: 'button', class: 'vw-btn', text: 'Copy' });
    copyBtn.onclick = function () { B.copy(cmd, copyBtn); };
    insp.append(el('section', {}, [el('h3', { text: 'For an agent' }), el('code', { class: 'vw-cmd', text: cmd }), el('div', { class: 'vw-actions' }, [copyBtn])]));
  }

  // ---- the map: the page's boards, the visible part, a click moves there -------------------------------
  const map = document.getElementById('map');
  let mapScale = 1, mapView = null;
  function drawMap() {
    map.textContent = '';
    const pageName = (L.pagesOf(data).find(function (p) { return p.id === page; }) || {}).name || '';
    document.getElementById('map-page').textContent = pageName;
    document.getElementById('map-n').textContent = items.length + ' boards';
    const mw = map.clientWidth || 172, mh = map.clientHeight || 92;
    mapScale = Math.min(mw / planeW, mh / planeH);
    for (const b of items) {
      const i = el('i', { class: b.file === chosen ? 'on' : null });
      i.style.left = (b.x + ox) * mapScale + 'px'; i.style.top = (b.y + oy) * mapScale + 'px';
      i.style.width = Math.max(2, b.w * mapScale) + 'px'; i.style.height = Math.max(2, b.h * mapScale) + 'px';
      map.append(i);
    }
    mapView = el('div', { class: 'vw-mini__view' });
    map.append(mapView);
    drawView();
  }
  function drawView() {
    if (!mapView) return;
    mapView.style.left = box.scrollLeft / scale * mapScale + 'px';
    mapView.style.top = box.scrollTop / scale * mapScale + 'px';
    mapView.style.width = Math.min(planeW, box.clientWidth / scale) * mapScale + 'px';
    mapView.style.height = Math.min(planeH, box.clientHeight / scale) * mapScale + 'px';
  }
  function mapTo(e) {
    const r = map.getBoundingClientRect();
    const px = (e.clientX - r.left) / mapScale, py = (e.clientY - r.top) / mapScale;
    box.scrollLeft = px * scale - box.clientWidth / 2;
    box.scrollTop = py * scale - box.clientHeight / 2;
  }
  map.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    e.preventDefault();
    mapTo(e);
    const move = function (ev) { mapTo(ev); }, up = function () { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
  box.addEventListener('scroll', drawView, { passive: true });

  // ---- zoom: ctrl+wheel (a trackpad pinch arrives as one) and Safari's gesture events ------------------
  function wheelZoom(e, cx, cy) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * box.clientHeight : e.deltaY;
    setScale(scale * Math.exp(-Math.max(-100, Math.min(100, d)) * 0.01), cx, cy);
  }
  function local(e) { const r = box.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  box.addEventListener('wheel', function (e) { const p = local(e); wheelZoom(e, p[0], p[1]); }, { passive: false });
  let gesture = 0;
  box.addEventListener('gesturestart', function (e) { e.preventDefault(); gesture = scale; });
  box.addEventListener('gesturechange', function (e) { e.preventDefault(); const p = local(e); setScale(gesture * e.scale, p[0], p[1]); });

  // ---- pan: drag with the middle button; a middle click without a drag still opens a link in a new tab ----
  let pan = null;
  function swallowAuxclick() {
    const stop = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
    window.addEventListener('auxclick', stop, { capture: true, once: true });
    setTimeout(function () { window.removeEventListener('auxclick', stop, true); }, 0);
  }
  function panStart(e, x, y) {
    if (e.button !== 1) return;
    e.preventDefault();
    pan = { x: x, y: y, left: box.scrollLeft, top: box.scrollTop, moved: false };
    document.body.classList.add('panning');
  }
  function panMove(x, y) {
    if (!pan) return;
    if (Math.abs(x - pan.x) + Math.abs(y - pan.y) > 3) pan.moved = true;
    box.scrollLeft = pan.left - (x - pan.x);
    box.scrollTop = pan.top - (y - pan.y);
  }
  function panEnd(e) {
    if (!pan) return;
    if (pan.moved) swallowAuxclick();
    pan = null;
    document.body.classList.remove('panning');
    e.preventDefault();
  }
  box.addEventListener('mousedown', function (e) { panStart(e, e.clientX, e.clientY); });
  window.addEventListener('mousemove', function (e) { panMove(e.clientX, e.clientY); });
  window.addEventListener('mouseup', function (e) { if (e.button === 1) panEnd(e); });

  // a board in use takes the pointer, so it hands ctrl+wheel and the middle button to the canvas (the
  // boards are served from this origin). Positions inside the board are in its own, unscaled pixels.
  function forward(f) {
    let w;
    try { w = f.contentWindow; if (!w || !w.document) return; } catch (e) { return; }
    function at(e) {
      const r = f.getBoundingClientRect(), b = box.getBoundingClientRect();
      const x = r.left + e.clientX * scale, y = r.top + e.clientY * scale;
      return [x - b.left, y - b.top, x, y];
    }
    w.addEventListener('wheel', function (e) { const p = at(e); wheelZoom(e, p[0], p[1]); }, { passive: false });
    w.addEventListener('mousedown', function (e) { const p = at(e); panStart(e, p[2], p[3]); });
    w.addEventListener('mousemove', function (e) { if (pan) { const p = at(e); panMove(p[2], p[3]); } });
    w.addEventListener('mouseup', function (e) { if (e.button === 1) panEnd(e); });
  }

  // ---- controls and keys --------------------------------------------------------------------------
  zoom.oninput = function () { setScale(Number(zoom.value) / 100); };
  document.getElementById('in').onclick = function () { setScale(scale * 1.25); };
  document.getElementById('out').onclick = function () { setScale(scale / 1.25); };
  document.getElementById('fit').onclick = fit;
  document.getElementById('actual').onclick = function () { setScale(1); };
  live.onchange = function () { B.put('boards.live', live.checked ? '1' : '0'); if (data) draw(); };
  use.onchange = function () { B.put('boards.use', use.checked ? '1' : '0'); syncUse(); };
  changedOnly.onchange = function () { B.put('boards.changedOnly', changedOnly.checked ? '1' : '0'); outline(); };
  filter.addEventListener('input', outline);
  filter.addEventListener('keydown', function (e) { if (e.key === 'Enter') { const first = items.filter(matches)[0]; if (first) { choose(first.file, true); filter.blur(); } } });
  const toggle = function (c) { return function () { if (!c.disabled) { c.checked = !c.checked; c.dispatchEvent(new Event('change')); } }; };
  B.keys({
    j: function () { step(1); }, k: function () { step(-1); },
    enter: function () { if (chosen) location.href = viewHref(chosen); else return false; },
    m: function () { location.href = 'matrix.html' + L.serialise(Object.assign({ board: chosen || items[0] && items[0].file, state: addr.state }, keepRender())); },
    1: fit, 0: function () { setScale(1); }, '+': function () { setScale(scale * 1.25); }, '=': function () { setScale(scale * 1.25); }, '-': function () { setScale(scale / 1.25); },
    escape: function () { if (chosen) choose(null); else return false; },
    f: function () { filter.focus(); }, l: toggle(live), u: toggle(use), c: function () { if (rv) toggle(changedOnly)(); },
  });
  bar.onRender(function () {
    if (!data) return;
    for (const b of items) { const t = tiles.get(b.file), f = t && t.querySelector('iframe'); if (f) f.setAttribute('src', tileSrc(b)); }
    inspector();
    drawRail(L.pagesOf(data));
  });
  window.addEventListener('popstate', function () {
    addr = B.address(); page = addr.page; chosen = addr.board;
    if (data) draw(true);
  });
  window.addEventListener('resize', function () { drawMap(); });

  function load(fresh) {
    Promise.all([B.canvas(fresh), B.review()]).then(function (all) {
      data = all[0]; rv = all[1]; changes = B.changesOf(rv);
      errors = new Map();
      draw(false);
      if (chosen) revealTile(chosen);
    }, function (e) { plane.textContent = String(e.message || e); });
  }
  B.onChange(function () { load(true); });
  load(false);
})();
