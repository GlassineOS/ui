// SPDX-License-Identifier: GPL-2.0-or-later
// The board view (003 FR-010, FR-051, FR-052, FR-059): one board on the desk at its size (shrunk to
// fit, at 1:1, or filling the desk for "expand": "fill"), rulers, the previous and next board of its
// page (J/K), its named states as a filmstrip, and on the right the render (this board can differ
// from every board), its own enum and boolean props, its sizes, links in and out, the errors it
// raised, the address and the shot command. "Device" shows it in a device frame in the E-ink scheme.
// Address: view.html?board=FILE&state=ID&voice=&scheme=&pen=&look=sheet|device&size=WxH|fill&p.NAME=
// Links inside the board move the view; live reload reloads the board.
(function () {
  'use strict';
  const B = window.Boards, L = B.logic, el = B.el;
  const bar = B.bar('board');
  const frame = document.getElementById('frame'), stage = document.getElementById('stage'), holder = document.getElementById('holder'), sheet = document.getElementById('sheet');
  const GLOBAL = [
    { key: 'voice', props: ['voice', 'theme'], list: L.VOICES },
    { key: 'scheme', props: ['scheme'], list: L.SCHEMES },
    { key: 'pen', props: ['pen'], list: L.PENS.map(function (p) { return [p[0], p[0]]; }) },
  ];
  let data = null, rv = null, board = null, errs = [], zoomMode = B.get('boards.viewZoom') === '1' ? '1' : 'fit';

  function a() { return B.address(); }
  function byFile(f) { return data.boards.find(function (b) { return b.file === f; }); }
  // the render this board is shown in: the address, else every board's
  function shown() { return B.render(); }
  function device() { return a().look === 'device'; }
  function effective() { const r = Object.assign({}, shown()); if (device()) r.scheme = 'eink'; return r; }
  function size() {
    const s = a().size;
    if (s === 'fill' || !s && board.expand === 'fill') return 'fill';
    if (s) { const p = s.split('x').map(Number); return { width: p[0], height: p[1] }; }
    return board.size;
  }
  function set(k, v, push) {
    const q = a();
    if (k.indexOf('p.') === 0) { if (v === null) delete q.props[k.slice(2)]; else q.props[k.slice(2)] = v; } else q[k] = v;
    B.setAddress(q, push);
    show();
  }
  function keep() { const r = shown(); return { voice: r.voice, scheme: r.scheme, pen: r.pen }; }
  function viewHref(file) { return 'view.html' + L.serialise(Object.assign({ board: file, look: a().look }, keep())); }
  function siblings() { return board && board.onCanvas ? L.readingOrder(L.onPage(data, board.page)) : []; }
  function go(d) {
    const s = siblings(), i = s.findIndex(function (b) { return b.file === board.file; });
    if (i < 0 || !s.length) return;
    const n = s[(i + d + s.length) % s.length];
    const q = a();
    B.setAddress({ board: n.file, voice: q.voice, scheme: q.scheme, pen: q.pen, look: q.look, props: {} }, true);
    show();
  }

  function seg(label, name, opts, cur, onPick) {
    const g = el('div', { class: 'vw-seg', role: 'group', 'aria-label': label });
    for (const o of opts) {
      g.append(el('button', { type: 'button', name: name || null, value: o[0] === null ? '' : o[0], 'aria-pressed': o[0] === cur ? 'true' : 'false', title: o[2] || null, disabled: o[3] ? true : null, onclick: function () { onPick(o[0]); } }, [o[1]]));
    }
    return g;
  }

  // ---- the right side: render, props, size, links, check, address -----------------------------------
  function controls() {
    const form = document.getElementById('controls');
    form.textContent = '';
    const q = a(), r = shown(), every = B.storedRender();
    const differs = ['voice', 'scheme', 'pen'].some(function (k) { return r[k] !== every[k]; });
    const rs = el('section', {}, [el('h3', {}, ['Render', differs
      ? el('a', { href: '#', title: 'Back to the render every board is shown in', onclick: function (e) { e.preventDefault(); const n = a(); n.voice = every.voice; n.scheme = every.scheme; n.pen = every.pen; B.setAddress(n); show(); } }, ['as every board'])
      : el('span', { text: 'as every board' })])]);
    for (const g of GLOBAL) {
      const used = g.props.some(function (p) { return board.props[p]; });
      const opts = g.list.map(function (o) { return [o[0], o[1]]; });
      let cur = r[g.key];
      if (g.key === 'scheme' && device()) { cur = 'eink'; opts.forEach(function (o) { if (o[0] === 'eink') o[1] = 'E-ink (device)'; else o[3] = true; }); }
      const s = seg(g.key, g.key, opts, cur, function (v) { set(g.key, v === cur ? null : v); });
      rs.append(el('div', { class: 'vw-field' + (used ? '' : ' unused'), title: used ? null : 'this board has no ' + g.props.join(' or ') + ' prop' }, [el('span', { text: g.key[0].toUpperCase() + g.key.slice(1) }), s]));
    }
    form.append(rs);
    const own = Object.keys(board.props).filter(function (k) {
      const p = board.props[k];
      return (p.editor === 'enum' || p.editor === 'boolean') && GLOBAL.every(function (g) { return g.props.indexOf(k) < 0; });
    });
    const reset = el('a', { href: '#', title: 'The board\'s own defaults, every board\'s render', onclick: function (e) { e.preventDefault(); B.setAddress({ board: board.file, look: q.look, props: {} }); show(); } }, ['Reset']);
    const ps = el('section', {}, [el('h3', {}, ['Props', own.length || Object.keys(q.props).length || q.state ? reset : el('span', { text: 'none to choose' })])]);
    for (const k of own) {
      const p = board.props[k], cur = k in q.props ? q.props[k] : String(p.default);
      const pick = function (v) { set('p.' + k, v === String(p.default) ? null : v); };
      const opts = p.editor === 'boolean' ? [['true', 'On'], ['false', 'Off']] : (p.options || []).map(function (o) { return [String(o), String(o)]; });
      let ctl;
      if (opts.length <= 4) ctl = seg(k, k, opts, cur, pick);
      else {
        ctl = el('select', { name: k, 'aria-label': k });
        for (const o of opts) { const opt = el('option', { value: o[0], text: o[1] }); if (o[0] === cur) opt.selected = true; ctl.append(opt); }
        ctl.onchange = function () { pick(ctl.value); };
      }
      ps.append(el('div', { class: 'vw-field' }, [el('span', { class: 'vw-t', text: k, title: k }), ctl]));
    }
    form.append(ps);
    // sizes: the canvas's, the board's $preview, the desk
    const sizes = [[board.size.width + 'x' + board.size.height, board.size.width + ' × ' + board.size.height]];
    if (board.preview && board.preview.width && (board.preview.width !== board.size.width || board.preview.height !== board.size.height)) sizes.push([board.preview.width + 'x' + board.preview.height, board.preview.width + ' × ' + board.preview.height]);
    sizes.push(['fill', 'Fill']);
    const sz = size(), cur = sz === 'fill' ? 'fill' : sz.width + 'x' + sz.height;
    const ss = el('section', {}, [el('h3', { text: 'Size' }), seg('Size', null, sizes, cur, function (v) { set('size', v === (board.expand === 'fill' ? 'fill' : board.size.width + 'x' + board.size.height) ? null : v); })]);
    form.parentNode.insertBefore(ss, form.nextSibling);
    const old = document.getElementById('sizes');
    if (old) old.remove();
    ss.id = 'sizes';
  }

  function links() {
    const box = document.getElementById('links');
    box.textContent = '';
    const out = board.links || [], into = L.linksIn(data, board.file);
    box.append(el('h3', {}, ['Links', el('span', { text: String(out.length + into.length) })]));
    const one = function (dir, file, text) {
      const t = byFile(file);
      return el('a', { href: viewHref(file), title: (dir === 'out' ? 'to ' : 'from ') + file }, [el('span', { class: 'vw-arrow', text: dir === 'out' ? '→' : '←' }), el('span', { class: 'vw-t', text: t ? t.title : file }), text ? el('span', { class: 'vw-soft vw-small', text: '“' + text + '”' }) : null]);
    };
    for (const l of out) box.append(one('out', l.to, l.text));
    for (const l of into) box.append(one('in', l.file, l.text));
    if (!out.length && !into.length) box.append(el('p', { class: 'vw-soft vw-small', text: 'No board links here, and this board links nowhere.' }));
    box.append(el('a', { class: 'vw-link vw-small', href: 'flow.html' + L.serialise(Object.assign({ page: board.page, from: board.file + (a().state ? '#' + a().state : '') }, keep())), text: 'See it in the flow' }));
  }

  function check(settled) {
    const box = document.getElementById('check'), st = document.getElementById('state');
    box.textContent = '';
    const all = (board.issues || []).concat(errs);
    box.append(el('h3', {}, ['Check', el('span', { text: all.length ? String(all.length) : '' })]));
    if (!all.length) box.append(el('div', { class: 'vw-row' }, [el('span', { class: settled ? 'vw-tag vw-tag--ok' : 'vw-tag', text: settled ? 'no errors' : 'rendering' }), el('span', { class: 'vw-soft vw-small', text: settled ? 'as rendered here' : '' })]));
    for (const e of all.slice(0, 10)) box.append(el('div', { class: 'vw-errbox' }, [el('b', { text: (e.kind || 'error') + (e.feature ? ': ' + e.feature : '') }), el('code', { text: [e.board && e.board !== board.file ? e.board : null, e.line ? 'line ' + e.line : null, e.detail, e.message].filter(Boolean).join(' · ') })]));
    st.textContent = '';
    st.className = 'state vw-small';
    if (all.length) { st.append(B.errMark(all.length), ' ' + all.length + ' error' + (all.length > 1 ? 's' : '')); st.className += ' bad'; }
    else if (!settled) st.textContent = 'loading';
  }

  function command() {
    const sz = size(), declared = board.size;
    const sizeArg = sz !== 'fill' && (sz.width !== declared.width || sz.height !== declared.height) ? sz.width + 'x' + sz.height : null;
    return L.shotCommand(B.boardPath(data, board.file), effective(), a().state, sizeArg);
  }

  // ---- the desk ---------------------------------------------------------------------------------
  function film() {
    const box = document.getElementById('film');
    box.textContent = '';
    box.hidden = !board.states.length;
    if (!board.states.length) return;
    const cur = a().state;
    box.append(el('div', { class: 'vw-film__label' }, [el('b', { text: 'States' }), el('span', { class: 'vw-soft', text: board.states.length + ' named by the board' })]));
    const sz = board.size, s = Math.min(86 / sz.height, 120 / sz.width);
    const list = [[null, 'Default']].concat(board.states.map(function (x) { return [x.id, x.name || x.id]; }));
    list.forEach(function (st, i) {
      const fb = B.frameBox(board.file, { width: sz.width, height: sz.height, scale: s, render: effective(), state: st[0], props: a().props, title: st[1] });
      const link = el('a', { href: 'view.html' + L.serialise(Object.assign({}, a(), { state: st[0] })), 'aria-current': st[0] === cur ? 'true' : 'false', title: st[1] + (st[0] ? ' (' + st[0] + ')' : '') + (i < 10 ? ' · key ' + ((i + 1) % 10) : '') },
        [fb.box, el('span', {}, [st[1], ' ', el('span', { class: 'vw-film__k', text: i < 9 ? String(i + 1) : '' })])]);
      link.addEventListener('click', function (e) { if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); set('state', st[0]); });
      box.append(link);
    });
    box.append(el('span', { class: 'vw-grow' }), el('a', { class: 'vw-btn vw-btn--flat', href: 'matrix.html' + L.serialise(Object.assign({ board: board.file, rows: 'state', cols: 'voice' }, keep())), text: 'Every state × voice' }));
  }

  let scale = 1, shownSrc = null;
  function fit() {
    if (!board) return;
    const sz = size(), fill = sz === 'fill';
    stage.classList.toggle('vw-fill', fill);
    holder.classList.toggle('vw-device', device() && !fill);
    document.getElementById('devnote').hidden = !device();
    for (const r of holder.querySelectorAll('.vw-ruler')) r.remove();
    if (fill) {
      frame.style.transform = ''; frame.style.width = ''; frame.style.height = '';
      sheet.style.width = ''; sheet.style.height = '';
      holder.style.width = ''; holder.style.height = '';
      scale = 1;
      pos();
      return;
    }
    const w = sz.width, h = sz.height, dev = device() ? [44, 66] : [0, 0];
    const availW = stage.clientWidth - 64 - 2 * 62 - dev[0], availH = stage.clientHeight - 56 - dev[1];
    scale = zoomMode === '1' ? 1 : Math.max(0.05, Math.min(1, availW / w, availH / h));
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    sheet.style.width = Math.round(w * scale) + 'px';
    sheet.style.height = Math.round(h * scale) + 'px';
    if (!device()) {
      holder.append(el('div', { class: 'vw-ruler vw-ruler--x', 'aria-hidden': 'true', text: w + ' px' }), el('div', { class: 'vw-ruler vw-ruler--y', 'aria-hidden': 'true', text: h + ' px' }));
    }
    pos();
  }
  function pos() {
    const box = document.getElementById('pos');
    box.textContent = '';
    const s = siblings(), i = s.findIndex(function (b) { return b.file === board.file; });
    const page = (L.pagesOf(data).find(function (p) { return p.id === board.page; }) || {}).name;
    const sz = size();
    if (i >= 0) box.append(el('span', { text: (i + 1) + ' of ' + s.length + (page ? ' on ' + page : '') }), el('span', { class: 'vw-sep' }));
    box.append(el('span', { class: 'vw-mono', text: sz === 'fill' ? 'fills the desk' : Math.round(scale * 100) + '% · ' + sz.width + ' × ' + sz.height }));
    document.getElementById('prev').disabled = s.length < 2 || i < 0;
    document.getElementById('next').disabled = s.length < 2 || i < 0;
  }

  function show() {
    const q = a();
    board = data.boards.find(function (b) { return b.file === q.board; });
    if (!board) {
      document.getElementById('name').textContent = q.board ? 'No board ' + q.board : 'No board chosen';
      document.title = 'No board · boards';
      return;
    }
    document.getElementById('name').textContent = board.title;
    document.getElementById('file').textContent = board.file;
    document.title = board.title + ' · boards';
    const mk = document.getElementById('mark');
    mk.textContent = '';
    const ch = B.changesOf(rv)[board.file];
    if (ch) mk.append(B.mark(ch));
    mk.append(B.mark(board.interactive ? 'interactive' : 'still'));
    const page = (L.pagesOf(data).find(function (p) { return p.id === board.page; }) || {});
    document.getElementById('back-t').textContent = board.onCanvas && page.name || 'Canvas';
    document.getElementById('back').href = 'index.html' + L.serialise(Object.assign({ page: board.onCanvas ? board.page : null, board: board.onCanvas ? board.file : null, state: q.state, props: q.props }, keep()));
    const zs = document.getElementById('zoomseg'), ls = document.getElementById('lookseg');
    zs.replaceWith(Object.assign(seg('Size on screen', null, [['fit', 'Fit', 'Shrink to fit (1)'], ['1', '1:1', 'Actual size (0)']], zoomMode, function (v) { zoomMode = v; B.put('boards.viewZoom', v); show(); }), { id: 'zoomseg' }));
    ls.replaceWith(Object.assign(seg('Look', null, [['sheet', 'Sheet', 'The board on its own (D)'], ['device', 'Device', 'In a device frame, in the E-ink scheme (D)']], device() ? 'device' : 'sheet', function (v) { set('look', v === 'device' ? 'device' : null); }), { id: 'lookseg' }));
    controls();
    links();
    film();
    const src = L.boardSrc(board.file, { render: effective(), state: q.state, props: q.props });
    document.getElementById('full').href = src;
    document.getElementById('cmd').textContent = command();
    if (shownSrc !== src) { shownSrc = src; errs = []; check(false); frame.setAttribute('src', src); }
    fit();
  }

  // links inside the board move the frame: follow it here
  frame.addEventListener('load', function () {
    let w;
    try { w = frame.contentWindow; } catch (e) { return; }
    // the board's file in the design folder (the parent of _boards/, at any sub-path)
    const inside = w.location.pathname.indexOf(B.root.pathname) === 0;
    const path = inside ? decodeURIComponent(w.location.pathname.slice(B.root.pathname.length)) : null;
    if (data && path !== null && path !== board.file && data.boards.some(function (b) { return b.file === path; })) {
      const q = a();
      B.setAddress({ board: path, voice: q.voice, scheme: q.scheme, pen: q.pen, look: q.look, props: {} }, true);
      // the frame already shows the board it moved to: no second load
      board = byFile(path);
      shownSrc = L.boardSrc(path, { render: effective(), state: null, props: {} });
      show();
    }
  });
  B.frameErrors(frame, function (e) { errs = e || []; if (board) check(true); });

  document.getElementById('prev').onclick = function () { go(-1); };
  document.getElementById('next').onclick = function () { go(1); };
  document.getElementById('copy-link').onclick = function (e) { B.copy(location.href, e.currentTarget); };
  document.getElementById('copy-shot').onclick = function (e) { B.copy(command(), e.currentTarget); };
  B.keys({
    j: function () { go(1); }, k: function () { go(-1); }, arrowright: function () { go(1); }, arrowleft: function () { go(-1); },
    1: function () { zoomMode = 'fit'; B.put('boards.viewZoom', 'fit'); show(); }, 0: function () { zoomMode = '1'; B.put('boards.viewZoom', '1'); show(); },
    d: function () { set('look', device() ? null : 'device'); },
    m: function () { location.href = 'matrix.html' + L.serialise(Object.assign({ board: board.file, state: a().state }, keep())); },
    escape: function () { location.href = document.getElementById('back').href; },
    s: function () { if (!board || !board.states.length) return false; const i = board.states.findIndex(function (x) { return x.id === a().state; }); set('state', i + 1 < board.states.length ? board.states[i + 1].id : null); },
  });
  bar.onRender(function () { if (data && board) show(); });
  window.addEventListener('resize', fit);
  window.addEventListener('popstate', function () { if (data) show(); });
  function load() { Promise.all([B.canvas(), B.review()]).then(function (all) { data = all[0]; rv = all[1]; show(); }); }
  B.onChange(function () {
    try { frame.contentWindow.location.reload(); } catch (e) { /* not loaded */ }
    B.canvas(true).then(function (d) { data = d; show(); });
  });
  load();
})();
