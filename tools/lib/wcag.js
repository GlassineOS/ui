// SPDX-License-Identifier: GPL-2.0-or-later
// WCAG 2.2 colour arithmetic for the contrast check (spec 002 FR-020): relative luminance,
// contrast ratio, alpha compositing and the AA targets.
'use strict';

// "rgb(1, 2, 3)", "rgba(1, 2, 3, 0.5)", "rgb(1 2 3 / 50%)", "#abc", "#aabbcc" -> [r, g, b, a] (0-255, a 0-1)
function parse(s) {
  s = String(s).trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  }
  m = /^rgba?\(([^)]*)\)$/i.exec(s);
  if (!m) throw new Error('not a colour: ' + s);
  const parts = m[1].split(/[\s,/]+/).filter(Boolean);
  const num = function (p, scale) { return /%$/.test(p) ? parseFloat(p) / 100 * scale : parseFloat(p); };
  return [num(parts[0], 255), num(parts[1], 255), num(parts[2], 255), parts.length > 3 ? num(parts[3], 1) : 1];
}

function hex(c) {
  return '#' + c.slice(0, 3).map(function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join('');
}

function channel(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function luminance(c) { return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]); }

function ratio(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// fg with alpha (and an extra opacity) over an opaque bg
function over(fg, bg, opacity) {
  const a = (fg[3] === undefined ? 1 : fg[3]) * (opacity === undefined ? 1 : opacity);
  return [0, 1, 2].map(function (i) { return fg[i] * a + bg[i] * (1 - a); }).concat([1]);
}

// WCAG 2.2: large text is at least 18pt (24px), or 14pt (18.66px) and bold (700)
function isLarge(px, weight) { return px >= 24 || (weight >= 700 && px >= 18.66); }
function textTarget(px, weight) { return isLarge(px, weight) ? 3 : 4.5; }
const NON_TEXT_TARGET = 3;

module.exports = { parse: parse, hex: hex, luminance: luminance, ratio: ratio, over: over, isLarge: isLarge, textTarget: textTarget, NON_TEXT_TARGET: NON_TEXT_TARGET };
