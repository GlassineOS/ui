// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: headless Chromium for the checks (spec 003 FR-011, FR-012). Opens a browser,
// renders one board and collects what went wrong. The render check (check.js) is built on it; image
// checks build on renderBoard(), which leaves the page open for them.
'use strict';
const fs = require('fs');

const CHROMIUM = ['/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];

function findChromium(given) {
  const list = [given, process.env.CHROMIUM].concat(CHROMIUM).filter(Boolean);
  for (const p of list) if (fs.existsSync(p)) return p;
  throw new Error('no Chromium found (tried ' + list.join(', ') + '); set CHROMIUM or pass --chromium, or run in Alpine: tools/in-alpine');
}

// Chromium's sandbox can't start as root or in a container without privileges (tools/in-alpine,
// CI). Elsewhere it stays on, since the boards' logic comes from exports. BOARDS_NO_SANDBOX=1 turns
// it off by hand.
function needsNoSandbox(env, isRoot, inContainer) {
  return env.BOARDS_NO_SANDBOX === '1' || isRoot || inContainer;
}
function sandboxArgs() {
  const root = typeof process.getuid === 'function' && process.getuid() === 0;
  const container = fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');
  return needsNoSandbox(process.env, root, container) ? ['--no-sandbox'] : [];
}

// openBrowser({chromium, args}) → a puppeteer Browser
async function openBrowser(opts) {
  opts = opts || {};
  let puppeteer;
  try { puppeteer = require('puppeteer-core'); } catch (e) {
    throw new Error('puppeteer-core is not installed: run "npm ci" in ' + require('path').resolve(__dirname, '..', '..'));
  }
  return puppeteer.launch({
    executablePath: findChromium(opts.chromium),
    headless: true,
    // a stuck page fails its case within a minute, not three
    protocolTimeout: 60000,
    args: sandboxArgs().concat(['--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none', '--hide-scrollbars',
      // the same pixels on every run: one raster thread, whole tiles, no CPU-specific Skia paths, sRGB
      '--num-raster-threads=1', '--disable-partial-raster', '--disable-skia-runtime-opts', '--force-color-profile=srgb',
      // pages rendered side by side are background tabs: keep their timers and rendering running
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'], opts.args || []),
  });
}

// boardUrl(base, file, {voice, scheme, pen, props}) → the board's URL on a running preview server
function boardUrl(base, file, opts) {
  const u = new URL(file.split('/').map(encodeURIComponent).join('/'), base);
  opts = opts || {};
  for (const k of ['voice', 'scheme', 'pen']) if (opts[k] !== undefined) u.searchParams.set(k, String(opts[k]));
  const props = opts.props || {};
  for (const k of Object.keys(props)) u.searchParams.set('p.' + k, typeof props[k] === 'string' ? props[k] : JSON.stringify(props[k]));
  return u.href;
}

// ---- the network: nothing but the preview server ----------------------------------------------
// Renders and checks run without network (spec 002, spec 003 FR-011): a page may load from the
// preview server (and data:, blob:), nothing else. A Google Fonts stylesheet is the exception the
// boards need, since claude.ai's boards link it: it is answered from the vendored fonts (Interleaf's
// interleaf/fonts/fonts.css, and the design's own, see references.json "fonts"); a family that is
// not vendored is reported as a blocked request.

// fontFaces(css, base) → Map(family → [@font-face rule with absolute URLs])
function fontFaces(css, base) {
  const out = new Map();
  for (const m of String(css).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const fam = /font-family\s*:\s*(?:"([^"]+)"|'([^']+)'|([^;]+))/.exec(m[1]);
    if (!fam) continue;
    const name = (fam[1] || fam[2] || fam[3]).trim();
    const body = m[1].replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/g, function (_, q, u) { return 'url("' + new URL(u, base).href + '")'; });
    if (!out.has(name)) out.set(name, []);
    out.get(name).push('@font-face {' + body + '}');
  }
  return out;
}

// the families a Google Fonts stylesheet URL asks for (css and css2), or null for another URL
function googleFamilies(url) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  if (u.hostname !== 'fonts.googleapis.com' || !/^\/css2?$/.test(u.pathname)) return null;
  const out = [];
  for (const f of u.searchParams.getAll('family')) {
    for (const one of u.pathname === '/css' ? f.split('|') : [f]) out.push(one.split(':')[0].replace(/\+/g, ' ').trim());
  }
  return out;
}

// isolate(page, {origin, faces, onBlocked}): from now on the page loads only from origin, data:
// and blob:; Google Fonts stylesheets are answered from faces (fontFaces()). onBlocked({url,
// error}) hears of every request refused, and of a font family that is not vendored.
async function isolate(page, opts) {
  const origin = opts.origin, faces = opts.faces || new Map(), onBlocked = opts.onBlocked || function () {};
  await page.setRequestInterception(true);
  page.on('request', function (req) {
    if (req.isInterceptResolutionHandled && req.isInterceptResolutionHandled()) return;
    const url = req.url();
    if (url.startsWith(origin + '/') || url === origin || /^(data|blob|about):/.test(url)) return req.continue();
    const fams = googleFamilies(url);
    if (fams) {
      const css = [];
      for (const f of fams) {
        if (faces.has(f)) css.push.apply(css, faces.get(f));
        else onBlocked({ url: url, error: 'font family not vendored: ' + f });
      }
      return req.respond({ status: 200, contentType: 'text/css; charset=utf-8', headers: { 'access-control-allow-origin': '*' }, body: css.join('\n') + '\n' });
    }
    onBlocked({ url: url, error: 'blocked: no network in renders' });
    return req.abort('blockedbyclient');
  });
}

// ---- a steady page: what a screenshot needs -----------------------------------------------------
// No motion (reduced motion, animations and transitions at their end, no caret), every web font the
// page uses loaded, every image loaded or failed, no timer of the page pending (watchTimers(), when
// installed), and the document quiet (no change for quietMs, 250 by default; waiting at most maxMs,
// 10000). → [{family, style, weight, status}] of the fonts
// that failed to load
// Installed before a page's own scripts (watchTimers()): counts the page's pending setTimeout calls
// of up to 10 s, so steady() can wait for a board that fills itself in after a delay. Intervals
// (clocks) are not counted.
const TIMERS = '(' + function () {
  const pending = new Set(), set = window.setTimeout, clear = window.clearTimeout;
  window.setTimeout = function (fn, ms) {
    const args = Array.prototype.slice.call(arguments, 2), d = Number(ms) || 0;
    const id = set.call(window, function () {
      pending.delete(id);
      if (typeof fn === 'function') fn.apply(this, args); else (0, eval)(String(fn));
    }, d);
    if (d <= 10000) pending.add(id);
    return id;
  };
  window.clearTimeout = function (id) { pending.delete(id); return clear.call(window, id); };
  Object.defineProperty(window, '__steady', { value: { timers: function () { return pending.size; }, setTimeout: set } });
} + ')();';
async function watchTimers(page) { await page.evaluateOnNewDocument(TIMERS); }

const STEADY_CSS = '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; ' +
  'animation-iteration-count: 1 !important; transition-duration: 0s !important; transition-delay: 0s !important; ' +
  'caret-color: transparent !important; scroll-behavior: auto !important; }';
async function steady(page, opts) {
  opts = opts || {};
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.addStyleTag({ content: STEADY_CSS });
  return page.evaluate(async function (all, quietMs, maxMs) {
    const t0 = Date.now();
    const st = window.__steady ? window.__steady.setTimeout : setTimeout;
    const timers = function () { return window.__steady ? window.__steady.timers() : 0; };
    const sleep = function (ms) { return new Promise(function (r) { st.call(window, r, ms); }); };
    if (document.activeElement && document.activeElement !== document.body && document.activeElement.blur) document.activeElement.blur();
    if (all) await Promise.all(Array.from(document.fonts).map(function (f) { return f.load().catch(function () {}); }));
    // quiet: no change to the document for quietMs, the images settled, the fonts loaded
    let last = Date.now();
    const mo = new MutationObserver(function () { last = Date.now(); });
    mo.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    while (Date.now() - t0 < maxMs) {
      await document.fonts.ready;
      const busy = timers() > 0 || Array.from(document.images).some(function (i) { return !i.complete; });
      if (!busy && Date.now() - last >= quietMs) break;
      await sleep(50);
    }
    mo.disconnect();
    return Array.from(document.fonts).filter(function (f) { return f.status === 'error'; })
      .map(function (f) { return { family: f.family, style: f.style, weight: f.weight, status: f.status }; });
  }, !!opts.loadAllFonts, opts.quietMs === undefined ? 250 : opts.quietMs, opts.maxMs || 10000);
}

// capture(page, clip) → PNG buffer of the clip, after two frames. The page must be its browser's
// only tab (one browser per worker, see pool()): a tab that is not in front may get no frames, and
// then a screenshot never returns.
async function capture(page, clip) {
  await page.evaluate(function () { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); });
  return Buffer.from(await page.screenshot({ type: 'png', clip: clip }));
}

// waitSettled(page, {timeout, settleMs}): the runtime has loaded every board of the page, and a
// moment for what follows from that
async function waitSettled(page, opts) {
  opts = opts || {};
  // polled on a timer: a page in a background tab gets no animation frames
  await page.waitForFunction('window.__boards && window.__boards.settled', { polling: 100, timeout: opts.timeout || 30000 });
  if (opts.settleMs !== 0) await new Promise(function (res) { setTimeout(res, opts.settleMs || 200); });
}

// renderBoard(browser, base, file, {width, height, voice, scheme, pen, props, timeout, keepPage, faces})
//   → {board, url, size, settled, errors, unsupported, console, requests, external, page?}
//   errors: the runtime's render, script and load errors; unsupported: the board's format features
//   outside the subset; console: console errors and uncaught exceptions; requests: failed requests
//   to the preview server; external: requests elsewhere, all refused (isolate(); faces: the
//   vendored fonts that answer Google Fonts stylesheets). Any of them fails the board.
//   With keepPage the page stays open (returned as .page) for screenshots; the caller closes it.
async function renderBoard(browser, base, file, opts) {
  opts = opts || {};
  const width = Math.max(1, Math.round(opts.width || 1280)), height = Math.max(1, Math.round(opts.height || 800));
  const url = boardUrl(base, file, opts);
  const origin = new URL(base).origin;
  const r = { board: file, url: url, size: { width: width, height: height }, settled: false, errors: [], unsupported: [], console: [], requests: [], external: [] };
  const t0 = Date.now();
  const page = await browser.newPage();
  await page.setViewport({ width: width, height: height, deviceScaleFactor: opts.scale || 1 });
  // each refused URL once (a stylesheet a board's helmet adds can be asked for twice)
  const elsewhere = function (e) { if (!r.external.some(function (x) { return x.url === e.url && x.error === e.error; })) r.external.push(e); };
  await isolate(page, { origin: origin, faces: opts.faces, onBlocked: function (e) { if (!/^blocked/.test(e.error)) elsewhere(e); } });
  if (opts.keepPage) await watchTimers(page);
  page.on('console', function (m) {
    if (m.type() !== 'error') return;
    const loc = m.location() || {};
    const text = m.text();
    // a failed resource load is reported again as a request below
    if (/^Failed to load resource/.test(text)) return;
    r.console.push({ text: text, url: loc.url || '', line: loc.lineNumber || 0 });
  });
  page.on('pageerror', function (e) { r.console.push({ text: 'uncaught: ' + String(e && e.message || e), url: '', line: 0 }); });
  page.on('requestfailed', function (req) {
    const f = req.failure();
    const e = { url: req.url(), error: f ? (/ERR_BLOCKED_BY_CLIENT/.test(f.errorText) ? 'blocked: no network in renders' : f.errorText) : 'failed' };
    if (req.url().startsWith(origin)) r.requests.push(e); else elsewhere(e);
  });
  page.on('response', function (res) {
    if (res.status() < 400) return;
    const e = { url: res.url(), error: 'HTTP ' + res.status() };
    if (res.url().startsWith(origin)) r.requests.push(e); else r.external.push(e);
  });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: opts.timeout || 30000 });
    await waitSettled(page, opts);
    r.settled = true;
  } catch (e) {
    let why = '';
    try { why = await page.evaluate('JSON.stringify({ready: document.readyState, pending: window.__boards && window.__boards.pending, fonts: document.fonts && document.fonts.status})'); } catch (x) { /* page gone */ }
    r.console.push({ text: 'not settled: ' + String(e && e.message || e) + ' ' + why, url: '', line: 0 });
  }
  r.ms = Date.now() - t0;
  let st = null;
  try { st = await page.evaluate('window.__boards ? JSON.parse(JSON.stringify(window.__boards)) : null'); } catch (e) { /* page gone */ }
  if (!st) r.errors.push({ board: file, kind: 'load', feature: 'runtime', detail: '', line: 0, message: 'the runtime did not start (support.js missing from the board?)' });
  else for (const e of st.errors) (e.kind === 'unsupported' ? r.unsupported : r.errors).push(e);
  r.ok = r.settled && !r.errors.length && !r.unsupported.length && !r.console.length && !r.requests.length && !r.external.length;
  if (opts.keepPage) r.page = page; else await page.close();
  return r;
}

// run fn(item, index, worker) over items with at most n at a time, results in order; worker is
// 0..n-1, for what each worker keeps to itself (its browser)
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker(_, w) { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i, w); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// openBrowsers(n, opts) → n browsers, one per worker of a screenshot run
function openBrowsers(n, opts) {
  return Promise.all(Array.from({ length: Math.max(1, n) }, function () { return openBrowser(opts); }));
}

module.exports = { needsNoSandbox: needsNoSandbox, sandboxArgs: sandboxArgs, findChromium: findChromium, openBrowser: openBrowser, boardUrl: boardUrl,
  renderBoard: renderBoard, pool: pool, openBrowsers: openBrowsers, fontFaces: fontFaces, googleFamilies: googleFamilies, isolate: isolate, steady: steady, waitSettled: waitSettled, watchTimers: watchTimers, capture: capture };
