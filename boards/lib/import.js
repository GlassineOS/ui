// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: bring a canvas exported from claude.ai into a repository's design folder. Copies the
// boards, canvas.json and the sample data; leaves out claude.ai's own files and the embedded
// Interleaf copy (003 FR-002, FR-020) and drops "designSystems" from canvas.json.
'use strict';
const fs = require('fs');
const path = require('path');

// paths relative to the export root, and why they stay out
const LEAVE_OUT = [
  { test: function (r) { return r === 'artifact-type' || r.startsWith('artifact-type/'); }, why: "claude.ai's artifact type" },
  { test: function (r) { return r === 'SKILL.md'; }, why: "claude.ai's instructions" },
  { test: function (r) { return r === 'index.html'; }, why: "claude.ai's canvas page" },
  { test: function (r) { return /(^|\/)support\.js$/.test(r); }, why: "claude.ai's runtime hook (the preview serves its own)" },
  { test: function (r) { return /(^|\/)ds(\/|$)/.test(r); }, why: 'the embedded design-system copy (served from GlassineOS/ui)' },
  { test: function (r) { return /(^|\/)\./.test(r); }, why: 'hidden' },
];

function walk(root) {
  const out = [];
  (function w(rel) {
    for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      // lstat: a link in an export could point anywhere on this machine; it is never followed
      const st = fs.lstatSync(path.join(root, r));
      if (st.isSymbolicLink()) out.push({ rel: r, link: true });
      else if (st.isDirectory()) { out.push({ rel: r, dir: true }); w(r); }
      else if (st.isFile()) out.push({ rel: r, dir: false });
      else out.push({ rel: r, special: true });
    }
  })('');
  return out;
}

// importCanvas(src, dest, {force}) → {copied: [rel], left: [{path, why}], canvas: {designSystems}}
function importCanvas(src, dest, opts) {
  opts = opts || {};
  src = path.resolve(src);
  dest = path.resolve(dest);
  if (!fs.existsSync(path.join(src, 'canvas.json'))) throw new Error(src + ' has no canvas.json: not a canvas export');
  if (fs.existsSync(dest) && fs.readdirSync(dest).length && !opts.force) throw new Error(dest + ' is not empty (use --force to copy over it)');
  const copied = [], left = [];
  const skipped = new Set();
  for (const e of walk(src)) {
    const parent = e.rel.includes('/') ? e.rel.slice(0, e.rel.lastIndexOf('/')) : '';
    if (skipped.has(parent)) { skipped.add(e.rel); continue; }
    const rule = LEAVE_OUT.find(function (x) { return x.test(e.rel); });
    if (rule) { left.push({ path: e.rel + (e.dir ? '/' : ''), why: rule.why }); if (e.dir) skipped.add(e.rel); continue; }
    if (e.link) { left.push({ path: e.rel, why: 'a symbolic link (not followed)' }); continue; }
    if (e.special) { left.push({ path: e.rel, why: 'not a regular file' }); continue; }
    if (e.dir) continue;
    const to = path.join(dest, e.rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    if (e.rel === 'canvas.json') {
      const c = JSON.parse(fs.readFileSync(path.join(src, e.rel), 'utf8'));
      const ds = c.designSystems;
      delete c.designSystems;
      fs.writeFileSync(to, JSON.stringify(c, null, 1) + '\n');
      if (ds !== undefined) left.push({ path: 'canvas.json: designSystems', why: 'names the claude.ai copy of Interleaf' });
    } else {
      fs.copyFileSync(path.join(src, e.rel), to);
    }
    copied.push(e.rel);
  }
  return { copied: copied, left: left };
}

module.exports = { importCanvas: importCanvas };
