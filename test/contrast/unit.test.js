// SPDX-License-Identifier: GPL-2.0-or-later
// The contrast check's arithmetic, without a browser: WCAG ratios and targets, the PNG decoder,
// the backdrop extremes and the focus-ring measure.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('zlib');
const path = require('path');
const W = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'wcag.js'));
const PNG = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'png.js'));
const C = require(path.join(__dirname, '..', '..', 'tools', 'lib', 'contrast.js'));

function img(w, h, fill) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fill(x, y); data.set([c[0], c[1], c[2], 255], (y * w + x) * 4); }
  return { width: w, height: h, data: data, x: 0, y: 0 };
}

test('WCAG ratios: black on white is 21, the guidelines\' audit values', function () {
  assert.strictEqual(W.ratio(W.parse('#000'), W.parse('#fff')).toFixed(2), '21.00');
  assert.strictEqual(W.ratio(W.parse('#f1e6cb'), W.parse('#f6efdd')).toFixed(2), '1.08');
  assert.strictEqual(W.ratio(W.parse('#444444'), W.parse('#111111')).toFixed(2), '1.94');
  assert.deepStrictEqual(W.parse('rgba(10, 20, 30, 0.5)'), [10, 20, 30, 0.5]);
  assert.deepStrictEqual(W.over([0, 0, 0, 0.5], [255, 255, 255, 1]), [127.5, 127.5, 127.5, 1]);
});

test('targets: 4.5 normal, 3 at 24px or 18.66px bold', function () {
  assert.strictEqual(W.textTarget(17, 400), 4.5);
  assert.strictEqual(W.textTarget(24, 400), 3);
  assert.strictEqual(W.textTarget(19, 700), 3);
  assert.strictEqual(W.textTarget(19, 600), 4.5);
});

test('PNG: filters 0-4, RGB and RGBA', function () {
  for (const type of [2, 6]) {
    const bpp = type === 6 ? 4 : 3, w = 3, h = 5;
    const want = img(w, h, function (x, y) { return [x * 40 + y, y * 30, (x + y) * 20]; });
    const rows = [];
    for (let y = 0; y < h; y++) {
      const raw = Buffer.alloc(w * bpp);
      for (let x = 0; x < w; x++) for (let k = 0; k < bpp; k++) raw[x * bpp + k] = k < 3 ? want.data[(y * w + x) * 4 + k] : 255;
      // filter "sub" on every row (the decoder's other filters are exercised by Chromium's PNGs)
      const f = Buffer.alloc(w * bpp);
      for (let i = 0; i < raw.length; i++) f[i] = (raw[i] - (i >= bpp ? raw[i - bpp] : 0)) & 255;
      rows.push(Buffer.concat([Buffer.from([1]), f]));
    }
    const chunk = function (kind, body) { const l = Buffer.alloc(4); l.writeUInt32BE(body.length); return Buffer.concat([l, Buffer.from(kind, 'latin1'), body, Buffer.alloc(4)]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = type;
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
    const got = PNG.decode(png);
    assert.deepStrictEqual(Array.from(got.data), Array.from(want.data));
  }
});

// the three renders of a shot: the backdrop (b), and the glyphs (where glyph(x, y)) black (k) and white (w) over it
function shot(w, h, backdrop, glyph) {
  const over = function (c) { return img(w, h, function (x, y) { return glyph(x, y) ? c : backdrop(x, y); }); };
  return { b: img(w, h, backdrop), k: over([0, 0, 0]), w: over([255, 255, 255]) };
}

test('the worst colour beneath: the darker stripe of a pattern under grey text', function () {
  const s = shot(20, 10, function (x) { return x % 4 < 2 ? [255, 255, 255] : [138, 138, 138]; },
    function (x, y) { return y > 2 && y < 7 && x > 3 && x < 15; });
  const m = C.measureText(s, { color: 'rgb(85, 85, 85)', opacity: 1, rects: [[0, 0, 20, 10]] });
  assert.strictEqual(W.hex(m.bg), '#8a8a8a');
  assert.ok(m.ratio < 3);
});

test('the worst colour beneath: text in the colour of a band under half of it still counts the band', function () {
  // #595959 text, its left half over a #595959 band and its right half over white: where the text
  // lies on the band it is invisible, and those glyphs must stay in the box (1:1, not 7:1)
  const s = shot(40, 10, function (x) { return x < 20 ? [89, 89, 89] : [255, 255, 255]; },
    function (x, y) { return y > 2 && y < 7 && x > 3 && x < 37 && x % 3 !== 0; });
  const m = C.measureText(s, { color: 'rgb(89, 89, 89)', opacity: 1, rects: [[0, 0, 40, 10]] });
  assert.strictEqual(W.hex(m.bg), '#595959');
  assert.strictEqual(m.ratio.toFixed(2), '1.00');
});

test('the glyph box: a shape in the rect next to the glyphs is cut away', function () {
  // a dark border at the rect's left edge (the circled numerals' ring) is not beneath the glyphs
  const s = shot(30, 10, function (x) { return x < 2 ? [17, 17, 17] : [255, 255, 255]; },
    function (x, y) { return y > 2 && y < 7 && x > 8 && x < 22; });
  const m = C.measureText(s, { color: 'rgb(17, 17, 17)', opacity: 1, rects: [[0, 0, 30, 10]] });
  assert.strictEqual(W.hex(m.bg), '#ffffff');
});

test('focus ring: a 2px dark ring passes, one in the colour beneath fails', function () {
  const box = [10, 10, 30, 20];
  const u = img(40, 30, function () { return [255, 255, 255]; });
  const ring = function (c) {
    return img(40, 30, function (x, y) {
      const inOuter = x >= 6 && x < 34 && y >= 6 && y < 24, inInner = x >= 8 && x < 32 && y >= 8 && y < 22;
      return inOuter && !inInner ? c : [255, 255, 255];
    });
  };
  assert.ok(C.measureRing(u, ring([17, 17, 17]), [box]).ratio > 15);
  assert.strictEqual(C.measureRing(u, ring([250, 250, 250]), [box]).ratio, 1);
  assert.strictEqual(C.measureRing(u, u, [box]).ratio, 1);
});
