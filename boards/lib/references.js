// SPDX-License-Identifier: GPL-2.0-or-later
// Reference images (spec 002 FR-022/FR-023, spec 003 FR-011/FR-012): render cases in headless
// Chromium, compare each with a stored reference, and report per case in a form an agent can read.
// The store, the comparison and the runner are shared by the component previews (previews.js) and
// the design boards (shootDesign() below).
//
// A store is a folder: index.json ({contract, kind, chromium, cases: {id: {file, width, height}}})
// and the PNGs it names, each named by the sha256 of its pixels, so identical renders (the three
// pens on e-ink, for one) are stored once.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PNG = require('./png.js');

const CONTRACT = 1;
// A pixel counts as different when a colour channel differs by more than THRESHOLD (of 255); a
// case fails when more than PIXELS pixels differ. See README "References" for why both are 0.
const TOLERANCE = { threshold: 0, pixels: 0 };

// the Chromium version of a puppeteer Browser ("HeadlessChrome/156.0.8078.79" → "156.0.8078.79")
async function chromiumVersion(browser) {
  const v = await browser.version();
  const m = /([\d.]+)\s*$/.exec(v);
  return m ? m[1] : v;
}

function shown(p) {
  const r = path.relative(process.cwd(), p);
  return r && !r.startsWith('..') && !path.isAbsolute(r) ? r : p;
}

function pixelName(img) {
  return crypto.createHash('sha256').update(String(img.width) + 'x' + String(img.height) + '\n').update(img.data).digest('hex').slice(0, 16) + '.png';
}

// readStore(dir) → {contract, kind, chromium, cases} (empty when there is none)
function readStore(dir) {
  const p = path.join(dir, 'index.json');
  if (!fs.existsSync(p)) return { contract: CONTRACT, kind: null, chromium: null, cases: {} };
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (s.contract !== CONTRACT) throw new Error(shown(p) + ': references contract ' + s.contract + ', this tool reads ' + CONTRACT);
  s.cases = s.cases || {};
  return s;
}

// writeStore(dir, {kind, chromium, cases}, images: Map(file → PNG buffer)): writes index.json and
// the new PNGs, and removes the PNGs no case names any more
function writeStore(dir, store, images) {
  fs.mkdirSync(dir, { recursive: true });
  const cases = {};
  for (const id of Object.keys(store.cases).sort()) cases[id] = store.cases[id];
  const used = new Set(Object.values(cases).map(function (c) { return c.file; }));
  for (const [file, buf] of images) if (used.has(file) && !fs.existsSync(path.join(dir, file))) fs.writeFileSync(path.join(dir, file), buf);
  for (const f of fs.readdirSync(dir)) if (/^[0-9a-f]{16}\.png$/.test(f) && !used.has(f)) fs.unlinkSync(path.join(dir, f));
  const index = { contract: CONTRACT, kind: store.kind, chromium: store.chromium, tolerance: TOLERANCE, cases: cases };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
}

function safeName(id) { return id.replace(/[^A-Za-z0-9._-]+/g, '_'); }

// runCases({cases, render, refs, out, update, kind, chromium, jobs, only, pool})
//   cases: [{id, ...}]; render(case) → {png: Buffer|null, errors: [..]} (errors: anything that
//   makes the render untrustworthy: load and script errors, blocked requests, fonts that failed).
//   Compares each render with refs/ (or, with update, writes it there), writes the render and a
//   diff image of every failing case below out/, and returns the report.
async function runCases(o) {
  const store = readStore(o.refs);
  // every reference of a store comes from one Chromium: a partial update with another one would mix them
  if (o.update && o.only && store.chromium && store.chromium !== o.chromium) {
    throw new Error('the references are from Chromium ' + store.chromium + ', this is ' + o.chromium + ': update them all (no case filter)');
  }
  const images = new Map();
  const tol = TOLERANCE;
  const results = await o.pool(o.cases, o.jobs || 4, async function (c) {
    let r;
    try { r = await o.render(c); } catch (e) { r = { png: null, errors: [{ kind: 'render', message: String(e && e.message || e) }] }; }
    const res = { case: c.id, status: 'pass', width: null, height: null, differing: 0, maxDelta: 0, box: null,
      reference: null, actual: null, diff: null, errors: r.errors || [] };
    for (const k of Object.keys(c)) if (k !== 'id' && !(k in res)) res[k] = c[k];
    if (!r.png) { res.status = 'error'; return res; }
    const img = PNG.decode(r.png);
    res.width = img.width; res.height = img.height;
    const ref = store.cases[c.id];
    const refFile = ref ? path.join(o.refs, ref.file) : null;
    const name = safeName(c.id);
    const save = function () {
      fs.mkdirSync(path.join(o.out, 'actual'), { recursive: true });
      const p = path.join(o.out, 'actual', name + '.png');
      fs.writeFileSync(p, PNG.encode(img));
      res.actual = shown(p);
    };
    if (refFile && fs.existsSync(refFile)) {
      res.reference = shown(refFile);
      const cmp = PNG.compare(PNG.decode(fs.readFileSync(refFile)), img, { threshold: tol.threshold });
      res.differing = cmp.differing; res.maxDelta = cmp.maxDelta; res.box = cmp.box;
      if (!cmp.sameSize) res.referenceSize = { width: ref.width, height: ref.height };
      if (!cmp.sameSize || cmp.differing > tol.pixels) {
        res.status = 'differs';
        fs.mkdirSync(path.join(o.out, 'diff'), { recursive: true });
        const p = path.join(o.out, 'diff', name + '.png');
        fs.writeFileSync(p, PNG.encode(cmp.diff));
        res.diff = shown(p);
      }
    } else res.status = 'no reference';
    if (res.errors.length) res.status = 'error';
    if (o.update && res.status !== 'error') {
      const file = pixelName(img);
      if (!images.has(file)) images.set(file, PNG.encode(img));
      store.cases[c.id] = { file: file, width: img.width, height: img.height };
      res.status = res.status === 'pass' ? 'pass' : 'updated';
    } else if (res.status !== 'pass') save();
    return res;
  });
  const ran = new Set(o.cases.map(function (c) { return c.id; }));
  // references of cases that no longer exist: only a full run can tell
  let stale = o.only ? [] : Object.keys(store.cases).filter(function (id) { return !ran.has(id); }).sort();
  const chromium = { references: store.chromium, running: o.chromium };
  if (o.update) {
    for (const id of stale) delete store.cases[id];
    stale = [];
    store.kind = o.kind;
    store.chromium = o.chromium;
    writeStore(o.refs, store, images);
    chromium.references = store.chromium;
  }
  const count = function (s) { return results.filter(function (r) { return r.status === s; }).length; };
  const summary = { cases: results.length, pass: count('pass'), updated: count('updated'), differs: count('differs'),
    noReference: count('no reference'), errors: count('error'), stale: stale.length,
    chromiumMismatch: !!(chromium.references && chromium.references !== chromium.running) };
  summary.ok = summary.differs === 0 && summary.noReference === 0 && summary.errors === 0 && summary.stale === 0 && !summary.chromiumMismatch;
  return { contract: CONTRACT, kind: o.kind, references: shown(o.refs), out: shown(o.out), tolerance: tol, chromium: chromium,
    summary: summary, stale: stale, cases: results };
}

function textSummary(rep, title) {
  const s = rep.summary;
  const lines = [title + ': ' + s.cases + ' cases, ' + s.pass + ' pass' + (s.updated ? ', ' + s.updated + ' updated' : '') +
    (s.differs ? ', ' + s.differs + ' differ' : '') + (s.noReference ? ', ' + s.noReference + ' without a reference' : '') +
    (s.errors ? ', ' + s.errors + ' with errors' : '') + (s.stale ? ', ' + s.stale + ' stale references' : '')];
  if (s.chromiumMismatch) lines.push('  Chromium ' + rep.chromium.running + ' renders, the references are from ' + rep.chromium.references + ' (README "References": bumping the pin)');
  let shownCount = 0;
  for (const r of rep.cases) {
    if (r.status === 'pass' || r.status === 'updated') continue;
    if (++shownCount > 40) { lines.push('  ... (the report lists all)'); break; }
    let l = '  ' + r.status.toUpperCase() + ' ' + r.case;
    if (r.status === 'differs') l += ': ' + r.differing + ' pixels' + (r.referenceSize ? ', size ' + r.referenceSize.width + 'x' + r.referenceSize.height + ' → ' + r.width + 'x' + r.height : '') + ', diff ' + r.diff;
    lines.push(l);
    for (const e of r.errors.slice(0, 5)) lines.push('    ' + (e.kind || 'error') + ': ' + String(e.message || e.url || JSON.stringify(e)).slice(0, 300));
  }
  for (const id of rep.stale.slice(0, 20)) lines.push('  STALE ' + id + ' (no such case; --update removes it)');
  return lines.join('\n');
}

// ---- design boards (spec 003 FR-011, FR-012) ----------------------------------------------------
// DESIGN/references.json, all optional:
//   {"references": "references",          the store, relative to the design folder
//    "combinations": ["own"],             for every board: "own" (the board's own props),
//                                         "all" (the 27), "VOICE-SCHEME-PEN", or
//                                         {"name", "voice", "scheme", "pen", "props"}
//    "fonts": "fonts/fonts.css",          more vendored fonts (@font-face rules)
//    "boards": {"FILE": {"combinations": [...], "sizes": [{"width", "height"}], "skip": true}}}
const CONFIG = 'references.json';

function readConfig(design) {
  const p = path.join(design, CONFIG);
  if (!fs.existsSync(p)) return {};
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const k of Object.keys(c)) {
    if (['references', 'combinations', 'fonts', 'boards'].indexOf(k) < 0) throw new Error(shown(p) + ': unknown key "' + k + '"');
  }
  return c;
}

function webCombinations(interleaf) {
  // the web form's combinations: beside the Interleaf served (a checkout's web/), else this one's
  const candidates = [path.join(interleaf, '..', 'web', 'combinations.json'), path.join(__dirname, '..', '..', 'web', 'combinations.json')];
  for (const p of candidates) if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')).combinations;
  throw new Error('no web/combinations.json');
}

function expandCombinations(list, all, where) {
  const out = [];
  for (const c of list) {
    if (c === 'own') out.push({ name: 'own' });
    else if (c === 'all') for (const w of all) out.push({ name: w.voice + '-' + w.scheme + '-' + w.pen, voice: w.voice, scheme: w.scheme, pen: w.pen });
    else if (typeof c === 'string') {
      const w = all.find(function (x) { return x.voice + '-' + x.scheme + '-' + x.pen === c; });
      if (!w) throw new Error(where + ': no combination "' + c + '" (VOICE-SCHEME-PEN, "own" or "all")');
      out.push({ name: c, voice: w.voice, scheme: w.scheme, pen: w.pen });
    } else if (c && typeof c === 'object') {
      const name = c.name || [c.voice, c.scheme, c.pen].filter(function (x) { return x !== undefined; }).join('-');
      if (!name || c.props && !c.name) throw new Error(where + ': a combination with props needs a "name"');
      out.push({ name: name, voice: c.voice, scheme: c.scheme, pen: c.pen, props: c.props });
    } else throw new Error(where + ': a combination is a string or an object');
  }
  const seen = new Set();
  for (const c of out) { if (seen.has(c.name)) throw new Error(where + ': combination "' + c.name + '" twice'); seen.add(c.name); }
  return out;
}

// vendoredFaces(base, interleaf, design, config) → the faces for isolate(): Interleaf's fonts
// (served at base + "_boards/fonts/") and the design's own (config "fonts")
function vendoredFaces(base, interleaf, design, config) {
  const { fontFaces } = require('./browser.js');
  const faces = new Map();
  const add = function (css, at) { for (const [k, v] of fontFaces(css, at)) faces.set(k, (faces.get(k) || []).concat(v)); };
  const il = path.join(interleaf, 'fonts', 'fonts.css');
  if (fs.existsSync(il)) add(fs.readFileSync(il, 'utf8'), new URL('_boards/fonts/', base).href);
  if (config && config.fonts) {
    const p = path.join(design, config.fonts);
    if (!fs.existsSync(p)) throw new Error(CONFIG + ': no fonts at ' + shown(p));
    const rel = path.posix.dirname(path.relative(design, p).split(path.sep).join('/'));
    add(fs.readFileSync(p, 'utf8'), new URL((rel === '.' ? '' : rel.split('/').map(encodeURIComponent).join('/') + '/'), base).href);
  }
  return faces;
}

// shootDesign({design, interleaf, refs, out, update, boards: [file], jobs, timeout, chromium}) → report
async function shootDesign(opts) {
  const { startServer, describe } = require('./server.js');
  const { openBrowser, renderBoard, steady, capture, pool } = require('./browser.js');
  const design = path.resolve(opts.design);
  const config = readConfig(design);
  const refs = path.resolve(opts.refs || path.join(design, config.references || 'references'));
  const out = path.resolve(opts.out || path.join('out', 'references', 'boards'));
  const desc = describe(design);
  const srv = await startServer({ design: design, interleaf: opts.interleaf, live: false });
  let browser;
  try {
    const all = webCombinations(srv.interleaf);
    const faces = vendoredFaces(srv.url, srv.interleaf, design, config);
    const per = config.boards || {};
    for (const f of Object.keys(per)) if (!desc.boards.some(function (b) { return b.file === f && b.exists; })) throw new Error(CONFIG + ': no board ' + f);
    const cases = [];
    for (const b of desc.boards) {
      if (!b.exists) continue;
      if (opts.boards && opts.boards.length && opts.boards.indexOf(b.file) < 0) continue;
      const bc = per[b.file] || {};
      if (bc.skip) continue;
      const combos = expandCombinations(bc.combinations || config.combinations || ['own'], all, CONFIG + ' ' + b.file);
      const sizes = (bc.sizes || [b.size]).map(function (s) { return { width: Math.round(s.width), height: Math.round(s.height) }; });
      for (const s of sizes) for (const c of combos) {
        cases.push({ id: b.file + '/' + s.width + 'x' + s.height + '/' + c.name, board: b.file, size: s, combination: c.name, _c: c });
      }
    }
    browser = await openBrowser({ chromium: opts.chromium });
    const version = await chromiumVersion(browser);
    const rep = await runCases({
      cases: cases, refs: refs, out: out, update: opts.update, kind: 'boards', chromium: version, jobs: opts.jobs, pool: pool,
      only: !!(opts.boards && opts.boards.length),
      render: async function (c) {
        const r = await renderBoard(browser, srv.url, c.board, { width: c.size.width, height: c.size.height, voice: c._c.voice, scheme: c._c.scheme,
          pen: c._c.pen, props: c._c.props, timeout: opts.timeout, keepPage: true, faces: faces });
        try {
          const errors = [];
          for (const e of r.errors) errors.push({ kind: e.kind, message: [e.board !== c.board ? e.board : '', e.line ? 'line ' + e.line : '', e.feature, e.detail, e.message].filter(Boolean).join(' ') });
          for (const e of r.unsupported) errors.push({ kind: 'unsupported', message: [e.line ? 'line ' + e.line : '', e.feature, e.detail].filter(Boolean).join(' ') });
          for (const e of r.console) errors.push({ kind: 'console', message: e.text });
          for (const e of r.requests) errors.push({ kind: 'request', message: e.error + ' ' + e.url, url: e.url });
          for (const e of r.external) errors.push({ kind: 'external', message: e.error + ' ' + e.url, url: e.url });
          const fonts = await steady(r.page);
          for (const f of fonts) errors.push({ kind: 'font', message: 'font did not load: ' + f.family + ' ' + f.style + ' ' + f.weight });
          const png = await capture(r.page, { x: 0, y: 0, width: c.size.width, height: c.size.height });
          return { png: png, errors: errors };
        } finally { await r.page.close(); }
      },
    });
    for (const r of rep.cases) delete r._c;
    rep.check = 'board references';
    rep.design = shown(design);
    rep.interleaf = shown(srv.interleaf);
    return rep;
  } finally {
    if (browser) await browser.close();
    await srv.close();
  }
}

module.exports = { CONTRACT: CONTRACT, TOLERANCE: TOLERANCE, chromiumVersion: chromiumVersion, readStore: readStore, writeStore: writeStore,
  runCases: runCases, textSummary: textSummary, readConfig: readConfig, expandCombinations: expandCombinations, vendoredFaces: vendoredFaces,
  webCombinations: webCombinations, shootDesign: shootDesign, CONFIG: CONFIG };
