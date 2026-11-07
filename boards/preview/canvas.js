// SPDX-License-Identifier: GPL-2.0-or-later
// The canvas index (003 FR-004): the pages of canvas.json, each board at its place and size, the
// notes, the interactive boards marked. A board opens in the board view.
(function () {
  'use strict';
  const B = window.Boards, el = B.el;
  const q = new URLSearchParams(location.search);
  let data = null;
  let page = q.get('page');
  const zoom = document.getElementById('zoom'), live = document.getElementById('live');
  try { zoom.value = localStorage.getItem('boards.zoom') || zoom.value; live.checked = localStorage.getItem('boards.live') === '1'; } catch (e) { /* no storage */ }

  function issues(b) { return b.issues && b.issues.length; }

  function draw() {
    const plane = document.getElementById('plane');
    plane.textContent = '';
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
    const s = Number(zoom.value) / 100;
    const items = data.boards.filter(function (b) { return b.onCanvas && (b.page === page || !pages[0].id); });
    const notes = Object.keys(data.notes).map(function (k) { return data.notes[k]; }).filter(function (n) { return n.page === page || !n.page && !pages[0].id; });
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    for (const b of items) { minX = Math.min(minX, b.x); minY = Math.min(minY, b.y - 40); maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); }
    for (const n of notes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + (n.w || 400)); maxY = Math.max(maxY, n.y + 200); }
    const pad = 60, ox = pad - minX, oy = pad - minY;
    plane.style.width = (maxX - minX + 2 * pad) + 'px';
    plane.style.height = (maxY - minY + 2 * pad) + 'px';
    plane.style.transform = 'scale(' + s + ')';
    const box = plane.parentElement;
    box.style.setProperty('--w', ((maxX - minX + 2 * pad) * s) + 'px');
    for (const n of notes) {
      const big = n.kind === 'title1';
      const d = el('div', { class: 'note' + (big ? ' title1' : ''), text: n.text || '' });
      d.style.left = (n.x + ox) + 'px';
      d.style.top = (n.y + oy) + 'px';
      if (n.w && !big) d.style.width = n.w + 'px';
      if (big) d.style.fontSize = Math.max(48, 24 / s) + 'px';
      else d.style.fontSize = Math.max(16, 11 / s) + 'px';
      plane.append(d);
    }
    for (const b of items) {
      const a = el('a', { class: 'board', href: '/_boards/view.html?board=' + encodeURIComponent(b.file), title: b.title + (b.interactive ? ' (interactive)' : '') });
      a.style.left = (b.x + ox) + 'px';
      a.style.top = (b.y + oy) + 'px';
      a.style.width = b.w + 'px';
      a.style.height = b.h + 'px';
      a.style.overflow = 'visible';
      const label = el('div', { class: 'label' }, [b.interactive ? el('span', { class: 'badge', text: '▶ interactive' }) : null, ' ', b.title, issues(b) ? el('span', { class: 'badge bad', text: issues(b) + ' unsupported' }) : null, b.exists ? null : el('span', { class: 'badge bad', text: 'missing' })]);
      label.style.fontSize = Math.max(14, 13 / s) + 'px';
      a.append(label);
      if (live.checked && b.exists) {
        const f = el('iframe', { src: B.boardHref(b.file), loading: 'lazy', tabindex: '-1', title: b.title });
        f.style.width = b.w + 'px';
        f.style.height = b.h + 'px';
        a.append(f);
      } else {
        a.append(el('div', { class: 'thumb' }, [el('div', { text: b.file }), el('div', { text: b.w + ' × ' + b.h })]));
        a.lastChild.style.fontSize = Math.max(14, 12 / s) + 'px';
      }
      plane.append(a);
    }
    const extra = document.getElementById('extra');
    const off = data.boards.filter(function (b) { return !b.onCanvas; });
    extra.hidden = !off.length;
    extra.textContent = '';
    if (off.length) {
      extra.append(el('strong', { text: 'Not on the canvas: ' }));
      for (const b of off) extra.append(el('a', { href: '/_boards/view.html?board=' + encodeURIComponent(b.file), text: b.file }), ' ');
    }
  }

  function load() { B.canvas().then(function (d) { data = d; draw(); }, function (e) { document.getElementById('plane').textContent = String(e.message || e); }); }
  zoom.oninput = function () { try { localStorage.setItem('boards.zoom', zoom.value); } catch (e) { /* no storage */ } if (data) draw(); };
  live.onchange = function () { try { localStorage.setItem('boards.live', live.checked ? '1' : '0'); } catch (e) { /* no storage */ } if (data) draw(); };
  B.onChange(load);
  load();
})();
