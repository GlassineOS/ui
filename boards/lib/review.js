#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: the review of a proposal (spec 003 FR-055..FR-057). Node only, no npm packages.
//
// What a proposal changes: every board of the proposal's design folder compared by hash with the
// same board on the main line (added, changed, removed), written as _boards/api/review.json into
// the proposal's export. With diffs, both sides of each changed board are rendered in headless
// Chromium in a set of combinations and the differences kept as images and region boxes
// (_boards/diffs/). Used by tools/site-designs:
//
//   node boards/lib/review.js PR_DESIGN PR_EXPORT --pr PR_JSON [--main MAIN_DESIGN] [--base REL]
//                             [--diffs] [--jobs N] [--budget RENDERS] [--interleaf DIR] [--chromium PATH]
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PNG = require('./png.js');
const T = require('../runtime/template.js');

const CONTRACT = 1;
const DIFFS = '_boards/diffs/';

// ---- hashes -------------------------------------------------------------------------------------
// The board hash of the canvas data (describe() `hash`): the board's bytes, then, sorted by path,
// each file it loads (its bytes) and each board it imports (its hash; a cycle or a missing file
// gives its path only). boardHashes() computes it the same way for a canvas description that has
// no `hash` yet; both sides of a comparison always come from the same function.

// the files of the design folder a board loads by a literal relative URL: the head's scripts and
// the helmet's links and scripts, without ./support.js, ds/… and absolute or remote URLs
function boardLoads(doc, file) {
  const urls = doc.headScripts.map(function (s) { return s.src; });
  for (const h of doc.helmet) {
    if (h.tag === 'link' && h.attrs.href) urls.push(h.attrs.href);
    if (h.tag === 'script' && h.attrs.src) urls.push(h.attrs.src);
  }
  const out = new Set();
  for (const u0 of urls) {
    const u = String(u0).split(/[?#]/)[0];
    if (!u || u.indexOf('{{') >= 0 || /^[a-z][a-z0-9+.-]*:|^\/|^\/\//i.test(u)) continue;
    if (/^(\.\/)?(\.\.\/)*ds\//.test(u) || /^(\.\/)?support\.js$/.test(u)) continue;
    const p = path.posix.normalize(path.posix.join(path.posix.dirname(file), u));
    if (p.startsWith('..')) continue;
    out.add(p);
  }
  return Array.from(out).sort();
}

function boardImports(doc, file) {
  return doc.imports.map(function (n) {
    return path.posix.normalize(n[0] === '/' ? n.slice(1) + '.dc.html' : path.posix.join(path.posix.dirname(file), n + '.dc.html'));
  });
}

// boardHashes(design, files) → {file: sha256 hex}
function boardHashes(design, files) {
  const read = function (rel) { try { return fs.readFileSync(path.join(design, rel)); } catch (e) { return null; } };
  const docs = new Map(), memo = new Map();
  const doc = function (f) {
    if (!docs.has(f)) {
      const src = read(f);
      let d = null;
      if (src) { try { d = T.parseBoard(src.toString('utf8'), f); } catch (e) { d = null; } }
      docs.set(f, { src: src, loads: d ? boardLoads(d, f) : [], imports: d ? boardImports(d, f) : [] });
    }
    return docs.get(f);
  };
  // → {hash, cyclic}: cyclic when a board on the stack was reached, so the value depends on where
  // the walk started and is not kept
  function hash(f, stack) {
    if (memo.has(f)) return { hash: memo.get(f), cyclic: false };
    const d = doc(f);
    const h = crypto.createHash('sha256').update(d.src);
    let cyclic = false;
    const parts = d.loads.map(function (p) { return { p: p, load: true }; }).concat(d.imports.map(function (p) { return { p: p, load: false }; }));
    parts.sort(function (a, b) { return a.p < b.p ? -1 : a.p > b.p ? 1 : a.load === b.load ? 0 : a.load ? -1 : 1; });
    for (const x of parts) {
      if (x.load) { const b = read(x.p); h.update(b || x.p); continue; }
      if (stack.indexOf(x.p) >= 0) { cyclic = true; h.update(x.p); continue; }
      if (!read(x.p)) { h.update(x.p); continue; }
      const sub = hash(x.p, stack.concat([x.p]));
      cyclic = cyclic || sub.cyclic;
      h.update(sub.hash);
    }
    const out = h.digest('hex');
    if (!cyclic) memo.set(f, out);
    return { hash: out, cyclic: cyclic };
  }
  const out = {};
  for (const f of files) out[f] = hash(f, [f]).hash;
  return out;
}

// sideHashes([mainDesc, prDesc], [mainDir, prDir]) → [hashes, hashes] ({file: hash}, null for no
// description): the canvas data's own hashes when every board of both carries one, else both computed here
function sideHashes(descs, dirs) {
  const has = descs.every(function (d) { return !d || d.boards.every(function (b) { return !b.exists || typeof b.hash === 'string'; }); });
  return descs.map(function (d, i) {
    if (!d) return null;
    const files = d.boards.filter(function (b) { return b.exists; }).map(function (b) { return b.file; });
    if (has) { const o = {}; for (const b of d.boards) if (b.exists) o[b.file] = b.hash; return o; }
    return boardHashes(dirs[i], files);
  });
}

// compareDesigns(main, pr) → [{file, title, change, issues, hash, page, states}]
//   main, pr: {desc, hashes} (main null for a design the main line does not have: every board added).
//   Order: the proposal's boards as its canvas lists them, then the removed ones as main lists them.
function compareDesigns(main, pr) {
  const out = [];
  const before = new Map();
  if (main) for (const b of main.desc.boards) if (b.exists) before.set(b.file, b);
  const entry = function (b, change, hash) {
    return { file: b.file, title: b.title, change: change, issues: (b.issues || []).length, hash: hash, page: b.page || null };
  };
  const seen = new Set();
  for (const b of pr.desc.boards) {
    if (!b.exists) continue;
    seen.add(b.file);
    const m = before.get(b.file);
    if (!m) out.push(entry(b, 'added', pr.hashes[b.file]));
    else if (main.hashes[b.file] !== pr.hashes[b.file]) out.push(entry(b, 'changed', pr.hashes[b.file]));
  }
  if (main) for (const b of main.desc.boards) if (b.exists && !seen.has(b.file)) out.push(Object.assign(entry(b, 'removed', main.hashes[b.file]), { issues: 0 }));
  return out;
}

// ---- regions of a difference --------------------------------------------------------------------
// diffMask(cmp) → Uint8Array of width × height, 1 where PNG.compare() found a pixel that differs
// (red in its diff image) or that only one image has (blue)
function diffMask(cmp) {
  const d = cmp.diff.data, n = cmp.width * cmp.height, m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    if (r === 255 && g === 0 && b === 0 || r === 0 && g === 90 && b === 255) m[i] = 1;
  }
  return m;
}

// regions(mask, width, height, {tile, gap, max}) → [{x, y, width, height, pixels}]
//   The differing pixels grouped: the image cut into tiles (8 px), tiles with a differing pixel
//   joined when they are within gap tiles (2) of each other, and each group's tight box of its
//   pixels; overlapping boxes merged. More than max (12) regions: the gap doubles. Every differing
//   pixel is in exactly one box's group, and every box holds one at least. Top to bottom, left to right.
function regions(mask, width, height, opts) {
  opts = opts || {};
  const tile = opts.tile || 8, max = opts.max || 12;
  const tw = Math.ceil(width / tile), th = Math.ceil(height / tile);
  // per tile: pixel count and tight box
  const cnt = new Int32Array(tw * th), bx0 = new Int32Array(tw * th).fill(1 << 30), by0 = new Int32Array(tw * th).fill(1 << 30),
    bx1 = new Int32Array(tw * th).fill(-1), by1 = new Int32Array(tw * th).fill(-1);
  for (let y = 0; y < height; y++) {
    const row = y * width, ty = (y / tile) | 0;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      const t = ty * tw + ((x / tile) | 0);
      cnt[t]++;
      if (x < bx0[t]) bx0[t] = x; if (x > bx1[t]) bx1[t] = x;
      if (y < by0[t]) by0[t] = y; if (y > by1[t]) by1[t] = y;
    }
  }
  const on = [];
  for (let t = 0; t < tw * th; t++) if (cnt[t]) on.push(t);
  if (!on.length) return [];
  let gap = opts.gap === undefined ? 2 : opts.gap;
  for (;;) {
    const group = new Int32Array(tw * th).fill(-1);
    const boxes = [];
    for (const t0 of on) {
      if (group[t0] >= 0) continue;
      const g = boxes.length, box = { x0: 1 << 30, y0: 1 << 30, x1: -1, y1: -1, pixels: 0 };
      boxes.push(box);
      const queue = [t0];
      group[t0] = g;
      while (queue.length) {
        const t = queue.pop(), cx = t % tw, cy = (t / tw) | 0;
        box.pixels += cnt[t];
        box.x0 = Math.min(box.x0, bx0[t]); box.y0 = Math.min(box.y0, by0[t]);
        box.x1 = Math.max(box.x1, bx1[t]); box.y1 = Math.max(box.y1, by1[t]);
        for (let yy = Math.max(0, cy - gap); yy <= Math.min(th - 1, cy + gap); yy++) {
          for (let xx = Math.max(0, cx - gap); xx <= Math.min(tw - 1, cx + gap); xx++) {
            const u = yy * tw + xx;
            if (cnt[u] && group[u] < 0) { group[u] = g; queue.push(u); }
          }
        }
      }
    }
    // overlapping boxes become one, until none overlaps
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < boxes.length && !merged; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) {
            boxes[i] = { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), pixels: a.pixels + b.pixels };
            boxes.splice(j, 1);
            merged = true;
            break;
          }
        }
      }
    }
    if (boxes.length <= max || gap > Math.max(tw, th)) {
      return boxes.map(function (b) { return { x: b.x0, y: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1, pixels: b.pixels }; })
        .sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    }
    gap = gap ? gap * 2 : 1;
  }
}

// ---- rendering both sides -----------------------------------------------------------------------
function comboId(c) { return c.voice + '-' + c.scheme + '-' + c.pen + (c.state ? '@' + c.state : ''); }

// the combinations of one changed board: every voice × scheme at pen 1 in the default state, then
// the same in each named state both sides have; a state only one side has is listed as missing
function boardCombos(all, mainBoard, prBoard) {
  const base = all.filter(function (w) { return Number(w.pen) === 1; }).map(function (w) { return { voice: w.voice, scheme: w.scheme, pen: 1, state: null }; });
  const ms = new Map(((mainBoard && mainBoard.states) || []).map(function (s) { return [s.id, s]; }));
  const ps = (prBoard && prBoard.states) || [];
  const combos = base.slice(), missing = [];
  for (const s of ps) {
    if (!ms.has(s.id)) { missing.push(s.id); continue; }
    for (const c of base) combos.push(Object.assign({}, c, { state: s.id, mainProps: ms.get(s.id).props || {}, prProps: s.props || {} }));
  }
  for (const id of ms.keys()) if (!ps.some(function (s) { return s.id === id; })) missing.push(id);
  return { combos: combos, missing: missing.sort() };
}

function errorList(r) {
  const out = [];
  for (const e of r.errors) out.push([e.board !== r.board ? e.board : '', e.line ? 'line ' + e.line : '', e.feature, e.detail, e.message].filter(Boolean).join(' '));
  for (const e of r.unsupported) out.push(['unsupported', e.line ? 'line ' + e.line : '', e.feature, e.detail].filter(Boolean).join(' '));
  for (const e of r.console) out.push('console: ' + e.text);
  for (const e of r.requests) out.push('request: ' + e.error + ' ' + e.url);
  for (const e of r.external) out.push('external: ' + e.error + ' ' + e.url);
  return out.slice(0, 20);
}

// renderDiffs({main, pr, boards, out, interleaf, jobs, budget, chromium, timeout}) → the diffs index
//   main, pr: {dir, desc}; boards: compareDesigns() entries (only "changed" ones are rendered).
//   Writes the difference images to out/_boards/diffs/ (named by their pixels) and returns
//   {contract, combinations, boards: {file: {missingStates, combos: {id: {...}}}}, renders, notComputed, ms}.
//   The default combination of every board comes first; past budget renders the rest are left out
//   and listed as not computed.
async function renderDiffs(o) {
  const { startServer } = require('./server.js');
  const { openBrowsers, renderBoard, steady, capture, pool } = require('./browser.js');
  const { webCombinations, vendoredFaces, readConfig } = require('./references.js');
  const t0 = Date.now();
  const changed = o.boards.filter(function (b) { return b.change === 'changed'; });
  const index = { contract: CONTRACT, boards: {}, renders: 0, notComputed: 0, ms: 0 };
  const dir = path.join(o.out, DIFFS);
  fs.mkdirSync(dir, { recursive: true });
  if (!changed.length) { index.ms = Date.now() - t0; return index; }
  const servers = await Promise.all([o.main.dir, o.pr.dir].map(function (d) { return startServer({ design: d, interleaf: o.interleaf, live: false }); }));
  let browsers = [];
  try {
    const all = webCombinations(servers[1].interleaf);
    const faces = servers.map(function (s, i) { const d = i ? o.pr.dir : o.main.dir; return vendoredFaces(s.url, s.interleaf, d, readConfig(d)); });
    const byFile = function (desc, f) { return desc.boards.find(function (b) { return b.file === f; }); };
    const cases = [];
    for (const b of changed) {
      const mb = byFile(o.main.desc, b.file), pb = byFile(o.pr.desc, b.file);
      const bc = boardCombos(all, mb, pb);
      index.boards[b.file] = { missingStates: bc.missing, combos: {} };
      bc.combos.forEach(function (c, k) { cases.push({ file: b.file, mb: mb, pb: pb, c: c, rank: k }); });
    }
    // the first combination of every board before the second of any
    cases.sort(function (a, b) { return a.rank - b.rank; });
    const budget = o.budget || 400;
    const run = [], left = [];
    for (const c of cases) (run.length * 2 + 2 <= budget ? run : left).push(c);
    for (const c of left) { index.boards[c.file].combos[comboId(c.c)] = { voice: c.c.voice, scheme: c.c.scheme, pen: c.c.pen, state: c.c.state, computed: false }; index.notComputed++; }
    const jobs = Math.max(1, Math.min(o.jobs || 4, run.length * 2));
    browsers = await openBrowsers(jobs, { chromium: o.chromium });
    const shoot = async function (side, board, c, worker) {
      const r = await renderBoard(browsers[worker], servers[side].url, board.file, { width: board.size.width, height: board.size.height,
        voice: c.voice, scheme: c.scheme, pen: c.pen, props: c.state ? (side ? c.prProps : c.mainProps) : undefined, timeout: o.timeout, keepPage: true, faces: faces[side] });
      try {
        const errs = errorList(r);
        const fonts = await steady(r.page);
        for (const f of fonts) errs.push('font did not load: ' + f.family);
        const png = await capture(r.page, { x: 0, y: 0, width: r.size.width, height: r.size.height });
        return { png: png, errors: errs };
      } finally { await r.page.close(); }
    };
    // each side of each case is one job: the two renders of a case run on different workers
    const jobsList = [];
    for (const c of run) { jobsList.push({ c: c, side: 0 }); jobsList.push({ c: c, side: 1 }); }
    const shots = await pool(jobsList, jobs, async function (j, _, w) {
      try { return await shoot(j.side, j.side ? j.c.pb : j.c.mb, j.c.c, w); } catch (e) { return { png: null, errors: ['render: ' + String(e && e.message || e)] }; }
    });
    index.renders = shots.length;
    run.forEach(function (c, i) {
      const a = shots[i * 2], b = shots[i * 2 + 1];
      const rec = { voice: c.c.voice, scheme: c.c.scheme, pen: c.c.pen, state: c.c.state, computed: true, differing: 0, total: 0,
        width: c.pb.size.width, height: c.pb.size.height, regions: [], image: null, errors: { before: a.errors, after: b.errors } };
      if (!a.png || !b.png) rec.computed = false;
      else if (!a.png.equals(b.png)) {
        const cmp = PNG.compare(PNG.decode(a.png), PNG.decode(b.png), { threshold: 0 });
        rec.differing = cmp.differing;
        rec.width = cmp.width; rec.height = cmp.height;
        if (cmp.differing) {
          rec.regions = regions(diffMask(cmp), cmp.width, cmp.height);
          const buf = PNG.encode(cmp.diff);
          const name = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) + '.png';
          const p = path.join(dir, name);
          if (!fs.existsSync(p)) fs.writeFileSync(p, buf);
          rec.image = name;
        }
      }
      rec.total = rec.width * rec.height;
      if (!rec.computed) index.notComputed++;
      index.boards[c.file].combos[comboId(c.c)] = rec;
    });
  } finally {
    await Promise.all(browsers.map(function (b) { return b.close(); }));
    await Promise.all(servers.map(function (s) { return s.close(); }));
  }
  index.ms = Date.now() - t0;
  return index;
}

// ---- review.json --------------------------------------------------------------------------------
// readPr(file) → {number, title, url, head, checks?}: what the review shows of pr.json
function readPr(file) {
  const m = JSON.parse(fs.readFileSync(file, 'utf8'));
  const n = Number(m.number);
  if (!Number.isInteger(n) || n <= 0) throw new Error(file + ': no pull request number');
  const url = String(m.url || '');
  if (!/^https:\/\//.test(url)) throw new Error(file + ': url must be https');
  const pr = { number: n, title: String(m.title || ''), url: url, head: String(m.head || '').replace(/[^0-9a-f]/g, '').slice(0, 40) };
  if (m.checks === 'passed' || m.checks === 'failed') pr.checks = m.checks;
  return pr;
}

// writeReview({main, pr, out, prJson, base, diffs, ...}) → review.json as written
//   main, pr: design folders (main null when the main line has no such design); out: the
//   proposal's export; base: the main line's export relative to the export's _boards/ (the pages).
async function writeReview(o) {
  const { describe } = require('./server.js');
  const mainDesc = o.main && fs.existsSync(o.main) ? describe(o.main) : null;
  const prDesc = describe(o.pr);
  const hs = sideHashes([mainDesc, prDesc], [o.main, o.pr]);
  const boards = compareDesigns(mainDesc ? { desc: mainDesc, hashes: hs[0] } : null, { desc: prDesc, hashes: hs[1] });
  const review = { contract: CONTRACT, pr: readPr(o.prJson), base: mainDesc ? o.base : null, boards: boards, diffs: null };
  let ms = null;
  if (o.diffs && mainDesc && boards.some(function (b) { return b.change === 'changed'; })) {
    const idx = await renderDiffs({ main: { dir: o.main, desc: mainDesc }, pr: { dir: o.pr, desc: prDesc }, boards: boards, out: o.out,
      interleaf: o.interleaf, jobs: o.jobs, budget: o.budget, chromium: o.chromium, timeout: o.timeout });
    fs.writeFileSync(path.join(o.out, DIFFS, 'index.json'), JSON.stringify(idx) + '\n');
    review.diffs = DIFFS;
    ms = idx.ms;
  }
  fs.mkdirSync(path.join(o.out, '_boards', 'api'), { recursive: true });
  fs.writeFileSync(path.join(o.out, '_boards', 'api', 'review.json'), JSON.stringify(review) + '\n');
  // how long the difference images took, for the caller's message (not part of review.json)
  Object.defineProperty(review, 'diffsMs', { value: ms, enumerable: false });
  return review;
}

function main(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diffs') opt.diffs = true;
    else if (/^--(main|base|pr|jobs|budget|interleaf|chromium|timeout)$/.test(a) && i + 1 < argv.length) opt[a.slice(2)] = argv[++i];
    else if (a.startsWith('--')) { process.stderr.write('review: unknown option ' + a + '\n'); process.exit(2); }
    else pos.push(a);
  }
  if (pos.length !== 2 || !opt.pr) {
    process.stderr.write('usage: node boards/lib/review.js PR_DESIGN PR_EXPORT --pr PR_JSON [--main MAIN_DESIGN] [--base REL] [--diffs] [--jobs N] [--budget N]\n');
    process.exit(2);
  }
  writeReview({ pr: path.resolve(pos[0]), out: path.resolve(pos[1]), prJson: opt.pr, main: opt.main ? path.resolve(opt.main) : null,
    base: opt.base || null, diffs: !!opt.diffs, jobs: opt.jobs ? Number(opt.jobs) : undefined, budget: opt.budget ? Number(opt.budget) : undefined,
    interleaf: opt.interleaf, chromium: opt.chromium, timeout: opt.timeout ? Number(opt.timeout) : undefined })
    .then(function (r) {
      const c = function (k) { return r.boards.filter(function (b) { return b.change === k; }).length; };
      process.stdout.write('review #' + r.pr.number + ' ' + path.basename(pos[0]) + ': ' + c('changed') + ' changed, ' + c('added') + ' added, ' + c('removed') +
        ' removed' + (r.diffs ? ', differences in ' + Math.round(r.diffsMs / 100) / 10 + ' s' : '') + '\n');
    })
    .catch(function (e) { process.stderr.write('review: ' + String(e && e.stack || e) + '\n'); process.exit(1); });
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { CONTRACT: CONTRACT, DIFFS: DIFFS, boardLoads: boardLoads, boardHashes: boardHashes, sideHashes: sideHashes, compareDesigns: compareDesigns,
  diffMask: diffMask, regions: regions, boardCombos: boardCombos, comboId: comboId, renderDiffs: renderDiffs, readPr: readPr, writeReview: writeReview };
