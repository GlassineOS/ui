// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: the browser runtime (spec 003 FR-001). Served as a board's ./support.js after the
// vendored Preact and template.js. It stops the browser from parsing the board, reads the board's
// source itself (template.js), loads its head scripts, and mounts its logic class with Preact.
//
// State for tools: window.__boards = {subset, board, pending, settled, errors: [{board, kind,
// feature, detail, line, message}]}. 'settled' turns true once every board in the tree has loaded,
// rendered and the fonts are ready; the event 'boards:settled' fires on window then.
(function () {
  'use strict';
  const P = window.preact, T = window.BoardsTemplate;
  const CFG = window.__BOARDS_CONFIG || {};
  if (!/\.dc\.html$/.test(location.pathname)) return;

  // Stop the HTML parser here: the rest of the file (template, logic) becomes the text of a hidden
  // element and nothing in it is loaded or run by the browser. The runtime reads the source below.
  document.write('<plaintext hidden style="display:none">');

  const status = window.__boards = { subset: T.SUBSET_VERSION, board: null, pending: 0, settled: false, errors: [] };
  const seen = new Set();
  function report(e) {
    const key = [e.board, e.kind, e.feature, e.detail, e.line, e.message].join('|');
    if (seen.has(key)) return;
    seen.add(key);
    status.errors.push(e);
    try { console.warn('[boards] ' + e.board + (e.line ? ':' + e.line : '') + ': ' + e.kind + ': ' + (e.feature || '') + (e.detail ? ' ' + e.detail : '') + (e.message ? ' ' + e.message : '')); } catch (x) { /* no console */ }
  }
  window.addEventListener('error', function (ev) {
    report({ board: status.board, kind: 'script', feature: '', detail: '', line: ev.lineno || 0, message: String(ev.message || ev.error) });
  });
  window.addEventListener('unhandledrejection', function (ev) {
    report({ board: status.board, kind: 'script', feature: 'unhandled rejection', detail: '', line: 0, message: String(ev.reason && ev.reason.message || ev.reason) });
  });

  const h = P.h;
  const ROOT = new URL('/', location.href).href;
  function fileOf(url) { const u = new URL(url); return decodeURIComponent(u.pathname.slice(1)); }

  // ---- the visible error (003 FR-003) ---------------------------------------------------------
  function errorBox(board, lines) {
    return h('div', { 'data-dc-error': board, role: 'alert', style: 'box-sizing:border-box;margin:4px;padding:8px 10px;border:2px solid #c00;background:#fff;color:#900;font:13px/1.4 monospace;white-space:pre-wrap;text-align:left' },
      'Board ' + board + ' cannot be rendered:\n' + lines.join('\n'));
  }
  function issueLine(i) { return (i.line ? 'line ' + i.line + ': ' : '') + (i.kind === 'unsupported' ? 'unsupported ' : '') + i.feature + (i.detail ? ' ' + i.detail : '') + (i.message ? ' ' + i.message : ''); }

  // ---- loading --------------------------------------------------------------------------------
  const boards = new Map(); // url → {url, file, state: loading|ready|error, doc, Class, problems, waiters}
  const scripts = new Map(); // absolute src → promise
  let settleTimer = 0, mounted = false;

  function loadScript(src) {
    if (!scripts.has(src)) {
      scripts.set(src, new Promise(function (resolve) {
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = function () { resolve(true); };
        s.onerror = function () { resolve(false); };
        document.head.appendChild(s);
      }));
    }
    return scripts.get(src);
  }

  const helmets = new Set();
  function injectHelmet(doc) {
    for (const n of doc.helmet) {
      const key = n.tag + '|' + JSON.stringify(n.attrs) + '|' + n.text;
      if (helmets.has(key)) continue;
      helmets.add(key);
      const el = document.createElement(n.tag);
      for (const k of Object.keys(n.attrs)) el.setAttribute(k, n.attrs[k]);
      if (n.text) el.textContent = n.text;
      el.setAttribute('data-dc-helmet', doc.file);
      document.head.appendChild(el);
    }
  }

  // the board's line of an error thrown in its logic, from the stack (0 when it has none)
  function logicLine(e, rec) {
    const st = String(e && e.stack || '');
    const at = st.indexOf(rec.url + '.logic.js:');
    if (at < 0) return 0;
    const m = /^:(\d+)/.exec(st.slice(at + rec.url.length + 9));
    return m ? Number(m[1]) : 0;
  }

  const LIFECYCLE = ['componentDidMount', 'componentDidUpdate', 'componentWillUnmount', 'shouldComponentUpdate', 'getSnapshotBeforeUpdate'];
  function evaluate(rec) {
    const doc = rec.doc;
    let C;
    try {
      // keeps the file's line numbers: the logic starts on the line of its <script> tag, and the
      // Function wrapper adds two lines of its own
      const pad = new Array(Math.max(0, doc.codeLine - 2)).join('\n');
      const fn = new Function('DCLogic', pad + doc.code + '\n;return typeof Component === "function" ? Component : undefined;\n//# sourceURL=' + rec.url + '.logic.js');
      C = fn(DCLogic);
    } catch (e) {
      throw { kind: 'script', feature: 'logic', message: String(e && e.message || e), line: e && e.lineNumber || logicLine(e, rec) };
    }
    if (typeof C !== 'function' || !(C.prototype instanceof DCLogic)) throw { kind: 'unsupported', feature: 'logic that is not "class Component extends DCLogic"', line: doc.codeLine };
    if (Object.prototype.hasOwnProperty.call(C.prototype, 'render')) throw { kind: 'unsupported', feature: 'render() in the logic class', line: doc.codeLine };
    for (const m of LIFECYCLE) {
      if (!Object.prototype.hasOwnProperty.call(C.prototype, m)) continue;
      const f = C.prototype[m];
      C.prototype[m] = function () {
        try { return f.apply(this, arguments); } catch (e) {
          report({ board: rec.file, kind: 'script', feature: m + '()', detail: '', line: logicLine(e, rec), message: String(e && e.message || e) });
          return m === 'shouldComponentUpdate' ? true : undefined;
        }
      };
    }
    Object.defineProperty(C, '__dcRec', { value: rec });
    return C;
  }

  function loadBoard(url) {
    if (boards.has(url)) return boards.get(url).promise;
    const rec = { url: url, file: fileOf(url), state: 'loading', doc: null, Class: null, problems: [], waiters: new Set() };
    boards.set(url, rec);
    status.pending++;
    rec.promise = (async function () {
      try {
        let res;
        try { res = await fetch(url, { cache: 'no-cache' }); } catch (e) { rec.missing = String(e && e.message || e); throw { kind: 'load', feature: 'board file', message: rec.missing }; }
        if (!res.ok) { rec.missing = 'HTTP ' + res.status; throw { kind: 'load', feature: 'board file', message: rec.missing }; }
        rec.doc = T.parseBoard(await res.text(), rec.file);
        if (rec.doc.issues.length) {
          for (const i of rec.doc.issues) { const e = Object.assign({ board: rec.file }, i); report(e); rec.problems.push(e); }
          rec.state = 'error';
          return rec;
        }
        for (const s of rec.doc.headScripts) {
          const src = new URL(s.src, url).href;
          if (!(await loadScript(src))) throw { kind: 'load', feature: 'head script', detail: s.src, line: s.line, message: 'did not load' };
        }
        injectHelmet(rec.doc);
        rec.Class = evaluate(rec);
        rec.state = 'ready';
      } catch (e) {
        const p = Object.assign({ board: rec.file, kind: 'load', feature: '', detail: '', line: 0, message: '' }, e && e.kind ? e : { message: String(e && e.message || e) });
        report(p);
        rec.problems.push(p);
        rec.state = 'error';
      } finally {
        status.pending--;
        for (const w of rec.waiters) { try { w.forceUpdate(); } catch (x) { /* unmounted */ } }
        rec.waiters.clear();
        scheduleSettle();
      }
      return rec;
    })();
    return rec.promise;
  }

  // the boards a loaded board imports: [{name, file (URL), line}]
  function importsOf(url) {
    const rec = boards.get(url);
    if (!rec || rec.state !== 'ready') return [];
    return rec.doc.imports.map(function (n) { return { name: n, file: new URL(n + '.dc.html', url).href, line: rec.doc.importLines[n] }; });
  }

  // the board and every board it imports, before the first render (cycle-safe). A board that
  // isn't there is also reported on the <dc-import> that names it.
  async function loadTree(url, done) {
    done = done || new Set();
    if (done.has(url)) return;
    done.add(url);
    const rec = await loadBoard(url);
    if (rec.state !== 'ready') return;
    const imps = importsOf(url);
    await Promise.all(imps.map(function (i) { return loadTree(i.file, done); }));
    for (const i of imps) {
      const child = boards.get(i.file);
      if (child && child.missing) report({ board: rec.file, kind: 'load', feature: '<dc-import>', detail: i.name, line: i.line, message: child.file + ': ' + child.missing });
    }
  }

  // A board whose <dc-import> leads back to itself would render without end: each such board is
  // an error, on the line of that <dc-import> (found once the tree has loaded, before rendering).
  function markCycles() {
    const found = [];
    for (const rec of boards.values()) {
      if (rec.state !== 'ready') continue;
      for (const c of T.importCycles(rec.url, importsOf)) found.push({ rec: rec, c: c });
    }
    for (const f of found) {
      const p = { board: f.rec.file, kind: 'unsupported', feature: 'dc-import cycle', detail: f.c.chain.map(fileOf).join(' → '), line: f.c.line, message: '' };
      report(p);
      f.rec.problems.push(p);
      f.rec.state = 'error';
    }
  }

  function scheduleSettle() {
    if (!mounted) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(function () {
      if (status.pending) return;
      // timers, not animation frames: a page in a background tab gets no frames
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
        setTimeout(function () {
          if (status.pending || status.settled) return;
          status.settled = true;
          window.dispatchEvent(new Event('boards:settled'));
        }, 50);
      });
    }, 50);
  }

  // ---- the logic base class -------------------------------------------------------------------
  class DCLogic extends P.Component {
    renderVals() { return {}; }
    render() {
      const rec = this.constructor.__dcRec;
      let vals;
      try { vals = this.renderVals(); } catch (e) {
        report({ board: rec.file, kind: 'script', feature: 'renderVals()', detail: '', line: logicLine(e, rec), message: String(e && e.message || e) });
        return errorBox(rec.file, ['renderVals() threw: ' + String(e && e.message || e)]);
      }
      if (vals === null || typeof vals !== 'object') {
        report({ board: rec.file, kind: 'script', feature: 'renderVals()', detail: '', line: 0, message: 'returned ' + typeof vals + ', not an object' });
        return errorBox(rec.file, ['renderVals() returned ' + typeof vals]);
      }
      const self = this;
      const kids = T.renderNodes(rec.doc.template, T.rootScope(vals), {
        h: h,
        onError: function (message, line) { report({ board: rec.file, kind: 'render', feature: '', detail: '', line: line, message: message }); },
        renderImport: function (node, props, scope) { return renderImport(self, rec, node, props, scope); },
        href: function (v) { return resolveHref(v, rec.url); },
      });
      return h(P.Fragment, null, kids);
    }
  }
  window.DCLogic = DCLogic;

  // keeps a failing child from taking its parent down, and shows the failure where the child was
  class Boundary extends P.Component {
    componentDidCatch(e) {
      report({ board: this.props.board, kind: 'script', feature: 'component', detail: '', line: 0, message: String(e && e.message || e) });
      this.setState({ failed: String(e && e.message || e) });
    }
    render() { return this.state.failed ? errorBox(this.props.board, [this.state.failed]) : this.props.children; }
  }

  function styleText(s) {
    if (!s) return '';
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return Object.keys(s).map(function (k) { return k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + ':' + s[k]; }).join(';');
    return '';
  }

  // <dc-import name="X">: a positioned block that holds the child board; hint-size sizes it until
  // the child has loaded.
  function renderImport(owner, rec, node, props, scope) {
    const url = new URL(node.file, rec.url).href;
    let child = boards.get(url);
    if (!child) { loadBoard(url); child = boards.get(url); }
    const style = 'position:relative;' + styleText(node.style ? T.evalBinding(node.style, scope, function (m) {
      report({ board: rec.file, kind: 'render', feature: '', detail: '', line: node.line, message: m });
    }) : '');
    if (child.state === 'ready') return h('div', { 'data-dc-import': node.name, style: style }, h(Boundary, { board: child.file }, h(child.Class, props)));
    if (child.state === 'error') return h('div', { 'data-dc-import': node.name, style: style }, errorBox(child.file, child.problems.map(issueLine)));
    child.waiters.add(owner);
    const hint = node.hint ? 'width:' + (node.hint.w || 'auto') + ';height:' + (node.hint.h || 'auto') + ';' : '';
    return h('div', { 'data-dc-import': node.name, 'data-dc-pending': '', style: style + hint });
  }

  // a link to a board is relative to the board that holds it; "/" is the canvas root
  function resolveHref(v, base) {
    if (!/\.dc\.html(?:[?#]|$)/.test(v) || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(v)) return v;
    return new URL(v, v[0] === '/' ? ROOT : base).pathname + (v.indexOf('#') >= 0 ? v.slice(v.indexOf('#')) : '');
  }

  // links keep the preview's voice, scheme and pen; other sites open in a new tab
  const CARRY = ['voice', 'scheme', 'pen'];
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    const a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href[0] === '#') return;
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) {
      ev.preventDefault();
      if (u.protocol === 'http:' || u.protocol === 'https:') window.open(u.href, '_blank', 'noopener');
      return;
    }
    if (!/\.dc\.html$/.test(u.pathname)) return;
    ev.preventDefault();
    const here = new URLSearchParams(location.search);
    for (const k of CARRY) if (here.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, here.get(k));
    location.assign(u.href);
  });

  // ---- props of the top board: data-props defaults (as an editor seeds them), then the query --
  function typed(spec, v) {
    const e = spec && spec.editor;
    if (e === 'boolean') return v === 'true' || v === '1';
    if (e === 'int' || e === 'float' || e === 'range' || e === 'number') { const n = Number(v); return isNaN(n) ? v : n; }
    if (e === 'enum' || e === 'text' || e === 'color') return v;
    try { return JSON.parse(v); } catch (x) { return v; }
  }
  function topProps(doc, q) {
    const props = {};
    for (const k of Object.keys(doc.props)) if ('default' in doc.props[k]) props[k] = doc.props[k].default;
    // the preview's voice picker reaches boards that call their voice "voice" or "theme"
    const glob = { voice: ['voice', 'theme'], scheme: ['scheme'], pen: ['pen'] };
    for (const g of Object.keys(glob)) {
      if (!q.has(g)) continue;
      for (const k of glob[g]) if (doc.props[k]) props[k] = typed(doc.props[k], q.get(g));
    }
    for (const [k, v] of q) {
      const name = k.slice(2);
      if (k.startsWith('p.') && /^[A-Za-z_$][\w$]*$/.test(name) && ['__proto__', 'constructor', 'prototype'].indexOf(name) < 0) props[name] = typed(doc.props[name], v);
    }
    return props;
  }

  // ---- start ----------------------------------------------------------------------------------
  async function start() {
    const url = location.href.split('#')[0].split('?')[0];
    status.board = fileOf(url);
    // the parser stopped at <plaintext>; should the board have been parsed anyway (support.js not
    // loaded as a plain script), its raw template must not show beside the mount
    for (const e of document.querySelectorAll('plaintext, x-dc, script[data-dc-script]')) e.remove();
    const root = document.createElement('div');
    root.id = 'dc-root';
    root.style.display = 'contents';
    document.body.appendChild(root);
    await loadTree(url);
    markCycles();
    const rec = boards.get(url);
    if (rec.doc) {
      if (rec.doc.lang) document.documentElement.lang = rec.doc.lang;
      if (rec.doc.title) document.title = rec.doc.title;
      for (const m of rec.doc.meta) {
        if (!m.name) continue;
        const el = document.createElement('meta');
        for (const k of Object.keys(m)) el.setAttribute(k, m[k]);
        document.head.appendChild(el);
      }
    }
    if (rec.state !== 'ready') P.render(errorBox(rec.file, rec.problems.map(issueLine)), root);
    else P.render(h(Boundary, { board: rec.file }, h(rec.Class, topProps(rec.doc, new URLSearchParams(location.search)))), root);
    mounted = true;
    scheduleSettle();
  }

  // live reload when opened on its own; inside the preview the page around it reloads it (one
  // event stream per tab: browsers allow only a few connections per server)
  if (CFG.live && window.EventSource && window.top === window) {
    try {
      const es = new EventSource(CFG.events || '/_boards/events');
      es.addEventListener('change', function () { location.reload(); });
    } catch (x) { /* no live reload */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
