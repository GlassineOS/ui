// SPDX-License-Identifier: GPL-2.0-or-later
// The preview server and the import tool under plain node (no browser).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { startServer, describe } = require('../../boards/lib/server.js');
const { importCanvas } = require('../../boards/lib/import.js');
const SAMPLES = path.join(ROOT, 'boards', 'samples');
const INTERLEAF = path.join(__dirname, 'fixtures', 'interleaf');
const TMP = path.join(ROOT, 'out', 'test', 'boards');

test('describe: canvas entries, data-props, sizes', () => {
  const d = describe(SAMPLES);
  assert.strictEqual(d.subset, 1);
  assert.deepStrictEqual(d.boards.map((b) => b.file), ['Main.dc.html', 'Counter.dc.html', 'Form.dc.html', 'Card.dc.html', 'sub/Nested.dc.html', 'sub/Badge.dc.html']);
  const main = d.boards[0];
  assert.strictEqual(main.interactive, true);
  assert.deepStrictEqual(main.size, { width: 900, height: 760 });
  assert.strictEqual(main.props.voice.editor, 'enum');
  assert.ok(d.boards.every((b) => b.exists && b.onCanvas && !b.issues.length));
});

test('server: runtime at any support.js, Interleaf from the checkout, design files, canvas API', async () => {
  const srv = await startServer({ design: SAMPLES, interleaf: INTERLEAF, live: false });
  try {
    const get = (p) => fetch(srv.url + p.replace(/^\//, ''));
    for (const p of ['support.js', 'sub/support.js']) {
      const r = await get(p);
      assert.strictEqual(r.status, 200);
      const t = await r.text();
      assert.match(t, /window\.__BOARDS_CONFIG = \{"live":false/);
      assert.match(t, /BoardsTemplate/);
      assert.doesNotMatch(t, /sourceMappingURL/);
    }
    for (const p of ['ds/interleaf/tokens.json', 'sub/ds/interleaf/tokens.json']) {
      assert.strictEqual((await (await get(p)).json()).name, JSON.parse(fs.readFileSync(path.join(INTERLEAF, 'tokens.json'), 'utf8')).name);
    }
    assert.match(await (await get('Main.dc.html')).text(), /class Component extends DCLogic/);
    assert.strictEqual((await get('data/sample.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.strictEqual((await get('%2e%2e/%2e%2e/LICENSE')).status, 404);
    assert.strictEqual((await get('ds/interleaf/..%2f..%2fLICENSE')).status, 404);
    const c = await (await get('_boards/api/canvas')).json();
    assert.strictEqual(c.boards.length, 6);
    assert.strictEqual((await get('_boards/')).status, 200);
    assert.strictEqual((await get('_boards/events')).status, 404);
  } finally { await srv.close(); }
});

test('server: a NUL byte in the path is refused and the server stays up', async () => {
  const srv = await startServer({ design: SAMPLES, interleaf: INTERLEAF, live: false });
  try {
    for (const p of ['A%00.dc.html', 'a%00b', '_boards/x%00.js', 'ds/interleaf/tokens%00.json', 'sub/ds/interleaf/%00']) {
      assert.strictEqual((await fetch(srv.url + p)).status, 400, p);
    }
    assert.strictEqual((await fetch(srv.url + 'Main.dc.html')).status, 200);
  } finally { await srv.close(); }
});

test('server: refuses a missing Interleaf', async () => {
  await assert.rejects(async () => startServer({ design: SAMPLES, interleaf: path.join(TMP, 'none') }), /no Interleaf/);
});

test('server: binds to 127.0.0.1 by default', async () => {
  const srv = await startServer({ design: SAMPLES, interleaf: INTERLEAF, live: false });
  try { assert.match(srv.url, /^http:\/\/127\.0\.0\.1:\d+\/$/); } finally { await srv.close(); }
});

test('import: leaves out claude.ai files and the embedded ds/, drops designSystems', () => {
  const src = path.join(TMP, 'export'), dest = path.join(TMP, 'design');
  fs.rmSync(TMP, { recursive: true, force: true });
  const w = (p, s) => { fs.mkdirSync(path.dirname(path.join(src, p)), { recursive: true }); fs.writeFileSync(path.join(src, p), s); };
  w('canvas.json', JSON.stringify({ v: 3, title: 'X', boards: { 'A.dc.html': { x: 0 } }, designSystems: [{ title: 'Interleaf' }] }));
  w('A.dc.html', '<html></html>');
  w('history/B.dc.html', '<html></html>');
  w('data/fixtures.js', 'window.X = 1;');
  w('ds/interleaf/tokens.json', '{}');
  w('artifact-type/x.json', '{}');
  w('SKILL.md', '#');
  w('index.html', '<html></html>');
  w('support.js', '');
  const r = importCanvas(src, dest);
  assert.deepStrictEqual(r.copied.sort(), ['A.dc.html', 'canvas.json', 'data/fixtures.js', 'history/B.dc.html']);
  assert.deepStrictEqual(r.left.map((l) => l.path).sort(), ['SKILL.md', 'artifact-type/', 'canvas.json: designSystems', 'ds/', 'index.html', 'support.js']);
  const c = JSON.parse(fs.readFileSync(path.join(dest, 'canvas.json'), 'utf8'));
  assert.strictEqual(c.designSystems, undefined);
  assert.deepStrictEqual(c.boards, { 'A.dc.html': { x: 0 } });
  assert.throws(() => importCanvas(src, dest), /not empty/);
  assert.doesNotThrow(() => importCanvas(src, dest, { force: true }));
});
