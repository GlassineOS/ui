// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: one board as an image (spec 003 FR-014), and the boards a change touches (FR-015).
// The same render as the checks and references (browser.js renderBoard()), followed by clicks; what
// comes back is the image and every error the board raised, in a form an agent can read.
'use strict';
const fs = require('fs');
const path = require('path');
const { startServer, describe, listBoards, UI_ROOT } = require('./server.js');
const { openBrowsers, renderBoard, waitSettled, steady, capture, pool } = require('./browser.js');
const { readConfig, vendoredFaces, webCombinations } = require('./references.js');

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

function shown(p) {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? r : p;
}

// the design folder of a board: the nearest ancestor holding canvas.json, else the board's directory
function designDirOf(board) {
  const start = path.dirname(path.resolve(board));
  for (let d = start; ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'canvas.json'))) return d;
    if (d === path.dirname(d)) return start;
  }
}

// parseSize("390x760") → {width, height}, or null when it is not WIDTHxHEIGHT
function parseSize(s) {
  const m = /^([1-9]\d*)x([1-9]\d*)$/.exec(String(s));
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

// the values the web form has, in its order: {voice: [...], scheme: [...], pen: [...]}
function validChoices(combinations) {
  const out = { voice: [], scheme: [], pen: [] };
  for (const c of combinations) for (const k of Object.keys(out)) if (out[k].indexOf(c[k]) < 0) out[k].push(c[k]);
  return out;
}

const PROPS = { voice: ['voice', 'theme'], scheme: ['scheme'], pen: ['pen'] };

// What the render will use. A setting not asked for stays out of the URL (the board's own props, as
// in the checks), and is named by the board's default for it, else the web form's first combination.
// → {voice, scheme, pen, asked: {only what was asked}, notApplied: [asked, but the board has no such prop]}
function resolveChoices(opts, props, choices) {
  const out = { asked: {}, notApplied: [] };
  for (const k of Object.keys(PROPS)) {
    const has = PROPS[k].filter(function (p) { return props[p]; });
    if (opts[k] !== undefined) {
      const v = k === 'pen' && /^\d+$/.test(String(opts[k])) ? Number(opts[k]) : opts[k];
      if (choices[k].indexOf(v) < 0) throw new Error('unknown ' + k + ' "' + opts[k] + '": the ' + k + 's are ' + choices[k].join(', '));
      out[k] = v;
      out.asked[k] = v;
      if (!has.length) out.notApplied.push(k);
    } else {
      const own = has.map(function (p) { return props[p].default; }).filter(function (v) { return v !== undefined && v !== null; })[0];
      out[k] = own === undefined ? choices[k][0] : k === 'pen' && /^\d+$/.test(String(own)) ? Number(own) : own;
    }
  }
  return out;
}

// every problem as one list, each entry in the check report's form ({board, kind, feature, detail,
// line, message}; requests also carry url). kind: render, script, load, ... as the runtime reports
// them, unsupported, console, request, external, font, click.
function flatErrors(r) {
  const plain = function (kind, line, message, url) {
    const e = { board: r.board, kind: kind, feature: '', detail: '', line: line || 0, message: message };
    if (url !== undefined) e.url = url;
    return e;
  };
  return r.errors.concat(r.unsupported,
    r.console.map(function (c) { return plain('console', c.line, c.text, c.url); }),
    r.requests.map(function (q) { return plain('request', 0, q.error, q.url); }),
    r.external.map(function (q) { return plain('external', 0, q.error, q.url); }));
}

// what the page's runtime has reported since the last look (a link's new page starts a new list)
async function collectStatus(page, r) {
  let st = null;
  try { st = await page.evaluate('window.__boards ? JSON.parse(JSON.stringify(window.__boards)) : null'); } catch (e) { return; }
  if (!st) return;
  for (const e of st.errors) {
    const list = e.kind === 'unsupported' ? r.unsupported : r.errors;
    const key = JSON.stringify(e);
    if (!list.some(function (x) { return JSON.stringify(x) === key; })) list.push(e);
  }
}

// A click can start a navigation (a link to another board, a timer that follows one): the wait
// resolves when that document has loaded, or at once when none has started.
function watchNavigation(page, timeout) {
  let pending = null;
  page.on('request', function (q) {
    if (!q.isNavigationRequest() || q.frame() !== page.mainFrame()) return;
    pending = new Promise(function (resolve) {
      const done = function () { clearTimeout(t); page.off('load', done); page.off('requestfailed', failed); pending = null; resolve(); };
      const failed = function (x) { if (x === q) done(); };
      const t = setTimeout(done, timeout);
      page.on('load', done);
      page.on('requestfailed', failed);
    });
  });
  return function () { return pending; };
}

// the page after a click, as settled as after the first render; a navigation during the wait starts
// the wait over
async function settleAfterClick(page, navigating, timeout) {
  let fonts = [];
  for (let tries = 0; tries < 3; tries++) {
    try {
      await sleep(60);
      if (navigating()) await navigating();
      if (!(await page.evaluate('!!window.__boards'))) throw new Error('left the boards for ' + page.url());
      await waitSettled(page, { timeout: timeout });
      fonts = await steady(page);
      return fonts;
    } catch (e) {
      if (!/context was destroyed|Cannot find context|detached/i.test(String(e && e.message || e))) throw e;
    }
  }
  return fonts;
}

// Links to other sites open in a tab of their own, outside isolate(): refused here, and reported as
// any other request elsewhere.
async function blockPopups(page, r) {
  await page.exposeFunction('__boardsShotOpened', function (url) { r.external.push({ url: url, error: 'blocked: no network in renders' }); });
  const noOpen = 'window.open = function (u) { window.__boardsShotOpened(String(u)); return null; };';
  await page.evaluateOnNewDocument(noOpen);
  await page.evaluate(noOpen);
}

// the clicks in order, each followed by the usual settling. A click that fails ends the series.
// → [{selector, ok, error?} or {selector, ok: false, skipped: true}]
async function runClicks(page, r, clicks, timeout) {
  const out = [];
  let stop = r.settled ? null : 'the board did not settle';
  const navigating = watchNavigation(page, timeout);
  if (clicks.length && !stop) await blockPopups(page, r);
  for (const sel of clicks) {
    if (stop) { out.push({ selector: sel, ok: false, skipped: true, error: stop }); continue; }
    try {
      await page.click(sel);
      const fonts = await settleAfterClick(page, navigating, timeout);
      for (const f of fonts) r.fontErrors.push(f);
      out.push({ selector: sel, ok: true });
    } catch (e) {
      const msg = String(e && e.message || e);
      out.push({ selector: sel, ok: false, error: /No element found/i.test(msg) ? 'no element matches ' + sel : msg });
      stop = 'an earlier click failed';
    }
    await collectStatus(page, r);
  }
  return out;
}

// the board's first render and its clicks on an open browser → one board's report
async function shootOn(browser, ctx, b, pick, opts) {
  const t0 = Date.now();
  const size = opts.size || b.size;
  const rep = { ok: false, image: null, board: b.file, design: shown(ctx.design), voice: pick.voice, scheme: pick.scheme, pen: pick.pen,
    size: { width: size.width, height: size.height }, clicks: [], errors: [], notApplied: pick.notApplied };
  const r = await renderBoard(browser, ctx.srv.url, b.file, { width: size.width, height: size.height, voice: pick.asked.voice, scheme: pick.asked.scheme,
    pen: pick.asked.pen, timeout: opts.timeout, keepPage: true, faces: ctx.faces });
  r.fontErrors = [];
  const fontLine = function (f) { return { board: b.file, kind: 'font', feature: '', detail: '', line: 0, message: 'font did not load: ' + f.family + ' ' + f.style + ' ' + f.weight }; };
  const page = r.page;
  const after = [];
  try {
    try {
      for (const f of await steady(page)) r.fontErrors.push(f);
    } catch (e) { after.push({ board: b.file, kind: 'render', feature: '', detail: '', line: 0, message: String(e && e.message || e) }); }
    rep.clicks = await runClicks(page, r, opts.clicks || [], opts.timeout || 30000);
    for (const c of rep.clicks) {
      if (!c.ok && !c.skipped) after.push({ board: b.file, kind: 'click', feature: '', detail: c.selector, line: 0, message: c.error });
    }
    try {
      // what the viewport shows: a click may have scrolled the page
      const at = await page.evaluate('[window.scrollX, window.scrollY]');
      const png = await capture(page, { x: Math.round(at[0]), y: Math.round(at[1]), width: size.width, height: size.height });
      fs.mkdirSync(path.dirname(opts.out), { recursive: true });
      fs.writeFileSync(opts.out, png);
      rep.image = shown(opts.out);
    } catch (e) { after.push({ board: b.file, kind: 'capture', feature: '', detail: '', line: 0, message: String(e && e.message || e) }); }
  } finally { await page.close(); }
  rep.errors = flatErrors(r).concat(r.fontErrors.map(fontLine), after);
  rep.ok = r.settled && !rep.errors.length && rep.clicks.every(function (c) { return c.ok; }) && !!rep.image;
  rep.ms = Date.now() - t0;
  return rep;
}

// the folder's server and everything a shot needs from it; ctx.close() ends it
async function openDesign(design, opts) {
  const srv = await startServer({ design: design, interleaf: opts.interleaf, live: false });
  try {
    return { design: design, srv: srv, faces: vendoredFaces(srv.url, srv.interleaf, design, readConfig(design)),
      choices: validChoices(webCombinations(srv.interleaf)), desc: describe(design), close: function () { return srv.close(); } };
  } catch (e) { await srv.close(); throw e; }
}

function boardIn(ctx, rel) {
  const b = ctx.desc.boards.find(function (x) { return x.file === rel && x.exists; });
  if (!b) throw new Error('no board ' + rel + ' in ' + shown(ctx.design));
  return b;
}

function defaultImage(rep, size) {
  const name = rep.board.replace(/\.dc\.html$/, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  return path.join('out', 'shots', [name, rep.voice, rep.scheme, rep.pen, size.width + 'x' + size.height].join('-') + '.png');
}

// shootBoard({board, voice, scheme, pen, size, clicks, out, interleaf, timeout, chromium}) → the report.
// What the user got wrong (no such board, an unknown voice) throws; what the board does is reported.
async function shootBoard(opts) {
  const file = path.resolve(opts.board);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('no board at ' + opts.board);
  if (!/\.dc\.html$/.test(file)) throw new Error(opts.board + ' is not a board (*.dc.html)');
  const design = designDirOf(file);
  const rel = path.relative(design, file).split(path.sep).join('/');
  const ctx = await openDesign(design, opts);
  let browsers = [];
  try {
    const b = boardIn(ctx, rel);
    const size = opts.size || b.size;
    // validated before a browser starts
    const pick = resolveChoices(opts, b.props || {}, ctx.choices);
    const out = path.resolve(opts.out || defaultImage({ board: rel, voice: pick.voice, scheme: pick.scheme, pen: pick.pen }, size));
    browsers = await openBrowsers(1, { chromium: opts.chromium });
    return await shootOn(browsers[0], ctx, b, pick, Object.assign({}, opts, { size: size, out: out }));
  } finally {
    await Promise.all(browsers.map(function (x) { return x.close(); }));
    await ctx.close();
  }
}

// changedBoards(paths, root) → the boards under designs/ a change touches, as paths below root: a
// changed board, and every board of a folder in which anything else changed (its canvas, its fonts,
// its data)
function changedBoards(paths, root) {
  const set = new Set();
  const inFolder = function (dir) { return listBoards(path.join(root, dir)).map(function (f) { return dir + '/' + f; }); };
  const isBoard = function (dir, rel) { return fs.existsSync(path.join(root, dir)) && listBoards(path.join(root, dir)).indexOf(rel) >= 0; };
  for (const raw of paths) {
    const m = /^(designs\/[^/]+)\/(.+)$/.exec(raw.trim());
    if (!m || !fs.existsSync(path.join(root, m[1]))) continue;
    if (/\.dc\.html$/.test(m[2])) { if (isBoard(m[1], m[2])) set.add(m[0]); }
    else for (const f of inFolder(m[1])) set.add(f);
  }
  return Array.from(set).sort();
}

// shootBoards({boards: [path below root], root, out: DIR, jobs, interleaf, timeout, chromium}) → report:
// each board as OUT/<project>/<board>.png, one browser per worker
async function shootBoards(opts) {
  const root = path.resolve(opts.root || UI_ROOT);
  const out = path.resolve(opts.out || path.join('out', 'shots'));
  const ctxs = new Map();
  let browsers = [];
  try {
    const items = [];
    for (const rel of opts.boards) {
      const file = path.join(root, rel);
      const design = designDirOf(file);
      if (!ctxs.has(design)) ctxs.set(design, await openDesign(design, opts));
      const ctx = ctxs.get(design);
      items.push({ ctx: ctx, b: boardIn(ctx, path.relative(design, file).split(path.sep).join('/')), image: path.join(out, rel.replace(/^designs\//, '').replace(/\.dc\.html$/, '') + '.png') });
    }
    if (items.length) browsers = await openBrowsers(Math.min(opts.jobs || 4, items.length), { chromium: opts.chromium });
    const results = await pool(items, opts.jobs || 4, function (it, _, worker) {
      return shootOn(browsers[worker], it.ctx, it.b, resolveChoices({}, it.b.props || {}, it.ctx.choices), { out: it.image, timeout: opts.timeout });
    });
    const failed = results.filter(function (r) { return !r.ok; });
    return { summary: { boards: results.length, ok: failed.length === 0, failing: failed.length }, boards: results };
  } finally {
    await Promise.all(browsers.map(function (x) { return x.close(); }));
    await Promise.all(Array.from(ctxs.values()).map(function (c) { return c.close(); }));
  }
}

module.exports = { designDirOf: designDirOf, parseSize: parseSize, validChoices: validChoices, resolveChoices: resolveChoices, flatErrors: flatErrors,
  shootBoard: shootBoard, shootBoards: shootBoards, changedBoards: changedBoards };
