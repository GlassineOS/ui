// SPDX-License-Identifier: GPL-2.0-or-later
// The flow (003 FR-058): the boards of a page as a map, drawn from the boards themselves: an arrow
// for each link from a board to another (solid) and for each named state reached from another
// (dashed), labelled with the link's words or the step's; boards no arrow touches listed apart under
// "Not reached"; a walk along the arrows from a chosen board, step by step (J/K, ⏎ opens the step).
// Address: flow.html?page=ID&from=FILE[#STATE]&step=N (and voice, scheme, pen).
(function () {
  'use strict';
  const B = window.Boards, L = B.logic, el = B.el;
  const bar = B.bar('flow');
  const box = document.getElementById('canvas'), sizer = document.getElementById('sizer'), plane = document.getElementById('plane');
  const NH = 220, GAPX = 150, GAPY = 120, PAD = 80, SVGNS = 'http://www.w3.org/2000/svg';
  let data = null, page = null, g = null, steps = [], at = 0, scale = 0.5, planeW = 0, planeH = 0;
  let nodeEls = new Map(), edgeEls = [];

  function a() { return B.address(); }
  function keep() { const r = B.render(); return { voice: r.voice, scheme: r.scheme, pen: r.pen }; }
  function byFile(f) { return data.boards.find(function (b) { return b.file === f; }); }
  function nodeOf(id) { return g.nodes.find(function (n) { return n.id === id; }); }
  function viewOf(n) { return 'view.html' + L.serialise(Object.assign({ board: n.file, state: n.state }, keep())); }
  function nodeName(n) { return n.title + (n.stateName ? ' · ' + n.stateName : ''); }
  function write(push) { const q = a(); q.page = page; q.from = steps.length ? steps[0].id : null; q.step = steps.length > 1 ? String(at + 1) : null; q.board = null; B.setAddress(q, push); }

  function setScale(s) {
    scale = Math.max(0.05, Math.min(2, s));
    plane.style.transform = 'scale(' + scale + ')';
    sizer.style.width = planeW * scale + 'px';
    sizer.style.height = planeH * scale + 'px';
    B.put('boards.flowZoom', String(scale));
  }
  function fit() { setScale(Math.min(1, (box.clientWidth - 24) / planeW, (box.clientHeight - 90) / planeH)); box.scrollLeft = 0; box.scrollTop = 0; }

  function frameNode(n, s, cls) {
    const b = byFile(n.file);
    const w = Math.round(b.size.width * s), h = Math.round(b.size.height * s);
    const d = el('div', { class: 'vw-node' + (n.offPage ? ' vw-node--off' : '') + (cls ? ' ' + cls : ''), 'data-id': n.id });
    d.style.width = w + 'px';
    d.style.height = h + 'px';
    const ch = B.changesOf(rv)[n.file];
    d.append(el('div', { class: 'vw-node__label' }, [ch ? B.mark(ch) : null, B.mark(n.state ? 'state' : b.interactive ? 'interactive' : 'still'),
      el('a', { class: 'vw-t', href: viewOf(n), title: nodeName(n) + ' · ' + n.file, text: n.title })]));
    const fb = B.frameBox(n.file, { width: b.size.width, height: b.size.height, scale: s, render: B.render(), state: n.state, title: nodeName(n) });
    fb.box.addEventListener('click', function () { start(n.id); });
    fb.box.addEventListener('dblclick', function () { location.href = viewOf(n); });
    fb.box.title = nodeName(n) + ': walk from here (double click opens it)';
    d.append(fb.box);
    if (n.state || n.offPage) d.append(el('div', { class: 'vw-node__tag' }, [el('span', { class: 'vw-tag', text: n.state ? 'state · ' + n.stateName : 'on ' + ((L.pagesOf(data).find(function (p) { return p.id === n.page; }) || {}).name || 'another page') })]));
    return { el: d, w: w, h: h };
  }

  let rv = null;
  function draw() {
    plane.textContent = '';
    nodeEls = new Map(); edgeEls = [];
    const pages = L.pagesOf(data), q = a();
    page = q.page;
    const fromFile = q.from && q.from.split('#')[0];
    if (!pages.some(function (p) { return p.id === page; })) {
      const fb = fromFile && byFile(fromFile);
      page = fb && fb.onCanvas ? fb.page : data.launch && data.launch.page || pages[0].id;
      if (!pages.some(function (p) { return p.id === page; })) page = pages[0].id;
    }
    g = L.flow(data, page);
    const pos = L.layers(g);
    // columns as wide as their widest node, rows as tall as a node
    const sizes = new Map();
    for (const n of g.nodes) { const b = byFile(n.file); const s = Math.min(NH / b.size.height, 260 / b.size.width); sizes.set(n.id, { s: s, w: b.size.width * s, h: b.size.height * s }); }
    const colW = [], rowsIn = [];
    for (const id of Object.keys(pos)) { const p = pos[id]; colW[p.col] = Math.max(colW[p.col] || 0, sizes.get(id).w); rowsIn[p.col] = Math.max(rowsIn[p.col] || 0, p.row + 1); }
    const colX = []; let x = PAD;
    for (let c = 0; c < colW.length; c++) { colX[c] = x; x += (colW[c] || 0) + GAPX; }
    const maxRows = Math.max(0, ...rowsIn.map(function (r) { return r || 0; }));
    const graphH = maxRows ? maxRows * (NH + GAPY) : 0;
    const place = new Map();
    for (const id of Object.keys(pos)) {
      const p = pos[id], sz = sizes.get(id);
      // a column with fewer rows sits in the middle of the tallest one
      const off = ((maxRows - rowsIn[p.col]) * (NH + GAPY)) / 2;
      const nx = colX[p.col] + (colW[p.col] - sz.w) / 2, ny = PAD + 30 + off + p.row * (NH + GAPY) + (NH - sz.h) / 2;
      const fn = frameNode(nodeOf(id), sz.s);
      fn.el.style.left = nx + 'px';
      fn.el.style.top = ny + 'px';
      plane.append(fn.el);
      nodeEls.set(id, fn.el);
      place.set(id, { x: nx, y: ny, w: fn.w, h: fn.h });
    }
    // the arrows: forward from right to left side, backwards (or within a column) under both
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'vw-edges');
    svg.innerHTML = '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"></path></marker>' +
      '<marker id="ah-on" class="on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"></path></marker></defs>';
    const seen = new Map();
    let bottom = PAD + 30 + graphH;
    for (const e of g.edges) {
      const s = place.get(e.from), t = place.get(e.to);
      if (!s || !t) continue;
      const k = [e.from, e.to].sort().join('|'), nth = seen.get(k) || 0;
      seen.set(k, nth + 1);
      let p0, p1, p2, p3;
      if (pos[e.to].col > pos[e.from].col) {
        const dy = nth * 14;
        p0 = [s.x + s.w, s.y + s.h / 2 + dy]; p3 = [t.x - 4, t.y + t.h / 2 + dy];
        const mx = (p0[0] + p3[0]) / 2;
        p1 = [mx, p0[1]]; p2 = [mx, p3[1]];
      } else {
        const low = Math.max(s.y + s.h, t.y + t.h) + 50 + nth * 28;
        p0 = [s.x + s.w / 2 - 10, s.y + s.h]; p3 = [t.x + t.w / 2 + 10, t.y + t.h + 4];
        p1 = [p0[0], low]; p2 = [p3[0], low];
        bottom = Math.max(bottom, low);
      }
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', 'M' + p0 + 'C' + p1 + ' ' + p2 + ' ' + p3);
      path.setAttribute('class', e.kind === 'state' ? 'vw-state' : '');
      path.setAttribute('marker-end', 'url(#ah)');
      svg.append(path);
      const mid = [0, 1].map(function (i) { return 0.125 * p0[i] + 0.375 * p1[i] + 0.375 * p2[i] + 0.125 * p3[i]; });
      const lab = e.label ? el('span', { class: 'vw-edge-label', text: e.label, title: (e.kind === 'state' ? 'state step: ' : 'link: ') + e.label }) : null;
      if (lab) { lab.style.left = mid[0] + 'px'; lab.style.top = mid[1] + 'px'; plane.append(lab); }
      edgeEls.push({ e: e, path: path, label: lab });
    }
    plane.insertBefore(svg, plane.firstChild);
    // the boards no arrow touches
    let y = bottom + (g.edges.length ? 90 : 0), maxX = x;
    if (g.apart.length) {
      const ap = el('div', { class: 'vw-apart' }, [el('h2', { text: 'Not reached' }), el('p', { text: 'Boards on this page no link or state step leads to or from' })]);
      const row = el('div', { class: 'vw-apart__row' });
      for (const id of g.apart) { const n = nodeOf(id), b = byFile(n.file), s = Math.min(140 / b.size.height, 180 / b.size.width); const fn = frameNode(n, s); row.append(fn.el); nodeEls.set(id, fn.el); }
      ap.append(row);
      ap.style.left = PAD + 'px';
      ap.style.top = y + 'px';
      ap.style.width = Math.max(900, x - PAD) + 'px';
      plane.append(ap);
      y += 110 + Math.ceil(g.apart.length / Math.max(1, Math.floor(Math.max(900, x - PAD) / 200))) * 200;
    }
    if (!g.nodes.length) plane.append(el('p', { class: 'vw-apart vw-soft', text: 'No boards on this page.' }));
    planeW = Math.max(maxX, 1000) + PAD;
    planeH = y + PAD;
    svg.setAttribute('width', planeW); svg.setAttribute('height', planeH);
    plane.style.width = planeW + 'px';
    plane.style.height = planeH + 'px';
    rail(pages);
    // the walk: from the address, else from the first node nothing leads to
    const reach = new Set(g.edges.map(function (e) { return e.to; }));
    let from = q.from && nodeOf(q.from) && g.apart.indexOf(q.from) < 0 ? q.from : null;
    if (!from) { const first = g.nodes.find(function (n) { return g.apart.indexOf(n.id) < 0 && !reach.has(n.id); }) || g.nodes.find(function (n) { return g.apart.indexOf(n.id) < 0; }); from = first ? first.id : null; }
    steps = from ? L.walk(g, from) : [];
    at = Math.min(Math.max(0, (Number(q.step) || 1) - 1), Math.max(0, steps.length - 1));
    const z = Number(B.get('boards.flowZoom'));
    if (z && !draw.fitted) setScale(z); else fit();
    draw.fitted = true;
    walkShow(false);
  }

  function rail(pages) {
    const nav = document.getElementById('pages');
    nav.textContent = '';
    document.getElementById('npages').textContent = pages[0].id ? String(pages.length) : '';
    for (const p of pages) {
      const n = L.flow(data, p.id).edges.length;
      const link = el('a', { href: 'flow.html' + L.serialise(Object.assign({ page: p.id }, keep())), 'aria-current': p.id === page ? 'page' : null, title: n + ' arrow' + (n === 1 ? '' : 's') }, [el('span', { class: 'vw-t', text: p.name }), el('span', { class: 'vw-n', text: String(n) })]);
      link.addEventListener('click', function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        B.setAddress(Object.assign({ page: p.id, props: {} }, keep()), true);
        draw.fitted = false;
        draw();
      });
      nav.append(link);
    }
  }

  function start(id) { steps = L.walk(g, id); at = 0; walkShow(true); }
  function walkShow(push) {
    const list = document.getElementById('walk');
    list.textContent = '';
    document.getElementById('walk-n').textContent = steps.length ? (at + 1) + ' / ' + steps.length : '';
    document.getElementById('walk-none').textContent = steps.length ? '' : 'No arrows on this page to walk.';
    steps.forEach(function (s, i) {
      const n = nodeOf(s.id);
      const li = el('li', {}, [el('a', { href: viewOf(n), 'aria-current': i === at ? 'step' : null }, [el('span', { text: String(i + 1) }), el('span', { class: 'vw-t', text: nodeName(n) }), el('span', { class: 'vw-q', text: s.label ? '“' + s.label + '”' : i ? '' : 'start' })])]);
      li.firstChild.addEventListener('click', function (e) { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); at = i; walkShow(false); });
      list.append(li);
    });
    const on = new Set(steps.map(function (s) { return s.id; }));
    for (const [id, d] of nodeEls) { d.classList.toggle('vw-node--walk', on.has(id)); d.classList.toggle('vw-node--on', !!(steps[at] && steps[at].id === id)); }
    const pairs = new Set(); for (let i = 1; i < steps.length; i++) pairs.add(steps[i - 1].id + '>' + steps[i].id + '>' + steps[i].label);
    for (const x of edgeEls) {
      const lit = pairs.has(x.e.from + '>' + x.e.to + '>' + x.e.label);
      x.path.setAttribute('class', (x.e.kind === 'state' ? 'vw-state ' : '') + (lit ? 'on' : ''));
      x.path.setAttribute('marker-end', lit ? 'url(#ah-on)' : 'url(#ah)');
      if (x.label) x.label.classList.toggle('vw-edge-label--on', lit);
    }
    const cur = steps[at] && nodeOf(steps[at].id);
    const t = document.getElementById('walk-t');
    t.textContent = '';
    t.append(el('b', { text: 'Walk' }), cur ? ' · step ' + (at + 1) + ' of ' + steps.length + ': ' + nodeName(cur) : ' · nothing to walk');
    const open = document.getElementById('open');
    if (cur) open.href = viewOf(cur); else open.removeAttribute('href');
    document.getElementById('back').disabled = at <= 0;
    document.getElementById('fwd').disabled = at >= steps.length - 1;
    if (cur) reveal(cur.id);
    write(push);
  }
  function reveal(id) {
    const d = nodeEls.get(id);
    if (!d) return;
    const x = d.offsetLeft * scale, y = d.offsetTop * scale, w = d.offsetWidth * scale, h = d.offsetHeight * scale;
    if (x < box.scrollLeft || x + w > box.scrollLeft + box.clientWidth) box.scrollLeft = x + w / 2 - box.clientWidth / 2;
    if (y < box.scrollTop || y + h > box.scrollTop + box.clientHeight - 70) box.scrollTop = y + h / 2 - box.clientHeight / 2;
  }
  function stepBy(d) { if (!steps.length) return; at = Math.max(0, Math.min(steps.length - 1, at + d)); walkShow(false); }

  // ctrl+wheel zooms, the middle button pans
  box.addEventListener('wheel', function (e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const r = box.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
    const px = (box.scrollLeft + cx) / scale, py = (box.scrollTop + cy) / scale;
    setScale(scale * Math.exp(-Math.max(-100, Math.min(100, e.deltaY)) * 0.01));
    box.scrollLeft = px * scale - cx; box.scrollTop = py * scale - cy;
  }, { passive: false });
  let pan = null;
  box.addEventListener('mousedown', function (e) { if (e.button !== 1) return; e.preventDefault(); pan = { x: e.clientX, y: e.clientY, l: box.scrollLeft, t: box.scrollTop }; document.body.classList.add('panning'); });
  window.addEventListener('mousemove', function (e) { if (!pan) return; box.scrollLeft = pan.l - (e.clientX - pan.x); box.scrollTop = pan.t - (e.clientY - pan.y); });
  window.addEventListener('mouseup', function (e) { if (e.button === 1 && pan) { pan = null; document.body.classList.remove('panning'); } });

  document.getElementById('back').onclick = function () { stepBy(-1); };
  document.getElementById('fwd').onclick = function () { stepBy(1); };
  document.getElementById('fit').onclick = fit;
  document.getElementById('actual').onclick = function () { setScale(1); };
  B.keys({
    j: function () { stepBy(1); }, k: function () { stepBy(-1); }, arrowright: function () { stepBy(1); }, arrowleft: function () { stepBy(-1); },
    enter: function () { const h = document.getElementById('open').getAttribute('href'); if (h) location.href = h; },
    1: fit, 0: function () { setScale(1); },
    m: function () { const n = steps[at] && nodeOf(steps[at].id); if (n) location.href = 'matrix.html' + L.serialise(Object.assign({ board: n.file, state: n.state }, keep())); },
    escape: function () { location.href = 'index.html' + L.serialise(Object.assign({ page: page, board: steps[at] && nodeOf(steps[at].id).file }, keep())); },
  });
  bar.onRender(function () { if (data) draw(); });
  window.addEventListener('popstate', function () { if (data) draw(); });
  Promise.all([B.canvas(), B.review()]).then(function (all) { data = all[0]; rv = all[1]; draw(); });
  B.onChange(function () { B.canvas(true).then(function (d) { data = d; draw(); }); });
})();
