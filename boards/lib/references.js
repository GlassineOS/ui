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

// the text stack the renders depend on: packages that Chromium draws text with (it is linked
// against the system's) and the fallback fonts. Alpine updates them within a release, so they
// are recorded rather than pinned.
const TEXT_PACKAGES = ['freetype', 'harfbuzz', 'fontconfig', 'font-dejavu', 'font-opensans'];

// textPackages(file) → {name: version} of the installed Alpine packages, {} elsewhere
function textPackages(file) {
  const out = {};
  let db;
  try { db = fs.readFileSync(file || '/lib/apk/db/installed', 'utf8'); } catch (e) { return out; }
  for (const entry of db.split('\n\n')) {
    const name = /^P:(.+)$/m.exec(entry), ver = /^V:(.+)$/m.exec(entry);
    if (name && ver && TEXT_PACKAGES.indexOf(name[1]) >= 0) out[name[1]] = ver[1];
  }
  return out;
}

// the packages whose versions differ between a store and this run ([] when either is unknown)
function packageDiff(store, running) {
  if (!store || !Object.keys(store).length || !Object.keys(running).length) return [];
  return Array.from(new Set(Object.keys(store).concat(Object.keys(running)))).sort()
    .filter(function (n) { return store[n] !== running[n]; })
    .map(function (n) { return { name: n, references: store[n] || null, running: running[n] || null }; });
}

// readStore(dir) → {contract, kind, chromium, libraries, cases, corrupt?}: empty when there is none;
// an index that can't be read gives an empty store with corrupt set (a run reports it, --update
// writes a new one). A store of another contract is an error.
function readStore(dir) {
  const p = path.join(dir, 'index.json');
  const empty = { contract: CONTRACT, kind: null, chromium: null, libraries: {}, cases: {} };
  if (!fs.existsSync(p)) return empty;
  let s;
  try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return Object.assign(empty, { corrupt: String(e && e.message || e) }); }
  if (!s || typeof s !== 'object' || (s.cases !== undefined && typeof s.cases !== 'object')) return Object.assign(empty, { corrupt: 'not a references index' });
  if (s.contract !== CONTRACT) throw new Error(shown(p) + ': references contract ' + s.contract + ', this tool reads ' + CONTRACT);
  s.cases = s.cases || {};
  s.libraries = s.libraries || {};
  return s;
}

function isReferenceName(f) { return /^[0-9a-f]{16}\.png$/.test(f); }

// the PNGs in a store that no case names
function orphans(dir, store) {
  let files;
  try { files = fs.readdirSync(dir); } catch (e) { return []; }
  const used = new Set(Object.values(store.cases).map(function (c) { return c.file; }));
  return files.filter(function (f) { return isReferenceName(f) && !used.has(f); }).sort();
}

// writeStore(dir, {kind, chromium, libraries, cases}, images: Map(file → PNG buffer)): writes
// index.json and the PNGs that are new or damaged, and removes the PNGs no case names any more
function writeStore(dir, store, images) {
  fs.mkdirSync(dir, { recursive: true });
  const cases = {};
  for (const id of Object.keys(store.cases).sort()) cases[id] = store.cases[id];
  const used = new Set(Object.values(cases).map(function (c) { return c.file; }));
  for (const [file, buf] of images) {
    if (!used.has(file)) continue;
    const p = path.join(dir, file);
    if (!fs.existsSync(p) || !fs.readFileSync(p).equals(buf)) fs.writeFileSync(p, buf);
  }
  for (const f of orphans(dir, { cases: cases })) fs.unlinkSync(path.join(dir, f));
  const index = { contract: CONTRACT, kind: store.kind, chromium: store.chromium, libraries: store.libraries || {}, tolerance: TOLERANCE, cases: cases };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
}

function safeName(id) { return id.replace(/[^A-Za-z0-9._-]+/g, '_'); }

// runCases({cases, render, refs, out, update, kind, chromium, libraries, jobs, only, pool, allowEmpty})
//   cases: [{id, ...}]; render(case) → {png: Buffer|null, errors: [..]} (errors: anything that
//   makes the render untrustworthy: load and script errors, blocked requests, fonts that failed).
//   Compares each render with refs/ (or, with update, writes it there), writes the render and a
//   diff image of every failing case below out/, and returns the report. No cases is a failure
//   unless allowEmpty: a check that compared nothing proved nothing. An update that fails while
//   the Chromium or the text packages changed writes nothing: a store comes from one set of them.
async function runCases(o) {
  const store = readStore(o.refs);
  const libraries = o.libraries || {};
  // every reference of a store comes from one Chromium: a partial update with another one would mix them
  if (o.update && o.only && store.chromium && store.chromium !== o.chromium) {
    throw new Error('the references are from Chromium ' + store.chromium + ', this is ' + o.chromium + ': update them all (no case filter)');
  }
  if (o.update && o.only && packageDiff(store.libraries, libraries).length) {
    throw new Error('the references are from other text packages: update them all (no case filter)');
  }
  // the index is gone, so a partial update would forget every other case and delete its image
  if (o.update && o.only && store.corrupt) throw new Error('the references index can not be read: update them all (no case filter)');
  const images = new Map();
  const tol = TOLERANCE;
  const results = await o.pool(o.cases, o.jobs || 4, async function (c, _, worker) {
    let r;
    try { r = await o.render(c, worker); } catch (e) { r = { png: null, errors: [{ kind: 'render', message: String(e && e.message || e) }] }; }
    const res = { case: c.id, status: 'pass', width: null, height: null, differing: 0, maxDelta: 0, box: null,
      reference: null, actual: null, diff: null, errors: r.errors || [] };
    for (const k of Object.keys(c)) if (k !== 'id' && !(k in res)) res[k] = c[k];
    if (!r.png) { res.status = 'error'; return res; }
    let img;
    try { img = PNG.decode(r.png); } catch (e) { res.status = 'error'; res.errors = res.errors.concat([{ kind: 'render', message: 'the render can not be read: ' + String(e && e.message || e) }]); return res; }
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
      let reference = null;
      try { reference = PNG.decode(fs.readFileSync(refFile)); } catch (e) {
        res.status = 'bad reference';
        res.errors = res.errors.concat([{ kind: 'reference', message: 'the reference can not be read: ' + String(e && e.message || e) + ' (--update writes it again)' }]);
      }
      if (reference) {
        const cmp = PNG.compare(reference, img, { threshold: tol.threshold });
        res.differing = cmp.differing; res.maxDelta = cmp.maxDelta; res.box = cmp.box;
        if (!cmp.sameSize) res.referenceSize = { width: ref.width, height: ref.height };
        if (!cmp.sameSize || cmp.differing > tol.pixels) {
          res.status = 'differs';
          fs.mkdirSync(path.join(o.out, 'diff'), { recursive: true });
          const p = path.join(o.out, 'diff', name + '.png');
          fs.writeFileSync(p, PNG.encode(cmp.diff));
          res.diff = shown(p);
        }
      }
    } else res.status = 'no reference';
    // a damaged reference is the store's fault, not the render's: --update may replace it
    if (res.status !== 'bad reference' && res.errors.length) res.status = 'error';
    if (res.status !== 'pass') save();
    if (o.update && res.status !== 'error') {
      const file = pixelName(img);
      if (!images.has(file)) images.set(file, PNG.encode(img));
      store.cases[c.id] = { file: file, width: img.width, height: img.height };
      res.before = res.status;
      res.status = res.status === 'pass' ? 'pass' : 'updated';
    }
    return res;
  });
  const failedRenders = results.some(function (r) { return r.status === 'error'; });
  const ran = new Set(o.cases.map(function (c) { return c.id; }));
  // references of cases that no longer exist: only a full run can tell
  let stale = o.only || !o.cases.length ? [] : Object.keys(store.cases).filter(function (id) { return !ran.has(id); }).sort();
  const before = { chromium: store.chromium, libraries: store.libraries };
  const changed = (store.chromium && store.chromium !== o.chromium) || packageDiff(store.libraries, libraries).length > 0;
  // nothing to compare: the store stays as it is, and an index that can't be read stays reported
  const refused = o.update && (!o.cases.length || (failedRenders && changed));
  let written = false, orphanFiles = [];
  if (refused) {
    for (const r of results) if (r.before) r.status = r.before;
  } else if (o.update) {
    for (const r of results) if (r.before === 'bad reference') r.errors = [];
    for (const id of stale) delete store.cases[id];
    stale = [];
    store.kind = o.kind;
    store.chromium = o.chromium;
    if (!o.only || !Object.keys(store.libraries || {}).length) store.libraries = libraries;
    writeStore(o.refs, store, images);
    written = true;
  }
  if (!store.corrupt || written) orphanFiles = orphans(o.refs, store);
  for (const r of results) delete r.before;
  const shownStore = written ? { chromium: store.chromium, libraries: store.libraries } : before;
  const chromium = { references: shownStore.chromium, running: o.chromium };
  const diff = packageDiff(shownStore.libraries, libraries);
  const count = function (s) { return results.filter(function (r) { return r.status === s; }).length; };
  const summary = { cases: results.length, pass: count('pass'), updated: count('updated'), differs: count('differs'),
    noReference: count('no reference'), badReference: count('bad reference'), errors: count('error'), stale: stale.length, orphans: orphanFiles.length,
    storeUnreadable: !!(store.corrupt && !written), chromiumMismatch: !!(chromium.running && chromium.references && chromium.references !== chromium.running),
    librariesDiffer: diff.length > 0, written: written, refused: !!(refused && results.length), empty: !results.length };
  summary.ok = summary.differs === 0 && summary.noReference === 0 && summary.badReference === 0 && summary.errors === 0 && summary.stale === 0 &&
    summary.orphans === 0 && !summary.storeUnreadable && !summary.chromiumMismatch && (!summary.empty || !!o.allowEmpty);
  return { contract: CONTRACT, kind: o.kind, references: shown(o.refs), out: shown(o.out), tolerance: tol, chromium: chromium,
    libraries: { references: shownStore.libraries || {}, running: libraries, differ: diff },
    storeError: store.corrupt && !written ? store.corrupt : null, summary: summary, stale: stale, orphans: orphanFiles, cases: results };
}

function textSummary(rep, title) {
  const s = rep.summary;
  const lines = [title + ': ' + s.cases + ' cases, ' + s.pass + ' pass' + (s.updated ? ', ' + s.updated + ' updated' : '') +
    (s.differs ? ', ' + s.differs + ' differ' : '') + (s.noReference ? ', ' + s.noReference + ' without a reference' : '') +
    (s.badReference ? ', ' + s.badReference + ' with a damaged reference' : '') + (s.errors ? ', ' + s.errors + ' with errors' : '') +
    (s.stale ? ', ' + s.stale + ' stale references' : '') + (s.orphans ? ', ' + s.orphans + ' orphan images' : '')];
  if (s.empty && !s.ok) lines.push('  NOTHING WAS COMPARED: no cases (--allow-empty if that is intended)');
  if (s.storeUnreadable) lines.push('  the references index can not be read: ' + rep.storeError + ' (--update writes a new one)');
  if (s.chromiumMismatch) lines.push('  Chromium ' + rep.chromium.running + ' renders, the references are from ' + rep.chromium.references + ' (README "References": bumping the pin)');
  if (s.librariesDiffer && !s.ok) {
    lines.push('  the text packages differ from the references, which can explain differences in every case (README "References"):');
    for (const d of rep.libraries.differ) lines.push('    ' + d.name + ': references ' + (d.references || 'none') + ', this run ' + (d.running || 'none'));
  }
  if (s.refused) lines.push('  the references were not changed: the update failed while the Chromium or the text packages differ');
  let shownCount = 0;
  for (const r of rep.cases) {
    if (r.status === 'pass' || r.status === 'updated') continue;
    if (++shownCount > 40) { lines.push('  ... (the report lists all)'); break; }
    let l = '  ' + r.status.toUpperCase() + ' ' + r.case;
    if (r.status === 'differs') l += ': ' + r.differing + ' pixels' + (r.referenceSize ? ', size ' + r.referenceSize.width + 'x' + r.referenceSize.height + ' → ' + r.width + 'x' + r.height : '') + ', diff ' + r.diff;
    lines.push(l);
    for (const e of (r.errors || []).slice(0, 5)) lines.push('    ' + (e.kind || 'error') + ': ' + String(e.message || e.url || JSON.stringify(e)).slice(0, 300));
  }
  for (const id of rep.stale.slice(0, 20)) lines.push('  STALE ' + id + ' (no such case; --update removes it)');
  for (const f of rep.orphans.slice(0, 20)) lines.push('  ORPHAN ' + f + ' (no case names it; --update removes it)');
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
  const { openBrowsers, renderBoard, steady, capture, pool } = require('./browser.js');
  const design = path.resolve(opts.design);
  const config = readConfig(design);
  const refs = path.resolve(opts.refs || path.join(design, config.references || 'references'));
  const out = path.resolve(opts.out || path.join('out', 'references', 'boards'));
  const desc = describe(design);
  const unknown = (opts.boards || []).filter(function (f) { return !desc.boards.some(function (b) { return b.file === f && b.exists; }); });
  if (unknown.length) throw new Error('no board ' + unknown.join(', ') + ' in ' + shown(design));
  const srv = await startServer({ design: design, interleaf: opts.interleaf, live: false });
  let browsers = [];
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
    const jobs = opts.jobs || 4;
    // nothing to render: no browser needed, and the report says so
    if (cases.length) browsers = await openBrowsers(jobs, { chromium: opts.chromium });
    const version = browsers.length ? await chromiumVersion(browsers[0]) : null;
    const rep = await runCases({
      cases: cases, refs: refs, out: out, update: opts.update, kind: 'boards', chromium: version, libraries: textPackages(), jobs: jobs, pool: pool,
      allowEmpty: !!opts.allowEmpty, only: !!(opts.boards && opts.boards.length),
      render: async function (c, worker) {
        const r = await renderBoard(browsers[worker], srv.url, c.board, { width: c.size.width, height: c.size.height, voice: c._c.voice, scheme: c._c.scheme,
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
    await Promise.all(browsers.map(function (b) { return b.close(); }));
    await srv.close();
  }
}

module.exports = { CONTRACT: CONTRACT, TOLERANCE: TOLERANCE, TEXT_PACKAGES: TEXT_PACKAGES, textPackages: textPackages, packageDiff: packageDiff, chromiumVersion: chromiumVersion, readStore: readStore, writeStore: writeStore,
  runCases: runCases, textSummary: textSummary, readConfig: readConfig, expandCombinations: expandCombinations, vendoredFaces: vendoredFaces,
  webCombinations: webCombinations, shootDesign: shootDesign, CONFIG: CONFIG };
