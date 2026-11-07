#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-or-later
// The contrast check measured against a page of known answers (selftest/Cases/preview.html):
// worst colour beneath a pattern and a band (also a band in the text's own colour), generated
// text, large text, the disabled exemption, focus rings, hover, the current item and opened details. Needs Chromium (tools/in-alpine, CI).
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'contrast.js'));

// [what, match(case), expected result]
const EXPECT = [
  ['text over a pattern: the worst stripe counts', function (c) { return c.text === 'stripes-fail' && c.state === 'default'; }, 'fail'],
  ['text over a highlighter band: the band counts', function (c) { return c.text === 'band-fail'; }, 'fail'],
  ['text in the colour of the band under half of it: the band counts', function (c) { return c.text === 'same-colour-band-fail' && c.ratio < 1.1; }, 'fail'],
  ['generated ::after text is measured', function (c) { return c.pseudo === '::after' && /gen-after-low/.test(c.text); }, 'fail'],
  ['its host text passes', function (c) { return c.text === 'gen-host-pass'; }, 'pass'],
  ['large text: 3:1', function (c) { return c.text === 'large-pass'; }, 'pass'],
  ['the same colour at 16px: 4.5:1', function (c) { return c.text === 'small-fail'; }, 'fail'],
  ['a disabled control is informational', function (c) { return c.text === 'disabled-info' && c.state === 'default'; }, 'info'],
  ['a button without a focus ring fails', function (c) { return c.kind === 'focus-ring' && c.control === 'no-ring'; }, 'fail'],
  ['a 2px ink ring passes', function (c) { return c.kind === 'focus-ring' && c.control === 'ink-ring'; }, 'pass'],
  ['a faint ring fails', function (c) { return c.kind === 'focus-ring' && c.control === 'faint-ring'; }, 'fail'],
  ['hover is measured in its own state', function (c) { return c.text === 'hover-link' && c.state === 'hover'; }, 'fail'],
  ['and the link passes by default', function (c) { return c.text === 'hover-link' && c.state === 'default'; }, 'pass'],
  ['the current item is its own state', function (c) { return c.text === 'current-fail' && c.state === 'current'; }, 'fail'],
  ['a closed details is opened', function (c) { return c.text === 'opened-fail' && c.state === 'open'; }, 'fail'],
  ['a counter numeral (::before) is measured', function (c) { return c.pseudo === '::before' && /counter/.test(c.text); }, 'fail'],
  ['::first-letter is measured on its own', function (c) { return c.pseudo === '::first-letter'; }, 'fail'],
  ['the rest of that text passes', function (c) { return c.text === 'ropcap-rest-pass'; }, 'pass'],
];

(async function () {
  const rep = await C.check({ previews: path.join(__dirname, 'selftest'), themes: ['white-paper'], widths: ['desktop'], jobs: 3 });
  let fails = rep.errors.length;
  for (const e of rep.errors) console.log('ERROR ' + e.error);
  for (const x of EXPECT) {
    const got = rep.cases.filter(x[1]);
    const bad = !got.length ? 'no case' : got.filter(function (c) { return c.result !== x[2]; }).map(function (c) { return c.result + ' ' + c.ratio + ':1 pen ' + c.pen; }).join(', ');
    if (bad) fails++;
    console.log((bad ? 'FAIL ' : 'ok   ') + x[0] + ' (' + x[2] + (bad ? '; got ' + bad : ', ' + got.length + ' cases') + ')');
  }
  console.log('contrast self-test: ' + (fails ? fails + ' FAILED' : 'all passed'));
  process.exit(fails ? 1 : 0);
})().catch(function (e) { console.error(e && e.stack || e); process.exit(2); });
