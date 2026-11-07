// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: the reader for the board format (spec 003). Plain JavaScript without a DOM, so the
// browser runtime (runtime.js) and the node tools (preview, import, check, tests) share one reader.
//
// A board's template is never handed to the browser's HTML parser: that parser moves <sc-for> out of
// <tbody> and <select> and lowercases attribute names (viewBox, onClick). This reader keeps both.
//
// What the reader accepts is the supported subset (003 FR-005), version SUBSET_VERSION. Anything
// else becomes an issue {kind: 'unsupported', feature, detail, line}; the runtime refuses to render a
// board with issues and shows them instead (003 FR-003).
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.BoardsTemplate = m;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SUBSET_VERSION = 1;

  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const RAWTEXT = new Set(['script', 'style']);
  const RCDATA = new Set(['textarea', 'title']);
  // end tags HTML lets an author leave out; closing their parent closes them silently
  const OPTIONAL_END = new Set(['p', 'li', 'dt', 'dd', 'option', 'optgroup', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot', 'colgroup']);
  // a start tag of the key closes an open element of the listed names (the common implied ends)
  const IMPLIED = { li: ['li'], dt: ['dt', 'dd'], dd: ['dt', 'dd'], option: ['option'], tr: ['tr', 'td', 'th'], td: ['td', 'th'], th: ['td', 'th'] };

  const P_CLOSERS = new Set(['address', 'article', 'aside', 'blockquote', 'details', 'dialog', 'div', 'dl', 'fieldset', 'figcaption', 'figure',
    'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav', 'ol', 'p', 'pre', 'section', 'table', 'ul']);
  const P_SCOPE = new Set(['button', 'table', 'td', 'th', 'caption', 'html', 'template', 'object', 'marquee', 'applet', 'sc-if', 'sc-for', 'x-dc']);

  const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '­', ensp: ' ', emsp: ' ',
    thinsp: ' ', zwnj: '‌', zwj: '‍', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
    sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„', laquo: '«', raquo: '»', hellip: '…',
    middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', times: '×', divide: '÷',
    deg: '°', plusmn: '±', minus: '−', sect: '§', para: '¶', euro: '€', larr: '←',
    uarr: '↑', rarr: '→', darr: '↓', harr: '↔', check: '✓', hearts: '♥', star: '☆',
  };

  // React-style event attribute (without "on") → DOM event. Change is resolved per element at render
  // time (input-like controls report every edit, as in React). Focus/Blur bubble in React: focusin/out.
  const EVENTS = {
    Click: 'click', DoubleClick: 'dblclick', ContextMenu: 'contextmenu', Change: null, Input: 'input', Submit: 'submit',
    KeyDown: 'keydown', KeyUp: 'keyup', KeyPress: 'keypress', Focus: 'focusin', Blur: 'focusout',
    MouseDown: 'mousedown', MouseUp: 'mouseup', MouseMove: 'mousemove', MouseEnter: 'mouseenter', MouseLeave: 'mouseleave',
    MouseOver: 'mouseover', MouseOut: 'mouseout', PointerDown: 'pointerdown', PointerUp: 'pointerup', PointerMove: 'pointermove',
    PointerCancel: 'pointercancel', PointerEnter: 'pointerenter', PointerLeave: 'pointerleave', PointerOver: 'pointerover',
    PointerOut: 'pointerout', TouchStart: 'touchstart', TouchMove: 'touchmove', TouchEnd: 'touchend', TouchCancel: 'touchcancel',
    Wheel: 'wheel', Scroll: 'scroll', DragStart: 'dragstart', Drag: 'drag', DragEnd: 'dragend', DragEnter: 'dragenter',
    DragOver: 'dragover', DragLeave: 'dragleave', Drop: 'drop', Toggle: 'toggle', Load: 'load', Error: 'error',
    Copy: 'copy', Cut: 'cut', Paste: 'paste',
  };

  const HOLE_RE = /\{\{([\s\S]*?)\}\}/g;
  const PATH_RE = /^[A-Za-z_$][\w$]*(?:\.[\w$]+)*$/;
  const NUM_RE = /^-?\d+(?:\.\d+)?$/;
  const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

  // ---- lines ----------------------------------------------------------------------------------
  function lineIndex(src) {
    const starts = [0];
    for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
    return function (pos) {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
      return lo + 1;
    };
  }

  // ---- entities -------------------------------------------------------------------------------
  function decode(s, issue, line) {
    if (s.indexOf('&') < 0) return s;
    return s.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g, function (m, e) {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m;
      }
      if (Object.prototype.hasOwnProperty.call(ENTITIES, e)) return ENTITIES[e];
      if (issue) issue('unsupported', 'character reference', '&' + e + ';', line);
      return m;
    });
  }

  // ---- HTML tokenizer and tree ----------------------------------------------------------------
  // Nodes: {type: 'element', tag, attrs: [{name, value|null, line}], children, line, selfClosing}
  //        (written: the tag as written), {type: 'text', text (not decoded), line}
  function parseHTML(src, issue) {
    const lineOf = lineIndex(src);
    const top = { type: 'root', tag: '#root', children: [], svg: false };
    const stack = [top];
    let i = 0;
    const cur = () => stack[stack.length - 1];
    const text = (t, pos) => { if (t) cur().children.push({ type: 'text', text: t, line: lineOf(pos) }); };
    const close = (tag, pos) => {
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tag === tag || stack[k].tag.toLowerCase() === tag.toLowerCase()) {
          for (let j = stack.length - 1; j > k; j--) {
            if (!OPTIONAL_END.has(stack[j].tag)) issue('unsupported', 'unclosed element', '<' + stack[j].tag + '> closed by </' + tag + '>', stack[j].line);
          }
          stack.length = k;
          return;
        }
      }
      issue('unsupported', 'stray end tag', '</' + tag + '>', lineOf(pos));
    };
    while (i < src.length) {
      const lt = src.indexOf('<', i);
      if (lt < 0) { text(src.slice(i), i); break; }
      if (lt > i) text(src.slice(i, lt), i);
      if (src.startsWith('<!--', lt)) {
        const end = src.indexOf('-->', lt + 4);
        i = end < 0 ? src.length : end + 3;
        continue;
      }
      if (src[lt + 1] === '!' || src[lt + 1] === '?') {
        const end = src.indexOf('>', lt);
        i = end < 0 ? src.length : end + 1;
        continue;
      }
      if (src[lt + 1] === '/') {
        const m = /^<\/([A-Za-z][\w:-]*)\s*>/.exec(src.slice(lt, lt + 200));
        if (!m) { text('<', lt); i = lt + 1; continue; }
        close(m[1], lt);
        i = lt + m[0].length;
        continue;
      }
      const nm = /^<([A-Za-z][\w:-]*)/.exec(src.slice(lt, lt + 200));
      if (!nm) { text('<', lt); i = lt + 1; continue; }
      // attributes
      let p = lt + nm[0].length;
      const attrs = [];
      let selfClosing = false;
      for (;;) {
        while (p < src.length && /\s/.test(src[p])) p++;
        if (p >= src.length) break;
        if (src[p] === '>') { p++; break; }
        if (src[p] === '/' && src[p + 1] === '>') { selfClosing = true; p += 2; break; }
        if (src[p] === '/') { p++; continue; }
        const an = /^[^\s"'>\/=]+/.exec(src.slice(p, p + 200));
        if (!an) { p++; continue; }
        const aline = lineOf(p);
        p += an[0].length;
        let q = p;
        while (q < src.length && /\s/.test(src[q])) q++;
        let value = null;
        if (src[q] === '=') {
          q++;
          while (q < src.length && /\s/.test(src[q])) q++;
          if (src[q] === '"' || src[q] === "'") {
            const end = src.indexOf(src[q], q + 1);
            value = src.slice(q + 1, end < 0 ? src.length : end);
            p = end < 0 ? src.length : end + 1;
          } else {
            const uv = /^[^\s>]*/.exec(src.slice(q))[0];
            value = uv;
            p = q + uv.length;
          }
        }
        attrs.push({ name: an[0], value: value, line: aline });
      }
      const parent = cur();
      const inSvg = parent.svg || nm[1].toLowerCase() === 'svg';
      const tag = inSvg ? nm[1] : nm[1].toLowerCase();
      const el = { type: 'element', tag: tag, written: nm[1], inSvg: inSvg, attrs: attrs, children: [], line: lineOf(lt), selfClosing: selfClosing, svg: inSvg && tag !== 'foreignObject' };
      if (!inSvg && P_CLOSERS.has(tag)) {
        // as in HTML, a block start tag closes an open <p> (up to the nearest scope boundary)
        for (let k = stack.length - 1; k > 0; k--) {
          if (stack[k].tag === 'p') { stack.length = k; break; }
          if (P_SCOPE.has(stack[k].tag) || stack[k].svg) break;
        }
      }
      if (!inSvg && IMPLIED[tag]) {
        const closes = IMPLIED[tag];
        for (let k = stack.length - 1; k > 0; k--) {
          if (closes.indexOf(stack[k].tag) >= 0) { stack.length = k; break; }
          if (['ul', 'ol', 'dl', 'select', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'div', 'sc-for', 'sc-if'].indexOf(stack[k].tag) >= 0) break;
        }
      }
      cur().children.push(el);
      i = p;
      if (RAWTEXT.has(tag) || RCDATA.has(tag)) {
        if (selfClosing) continue;
        const re = new RegExp('</' + tag + '\\s*>', 'i');
        const rest = src.slice(i);
        const m = re.exec(rest);
        const body = m ? rest.slice(0, m.index) : rest;
        if (body) el.children.push({ type: 'text', text: body, line: lineOf(i), raw: true });
        i += m ? m.index + m[0].length : rest.length;
        continue;
      }
      if (VOID.has(tag) && !inSvg) continue;
      if (selfClosing) {
        if (!inSvg) issue('unsupported', 'self-closing tag', '<' + tag + '/>', el.line);
        continue;
      }
      stack.push(el);
    }
    for (let k = stack.length - 1; k > 0; k--) {
      if (!OPTIONAL_END.has(stack[k].tag)) issue('unsupported', 'unclosed element', '<' + stack[k].tag + '>', stack[k].line);
    }
    return top.children;
  }

  // ---- holes ----------------------------------------------------------------------------------
  // A hole is a dotted path ({{ a.b }}, {{ $index }}) or a literal (true, false, null, a number).
  function parseHole(expr) {
    const s = expr.trim();
    if (s === 'true') return { lit: true, src: s };
    if (s === 'false') return { lit: false, src: s };
    if (s === 'null') return { lit: null, src: s };
    if (s === 'undefined') return { lit: undefined, src: s };
    if (NUM_RE.test(s)) return { lit: Number(s), src: s };
    if (PATH_RE.test(s)) return { path: s.split('.'), src: s };
    return null;
  }

  // Split a string into literal pieces (entities decoded unless raw) and holes.
  function splitHoles(s, issue, line, raw) {
    const parts = [];
    let last = 0, m;
    HOLE_RE.lastIndex = 0;
    while ((m = HOLE_RE.exec(s))) {
      if (m.index > last) parts.push(raw ? s.slice(last, m.index) : decode(s.slice(last, m.index), issue, line));
      const h = parseHole(m[1]);
      if (!h) issue('unsupported', 'expression in a hole', '{{' + m[1] + '}}', line);
      else parts.push(h);
      last = m.index + m[0].length;
    }
    const tail = s.slice(last);
    if (tail.indexOf('{{') >= 0) issue('unsupported', 'unclosed hole', tail.slice(tail.indexOf('{{'), tail.indexOf('{{') + 40), line);
    if (tail) parts.push(raw ? tail : decode(tail, issue, line));
    return parts;
  }

  // An attribute value: {lit} (no holes), {hole} (the whole value is one hole: the raw value), or
  // {parts} (text and holes: an interpolated string).
  function binding(value, issue, line) {
    if (value === null) return { lit: '' };
    if (value.indexOf('{{') < 0) return { lit: decode(value, issue, line) };
    const parts = splitHoles(value, issue, line);
    const t = value.trim();
    if (parts.length === 1 && typeof parts[0] === 'object' && t.startsWith('{{') && t.endsWith('}}') && t.indexOf('{{', 2) < 0) return { hole: parts[0] };
    return { parts: parts };
  }

  function kebabToCamel(s) { return s.replace(/-([a-z0-9])/g, function (_, c) { return c.toUpperCase(); }); }

  // ---- template compile -----------------------------------------------------------------------
  // Compiled nodes:
  //   {k: 'text', parts}
  //   {k: 'el', tag, attrs: [{name, b}], events: [{react, b}], ref: b|null, children, line}
  //   {k: 'if', b, children, line}            {k: 'for', b, as, children, line}
  //   {k: 'import', name, file, style: b|null, hint: {w, h}|null, props: [{name, b}], line}
  function compileNodes(nodes, issue, ctx) {
    const out = [];
    for (const n of nodes) {
      const c = compileNode(n, issue, ctx);
      if (c) out.push(c);
    }
    return out;
  }

  function attrMap(n) { const m = {}; for (const a of n.attrs) m[a.name] = a; return m; }

  function compileNode(n, issue, ctx) {
    if (n.type === 'text') {
      const parts = splitHoles(n.text, issue, n.line, false);
      return parts.length ? { k: 'text', parts: parts } : null;
    }
    const tag = n.tag;
    const A = attrMap(n);
    if (tag === 'sc-if' || tag === 'sc-for') {
      const allowed = tag === 'sc-if' ? ['value', 'hint-placeholder-val'] : ['list', 'as', 'hint-placeholder-count'];
      for (const a of n.attrs) if (allowed.indexOf(a.name) < 0) issue('unsupported', 'attribute of <' + tag + '>', a.name, a.line);
      const key = tag === 'sc-if' ? 'value' : 'list';
      if (!A[key]) { issue('unsupported', '<' + tag + '> without ' + key, '', n.line); return null; }
      const b = binding(A[key].value, issue, A[key].line);
      if (!b.hole) { issue('unsupported', '<' + tag + '> ' + key + ' that is not one {{ hole }}', A[key].value || '', A[key].line); return null; }
      if (tag === 'sc-if') return { k: 'if', b: b, children: compileNodes(n.children, issue, ctx), line: n.line };
      const as = A.as ? A.as.value : null;
      if (!as || !IDENT_RE.test(as)) { issue('unsupported', '<sc-for> as that is not a name', as || '', n.line); return null; }
      return { k: 'for', b: b, as: as, children: compileNodes(n.children, issue, ctx), line: n.line };
    }
    if (tag === 'dc-import') {
      if (n.selfClosing) return null; // reported by the tokenizer
      for (const ch of n.children) {
        if (ch.type !== 'text' || ch.text.trim()) { issue('unsupported', 'content inside <dc-import>', '', n.line); break; }
      }
      const nameA = A.name;
      if (!nameA || !nameA.value) { issue('unsupported', '<dc-import> without name', '', n.line); return null; }
      if (nameA.value.indexOf('{{') >= 0) { issue('unsupported', '<dc-import> name with a hole', nameA.value, n.line); return null; }
      const name = nameA.value;
      if (!/^[\w./-]+$/.test(name)) { issue('unsupported', '<dc-import> name', name, n.line); return null; }
      const imp = { k: 'import', name: name, file: name + '.dc.html', style: null, hint: null, props: [], line: n.line };
      for (const a of n.attrs) {
        if (a.name === 'name') continue;
        if (a.name === 'style') { imp.style = binding(a.value, issue, a.line); continue; }
        if (a.name === 'hint-size') {
          const v = String(a.value || '').split(',');
          imp.hint = { w: (v[0] || '').trim(), h: (v[1] || '').trim() };
          continue;
        }
        if (a.name.startsWith('hint-')) { issue('unsupported', 'attribute of <dc-import>', a.name, a.line); continue; }
        if (!/^[a-z][a-z0-9-]*$/.test(a.name)) { issue('unsupported', 'prop name on <dc-import> (use kebab-case)', a.name, a.line); continue; }
        imp.props.push({ name: kebabToCamel(a.name), b: binding(a.value, issue, a.line) });
      }
      if (ctx) ctx.imports.push({ name: name, line: n.line });
      return imp;
    }
    if (tag === 'helmet') { issue('unsupported', '<helmet> below the top of <x-dc>', '', n.line); return null; }
    if (tag === 'x-dc' || tag.startsWith('sc-') || tag.startsWith('dc-')) { issue('unsupported', 'element', '<' + tag + '>', n.line); return null; }
    if (tag === 'script') { issue('unsupported', '<script> in the template', '', n.line); return null; }
    if (!n.inSvg && /[A-Z]/.test(n.written || tag)) { issue('unsupported', 'capitalized tag', '<' + (n.written || tag) + '>', n.line); return null; }
    const el = { k: 'el', tag: tag, attrs: [], events: [], ref: null, children: [], line: n.line };
    for (const a of n.attrs) {
      const name = a.name;
      if (/^on[A-Z]/.test(name)) {
        const r = name.slice(2);
        if (!Object.prototype.hasOwnProperty.call(EVENTS, r)) { issue('unsupported', 'event attribute', name, a.line); continue; }
        const b = binding(a.value, issue, a.line);
        if (!b.hole) { issue('unsupported', 'event attribute that is not one {{ hole }}', name + '="' + (a.value || '') + '"', a.line); continue; }
        el.events.push({ react: r, b: b });
        continue;
      }
      if (/^on[a-z]/.test(name)) { issue('unsupported', 'inline event handler', name, a.line); continue; }
      if (name === 'ref') {
        const b = binding(a.value, issue, a.line);
        if (!b.hole) { issue('unsupported', 'ref that is not one {{ hole }}', a.value || '', a.line); continue; }
        el.ref = b;
        continue;
      }
      if (name === 'key' || name === 'dangerouslySetInnerHTML' || name === 'is') { issue('unsupported', 'attribute', name, a.line); continue; }
      let pname = name;
      if (name === 'className') pname = 'class';
      else if (name === 'htmlFor') pname = 'for';
      el.attrs.push({ name: pname, b: binding(a.value, issue, a.line) });
    }
    if (tag === 'textarea') {
      // RCDATA: its text (with holes) is the initial value
      const t = n.children.length ? n.children[0].text : '';
      if (t) el.attrs.push({ name: 'defaultValue', b: t.indexOf('{{') >= 0 ? { parts: splitHoles(t, issue, n.line, false) } : { lit: decode(t, issue, n.line) } });
      return el;
    }
    if (tag === 'style' || tag === 'title') {
      const t = n.children.length ? n.children[0].text : '';
      if (t.indexOf('{{') >= 0) issue('unsupported', 'hole inside <' + tag + '>', '', n.line);
      if (t) el.children.push({ k: 'text', parts: [tag === 'title' ? decode(t, issue, n.line) : t] });
      return el;
    }
    el.children = compileNodes(n.children, issue, ctx);
    return el;
  }

  // ---- board file ------------------------------------------------------------------------------
  function findEl(nodes, tag) { for (const n of nodes) if (n.type === 'element' && n.tag === tag) return n; return null; }
  function onlyWhitespace(n) { return n.type === 'text' && !n.text.trim(); }

  // parseBoard(src, file) → {file, lang, title, meta, headScripts, helmet, template, code, codeLine,
  //   props, preview, imports, importLines, issues}. A board with issues must not be rendered.
  //   imports: the names of the boards it imports; importLines: name → line of its first <dc-import>.
  function parseBoard(src, file) {
    const issues = [];
    const issue = function (kind, feature, detail, line) { issues.push({ kind: kind, feature: feature, detail: detail || '', line: line || 0 }); };
    const doc = { file: file || '', subset: SUBSET_VERSION, lang: '', title: '', meta: [], headScripts: [], helmet: [], template: [], code: '', codeLine: 0, props: {}, preview: null, imports: [], importLines: Object.create(null), issues: issues };
    const nodes = parseHTML(src, issue);
    const html = findEl(nodes, 'html');
    let head, body;
    if (html) {
      for (const a of html.attrs) if (a.name === 'lang') doc.lang = a.value || '';
      head = findEl(html.children, 'head');
      body = findEl(html.children, 'body');
      for (const n of html.children) {
        if (n === head || n === body || onlyWhitespace(n)) continue;
        issue('unsupported', 'content outside <head> and <body>', n.tag ? '<' + n.tag + '>' : n.text.trim().slice(0, 40), n.line);
      }
    } else {
      issue('unsupported', 'board without <html>', '', 1);
      return doc;
    }
    if (head) {
      for (const n of head.children) {
        if (onlyWhitespace(n)) continue;
        if (n.type === 'element' && n.tag === 'meta') { const m = {}; for (const a of n.attrs) m[a.name] = decode(a.value || '', issue, a.line); doc.meta.push(m); continue; }
        if (n.type === 'element' && n.tag === 'title') { doc.title = decode(n.children.length ? n.children[0].text : '', issue, n.line).trim(); continue; }
        if (n.type === 'element' && n.tag === 'script') {
          const A = attrMap(n);
          const code = n.children.length ? n.children[0].text.trim() : '';
          if (!A.src || code) { issue('unsupported', 'inline <script> in <head>', '', n.line); continue; }
          const s = decode(A.src.value || '', issue, A.src.line);
          if (/(^|\/)support\.js$/.test(s)) {
            // the runtime's own hook: it must run while the page is parsed
            for (const a of n.attrs) if (['src', 'type'].indexOf(a.name) < 0 || a.name === 'type' && a.value && a.value !== 'text/javascript') issue('unsupported', 'attribute of the support.js script', a.name, a.line);
            continue;
          }
          if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(s)) { issue('unsupported', 'remote <script> in <head>', s, n.line); continue; }
          doc.headScripts.push({ src: s, line: n.line });
          continue;
        }
        issue('unsupported', 'element in <head>', n.tag ? '<' + n.tag + '>' : n.text.trim().slice(0, 40), n.line);
      }
    }
    if (!body) { issue('unsupported', 'board without <body>', '', 1); return doc; }
    let xdc = null, script = null;
    for (const n of body.children) {
      if (onlyWhitespace(n)) continue;
      if (n.type === 'element' && n.tag === 'x-dc' && !xdc) { xdc = n; continue; }
      if (n.type === 'element' && n.tag === 'script' && attrMap(n)['data-dc-script'] && !script) { script = n; continue; }
      issue('unsupported', 'content in <body> outside <x-dc> and the logic script', n.tag ? '<' + n.tag + '>' : n.text.trim().slice(0, 40), n.line);
    }
    if (!xdc) { issue('unsupported', 'board without <x-dc>', '', body.line); return doc; }
    if (!script) { issue('unsupported', 'board without the logic script (data-dc-script)', '', body.line); return doc; }

    // the logic script
    const SA = attrMap(script);
    if (!SA.type || SA.type.value !== 'text/x-dc') issue('unsupported', 'logic script type', SA.type ? SA.type.value : '(none)', script.line);
    for (const a of script.attrs) if (['type', 'data-dc-script', 'data-props'].indexOf(a.name) < 0) issue('unsupported', 'attribute of the logic script', a.name, a.line);
    doc.code = script.children.length ? script.children[0].text : '';
    doc.codeLine = script.children.length ? script.children[0].line : script.line;
    if (!/(^|[^\w$.])class\s+Component\s+extends\s+DCLogic\b/.test(doc.code)) issue('unsupported', 'logic that is not "class Component extends DCLogic"', '', script.line);
    if (/^\s*(import|export)\b/m.test(doc.code)) issue('unsupported', 'import or export in the logic', '', script.line);
    if (SA['data-props']) {
      const raw = decode(SA['data-props'].value || '', issue, SA['data-props'].line);
      try {
        const p = JSON.parse(raw || '{}');
        if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('not an object');
        doc.preview = p.$preview && typeof p.$preview === 'object' ? { width: Number(p.$preview.width) || 0, height: Number(p.$preview.height) || 0 } : null;
        for (const k of Object.keys(p)) {
          if (k[0] === '$') { if (k !== '$preview') issue('unsupported', 'data-props entry', k, SA['data-props'].line); continue; }
          if (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k])) { issue('unsupported', 'data-props entry that is not an object', k, SA['data-props'].line); continue; }
          doc.props[k] = p[k];
        }
      } catch (e) {
        issue('error', 'data-props is not JSON', String(e.message || e), SA['data-props'].line);
      }
    }

    // the template: a <helmet> at its top (head content), then the content
    const ctx = { imports: [] };
    const content = [];
    let helmets = 0;
    for (const n of xdc.children) {
      if (n.type === 'element' && n.tag === 'helmet') {
        if (helmets++) issue('unsupported', 'second <helmet>', '', n.line);
        for (const h of n.children) {
          if (onlyWhitespace(h)) continue;
          if (h.type !== 'element' || ['link', 'style', 'meta'].indexOf(h.tag) < 0) { issue('unsupported', 'element in <helmet>', h.tag ? '<' + h.tag + '>' : h.text.trim().slice(0, 40), h.line); continue; }
          const attrs = {};
          for (const a of h.attrs) {
            if ((a.value || '').indexOf('{{') >= 0) issue('unsupported', 'hole in <helmet>', a.name, a.line);
            attrs[a.name] = decode(a.value || '', issue, a.line);
          }
          const text = h.children.length ? h.children[0].text : '';
          if (text.indexOf('{{') >= 0) issue('unsupported', 'hole in <helmet>', '<' + h.tag + '>', h.line);
          doc.helmet.push({ tag: h.tag, attrs: attrs, text: text });
        }
        continue;
      }
      content.push(n);
    }
    doc.template = compileNodes(content, issue, ctx);
    for (const i of ctx.imports) if (!(i.name in doc.importLines)) { doc.importLines[i.name] = i.line; doc.imports.push(i.name); }
    return doc;
  }

  // importCycles(file, importsOf) → [{name, line, chain}]: the <dc-import>s of file that lead back
  // to it, with the boards on the way (chain starts and ends at file). importsOf(file) → [{name,
  // file, line}], the boards a board imports, resolved by the caller (URLs in the browser, paths in
  // node); [] when it isn't known.
  function importCycles(file, importsOf) {
    const out = [];
    for (const imp of importsOf(file)) {
      const back = pathTo(imp.file, file, importsOf);
      if (back) out.push({ name: imp.name, line: imp.line, chain: [file].concat(back) });
    }
    return out;
  }
  function pathTo(from, to, importsOf) {
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
      const f = queue.shift();
      if (f === to) {
        const p = [];
        for (let x = f; x !== null; x = prev.get(x)) p.unshift(x);
        return p;
      }
      for (const i of importsOf(f)) if (!prev.has(i.file)) { prev.set(i.file, f); queue.push(i.file); }
    }
    return null;
  }

  // ---- render ---------------------------------------------------------------------------------
  // Scopes are prototype chains on a null-prototype root, so {{ toString }} finds nothing.
  function rootScope(vals) { const s = Object.create(null); for (const k of Object.keys(vals)) s[k] = vals[k]; return s; }
  function childScope(parent, name, value, index) { const s = Object.create(parent); s[name] = value; s.$index = index; return s; }

  function lookup(h, scope) {
    if ('lit' in h) return h.lit;
    let v = scope[h.path[0]];
    for (let i = 1; i < h.path.length; i++) {
      if (v === null || v === undefined) return undefined;
      v = v[h.path[i]];
    }
    return v;
  }

  // the value of a binding as an attribute or prop: raw for a whole hole, a string otherwise
  function evalBinding(b, scope, onError) {
    if ('lit' in b) return b.lit;
    if (b.hole) return lookup(b.hole, scope);
    let s = '';
    for (const p of b.parts) {
      if (typeof p === 'string') { s += p; continue; }
      const v = lookup(p, scope);
      if (v === null || v === undefined) continue;
      if (typeof v === 'object' || typeof v === 'function') { onError('{{ ' + p.src + ' }} inside a string is ' + (Array.isArray(v) ? 'an array' : typeof v)); continue; }
      s += String(v);
    }
    return s;
  }

  function textValue(v, src, onError) {
    if (v === null || v === undefined || typeof v === 'boolean') return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    if (Array.isArray(v) && v.every(function (x) { return x === null || x === undefined || typeof x !== 'object' && typeof x !== 'function'; })) {
      return v.map(function (x) { return x === null || x === undefined || typeof x === 'boolean' ? '' : String(x); }).join('');
    }
    onError('{{ ' + src + ' }} in text is ' + (Array.isArray(v) ? 'an array of objects' : typeof v));
    return '';
  }

  function changeEvent(tag, type) {
    if (tag === 'textarea') return 'input';
    if (tag === 'input') return ['checkbox', 'radio', 'file'].indexOf(String(type || 'text').toLowerCase()) >= 0 ? 'change' : 'input';
    return 'change';
  }

  // renderNodes(nodes, scope, ctx) → array of children for ctx.h. ctx: {h, onError(message, line),
  //   renderImport(node, props, scope), href(value) (optional: rewrites <a href>)}
  function renderNodes(nodes, scope, ctx) {
    const out = [];
    for (const n of nodes) renderNode(n, scope, ctx, out);
    return out;
  }

  function renderNode(n, scope, ctx, out) {
    const err = function (m) { ctx.onError(m, n.line); };
    if (n.k === 'text') {
      let s = '';
      for (const p of n.parts) s += typeof p === 'string' ? p : textValue(lookup(p, scope), p.src, err);
      if (s) out.push(s);
      return;
    }
    if (n.k === 'if') {
      if (lookup(n.b.hole, scope)) for (const c of n.children) renderNode(c, scope, ctx, out);
      return;
    }
    if (n.k === 'for') {
      const list = lookup(n.b.hole, scope);
      if (list === null || list === undefined) return;
      if (!Array.isArray(list)) { err('<sc-for list="{{ ' + n.b.hole.src + ' }}"> is ' + typeof list + ', not an array'); return; }
      for (let i = 0; i < list.length; i++) {
        const s = childScope(scope, n.as, list[i], i);
        for (const c of n.children) renderNode(c, s, ctx, out);
      }
      return;
    }
    if (n.k === 'import') {
      const props = {};
      for (const p of n.props) props[p.name] = evalBinding(p.b, scope, err);
      out.push(ctx.renderImport(n, props, scope));
      return;
    }
    // element
    const props = {};
    for (const a of n.attrs) {
      let v = evalBinding(a.b, scope, err);
      if (a.name === 'href' && n.tag === 'a' && ctx.href && typeof v === 'string') v = ctx.href(v);
      props[a.name] = v;
    }
    for (const e of n.events) {
      const f = lookup(e.b.hole, scope);
      if (f === null || f === undefined || f === false) continue;
      if (typeof f !== 'function') { err('on' + e.react + '="{{ ' + e.b.hole.src + ' }}" is ' + typeof f + ', not a function'); continue; }
      const dom = e.react === 'Change' ? changeEvent(n.tag, props.type) : EVENTS[e.react];
      const key = 'on' + dom;
      if (props[key]) { const g = props[key]; props[key] = function (ev) { g.call(this, ev); return f.call(this, ev); }; } else props[key] = f;
    }
    if (n.ref) {
      const r = lookup(n.ref.hole, scope);
      if (r !== null && r !== undefined) {
        if (typeof r === 'function' || typeof r === 'object' && 'current' in r) props.ref = r;
        else err('ref="{{ ' + n.ref.hole.src + ' }}" is ' + typeof r + ', not a function or a ref object');
      }
    }
    const children = renderNodes(n.children, scope, ctx);
    out.push(ctx.h(n.tag, props, children.length ? children : undefined));
  }

  return {
    SUBSET_VERSION: SUBSET_VERSION,
    EVENTS: EVENTS,
    parseHTML: parseHTML,
    parseHole: parseHole,
    splitHoles: splitHoles,
    binding: binding,
    kebabToCamel: kebabToCamel,
    decode: decode,
    parseBoard: parseBoard,
    importCycles: importCycles,
    rootScope: rootScope,
    childScope: childScope,
    lookup: lookup,
    evalBinding: evalBinding,
    renderNodes: renderNodes,
  };
});
