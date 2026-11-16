// SPDX-License-Identifier: GPL-2.0-or-later
// The preview pages in a browser (spec 003 FR-010, FR-051..FR-054, FR-058, FR-061): states on the
// canvas and in the board view, the matrix with an error per cell, the flow and its walk, search
// with the keyboard, the render picker, the chrome's night. Needs Chromium:
// tools/in-alpine node test/boards/preview-e2e.js
'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { startServer } = require(path.join(ROOT, 'boards/lib/server.js'));
const { openBrowser } = require(path.join(ROOT, 'boards/lib/browser.js'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, n) {
  for (let i = 0; i < (n || 100); i++) { try { if (await fn()) return; } catch (e) { /* not yet */ } await sleep(100); }
  throw new Error('timed out: ' + what);
}
const settled = (f) => f.waitForFunction('window.__boards && window.__boards.settled', { polling: 100, timeout: 20000 });

async function main() {
  let failures = 0;
  const LIMIT = Number(process.env.E2E_TEST_TIMEOUT) || 120000;
  const test = async (name, fn) => {
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out after ' + LIMIT + ' ms')), LIMIT); });
    try { await Promise.race([fn(), deadline]); process.stdout.write('ok - ' + name + '\n'); } catch (e) { failures++; process.stdout.write('not ok - ' + name + '\n  ' + String(e && e.stack || e).split('\n').join('\n  ') + '\n'); } finally { clearTimeout(timer); }
  };
  const srv = await startServer({ design: path.join(ROOT, 'boards/samples'), live: false });
  const browser = await openBrowser({});
  // a page that fails on any console error or uncaught exception of the preview itself
  const page = async (url) => {
    const p = await browser.newPage();
    p.errs = [];
    p.on('pageerror', (e) => p.errs.push(String(e)));
    p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
    await p.setViewport({ width: 1440, height: 900 });
    await p.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } } catch (e) { /* none */ } });
    await p.goto(srv.url + '_boards/' + url, { waitUntil: 'load' });
    return p;
  };
  const tileFrame = async (p, file) => (await p.$('.board[data-file="' + file + '"] iframe')).contentFrame();
  try {
    await test('canvas: the inspector names the states; a state chosen there shows in the tile and the address', async () => {
      const p = await page('index.html?page=parts&board=States.dc.html');
      try {
        await p.waitForSelector('#insp:not([hidden]) h2');
        assert.match(await p.$eval('#insp h2', (e) => e.textContent), /States/);
        const states = await p.$$eval('#insp .vw-seg[aria-label="States"] button', (b) => b.map((x) => x.textContent));
        assert.deepStrictEqual(states, ['Default', 'Off', 'On', 'Scanning', 'Connected']);
        const links = await p.$$eval('#insp .vw-links a .vw-t', (a) => a.map((x) => x.textContent));
        assert.ok(links.some((t) => /Counter/.test(t)) && links.some((t) => /Main/.test(t)), JSON.stringify(links));
        assert.match(await p.$eval('#insp .vw-cmd', (e) => e.textContent), /^tools\/boards shot States\.dc\.html$/);
        await p.$$eval('#insp .vw-seg[aria-label="States"] button', (b) => b[3].click());
        await until(() => p.evaluate(() => /[?&]state=scanning/.test(location.search)), 'the address names the state');
        assert.match(await p.$eval('.board[data-file="States.dc.html"] iframe', (f) => f.getAttribute('src')), /state=scanning/);
        const f = await tileFrame(p, 'States.dc.html');
        await settled(f);
        assert.strictEqual(await f.evaluate(() => window.__boards.state), 'scanning');
        assert.match(await p.$eval('#insp .vw-cmd', (e) => e.textContent), /--state scanning/);
        // J moves to the next board in reading order, Esc lets go of it
        await p.keyboard.press('j');
        await until(() => p.evaluate(() => !/board=States/.test(location.search) && /board=/.test(location.search)), 'J chooses another board');
        assert.ok(!/state=/.test(await p.evaluate(() => location.search)));
        await p.keyboard.press('Escape');
        await until(() => p.$eval('#insp', (e) => e.hidden), 'Esc closes the inspector');
        // a plain click on a tile chooses it, the title still opens the board view
        await p.click('.board[data-file="Card.dc.html"] .hit');
        await until(() => p.evaluate(() => /board=Card/.test(location.search) && /index\.html|_boards\/$/.test(location.pathname + '')), 'a click chooses');
        assert.deepStrictEqual(p.errs, []);
      } finally { await p.close(); }
    });

    await test('board view: the state from the address, the filmstrip, J/K, the device look in E-ink', async () => {
      const p = await page('view.html?board=States.dc.html&state=on');
      try {
        const f = await (await p.$('#frame')).contentFrame();
        await settled(f);
        assert.strictEqual(await f.evaluate(() => window.__boards.state), 'on');
        assert.deepStrictEqual(await p.$$eval('#film a[aria-current]', (a) => a.map((x) => x.getAttribute('aria-current'))), ['false', 'false', 'true', 'false', 'false']);
        await p.$$eval('#film a', (a) => a[4].click());
        await until(() => p.evaluate(() => /state=connected/.test(location.search)), 'the filmstrip sets the state');
        await until(async () => (await (await p.$('#frame')).contentFrame()).evaluate(() => window.__boards && window.__boards.state === 'connected'), 'the frame shows it');
        await p.click('#lookseg button:nth-child(2)');
        await until(() => p.evaluate(() => /look=device/.test(location.search)), 'device look');
        assert.match(await p.$eval('#frame', (e) => e.getAttribute('src')), /scheme=eink/);
        assert.ok(await p.$eval('#holder', (e) => e.classList.contains('vw-device')));
        await p.keyboard.press('j');
        await until(() => p.evaluate(() => !/board=States/.test(location.search)), 'J moves to the next board');
        assert.ok(await p.evaluate(() => /look=device/.test(location.search) && !/state=/.test(location.search)));
        assert.deepStrictEqual(p.errs, []);
      } finally { await p.close(); }
    });

    await test('matrix: every state × voice; arrows move the chosen cell; an error is marked on its cell', async () => {
      const p = await page('matrix.html?board=States.dc.html&rows=state&cols=voice');
      try {
        await p.waitForSelector('.vw-cell').catch((e) => { throw new Error(e.message + ' ' + JSON.stringify(p.errs)); });
        assert.strictEqual(await p.$$eval('.vw-cell', (c) => c.length), 12);
        assert.deepStrictEqual(await p.$$eval('.vw-grid__r', (c) => c.map((x) => x.textContent)), ['Off', 'On', 'Scanning', 'Connected']);
        await p.keyboard.press('ArrowRight');
        await p.keyboard.press('ArrowDown');
        await until(() => p.evaluate(() => /at=1%2C1|at=1,1/.test(location.search)), 'the arrows move');
        assert.match(await p.$eval('#big-t', (e) => e.textContent), /Editorial.*On/);
        assert.match(await p.$eval('#open', (e) => e.getAttribute('href')), /^view\.html\?board=States\.dc\.html&state=on&voice=editorial/);
        await until(() => p.$$eval('.vw-cell iframe', (fs) => fs.every((f) => f.contentWindow.__boards && f.contentWindow.__boards.settled)), 'the cells render', 200);
        assert.strictEqual(await p.$$eval('.vw-cell--bad', (c) => c.length), 0);
        await p.close();
        // an unknown state is an error of every cell
        const q = await page('matrix.html?board=Counter.dc.html&state=nope');
        try {
          await q.waitForSelector('.vw-cell').catch((e) => { throw new Error(e.message + ' ' + JSON.stringify(q.errs)); });
          assert.strictEqual(await q.$$eval('.vw-cell', (c) => c.length), 9);
          await until(() => q.$$eval('.vw-cell--bad', (c) => c.length === 9), 'every cell marked', 200);
          assert.match(await q.$eval('.vw-cell .vw-err', (e) => e.title), /unknown state/);
        } finally { await q.close(); }
      } finally { if (!p.isClosed()) await p.close(); }
    });

    await test('flow: arrows from the links, the walk step by step, the boards no arrow touches apart', async () => {
      const p = await page('flow.html?page=screens');
      try {
        await p.waitForSelector('.vw-node');
        const labels = await p.$$eval('.vw-edge-label', (l) => l.map((x) => x.textContent));
        assert.ok(labels.length >= 2, JSON.stringify(labels));
        assert.deepStrictEqual(await p.$$eval('.vw-apart .vw-node', (n) => n.map((x) => x.dataset.id)), ['Form.dc.html']);
        const walk = await p.$$eval('#walk a .vw-t', (a) => a.map((x) => x.textContent));
        assert.ok(walk.length >= 2 && /^Main/.test(walk[0]), JSON.stringify(walk));
        await p.keyboard.press('j');
        await until(() => p.evaluate(() => /step=2/.test(location.search) && /from=Main/.test(location.search)), 'J walks a step');
        assert.strictEqual(await p.$$eval('.vw-edges path.on', (e) => e.length), 1);
        await p.close();
        // a board's state steps are arrows too, dashed
        const q = await page('flow.html?page=parts&from=States.dc.html%23off');
        try {
          await q.waitForSelector('.vw-node');
          assert.strictEqual(await q.$$eval('.vw-edges path.vw-state', (e) => e.length), 3);
          assert.deepStrictEqual(await q.$$eval('#walk .vw-q', (a) => a.map((x) => x.textContent)), ['start', '“Turn on”', '“Scan”', '“Pair”']);
          assert.deepStrictEqual(q.errs, []);
        } finally { await q.close(); }
      } finally { if (!p.isClosed()) await p.close(); }
    });

    await test('search: / then a state name, ⏎ opens the board view in that state', async () => {
      const p = await page('index.html?page=screens');
      try {
        await p.waitForSelector('.board');
        await p.keyboard.press('/');
        await p.waitForSelector('.vw-palette input');
        await p.keyboard.type('scann');
        await until(() => p.$eval('.vw-palette__item[aria-selected="true"]', (e) => e.dataset.kind === 'state'), 'a state first');
        assert.strictEqual(await p.$eval('.vw-palette__item[aria-selected="true"]', (e) => e.dataset.file + '#' + e.dataset.state), 'States.dc.html#scanning');
        await Promise.all([p.waitForNavigation(), p.keyboard.press('Enter')]);
        assert.match(p.url(), /view\.html\?board=States\.dc\.html&state=scanning$/);
        // ⌘K opens it too, Esc closes it
        await p.waitForSelector('#bar');
        await p.keyboard.down('Control'); await p.keyboard.press('k'); await p.keyboard.up('Control');
        await p.waitForSelector('.vw-palette');
        await p.keyboard.press('Escape');
        await until(async () => !(await p.$('.vw-palette')), 'Esc closes the search');
        assert.deepStrictEqual(p.errs, []);
      } finally { await p.close(); }
    });

    await test('render picker: a voice by picture for every board, in the address and remembered; the chrome at night', async () => {
      const p = await page('index.html?page=screens');
      try {
        await p.waitForSelector('.board iframe');
        await p.click('#render');
        await p.waitForSelector('.vw-picker');
        assert.strictEqual(await p.$$eval('.vw-picker .vw-swatch .vw-swatch__img[data-theme]', (s) => s.length), 6);
        await p.click('.vw-picker button[data-key="voice"][data-value="stationery"]');
        await until(() => p.evaluate(() => /voice=stationery/.test(location.search)), 'the address');
        assert.strictEqual(JSON.parse(await p.evaluate(() => localStorage.getItem('boards.render'))).voice, 'stationery');
        assert.ok(await p.$$eval('.board iframe', (fs) => fs.every((f) => /voice=stationery/.test(f.getAttribute('src')))));
        assert.match(await p.$eval('#render', (e) => e.textContent), /Stationery/);
        await p.keyboard.press('Escape');
        // another page without a render in its address takes the remembered one
        await p.goto(srv.url + '_boards/view.html?board=Main.dc.html', { waitUntil: 'load' });
        await p.waitForSelector('#frame[src]');
        assert.match(await p.$eval('#frame', (e) => e.getAttribute('src')), /voice=stationery/);
        assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.theme), 'white-paper');
        await p.keyboard.press('t');
        assert.strictEqual(await p.evaluate(() => document.documentElement.dataset.theme), 'white-night');
        assert.strictEqual(await p.evaluate(() => localStorage.getItem('boards.chrome')), 'white-night');
        assert.strictEqual(await p.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(34, 34, 34)');
        assert.deepStrictEqual(p.errs, []);
      } finally { await p.close(); }
    });

    await test('bar: the views keep the board and the render; no review without a proposal', async () => {
      const p = await page('view.html?board=Counter.dc.html&voice=editorial');
      try {
        await p.waitForSelector('.vw-modes a');
        const modes = await p.$$eval('.vw-modes a', (a) => a.map((x) => x.dataset.mode + ' ' + x.getAttribute('href')));
        assert.deepStrictEqual(modes, ['canvas index.html?board=Counter.dc.html&page=screens&voice=editorial', 'flow flow.html?page=screens&voice=editorial&from=Counter.dc.html', 'matrix matrix.html?board=Counter.dc.html&voice=editorial']);
        assert.strictEqual(await p.$eval('.vw-modes a[aria-current="page"]', (a) => a.dataset.mode), 'canvas');
        assert.strictEqual(await p.$eval('.vw-rev', (e) => e.textContent), 'main');
        assert.strictEqual(await p.$('a.vw-brand'), null);
        assert.deepStrictEqual(p.errs, []);
      } finally { await p.close(); }
    });
  } finally {
    await browser.close();
    await srv.close();
  }
  process.stdout.write(failures ? failures + ' failed\n' : 'all passed\n');
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exitCode = 2; });
