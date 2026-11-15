// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: the render check (spec 003 FR-012). Renders every board of a design folder in
// headless Chromium at its canvas size (or its $preview size), once as it opens and once in each of
// its named states (FR-050), and reports, per render (board and state), render errors,
// unsupported format features, console errors and requests to other sites (renders have no network).
'use strict';
const path = require('path');
const { startServer, describe } = require('./server.js');
const { openBrowser, renderBoard, pool } = require('./browser.js');
const { readConfig, vendoredFaces } = require('./references.js');
const T = require('../runtime/template.js');

// the renders of a check: every board without a state, then once per named state; a board with
// issues once (its states are not read) → [{b, state: id|null}]
function renderList(boards) {
  const out = [];
  for (const b of boards) {
    out.push({ b: b, state: null });
    if (!b.issues.length) for (const s of b.states) out.push({ b: b, state: s.id });
  }
  return out;
}

// checkDesign({design, interleaf, chromium, boards: [file], jobs, timeout}) → report
async function checkDesign(opts) {
  const design = path.resolve(opts.design);
  const desc = describe(design);
  let boards = desc.boards.filter(function (b) { return b.exists; });
  if (opts.boards && opts.boards.length) {
    const unknown = opts.boards.filter(function (f) { return !boards.some(function (b) { return b.file === f; }); });
    if (unknown.length) throw new Error('no board ' + unknown.join(', ') + ' in ' + design);
    boards = boards.filter(function (b) { return opts.boards.indexOf(b.file) >= 0; });
  }
  const missing = desc.boards.filter(function (b) { return !b.exists; }).map(function (b) { return b.file; });
  if (!boards.length && !opts.allowEmpty) throw new Error('no boards to check in ' + design + ' (--allow-empty if that is intended)');
  const srv = await startServer({ design: design, interleaf: opts.interleaf, live: false });
  let browser;
  try {
    // no network: Google Fonts stylesheets are answered from the vendored fonts (browser.js isolate())
    const faces = vendoredFaces(srv.url, srv.interleaf, design, readConfig(design));
    browser = await openBrowser({ chromium: opts.chromium });
    const renders = renderList(boards);
    const results = await pool(renders, opts.jobs || 4, function (x) {
      return renderBoard(browser, srv.url, x.b.file, { width: x.b.size.width, height: x.b.size.height, state: x.state, timeout: opts.timeout, faces: faces });
    });
    const failed = results.filter(function (r) { return !r.ok; });
    return {
      check: 'boards render', subset: T.SUBSET_VERSION, design: design, interleaf: srv.interleaf,
      summary: { boards: boards.length, renders: results.length, clean: results.length - failed.length, failing: failed.length,
        failingBoards: new Set(failed.map(function (r) { return r.board; })).size, missing: missing.length },
      missing: missing,
      boards: results,
    };
  } finally {
    if (browser) await browser.close();
    await srv.close();
  }
}

function textSummary(rep) {
  const s = rep.summary;
  const lines = ['boards check (subset ' + rep.subset + '): ' + s.boards + ' boards in ' + s.renders + ' renders, ' + s.clean + ' clean, ' + s.failing + ' failing' +
    (s.failing ? ' (' + s.failingBoards + ' boards)' : '') + (s.missing ? ', ' + s.missing + ' on the canvas but missing' : '')];
  for (const m of rep.missing) lines.push('  missing  ' + m);
  for (const r of rep.boards) {
    if (r.ok) continue;
    lines.push('  FAIL ' + r.board + (r.state ? '#' + r.state : '') + (r.settled ? '' : ' (did not settle)'));
    for (const e of r.unsupported) lines.push('    unsupported: ' + (e.board !== r.board ? e.board + ': ' : '') + (e.line ? 'line ' + e.line + ': ' : '') + e.feature + (e.detail ? ' ' + e.detail : ''));
    for (const e of r.errors) lines.push('    ' + e.kind + ': ' + (e.board && e.board !== r.board ? e.board + ': ' : '') + (e.line ? 'line ' + e.line + ': ' : '') + [e.feature, e.detail, e.message].filter(Boolean).join(' '));
    for (const c of r.console) lines.push('    console: ' + c.text.slice(0, 300));
    for (const q of r.requests) lines.push('    request: ' + q.error + ' ' + q.url);
    for (const q of r.external) lines.push('    elsewhere: ' + q.error + ' ' + q.url);
  }
  return lines.join('\n');
}

module.exports = { checkDesign: checkDesign, textSummary: textSummary, renderList: renderList };
