// SPDX-License-Identifier: GPL-2.0-or-later
// Interleaf's component previews against their references (spec 002 FR-022, FR-023): every
// component's preview.html, in each of the 27 combinations of the web form, at desktop and at
// phone width. The page loads the web form (web/tokens.css, web/bundle.css and with it
// web/fonts/) as a consumer does, and nothing else.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { within, sendFile, UI_ROOT } = require('./server.js');
const { openBrowser, pool, isolate, steady, watchTimers, capture } = require('./browser.js');
const R = require('./references.js');

const WIDTHS = { desktop: 1280, phone: 390 };
const REFS = path.join(UI_ROOT, 'test', 'references', 'components');

function components(root) {
  const dir = path.join(root, 'interleaf', 'components');
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(function (e) { return e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'preview.html')); })
    .map(function (e) { return e.name; }).sort();
}

function attr(v) { return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// the preview with the web form loaded and the combination's attributes on <html>
function previewPage(root, name, attrs) {
  let html = fs.readFileSync(path.join(root, 'interleaf', 'components', name, 'preview.html'), 'utf8');
  const a = Object.keys(attrs).map(function (k) { return ' ' + k + '="' + attr(attrs[k]) + '"'; }).join('');
  if (!/<html[\s>]/i.test(html) || !/<head[\s>]/i.test(html)) throw new Error(name + '/preview.html: no <html> or <head>');
  html = html.replace(/<html([\s>])/i, '<html' + a + '$1');
  html = html.replace(/<head([^>]*)>/i, '<head$1>\n<link rel="stylesheet" href="/web/tokens.css">\n<link rel="stylesheet" href="/web/bundle.css">');
  return html;
}

// a server for web/ and interleaf/ of root, and /_preview/NAME?attrs (previewPage())
function serve(root) {
  const server = http.createServer(function (req, res) {
    let u, p;
    try { u = new URL(req.url, 'http://x'); p = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    const m = /^\/_preview\/([A-Za-z0-9_-]+)$/.exec(p);
    if (m) {
      let html;
      try { html = previewPage(root, m[1], JSON.parse(u.searchParams.get('attrs') || '{}')); } catch (e) { res.writeHead(404); res.end(String(e.message)); return; }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const top = /^\/(web|interleaf)\/(.*)$/.exec(p);
    if (!top) { res.writeHead(404); res.end(); return; }
    sendFile(res, within(path.join(root, top[1]), top[2]));
  });
  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', function () {
      resolve({ url: 'http://127.0.0.1:' + server.address().port, close: function () { return new Promise(function (r) { server.close(function () { r(); }); server.closeAllConnections(); }); } });
    });
  });
}

// render one case: the page at the width, as tall as its content, everything steady
async function shoot(browser, base, c, timeout) {
  const page = await browser.newPage();
  const errors = [];
  try {
    // a short viewport: the page's height is its content's, not the window's
    await page.setViewport({ width: c.width, height: 64, deviceScaleFactor: 1 });
    await watchTimers(page);
    await isolate(page, { origin: base, onBlocked: function (e) { errors.push({ kind: 'external', message: e.error + ' ' + e.url, url: e.url }); } });
    page.on('pageerror', function (e) { errors.push({ kind: 'console', message: 'uncaught: ' + String(e && e.message || e) }); });
    page.on('console', function (m) { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push({ kind: 'console', message: m.text() }); });
    page.on('response', function (res) { if (res.status() >= 400) errors.push({ kind: 'request', message: 'HTTP ' + res.status() + ' ' + res.url(), url: res.url() }); });
    const url = base + '/_preview/' + c.component + '?attrs=' + encodeURIComponent(JSON.stringify(c.attributes));
    await page.goto(url, { waitUntil: 'load', timeout: timeout || 30000 });
    // every face loaded (also those this preview doesn't use): a broken font file fails here
    for (const f of await steady(page, { loadAllFonts: true })) errors.push({ kind: 'font', message: 'font did not load: ' + f.family + ' ' + f.style + ' ' + f.weight });
    let height = 0;
    for (let i = 0; i < 4; i++) {
      const h = await page.evaluate('Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0))');
      if (h === height) break;
      height = h;
      await page.setViewport({ width: c.width, height: Math.max(1, height), deviceScaleFactor: 1 });
    }
    const png = await capture(page, { x: 0, y: 0, width: c.width, height: Math.max(1, height) });
    return { png: png, errors: errors };
  } finally { await page.close(); }
}

// checkPreviews({root, refs, out, update, components: [name], widths: [name], combinations: [id],
//   jobs, timeout, chromium}) → report
async function checkPreviews(opts) {
  opts = opts || {};
  const root = path.resolve(opts.root || UI_ROOT);
  const refs = path.resolve(opts.refs || REFS);
  const out = path.resolve(opts.out || path.join('out', 'references', 'components'));
  const combos = JSON.parse(fs.readFileSync(path.join(root, 'web', 'combinations.json'), 'utf8')).combinations;
  const names = components(root);
  const pick = function (list, all, what) {
    if (!list || !list.length) return all;
    for (const x of list) if (all.indexOf(x) < 0) throw new Error('no ' + what + ' ' + x + ' (' + all.join(', ') + ')');
    return list;
  };
  const comps = pick(opts.components, names, 'component');
  const widths = pick(opts.widths, Object.keys(WIDTHS), 'width');
  const ids = combos.map(function (c) { return c.attributes['data-theme'] + '-' + c.pen; });
  const chosen = pick(opts.combinations, ids, 'combination');
  const cases = [];
  for (const n of comps) for (const w of widths) for (const c of combos) {
    const cid = c.attributes['data-theme'] + '-' + c.pen;
    if (chosen.indexOf(cid) < 0) continue;
    cases.push({ id: n + '/' + w + '/' + cid, component: n, width: WIDTHS[w], widthName: w, combination: cid, attributes: c.attributes });
  }
  const srv = await serve(root);
  let browser;
  try {
    browser = await openBrowser({ chromium: opts.chromium });
    const version = await R.chromiumVersion(browser);
    const only = comps.length !== names.length || widths.length !== Object.keys(WIDTHS).length || chosen.length !== ids.length;
    const rep = await R.runCases({ cases: cases, refs: refs, out: out, update: opts.update, kind: 'components', chromium: version,
      jobs: opts.jobs, pool: pool, only: only, render: function (c) { return shoot(browser, srv.url, c, opts.timeout); } });
    for (const r of rep.cases) delete r.attributes;
    rep.check = 'component references';
    rep.widths = WIDTHS;
    return rep;
  } finally {
    if (browser) await browser.close();
    await srv.close();
  }
}

module.exports = { checkPreviews: checkPreviews, previewPage: previewPage, components: components, WIDTHS: WIDTHS, REFS: REFS };
