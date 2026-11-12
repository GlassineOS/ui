// SPDX-License-Identifier: GPL-2.0-or-later
// The canvas index (003 FR-004, FR-010): the pages of canvas.json, each board at its place and size, the
// notes, the interactive boards marked. A board opens in the board view from its title, or from the
// tile while the boards are not in use. With "Use boards" the live boards take clicks and keys on the
// canvas itself. The middle button drags the canvas; ctrl+wheel and a pinch zoom it around the
// pointer, also over a board in use.
(function () {
  'use strict';
  const B = window.Boards, el = B.el;
  const q = new URLSearchParams(location.search);
  let data = null;
  let page = q.get('page');
  const zoom = document.getElementById('zoom'), live = document.getElementById('live'), use = document.getElementById('use');
  const box = document.getElementById('canvas'), sizer = document.getElementById('sizer'), plane = document.getElementById('plane');
  const MIN = Number(zoom.min) / 100, MAX = Number(zoom.max) / 100;
  let scale = Number(zoom.value) / 100;
  let planeW = 0, planeH = 0;
  // the parts whose text keeps a readable size at every zoom: [element, smallest px, px at scale 1]
  let readable = [];
  try {
    const z = Number(localStorage.getItem('boards.zoom'));
    if (z) scale = z / 100;
    live.checked = localStorage.getItem('boards.live') === '1';
    use.checked = localStorage.getItem('boards.use') === '1';
  } catch (e) { /* no storage */ }

  function issues(b) { return b.issues && b.issues.length; }
  function clamp(s) { return Math.min(MAX, Math.max(MIN, s)); }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* no storage */ } }
  function viewHref(file) { return 'view.html?board=' + encodeURIComponent(file); }

  // the zoom: only the plane's transform, the scroll area and the readable text change, so live boards
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
    store('boards.zoom', String(Math.round(s * 1000) / 10));
  }

  function useBoards() { return live.checked && use.checked; }
  function syncUse() {
    use.disabled = !live.checked;
    use.parentElement.classList.toggle('unused', !live.checked);
    document.body.classList.toggle('using', useBoards());
  }

  function draw() {
    plane.textContent = '';
    readable = [];
    document.getElementById('title').textContent = data.title;
    document.title = data.title + ' · boards';
    const pages = data.pages.length ? data.pages : [{ id: null, name: 'Boards' }];
    if (!pages.some(function (p) { return p.id === page; })) page = data.launch && data.launch.page || pages[0].id;
    const nav = document.getElementById('pages');
    nav.textContent = '';
    for (const p of pages) {
      const n = data.boards.filter(function (b) { return b.onCanvas && (b.page === p.id || !p.id); }).length;
      const btn = el('button', { type: 'button', 'aria-current': p.id === page ? 'page' : null, text: p.name + ' (' + n + ')' });
      btn.onclick = function () { page = p.id; history.replaceState(null, '', '?page=' + encodeURIComponent(p.id)); draw(); };
      nav.append(btn);
    }
    const items = data.boards.filter(function (b) { return b.onCanvas && (b.page === page || !pages[0].id); });
    const notes = Object.keys(data.notes).map(function (k) { return data.notes[k]; }).filter(function (n) { return n.page === page || !n.page && !pages[0].id; });
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (const b of items) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y - 40); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
    for (const n of notes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + (n.w || 400)); maxY = Math.max(maxY, n.y + 200); }
    const pad = 60, ox = pad - minX, oy = pad - minY;
    planeW = maxX - minX + 2 * pad;
    planeH = maxY - minY + 2 * pad;
    plane.style.width = planeW + 'px';
    plane.style.height = planeH + 'px';
    for (const n of notes) {
      const big = n.kind === 'title1';
      const d = el('div', { class: 'note' + (big ? ' title1' : ''), text: n.text || '' });
      d.style.left = (n.x + ox) + 'px';
      d.style.top = (n.y + oy) + 'px';
      if (n.w && !big) d.style.width = n.w + 'px';
      readable.push(big ? [d, 48, 24] : [d, 16, 11]);
      plane.append(d);
    }
    for (const b of items) {
      const t = el('div', { class: 'board' + (b.interactive ? ' interactive' : ''), 'data-file': b.file });
      t.style.left = (b.x + ox) + 'px';
      t.style.top = (b.y + oy) + 'px';
      t.style.width = b.w + 'px';
      t.style.height = b.h + 'px';
      const label = el('div', { class: 'label' }, [
        b.interactive ? el('span', { class: 'badge', text: '▶ interactive' }) : null, ' ',
        el('a', { class: 'open', href: viewHref(b.file), title: 'Open ' + b.title + ' in the board view', text: b.title }),
        issues(b) ? el('span', { class: 'badge bad', text: issues(b) + ' unsupported' }) : null,
        b.exists ? null : el('span', { class: 'badge bad', text: 'missing' })]);
      readable.push([label, 14, 13]);
      t.append(label);
      if (live.checked && b.exists) {
        const f = el('iframe', { src: B.boardHref(b.file), loading: 'lazy', title: b.title });
        f.style.width = b.w + 'px';
        f.style.height = b.h + 'px';
        f.addEventListener('load', function () { forward(f); });
        t.append(f);
      } else {
        const th = el('div', { class: 'thumb' }, [el('div', { text: b.file }), el('div', { text: b.w + ' × ' + b.h })]);
        readable.push([th, 14, 12]);
        t.append(th);
      }
      // the whole tile opens the board view while the boards are not in use
      const tip = b.title + (b.interactive ? ' (interactive)' : '');
      t.append(el('a', { class: 'hit', href: viewHref(b.file), 'aria-label': tip, title: tip }));
      plane.append(t);
    }
    const extra = document.getElementById('extra');
    const off = data.boards.filter(function (b) { return !b.onCanvas; });
    extra.hidden = !off.length;
    extra.textContent = '';
    if (off.length) {
      extra.append(el('strong', { text: 'Not on the canvas: ' }));
      for (const b of off) extra.append(el('a', { href: viewHref(b.file), text: b.file }), ' ');
    }
    syncUse();
    setScale(scale, 0, 0);
  }

  // ---- zoom: ctrl+wheel (a trackpad pinch arrives as one) and Safari's gesture events ----
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

  function load() { B.canvas().then(function (d) { data = d; draw(); }, function (e) { plane.textContent = String(e.message || e); }); }
  zoom.oninput = function () { setScale(Number(zoom.value) / 100); };
  live.onchange = function () { store('boards.live', live.checked ? '1' : '0'); if (data) draw(); };
  use.onchange = function () { store('boards.use', use.checked ? '1' : '0'); syncUse(); };
  B.onChange(load);
  load();
})();
