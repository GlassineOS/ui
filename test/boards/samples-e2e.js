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
    assert.ok(by['Host.dc.html'].errors.some((e) => e.board === 'Host.dc.html' && e.kind === 'render' && e.line === 10 && /\{\{ s \}\} inside a string is object/.test(e.message)), JSON.stringify(by['Host.dc.html'].errors));
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

  await test('no network: requests elsewhere fail the board, Google Fonts come from the vendored fonts', async () => {
    const rep = await checkDesign({ design: path.join(__dirname, 'offline'), interleaf: INTERLEAF });
    const b = rep.boards[0];
    assert.strictEqual(b.ok, false);
    assert.deepStrictEqual(b.external.map((e) => e.error).sort(), ['blocked: no network in renders', 'font family not vendored: Nope Sans']);
    assert.ok(b.external.some((e) => e.url === 'https://example.org/site.css'));
    const srv2 = await startServer({ design: path.join(__dirname, 'offline'), interleaf: INTERLEAF, live: false });
    const br = await openBrowser({});
    try {
      const { vendoredFaces } = require(path.join(ROOT, 'boards/lib/references.js'));
      const r = await renderBoard(br, srv2.url, 'Net.dc.html', { width: 200, height: 60, keepPage: true, faces: vendoredFaces(srv2.url, srv2.interleaf, srv2.design, null) });
      const loaded = await r.page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px Kalam') && Array.from(document.fonts).some((f) => f.family === 'Kalam' && f.status === 'loaded'); });
      await r.page.close();
      assert.ok(loaded, 'Kalam loaded from the vendored fonts');
    } finally { await br.close(); await srv2.close(); }
  });

  await test('references: the sample boards match, a change is a difference with an image', async () => {
    const fs = require('fs');
    const R = require(path.join(ROOT, 'boards/lib/references.js'));
    const out = path.join(ROOT, 'out', 'test', 'boards-references');
    fs.rmSync(out, { recursive: true, force: true });
    let rep = await R.shootDesign({ design: path.join(ROOT, 'boards/samples'), interleaf: INTERLEAF, out: out, boards: ['sub/Badge.dc.html'] });
    assert.deepStrictEqual([rep.summary.cases, rep.summary.pass, rep.summary.ok], [1, 1, true], JSON.stringify(rep.cases));
    // another board's references as this one's: every pixel compared, the difference drawn
    const refs = path.join(out, 'refs');
    fs.mkdirSync(refs, { recursive: true });
    const src = path.join(ROOT, 'boards/samples/references');
    const idx = JSON.parse(fs.readFileSync(path.join(src, 'index.json'), 'utf8'));
    const card = idx.cases['Card.dc.html/280x120/own'];
    fs.copyFileSync(path.join(src, card.file), path.join(refs, card.file));
    fs.writeFileSync(path.join(refs, 'index.json'), JSON.stringify(Object.assign({}, idx, { cases: { 'sub/Badge.dc.html/160x40/own': card } })));
    rep = await R.shootDesign({ design: path.join(ROOT, 'boards/samples'), interleaf: INTERLEAF, out: out, refs: refs, boards: ['sub/Badge.dc.html'] });
    const c = rep.cases[0];
    assert.deepStrictEqual([c.status, rep.summary.ok, c.referenceSize], ['differs', false, { width: 280, height: 120 }]);
    assert.ok(c.differing > 0 && fs.existsSync(path.resolve(c.diff)), JSON.stringify(c));
  });

  await test('shot: an image and every error, two voices, clicks, a missing target, a failing board', async () => {
    const fs = require('fs');
    const { spawnSync } = require('child_process');
    const { shootBoard } = require(path.join(ROOT, 'boards/lib/shot.js'));
    const dir = path.join(ROOT, 'out', 'test', 'boards-shot');
    fs.rmSync(dir, { recursive: true, force: true });
    const main = path.join(ROOT, 'boards/samples/Main.dc.html');
    const image = (r) => fs.readFileSync(path.resolve(r.image));
    const shot = (name, o) => shootBoard(Object.assign({ board: main, out: path.join(dir, name + '.png') }, o));

    const white = await shot('white', { voice: 'white' });
    assert.ok(white.ok, JSON.stringify(white));
    assert.deepStrictEqual([white.board, white.design, white.voice, white.scheme, white.pen, white.size], ['Main.dc.html', 'boards/samples', 'white', 'paper', 1, { width: 900, height: 760 }]);
    assert.deepStrictEqual(white.errors, []);
    const stationery = await shot('stationery', { voice: 'stationery', scheme: 'night', pen: '2' });
    assert.ok(stationery.ok, JSON.stringify(stationery));
    assert.deepStrictEqual([stationery.voice, stationery.scheme, stationery.pen], ['stationery', 'night', 2]);
    assert.notDeepStrictEqual(image(white), image(stationery), 'two voices give two images');

    const clicked = await shot('clicked', { voice: 'white', clicks: ['#toggle'] });
    assert.ok(clicked.ok, JSON.stringify(clicked));
    assert.deepStrictEqual(clicked.clicks, [{ selector: '#toggle', ok: true }]);
    assert.notDeepStrictEqual(image(white), image(clicked), 'a click changes the image');

    const phone = await shot('phone', { size: { width: 390, height: 760 } });
    assert.ok(phone.ok, JSON.stringify(phone));
    const PNG = require(path.join(ROOT, 'boards/lib/png.js'));
    const im = PNG.decode(image(phone));
    assert.deepStrictEqual([im.width, im.height], [390, 760]);

    // a click on nothing: reported, the series ends, the image is what was reached
    const missing = await shot('missing', { voice: 'white', clicks: ['#toggle', '#nope', '#inc'] });
    assert.strictEqual(missing.ok, false);
    assert.deepStrictEqual(missing.clicks.map((c) => [c.selector, c.ok, !!c.skipped]), [['#toggle', true, false], ['#nope', false, false], ['#inc', false, true]]);
    assert.deepStrictEqual(missing.errors.map((e) => [e.kind, e.detail]), [['click', '#nope']]);
    assert.match(missing.errors[0].message, /no element matches #nope/);
    assert.deepStrictEqual(image(missing), image(clicked), 'the image holds what was reached');

    // a link to another board: the new page settles, later clicks act on it, and its own errors count
    const nav = await shot('nav', { voice: 'editorial', clicks: ['#to-counter', '#inc'] });
    assert.ok(nav.ok, JSON.stringify(nav));
    const counter = await shootBoard({ board: path.join(ROOT, 'boards/samples/Counter.dc.html'), out: path.join(dir, 'counter.png') });
    assert.notDeepStrictEqual(image(nav), image(counter), 'the click after the link took effect');

    // a link to another site opens nothing and is reported as a request elsewhere
    const away = await shootBoard({ board: path.join(ROOT, 'boards/samples/sub/Nested.dc.html'), out: path.join(dir, 'away.png'), clicks: ['#external'] });
    assert.strictEqual(away.ok, false);
    assert.deepStrictEqual(away.errors.map((e) => [e.kind, e.url]), [['external', 'https://example.org/']]);

    // a board that raises an error: reported in the check's form, with the image of what rendered
    const bad = await shootBoard({ board: path.join(__dirname, 'unsupported/Throws.dc.html'), out: path.join(dir, 'throws.png') });
    assert.strictEqual(bad.ok, false);
    assert.ok(bad.errors.some((e) => e.board === 'Throws.dc.html' && /in text is object/.test(e.message)), JSON.stringify(bad.errors));
    assert.ok(fs.existsSync(path.join(dir, 'throws.png')));
    const un = await shootBoard({ board: path.join(__dirname, 'unsupported/Bad.dc.html'), out: path.join(dir, 'bad.png') });
    assert.deepStrictEqual(un.errors.filter((e) => e.kind === 'unsupported').map((e) => e.feature).sort(), ['element', 'expression in a hole']);

    // the command line: one JSON object on stdout, exit 1 when not ok
    const run = (...a) => spawnSync(process.execPath, [path.join(ROOT, 'tools/boards'), 'shot', ...a], { cwd: ROOT, encoding: 'utf8' });
    const out = 'out/test/boards-shot/cli.png';
    let r = run('boards/samples/sub/Badge.dc.html', '--out', out);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    let j = JSON.parse(r.stdout);
    assert.deepStrictEqual([j.ok, j.image, j.board, j.size], [true, out, 'sub/Badge.dc.html', { width: 160, height: 40 }]);
    r = run('boards/samples/sub/Badge.dc.html', '--out', out, '--click', '#nope');
    assert.strictEqual(r.status, 1, r.stdout + r.stderr);
    j = JSON.parse(r.stdout);
    assert.strictEqual(j.errors[0].kind, 'click');
  });

  await test('shots: the changed boards as images and one report', async () => {
    const fs = require('fs');
    const { spawnSync } = require('child_process');
    const root = path.join(ROOT, 'out', 'test', 'boards-shots');
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.join(root, 'designs'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'boards/samples'), path.join(root, 'designs/x'), { recursive: true });
    fs.rmSync(path.join(root, 'designs/x/references'), { recursive: true });
    const out = path.join(root, 'out');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/boards'), 'shots', '--root', root, '--out', out, '--jobs', '2'],
      { cwd: root, encoding: 'utf8', input: 'designs/x/Card.dc.html\ndesigns/x/sub/Badge.dc.html\n' });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.ok(fs.existsSync(path.join(out, 'x/Card.png')) && fs.existsSync(path.join(out, 'x/sub/Badge.png')));
    const rep = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
    assert.deepStrictEqual(rep.summary, { boards: 2, ok: true, failing: 0 });
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
