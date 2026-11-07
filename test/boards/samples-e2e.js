// SPDX-License-Identifier: GPL-2.0-or-later
// The sample boards in a browser: rendering, scripted clicks (state, branches, links), the
// unsupported samples, and the preview pages. Needs Chromium: tools/in-alpine node test/boards/samples-e2e.js
'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { startServer } = require(path.join(ROOT, 'boards/lib/server.js'));
const { openBrowser, renderBoard } = require(path.join(ROOT, 'boards/lib/browser.js'));
const { checkDesign } = require(path.join(ROOT, 'boards/lib/check.js'));
// the samples read the real Interleaf (the default: this checkout's interleaf/, as claude.ai has it)
const INTERLEAF = undefined;

const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim());
const settle = (page) => page.waitForFunction('window.__boards && window.__boards.settled', { polling: 100, timeout: 20000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what) {
  for (let i = 0; i < 50; i++) { if (await fn()) return; await sleep(100); }
  throw new Error('timed out: ' + what);
}

async function main() {
  let failures = 0;
  const test = async (name, fn) => {
    try { await fn(); process.stdout.write('ok - ' + name + '\n'); } catch (e) { failures++; process.stdout.write('not ok - ' + name + '\n  ' + String(e && e.stack || e).split('\n').join('\n  ') + '\n'); }
  };

  await test('every sample renders clean', async () => {
    const rep = await checkDesign({ design: path.join(ROOT, 'boards/samples'), interleaf: INTERLEAF });
    assert.strictEqual(rep.summary.failing, 0, JSON.stringify(rep.boards.filter((b) => !b.ok), null, 1));
    assert.strictEqual(rep.summary.boards, 6);
  });

  await test('boards outside the subset fail, naming board and feature', async () => {
    const rep = await checkDesign({ design: path.join(__dirname, 'unsupported'), interleaf: INTERLEAF });
    const by = Object.fromEntries(rep.boards.map((b) => [b.board, b]));
    assert.strictEqual(rep.summary.clean, 0);
    assert.deepStrictEqual(by['Bad.dc.html'].unsupported.map((e) => e.feature).sort(), ['element', 'expression in a hole']);
    assert.ok(by['Host.dc.html'].unsupported.every((e) => e.board === 'Bad.dc.html'));
    assert.match(by['Throws.dc.html'].errors[0].message, /in text is object/);
    // a <dc-import> cycle is named on the importing board's line, not a stack overflow
    const cyc = (b) => by[b].unsupported.filter((e) => e.feature === 'dc-import cycle').map((e) => e.board + ':' + e.line + ' ' + e.detail).sort();
    assert.deepStrictEqual(cyc('Self.dc.html'), ['Self.dc.html:11 Self.dc.html → Self.dc.html']);
    assert.deepStrictEqual(cyc('Ping.dc.html'), ['Ping.dc.html:11 Ping.dc.html → loop/Pong.dc.html → Ping.dc.html',
      'loop/Pong.dc.html:12 loop/Pong.dc.html → Ping.dc.html → loop/Pong.dc.html']);
    for (const b of ['Self.dc.html', 'Ping.dc.html', 'loop/Pong.dc.html']) assert.ok(!by[b].errors.some((e) => /call stack/.test(e.message)), b);
    // a missing import is named on the <dc-import> that names it
    assert.ok(by['Missing.dc.html'].errors.some((e) => e.board === 'Missing.dc.html' && e.feature === '<dc-import>' && e.detail === 'Nope' && e.line === 11 && /Nope\.dc\.html: HTTP 404/.test(e.message)), JSON.stringify(by['Missing.dc.html'].errors));
    // an error in the logic carries the board file's line
    const thrown = by['LineThrow.dc.html'].errors.find((e) => e.feature === 'renderVals()');
    assert.strictEqual(thrown.line, 15);
  });

  const srv = await startServer({ design: path.join(ROOT, 'boards/samples'), interleaf: INTERLEAF, live: true });
  const browser = await openBrowser({});
  try {
    await test('Main: fixtures, tokens, imports with props, loops, branch, select, links', async () => {
      const r = await renderBoard(browser, srv.url, 'Main.dc.html', { width: 900, height: 760, voice: 'editorial', props: { compact: true }, keepPage: true });
      const p = r.page;
      try {
        assert.ok(r.ok, JSON.stringify(r));
        assert.strictEqual(await text(p, 'h1'), 'Samples & checks · sample');
        assert.strictEqual(await text(p, '#settings'), 'voice=editorial scheme=paper pen=1 compact=true');
        await until(async () => (await text(p, '#token')) === 'paper token: #fbf9f4', 'tokens');
        assert.deepStrictEqual(await p.$$eval('[data-dc-import="Card"] b', (b) => b.map((x) => x.textContent)), ['First', 'Second', 'Third']);
        assert.strictEqual(await p.$eval('[data-dc-import="Card"]:nth-child(2) .card', (e) => e.getAttribute('data-index')), '1');
        assert.strictEqual(await p.$$eval('#table tbody tr', (r) => r.length), 3);
        assert.strictEqual(await p.$$eval('#select option', (o) => o.length), 3);
        assert.strictEqual(await p.$eval('svg', (s) => s.getAttribute('viewBox')), '0 0 40 20');
        await p.click('[data-dc-import="Card"]:nth-child(3) .card');
        await until(async () => (await text(p, '#picked')) === 'picked: c', 'card pick');
        await p.select('#select', 'b');
        await until(async () => (await text(p, '#picked')) === 'picked: b', 'select');
        await p.click('#toggle');
        await until(async () => !(await p.$('#table')), 'branch off');
        assert.strictEqual(await p.$eval('#toggle', (b) => b.getAttribute('aria-pressed')), 'false');
        await Promise.all([p.waitForNavigation(), p.click('#to-counter')]);
        assert.match(p.url(), /\/Counter\.dc\.html\?voice=editorial$/);
        await settle(p);
        await Promise.all([p.waitForNavigation(), p.click('#home')]);
        assert.match(p.url(), /\/Main\.dc\.html\?voice=editorial$/);
      } finally { await p.close(); }
    });

    await test('query props cannot set the prototype', async () => {
      const p = await browser.newPage();
      try {
        await p.goto(srv.url + 'Main.dc.html?p.__proto__=%7B%22voice%22%3A%22stationery%22%7D&p.constructor=1', { waitUntil: 'load' });
        await settle(p);
        assert.deepStrictEqual(await p.evaluate(() => window.__boards.errors), []);
        assert.strictEqual(await text(p, '#settings'), 'voice=white scheme=paper pen=1 compact=false');
      } finally { await p.close(); }
    });

    await test('Counter: state, setState(fn), lifecycle, timers, ref, static, double-click', async () => {
      const r = await renderBoard(browser, srv.url, 'Counter.dc.html', { width: 480, height: 360, keepPage: true });
      const p = r.page;
      try {
        assert.ok(r.ok, JSON.stringify(r));
        await until(async () => /^mounted: true/.test(await text(p, '#mounted')), 'mounted');
        assert.match(await text(p, '#width'), /^width: 480 · narrow: false · label: counter$/);
        for (let i = 0; i < 3; i++) await p.click('#inc');
        await until(async () => (await text(p, '#count')) === 'count: 3', 'count');
        assert.ok(await p.$('#many'));
        await until(async () => /updates: 3/.test(await text(p, '#mounted')), 'componentDidUpdate');
        await until(async () => /ticks: yes/.test(await text(p, '#mounted')), 'setInterval');
        await p.click('#dbl', { count: 2 });
        await until(async () => (await text(p, '#count')) === 'count: 0', 'double-click');
      } finally { await p.close(); }
    });

    await test('Form: typing, keys, checkbox, textarea hole, submit', async () => {
      const r = await renderBoard(browser, srv.url, 'Form.dc.html', { width: 480, height: 420, keepPage: true });
      const p = r.page;
      try {
        assert.ok(r.ok, JSON.stringify(r));
        assert.strictEqual(await p.$eval('#send', (b) => b.disabled), true);
        assert.strictEqual(await p.$eval('#notes', (t) => t.value), 'Notes for nobody');
        await p.type('#name', 'Ada');
        await until(async () => (await text(p, '#echo')) === 'typed: Ada · keys: 3', 'typing');
        await p.click('#agree');
        await until(async () => (await text(p, '#agreed')) === 'agree: yes', 'checkbox');
        assert.strictEqual(await p.$eval('#agreed', (e) => e.getAttribute('aria-checked')), 'true');
        await p.click('#send');
        await until(async () => (await text(p, '#sent')) === 'sent Ada', 'submit');
      } finally { await p.close(); }
    });

    await test('Nested: imports beside the board, nested loops, a root link', async () => {
      const r = await renderBoard(browser, srv.url, 'sub/Nested.dc.html', { width: 420, height: 200, keepPage: true });
      const p = r.page;
      try {
        assert.ok(r.ok, JSON.stringify(r));
        assert.deepStrictEqual(await p.$$eval('.badge', (b) => b.map((x) => x.textContent)), ['x/1', 'x/2', 'y/3']);
        assert.strictEqual(await p.$eval('#to-counter', (a) => a.getAttribute('href')), '/Counter.dc.html');
        // only http(s) links leave: a javascript: href does nothing
        await p.evaluate(() => { const a = document.createElement('a'); a.id = 'js'; a.href = 'javascript:window.__ran=1'; a.textContent = 'js'; document.body.append(a); });
        await p.click('#js');
        await sleep(200);
        assert.strictEqual(await p.evaluate(() => window.__ran), undefined);
        await Promise.all([p.waitForNavigation(), p.click('#to-counter')]);
        assert.match(p.url(), /\/Counter\.dc\.html$/);
      } finally { await p.close(); }
    });

    await test('preview: canvas index and board view load', async () => {
      const p = await browser.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      try {
        await p.goto(srv.url + '_boards/', { waitUntil: 'load' });
        await p.waitForSelector('.board');
        assert.strictEqual(await p.$$eval('.board', (b) => b.length), 3);
        assert.match(await p.$eval('#pages', (n) => n.textContent), /Screens \(3\)Parts \(3\)/);
        await p.goto(srv.url + '_boards/view.html?board=Main.dc.html&voice=stationery', { waitUntil: 'load' });
        await p.waitForSelector('#controls select');
        const f = await (await p.$('#frame')).contentFrame();
        await f.waitForFunction('window.__boards && window.__boards.settled', { polling: 100 });
        assert.match(await f.$eval('#settings', (e) => e.textContent), /voice=stationery/);
        assert.deepStrictEqual(await p.$$eval('#controls [name]', (c) => c.map((x) => x.name)), ['voice', 'scheme', 'pen', 'compact']);
        await Promise.all([p.waitForFunction(() => /board=Counter/.test(location.search), { polling: 100 }), f.$eval('#to-counter', (a) => a.click())]);
        assert.deepStrictEqual(errs, []);
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
