// SPDX-License-Identifier: GPL-2.0-or-later
// The matrix (003 FR-054): one board in every combination of two of voice, scheme, pen and its named
// states, each a live frame; a combination in which the board raised an error is marked ("!" and the
// count); the chosen one large beside. Address: matrix.html?board=FILE&rows=AXIS&cols=AXIS&at=R,C
// (and voice, scheme, pen, state for the axes not shown). Arrow keys move, ⏎ opens the board view.
(function () {
  'use strict';
  const B = window.Boards, L = B.logic, el = B.el;
  const bar = B.bar('matrix');
  const grid = document.getElementById('grid'), big = document.getElementById('big'), pick = document.getElementById('board');
  const NAMES = { voice: 'Voice', scheme: 'Scheme', pen: 'Pen', state: 'State' };
  let data = null, rv = null, board = null, m = null, cellErrs = new Map(), cellEls = [];

  function a() { return B.address(); }
  function base() { return B.render(); }
  function write(push) {
    const q = a();
    q.board = board.file; q.rows = m.rows; q.cols = m.cols; q.at = m.at.join(',');
    B.setAddress(q, push);
  }
  function cellLabel(c) { return [c.render.voice ? L.name(L.VOICES, c.render.voice) : 'own voice', c.render.scheme ? L.name(L.SCHEMES, c.render.scheme) : 'own scheme', c.render.pen ? 'pen ' + c.render.pen : 'own pen'].concat(c.state ? [stateName(c.state)] : []).join(' · '); }
  function stateName(id) { const s = board.states.find(function (x) { return x.id === id; }); return s ? s.name || s.id : id; }
  function viewOf(c) { return 'view.html' + L.serialise({ board: board.file, state: c.state, voice: c.render.voice, scheme: c.render.scheme, pen: c.render.pen }); }

  function draw() {
    const q = a();
    board = data.boards.find(function (b) { return b.file === q.board; }) || L.readingOrder(L.onPage(data, data.launch && data.launch.page || L.pagesOf(data)[0].id))[0] || data.boards[0];
    if (!board) { grid.textContent = 'No boards.'; return; }
    pick.textContent = '';
    for (const p of L.pagesOf(data)) {
      const list = p.id ? L.readingOrder(L.onPage(data, p.id)) : data.boards;
      if (!list.length) continue;
      const g = el('optgroup', { label: p.name });
      for (const b of list) g.append(el('option', { value: b.file, text: b.title + (b.states.length ? ' · ' + b.states.length + ' states' : ''), selected: b.file === board.file ? true : null }));
      pick.append(g);
    }
    const off = data.boards.filter(function (b) { return !b.onCanvas; });
    if (off.length && L.pagesOf(data)[0].id) { const g = el('optgroup', { label: 'Not on the canvas' }); for (const b of off) g.append(el('option', { value: b.file, text: b.title, selected: b.file === board.file ? true : null })); pick.append(g); }
    const mk = document.getElementById('mark');
    mk.textContent = '';
    mk.append(B.mark(board.interactive ? 'interactive' : 'still'));
    const ch = B.changesOf(rv)[board.file];
    if (ch) mk.prepend(B.mark(ch));
    m = L.matrix(board, { rows: q.rows || (q.cols === 'voice' ? 'scheme' : 'voice'), cols: q.cols, at: q.at, render: base(), state: q.state });
    const axes = L.axesOf(board);
    for (const [id, which] of [['rows', m.rows], ['cols', m.cols]]) {
      const s = document.getElementById(id);
      s.textContent = '';
      for (const ax of L.AXES) {
        const has = axes.indexOf(ax) >= 0;
        s.append(el('button', { type: 'button', 'aria-pressed': ax === which ? 'true' : 'false', disabled: has ? null : true, title: has ? null : 'this board names no states',
          onclick: function () {
            const n = a();
            if (id === 'rows') { n.rows = ax; if (n.cols === ax || !n.cols && m.cols === ax) n.cols = m.rows; else n.cols = m.cols; }
            else { n.cols = ax; n.rows = m.rows === ax ? m.cols : m.rows; }
            n.at = null; B.setAddress(n); draw();
          } }, [NAMES[ax]]));
      }
    }
    const rest = L.AXES.filter(function (x) { return x !== m.rows && x !== m.cols && (x !== 'state' || board.states.length); });
    const r = base();
    document.getElementById('note').textContent = 'Every cell also in ' + rest.map(function (x) { return x === 'state' ? (q.state ? 'state ' + stateName(q.state) : 'the default state') : (r[x] ? NAMES[x].toLowerCase() + ' ' + (x === 'pen' ? r[x] : L.name(x === 'voice' ? L.VOICES : L.SCHEMES, r[x])) : 'the board\'s own ' + NAMES[x].toLowerCase()); }).join(', ') + ' (the render picker).';
    // cells: as large as the panel allows, at most 180 px wide
    const sz = board.size, cols = m.colValues.length;
    const room = Math.min(window.innerWidth * 0.62, 900) - 48 - 100 - (cols - 1) * 14;
    const cw = Math.max(60, Math.min(180, room / cols)), cellH = Math.max(70, (window.innerHeight - 56 - 220) / m.rowValues.length - 14);
    const s = Math.min(cw / sz.width, cellH / sz.height);
    grid.textContent = '';
    grid.style.gridTemplateColumns = 'auto repeat(' + cols + ', ' + Math.round(sz.width * s) + 'px)';
    grid.append(el('span'));
    for (const c of m.colValues) grid.append(el('div', { class: 'vw-grid__h', role: 'columnheader', text: c.name }));
    cellErrs = new Map();
    cellEls = [];
    m.cells.forEach(function (row, i) {
      grid.append(el('div', { class: 'vw-grid__r', role: 'rowheader', text: m.rowValues[i].name }));
      cellEls.push([]);
      row.forEach(function (c) {
        const fb = B.frameBox(board.file, { width: sz.width, height: sz.height, scale: s, render: c.render, state: c.state, title: cellLabel(c) });
        const btn = el('button', { type: 'button', class: 'vw-cell', role: 'gridcell', 'aria-selected': c.r === m.at[0] && c.c === m.at[1] ? 'true' : 'false', title: cellLabel(c), 'aria-label': cellLabel(c) }, [fb.box]);
        btn.onclick = function () { at(c.r, c.c); };
        btn.ondblclick = function () { location.href = viewOf(c); };
        B.frameErrors(fb.frame, function (errs) {
          if (errs === null) return;
          cellErrs.set(c.r + ',' + c.c, errs);
          btn.classList.toggle('vw-cell--bad', errs.length > 0);
          const old = btn.querySelector('.vw-err'); if (old) old.remove();
          if (errs.length) btn.append(B.errMark(errs.length, errs.map(function (e) { return e.kind + (e.feature ? ': ' + e.feature : '') + (e.message ? ' ' + e.message : ''); }).join('\n')));
          if (c.r === m.at[0] && c.c === m.at[1]) bigErr();
        });
        cellEls[i].push(btn);
        grid.append(btn);
      });
    });
    showBig();
    write(false);
  }

  function at(r, c) {
    m.at = [Math.max(0, Math.min(m.rowValues.length - 1, r)), Math.max(0, Math.min(m.colValues.length - 1, c))];
    cellEls.forEach(function (row, i) { row.forEach(function (b, j) { b.setAttribute('aria-selected', i === m.at[0] && j === m.at[1] ? 'true' : 'false'); }); });
    const b = cellEls[m.at[0]][m.at[1]];
    if (b) { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); if (document.activeElement && document.activeElement.classList.contains('vw-cell')) b.focus(); }
    write(false);
    showBig();
  }
  function bigErr() {
    const box = document.getElementById('big-err');
    box.textContent = '';
    const e = cellErrs.get(m.at.join(','));
    if (e && e.length) box.append(B.errMark(e.length, e.map(function (x) { return x.kind + (x.feature ? ': ' + x.feature : '') + (x.message ? ' ' + x.message : ''); }).join('\n')));
  }
  function showBig() {
    const c = m.cells[m.at[0]] && m.cells[m.at[0]][m.at[1]];
    big.textContent = '';
    if (!c) return;
    document.getElementById('big-t').textContent = cellLabel(c);
    document.getElementById('open').href = viewOf(c);
    bigErr();
    const sz = board.size;
    const w = big.clientWidth - 32, h = big.clientHeight - 16;
    const s = Math.max(0.05, Math.min(1, w / sz.width, h / sz.height));
    big.append(B.frameBox(board.file, { width: sz.width, height: sz.height, scale: s, render: c.render, state: c.state, eager: true, live: true, title: cellLabel(c) }).box);
  }

  pick.onchange = function () { const q = a(); q.board = pick.value; q.at = null; B.setAddress(q, true); draw(); };
  B.keys({
    arrowup: function () { at(m.at[0] - 1, m.at[1]); }, arrowdown: function () { at(m.at[0] + 1, m.at[1]); },
    arrowleft: function () { at(m.at[0], m.at[1] - 1); }, arrowright: function () { at(m.at[0], m.at[1] + 1); },
    enter: function () { location.href = document.getElementById('open').href; },
    escape: function () { location.href = 'view.html' + L.serialise(Object.assign({ board: board.file, state: a().state }, base())); },
    j: function () { step(1); }, k: function () { step(-1); },
  });
  function step(d) {
    const list = board.onCanvas ? L.readingOrder(L.onPage(data, board.page)) : data.boards;
    const i = list.findIndex(function (b) { return b.file === board.file; });
    const n = list[(i + d + list.length) % list.length];
    const q = a(); q.board = n.file; q.at = null; q.state = null; B.setAddress(q, true); draw();
  }
  bar.onRender(function () { if (data) draw(); });
  window.addEventListener('popstate', function () { if (data) draw(); });
  let t = null;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(function () { if (data) draw(); }, 200); });
  Promise.all([B.canvas(), B.review()]).then(function (all) { data = all[0]; rv = all[1]; draw(); });
  B.onChange(function () { B.canvas(true).then(function (d) { data = d; draw(); }); });
})();
