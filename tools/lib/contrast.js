// SPDX-License-Identifier: GPL-2.0-or-later
// The Interleaf contrast check (spec 002 FR-020, FR-023): every component preview in every voice x
// scheme x pen combination, at desktop and phone width, in the states the guidelines name, measured
// in headless Chromium against the WCAG 2.2 AA targets.
//
// How a case is measured (README "Contrast check"):
// - Text: every visible text node, and the text the styles generate (::before / ::after content,
//   list markers, ::first-letter, input placeholders). Its colour is the computed colour (with its
//   alpha and the opacity of its ancestors). The colour beneath is read from a render of the page
//   with all text and text decorations transparent (the backdrop), over the box of the text's
//   glyphs (where a render with all text black differs from one with all text white, so text in
//   the colour of what lies beneath it stays in the box). Of the darkest and the lightest
//   pixel there, the one with the lower ratio is the worst colour: patterns, highlighter bands,
//   tabs and images under the text count. Target 4.5:1, or 3:1 for large text (24px, or 18.66px
//   at weight 700). Text is read 2px inside the edges of every ancestor whose overflow is not
//   visible (scrolling or not), so a frame's keyline does not count as beneath cut-off letters.
// - Focus rings: the element is rendered focused (CSS.forcePseudoState :focus and :focus-visible,
//   :focus-within on its ancestors) and unfocused (measureRing). Target 3:1. Every pixel the focus
//   changes counts, ring, offset, halo or fill alike.
// - States: default; hover (forced) and focus on every link, button, field and summary, in every
//   pen; every closed <details> opened; text inside an aria-current element is reported with the
//   state "current".
// - Disabled controls (:disabled, aria-disabled="true") are exempt from WCAG: their cases are
//   reported as "info", never as failures.
// - E-ink schemes are measured on the token values as rendered; there is no panel model.
// Every request that leaves the local server is blocked, so web fonts fall back; contrast does not
// depend on the font family.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const W = require('./wcag.js');
const PNG = require('./png.js');

const ROOT = path.resolve(__dirname, '..', '..');
const PREVIEWS = path.join(ROOT, 'interleaf', 'components');
const WEB = path.join(ROOT, 'web');
const WIDTHS = { desktop: 1280, phone: 390 };
// GLYPH_DIFF: a glyph pixel differs by up to 255 between the black and the white text render; a
// quarter of that is a quarter of the pixel covered. The backdrop alone differs by less: the
// circled numerals' rotated ring measured up to 31 between the two renders (raster noise).
const RING_MARGIN = 40, DIFF = 10, GLYPH_DIFF = 64;

// the text of every element and pseudo-element transparent: what is left is the backdrop
const HIDE_CSS = 'html.ct-hide *, html.ct-hide *::before, html.ct-hide *::after, html.ct-hide *::marker, ' +
  'html.ct-hide *::first-letter, html.ct-hide *::placeholder { color: transparent !important; ' +
  '-webkit-text-fill-color: transparent !important; text-shadow: none !important; ' +
  'text-decoration-color: transparent !important; caret-color: transparent !important; }\n' +
  // the glyphs alone, black and then white over the backdrop: where the two differ is where text paints
  probeCss('ct-black', '#000000') + probeCss('ct-white', '#ffffff') +
  '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';

function probeCss(cls, color) {
  return ['*', '*::before', '*::after', '*::marker', '*::first-letter', '*::placeholder'].map(function (p) { return 'html.' + cls + ' ' + p; }).join(', ') +
    ' { color: ' + color + ' !important; -webkit-text-fill-color: ' + color + ' !important; text-shadow: none !important; ' +
    'text-decoration-color: transparent !important; caret-color: transparent !important; }\n';
}

const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.png': 'image/png' };

function listComponents(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(function (e) { return e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'preview.html')); })
    .map(function (e) { return e.name; }).sort();
}

function loadCombinations(web) {
  return JSON.parse(fs.readFileSync(path.join(web, 'combinations.json'), 'utf8')).combinations;
}

// the preview as a page of the web form: tokens.css, bundle.css, then the injected styles
function composePage(previewHtml, attrs, injects) {
  let html = previewHtml.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
  if (!/<html[\s>]/i.test(html)) html = '<!doctype html><html><head></head><body>' + html + '</body></html>';
  if (!/<head[\s>]/i.test(html)) html = html.replace(/<html([^>]*)>/i, '<html$1><head></head>');
  const a = Object.keys(attrs).map(function (k) { return ' ' + k + '="' + attrs[k] + '"'; }).join('');
  html = html.replace(/<html([^>]*)>/i, '<html$1' + a + '>');
  const links = '<link rel="stylesheet" href="/web/tokens.css"><link rel="stylesheet" href="/web/bundle.css">' +
    injects.map(function (_, i) { return '<link rel="stylesheet" href="/_ct/inject/' + i + '.css">'; }).join('') +
    '<style>' + HIDE_CSS + '</style>';
  return html.replace(/<head([^>]*)>/i, '<head$1>' + links);
}

function startServer(opts) {
  const injects = opts.injects || [];
  const server = http.createServer(function (req, res) {
    const u = new URL(req.url, 'http://x');
    const send = function (code, type, body) { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
    try {
      let m = /^\/_ct\/inject\/(\d+)\.css$/.exec(u.pathname);
      if (m && injects[+m[1]] !== undefined) return send(200, MIME['.css'], fs.readFileSync(injects[+m[1]]));
      m = /^\/_ct\/page\/([^/]+)$/.exec(u.pathname);
      if (m) {
        const file = path.join(opts.previews, decodeURIComponent(m[1]), 'preview.html');
        const attrs = { 'data-theme': u.searchParams.get('theme'), 'data-pen': u.searchParams.get('pen') };
        return send(200, MIME['.html'], composePage(fs.readFileSync(file, 'utf8'), attrs, injects));
      }
      // the web form (and anything it loads next to it, such as vendored fonts)
      if (u.pathname.startsWith('/web/')) {
        const f = path.resolve(opts.web, decodeURIComponent(u.pathname.slice(5)));
        if (f.startsWith(path.resolve(opts.web) + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile()) {
          return send(200, MIME[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
        }
      }
      send(404, 'text/plain', 'not found');
    } catch (e) { send(500, 'text/plain', String(e && e.message || e)); }
  });
  return new Promise(function (resolve) {
    server.listen(0, '127.0.0.1', function () { resolve({ server: server, base: 'http://127.0.0.1:' + server.address().port }); });
  });
}

// ---------- in the page ----------

// numbers every element (data-ct) once, so that CDP nodes and page elements can be matched
function pageInit() {
  let n = 0;
  for (const el of document.querySelectorAll('*')) el.setAttribute('data-ct', String(n++));
  return { width: document.documentElement.scrollWidth, height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) };
}

// the visible text below the given roots (all of body without): text nodes, ::first-letter and
// placeholders; plus facts about the elements of the given ids (for pseudo-elements found by CDP)
function pageCollect(args) {
  const docW = document.documentElement.scrollWidth, docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  function byId(id) { return document.querySelector('[data-ct="' + id + '"]'); }
  function describe(el) {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      const cls = [].filter.call(e.classList, function (c) { return /^il-/.test(c) || /^(c|k|hl)$/.test(c); });
      if (cls.length) s += '.' + cls.join('.');
      if (e.hasAttribute('aria-current')) s += '[aria-current]';
      if (e.tagName === 'DETAILS' && e.open) s += '[open]';
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  function clipOf(el) {
    let r = { x0: 0, y0: 0, x1: docW, y1: docH };
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)') return null;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const b = a.getBoundingClientRect();
        const bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
        const br = parseFloat(cs.borderRightWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
        // 2px in from the edges: text that scrolls under a frame's keyline is cut there, not read
        r = { x0: Math.max(r.x0, b.left + bl + 2), y0: Math.max(r.y0, b.top + bt + 2), x1: Math.min(r.x1, b.right - br - 2), y1: Math.min(r.y1, b.bottom - bb - 2) };
      }
    }
    return r;
  }
  function opacityOf(el) { let o = 1; for (let a = el; a; a = a.parentElement) o *= parseFloat(getComputedStyle(a).opacity); return o; }
  function facts(el) {
    return {
      el: el.getAttribute('data-ct'), path: describe(el), clip: clipOf(el), opacity: opacityOf(el),
      visible: el.checkVisibility({ checkVisibilityCSS: true }),
      current: !!el.closest('[aria-current]:not([aria-current="false"])'),
      disabled: !!el.closest(':disabled, [aria-disabled="true"]'),
    };
  }
  function cut(rects, clip) {
    const out = [];
    if (!clip) return out;
    for (const q of rects) {
      const x0 = Math.max(q.left, clip.x0), y0 = Math.max(q.top, clip.y0), x1 = Math.min(q.right, clip.x1), y1 = Math.min(q.bottom, clip.y1);
      if (x1 - x0 >= 2 && y1 - y0 >= 2) out.push([x0, y0, x1, y1]);
    }
    return out;
  }
  function styleOf(cs) { return { color: cs.color, fontSize: parseFloat(cs.fontSize), fontWeight: parseFloat(cs.fontWeight) || 400 }; }
  const items = [];
  const roots = args.roots ? args.roots.map(byId).filter(Boolean) : [document.body];
  const skip = args.skip ? args.skip.map(byId).filter(Boolean) : [];
  for (const root of roots) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const el = t.parentElement;
      if (!el || /^(SCRIPT|STYLE|TITLE|NOSCRIPT)$/.test(el.tagName) || !/\S/.test(t.data)) continue;
      if (skip.some(function (s) { return s.contains(el); })) continue;
      const f = facts(el);
      if (!f.visible) continue;
      const cs = getComputedStyle(el);
      let start = 0;
      // a ::first-letter that the styles change (a drop cap) is a case of its own
      if (el.firstChild === t) {
        const fl = getComputedStyle(el, '::first-letter');
        if (fl.color !== cs.color || fl.fontSize !== cs.fontSize || fl.cssFloat !== 'none') {
          const i = t.data.search(/\S/);
          const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1);
          const rects = cut(r.getClientRects(), f.clip);
          if (rects.length) items.push(Object.assign({}, f, styleOf(fl), { kind: 'generated', pseudo: '::first-letter', text: t.data.substr(i, 1), rects: rects }));
          start = i + 1;
        }
      }
      const r = document.createRange(); r.setStart(t, start); r.setEnd(t, t.data.length);
      const rects = cut(r.getClientRects(), f.clip);
      if (rects.length) items.push(Object.assign({}, f, styleOf(cs), { kind: 'text', pseudo: '', text: t.data.slice(start).replace(/\s+/g, ' ').trim().slice(0, 60), rects: rects }));
    }
    for (const el of [root].concat([].slice.call(root.querySelectorAll('input[placeholder], textarea[placeholder]')))) {
      if (!el.matches || !el.matches('input[placeholder], textarea[placeholder]') || el.value || !el.placeholder) continue;
      const f = facts(el);
      if (!f.visible) continue;
      const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const box = { left: b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), top: b.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop),
        right: b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight), bottom: b.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom) };
      const rects = cut([box], f.clip);
      if (rects.length) items.push(Object.assign({}, f, styleOf(getComputedStyle(el, '::placeholder')), { kind: 'generated', pseudo: '::placeholder', text: el.placeholder.slice(0, 60), rects: rects }));
    }
  }
  const elements = {};
  for (const id of args.facts || []) { const el = byId(id); if (el) elements[id] = facts(el); }
  return { items: items, elements: elements };
}

// the interactive elements: links, buttons, fields, summaries (and anything with a tabindex)
function pageTargets() {
  return [].map.call(document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"])'), function (el) {
    const b = el.getBoundingClientRect();
    const anc = [];
    for (let a = el.parentElement; a; a = a.parentElement) anc.push(a.getAttribute('data-ct'));
    const rects = [].map.call(el.getClientRects(), function (q) { return [q.left, q.top, q.right, q.bottom]; }).filter(function (q) { return q[2] > q[0] && q[3] > q[1]; });
    return { el: el.getAttribute('data-ct'), ancestors: anc, box: [b.left, b.top, b.right, b.bottom], rects: rects.length ? rects : [[b.left, b.top, b.right, b.bottom]],
      disabled: !!el.closest(':disabled, [aria-disabled="true"]'), visible: el.checkVisibility({ checkVisibilityCSS: true }) && b.width > 0 && b.height > 0,
      tag: el.tagName.toLowerCase(), label: (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 40) };
  }).filter(function (t) { return t.visible; });
}

// ---------- in node ----------

function attrsOf(node) {
  const a = {};
  for (let i = 0; node.attributes && i < node.attributes.length; i += 2) a[node.attributes[i]] = node.attributes[i + 1];
  return a;
}

// the ::before / ::after / ::marker boxes that hold text, from CDP
// (from the document tree read once per page: reading it again would renumber the nodes and drop
// the forced states)
async function pseudoItems(cdp, doc) {
  const found = [];
  (function walk(n) {
    for (const p of n.pseudoElements || []) if (/^(before|after|marker)$/.test(p.pseudoType)) found.push({ node: p, parent: attrsOf(n)['data-ct'] });
    for (const c of n.children || []) walk(c);
  })(doc.root);
  const out = [];
  for (const f of found) {
    if (f.parent === undefined) continue;
    const st = {};
    for (const s of (await cdp.send('CSS.getComputedStyleForNode', { nodeId: f.node.nodeId })).computedStyle) st[s.name] = s.value;
    const content = st.content || 'none';
    if (st.display === 'none' || st.visibility !== 'visible') continue;
    if (/^(none|normal)$/.test(content) && f.node.pseudoType !== 'marker') continue;
    if (/^(""|'')$/.test(content.trim()) || content === 'none') continue;
    let q;
    try { q = (await cdp.send('DOM.getBoxModel', { nodeId: f.node.nodeId })).model.content; } catch (e) { continue; }
    const xs = [q[0], q[2], q[4], q[6]], ys = [q[1], q[3], q[5], q[7]];
    out.push({ parent: f.parent, pseudo: '::' + f.node.pseudoType, content: content, color: st.color, fontSize: parseFloat(st['font-size']),
      fontWeight: parseFloat(st['font-weight']) || 400, opacity: parseFloat(st.opacity || '1'),
      box: { left: Math.min.apply(null, xs), top: Math.min.apply(null, ys), right: Math.max.apply(null, xs), bottom: Math.max.apply(null, ys) } });
  }
  return out;
}

async function capture(cdp, clip) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 }, fromSurface: true, optimizeForSpeed: true });
  const img = PNG.decode(Buffer.from(r.data, 'base64'));
  img.x = clip.x; img.y = clip.y;
  return img;
}

function px(img, x, y) { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2], 1]; }

// the box of a text's glyphs: the pixels of a rect where the render with all text black (k) differs
// from the one with all text white (w). Both have the backdrop beneath, so a glyph differs whatever
// its colour and whatever lies beneath it, and the backdrop alone never does. A box that also holds
// a border or a shape (the circled numerals) is cut down to the glyphs; a rect with no glyph pixels
// at all (a colour emoji) keeps the whole box, inset by 1px.
function glyphBox(k, w, b, q) {
  const x0 = Math.max(0, Math.floor(q[0] - b.x)), x1 = Math.min(b.width, Math.ceil(q[2] - b.x));
  const y0 = Math.max(0, Math.floor(q[1] - b.y)), y1 = Math.min(b.height, Math.ceil(q[3] - b.y));
  let gx0 = Infinity, gy0 = Infinity, gx1 = -1, gy1 = -1;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * b.width + x) * 4;
    if (Math.abs(k.data[i] - w.data[i]) > GLYPH_DIFF || Math.abs(k.data[i + 1] - w.data[i + 1]) > GLYPH_DIFF || Math.abs(k.data[i + 2] - w.data[i + 2]) > GLYPH_DIFF) {
      if (x < gx0) gx0 = x; if (x > gx1) gx1 = x; if (y < gy0) gy0 = y; if (y > gy1) gy1 = y;
    }
  }
  if (gx1 < 0) {
    const ix0 = Math.max(x0, Math.ceil(q[0] + 1 - b.x - 0.5)), ix1 = Math.min(x1, Math.floor(q[2] - 1 - b.x - 0.5) + 1);
    const iy0 = Math.max(y0, Math.ceil(q[1] + 1 - b.y - 0.5)), iy1 = Math.min(y1, Math.floor(q[3] - 1 - b.y - 0.5) + 1);
    return ix1 > ix0 && iy1 > iy0 ? [ix0, iy0, ix1, iy1] : [x0, y0, x1, y1];
  }
  return [gx0, gy0, gx1 + 1, gy1 + 1];
}

// the darkest and the lightest pixel of the backdrop (shot.b) under the glyphs of the text's boxes
function extremes(shot, rects) {
  const b = shot.b;
  let lo = null, hi = null, loL = 2, hiL = -1;
  for (const q of rects) {
    const g = glyphBox(shot.k, shot.w, b, q);
    for (let y = g[1]; y < g[3]; y++) for (let x = g[0]; x < g[2]; x++) {
      const c = px(b, x, y), l = W.luminance(c);
      if (l < loL) { loL = l; lo = c; }
      if (l > hiL) { hiL = l; hi = c; }
    }
  }
  return lo ? [lo, hi] : [];
}

function measureText(shot, item) {
  const fg = W.parse(item.color);
  let worst = null;
  for (const bg of extremes(shot, item.rects)) {
    const f = W.over(fg, bg, item.opacity);
    const r = W.ratio(f, bg);
    if (!worst || r < worst.ratio) worst = { ratio: r, fg: f, bg: bg };
  }
  return worst;
}

// the focus ring: what changed between the unfocused (u) and the focused (f) backdrop. Each changed
// pixel has the ratio of its focused to its unfocused colour. The ring's ratio is the best one that
// as many pixels reach as a 1px line around the element's boxes has (its perimeter): a 2px ring
// keeps that even where a neighbour (the current item's tab) lies under part of it, and a ring
// that does not stand out from what it covers does not.
function measureRing(u, f, boxes) {
  const w = u.width, h = u.height;
  let need = 0;
  for (const q of boxes) need += 2 * (Math.max(1, q[2] - q[0]) + Math.max(1, q[3] - q[1]));
  need = Math.max(1, Math.round(need));
  const changed = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (Math.abs(u.data[i] - f.data[i]) > DIFF || Math.abs(u.data[i + 1] - f.data[i + 1]) > DIFF || Math.abs(u.data[i + 2] - f.data[i + 2]) > DIFF) {
      const a = px(f, x, y), b = px(u, x, y);
      changed.push({ ratio: W.ratio(a, b), fg: a, bg: b });
    }
  }
  if (!changed.length) return { ratio: 1, fg: null, bg: null, note: 'focus changes nothing' };
  if (changed.length < need) return { ratio: 1, fg: null, bg: null, note: 'the focus change covers ' + changed.length + ' px, less than the ' + need + ' px of a 1px line around the element' };
  changed.sort(function (a, b) { return b.ratio - a.ratio; });
  return changed[need - 1];
}

function caseOf(base, item, m, target, extra) {
  const info = !!item.disabled;
  const ratio = m ? Math.round(m.ratio * 100) / 100 : 1;
  return Object.assign({}, base, {
    kind: item.kind, pseudo: item.pseudo || undefined, element: item.path, text: item.text,
    fontSize: item.fontSize, fontWeight: item.fontWeight, large: item.kind === 'focus-ring' ? undefined : W.isLarge(item.fontSize, item.fontWeight),
    fg: m && m.fg ? W.hex(m.fg) : null, bg: m && m.bg ? W.hex(m.bg) : null,
    ratio: ratio, target: target, result: info ? 'info' : (m && m.ratio >= target - 1e-9 ? 'pass' : 'fail'),
    note: info ? 'disabled control: exempt from WCAG' : (m && m.note) || undefined,
  }, extra || {});
}

function textCases(base, shot, items, stateFor) {
  return items.map(function (it) {
    const m = measureText(shot, it);
    return caseOf(Object.assign({}, base, { state: stateFor(it) }), it, m, W.textTarget(it.fontSize, it.fontWeight));
  });
}

// the text items below the given roots, the generated ones from CDP included
async function gather(page, cdp, doc, roots, skip) {
  const pseudos = await pseudoItems(cdp, doc);
  const res = await page.evaluate(pageCollect, { roots: roots, skip: skip, facts: pseudos.map(function (p) { return p.parent; }) });
  let inside = null;
  if (roots) {
    inside = await page.evaluate(function (roots, skip) {
      const set = {};
      const sk = (skip || []).map(function (id) { return document.querySelector('[data-ct="' + id + '"]'); }).filter(Boolean);
      for (const id of roots) {
        const r = document.querySelector('[data-ct="' + id + '"]');
        if (!r) continue;
        for (const e of [r].concat([].slice.call(r.querySelectorAll('*')))) if (!sk.some(function (s) { return s.contains(e); })) set[e.getAttribute('data-ct')] = 1;
      }
      return set;
    }, roots, skip || []);
  }
  for (const p of pseudos) {
    if (inside && !inside[p.parent]) continue;
    const f = res.elements[p.parent];
    if (!f || !f.visible || !f.clip) continue;
    const c = f.clip;
    const x0 = Math.max(p.box.left, c.x0), y0 = Math.max(p.box.top, c.y0), x1 = Math.min(p.box.right, c.x1), y1 = Math.min(p.box.bottom, c.y1);
    if (x1 - x0 < 2 || y1 - y0 < 2) continue;
    res.items.push(Object.assign({}, f, { kind: 'generated', pseudo: p.pseudo, text: p.content.slice(0, 60), color: p.color, fontSize: p.fontSize,
      fontWeight: p.fontWeight, opacity: f.opacity * p.opacity, rects: [[x0, y0, x1, y1]], path: f.path + p.pseudo }));
  }
  return res.items;
}

// the clip without text (b, the backdrop), and with all text black (k) and white (w) over it
async function shoot(page, cdp, clip) {
  const out = {};
  for (const m of [['b', 'ct-hide'], ['k', 'ct-black'], ['w', 'ct-white']]) {
    await setHidden(page, m[1]);
    out[m[0]] = await capture(cdp, clip);
  }
  await setHidden(page, false);
  return out;
}

// the render mode: false (as styled), true or 'ct-hide' (no text), 'ct-black', 'ct-white' (the probes)
async function setHidden(page, mode) {
  const cls = mode === true ? 'ct-hide' : mode || '';
  await page.evaluate(function (cls) {
    const l = document.documentElement.classList;
    for (const c of ['ct-hide', 'ct-black', 'ct-white']) l.toggle(c, c === cls);
  }, cls);
}

async function nodeIdOf(cdp, rootId, id) {
  return (await cdp.send('DOM.querySelector', { nodeId: rootId, selector: '[data-ct="' + id + '"]' })).nodeId;
}

function bounds(rects, pad, size) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const q of rects) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[2]); y1 = Math.max(y1, q[3]); }
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(size.width, Math.ceil(x1 + pad)); y1 = Math.min(size.height, Math.ceil(y1 + pad));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}

// one component in one combination at one width: every case
async function runPage(page, cdp, base, url, width) {
  await page.setViewport({ width: width, height: 800, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(function () { return document.fonts.ready.then(function () { return 1; }); });
  // a page whose web form did not load would still have text, measured against the wrong styles
  const unstyled = await page.evaluate(function () {
    return [].filter.call(document.querySelectorAll('link[rel="stylesheet"]'), function (l) {
      try { return !l.sheet || !l.sheet.cssRules.length; } catch (e) { return true; }
    }).map(function (l) { return l.getAttribute('href'); });
  });
  if (unstyled.length) throw new Error('stylesheet not loaded or empty: ' + unstyled.join(', '));
  let size = await page.evaluate(pageInit);
  await page.setViewport({ width: width, height: Math.max(100, Math.ceil(size.height)), deviceScaleFactor: 1 });
  size = await page.evaluate(function () { return { width: document.documentElement.clientWidth, height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }; });
  const full = { x: 0, y: 0, width: size.width, height: size.height };
  const cases = [];

  const doc = await cdp.send('DOM.getDocument', { depth: -1 });

  // default
  const items = await gather(page, cdp, doc, null, null);
  cases.push.apply(cases, textCases(base, await shoot(page, cdp, full), items, function (it) { return it.current ? 'current' : 'default'; }));

  // hover and focus on every interactive element
  const targets = await page.evaluate(pageTargets);
  for (const t of targets) {
    const node = await nodeIdOf(cdp, doc.root.nodeId, t.el);
    if (!node) continue;
    // hover
    await cdp.send('CSS.forcePseudoState', { nodeId: node, forcedPseudoClasses: ['hover'] });
    let its = await gather(page, cdp, doc, [t.el], null);
    if (its.length) {
      const shot = await shoot(page, cdp, bounds([].concat.apply([], its.map(function (i) { return i.rects; })), 2, size));
      cases.push.apply(cases, textCases(Object.assign({}, base, { control: t.label }), shot, its, function () { return 'hover'; }));
    }
    await cdp.send('CSS.forcePseudoState', { nodeId: node, forcedPseudoClasses: [] });
    if (t.disabled) continue;
    // focus
    const region = bounds([t.box], RING_MARGIN, size);
    await setHidden(page, true);
    const u = await capture(cdp, region);
    await setHidden(page, false);
    const anc = [];
    for (const a of t.ancestors) { const n = await nodeIdOf(cdp, doc.root.nodeId, a); if (n) anc.push(n); }
    await cdp.send('CSS.forcePseudoState', { nodeId: node, forcedPseudoClasses: ['focus', 'focus-visible'] });
    for (const n of anc) await cdp.send('CSS.forcePseudoState', { nodeId: n, forcedPseudoClasses: ['focus-within'] });
    its = await gather(page, cdp, doc, [t.el], null);
    const region2 = bounds([t.box].concat.apply([t.box], its.map(function (i) { return i.rects; })), RING_MARGIN, size);
    const fshot = await shoot(page, cdp, region2);
    cases.push.apply(cases, textCases(Object.assign({}, base, { control: t.label }), fshot, its, function () { return 'focus'; }));
    const fring = region2.x === region.x && region2.y === region.y && region2.width === region.width && region2.height === region.height ? fshot.b : await (async function () {
      await setHidden(page, true); const i = await capture(cdp, region); await setHidden(page, false); return i; })();
    const ring = measureRing(u, fring, t.rects);
    const elFacts = (await page.evaluate(pageCollect, { roots: [], facts: [t.el] })).elements[t.el];
    cases.push(caseOf(Object.assign({}, base, { state: 'focus', control: t.label }),
      { kind: 'focus-ring', path: elFacts ? elFacts.path : t.tag, text: t.label, disabled: t.disabled }, ring, W.NON_TEXT_TARGET));
    await cdp.send('CSS.forcePseudoState', { nodeId: node, forcedPseudoClasses: [] });
    for (const n of anc) await cdp.send('CSS.forcePseudoState', { nodeId: n, forcedPseudoClasses: [] });
  }

  // every closed <details> opened
  const opened = await page.evaluate(function () {
    return [].map.call(document.querySelectorAll('details:not([open])'), function (d) {
      d.open = true;
      const s = d.querySelector(':scope > summary');
      return { el: d.getAttribute('data-ct'), summary: s ? s.getAttribute('data-ct') : null };
    });
  });
  if (opened.length) {
    let h = await page.evaluate(function () { return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); });
    if (h > size.height) { await page.setViewport({ width: width, height: Math.ceil(h), deviceScaleFactor: 1 }); size = { width: size.width, height: Math.ceil(h) }; }
    const its = await gather(page, cdp, doc, opened.map(function (o) { return o.el; }), opened.map(function (o) { return o.summary; }).filter(Boolean));
    if (its.length) {
      cases.push.apply(cases, textCases(base, await shoot(page, cdp, { x: 0, y: 0, width: size.width, height: size.height }), its, function () { return 'open'; }));
    }
  }
  return cases;
}

// the pages that measured fewer cases than their floor: every page at least one text case, and a
// component in floors ({Name: {text: N, focusRing: M}}) at least N text and generated cases and M
// focus rings on each of its pages. A preview that lost its text, or a collector that skips what
// it used to measure, fails the check instead of passing with fewer cases.
function coverageShort(pages, floors) {
  const short = [];
  for (const p of pages) {
    const f = (floors || {})[p.component] || {};
    const n = { text: 0, focusRing: 0 };
    for (const c of p.cases) n[c.kind === 'focus-ring' ? 'focusRing' : 'text']++;
    for (const k of ['text', 'focusRing']) {
      const floor = Math.max(k === 'text' ? 1 : 0, f[k] || 0);
      if (n[k] < floor) short.push({ component: p.component, theme: p.theme, pen: p.pen, width: p.width, kind: k, got: n[k], floor: floor });
    }
  }
  return short;
}

// check({components, themes, widths, injects, open, coverage, previews, web, jobs, chromium, log}) -> report
async function check(opts) {
  opts = opts || {};
  const B = require(path.join(ROOT, 'boards', 'lib', 'browser.js'));
  const previews = opts.previews || PREVIEWS, web = opts.web || WEB;
  let comps = listComponents(previews);
  if (opts.components && opts.components.length) {
    const want = opts.components;
    const missing = want.filter(function (c) { return comps.indexOf(c) < 0; });
    if (missing.length) throw new Error('no preview for: ' + missing.join(', '));
    comps = want;
  }
  let combos = loadCombinations(web);
  if (opts.themes && opts.themes.length) {
    combos = combos.filter(function (c) {
      return opts.themes.some(function (t) { return t === c.attributes['data-theme'] || t === c.voice || t === c.scheme || t === c.voice + '-' + c.scheme; });
    });
  }
  const widths = (opts.widths && opts.widths.length ? opts.widths : Object.keys(WIDTHS));
  const tasks = [];
  for (const comp of comps) for (const c of combos) for (const wname of widths) tasks.push({ comp: comp, combo: c, wname: wname });
  const t0 = Date.now();
  const srv = await startServer({ previews: previews, web: web, injects: opts.injects || [] });
  const jobs = Math.max(1, opts.jobs || 4);
  const errors = [];
  const measured = [];
  const workers = [];
  let done = 0, free = workers.slice();
  let results;
  try {
    // a browser per worker: a background tab of a shared browser waits for frames to capture
    for (let i = 0; i < Math.min(jobs, tasks.length); i++) {
      const browser = await B.openBrowser({ chromium: opts.chromium });
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on('request', function (req) {
        const u = req.url();
        if (u.startsWith(srv.base + '/') || u.startsWith('data:')) req.continue(); else req.abort('blockedbyclient');
      });
      const cdp = await page.createCDPSession();
      await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
      workers.push({ browser: browser, page: page, cdp: cdp });
    }
    free = workers.slice();
    results = await B.pool(tasks, workers.length, async function (t) {
      const w = free.pop();
      const a = t.combo.attributes;
      const base = { voice: t.combo.voice, scheme: t.combo.scheme, pen: t.combo.pen, theme: a['data-theme'], width: t.wname, component: t.comp };
      const url = srv.base + '/_ct/page/' + encodeURIComponent(t.comp) + '?theme=' + encodeURIComponent(a['data-theme']) + '&pen=' + encodeURIComponent(a['data-pen']);
      try {
        const cs = await runPage(w.page, w.cdp, base, url, WIDTHS[t.wname] || +t.wname);
        measured.push(Object.assign({}, base, { cases: cs }));
        return cs;
      } catch (e) {
        errors.push(Object.assign({}, base, { error: String(e && e.message || e) }));
        return [];
      } finally {
        free.push(w);
        done++;
        if (opts.log && done % 50 === 0) opts.log('contrast: ' + done + '/' + tasks.length + ' pages');
      }
    });
  } finally {
    for (const w of workers) await w.browser.close();
    srv.server.close();
  }
  const cases = [].concat.apply([], results);
  cases.forEach(function (c, i) { c.id = i; });
  // known open failures (opts.open): reported as "open", not failed; an entry that matches no
  // failing case any more is stale and fails the check, so that the list shrinks with the fixes
  const stale = [];
  for (const e of opts.open || []) {
    let n = 0;
    for (const c of cases) if (c.result === 'fail' && openMatches(e, c)) { c.result = 'open'; c.proposal = e.proposal; n++; }
    const inScope = comps.indexOf(e.component) >= 0 && (!e.themes || combos.some(function (c) { return e.themes.indexOf(c.attributes['data-theme']) >= 0; }));
    if (!n && inScope) stale.push(e);
  }
  const short = coverageShort(measured, opts.coverage);
  const count = function (r) { return cases.filter(function (c) { return c.result === r; }).length; };
  return {
    check: 'contrast', spec: '002 FR-020', standard: 'WCAG 2.2 AA',
    targets: { text: 4.5, largeText: 3, focusRing: W.NON_TEXT_TARGET },
    components: comps, combinations: combos.length, widths: widths.map(function (w) { return { name: w, px: WIDTHS[w] || +w }; }),
    injects: (opts.injects || []).map(function (f) { return path.relative(ROOT, path.resolve(f)); }),
    pages: tasks.length, ms: Date.now() - t0,
    total: cases.length, passed: count('pass'), failed: count('fail'), open: count('open'), info: count('info'),
    ok: !errors.length && !count('fail') && !stale.length && !short.length, errors: errors, stale: stale, short: short, cases: cases,
  };
}

function openMatches(e, c) {
  return e.component === c.component && e.kind === c.kind && (e.pseudo || '') === (c.pseudo || '') && e.element === c.element &&
    (!e.states || e.states.indexOf(c.state) >= 0) && (!e.themes || e.themes.indexOf(c.theme) >= 0);
}

// failures grouped by what differs least: component, kind, state, element, text
function groupFailures(cases, result) {
  const groups = {};
  for (const c of cases) {
    if (c.result !== (result || 'fail')) continue;
    const k = [c.component, c.kind + (c.pseudo ? ' ' + c.pseudo : ''), c.state, c.element, c.text].join(' | ');
    const g = groups[k] || (groups[k] = { component: c.component, kind: c.kind, pseudo: c.pseudo, state: c.state, element: c.element, text: c.text, target: c.target, min: Infinity, max: 0, themes: {}, cases: 0 });
    g.min = Math.min(g.min, c.ratio); g.max = Math.max(g.max, c.ratio); g.cases++;
    g.themes[c.theme + ' pen ' + c.pen + ' ' + c.width + (c.fg ? ' (' + c.fg + ' on ' + c.bg + ')' : '')] = c.ratio;
  }
  return Object.keys(groups).sort().map(function (k) { return groups[k]; });
}

function summary(rep, maxThemes) {
  const lines = [];
  lines.push('contrast: ' + rep.total + ' cases (' + rep.components.length + ' components x ' + rep.combinations + ' combinations x ' +
    rep.widths.length + ' widths, ' + rep.pages + ' pages) in ' + (rep.ms / 1000).toFixed(1) + ' s: ' +
    rep.passed + ' pass, ' + rep.failed + ' fail, ' + rep.open + ' open (known), ' + rep.info + ' info (exempt)');
  if (rep.injects.length) lines.push('  with ' + rep.injects.join(', '));
  for (const e of rep.errors) lines.push('  ERROR ' + e.component + ' ' + e.theme + ' pen ' + e.pen + ' ' + e.width + ': ' + e.error);
  for (const g of groupFailures(rep.cases)) {
    const themes = Object.keys(g.themes);
    lines.push('  FAIL ' + g.component + ' ' + g.kind + (g.pseudo ? ' ' + g.pseudo : '') + ' [' + g.state + '] ' + g.element + ' "' + g.text + '": ' +
      (g.min === g.max ? g.min : g.min + '-' + g.max) + ':1 < ' + g.target + ':1 in ' + g.cases + ' cases');
    for (const t of themes.slice(0, maxThemes || 4)) lines.push('       ' + t + ': ' + g.themes[t] + ':1');
    if (themes.length > (maxThemes || 4)) lines.push('       ... ' + (themes.length - (maxThemes || 4)) + ' more');
  }
  for (const g of groupFailures(rep.cases, 'open')) {
    lines.push('  open ' + g.component + ' ' + g.kind + (g.pseudo ? ' ' + g.pseudo : '') + ' [' + g.state + '] ' + g.element + ' "' + g.text + '": ' +
      (g.min === g.max ? g.min : g.min + '-' + g.max) + ':1 < ' + g.target + ':1 in ' + g.cases + ' cases (known, see the open list)');
  }
  for (const s of rep.short) lines.push('  SHORT ' + s.component + ' ' + s.theme + ' pen ' + s.pen + ' ' + s.width + ': ' + s.got + ' ' +
    (s.kind === 'text' ? 'text cases' : 'focus rings') + ', fewer than the floor of ' + s.floor + ' (test/contrast/coverage.json)');
  for (const e of rep.stale) lines.push('  STALE open-list entry, no longer fails: ' + e.component + ' ' + e.kind + ' ' + e.element + ' (remove it)');
  lines.push('contrast: ' + (rep.ok ? 'passed' + (rep.open ? ' (' + rep.open + ' known open cases)' : '') : 'FAILED'));
  return lines.join('\n');
}

module.exports = { check: check, summary: summary, groupFailures: groupFailures, composePage: composePage, measureRing: measureRing,
  measureText: measureText, extremes: extremes, coverageShort: coverageShort, listComponents: listComponents, WIDTHS: WIDTHS };
