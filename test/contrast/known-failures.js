#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-or-later
// The known contrast failures (spec 002 Acceptance, SC-002): the check must catch each one. Every
// fixture in known.json is injected on its own; it is caught when a case matching its expectation
// fails with the fixture and passes without it. Needs Chromium (tools/in-alpine, CI).
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'contrast.js'));
const KNOWN = require('./known.json').known;

function key(c) { return [c.component, c.kind, c.pseudo || '', c.state, c.element, c.text, c.theme, c.pen, c.width].join('|'); }

(async function () {
  const jobs = Number(process.env.CONTRAST_JOBS) || 6;
  let fails = 0;
  const baselines = {};
  for (const k of KNOWN) {
    const scope = k.components.join(',') + '/' + k.themes.join(',');
    if (!baselines[scope]) baselines[scope] = await C.check({ components: k.components, themes: k.themes, jobs: jobs });
    const base = baselines[scope];
    const passing = {};
    for (const c of base.cases) if (c.result === 'pass') passing[key(c)] = true;
    const rep = await C.check({ components: k.components, themes: k.themes, jobs: jobs, injects: [path.join(__dirname, k.fixture)] });
    const caught = rep.cases.filter(function (c) {
      return c.result === 'fail' && passing[key(c)] && c.kind === k.expect.kind && (!k.expect.element || c.element.indexOf(k.expect.element) >= 0);
    });
    const errs = base.errors.concat(rep.errors);
    if (caught.length && !errs.length) {
      const lo = caught.reduce(function (a, c) { return c.ratio < a.ratio ? c : a; });
      console.log('ok   ' + k.name + ': ' + caught.length + ' cases fail, lowest ' + lo.ratio + ':1 (' + lo.fg + ' on ' + lo.bg + ', ' +
        lo.theme + ' pen ' + lo.pen + ' ' + lo.width + ', ' + lo.state + ', ' + lo.element + ')');
    } else {
      fails++;
      console.log('FAIL ' + k.name + ': not caught' + (errs.length ? ' (' + errs.map(function (e) { return e.error; }).join('; ') + ')' : ''));
    }
  }
  console.log('known failures: ' + (fails ? fails + ' NOT CAUGHT' : 'all ' + KNOWN.length + ' caught'));
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.error(e && e.stack || e); process.exit(2); });
