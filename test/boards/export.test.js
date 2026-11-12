// SPDX-License-Identifier: GPL-2.0-or-later
// The static export of the preview (tools/boards export) under plain node (no browser): the files,
// every board's support.js and ds/interleaf resolving where its page loads them, relative URLs
// only, what is left out, and that a folder that is not an export is never replaced.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const { exportDesign, MARKER } = require('../../boards/lib/export.js');
const { describe } = require('../../boards/lib/server.js');
const T = require('../../boards/runtime/template.js');
const SAMPLES = path.join(ROOT, 'boards', 'samples');
const TMP = path.join(ROOT, 'out', 'test', 'boards-export');

function fresh(name) {
  const d = path.join(TMP, name);
  fs.rmSync(d, { recursive: true, force: true });
  return d;
}
// the paths a board's page loads, relative to the export: its scripts and its ds/interleaf reads
function loads(out, file) {
  const src = fs.readFileSync(path.join(out, file), 'utf8');
  const dir = path.posix.dirname(file);
  const refs = [];
  for (const m of src.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) refs.push(m[1]);
  for (const m of src.matchAll(/['"`]((?:\.\.?\/)*ds\/interleaf\/[^'"`?#]+)/g)) refs.push(m[1]);
  return refs.map(function (r) { return path.posix.normalize(path.posix.join(dir, r)); });
}

test('export: the samples as files, every board resolves its runtime and Interleaf', () => {
  const out = fresh('samples');
  const r = exportDesign({ design: SAMPLES, out: out });
  const desc = describe(SAMPLES);
  assert.deepStrictEqual(r.boards.slice().sort(), desc.boards.map((b) => b.file).sort());
  assert.deepStrictEqual(r.dirs, ['.', 'sub']);
  for (const f of ['index.html', MARKER, 'canvas.json', 'data/sample.js', '_boards/index.html', '_boards/view.html', '_boards/view.js',
    '_boards/canvas.js', '_boards/preview-common.js', '_boards/preview.css', '_boards/fonts/fonts.css', 'support.js', 'sub/support.js',
    'ds/interleaf/tokens.json', 'sub/ds/interleaf/tokens.json', 'ds/interleaf/components/bundle.css']) {
    assert.ok(fs.statSync(path.join(out, f)).isFile(), f);
  }
  // the canvas data is the server's, without live reload
  const c = JSON.parse(fs.readFileSync(path.join(out, '_boards/api/canvas.json'), 'utf8'));
  assert.strictEqual(c.live, false);
  assert.deepStrictEqual(c.boards, desc.boards);
  // every board: the scripts it names and the Interleaf files it reads are there, below its page
  let interleafReads = 0;
  for (const b of r.boards) {
    const refs = loads(out, b);
    assert.ok(refs.some((x) => /(^|\/)support\.js$/.test(x)), b + ' loads support.js');
    for (const x of refs) {
      assert.ok(!x.startsWith('..'), b + ': ' + x + ' leaves the export');
      assert.ok(fs.existsSync(path.join(out, x)), b + ': ' + x + ' missing');
      if (/ds\/interleaf\//.test(x)) interleafReads++;
    }
  }
  assert.ok(interleafReads > 0, 'a sample reads ds/interleaf');
  // the runtime is the one the server serves, rooted at the design folder from each depth
  const top = fs.readFileSync(path.join(out, 'support.js'), 'utf8'), sub = fs.readFileSync(path.join(out, 'sub/support.js'), 'utf8');
  assert.match(top, /^window\.__BOARDS_CONFIG = \{"live":false,"root":"",/);
  assert.match(sub, /^window\.__BOARDS_CONFIG = \{"live":false,"root":"\.\.\/",/);
  assert.ok(top.includes('SUBSET_VERSION') && top.includes('BoardsTemplate'));
  // the Interleaf copy is the checkout's
  assert.strictEqual(fs.readFileSync(path.join(out, 'sub/ds/interleaf/tokens.json'), 'utf8'), fs.readFileSync(path.join(ROOT, 'interleaf/tokens.json'), 'utf8'));
  assert.strictEqual(T.SUBSET_VERSION, desc.subset);
});

test('export: the preview pages use relative URLs only (any sub-path)', () => {
  const out = fresh('relative');
  exportDesign({ design: SAMPLES, out: out });
  for (const f of ['index.html', 'view.html', 'canvas.js', 'view.js', 'preview-common.js']) {
    const s = fs.readFileSync(path.join(out, '_boards', f), 'utf8');
    assert.doesNotMatch(s, /(?:href|src)="\//, f);
    assert.doesNotMatch(s, /['"]\/_boards/, f);
    assert.doesNotMatch(s, /fetch\(\s*['"]\//, f);
  }
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /url=_boards\//);
});

test('export: leaves out dotfiles, a copy of ds/ or support.js, links outside; follows a link inside', () => {
  const d = fresh('src'), out = fresh('out-src');
  fs.mkdirSync(path.join(d, 'deep', 'ds', 'interleaf'), { recursive: true });
  fs.writeFileSync(path.join(d, 'canvas.json'), '{"title": "T <x>"}');
  const board = fs.readFileSync(path.join(SAMPLES, 'sub', 'Badge.dc.html'), 'utf8');
  fs.writeFileSync(path.join(d, 'A.dc.html'), board);
  fs.writeFileSync(path.join(d, 'deep', 'B.dc.html'), board);
  fs.writeFileSync(path.join(d, 'deep', 'ds', 'interleaf', 'tokens.json'), '{"stale": true}');
  fs.writeFileSync(path.join(d, 'support.js'), 'alert("old runtime")');
  fs.writeFileSync(path.join(d, '.env'), 'secret');
  fs.writeFileSync(path.join(TMP, 'outside.txt'), 'outside');
  fs.symlinkSync(path.join(TMP, 'outside.txt'), path.join(d, 'up.txt'));
  fs.symlinkSync('A.dc.html', path.join(d, 'Alias.dc.html'));
  const r = exportDesign({ design: d, out: out });
  assert.ok(!fs.existsSync(path.join(out, '.env')));
  assert.ok(!fs.existsSync(path.join(out, 'up.txt')));
  assert.ok(r.skipped.includes('.env') && r.skipped.includes('up.txt') && r.skipped.includes('deep/ds'));
  assert.strictEqual(fs.readFileSync(path.join(out, 'Alias.dc.html'), 'utf8'), board);
  assert.ok(!fs.lstatSync(path.join(out, 'Alias.dc.html')).isSymbolicLink());
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'support.js'), 'utf8'), /old runtime/);
  assert.match(fs.readFileSync(path.join(out, 'deep', 'support.js'), 'utf8'), /"root":"\.\.\/"/);
  assert.doesNotMatch(fs.readFileSync(path.join(out, 'deep', 'ds', 'interleaf', 'tokens.json'), 'utf8'), /stale/);
  assert.match(fs.readFileSync(path.join(out, 'index.html'), 'utf8'), /<title>T &lt;x&gt;<\/title>/);
});

test('export: replaces an earlier export, refuses another folder, and the design folder itself', () => {
  const out = fresh('again');
  exportDesign({ design: SAMPLES, out: out });
  fs.writeFileSync(path.join(out, 'left-over.txt'), 'x');
  exportDesign({ design: SAMPLES, out: out });
  assert.ok(!fs.existsSync(path.join(out, 'left-over.txt')));
  const other = fresh('other');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'keep.txt'), 'mine');
  assert.throws(() => exportDesign({ design: SAMPLES, out: other }), /not an export/);
  assert.strictEqual(fs.readFileSync(path.join(other, 'keep.txt'), 'utf8'), 'mine');
  assert.throws(() => exportDesign({ design: SAMPLES, out: path.join(SAMPLES, 'x') }), /inside the design folder/);
  assert.throws(() => exportDesign({ design: SAMPLES, out: fresh('il'), interleaf: TMP }), /no Interleaf/);
});

test('tools/boards export: the command', () => {
  const out = fresh('cli');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'boards'), 'export', SAMPLES, out], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^boards export: 6 boards of /);
  assert.ok(fs.existsSync(path.join(out, '_boards', 'api', 'canvas.json')));
  const bad = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'boards'), 'export', SAMPLES], { encoding: 'utf8' });
  assert.strictEqual(bad.status, 2);
});

// tools/site-designs: main's designs and the pull requests' as tools/gen-reference --designs reads them
test('tools/site-designs: main and pull requests; a bad name or a broken folder of a pull request is left out', () => {
  const prs = fresh('prs'), stage = fresh('stage');
  const mk = (n, meta) => { fs.mkdirSync(path.join(prs, n, 'designs'), { recursive: true }); fs.writeFileSync(path.join(prs, n, 'pr.json'), JSON.stringify(meta)); };
  mk('7', { number: 7, title: 't', url: 'https://x/7', head: 'ab' });
  fs.cpSync(SAMPLES, path.join(prs, '7', 'designs', 'samples'), { recursive: true });
  fs.mkdirSync(path.join(prs, '7', 'designs', 'bad name'));
  fs.mkdirSync(path.join(prs, '7', 'designs', 'pr-3'));
  // a folder whose canvas cannot be read: left out, and #8 with nothing else is not on the site
  mk('8', { number: 8, title: 'b', url: 'https://x/8', head: 'cd' });
  fs.mkdirSync(path.join(prs, '8', 'designs', 'broken'));
  fs.writeFileSync(path.join(prs, '8', 'designs', 'broken', 'canvas.json'), '{ not json');
  mk('x9', { number: 9 });
  const r = spawnSync('sh', [path.join(ROOT, 'tools', 'site-designs'), stage, prs], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const d of fs.readdirSync(path.join(ROOT, 'designs'), { withFileTypes: true }).filter((e) => e.isDirectory())) {
    assert.ok(fs.existsSync(path.join(stage, d.name, '_boards', 'api', 'canvas.json')), 'main: ' + d.name);
  }
  assert.ok(fs.existsSync(path.join(stage, 'pr-7', 'samples', 'sub', 'support.js')));
  assert.ok(fs.existsSync(path.join(stage, 'pr-7', 'pr.json')));
  assert.deepStrictEqual(fs.readdirSync(path.join(stage, 'pr-7')).sort(), ['pr.json', 'samples']);
  assert.ok(!fs.existsSync(path.join(stage, 'pr-8')) && !fs.existsSync(path.join(stage, 'pr-x9')));
  assert.match(r.stderr, /#7: designs\/bad name: not a usable folder name/);
  assert.match(r.stderr, /#8: designs\/broken did not export/);
  // a folder it did not write is refused
  const other = fresh('not-a-stage');
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(other, 'keep'), '');
  assert.notStrictEqual(spawnSync('sh', [path.join(ROOT, 'tools', 'site-designs'), other], { encoding: 'utf8' }).status, 0);
  assert.ok(fs.existsSync(path.join(other, 'keep')));
});

// spec 003 FR-018: an exported board asks no other site; Google Fonts links get the vendored faces
test('export: a Google Fonts link loads the vendored faces (Interleaf and the design own), no other site', () => {
  const out = fresh('fonts');
  exportDesign({ design: path.join(__dirname, 'fonts'), out: out });
  const css = fs.readFileSync(path.join(out, '_boards', 'fonts', 'google.css'), 'utf8');
  for (const fam of ['IBM Plex Sans', 'IBM Plex Mono', 'Kalam', 'Project Face']) assert.ok(css.includes('"' + fam + '"'), fam);
  const urls = Array.from(css.matchAll(/url\(\s*["']?([^)"']+)/g)).map((m) => m[1]);
  assert.ok(urls.length > 4);
  for (const u of urls) {
    assert.doesNotMatch(u, /^[a-z]+:|^\//i, u);
    assert.ok(fs.existsSync(path.join(out, '_boards', 'fonts', u)), u + ' missing');
  }
  assert.ok(urls.includes('../../fonts/project-face.woff2'));
  // the boards' own links, which the browser reads before the runtime runs, name the stand-in
  assert.match(fs.readFileSync(path.join(out, 'Gf.dc.html'), 'utf8'), /href="_boards\/fonts\/google\.css"/);
  assert.match(fs.readFileSync(path.join(out, 'sub/Part.dc.html'), 'utf8'), /href="\.\.\/_boards\/fonts\/google\.css"/);
  for (const b of ['Gf.dc.html', 'sub/Part.dc.html']) assert.doesNotMatch(fs.readFileSync(path.join(out, b), 'utf8'), /fonts\.(googleapis|gstatic)\.com/, b);
  // the design's own folder is untouched
  assert.match(fs.readFileSync(path.join(__dirname, 'fonts', 'Gf.dc.html'), 'utf8'), /fonts\.googleapis\.com/);
  for (const s of ['support.js', 'sub/support.js']) {
    assert.match(fs.readFileSync(path.join(out, s), 'utf8'), /"googleFonts":"_boards\/fonts\/google\.css"/, s);
  }
  // nothing in the export's own files names another site, except the boards' links the runtime replaces
  const css2 = fs.readdirSync(path.join(out, '_boards'), { recursive: true }).filter((f) => /\.(css|html|js)$/.test(f));
  for (const f of css2) assert.doesNotMatch(fs.readFileSync(path.join(out, '_boards', f), 'utf8'), /https?:\/\/(?!127\.)/, f);
});
