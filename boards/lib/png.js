// SPDX-License-Identifier: GPL-2.0-or-later
// Images for the reference checks (spec 002 FR-022, spec 003 FR-011): decode and encode PNG, and
// compare two renders pixel by pixel. Node only, no npm packages.
'use strict';
const zlib = require('zlib');

// ---- PNG: 8-bit, not interlaced (what Chromium writes and encode() writes) ------------------------
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const CRC = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// decode(buffer) → {width, height, data: RGBA bytes}
function decode(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off), name = buf.toString('latin1', off + 4, off + 8), body = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (name === 'IHDR') { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'PLTE') palette = body;
    else if (name === 'tRNS') trns = body;
    else if (name === 'IDAT') idat.push(body);
    else if (name === 'IEND') break;
  }
  if (depth !== 8 || interlace || !(type in CHANNELS)) throw new Error('PNG: only 8-bit, not interlaced (depth ' + depth + ', type ' + type + ')');
  const ch = CHANNELS[type], stride = w * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * h) throw new Error('PNG: short image data');
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? px[dst + i - ch] : 0, b = y ? px[up + i] : 0, c = y && i >= ch ? px[up + i - ch] : 0;
      const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
      px[dst + i] = (raw[src + i] + p) & 255;
    }
  }
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += ch) {
    const o = i * 4;
    if (type === 0) { data[o] = data[o + 1] = data[o + 2] = px[j]; data[o + 3] = 255; }
    else if (type === 4) { data[o] = data[o + 1] = data[o + 2] = px[j]; data[o + 3] = px[j + 1]; }
    else if (type === 2) { data[o] = px[j]; data[o + 1] = px[j + 1]; data[o + 2] = px[j + 2]; data[o + 3] = 255; }
    else if (type === 6) { data[o] = px[j]; data[o + 1] = px[j + 1]; data[o + 2] = px[j + 2]; data[o + 3] = px[j + 3]; }
    else { const k = px[j]; data[o] = palette[k * 3]; data[o + 1] = palette[k * 3 + 1]; data[o + 2] = palette[k * 3 + 2]; data[o + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { width: w, height: h, data: data };
}

function chunk(name, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

// encode({width, height, data: RGBA}) → PNG buffer, lossless and as small as a plain encoder
// gets it: alpha dropped (renders are opaque), greyscale when every pixel is grey, a palette
// when there are at most 256 colours, else RGB; each row with the filter that suits it best,
// zlib at level 9. The same pixels give the same bytes everywhere.
function encode(img) {
  const w = img.width, h = img.height, d = img.data, n = w * h;
  let grey = true;
  const colours = new Map();
  for (let i = 0; i < n * 4; i += 4) {
    if (d[i] !== d[i + 1] || d[i] !== d[i + 2]) grey = false;
    if (colours.size <= 256) { const k = d[i] << 16 | d[i + 1] << 8 | d[i + 2]; if (!colours.has(k)) colours.set(k, colours.size); }
    if (!grey && colours.size > 256) break;
  }
  const type = grey ? 0 : colours.size <= 256 ? 3 : 2, ch = type === 2 ? 3 : 1, stride = w * ch;
  const px = Buffer.alloc(stride * h);
  let plte = null;
  if (type === 0) for (let i = 0; i < n; i++) px[i] = d[i * 4];
  else if (type === 2) for (let i = 0; i < n; i++) { px[i * 3] = d[i * 4]; px[i * 3 + 1] = d[i * 4 + 1]; px[i * 3 + 2] = d[i * 4 + 2]; }
  else {
    // the palette in colour order, so that its bytes don't depend on the first pixels
    const sorted = Array.from(colours.keys()).sort(function (a, b) { return a - b; });
    const at = new Map(sorted.map(function (k, i) { return [k, i]; }));
    plte = Buffer.alloc(sorted.length * 3);
    sorted.forEach(function (k, i) { plte[i * 3] = k >> 16 & 255; plte[i * 3 + 1] = k >> 8 & 255; plte[i * 3 + 2] = k & 255; });
    for (let i = 0; i < n; i++) px[i] = at.get(d[i * 4] << 16 | d[i * 4 + 1] << 8 | d[i * 4 + 2]);
  }
  const raw = Buffer.alloc((stride + 1) * h), cand = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = y * stride, up = row - stride, dst = y * (stride + 1);
    let best = -1, bestSum = Infinity;
    // a palette's indices have no order to predict: no filter
    for (const f of type === 3 ? [0] : [0, 1, 2, 3, 4]) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= ch ? px[row + i - ch] : 0, b = y ? px[up + i] : 0, c = y && i >= ch ? px[up + i - ch] : 0;
        const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (px[row + i] - p) & 255;
        cand[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; cand.copy(raw, dst + 1); }
    }
    raw[dst] = best;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = type;
  return Buffer.concat([SIG, chunk('IHDR', ihdr)].concat(plte ? [chunk('PLTE', plte)] : [],
    [chunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// compare(a, b, {threshold}) → {width, height, sameSize, differing, maxDelta, box, diff}
//   A pixel differs when one of its colour channels differs by more than threshold (0..255).
//   differing: their count (every pixel of the larger image outside the smaller counts when the
//   sizes differ); maxDelta: the largest channel difference; box: the bounding box of the
//   differing pixels or null; diff: {width, height, data} (the union size) with the reference
//   faded to a light grey, the differing pixels red, and an area only one image has blue.
function compare(a, b, opts) {
  const threshold = opts && opts.threshold || 0;
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  const out = Buffer.alloc(w * h * 4);
  let differing = 0, maxDelta = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const inA = x < a.width && y < a.height, inB = x < b.width && y < b.height;
      let bad = false;
      if (inA && inB) {
        const i = (y * a.width + x) * 4, j = (y * b.width + x) * 4;
        const d = Math.max(Math.abs(a.data[i] - b.data[j]), Math.abs(a.data[i + 1] - b.data[j + 1]), Math.abs(a.data[i + 2] - b.data[j + 2]));
        if (d > maxDelta) maxDelta = d;
        if (d > threshold) { bad = true; out[o] = 255; out[o + 1] = 0; out[o + 2] = 0; }
        else {
          // the reference, faded: its luminance mapped to 200..255
          const l = 0.299 * a.data[i] + 0.587 * a.data[i + 1] + 0.114 * a.data[i + 2];
          const v = Math.round(200 + l * 55 / 255);
          out[o] = out[o + 1] = out[o + 2] = v;
        }
      } else {
        bad = true;
        out[o] = 0; out[o + 1] = 90; out[o + 2] = 255;
      }
      out[o + 3] = 255;
      if (bad) {
        differing++;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
      }
    }
  }
  return {
    width: w, height: h, sameSize: a.width === b.width && a.height === b.height, differing: differing, maxDelta: maxDelta,
    box: x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 },
    diff: { width: w, height: h, data: out },
  };
}

module.exports = { decode: decode, encode: encode, compare: compare };
