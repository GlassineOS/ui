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
  const boards = listBoards(design);
  const dirs = Array.from(new Set(boards.map(function (f) { return path.posix.dirname(f); }))).sort();
  for (const d of dirs) {
    const depth = d === '.' ? 0 : d.split('/').length;
    const at = path.join(out, d);
    fs.writeFileSync(path.join(at, 'support.js'), runtimeSource({ live: false, root: '../'.repeat(depth) }));
    copyTree(interleaf, path.join(at, 'ds', 'interleaf'));
  }
  copyTree(PREVIEW_DIR, path.join(out, '_boards'));
  fs.mkdirSync(path.join(out, '_boards', 'api'), { recursive: true });
  fs.writeFileSync(path.join(out, '_boards', 'api', 'canvas.json'), JSON.stringify(desc) + '\n');
  if (fs.existsSync(path.join(interleaf, 'fonts'))) copyTree(path.join(interleaf, 'fonts'), path.join(out, '_boards', 'fonts'));
  // the folder itself opens the canvas, as / does on the server
  if (!fs.existsSync(path.join(out, 'index.html'))) {
    fs.writeFileSync(path.join(out, 'index.html'), '<!doctype html>\n<meta charset="utf-8">\n<title>' +
      desc.title.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }) +
      '</title>\n<meta http-equiv="refresh" content="0; url=_boards/">\n<a href="_boards/">The canvas</a>\n');
  }
  fs.writeFileSync(path.join(out, MARKER), '');
  return { design: design, interleaf: interleaf, out: out, title: desc.title, boards: boards, dirs: dirs, skipped: skipped };
}

module.exports = { exportDesign: exportDesign, MARKER: MARKER };
