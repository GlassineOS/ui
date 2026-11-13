// SPDX-License-Identifier: GPL-2.0-or-later
// Shared by the canvas index and the board view: the canvas data and live reload. Every URL is
// relative to the page (the design folder is the parent of _boards/), so the same pages work from
// the preview server and from a static export under any sub-path (tools/boards export).
(function () {
  'use strict';
  const changes = [];
  let watching = false;
  // live reload only where the canvas data says so (the preview server); an export has none
  function watch(d) {
    if (watching || !d.live) return;
    watching = true;
    try { new EventSource('events').addEventListener('change', function (ev) { for (const fn of changes) fn(ev); }); } catch (e) { /* no live reload */ }
  }
  window.Boards = {
    canvas: function () {
      return fetch('api/canvas.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('canvas: HTTP ' + r.status); return r.json(); })
        .then(function (d) { watch(d); return d; });
    },
    onChange: function (fn) { changes.push(fn); },
    el: function (tag, attrs, kids) {
      const e = document.createElement(tag);
      for (const k of Object.keys(attrs || {})) { if (k === 'text') e.textContent = attrs[k]; else if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]); }
      for (const c of kids || []) if (c) e.append(c);
      return e;
    },
    // the design folder, and a board's URL in it
    root: new URL('../', location.href),
    boardHref: function (file) { return '../' + file.split('/').map(encodeURIComponent).join('/'); },
  };
})();
