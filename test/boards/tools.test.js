// SPDX-License-Identifier: GPL-2.0-or-later
// The preview server and the import tool under plain node (no browser).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { startServer, describe, listBoards } = require('../../boards/lib/server.js');
const { importCanvas } = require('../../boards/lib/import.js');
const { needsNoSandbox } = require('../../boards/lib/browser.js');
const S = require('../../boards/lib/shot.js');
const { spawnSync } = require('child_process');
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

test('describe: dc-import cycles are named on the importing line', () => {
  const by = Object.fromEntries(describe(path.join(__dirname, 'unsupported')).boards.map((b) => [b.file, b.issues.filter((i) => i.feature === 'dc-import cycle')]));
  assert.deepStrictEqual(by['Self.dc.html'].map((i) => [i.line, i.detail]), [[11, 'Self.dc.html → Self.dc.html']]);
  assert.deepStrictEqual(by['Ping.dc.html'].map((i) => [i.line, i.detail]), [[11, 'Ping.dc.html → loop/Pong.dc.html → Ping.dc.html']]);
  assert.deepStrictEqual(by['loop/Pong.dc.html'].map((i) => [i.line, i.detail]), [[12, 'loop/Pong.dc.html → Ping.dc.html → loop/Pong.dc.html']]);
  assert.deepStrictEqual(by['Missing.dc.html'], []);
  assert.deepStrictEqual(by['Host.dc.html'], []);
});

test('listBoards: leaves out ds/ at any depth', () => {
  const dir = path.join(TMP, 'list');
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of ['A.dc.html', 'sub/B.dc.html', 'ds/X.dc.html', 'sub/ds/Y.dc.html', '.hidden/Z.dc.html']) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), '<html></html>');
  }
  assert.deepStrictEqual(listBoards(dir), ['A.dc.html', 'sub/B.dc.html']);
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

// GET with a given Host header, or none for null (fetch can't set one)
function getHost(url, host) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const o = host === null ? { setHost: false } : { headers: { host: host } };
    http.get(Object.assign({ host: u.hostname, port: u.port, path: u.pathname }, o), (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: body }));
    }).on('error', reject);
  });
}

test('server: links that leave the design folder or Interleaf are not followed', async () => {
  const base = path.join(TMP, 'serve-links'), design = path.join(base, 'design'), il = path.join(base, 'interleaf');
  fs.rmSync(base, { recursive: true, force: true });
  fs.mkdirSync(path.join(design, 'data'), { recursive: true });
  fs.mkdirSync(path.join(base, 'outside'));
  fs.mkdirSync(il);
  fs.writeFileSync(path.join(il, 'tokens.json'), '{"name":"t"}');
  fs.writeFileSync(path.join(base, 'secret.txt'), 'SECRET');
  fs.writeFileSync(path.join(base, 'outside', 'x.txt'), 'SECRET');
  fs.writeFileSync(path.join(design, 'A.txt'), 'inside');
  fs.symlinkSync('../secret.txt', path.join(design, 'link.txt'));
  fs.symlinkSync('../outside', path.join(design, 'dir'));
  fs.symlinkSync('../A.txt', path.join(design, 'data', 'same.txt'));
  fs.symlinkSync('../secret.txt', path.join(il, 'leak.json'));
  // the design folder itself may be a link
  fs.symlinkSync('design', path.join(base, 'design-link'));
  const srv = await startServer({ design: path.join(base, 'design-link'), interleaf: il, live: false });
  try {
    const get = async (p) => { const r = await fetch(srv.url + p); return { status: r.status, body: await r.text() }; };
    assert.deepStrictEqual(await get('A.txt'), { status: 200, body: 'inside' });
    assert.deepStrictEqual(await get('data/same.txt'), { status: 200, body: 'inside' });
    for (const p of ['link.txt', 'dir/x.txt', 'ds/interleaf/leak.json']) {
      const r = await get(p);
      assert.strictEqual(r.status, 404, p);
      assert.doesNotMatch(r.body, /SECRET/, p);
    }
  } finally { await srv.close(); }
});

test('server: answers only Host names it can trust (no DNS rebinding)', async () => {
  const srv = await startServer({ design: SAMPLES, interleaf: INTERLEAF, live: false });
  try {
    const u = srv.url + 'Main.dc.html';
    for (const h of ['127.0.0.1:' + srv.port, 'localhost:' + srv.port, 'localhost', '[::1]:' + srv.port, '192.168.1.20:' + srv.port]) {
      assert.strictEqual((await getHost(u, h)).status, 200, h);
    }
    for (const h of ['evil.example:' + srv.port, 'evil.example', '127.0.0.1@evil.example', null]) {
      const r = await getHost(u, h);
      // without a Host, node's own check answers 400 before ours
      assert.strictEqual(r.status, h === null ? 400 : 421, String(h));
      assert.doesNotMatch(r.body, /DCLogic/, String(h));
    }
    assert.strictEqual((await getHost(srv.url + '_boards/api/canvas', 'evil.example')).status, 421);
  } finally { await srv.close(); }
  const named = await startServer({ design: SAMPLES, interleaf: INTERLEAF, live: false, host: 'localhost' });
  try { assert.strictEqual((await getHost(named.url + 'Main.dc.html', 'LOCALHOST:' + named.port)).status, 200); } finally { await named.close(); }
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
  w('history/ds/interleaf/tokens.json', '{}');
  w('artifact-type/x.json', '{}');
  w('SKILL.md', '#');
  w('index.html', '<html></html>');
  w('support.js', '');
  const r = importCanvas(src, dest);
  assert.deepStrictEqual(r.copied.sort(), ['A.dc.html', 'canvas.json', 'data/fixtures.js', 'history/B.dc.html']);
  assert.deepStrictEqual(r.left.map((l) => l.path).sort(), ['SKILL.md', 'artifact-type/', 'canvas.json: designSystems', 'ds/', 'history/ds/', 'index.html', 'support.js']);
  const c = JSON.parse(fs.readFileSync(path.join(dest, 'canvas.json'), 'utf8'));
  assert.strictEqual(c.designSystems, undefined);
  assert.deepStrictEqual(c.boards, { 'A.dc.html': { x: 0 } });
  assert.throws(() => importCanvas(src, dest), /not empty/);
  assert.doesNotThrow(() => importCanvas(src, dest, { force: true }));
});

test('import: symbolic links are left out, never followed', () => {
  const base = path.join(TMP, 'links'), src = path.join(base, 'export'), dest = path.join(base, 'design');
  fs.rmSync(base, { recursive: true, force: true });
  fs.mkdirSync(path.join(src, 'data'), { recursive: true });
  fs.mkdirSync(path.join(base, 'outside'));
  fs.writeFileSync(path.join(base, 'secret.txt'), 'SECRET');
  fs.writeFileSync(path.join(base, 'outside', 'x.dc.html'), 'SECRET');
  fs.writeFileSync(path.join(src, 'canvas.json'), '{"boards":{}}');
  fs.writeFileSync(path.join(src, 'A.dc.html'), '<html></html>');
  fs.symlinkSync(path.join(base, 'secret.txt'), path.join(src, 'data', 'fixtures.js'));
  fs.symlinkSync('../outside', path.join(src, 'dir'));
  fs.symlinkSync('missing', path.join(src, 'dangling.js'));
  const r = importCanvas(src, dest);
  assert.deepStrictEqual(r.copied.sort(), ['A.dc.html', 'canvas.json']);
  assert.deepStrictEqual(r.left.filter((l) => /symbolic link/.test(l.why)).map((l) => l.path).sort(), ['dangling.js', 'data/fixtures.js', 'dir']);
  for (const p of ['data/fixtures.js', 'dir', 'dangling.js']) assert.ok(!fs.existsSync(path.join(dest, p)), p);
});
// a raw request, so Host and Origin can be set
function req(url, p, headers) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const r = http.request({ host: u.hostname, port: u.port, path: p, headers: Object.assign({ host: u.host }, headers || {}) }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    r.on('error', reject);
    r.end();
  });
}

function secDesign() {
  const root = path.join(TMP, 'sec'), design = path.join(root, 'design'), il = path.join(root, 'interleaf');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(design, '.git'), { recursive: true });
  fs.mkdirSync(il, { recursive: true });
  fs.copyFileSync(path.join(SAMPLES, 'Card.dc.html'), path.join(design, 'Card.dc.html'));
  fs.writeFileSync(path.join(design, '.env'), 'SECRET=1');
  fs.writeFileSync(path.join(design, '.git', 'config'), 'secret');
  fs.writeFileSync(path.join(root, 'outside.txt'), 'secret');
  fs.symlinkSync('../outside.txt', path.join(design, 'link.txt'));
  fs.symlinkSync('..', path.join(design, 'up'));
  fs.symlinkSync(path.join(design, 'Card.dc.html'), path.join(design, 'Linked.dc.html'));
  fs.copyFileSync(path.join(INTERLEAF, 'tokens.json'), path.join(il, 'tokens.json'));
  fs.symlinkSync('../outside.txt', path.join(il, 'link.json'));
  return { design, il };
}

test('server: no dotfiles; links that stay inside are served', async () => {
  const { design, il } = secDesign();
  const srv = await startServer({ design, interleaf: il, live: false });
  try {
    for (const p of ['/.env', '/.git/config', '/link.txt', '/up/outside.txt', '/ds/interleaf/link.json', '/_boards/.x', '/%2e%2e/outside.txt']) {
      const r = await req(srv.url, p);
      assert.strictEqual(r.status, 404, p);
      assert.doesNotMatch(r.body, /secret/i, p);
    }
    assert.strictEqual((await req(srv.url, '/Card.dc.html')).status, 200);
    // a link inside the folder may point inside it
    assert.strictEqual((await req(srv.url, '/Linked.dc.html')).status, 200);
    assert.deepStrictEqual(describe(design).boards.map((b) => b.file), ['Card.dc.html']);
  } finally { await srv.close(); }
});

test('server: Origin as Host, and names given with allowHosts', async () => {
  const srv = await startServer({ design: SAMPLES, interleaf: INTERLEAF, live: false, allowHosts: ['hub.example'] });
  try {
    const port = srv.port;
    assert.strictEqual((await req(srv.url, '/Main.dc.html', { host: 'evil.example:' + port })).status, 421);
    assert.strictEqual((await req(srv.url, '/Main.dc.html', { origin: 'http://evil.example:' + port })).status, 421);
    assert.strictEqual((await req(srv.url, '/Main.dc.html', { host: 'localhost:' + port })).status, 200);
    assert.strictEqual((await req(srv.url, '/Main.dc.html', { host: '127.0.0.1:' + port, origin: 'http://127.0.0.1:' + port })).status, 200);
    assert.strictEqual((await req(srv.url, '/Main.dc.html', { host: 'hub.example:' + port })).status, 200);
  } finally { await srv.close(); }
});

test('server: the default Interleaf is interleaf/ of this checkout', async () => {
  const srv = await startServer({ design: SAMPLES, live: false });
  try {
    assert.strictEqual(srv.interleaf, path.join(ROOT, 'interleaf'));
    assert.strictEqual((await req(srv.url, '/ds/interleaf/tokens.json')).body, fs.readFileSync(path.join(ROOT, 'interleaf', 'tokens.json'), 'utf8'));
    assert.strictEqual((await req(srv.url, '/sub/ds/interleaf/components/bundle.css')).status, 200);
  } finally { await srv.close(); }
});

test('import: an embedded ds/ is left out at any depth', () => {
  const root = path.join(TMP, 'nested-ds'), src = path.join(root, 'export'), dest = path.join(root, 'design');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.join(src, 'sub', 'ds', 'interleaf'), { recursive: true });
  fs.writeFileSync(path.join(src, 'canvas.json'), '{"v":3}');
  fs.writeFileSync(path.join(src, 'sub', 'A.dc.html'), '<html></html>');
  fs.writeFileSync(path.join(src, 'sub', 'ds', 'interleaf', 'tokens.json'), '{}');
  const r = importCanvas(src, dest);
  assert.deepStrictEqual(r.copied.sort(), ['canvas.json', 'sub/A.dc.html']);
  assert.ok(r.left.some((l) => l.path === 'sub/ds/'));
});

test('browser: Chromium keeps its sandbox unless root, in a container, or BOARDS_NO_SANDBOX=1', () => {
  assert.strictEqual(needsNoSandbox({}, false, false), false);
  assert.strictEqual(needsNoSandbox({}, true, false), true);
  assert.strictEqual(needsNoSandbox({}, false, true), true);
  assert.strictEqual(needsNoSandbox({ BOARDS_NO_SANDBOX: '1' }, false, false), true);
  assert.strictEqual(needsNoSandbox({ BOARDS_NO_SANDBOX: '0' }, false, false), false);
});

test('shot: the design folder is the nearest ancestor with a canvas, else the board\'s folder', () => {
  assert.strictEqual(S.designDirOf(path.join(SAMPLES, 'sub', 'Badge.dc.html')), SAMPLES);
  assert.strictEqual(S.designDirOf(path.join(__dirname, 'unsupported', 'Bad.dc.html')), path.join(__dirname, 'unsupported'));
});

test('shot: sizes', () => {
  assert.deepStrictEqual(S.parseSize('390x760'), { width: 390, height: 760 });
  for (const bad of ['390', '0x10', 'x', '-1x4', '12x']) assert.strictEqual(S.parseSize(bad), null, bad);
});

const CHOICES = S.validChoices(JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'combinations.json'), 'utf8')).combinations);

test('shot: the choices come from the web form', () => {
  assert.deepStrictEqual(CHOICES, { voice: ['white', 'editorial', 'stationery'], scheme: ['paper', 'night', 'eink'], pen: [1, 2, 3] });
});

test('shot: what the render uses, and what it names', () => {
  const props = { theme: { default: 'editorial' }, pen: { default: '2' } };
  // not asked for: stays out of the URL, named by the board's default, else the first combination
  let r = S.resolveChoices({}, props, CHOICES);
  assert.deepStrictEqual([r.voice, r.scheme, r.pen, r.asked, r.notApplied], ['editorial', 'paper', 2, {}, []]);
  r = S.resolveChoices({ voice: 'stationery', scheme: 'eink', pen: '3' }, props, CHOICES);
  assert.deepStrictEqual([r.voice, r.scheme, r.pen, r.asked], ['stationery', 'eink', 3, { voice: 'stationery', scheme: 'eink', pen: 3 }]);
  // asked for on a board that has no such prop: named, not an error
  assert.deepStrictEqual(r.notApplied, ['scheme']);
  assert.throws(() => S.resolveChoices({ voice: 'comic' }, {}, CHOICES), /unknown voice "comic": the voices are white, editorial, stationery/);
  assert.throws(() => S.resolveChoices({ pen: '9' }, {}, CHOICES), /unknown pen "9": the pens are 1, 2, 3/);
  assert.throws(() => S.resolveChoices({ scheme: 'neon' }, {}, CHOICES), /unknown scheme "neon"/);
});

test('shot: every kind of problem in one list, in the check report\'s form', () => {
  const r = { board: 'B.dc.html',
    errors: [{ board: 'B.dc.html', kind: 'script', feature: 'f', detail: '', line: 3, message: 'm' }],
    unsupported: [{ board: 'B.dc.html', kind: 'unsupported', feature: 'element', detail: 'x', line: 4, message: '' }],
    console: [{ text: 'boom', url: 'u', line: 5 }], requests: [{ url: 'http://x/a', error: 'HTTP 404' }],
    external: [{ url: 'https://elsewhere/', error: 'blocked: no network in renders' }] };
  const all = S.flatErrors(r);
  assert.deepStrictEqual(all.map((e) => e.kind), ['script', 'unsupported', 'console', 'request', 'external']);
  for (const e of all) assert.deepStrictEqual(['board', 'detail', 'feature', 'kind', 'line', 'message'].filter((k) => !(k in e)), []);
  assert.strictEqual(all[4].url, 'https://elsewhere/');
});

test('shots: from a change to the boards to render', () => {
  const root = path.join(TMP, 'changed');
  fs.rmSync(root, { recursive: true, force: true });
  for (const f of ['designs/a/One.dc.html', 'designs/a/sub/Two.dc.html', 'designs/a/canvas.json', 'designs/b/Three.dc.html', 'designs/b/ds/X.dc.html']) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    fs.writeFileSync(path.join(root, f), '<html></html>');
  }
  assert.deepStrictEqual(S.changedBoards(['designs/a/sub/Two.dc.html', 'README.md', 'designs/README.md', ''], root), ['designs/a/sub/Two.dc.html']);
  // a deleted board is not rendered; the canvas (or fonts, data) means the whole folder
  assert.deepStrictEqual(S.changedBoards(['designs/a/Gone.dc.html'], root), []);
  assert.deepStrictEqual(S.changedBoards(['designs/a/canvas.json'], root), ['designs/a/One.dc.html', 'designs/a/sub/Two.dc.html']);
  assert.deepStrictEqual(S.changedBoards(['designs/b/fonts/x.woff2', 'designs/a/One.dc.html'], root), ['designs/a/One.dc.html', 'designs/b/Three.dc.html']);
  // a design folder that is gone, and ds/ (never a board)
  assert.deepStrictEqual(S.changedBoards(['designs/c/canvas.json', 'designs/b/ds/X.dc.html'], root), []);
});

test('shot: usage errors exit 2 before any browser, naming the fault', () => {
  const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/boards'), 'shot', ...a], { cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, { CHROMIUM: '/nonexistent' }) });
  const main = path.join(SAMPLES, 'Main.dc.html');
  let r = run(main, '--voice', 'comic');
  assert.strictEqual(r.status, 2, r.stderr);
  assert.match(r.stderr, /unknown voice "comic": the voices are white, editorial, stationery/);
  assert.strictEqual(r.stdout, '');
  r = run(main, '--size', 'big');
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /--size is WIDTHxHEIGHT/);
  r = run(path.join(SAMPLES, 'Nope.dc.html'));
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /no board at/);
  r = run(path.join(SAMPLES, 'canvas.json'));
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /is not a board/);
  r = run();
  assert.strictEqual(r.status, 2);
});
