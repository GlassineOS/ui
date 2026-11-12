// SPDX-License-Identifier: GPL-2.0-or-later
// The live picture (boards stream, spec 003 FR-013) in a browser: frames, the state, opening a board,
// pointer and keys, a saved board reaching the picture, and what it refuses. A frame of a board is the
// same pixels as a shot of it. Needs Chromium: tools/in-alpine node test/boards/stream-e2e.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { startStream } = require(path.join(ROOT, 'boards/lib/stream.js'));
const { shootBoard } = require(path.join(ROOT, 'boards/lib/shot.js'));
const { startServer } = require(path.join(ROOT, 'boards/lib/server.js'));
const { openBrowser, renderBoard } = require(path.join(ROOT, 'boards/lib/browser.js'));
const PNG = require(path.join(ROOT, 'boards/lib/png.js'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a stream with its events kept, and waits on them
async function open(design, opts) {
  const events = [];
  const waiters = [];
  const st = await startStream(Object.assign({ design: design, onEvent: function (e) {
    const kept = Object.assign({ at: Date.now() }, e);
    events.push(kept);
    for (const w of waiters.slice()) if (w.fn(kept)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(kept); }
  } }, opts || {}));
  st.events = events;
  st.next = function (fn, ms, what) {
    return new Promise(function (resolve, reject) {
      const w = { fn: fn, resolve: function (e) { clearTimeout(t); resolve(e); } };
      const t = setTimeout(function () { waiters.splice(waiters.indexOf(w), 1); reject(new Error('timed out waiting for ' + what)); }, ms || 15000);
      waiters.push(w);
    });
  };
  // the last frame once none has come for quietMs
  st.quiet = async function (quietMs) {
    for (let i = 0; i < 100; i++) {
      const f = events.filter((e) => e.ev === 'frame').pop();
      if (f && Date.now() - f.at >= quietMs) return f;
      await sleep(50);
    }
    throw new Error('the picture never settled');
  };
  return st;
}
const lastState = (st) => st.events.filter((e) => e.ev === 'state').pop();
function pixels(b64) { return PNG.decode(Buffer.from(b64, 'base64')); }

async function main() {
  let failures = 0;
  const test = async (name, fn) => {
    try { await fn(); process.stdout.write('ok - ' + name + '\n'); } catch (e) { failures++; process.stdout.write('not ok - ' + name + '\n  ' + String(e && e.stack || e).split('\n').join('\n  ') + '\n'); }
  };
  const SAMPLES = path.join(ROOT, 'boards/samples');
  const st = await open(SAMPLES, { width: 900, height: 600 });
  try {
    await test('ready, then the canvas as a frame and a state', async () => {
      assert.ok(st.events.some((e) => e.ev === 'ready'));
      await st.next((e) => e.ev === 'frame', 15000, 'a frame');
      await st.next(() => lastState(st) && lastState(st).view === 'canvas', 5000, 'the canvas state').catch(() => {});
      const s = lastState(st);
      assert.strictEqual(s.view, 'canvas', JSON.stringify(s));
      assert.deepStrictEqual([s.width, s.height], [900, 600]);
    });

    await test('open: one board at its size, in a voice; a frame is the same pixels as a shot', async () => {
      await st.send({ op: 'open', board: 'Main.dc.html', voice: 'stationery', scheme: 'eink', width: 640, height: 480 });
      const s = lastState(st);
      assert.deepStrictEqual([s.view, s.board, s.voice, s.scheme, s.width, s.height], ['board', 'Main.dc.html', 'stationery', 'eink', 640, 480], JSON.stringify(s));
      await sleep(1500);
      const f = await st.quiet(700);
      assert.deepStrictEqual([f.width, f.height], [640, 480]);
      const out = path.join(os.tmpdir(), 'stream-shot-' + process.pid + '.png');
      const rep = await shootBoard({ board: path.join(SAMPLES, 'Main.dc.html'), voice: 'stationery', scheme: 'eink', size: { width: 640, height: 480 }, out: out });
      assert.ok(rep.ok, JSON.stringify(rep.errors));
      const a = pixels(f.png), b = PNG.decode(fs.readFileSync(out));
      fs.rmSync(out, { force: true });
      assert.deepStrictEqual([a.width, a.height], [b.width, b.height]);
      let diff = 0;
      for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++;
      assert.strictEqual(diff, 0, diff + ' channel values differ from the shot');
    });

    await test('a click and keys reach the board; the change is a frame within half a second', async () => {
      // where the controls are, from a render of the same board at the same size
      const srv = await startServer({ design: SAMPLES, live: false });
      const browser = await openBrowser();
      let box, name;
      try {
        const r = await renderBoard(browser, srv.url, 'Form.dc.html', { width: 600, height: 500, keepPage: true });
        box = await r.page.$eval('#agree', (e) => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
        name = await r.page.$eval('#name', (e) => { const b = e.getBoundingClientRect(); return { x: b.x + 10, y: b.y + b.height / 2 }; });
        await r.page.close();
      } finally { await browser.close(); await srv.close(); }
      await st.send({ op: 'open', board: 'Form.dc.html', width: 600, height: 500 });
      await sleep(1200);
      const before = await st.quiet(500);
      const t0 = Date.now();
      st.send({ op: 'mouse', type: 'mousePressed', x: box.x, y: box.y });
      st.send({ op: 'mouse', type: 'mouseReleased', x: box.x, y: box.y });
      const after = await st.next((e) => e.ev === 'frame' && e.png !== before.png, 3000, 'the changed frame');
      const ms = after.at - t0;
      process.stdout.write('  click → frame: ' + ms + ' ms\n');
      assert.ok(ms < 500, 'click → frame took ' + ms + ' ms');
      // keys: a click into the field, then typing; the picture changes
      st.send({ op: 'mouse', type: 'mousePressed', x: name.x, y: name.y });
      await st.send({ op: 'mouse', type: 'mouseReleased', x: name.x, y: name.y });
      const typed = await st.quiet(400);
      await st.send({ op: 'key', type: 'keyDown', key: 'q', code: 'KeyQ', text: 'q' });
      await st.send({ op: 'key', type: 'keyUp', key: 'q', code: 'KeyQ' });
      await st.next((e) => e.ev === 'frame' && e.png !== typed.png, 3000, 'the typed frame');
    });

    await test('wheel, touch, viewport and a forced frame', async () => {
      await st.send({ op: 'wheel', x: 100, y: 100, deltaY: 120 });
      await st.send({ op: 'touch', type: 'touchStart', points: [{ x: 50, y: 50 }] });
      await st.send({ op: 'touch', type: 'touchEnd', points: [] });
      await st.send({ op: 'viewport', width: 320, height: 240 });
      const n = st.events.length;
      await st.send({ op: 'frame' });
      const f = st.events.slice(n).find((e) => e.ev === 'frame');
      assert.deepStrictEqual([f.width, f.height], [320, 240]);
      assert.strictEqual(lastState(st).width, 320);
    });

    await test('refused: unknown commands, boards outside the design, bad values', async () => {
      const n = st.events.length;
      await st.send({ op: 'eval', code: '1' });
      await st.send({ op: 'open', board: '../package.json' });
      await st.send({ op: 'open', board: 'Main.dc.html', voice: 'neon' });
      await st.send({ op: 'mouse', type: 'mousePressed', x: 'a', y: 1 });
      await st.send({ op: 'viewport', width: 100000, height: 10 });
      const errs = st.events.slice(n).filter((e) => e.ev === 'error').map((e) => e.message);
      assert.strictEqual(errs.length, 5, JSON.stringify(errs));
      assert.match(errs[0], /unknown command/);
      assert.match(errs[1], /no board/);
      assert.match(errs[2], /unknown voice/);
    });
  } finally { await st.close(); }

  await test('a saved board reaches the picture within two seconds', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stream-live-'));
    fs.cpSync(SAMPLES, tmp, { recursive: true });
    const s2 = await open(tmp, { width: 600, height: 400 });
    try {
      await s2.send({ op: 'open', board: 'Card.dc.html', width: 600, height: 400 });
      await sleep(1200);
      const before = await s2.quiet(500);
      const f = path.join(tmp, 'Card.dc.html');
      const t0 = Date.now();
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('</body>', '<p style="font-size:40px">saved</p></body>'));
      const after = await s2.next((e) => e.ev === 'frame' && e.png !== before.png, 5000, 'the saved frame');
      process.stdout.write('  save → frame: ' + (after.at - t0) + ' ms\n');
      assert.ok(after.at - t0 < 2000, 'save → frame took ' + (after.at - t0) + ' ms');
    } finally { await s2.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
  });

  await test('a board asking for another site: refused and said', async () => {
    const s3 = await open(path.join(__dirname, 'offline'), { width: 400, height: 300 });
    try {
      await s3.send({ op: 'open', board: 'Net.dc.html' });
      await s3.next((e) => e.ev === 'blocked', 10000, 'a blocked request');
    } finally { await s3.close(); }
  });

  process.stdout.write(failures ? failures + ' failed\n' : 'all passed\n');
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exitCode = 2; });
