// SPDX-License-Identifier: GPL-2.0-or-later
// Shared by every preview page (spec 003 FR-010, FR-051..FR-054, FR-058, FR-061): the canvas data,
// live reload, the pure logic of addresses, matrix axes, the flow map and search, and the top bar
// with the render picker, search and keys. Every URL is relative to the page (the design folder is
// the parent of _boards/), so the same pages work from the preview server and from a static export
// under any sub-path (tools/boards export).
//
// In node, require() gives the pure logic (window.Boards.logic in the browser) for the tests.
(function (root, factory) {
  'use strict';
  const logic = factory();
  if (typeof module === 'object' && module.exports) module.exports = logic;
  else root.BoardsLogic = logic;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VOICES = [['white', 'White'], ['editorial', 'Editorial'], ['stationery', 'Stationery']];
  const SCHEMES = [['paper', 'Paper'], ['night', 'Night'], ['eink', 'E-ink']];
  const PENS = [['1', 'Pen 1'], ['2', 'Pen 2'], ['3', 'Pen 3']];
  const AXES = ['voice', 'scheme', 'pen', 'state'];
  const LOOKS = ['sheet', 'device'];
  const ID = /^[a-z0-9][a-z0-9._-]*$/;
  const ids = function (list) { return list.map(function (x) { return x[0]; }); };

  // ---- addresses (FR-052): one parameter per thing shown, every one optional ----------------------
  // the order parameters are written in; "board" first, so a board's address starts view.html?board=
  const ORDER = ['board', 'page', 'state', 'voice', 'scheme', 'pen', 'look', 'size', 'rows', 'cols', 'at', 'from', 'step', 'compare'];

  // parse(search) → {board, page, state, voice, scheme, pen, look, size, rows, cols, at, from, step,
  // compare, props: {NAME: value}}; a value outside its choices is left out (null)
  function parse(search) {
    const q = typeof search === 'string' ? new URLSearchParams(search) : search;
    const one = function (k, ok) { const v = q.get(k); return v !== null && v !== '' && (!ok || ok(v)) ? v : null; };
    const inList = function (list) { return function (v) { return ids(list).indexOf(v) >= 0; }; };
    const a = {
      board: one('board'), page: one('page'), state: one('state', function (v) { return ID.test(v); }),
      voice: one('voice', inList(VOICES)), scheme: one('scheme', inList(SCHEMES)), pen: one('pen', inList(PENS)),
      look: one('look', function (v) { return LOOKS.indexOf(v) >= 0; }),
      size: one('size', function (v) { return v === 'fill' || /^\d{1,5}x\d{1,5}$/.test(v); }),
      rows: one('rows', function (v) { return AXES.indexOf(v) >= 0; }), cols: one('cols', function (v) { return AXES.indexOf(v) >= 0; }),
      at: one('at', function (v) { return /^\d{1,3},\d{1,3}$/.test(v); }), from: one('from'),
      step: one('step', function (v) { return /^\d{1,4}$/.test(v); }), compare: one('compare'), props: {},
    };
    for (const [k, v] of q) if (k.indexOf('p.') === 0 && /^[A-Za-z_$][\w$]*$/.test(k.slice(2))) a.props[k.slice(2)] = v;
    return a;
  }

  // serialise(addr) → '?board=…&…' ('' when empty), in ORDER, then the props as p.NAME
  function serialise(a) {
    const parts = [];
    for (const k of ORDER) if (a[k] !== null && a[k] !== undefined && a[k] !== '') parts.push(k + '=' + encodeURIComponent(String(a[k])));
    const props = a.props || {};
    for (const k of Object.keys(props).sort()) if (props[k] !== null && props[k] !== undefined) parts.push('p.' + k + '=' + encodeURIComponent(String(props[k])));
    return parts.length ? '?' + parts.join('&') : '';
  }

  // a board's own address in the design folder, from a page in _boards/: the render, a state and
  // props as the runtime reads them (?voice=&scheme=&pen=&state=&p.NAME=)
  function boardHref(file) { return '../' + String(file).split('/').map(encodeURIComponent).join('/'); }
  function boardSrc(file, o) {
    o = o || {};
    const r = o.render || {}, parts = [];
    for (const k of ['voice', 'scheme', 'pen']) if (r[k]) parts.push(k + '=' + encodeURIComponent(r[k]));
    if (o.state) parts.push('state=' + encodeURIComponent(o.state));
    const props = o.props || {};
    for (const k of Object.keys(props).sort()) parts.push('p.' + k + '=' + encodeURIComponent(String(props[k])));
    return boardHref(file) + (parts.length ? '?' + parts.join('&') : '');
  }

  // the render every board is shown in: the address wins, else what was remembered
  function render(addr, stored) {
    const out = {};
    for (const k of ['voice', 'scheme', 'pen']) out[k] = addr && addr[k] || stored && stored[k] || null;
    return out;
  }
  function theme(voice, scheme) { return (voice || 'white') + '-' + (scheme || 'paper'); }
  function name(list, id) { const x = list.find(function (e) { return e[0] === id; }); return x ? x[1] : null; }
  // "White · Paper · Pen 1", each board's own where none is chosen
  function renderName(r) {
    if (!r.voice && !r.scheme && !r.pen) return 'As each board';
    return [name(VOICES, r.voice) || 'Own voice', name(SCHEMES, r.scheme) || 'own scheme', name(PENS, r.pen) || 'own pen'].join(' · ');
  }

  // the command that renders a board as shown (FR-010, FR-014)
  function shotCommand(path, r, state, size) {
    let s = 'tools/boards shot ' + path;
    for (const k of ['voice', 'scheme', 'pen']) if (r && r[k]) s += ' --' + k + ' ' + r[k];
    if (state) s += ' --state ' + state;
    if (size) s += ' --size ' + size;
    return s;
  }

  // ---- boards on a page ---------------------------------------------------------------------------
  function pagesOf(d) { return d.pages && d.pages.length ? d.pages : [{ id: null, name: 'Boards' }]; }
  function onPage(d, page) {
    const flat = !(d.pages && d.pages.length);
    return d.boards.filter(function (b) { return b.onCanvas && (flat || b.page === page); });
  }
  // reading order: by rows (boards whose tops lie within half the smaller height share a row), then left to right
  function readingOrder(list) {
    const s = list.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    const rows = [];
    for (const b of s) {
      const r = rows[rows.length - 1];
      if (r && b.y - r.y < Math.min(r.h, b.h) / 2) r.items.push(b); else rows.push({ y: b.y, h: b.h, items: [b] });
    }
    return [].concat.apply([], rows.map(function (r) { return r.items.sort(function (a, b) { return a.x - b.x; }); }));
  }
  // the boards that link to file: [{file, text}]
  function linksIn(d, file) {
    const out = [];
    for (const b of d.boards) for (const l of b.links || []) if (l.to === file && b.file !== file) out.push({ file: b.file, text: l.text || '' });
    return out;
  }

  // ---- matrix (FR-054): one board in every combination of two of voice, scheme, pen, state --------
  function axisValues(axis, board) {
    if (axis === 'voice') return VOICES.map(function (x) { return { id: x[0], name: x[1] }; });
    if (axis === 'scheme') return SCHEMES.map(function (x) { return { id: x[0], name: x[1] }; });
    if (axis === 'pen') return PENS.map(function (x) { return { id: x[0], name: x[1] }; });
    return (board && board.states || []).map(function (s) { return { id: s.id, name: s.name || s.id }; });
  }
  function axesOf(board) { return AXES.filter(function (a) { return axisValues(a, board).length; }); }
  // matrix(board, {rows, cols, at, render, state}) → {rows, cols, rowValues, colValues, at: [r, c],
  // cells: [[{r, c, render, state, row, col}]]}. Rows and cols are two different axes the board has
  // (state only with named states); default voice × scheme. The render and state given fill the
  // axes not shown.
  function matrix(board, o) {
    o = o || {};
    const axes = axesOf(board);
    const rows = axes.indexOf(o.rows) >= 0 ? o.rows : 'voice';
    let cols = axes.indexOf(o.cols) >= 0 && o.cols !== rows ? o.cols : rows === 'voice' ? 'scheme' : 'voice';
    const rv = axisValues(rows, board), cv = axisValues(cols, board);
    const cells = rv.map(function (r, i) {
      return cv.map(function (c, j) {
        const ren = { voice: o.render && o.render.voice || null, scheme: o.render && o.render.scheme || null, pen: o.render && o.render.pen || null };
        let state = o.state || null;
        for (const [axis, v] of [[rows, r.id], [cols, c.id]]) { if (axis === 'state') state = v; else ren[axis] = v; }
        return { r: i, c: j, render: ren, state: state, row: r, col: c };
      });
    });
    let at = [0, 0];
    if (o.at) { const p = String(o.at).split(',').map(Number); at = [Math.min(Math.max(0, p[0] || 0), rv.length - 1), Math.min(Math.max(0, p[1] || 0), cv.length - 1)]; }
    return { rows: rows, cols: cols, rowValues: rv, colValues: cv, cells: cells, at: at };
  }

  // ---- flow (FR-058): the boards of a page as a map ------------------------------------------------
  // flow(d, page) → {nodes: [{id, file, state, stateName, title, offPage, page}], edges: [{from, to,
  // label, kind}], apart: [ids of nodes no arrow touches]}. A node is a board ("file") or a named
  // state that takes part in a step ("file#state"). A link from a board of the page is a "link" edge
  // (to a board on another page too, marked offPage); a state's `from` is a "state" edge between two
  // states of one board.
  function flow(d, page) {
    const here = onPage(d, page), byFile = new Map(d.boards.map(function (b) { return [b.file, b]; }));
    const nodes = new Map(), edges = [];
    const node = function (b, state, off) {
      const id = state ? b.file + '#' + state : b.file;
      if (!nodes.has(id)) {
        const st = state ? (b.states || []).find(function (s) { return s.id === state; }) : null;
        nodes.set(id, { id: id, file: b.file, state: state || null, title: b.title, stateName: st ? st.name || st.id : null, offPage: !!off, page: b.page });
      }
      return id;
    };
    const order = readingOrder(here);
    for (const b of order) node(b);
    for (const b of order) {
      for (const l of b.links || []) {
        const t = byFile.get(l.to);
        if (!t || t.file === b.file) continue;
        const to = node(t, null, here.indexOf(t) < 0);
        if (!edges.some(function (e) { return e.from === b.file && e.to === to && e.label === (l.text || ''); })) edges.push({ from: b.file, to: to, label: l.text || '', kind: 'link' });
      }
      for (const s of b.states || []) for (const f of s.from || []) {
        if (f.state === s.id || !(b.states || []).some(function (x) { return x.id === f.state; })) continue;
        edges.push({ from: node(b, f.state), to: node(b, s.id), label: f.label || '', kind: 'state' });
      }
    }
    const touched = new Set();
    for (const e of edges) { touched.add(e.from); touched.add(e.to); }
    const list = Array.from(nodes.values());
    return { nodes: list, edges: edges, apart: list.filter(function (n) { return !touched.has(n.id); }).map(function (n) { return n.id; }) };
  }

  // layers(g) → {id: {col, row}} for the nodes an arrow touches: a node's column is one more than
  // the column of a node leading to it, from the starts (nothing leads to them; in a cycle without a
  // start, its first node) depth first; an arrow back along the current path does not move its target
  function layers(g) {
    const apart = new Set(g.apart), list = g.nodes.map(function (n) { return n.id; }).filter(function (id) { return !apart.has(id); });
    const out = new Map(list.map(function (id) { return [id, []]; })), inc = new Map(list.map(function (id) { return [id, 0]; }));
    for (const e of g.edges) { out.get(e.from).push(e.to); inc.set(e.to, inc.get(e.to) + 1); }
    const col = new Map(), onPath = new Set();
    const visit = function (id, c) {
      if (onPath.has(id) || col.has(id) && col.get(id) >= c) return;
      col.set(id, c);
      onPath.add(id);
      for (const t of out.get(id)) visit(t, c + 1);
      onPath.delete(id);
    };
    for (const id of list) if (!inc.get(id)) visit(id, 0);
    for (const id of list) if (!col.has(id)) visit(id, 0);
    const pos = {}, rows = new Map();
    for (const id of list) {
      const c = col.get(id), r = rows.get(c) || 0;
      rows.set(c, r + 1);
      pos[id] = { col: c, row: r };
    }
    return pos;
  }

  // walk(g, from) → [{id, label}]: from a node along the first arrow to a node not yet on the walk
  function walk(g, from) {
    if (!g.nodes.some(function (n) { return n.id === from; })) return [];
    const steps = [{ id: from, label: null }], on = new Set([from]);
    for (;;) {
      const cur = steps[steps.length - 1].id;
      const e = g.edges.find(function (x) { return x.from === cur && !on.has(x.to); });
      if (!e) break;
      steps.push({ id: e.to, label: e.label });
      on.add(e.to);
    }
    return steps;
  }

  // ---- search (FR-053): boards by title and file, states by name, pages by name -------------------
  // a query against a text → {score, at: [start, end] | null}: 0 no match; exact 100, a prefix 80,
  // the start of a word 60, anywhere 40, the letters in order 10
  function score(text, q) {
    const t = String(text || '').toLowerCase();
    if (!q) return { score: 1, at: null };
    if (t === q) return { score: 100, at: [0, q.length] };
    if (t.indexOf(q) === 0) return { score: 80, at: [0, q.length] };
    const m = new RegExp('(^|[^a-z0-9])' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).exec(t);
    if (m) return { score: 60, at: [m.index + m[1].length, m.index + m[1].length + q.length] };
    const i = t.indexOf(q);
    if (i >= 0) return { score: 40, at: [i, i + q.length] };
    let j = 0;
    for (let k = 0; k < t.length && j < q.length; k++) if (t[k] === q[j]) j++;
    return j === q.length && q.length > 1 ? { score: 10, at: null } : { score: 0, at: null };
  }
  // search(d, query, {page, limit}) → [{kind: 'board'|'state'|'page', file, state, page, title, sub,
  // score, at, states}], best first; a match on the current page before an equal one elsewhere. An
  // empty query lists the boards, those of the current page first.
  function search(d, query, o) {
    o = o || {};
    const q = String(query || '').trim().toLowerCase(), out = [];
    const pages = pagesOf(d), pname = function (id) { const p = pages.find(function (x) { return x.id === id; }); return p && p.id ? p.name : ''; };
    for (const b of d.boards) {
      const t = score(b.title, q), f = score(b.file, q);
      const useTitle = t.score >= f.score - 5;
      const best = useTitle ? t.score : f.score - 5;
      if (best > 0) out.push({ kind: 'board', file: b.file, page: b.page, state: null, title: b.title, sub: [pname(b.page), b.file].filter(Boolean).join(' · '), score: best + (b.page === o.page ? 2 : 0), at: useTitle ? t.at : null, states: (b.states || []).length });
      if (!q) continue;
      (b.states || []).forEach(function (s, i) {
        const r = score(s.name || s.id, q), r2 = score(s.id, q);
        const sc = Math.max(r.score, r2.score - 5);
        if (sc > 0) out.push({ kind: 'state', file: b.file, page: b.page, state: s.id, title: s.name || s.id, sub: b.title + ' · state ' + (i + 1) + ' of ' + b.states.length, score: sc - 1 + (b.page === o.page ? 2 : 0), at: r.score >= r2.score - 5 ? r.at : null });
      });
    }
    if (q) for (const p of pages) { if (!p.id) continue; const r = score(p.name, q); if (r.score > 0) out.push({ kind: 'page', file: null, page: p.id, state: null, title: p.name, sub: 'page · ' + onPage(d, p.id).length + ' boards', score: r.score - 2, at: r.at }); }
    if (!q) out.sort(function (a, b) { return (b.page === o.page) - (a.page === o.page); });
    else {
      // letters in order only when nothing holds the query as it is typed
      if (out.some(function (x) { return x.score >= 39; })) for (let i = out.length - 1; i >= 0; i--) if (out[i].score < 20) out.splice(i, 1);
      out.sort(function (a, b) { return b.score - a.score || a.title.length - b.title.length || a.title.localeCompare(b.title); });
    }
    return out.slice(0, o.limit || 30);
  }

  return {
    VOICES: VOICES, SCHEMES: SCHEMES, PENS: PENS, AXES: AXES, parse: parse, serialise: serialise, boardHref: boardHref,
    boardSrc: boardSrc, render: render, theme: theme, name: name, renderName: renderName, shotCommand: shotCommand,
    pagesOf: pagesOf, onPage: onPage, readingOrder: readingOrder, linksIn: linksIn, axisValues: axisValues, axesOf: axesOf,
    matrix: matrix, flow: flow, layers: layers, walk: walk, score: score, search: search,
  };
});

// ---- the browser part: data, the bar, the picker, search, keys --------------------------------------
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const L = window.BoardsLogic;
  const changes = [];
  let watching = false;
  // live reload only where the canvas data says so (the preview server); an export has none
  function watch(d) {
    if (watching || !d.live) return;
    watching = true;
    try { new EventSource('events').addEventListener('change', function (ev) { for (const fn of changes) fn(ev); }); } catch (e) { /* no live reload */ }
  }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* no storage */ } }

  function el(tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids || []) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  }
  // the SVG namespace, read from a parsed svg element (the page names no address of another site)
  const SVG = (function () { const t = document.createElement('div'); t.innerHTML = '<svg></svg>'; return t.firstChild.namespaceURI; })();
  // a 24-unit line icon from path data
  function icon(d) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'vw-ico'); s.setAttribute('aria-hidden', 'true');
    for (const part of [].concat(d)) { const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', part); s.append(p); }
    return s;
  }
  const ICONS = {
    canvas: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
    flow: 'M5 6h5v4H5zM14 14h5v4h-5zM10 8h2a2 2 0 0 1 2 2v4',
    matrix: 'M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z',
    review: 'M4 5h7v14H4zM13 5h7v14h-7z',
    down: 'M7 10l5 5 5-5', search: ['M16 11a5 5 0 1 1-10 0a5 5 0 0 1 10 0', 'M20 20l-4.5-4.5'],
    left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
    sun: ['M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8', 'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5'],
  };

  // a mark by shape (FR-061): interactive ▶, picture only ○, changed ◉, added ⊞, removed ⊟; errors "!"
  const MARKS = { interactive: ['play', 'interactive'], still: ['still', 'picture only'], changed: ['changed', 'changed'], added: ['added', 'added'], removed: ['removed', 'removed'], state: ['state', 'named state'] };
  function mark(kind, title) {
    const m = MARKS[kind];
    return el('span', { class: 'vw-mk vw-mk--' + m[0], role: 'img', 'aria-label': title || m[1], title: title || m[1] });
  }
  function errMark(n, title) { return el('span', { class: 'vw-err', role: 'img', 'aria-label': title || n + ' error' + (n === 1 ? '' : 's'), title: title || n + ' error' + (n === 1 ? '' : 's'), text: String(n) }); }

  // a board in a frame scaled into a box: {box, frame}; lazy unless o.eager, takes no pointer unless o.live
  function frameBox(file, o) {
    o = o || {};
    const w = o.width, h = o.height, s = o.scale;
    const box = el('div', { class: 'vw-fbox' + (o.cls ? ' ' + o.cls : '') });
    box.style.width = Math.round(w * s) + 'px';
    box.style.height = Math.round(h * s) + 'px';
    const f = el('iframe', { src: o.src || L.boardSrc(file, o), loading: o.eager ? null : 'lazy', title: o.title || file, tabindex: o.live ? null : '-1', 'aria-hidden': o.live ? null : 'true' });
    f.style.width = w + 'px';
    f.style.height = h + 'px';
    f.style.transform = 'scale(' + s + ')';
    if (!o.live) f.style.pointerEvents = 'none';
    box.append(f);
    return { box: box, frame: f };
  }
  // the errors a board raised in a frame once it has settled, after each load: fn(errors) (null: no board there)
  function frameErrors(f, fn) {
    let n = 0, gen = 0;
    const check = function (g) {
      if (g !== gen) return;
      let s = null;
      try { s = f.contentWindow && f.contentWindow.__boards; } catch (e) { fn(null); return; }
      if (s && s.settled) { fn(s.errors.slice()); return; }
      if (++n > 150) { fn(s ? s.errors.slice() : null); return; }
      setTimeout(function () { check(g); }, 200);
    };
    f.addEventListener('load', function () { n = 0; gen++; check(gen); });
  }

  // ---- data ---------------------------------------------------------------------------------------
  let canvasP = null, reviewP = null;
  function canvas(fresh) {
    if (!canvasP || fresh) {
      canvasP = fetch('api/canvas.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('canvas: HTTP ' + r.status); return r.json(); })
        .then(function (d) {
          // states and links come with subset 2; older data has none
          for (const b of d.boards) { b.states = b.states || []; b.links = b.links || []; b.issues = b.issues || []; }
          watch(d);
          return d;
        });
    }
    return canvasP;
  }
  // a proposal's review data (api/review.json) or null. It is asked for only where it can exist (the
  // canvas data names it, or the page is in a proposal's export, …/pr-N/…), so no page logs a 404
  function review() {
    if (!reviewP) {
      reviewP = canvas().then(function (d) {
        if (!d.review && !/\/pr-\d+\//.test(location.pathname)) return null;
        return fetch(typeof d.review === 'string' ? d.review : 'api/review.json', { cache: 'no-cache' })
          .then(function (r) { return r.ok ? r.json() : null; }, function () { return null; });
      }).catch(function () { return null; });
    }
    return reviewP;
  }
  // {file: 'changed'|'added'|'removed'} from the review data
  function changesOf(rv) {
    const m = {};
    for (const b of rv && rv.boards || []) m[b.file] = b.change;
    return m;
  }

  // the site's list of designs, from a published address (designs/PROJECT/_boards/ → designs/), or
  // as the canvas data names it; the preview server has none
  function homeHref(d) {
    if (d && d.home) return d.home;
    if (/\/designs\/pr-\d+\/[^/]+\/_boards\//.test(location.pathname)) return '../../../';
    if (/\/designs\/[^/]+\/_boards\//.test(location.pathname)) return '../../';
    return null;
  }

  // ---- the render every board is shown in (FR-052): in the address, remembered in boards.render -------
  function storedRender() {
    try { const v = JSON.parse(get('boards.render') || 'null'); return L.render(L.parse(L.serialise(v && typeof v === 'object' ? v : {})), null); } catch (e) { return L.render(null, null); }
  }
  function currentRender() { return L.render(L.parse(location.search), storedRender()); }
  const renderFns = [];
  // every board's render: into the address and remembered; then the page's listeners redraw
  function setRender(r) {
    const cur = L.render(r, null);
    put('boards.render', JSON.stringify(cur));
    const a = L.parse(location.search);
    a.voice = cur.voice; a.scheme = cur.scheme; a.pen = cur.pen;
    setAddress(a);
    for (const fn of renderFns) fn(cur);
  }
  function setAddress(a, push) {
    const s = location.pathname + L.serialise(a);
    if (s !== location.pathname + location.search) history[push ? 'pushState' : 'replaceState'](null, '', s);
  }

  // ---- the viewer's own look (FR-061): Interleaf White, paper or night, never the boards' voice -------
  function chrome() {
    const v = get('boards.chrome');
    if (v === 'white-night' || v === 'white-paper') return v;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'white-night' : 'white-paper';
  }
  function applyChrome(t) { document.documentElement.setAttribute('data-theme', t); }
  let syncChrome = function () {};
  function toggleChrome() { const t = chrome() === 'white-night' ? 'white-paper' : 'white-night'; put('boards.chrome', t); applyChrome(t); syncChrome(); }
  applyChrome(chrome());
  // the web form and the preview's style, for a page that brought only this script
  function ensureStyles() {
    const want = ['../ds/web/tokens.css', '../ds/web/bundle.css', 'preview.css'];
    const have = Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(function (l) { return l.getAttribute('href'); });
    const first = document.head.querySelector('link[rel=stylesheet]');
    for (const h of want) if (have.indexOf(h) < 0) document.head.insertBefore(el('link', { rel: 'stylesheet', href: h }), h === 'preview.css' ? null : first);
  }

  // ---- keys (FR-061): a table per page, the last added first ------------------------------------------
  const keymap = [];
  // keys({key: fn}): a key is 'j', 'enter', 'escape', '1', 'arrowleft' … (no modifier); fn returning
  // false lets the browser have the key too
  function keys(map) { keymap.push(map); }
  function typing(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !/^(checkbox|radio|range|button)$/.test(t.type)); }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSearch(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape' && closePops()) { e.preventDefault(); return; }
    if (typing(e.target)) { if (e.key === 'Escape') e.target.blur(); return; }
    if (pop) return;
    if (e.key === '/') { e.preventDefault(); openSearch(); return; }
    const k = e.key.toLowerCase();
    for (let i = keymap.length - 1; i >= 0; i--) if (keymap[i][k]) { if (keymap[i][k](e) !== false) e.preventDefault(); return; }
  });

  // ---- popovers ------------------------------------------------------------------------------------
  let pop = null;
  function closePops() {
    if (!pop) return false;
    const p = pop; pop = null;
    p.close();
    return true;
  }
  function openPop(node, dark, onClose, focus) {
    closePops();
    const s = el('div', { class: 'vw-scrim' + (dark ? '' : ' vw-scrim--clear') });
    s.addEventListener('mousedown', function (e) { if (e.target === s) closePops(); });
    s.append(node);
    document.body.append(s);
    const back = document.activeElement;
    pop = { close: function () { s.remove(); if (onClose) onClose(); if (back && back.focus) try { back.focus(); } catch (e) { /* gone */ } } };
    if (focus) focus.focus();
    return pop;
  }

  // ---- the render picker: voice, scheme and pen by picture ------------------------------------------
  // a small screen drawn in a theme's own colours and type, so each choice is a picture of itself
  function swatch(voice, scheme, pen) {
    return el('div', { class: 'vw-swatch__img', 'data-theme': L.theme(voice, scheme), 'data-pen': pen || '1', 'aria-hidden': 'true' }, [
      el('div', { class: 'vw-sw' }, [el('i', { class: 'vw-sw__bar' }), el('b', { class: 'vw-sw__aa', text: 'Aa' }), el('i', { class: 'vw-sw__l' }), el('i', { class: 'vw-sw__l vw-sw__l--s' }), el('i', { class: 'vw-sw__pen' })]),
    ]);
  }
  function openPicker(anchor) {
    const r = currentRender();
    const box = el('div', { class: 'vw-pop vw-picker', role: 'dialog', 'aria-label': 'Render every board in' });
    const group = function (key, list, label) {
      box.append(el('h3', { text: label }));
      const g = el('div', { class: key === 'pen' ? 'vw-seg' : 'vw-swatches', role: 'radiogroup', 'aria-label': label });
      for (const o of [[null, 'Own']].concat(list)) {
        const on = r[key] === o[0];
        const pick = function () { const n = Object.assign({}, currentRender()); n[key] = o[0]; setRender(n); openPicker(anchor); };
        const tip = o[0] ? o[1] : 'each board\'s own ' + key;
        if (key === 'pen') {
          g.append(el('button', { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'aria-pressed': on ? 'true' : 'false', 'data-key': key, 'data-value': o[0] || '', onclick: pick, title: tip },
            [o[0] ? el('span', { class: 'vw-pen', 'data-theme': L.theme(r.voice, r.scheme), 'data-pen': o[0] }) : null, o[1]]));
        } else {
          const v = key === 'voice' ? o[0] : r.voice, s = key === 'scheme' ? o[0] : r.scheme;
          g.append(el('button', { type: 'button', class: 'vw-swatch', role: 'radio', 'aria-checked': on ? 'true' : 'false', 'aria-pressed': on ? 'true' : 'false', 'data-key': key, 'data-value': o[0] || '', onclick: pick, title: tip },
            [o[0] ? swatch(v, s, r.pen) : el('div', { class: 'vw-swatch__img vw-swatch__img--own', 'aria-hidden': 'true', text: 'as drawn' }), el('span', { text: o[1] })]));
        }
      }
      box.append(g);
    };
    group('voice', L.VOICES, 'Voice');
    group('scheme', L.SCHEMES, 'Scheme');
    group('pen', L.PENS, 'Pen');
    const a = L.parse(location.search);
    const mx = a.board ? el('a', { class: 'vw-btn vw-btn--flat', href: 'matrix.html' + L.serialise({ board: a.board, rows: 'voice', cols: 'scheme', pen: r.pen }), text: 'All 9 side by side' }) : null;
    box.append(el('footer', {}, [el('span', { class: 'vw-soft vw-grow', text: 'Every board on every page. One board can differ: in its own view.' }), mx]));
    const rect = anchor.getBoundingClientRect();
    box.style.top = (rect.bottom + 6) + 'px';
    box.style.right = Math.max(8, document.documentElement.clientWidth - rect.right) + 'px';
    anchor.setAttribute('aria-expanded', 'true');
    openPop(box, false, function () { anchor.setAttribute('aria-expanded', 'false'); }, box.querySelector('[aria-checked="true"]'));
  }

  // ---- search: ⌘K or / (FR-053) --------------------------------------------------------------------
  function highlight(text, at) {
    if (!at) return [text];
    return [text.slice(0, at[0]), el('mark', { text: text.slice(at[0], at[1]) }), text.slice(at[1])];
  }
  function openSearch() {
    if (pop && pop.search) { pop.search.focus(); return; }
    const box = el('div', { class: 'vw-pop vw-palette', role: 'dialog', 'aria-label': 'Search boards, states and pages' });
    const input = el('input', { type: 'search', class: 'vw-palette__q', placeholder: 'Boards, states, pages', 'aria-label': 'Search', autocomplete: 'off', spellcheck: 'false', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'vw-results' });
    const list = el('div', { class: 'vw-palette__list', id: 'vw-results', role: 'listbox' });
    const k = function (t) { return el('span', { class: 'vw-key', text: t }); };
    box.append(el('div', { class: 'vw-palette__in' }, [icon(ICONS.search), input, el('span', { class: 'vw-tag', text: 'this design' })]), list,
      el('footer', {}, [el('span', {}, [k('↑'), ' ', k('↓'), ' choose']), el('span', {}, [k('⏎'), ' open']), el('span', {}, [k('⇧⏎'), ' matrix']), el('span', { class: 'vw-grow' }), k('esc')]));
    let items = [], sel = 0, data = null;
    const go = function (it, inMatrix) {
      if (!it) return;
      const r = currentRender(), base = { voice: r.voice, scheme: r.scheme, pen: r.pen };
      closePops();
      if (it.kind === 'page') location.href = 'index.html' + L.serialise(Object.assign({ page: it.page }, base));
      else if (inMatrix) location.href = 'matrix.html' + L.serialise(Object.assign({ board: it.file, state: it.state }, base));
      else location.href = 'view.html' + L.serialise(Object.assign({ board: it.file, state: it.state }, base));
    };
    const show = function () {
      list.querySelectorAll('.vw-palette__item').forEach(function (r, i) { r.setAttribute('aria-selected', i === sel ? 'true' : 'false'); if (i === sel && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); });
      input.setAttribute('aria-activedescendant', items.length ? 'vw-r' + sel : '');
    };
    const draw = function () {
      list.textContent = '';
      const a = L.parse(location.search);
      const page = a.page || data && (data.boards.find(function (b) { return b.file === a.board; }) || {}).page;
      items = data ? L.search(data, input.value, { page: page, limit: 40 }) : [];
      sel = Math.min(sel, Math.max(0, items.length - 1));
      let group = null;
      items.forEach(function (it, i) {
        const g = { board: 'Boards', state: 'States', page: 'Pages' }[it.kind];
        if (g !== group) { list.append(el('h3', { text: g })); group = g; }
        const row = el('div', { class: 'vw-palette__item', role: 'option', id: 'vw-r' + i, 'data-kind': it.kind, 'data-file': it.file || '', 'data-state': it.state || '', 'aria-selected': 'false' }, [
          el('span', { class: 'vw-palette__thumb', 'aria-hidden': 'true' }, [it.kind === 'page' ? icon(ICONS.canvas) : el('span', { class: 'vw-mk vw-mk--' + (it.kind === 'state' ? 'state' : 'play') })]),
          el('span', { class: 'vw-palette__text' }, [el('b', {}, highlight(it.title, it.at)), el('small', { class: 'vw-soft', text: it.sub })]),
          it.states ? el('span', { class: 'vw-soft vw-small', text: it.states + ' state' + (it.states === 1 ? '' : 's') }) : el('span'),
        ]);
        row.addEventListener('mousemove', function () { if (sel !== i) { sel = i; show(); } });
        row.addEventListener('click', function (e) { go(it, e.shiftKey); });
        list.append(row);
      });
      if (!items.length) list.append(el('p', { class: 'vw-palette__none vw-soft', text: data ? 'Nothing by that name.' : 'Loading…' }));
      show();
    };
    input.addEventListener('input', function () { sel = 0; draw(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); show(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); show(); }
      else if (e.key === 'Enter') { e.preventDefault(); go(items[sel], e.shiftKey); }
    });
    openPop(box, true, null, input).search = input;
    draw();
    canvas().then(function (d) { data = d; draw(); });
  }

  // ---- the top bar (every page; the review page too) ------------------------------------------------
  // bar(mode, opts) puts the bar at the top of document.body (or opts.into) and returns its header
  //   element, carrying el (itself), ready: Promise<{data, review}>, render: () => {voice, scheme, pen}, onRender(fn)
  // mode: 'canvas' | 'board' | 'flow' | 'matrix' | 'review'. A render picked in it goes into the
  // address and localStorage boards.render, then every onRender listener runs with it. It adds the
  // web form and preview.css when the page lacks them, the chrome's data-theme, and the keys ⌘K, /, T.
  function bar(mode, opts) {
    opts = opts || {};
    ensureStyles();
    document.body.classList.add('vw');
    const header = el('header', { class: 'vw-bar', id: 'bar' });
    const home = el('span', { class: 'vw-brand' }, [el('span', { class: 'vw-brand__mark', 'aria-hidden': 'true' }), 'Boards']);
    const title = el('strong', { class: 'vw-crumb', id: 'title', text: '…' });
    const rev = el('span', { class: 'vw-rev', title: 'The main line', text: 'main' });
    const modes = el('nav', { class: 'vw-modes', 'aria-label': 'Views' });
    const pick = el('button', { type: 'button', class: 'vw-render', id: 'render', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'How every board renders' });
    const find = el('button', { type: 'button', class: 'vw-search-btn', title: 'Search (⌘K or /)', 'aria-keyshortcuts': 'Control+K Meta+K /' },
      [icon(ICONS.search), el('span', { class: 'vw-grow vw-search-btn__t', text: 'Boards, states, pages' }), el('span', { class: 'vw-key', text: '⌘K' })]);
    const night = el('button', { type: 'button', class: 'vw-icon-btn', id: 'chrome', 'aria-keyshortcuts': 't' });
    syncChrome = function () {
      const n = chrome() === 'white-night';
      night.textContent = '';
      night.append(icon(n ? ICONS.sun : ICONS.moon));
      night.setAttribute('aria-label', n ? 'Viewer on paper' : 'Viewer at night');
      night.title = (n ? 'Paper' : 'Night') + ' (T)';
    };
    syncChrome();
    night.onclick = toggleChrome;
    pick.onclick = function () { if (pop) closePops(); else openPicker(pick); };
    find.onclick = openSearch;
    const drawPick = function () {
      const r = currentRender();
      pick.textContent = '';
      pick.append(el('span', { class: 'vw-render__sw', 'data-theme': L.theme(r.voice, r.scheme), 'aria-hidden': 'true' }, [el('span'), el('span')]),
        el('span', { class: 'vw-render__t', text: L.renderName(r) }), icon(ICONS.down));
    };
    drawPick();
    renderFns.push(drawPick);
    header.append(home, el('span', { class: 'vw-slash', 'aria-hidden': 'true', text: '/' }), title, rev, modes, pick, find, night);
    const into = opts.into || document.body;
    into.insertBefore(header, into.firstChild);
    keys({ t: toggleChrome });
    const fillModes = function (d, rv) {
      const a = L.parse(location.search), r = currentRender();
      const keep = { voice: r.voice, scheme: r.scheme, pen: r.pen };
      const board = a.board || a.from || null;
      const page = a.page || (board && (d.boards.find(function (b) { return b.file === board; }) || {}).page) || null;
      const list = [
        ['canvas', 'Canvas', 'index.html' + L.serialise(Object.assign({ page: page, board: board }, keep))],
        ['flow', 'Flow', 'flow.html' + L.serialise(Object.assign({ page: page, from: board }, keep))],
        ['matrix', 'Matrix', 'matrix.html' + L.serialise(Object.assign({ board: board }, keep))],
      ];
      if (rv) list.push(['review', 'Review', 'review.html' + L.serialise(Object.assign({ board: board }, keep))]);
      modes.textContent = '';
      for (const m of list) {
        const cur = m[0] === mode || mode === 'board' && m[0] === 'canvas';
        const n = m[0] === 'review' ? (rv.boards || []).length : null;
        modes.append(el('a', { href: m[2], 'data-mode': m[0], 'aria-current': cur ? 'page' : null, title: m[1] + (m[0] === 'matrix' ? ' (M)' : '') }, [icon(ICONS[m[0]]), el('span', { class: 'vw-modes__t', text: m[1] }), n ? el('span', { class: 'vw-count', text: String(n) }) : null]));
      }
    };
    const ready = Promise.all([canvas(), review()]).then(function (all) {
      const d = all[0], rv = all[1];
      title.textContent = d.title;
      if (!opts.keepTitle) document.title = d.title + ' · boards';
      const h = homeHref(d);
      if (h) home.replaceWith(el('a', { class: 'vw-brand', href: h, title: 'All designs' }, Array.from(home.childNodes)));
      if (rv && rv.pr) {
        rev.className = 'vw-rev vw-rev--pr';
        rev.title = 'Proposal #' + rv.pr.number + (rv.pr.title ? ': ' + rv.pr.title : '');
        rev.textContent = '#' + rv.pr.number + ' · ' + (rv.boards || []).length + ' changed';
      }
      fillModes(d, rv);
      // the views follow the board and the render the page shows
      const refill = function () { fillModes(d, rv); };
      renderFns.push(refill);
      window.addEventListener('popstate', refill);
      window.addEventListener('boards:address', refill);
      return { data: d, review: rv };
    });
    ready.catch(function (e) { title.textContent = String(e && e.message || e); });
    // the header element itself (review.html puts it in place of its own bar), with the page hooks on it
    return Object.assign(header, { el: header, ready: ready, render: currentRender, onRender: function (fn) { renderFns.push(fn); } });
  }

  function copy(text, btn) {
    const done = function () { if (!btn) return; const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = t; }, 1200); };
    const ask = function () { window.prompt('Copy:', text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, ask); else ask();
  }

  // a board's path for the shot command: below the canvas data's "folder", else designs/PROJECT from
  // a published address, else the board's path in its design folder
  function boardPath(d, file) {
    if (d && d.folder) return String(d.folder).replace(/\/$/, '') + '/' + file;
    const m = /\/designs\/(?:pr-\d+\/)?([^/]+)\/_boards\//.exec(location.pathname);
    return m ? 'designs/' + decodeURIComponent(m[1]) + '/' + file : file;
  }

  window.Boards = {
    SVG: SVG,
    logic: L, canvas: canvas, review: review, changesOf: changesOf, onChange: function (fn) { changes.push(fn); },
    el: el, icon: icon, ICONS: ICONS, mark: mark, errMark: errMark, frameBox: frameBox, frameErrors: frameErrors,
    // the design folder, and a board's URL in it
    root: new URL('../', location.href), boardHref: L.boardHref, boardSrc: L.boardSrc,
    render: currentRender, storedRender: storedRender, setRender: setRender, onRender: function (fn) { renderFns.push(fn); },
    address: function () { return L.parse(location.search); },
    // a new address for the page (the bar's views follow it)
    setAddress: function (a, push) { setAddress(a, push); window.dispatchEvent(new Event('boards:address')); },
    get: get, put: put, keys: keys, bar: bar, openSearch: openSearch, closePops: closePops, copy: copy, boardPath: boardPath, homeHref: homeHref,
  };
})();
