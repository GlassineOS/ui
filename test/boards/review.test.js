// SPDX-License-Identifier: GPL-2.0-or-later
// The review of a proposal under plain node (no browser): what counts as added, changed and removed
// (a board's own file, a board it imports, a file it loads, by describe()'s hash), the "seen" marks
// of the review page, the regions of a known difference, and review.json as tools/site-designs writes it.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const R = require('../../boards/lib/review.js');
const { describe } = require('../../boards/lib/server.js');
const { exportDesign } = require('../../boards/lib/export.js');
const PNG = require('../../boards/lib/png.js');
const { Seen, boxes } = require('../../boards/preview/review.js');
const SAMPLES = path.join(ROOT, 'boards', 'samples');
const TMP = path.join(ROOT, 'out', 'test', 'boards-review');

function fresh(name) {
  const d = path.join(TMP, name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(d), { recursive: true });
  return d;
}
function copy(name) { const d = fresh(name); fs.cpSync(SAMPLES, d, { recursive: true }); return d; }
function edit(dir, file, fn) { const p = path.join(dir, file); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); }
function changes(mainDir, prDir) {
  const out = {};
  for (const b of R.compareDesigns(describe(mainDir), describe(prDir))) out[b.file] = b.change;
  return out;
}

test('review: identical designs give no change', () => {
  assert.deepStrictEqual(changes(copy('same-a'), copy('same-b')), {});
});

test('review: a board\'s own file, an import and a loaded file each mark the boards that use them', () => {
  const main = copy('main');
  // the samples: Main imports Card, sub/Nested imports sub/Badge; Main loads data/sample.js
  const imp = copy('import');
  edit(imp, 'Card.dc.html', (s) => s.replace('</x-dc>', '<span>new</span>\n</x-dc>'));
  const c1 = changes(main, imp);
  assert.strictEqual(c1['Card.dc.html'], 'changed');
  assert.strictEqual(c1['Main.dc.html'], 'changed', 'Main imports Card');
  assert.ok(!c1['Counter.dc.html'] && !c1['sub/Badge.dc.html'], JSON.stringify(c1));
  const load = copy('load');
  edit(load, 'data/sample.js', (s) => s + '\n// one more line\n');
  const loaders = describe(load).boards.filter((b) => b.exists && /data\/sample\.js/.test(fs.readFileSync(path.join(load, b.file), 'utf8'))).map((b) => b.file);
  assert.ok(loaders.length > 0, 'a sample loads data/sample.js');
  const c2 = changes(main, load);
  for (const f of loaders) assert.strictEqual(c2[f], 'changed', f + ' loads data/sample.js');
  // a stylesheet named in the helmet
  const css = copy('css');
  edit(css, 'Counter.dc.html', (s) => s.replace('<helmet>', '<helmet>\n<link rel="stylesheet" href="data/extra.css">'));
  const css2 = copy('css2');
  edit(css2, 'Counter.dc.html', (s) => s.replace('<helmet>', '<helmet>\n<link rel="stylesheet" href="data/extra.css">'));
  fs.writeFileSync(path.join(css, 'data/extra.css'), 'b { color: red }\n');
  fs.writeFileSync(path.join(css2, 'data/extra.css'), 'b { color: blue }\n');
  assert.deepStrictEqual(changes(css, css2), { 'Counter.dc.html': 'changed' });
});

test('review: added and removed boards, in the proposal\'s order then main\'s', () => {
  const main = copy('ar-main'), pr = copy('ar-pr');
  fs.copyFileSync(path.join(pr, 'Counter.dc.html'), path.join(pr, 'Extra.dc.html'));
  fs.rmSync(path.join(pr, 'Form.dc.html'));
  const m = describe(main), p = describe(pr);
  const list = R.compareDesigns(m, p);
  // Form stays on the proposal's canvas but is gone from disk (hash null): removed, not listed twice
  assert.deepStrictEqual(list.map((b) => b.file + ':' + b.change), ['Extra.dc.html:added', 'Form.dc.html:removed']);
  assert.strictEqual(list[1].hash, m.boards.find((b) => b.file === 'Form.dc.html').hash, 'a removed board carries main\'s hash');
  // a design the main line does not have: every board added
  const all = R.compareDesigns(null, p);
  assert.ok(all.length > 0 && all.every((b) => b.change === 'added'));
});

test('review: seen marks follow the board hash', () => {
  const boards = [{ file: 'a', hash: '1' }, { file: 'b', hash: '2' }, { file: 'c', hash: '3' }];
  let m = {};
  assert.strictEqual(Seen.status(m, boards[0]), 'unseen');
  m = Seen.mark(m, boards[0]);
  assert.strictEqual(Seen.status(m, boards[0]), 'seen');
  assert.strictEqual(Seen.status(m, { file: 'a', hash: '9' }), 'since', 'the board changed after it was marked');
  assert.deepStrictEqual(Seen.counts(boards, m), { total: 3, seen: 1, since: 0, unseen: 2 });
  assert.deepStrictEqual(Seen.counts([{ file: 'a', hash: '9' }, boards[1]], m), { total: 2, seen: 0, since: 1, unseen: 1 });
  assert.strictEqual(Seen.next(boards, m, 'a'), 'b');
  m = Seen.mark(m, boards[1]);
  assert.strictEqual(Seen.next(boards, m, 'a'), 'c');
  assert.strictEqual(Seen.next(boards, m, 'c'), null, 'everything else seen');
  assert.strictEqual(Seen.next([{ file: 'a', hash: '9' }, boards[1], boards[2]], m, 'c'), 'a', 'wraps round, a changed-since board counts as not seen');
  m = Seen.toggle(m, boards[0]);
  assert.strictEqual(Seen.status(m, boards[0]), 'unseen');
  assert.strictEqual(Seen.status(Seen.toggle(Seen.mark({}, { file: 'a', hash: '0' }), boards[0]), boards[0]), 'seen', 'toggling a changed-since board marks it');
  assert.strictEqual(Seen.key('/ui/designs/pr-47/shell/_boards/review.html'), 'boards.seen./ui/designs/pr-47/shell/');
  assert.strictEqual(Seen.key('/_boards/review.html'), 'boards.seen./');
  assert.deepStrictEqual(Seen.parse('{"a":"1","b":2}'), { a: '1' });
  for (const bad of [null, 'x', '[1]', '"s"']) assert.deepStrictEqual(Seen.parse(bad), {});
});

// an image of w × h, white, with the given rectangles black
function img(w, h, rects) {
  const data = Buffer.alloc(w * h * 4, 255);
  for (const [x0, y0, rw, rh] of rects || []) for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) { const i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  return { width: w, height: h, data: data };
}
// every differing pixel inside a region, every region holding one, the counts adding up
function covers(cmp, regs) {
  const mask = R.diffMask(cmp);
  let n = 0;
  for (let y = 0; y < cmp.height; y++) for (let x = 0; x < cmp.width; x++) {
    if (!mask[y * cmp.width + x]) continue;
    n++;
    assert.ok(regs.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height), 'pixel ' + x + ',' + y + ' in no region');
  }
  assert.strictEqual(n, cmp.differing);
  for (const r of regs) {
    let has = 0;
    for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) has += mask[y * cmp.width + x];
    assert.ok(has > 0, 'an empty region ' + JSON.stringify(r));
  }
  assert.strictEqual(regs.reduce((s, r) => s + r.pixels, 0), cmp.differing);
}

test('review: the regions of a known difference', () => {
  const a = img(200, 100), b = img(200, 100, [[10, 10, 5, 5], [14, 18, 3, 3], [150, 60, 20, 10]]);
  const cmp = PNG.compare(a, b, { threshold: 0 });
  const regs = R.regions(R.diffMask(cmp), cmp.width, cmp.height);
  // the two near squares are one region, the far one another
  assert.deepStrictEqual(regs.map((r) => [r.x, r.y, r.width, r.height, r.pixels]), [[10, 10, 7, 11, 34], [150, 60, 20, 10, 200]]);
  covers(cmp, regs);
  assert.deepStrictEqual(R.regions(R.diffMask(PNG.compare(a, a)), 200, 100), [], 'no difference, no region');
  // sizes differ: the area only one image has is a region too
  const c = PNG.compare(img(100, 50), img(100, 60, [[5, 5, 2, 2]]));
  const rc = R.regions(R.diffMask(c), c.width, c.height);
  covers(c, rc);
  assert.ok(rc.some((r) => r.y <= 50 && r.y + r.height === 60 && r.width === 100), JSON.stringify(rc));
  // scattered noise: at most max regions, still covering every pixel
  const dots = [];
  for (let i = 0; i < 40; i++) dots.push([(i * 37) % 190, (i * 53) % 90, 1, 1]);
  const n = PNG.compare(a, img(200, 100, dots));
  const rn = R.regions(R.diffMask(n), n.width, n.height, { max: 5 });
  assert.ok(rn.length <= 5, rn.length + ' regions');
  covers(n, rn);
  // boxes in percent, as the page draws them
  const bx = boxes({ width: 200, height: 100, regions: regs });
  assert.deepStrictEqual(bx.map((x) => [x.n, x.l, x.t, x.w, x.h]), [[1, 5, 10, 3.5, 11], [2, 75, 60, 10, 10]]);
});

test('review: the combinations of a changed board', () => {
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'combinations.json'), 'utf8')).combinations;
  const mk = (ids) => ({ states: ids.map((id) => ({ id: id, name: id, props: { s: id } })) });
  const c = R.boardCombos(all, mk(['on', 'off']), mk(['on', 'new']));
  assert.strictEqual(c.combos.length, 9 * 2, 'every voice × scheme at pen 1, default and the state both sides have');
  assert.ok(c.combos.every((x) => x.pen === 1));
  assert.deepStrictEqual(c.missing, ['new', 'off']);
  assert.ok(c.combos.slice(9).every((x) => x.state === 'on'));
  assert.strictEqual(R.comboId(c.combos[9]), 'white-paper-1@on');
  assert.strictEqual(R.boardCombos(all, {}, {}).combos.length, 9, 'no states');
});

test('review: review.json of a proposal export, without difference images', async () => {
  const main = copy('rj-main'), pr = copy('rj-pr');
  edit(pr, 'Card.dc.html', (s) => s.replace('</x-dc>', '<span>new</span>\n</x-dc>'));
  const out = fresh('rj-export');
  exportDesign({ design: pr, out: out });
  const meta = path.join(TMP, 'rj-pr.json');
  fs.writeFileSync(meta, JSON.stringify({ number: 7, title: 'A <b>title</b>', url: 'https://github.com/o/ui/pull/7', head: 'abc123zz', checks: 'weird' }));
  const r = await R.writeReview({ main: main, pr: pr, out: out, prJson: meta, base: '../../../samples/' });
  const got = JSON.parse(fs.readFileSync(path.join(out, '_boards', 'api', 'review.json'), 'utf8'));
  assert.deepStrictEqual(got, r);
  assert.deepStrictEqual(got.pr, { number: 7, title: 'A <b>title</b>', url: 'https://github.com/o/ui/pull/7', head: 'abc123' }, 'checks only passed or failed');
  assert.strictEqual(got.base, '../../../samples/');
  assert.strictEqual(got.diffs, null);
  assert.deepStrictEqual(got.boards.map((b) => b.file + ':' + b.change).sort(), ['Card.dc.html:changed', 'Main.dc.html:changed']);
  for (const b of got.boards) { assert.match(b.hash, /^[0-9a-f]{64}$/); assert.strictEqual(typeof b.issues, 'number'); }
  // no such design on the main line
  const r2 = await R.writeReview({ main: null, pr: pr, out: out, prJson: meta, base: '../../../samples/' });
  assert.strictEqual(r2.base, null);
  assert.ok(r2.boards.every((b) => b.change === 'added'));
  fs.writeFileSync(meta, JSON.stringify({ number: 7, url: 'javascript:alert(1)' }));
  assert.throws(() => R.readPr(meta), /https/);
});

test('export: ds/web at the top also when no board sits there', () => {
  const d = fresh('nested-only');
  fs.mkdirSync(path.join(d, 'sub'), { recursive: true });
  fs.copyFileSync(path.join(SAMPLES, 'sub', 'Badge.dc.html'), path.join(d, 'sub', 'Badge.dc.html'));
  const out = fresh('nested-only-export');
  exportDesign({ design: d, out: out });
  for (const f of ['ds/web/tokens.css', 'ds/web/bundle.css', 'sub/ds/web/tokens.css', '_boards/review.html', '_boards/review.js', '_boards/review.css']) {
    assert.ok(fs.statSync(path.join(out, f)).isFile(), f);
  }
});
