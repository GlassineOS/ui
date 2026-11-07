#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-or-later
// The known contrast failures (spec 002 Acceptance, SC-002): the check must catch each one. Every
// fixture in known.json is injected on its own. A case is caught when it fails with the fixture and
// passes without it. Each fixture lists the cases it must catch (expect): every one must be
// matched by a caught case, and the harness prints the case that matched it. Needs Chromium
// (tools/in-alpine, CI). CONTRAST_KNOWN_DUMP=FILE writes every caught case to FILE.
'use strict';
const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'contrast.js'));
const KNOWN = require('./known.json').known;

function key(c) { return [c.component, c.kind, c.pseudo || '', c.state, c.element, c.text, c.theme, c.pen, c.width, c.control || ''].join('|'); }

// an expectation: kind, theme and text (exact), element (a part of the path), state, control (exact),
// fg and bg (exact), maxRatio (the case's ratio at most this)
function matches(x, c) {
  return c.kind === x.kind && c.theme === x.theme && c.text === x.text &&
    (!x.element || c.element.indexOf(x.element) >= 0) && (!x.state || c.state === x.state) &&
    (x.control === undefined || c.control === x.control) &&
    (!x.fg || c.fg === x.fg) && (!x.bg || c.bg === x.bg) && (x.maxRatio === undefined || c.ratio <= x.maxRatio + 1e-9);
}

function describe(c) {
  return c.ratio + ':1 (' + c.fg + ' on ' + c.bg + '), ' + c.kind + ' "' + c.text + '" ' + c.theme + ' pen ' + c.pen + ' ' + c.width +
    ', ' + c.state + (c.control ? ' of "' + c.control + '"' : '') + ', ' + c.element;
}

(async function () {
  const jobs = Number(process.env.CONTRAST_JOBS) || 6;
  const dump = {};
  let fails = 0;
  const baselines = {};
  for (const k of KNOWN) {
    const scope = k.components.join(',') + '/' + k.themes.join(',');
    if (!baselines[scope]) baselines[scope] = await C.check({ components: k.components, themes: k.themes, jobs: jobs });
    const base = baselines[scope];
    const passing = {};
    for (const c of base.cases) if (c.result === 'pass') passing[key(c)] = true;
    const rep = await C.check({ components: k.components, themes: k.themes, jobs: jobs, injects: [path.join(__dirname, k.fixture)] });
    const caught = rep.cases.filter(function (c) { return c.result === 'fail' && passing[key(c)]; });
    dump[k.name] = caught;
    const errs = base.errors.concat(rep.errors);
    const lines = [];
    let missed = 0;
    for (const x of k.expect) {
      const got = caught.filter(function (c) { return matches(x, c); });
      if (!got.length) { missed++; lines.push('     MISSING ' + JSON.stringify(x)); continue; }
      const lo = got.reduce(function (a, c) { return c.ratio < a.ratio ? c : a; });
      lines.push('     ' + describe(lo) + (got.length > 1 ? ' (and ' + (got.length - 1) + ' more)' : ''));
    }
    if (!errs.length && !missed && k.expect.length) {
      console.log('ok   ' + k.name + ': ' + caught.length + ' cases caught, every expected one among them:');
    } else {
      fails++;
      console.log('FAIL ' + k.name + ': ' + (errs.length ? errs.map(function (e) { return e.error; }).join('; ') :
        !k.expect.length ? 'no expected case listed' : missed + ' of ' + k.expect.length + ' expected cases not caught') +
        ' (' + caught.length + ' cases caught)');
    }
    for (const l of lines) console.log(l);
  }
  if (process.env.CONTRAST_KNOWN_DUMP) fs.writeFileSync(process.env.CONTRAST_KNOWN_DUMP, JSON.stringify(dump, null, 1) + '\n');
  console.log('known failures: ' + (fails ? fails + ' NOT CAUGHT' : 'all ' + KNOWN.length + ' caught'));
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.error(e && e.stack || e); process.exit(2); });
