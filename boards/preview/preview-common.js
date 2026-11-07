// SPDX-License-Identifier: GPL-2.0-or-later
// Shared by the canvas index and the board view: the canvas API and live reload.
window.Boards = {
  canvas: function () { return fetch('/_boards/api/canvas', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('canvas: HTTP ' + r.status); return r.json(); }); },
  onChange: function (fn) { try { new EventSource('/_boards/events').addEventListener('change', fn); } catch (e) { /* no live reload */ } },
  el: function (tag, attrs, kids) {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
    for (const c of kids || []) if (c) e.append(c);
    return e;
  },
  boardHref: function (file) { return '/' + file.split('/').map(encodeURIComponent).join('/'); },
};
