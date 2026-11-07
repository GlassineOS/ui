// SPDX-License-Identifier: GPL-2.0-or-later
// The board view (003 FR-010): one board in a frame at its size, the voice, scheme and pen picker,
// the board's own enum and boolean props, live reload (the board reloads itself).
(function () {
  'use strict';
  const B = window.Boards, el = B.el;
  const frame = document.getElementById('frame'), stage = document.getElementById('stage');
  const GLOBAL = [
    { key: 'voice', props: ['voice', 'theme'], options: ['white', 'editorial', 'stationery'] },
    { key: 'scheme', props: ['scheme'], options: ['paper', 'night', 'eink'] },
    { key: 'pen', props: ['pen'], options: ['1', '2', '3'] },
  ];
  let data = null, board = null;

  function params() { return new URLSearchParams(location.search); }

  function boardSrc(q) {
    const s = new URLSearchParams();
    for (const [k, v] of q) if (k !== 'board') s.set(k, v);
    const qs = s.toString();
    return B.boardHref(board.file) + (qs ? '?' + qs : '');
  }

  function set(k, v) {
    const q = params();
    if (v === null || v === '') q.delete(k); else q.set(k, v);
    history.replaceState(null, '', '?' + q.toString());
    show();
  }

  function controls() {
    const form = document.getElementById('controls');
    form.textContent = '';
    const q = params();
    for (const g of GLOBAL) {
      const used = g.props.some(function (p) { return board.props[p]; });
      const sel = el('select', { name: g.key, 'aria-label': g.key });
      sel.append(el('option', { value: '', text: g.key + ': default' }));
      for (const o of g.options) { const opt = el('option', { value: o, text: g.key + ': ' + o }); if (q.get(g.key) === o) opt.selected = true; sel.append(opt); }
      sel.onchange = function () { set(g.key, sel.value); };
      form.append(el('label', { class: used ? '' : 'unused', title: used ? '' : 'this board has no ' + g.props.join(' or ') + ' prop' }, [sel]));
    }
    const own = Object.keys(board.props).filter(function (k) {
      const p = board.props[k];
      return (p.editor === 'enum' || p.editor === 'boolean') && GLOBAL.every(function (g) { return g.props.indexOf(k) < 0; });
    });
    if (own.length) form.append(el('span', { class: 'sep' }));
    for (const k of own) {
      const p = board.props[k], cur = q.get('p.' + k);
      if (p.editor === 'boolean') {
        const cb = el('input', { type: 'checkbox', name: k });
        cb.checked = cur !== null ? cur === 'true' : !!p.default;
        cb.onchange = function () { set('p.' + k, cb.checked ? 'true' : 'false'); };
        form.append(el('label', {}, [cb, k]));
      } else {
        const sel = el('select', { name: k });
        for (const o of p.options || []) { const opt = el('option', { value: String(o), text: String(o) }); if ((cur !== null ? cur : String(p.default)) === String(o)) opt.selected = true; sel.append(opt); }
        sel.onchange = function () { set('p.' + k, sel.value); };
        form.append(el('label', {}, [k + ' ', sel]));
      }
    }
    const reset = el('button', { type: 'button', text: 'Reset' });
    reset.onclick = function () { history.replaceState(null, '', '?board=' + encodeURIComponent(board.file)); show(); };
    form.append(reset);
  }

  function fit() {
    if (!board) return;
    if (board.expand === 'fill') { frame.style.transform = ''; frame.style.width = '100%'; frame.style.height = '100%'; return; }
    const w = board.size.width, h = board.size.height;
    const s = Math.min(1, (stage.clientWidth - 2) / w, (stage.clientHeight - 2) / h);
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.transform = s < 1 ? 'scale(' + s + ')' : '';
  }

  function show() {
    const file = params().get('board');
    board = data.boards.find(function (b) { return b.file === file; });
    if (!board) { document.getElementById('title').textContent = 'No board ' + file; return; }
    document.getElementById('title').textContent = board.title + (board.interactive ? '  ▶ interactive' : '');
    document.title = board.title + ' · boards';
    controls();
    const src = boardSrc(params());
    document.getElementById('full').href = src;
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
    fit();
  }

  // links inside the board move the frame: follow it here
  frame.addEventListener('load', function () {
    const st = document.getElementById('state');
    let w;
    try { w = frame.contentWindow; } catch (e) { return; }
    const path = decodeURIComponent(w.location.pathname.slice(1));
    if (data && path !== board.file && data.boards.some(function (b) { return b.file === path; })) {
      const q = new URLSearchParams(w.location.search);
      q.set('board', path);
      history.pushState(null, '', '?' + q.toString());
      show();
    }
    const check = function () {
      const s = w.__boards;
      if (!s) { st.textContent = ''; return; }
      const n = s.errors.length;
      st.textContent = n ? n + ' error' + (n > 1 ? 's' : '') + ' (see the console)' : s.settled ? '' : 'loading';
      st.className = 'state' + (n ? ' bad' : '');
      if (!s.settled) setTimeout(check, 300);
    };
    check();
  });
  window.addEventListener('resize', fit);
  window.addEventListener('popstate', show);
  function load() { B.canvas().then(function (d) { data = d; show(); }); }
  B.onChange(function () {
    try { frame.contentWindow.location.reload(); } catch (e) { /* not loaded */ }
    B.canvas().then(function (d) { data = d; controls(); });
  });
  load();
})();
