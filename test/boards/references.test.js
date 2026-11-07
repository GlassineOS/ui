// SPDX-License-Identifier: GPL-2.0-or-later
// The reference checks under plain node (no browser): PNG, the comparison, the store and its
// report, the combinations, the font answers, the preview page.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..', '..');
const PNG = require('../../boards/lib/png.js');
const R = require('../../boards/lib/references.js');
const { fontFaces, googleFamilies, pool } = require('../../boards/lib/browser.js');
const { previewPage, components } = require('../../boards/lib/previews.js');
const TMP = path.join(ROOT, 'out', 'test', 'references');

function image(w, h, fn) {
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y), o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  return { width: w, height: h, data: data };
}
const grey = image(7, 5, (x, y) => [x * 30, x * 30, x * 30]);
const few = image(9, 4, (x, y) => [x % 3 * 100, y * 50, 7]);
const many = image(40, 20, (x, y) => [x * 6, y * 12, (x * y) % 256]);

test('png: encode then decode gives the pixels back, grey, palette and RGB', () => {
  for (const [img, type] of [[grey, 0], [few, 3], [many, 2]]) {
    const buf = PNG.encode(img);
    assert.strictEqual(buf[25], type, 'colour type');
    assert.ok(PNG.decode(buf).data.equals(img.data));
    assert.ok(PNG.encode(PNG.decode(buf)).equals(buf), 'the same pixels give the same bytes');
  }
});

test('png: decodes 8-bit RGBA (as Chromium writes it)', () => {
  const w = 5, h = 5, rows = [];
  const px = (x, y) => [x * 40, y * 40, 200, 255];
  for (let y = 0; y < h; y++) {
    // filter 0 on every row; filters 1..4 are covered by encode()'s own output above
    rows.push(Buffer.from([0].concat(...Array.from({ length: w }, (_, x) => px(x, y)))));
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const chunk = (n, b) => { const l = Buffer.alloc(4); l.writeUInt32BE(b.length); return Buffer.concat([l, Buffer.from(n), b, Buffer.alloc(4)]); };
  const buf = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  const img = PNG.decode(buf);
  assert.deepStrictEqual([img.width, img.height, ...img.data.subarray(4 * 6, 4 * 7)], [5, 5, 40, 40, 200, 255]);
  assert.throws(() => PNG.decode(Buffer.from('nope')), /not a PNG/);
});

test('compare: counts, the largest difference, the box, the threshold, other sizes', () => {
  const b = image(7, 5, (x, y) => (x === 2 && y === 3) || (x === 5 && y === 1) ? [x * 30 + 3, x * 30, x * 30] : [x * 30, x * 30, x * 30]);
  let c = PNG.compare(grey, b);
  assert.deepStrictEqual([c.differing, c.maxDelta, c.box, c.sameSize], [2, 3, { x: 2, y: 1, width: 4, height: 3 }, true]);
  assert.deepStrictEqual(Array.from(c.diff.data.subarray((3 * 7 + 2) * 4, (3 * 7 + 2) * 4 + 3)), [255, 0, 0]);
  assert.strictEqual(PNG.compare(grey, b, { threshold: 3 }).differing, 0);
  c = PNG.compare(grey, image(7, 6, (x) => [x * 30, x * 30, x * 30]));
  assert.deepStrictEqual([c.sameSize, c.differing, c.height], [false, 7, 6]);
});

// a run over fake renders: case id → image (or null: an error)
function run(refs, renders, extra) {
  const cases = Object.keys(renders).map((id) => ({ id: id, component: id.split('/')[0] }));
  return R.runCases(Object.assign({ cases: cases, refs: refs, out: path.join(refs, '..', 'out'), kind: 'test', chromium: '1.2.3', jobs: 2, pool: pool,
    render: async (c) => renders[c.id] ? { png: PNG.encode(renders[c.id]), errors: [] } : { png: null, errors: [{ kind: 'render', message: 'boom' }] } }, extra));
}

test('runCases: update, pass, differs, stale, no reference, errors, Chromium', async () => {
  const dir = path.join(TMP, 'store');
  fs.rmSync(path.join(TMP), { recursive: true, force: true });
  const refs = path.join(dir, 'refs');
  let rep = await run(refs, { 'A/1': grey, 'A/2': grey, 'B/1': many }, { update: true });
  assert.deepStrictEqual([rep.summary.updated, rep.summary.ok], [3, true]);
  const idx = JSON.parse(fs.readFileSync(path.join(refs, 'index.json'), 'utf8'));
  assert.strictEqual(idx.cases['A/1'].file, idx.cases['A/2'].file, 'identical renders are stored once');
  assert.deepStrictEqual([idx.chromium, idx.kind, fs.readdirSync(refs).length], ['1.2.3', 'test', 3]);

  rep = await run(refs, { 'A/1': grey, 'A/2': grey, 'B/1': many });
  assert.deepStrictEqual([rep.summary.pass, rep.summary.ok], [3, true]);

  const changed = image(40, 20, (x, y) => x === 0 && y === 0 ? [1, 2, 3] : [x * 6, y * 12, (x * y) % 256]);
  rep = await run(refs, { 'A/1': grey, 'B/1': changed, 'C/1': few, 'D/1': null });
  const by = Object.fromEntries(rep.cases.map((c) => [c.case, c]));
  assert.deepStrictEqual([by['A/1'].status, by['B/1'].status, by['C/1'].status, by['D/1'].status], ['pass', 'differs', 'no reference', 'error']);
  assert.strictEqual(by['B/1'].differing, 1);
  assert.ok(fs.existsSync(by['B/1'].diff) && fs.existsSync(by['B/1'].actual) && fs.existsSync(by['C/1'].actual));
  assert.strictEqual(by['A/1'].component, 'A', 'the case fields are in the result');
  assert.deepStrictEqual(rep.stale, ['A/2']);
  assert.strictEqual(rep.summary.ok, false);

  // a filtered run can't tell stale references
  rep = await run(refs, { 'A/1': grey }, { only: true });
  assert.deepStrictEqual([rep.stale, rep.summary.ok], [[], true]);

  rep = await run(refs, { 'A/1': grey, 'A/2': grey, 'B/1': many }, { chromium: '9.9.9' });
  assert.deepStrictEqual([rep.summary.pass, rep.summary.chromiumMismatch, rep.summary.ok], [3, true, false]);
  await assert.rejects(run(refs, { 'A/1': grey }, { chromium: '9.9.9', update: true, only: true }), /update them all/);

  // a full update drops the stale and the unused images, keeps a failed render's old reference out
  rep = await run(refs, { 'A/1': grey, 'B/1': changed, 'D/1': null }, { update: true, chromium: '9.9.9' });
  const after = JSON.parse(fs.readFileSync(path.join(refs, 'index.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(after.cases), ['A/1', 'B/1']);
  assert.deepStrictEqual([after.chromium, fs.readdirSync(refs).length, rep.summary.errors, rep.summary.ok], ['9.9.9', 3, 1, false]);
  assert.match(R.textSummary(rep, 't'), /ERROR D\/1[\s\S]*boom/);
});

test('combinations: own, all, by name, with props; mistakes are named', () => {
  const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'combinations.json'), 'utf8')).combinations;
  assert.strictEqual(R.expandCombinations(['all'], all, 'x').length, 27);
  assert.deepStrictEqual(R.expandCombinations(['own', 'stationery-eink-2', { name: 'big', voice: 'white', props: { n: 3 } }], all, 'x'),
    [{ name: 'own' }, { name: 'stationery-eink-2', voice: 'stationery', scheme: 'eink', pen: 2 }, { name: 'big', voice: 'white', scheme: undefined, pen: undefined, props: { n: 3 } }]);
  assert.throws(() => R.expandCombinations(['white-eink-4'], all, 'B'), /B: no combination "white-eink-4"/);
  assert.throws(() => R.expandCombinations([{ voice: 'white', props: {} }], all, 'B'), /needs a "name"/);
  assert.throws(() => R.expandCombinations(['own', 'own'], all, 'B'), /twice/);
  const dir = path.join(TMP, 'cfg');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'references.json'), '{"combos": []}');
  assert.throws(() => R.readConfig(dir), /unknown key "combos"/);
});

test('fonts: Google Fonts stylesheets answered from the vendored faces', () => {
  assert.deepStrictEqual(googleFamilies('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Kalam&display=swap'), ['IBM Plex Mono', 'Kalam']);
  assert.deepStrictEqual(googleFamilies('https://fonts.googleapis.com/css?family=EB+Garamond:400|Kalam'), ['EB Garamond', 'Kalam']);
  assert.strictEqual(googleFamilies('https://example.org/css2?family=Kalam'), null);
  const faces = R.vendoredFaces('http://127.0.0.1:1/', path.join(ROOT, 'interleaf'), ROOT, null);
  assert.deepStrictEqual(Array.from(faces.keys()).sort(), ['EB Garamond', 'IBM Plex Mono', 'IBM Plex Sans', 'Kalam', 'Source Serif 4']);
  assert.match(faces.get('Kalam')[0], /url\("http:\/\/127\.0\.0\.1:1\/_boards\/fonts\/kalam\/Kalam-Regular\.woff2"\)/);
  const f = fontFaces('/* x */ @font-face { font-family: \'Icons\'; src: url(i/icons.woff2) format("woff2"); }', 'http://h/d/fonts/');
  assert.match(f.get('Icons')[0], /url\("http:\/\/h\/d\/fonts\/i\/icons\.woff2"\)/);
});

test('previews: every component, the web form and the combination on the page', () => {
  assert.strictEqual(components(ROOT).length, 13);
  const html = previewPage(ROOT, 'Table', { 'data-theme': 'stationery-eink', 'data-pen': '2' });
  assert.match(html, /<html[^>]* data-theme="stationery-eink" data-pen="2"/);
  assert.match(html, /<head>\n<link rel="stylesheet" href="\/web\/tokens.css">\n<link rel="stylesheet" href="\/web\/bundle.css">/);
});

test('the component references cover every case, from the pinned Chromium', () => {
  const idx = JSON.parse(fs.readFileSync(path.join(ROOT, 'test', 'references', 'components', 'index.json'), 'utf8'));
  assert.strictEqual(Object.keys(idx.cases).length, 13 * 27 * 2);
  assert.strictEqual(idx.chromium, fs.readFileSync(path.join(ROOT, 'tools', 'chromium.pin'), 'utf8').trim().replace(/-r\d+$/, ''));
  for (const c of Object.values(idx.cases)) assert.ok(fs.existsSync(path.join(ROOT, 'test', 'references', 'components', c.file)), c.file);
});
