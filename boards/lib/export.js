// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: a static export of the preview (spec 003 FR-016). Node only, no npm packages.
//
// The folder it writes is what the preview server answers, as files: the design folder, the
// preview's pages at _boards/ with the canvas data (_boards/api/canvas.json, no live reload) and
// Interleaf's fonts (_boards/fonts/), and in every folder that holds a board its support.js (the
// runtime) and ds/interleaf/ (Interleaf), since a board loads both relative to its own page. Every
// URL is relative, so the folder works from any sub-path of a static host.
'use strict';
const fs = require('fs');
const path = require('path');
const { describe, listBoards, runtimeSource, UI_ROOT } = require('./server.js');

const PREVIEW_DIR = path.join(UI_ROOT, 'boards', 'preview');
const MARKER = '.boards-export';
// what a Google Fonts stylesheet link of a board loads in an export (the runtime points it here)
const GOOGLE_CSS = '_boards/fonts/google.css';

// The stylesheet that stands in for Google Fonts, as the checks answer those links (spec 003
// FR-020): Interleaf's vendored faces (copied beside it) and the design's own (references.json
// "fonts"), every url() relative to it. A family in neither is not loaded: the page asks no other site.
// src with every href to fonts.googleapis.com (a stylesheet) or fonts.gstatic.com (the files, a
// preconnect) pointing at the stand-in, relative to dir (the board's folder in the design)
function fontLinks(src, dir) {
  const css = path.posix.relative(dir, GOOGLE_CSS), files = path.posix.dirname(css) + '/';
  return src.replace(/(\bhref\s*=\s*)(["'])https?:\/\/fonts\.(googleapis|gstatic)\.com(?:\/[^"']*)?\2/gi, function (m, a, q, host) {
    return a + q + (host.toLowerCase() === 'googleapis' ? css : files) + q;
  });
}

function googleCss(design, interleaf) {
  let css = '/* written by tools/boards export: the vendored faces in place of Google Fonts */\n';
  const il = path.join(interleaf, 'fonts', 'fonts.css');
  if (fs.existsSync(il)) css += fs.readFileSync(il, 'utf8') + '\n';
  const { readConfig } = require('./references.js');
  const cfg = readConfig(design);
  if (cfg.fonts) {
    const rel = path.posix.normalize(String(cfg.fonts).split(path.sep).join('/'));
    const file = path.join(design, rel);
    if (rel.startsWith('..') || !fs.existsSync(file)) throw new Error('references.json: no fonts at ' + rel);
    const from = path.posix.dirname(GOOGLE_CSS), dir = path.posix.dirname(rel);
    css += fs.readFileSync(file, 'utf8').replace(/url\(\s*(["']?)([^)"']+)\1\s*\)/g, function (m, q, u) {
      if (/^[a-z][a-z0-9+.-]*:|^\/|^#/i.test(u)) return m;
      return 'url("' + path.posix.relative(from, path.posix.join(dir, u)) + '")';
    }) + '\n';
  }
  return css;
}

function inside(root, p) {
  const r = path.relative(root, p);
  return r === '' || !r.startsWith('..') && !path.isAbsolute(r);
}

// copy what the preview would serve below src: no names starting with ".", no symbolic link that
// leads outside src (one inside is copied as what it points at), and none of skip(rel, entry)
function copyTree(src, dest, skip, skipped) {
  const realRoot = fs.realpathSync(src);
  (function walk(rel) {
    fs.mkdirSync(path.join(dest, rel), { recursive: true });
    for (const e of fs.readdirSync(path.join(src, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.name.startsWith('.') || skip && skip(r, e)) { skipped && skipped.push(r); continue; }
      const from = path.join(src, r);
      let st = e;
      if (e.isSymbolicLink()) {
        let real;
        try { real = fs.realpathSync(from); } catch (x) { skipped && skipped.push(r); continue; }
        if (!inside(realRoot, real)) { skipped && skipped.push(r); continue; }
        st = fs.statSync(real);
        // a linked folder could lead back into itself: only linked files are followed
        if (!st.isFile()) { skipped && skipped.push(r); continue; }
      }
      if (st.isDirectory()) walk(r);
      else if (st.isFile()) fs.copyFileSync(from, path.join(dest, r));
    }
  })('');
}

// exportDesign({design, out, interleaf}) → {design, interleaf, out, boards: [file], dirs: [dir], skipped: [rel]}
function exportDesign(opts) {
  const design = path.resolve(opts.design);
  if (!fs.existsSync(path.join(design)) || !fs.statSync(design).isDirectory()) throw new Error('no design folder at ' + design);
  const interleaf = path.resolve(opts.interleaf || path.join(UI_ROOT, 'interleaf'));
  if (!fs.existsSync(path.join(interleaf, 'tokens.json'))) throw new Error('no Interleaf at ' + interleaf + ' (tokens.json missing); pass --interleaf DIR');
  const out = path.resolve(opts.out);
  if (inside(design, out) || inside(out, design)) throw new Error('the export cannot be inside the design folder or hold it: ' + out);
  if (fs.existsSync(out)) {
    // replace only a folder this tool wrote: an export to . or ~ must not wipe anything
    if (fs.readdirSync(out).length && !fs.existsSync(path.join(out, MARKER))) {
      throw new Error(out + ' is not empty and is not an export (no ' + MARKER + ' in it); give an empty or new folder');
    }
    fs.rmSync(out, { recursive: true, force: true });
  }
  const skipped = [];
  // the preview answers these names itself, at any depth, so a copy in the design is never served
  copyTree(design, out, function (rel, e) {
    const base = rel.split('/').pop();
    return base === 'support.js' || base === 'ds' && e.isDirectory() || base === 'node_modules' || rel === '_boards';
  }, skipped);
  const desc = describe(design);
  desc.live = false;
  // a board's links to Google Fonts name the stand-in instead, in the file itself: the browser reads
  // a page's links ahead of the runtime (and of any change it could make), so only the source counts
  for (const b of listBoards(design)) {
    const f = path.join(out, b);
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8'), to = fontLinks(src, path.posix.dirname(b));
    if (to !== src) fs.writeFileSync(f, to);
  }
  const boards = listBoards(design);
  const dirs = Array.from(new Set(boards.map(function (f) { return path.posix.dirname(f); }))).sort();
  for (const d of dirs) {
    const depth = d === '.' ? 0 : d.split('/').length;
    const at = path.join(out, d);
    fs.writeFileSync(path.join(at, 'support.js'), runtimeSource({ live: false, root: '../'.repeat(depth), googleFonts: GOOGLE_CSS }));
    copyTree(interleaf, path.join(at, 'ds', 'interleaf'));
  }
  copyTree(PREVIEW_DIR, path.join(out, '_boards'));
  fs.mkdirSync(path.join(out, '_boards', 'api'), { recursive: true });
  fs.writeFileSync(path.join(out, '_boards', 'api', 'canvas.json'), JSON.stringify(desc) + '\n');
  if (fs.existsSync(path.join(interleaf, 'fonts'))) copyTree(path.join(interleaf, 'fonts'), path.join(out, '_boards', 'fonts'));
  fs.writeFileSync(path.join(out, GOOGLE_CSS), googleCss(design, interleaf));
  // the folder itself opens the canvas, as / does on the server
  if (!fs.existsSync(path.join(out, 'index.html'))) {
    fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html>\n<meta charset="utf-8">\n<title>' +
      desc.title.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) +
      '</title>\n<meta http-equiv="refresh" content="0; url=_boards/">\n<a href="_boards/">The canvas</a>\n');
  }
  fs.writeFileSync(path.join(out, MARKER), '');
  return { design: design, interleaf: interleaf, out: out, title: desc.title, boards: boards, dirs: dirs, skipped: skipped };
}

module.exports = { exportDesign: exportDesign, googleCss: googleCss, fontLinks: fontLinks, MARKER: MARKER, GOOGLE_CSS: GOOGLE_CSS };
