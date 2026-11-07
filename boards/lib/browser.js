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
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none', '--hide-scrollbars',
      // pages rendered side by side are background tabs: keep their timers and rendering running
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'].concat(opts.args || []),
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

// renderBoard(browser, base, file, {width, height, voice, scheme, pen, props, timeout, keepPage})
//   → {board, url, size, settled, errors, unsupported, console, requests, external, page?}
//   errors: the runtime's render, script and load errors; unsupported: the board's format features
//   outside the subset; console: console errors and uncaught exceptions; requests: failed requests
//   to the preview server; external: failed requests elsewhere (fonts: not counted as failures).
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
    const e = { url: req.url(), error: f ? f.errorText : 'failed' };
    if (req.url().startsWith(origin)) r.requests.push(e); else r.external.push(e);
  });
  page.on('response', function (res) {
    if (res.status() < 400) return;
    const e = { url: res.url(), error: 'HTTP ' + res.status() };
    if (res.url().startsWith(origin)) r.requests.push(e); else r.external.push(e);
  });
  try {
    await page.goto(url, { waitUntil: 'load', timeout: opts.timeout || 30000 });
    // polled on a timer: a page in a background tab gets no animation frames
    await page.waitForFunction('window.__boards && window.__boards.settled', { polling: 100, timeout: opts.timeout || 30000 });
    r.settled = true;
    if (opts.settleMs !== 0) await new Promise(function (res) { setTimeout(res, opts.settleMs || 200); });
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
  r.ok = r.settled && !r.errors.length && !r.unsupported.length && !r.console.length && !r.requests.length;
  if (opts.keepPage) r.page = page; else await page.close();
  return r;
}

// run fn over items with at most n at a time, results in order
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

module.exports = { findChromium: findChromium, openBrowser: openBrowser, boardUrl: boardUrl, renderBoard: renderBoard, pool: pool };
