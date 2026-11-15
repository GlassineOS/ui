// SPDX-License-Identifier: GPL-2.0-or-later
// The review of a proposal in headless Chromium (spec 003 FR-055..FR-057): a copy of the samples
// with a changed, an added and a removed board, exported beside the main line's export as the site
// lays them out, its review written with the difference images, and the review page served by a
// plain static server under a sub-path. Checks: the list is exactly those boards; the regions of
// every difference image cover each differing pixel and none is empty; the four comparisons, the
// absent side, the "seen" marks across a reload and after a change; the page asks no other site and
// sends nothing. Run by make boards-check (tools/in-alpine provides Chromium).
'use strict';
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { exportDesign } = require('../../boards/lib/export.js');
const { MIME } = require('../../boards/lib/server.js');
const { openBrowser } = require('../../boards/lib/browser.js');
const R = require('../../boards/lib/review.js');
const PNG = require('../../boards/lib/png.js');
const SAMPLES = path.join(ROOT, 'boards', 'samples');
const TMP = path.join(ROOT, 'out', 'test', 'review-e2e');
const SITE = path.join(TMP, 'site'), STAGE = path.join(SITE, 'sub', 'designs');

let fails = 0;
function ok(c, what) { console.log((c ? 'ok   ' : 'FAIL ') + what); if (!c) fails++; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.rmSync(TMP, { recursive: true, force: true });
  const pr = path.join(TMP, 'pr', 'samples');
  fs.mkdirSync(path.dirname(pr), { recursive: true });
  fs.cpSync(SAMPLES, pr, { recursive: true });
  // Card changes (and so Main, which imports it), Extra is new, Form is gone
  const card = path.join(pr, 'Card.dc.html');
  fs.writeFileSync(card, fs.readFileSync(card, 'utf8').replace('</x-dc>', '<div style="position: absolute; right: 8px; bottom: 8px; width: 30px; height: 12px; background: #000"></div>\n</x-dc>'));
  fs.copyFileSync(path.join(pr, 'Counter.dc.html'), path.join(pr, 'Extra.dc.html'));
  fs.rmSync(path.join(pr, 'Form.dc.html'));
  exportDesign({ design: SAMPLES, out: path.join(STAGE, 'samples') });
  const out = path.join(STAGE, 'pr-7', 'samples');
  exportDesign({ design: pr, out: out });
  const meta = path.join(TMP, 'pr.json');
  fs.writeFileSync(meta, JSON.stringify({ number: 7, title: 'Samples: a new card', url: 'https://github.com/o/ui/pull/7', head: 'abcdef0123456789', checks: 'passed' }));
  const t0 = Date.now();
  const rev = await R.writeReview({ main: SAMPLES, pr: pr, out: out, prJson: meta, base: '../../../samples/', diffs: true, jobs: 2 });
  const list = rev.boards.map((b) => b.file + ':' + b.change).sort();
  ok(JSON.stringify(list) === JSON.stringify(['Card.dc.html:changed', 'Extra.dc.html:added', 'Form.dc.html:removed', 'Main.dc.html:changed']),
    'review.json: exactly the changed, added and removed boards: ' + list.join(' '));
  const idx = JSON.parse(fs.readFileSync(path.join(out, '_boards', 'diffs', 'index.json'), 'utf8'));
  ok(rev.diffs === '_boards/diffs/' && idx.notComputed === 0 && idx.renders === 2 * 2 * 9, 'difference images: ' + idx.renders + ' renders in ' + (Date.now() - t0) + ' ms');
  let images = 0, coverOk = true;
  for (const [file, b] of Object.entries(idx.boards)) {
    for (const [id, c] of Object.entries(b.combos)) {
      if (!c.computed || !c.image) { coverOk = coverOk && c.computed; continue; }
      images++;
      const diff = PNG.decode(fs.readFileSync(path.join(out, '_boards', 'diffs', c.image)));
      const mask = R.diffMask({ width: diff.width, height: diff.height, diff: diff });
      let n = 0;
      for (let y = 0; y < diff.height; y++) for (let x = 0; x < diff.width; x++) {
        if (!mask[y * diff.width + x]) continue;
        n++;
        if (!c.regions.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)) coverOk = false;
      }
      for (const r of c.regions) {
        let has = 0;
        for (let y = r.y; y < r.y + r.height; y++) for (let x = r.x; x < r.x + r.width; x++) has += mask[y * diff.width + x];
        if (!has) coverOk = false;
      }
      if (n !== c.differing || !c.regions.length) coverOk = false;
      if (!coverOk) { console.log('  ' + file + ' ' + id + ': ' + JSON.stringify(c.regions)); break; }
    }
  }
  ok(images > 0 && coverOk, 'regions: every differing pixel in a region, no empty region (' + images + ' images)');

  const srv = http.createServer(function (req, res) {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(SITE, p);
    if (!f.startsWith(SITE + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + srv.address().port;
  const page0 = origin + '/sub/designs/pr-7/samples/_boards/review.html';
  const browser = await openBrowser({});
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const elsewhere = [], sent = [], bad = [];
    page.on('request', (r) => { if (!r.url().startsWith(origin + '/') && !/^(data|blob|about):/.test(r.url())) elsewhere.push(r.url()); if (r.method() !== 'GET') sent.push(r.method() + ' ' + r.url()); });
    page.on('response', (r) => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    page.on('pageerror', (e) => bad.push('page error: ' + e.message));
    const go = async (q) => {
      await page.goto(page0 + q, { waitUntil: 'load' });
      try { await page.waitForNetworkIdle({ idleTime: 400, timeout: 15000 }); } catch (e) { /* frames */ }
      await sleep(300);
    };
    const marks = () => page.$$eval('.rv-changes a', (as) => as.map((a) => a.dataset.file + ':' + a.dataset.seen));
    await go('?board=Card.dc.html&compare=side');
    await page.evaluate(() => localStorage.clear());
    ok((await marks()).length === 4, 'the list: ' + (await marks()).join(' '));
    const srcs = await page.$$eval('.rv-side iframe', (f) => f.map((x) => new URL(x.src).pathname));
    ok(srcs.length === 2 && srcs[0] === '/sub/designs/samples/Card.dc.html' && srcs[1] === '/sub/designs/pr-7/samples/Card.dc.html',
      'side by side: main from base, the proposal from here: ' + srcs.join(' '));
    for (const m of ['slider', 'overlay']) {
      await go('?board=Card.dc.html&compare=' + m);
      ok((await page.$$('.rv-stack iframe')).length === 2 && !!(await page.$('.rv-range')), m + ': both frames stacked, a control');
    }
    await go('?board=Card.dc.html&compare=changes');
    const nbox = await page.$$eval('.rv-box', (x) => x.length);
    const count = await page.$eval('.rv-count', (e) => e.textContent);
    ok(nbox > 0 && /region/.test(count), 'changes: ' + nbox + ' boxes, "' + count + '"');
    await go('?board=Card.dc.html&compare=changes&pen=3');
    ok(/Not computed/.test(await page.$eval('.rv-pane', (e) => e.textContent)), 'changes at pen 3: not computed, and said so');
    await go('?board=Extra.dc.html&compare=side');
    ok(/Not on main/.test(await page.$eval('[data-side=before]', (e) => e.textContent)) && !!(await page.$('[data-side=after] iframe')), 'an added board: main\'s side absent');
    await go('?board=Form.dc.html&compare=side');
    ok(/Removed/.test(await page.$eval('[data-side=after]', (e) => e.textContent)) && !!(await page.$('[data-side=before] iframe')), 'a removed board: the proposal\'s side absent');
    // seen: S marks, N marks and moves to the next not seen, both kept across a reload
    await go('?board=Card.dc.html&compare=side');
    await page.keyboard.press('s');
    await sleep(100);
    await page.keyboard.press('n');
    await sleep(300);
    const at = await page.evaluate(() => new URLSearchParams(location.search).get('board'));
    ok(at === 'Extra.dc.html', 'N moves to the next board not seen: ' + at);
    await page.reload({ waitUntil: 'load' });
    await sleep(500);
    const m1 = await marks();
    ok(m1.includes('Card.dc.html:seen') && m1.includes('Extra.dc.html:unseen'), 'the mark is kept across a reload: ' + m1.join(' '));
    ok(/1 of 4/.test(await page.$eval('#progress', (e) => e.textContent)), 'the count of seen boards');
    // the next publication changes Card: its mark becomes "changed since"
    const rj = path.join(out, '_boards', 'api', 'review.json');
    const r = JSON.parse(fs.readFileSync(rj, 'utf8'));
    r.boards.find((b) => b.file === 'Card.dc.html').hash = 'f'.repeat(64);
    fs.writeFileSync(rj, JSON.stringify(r));
    await go('?board=Card.dc.html');
    ok((await marks()).includes('Card.dc.html:since') && /1 changed since you looked/.test(await page.$eval('#pr', (e) => e.textContent)),
      'a board changed after it was marked shows as changed since');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    ok(keys.length === 1 && keys[0] === 'boards.seen./sub/designs/pr-7/samples/', 'one storage key, the proposal\'s address: ' + keys.join(','));
    const addr = await page.$eval('.rv-addr', (e) => e.value);
    ok(new URL(addr).searchParams.get('board') === 'Card.dc.html' && (await page.$eval('a[href="https://github.com/o/ui/pull/7"]', () => true)),
      'an address per board and a link to the proposal');
    ok(!elsewhere.length, 'no request to another site' + (elsewhere.length ? ': ' + elsewhere.slice(0, 3).join(' ') : ''));
    ok(!sent.length, 'nothing sent' + (sent.length ? ': ' + sent.slice(0, 3).join(' ') : ''));
    ok(!bad.length, 'no failed request or page error' + (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
  } finally {
    await browser.close();
    srv.close();
  }
}

main().then(function () {
  console.log('review e2e: ' + (fails ? fails + ' FAILED' : 'all passed'));
  process.exit(fails ? 1 : 0);
}, function (e) { console.error(e); process.exit(1); });
