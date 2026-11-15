// SPDX-License-Identifier: GPL-2.0-or-later
// Named states in a browser (spec 003 FR-050, FR-011, FR-014): ?state=ID applied by the runtime, an
// unknown id reported, the check rendering every state, shot --state. Needs Chromium:
// tools/in-alpine node test/boards/states-e2e.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const { startServer } = require(path.join(ROOT, 'boards/lib/server.js'));
const { openBrowser, renderBoard } = require(path.join(ROOT, 'boards/lib/browser.js'));
const { checkDesign } = require(path.join(ROOT, 'boards/lib/check.js'));
const { shootBoard } = require(path.join(ROOT, 'boards/lib/shot.js'));
const SAMPLES = path.join(ROOT, 'boards/samples');
const BOARD = path.join(SAMPLES, 'States.dc.html');

async function main() {
  let failures = 0;
  const LIMIT = Number(process.env.E2E_TEST_TIMEOUT) || 180000;
  const test = async (name, fn) => {
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out after ' + LIMIT + ' ms')), LIMIT); });
    try { await Promise.race([fn(), deadline]); process.stdout.write('ok - ' + name + '\n'); } catch (e) { failures++; process.stdout.write('not ok - ' + name + '\n  ' + String(e && e.stack || e).split('\n').join('\n  ') + '\n'); } finally { clearTimeout(timer); }
  };

  const srv = await startServer({ design: SAMPLES, live: false });
  const browser = await openBrowser();
  try {
    const open = async (opts) => {
      const r = await renderBoard(browser, srv.url, 'States.dc.html', Object.assign({ width: 420, height: 240, keepPage: true }, opts));
      try {
        const st = await r.page.evaluate(() => ({ bt: document.querySelector('#bt').textContent, data: document.querySelector('#states').getAttribute('data-bt'),
          paired: document.querySelector('#paired') ? document.querySelector('#paired').textContent : null, state: window.__boards.state, errors: window.__boards.errors }));
        return Object.assign(st, { ok: r.ok, url: r.url });
      } finally { await r.page.close(); }
    };

    await test('the runtime applies ?state=ID over the defaults; p.NAME wins over the state', async () => {
      let s = await open({});
      assert.deepStrictEqual([s.ok, s.bt, s.paired, s.state], [true, 'Off', null, null], JSON.stringify(s));
      s = await open({ state: 'scanning' });
      assert.match(s.url, /\?state=scanning$/);
      assert.deepStrictEqual([s.ok, s.bt, s.data, s.state], [true, 'Scanning', 'scan', 'scanning'], JSON.stringify(s));
      s = await open({ state: 'connected' });
      assert.deepStrictEqual([s.ok, s.bt, s.paired], [true, 'On', 'Keyboard K380'], JSON.stringify(s));
      s = await open({ state: 'connected', props: { paired: 'Mouse' } });
      assert.deepStrictEqual([s.ok, s.bt, s.paired], [true, 'On', 'Mouse'], JSON.stringify(s));
    });

    await test('an unknown state is an error of the board; it renders with its defaults', async () => {
      const s = await open({ state: 'nope' });
      assert.strictEqual(s.ok, false);
      assert.strictEqual(s.bt, 'Off');
      assert.strictEqual(s.state, null);
      assert.deepStrictEqual(s.errors.map((e) => [e.board, e.kind, e.feature, e.detail]), [['States.dc.html', 'state', 'unknown state', 'nope']]);
      assert.match(s.errors[0].message, /the states are off, on, scanning, connected/);
    });

    await test('links to other boards carry voice, scheme and pen, not the state', async () => {
      const p = await browser.newPage();
      try {
        await p.goto(srv.url + 'States.dc.html?state=connected&voice=editorial', { waitUntil: 'load' });
        await p.waitForFunction('window.__boards && window.__boards.settled', { polling: 100 });
        await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), p.click('#to-counter')]);
        assert.match(p.url(), /\/Counter\.dc\.html\?voice=editorial$/);
      } finally { await p.close(); }
    });

    await test('check: every board once and once per named state', async () => {
      const rep = await checkDesign({ design: SAMPLES });
      assert.strictEqual(rep.summary.failing, 0, JSON.stringify(rep.boards.filter((b) => !b.ok), null, 1));
      assert.strictEqual(rep.summary.boards, 7);
      assert.strictEqual(rep.summary.renders, 11);
      assert.deepStrictEqual(rep.boards.filter((b) => b.board === 'States.dc.html').map((b) => b.state), [null, 'off', 'on', 'scanning', 'connected']);
      assert.ok(rep.boards.filter((b) => b.board !== 'States.dc.html').every((b) => b.state === null));
    });

    await test('shot --state: the state rendered, named in the report and the image name', async () => {
      const dir = path.join(ROOT, 'out', 'test', 'boards-states-shot');
      fs.rmSync(dir, { recursive: true, force: true });
      const plain = await shootBoard({ board: BOARD, out: path.join(dir, 'plain.png') });
      const scan = await shootBoard({ board: BOARD, state: 'scanning', out: path.join(dir, 'scan.png') });
      assert.ok(plain.ok && scan.ok, JSON.stringify([plain, scan]));
      assert.deepStrictEqual([plain.state, scan.state], [null, 'scanning']);
      assert.notDeepStrictEqual(fs.readFileSync(path.join(dir, 'plain.png')), fs.readFileSync(path.join(dir, 'scan.png')));
      const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/boards'), 'shot', 'boards/samples/States.dc.html', '--state', 'connected'], { cwd: ROOT, encoding: 'utf8' });
      assert.strictEqual(r.status, 0, r.stdout + r.stderr);
      const j = JSON.parse(r.stdout);
      assert.strictEqual(j.state, 'connected');
      assert.strictEqual(j.image, 'out/shots/States-connected-white-paper-1-420x240.png');
      assert.ok(fs.existsSync(path.join(ROOT, j.image)));
    });
  } finally {
    await browser.close();
    await srv.close();
  }
  process.stdout.write(failures ? failures + ' failed\n' : 'all passed\n');
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exitCode = 2; });
