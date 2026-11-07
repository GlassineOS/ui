// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: the preview server (spec 003 FR-010, FR-013, FR-020). Node only, no npm packages.
//
//   /                      the design folder (boards, canvas.json, data/)
//   **/support.js          the runtime (vendored Preact + template.js + runtime.js), in place of the
//                          file claude.ai serves there
//   **/ds/interleaf/**     Interleaf from this checkout (or --interleaf), never a copy in the design
//   /_boards/              the canvas index, the board view, the canvas API, live-reload events
'use strict';
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const T = require('../runtime/template.js');

const UI_ROOT = path.resolve(__dirname, '..', '..');
const RUNTIME_DIR = path.join(UI_ROOT, 'boards', 'runtime');
const PREVIEW_DIR = path.join(UI_ROOT, 'boards', 'preview');
const RUNTIME_FILES = ['vendor/preact-10.29.8/preact.umd.js', 'template.js', 'runtime.js'];

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.ico': 'image/x-icon', '.pdf': 'application/pdf',
};

function runtimeSource(config) {
  let s = 'window.__BOARDS_CONFIG = ' + JSON.stringify(config) + ';\n';
  for (const f of RUNTIME_FILES) {
    s += fs.readFileSync(path.join(RUNTIME_DIR, f), 'utf8').replace(/\/\/# sourceMappingURL=\S+/g, '') + '\n;\n';
  }
  return s;
}

// every *.dc.html below dir (paths with "/"), leaving out ds/ (at any depth), hidden folders and links
function listBoards(dir) {
  const out = [];
  (function walk(rel) {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) { if (e.name !== 'ds') walk(r); }
      else if (e.isFile() && e.name.endsWith('.dc.html')) out.push(r);
    }
  })('');
  return out.sort();
}

function readCanvas(dir) {
  const p = path.join(dir, 'canvas.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// The canvas description with every board's data-props and issues: what the index and the check use.
function describe(dir) {
  const canvas = readCanvas(dir) || {};
  const files = listBoards(dir);
  const onDisk = new Set(files);
  const entries = canvas.boards || {};
  const names = Array.from(new Set((canvas.order || []).filter(function (f) { return entries[f]; }).concat(Object.keys(entries), files)));
  const boards = names.map(function (f) {
    const c = entries[f] || null;
    const b = { file: f, exists: onDisk.has(f), onCanvas: !!c, title: c && c.title || f, page: c && c.page || null,
      x: c ? c.x : null, y: c ? c.y : null, w: c ? c.w : null, h: c ? c.h : null,
      interactive: !!(c && c.is_interactive), expand: c && c.expand || null, props: {}, preview: null, issues: [] };
    if (b.exists) {
      const doc = T.parseBoard(fs.readFileSync(path.join(dir, f), 'utf8'), f);
      b.props = doc.props;
      b.preview = doc.preview;
      b.issues = doc.issues;
      if (!c) b.title = doc.title || f;
    }
    const w = b.w || b.preview && b.preview.width || 1280, hh = b.h || b.preview && b.preview.height || 800;
    b.size = { width: Math.round(w), height: Math.round(hh) };
    return b;
  });
  return { subset: T.SUBSET_VERSION, title: canvas.title || path.basename(path.resolve(dir)), pages: canvas.pages || [],
    launch: canvas.launch || null, notes: canvas.notes || {}, boards: boards };
}

// the file for a path below root, or null: no "." segment (dotfiles, ..), no NUL, and after
// following links still inside root (a link in the design folder never serves what it points at)
function within(root, rel) {
  if (rel.indexOf('\0') >= 0) return null;
  const segs = rel.split(/[\/\\]/).filter(Boolean);
  if (segs.some(function (x) { return x[0] === '.'; })) return null;
  const p = path.resolve(root, segs.join(path.sep) || '.');
  if (!inside(root, p)) return null;
  let real;
  try { real = fs.realpathSync(p); } catch (e) { return p; } // missing: 404 later
  return inside(fs.realpathSync(root), real) ? real : null;
}
function inside(root, p) {
  const r = path.relative(root, p);
  return r === '' || !r.startsWith('..') && !path.isAbsolute(r);
}

function notFound(res) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found\n'); }

function sendFile(res, file) {
  if (!file) return notFound(res);
  fs.stat(file, function (err, st) {
    if (err || !st.isFile()) return notFound(res);
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    const s = fs.createReadStream(file);
    s.on('error', function () { res.destroy(); });
    s.pipe(res);
  });
}

// The names a request's Host (and Origin, when sent) may carry: localhost, the bound address, every
// local address when bound to all of them, and the names given with allowHosts. Anything else is
// refused, so a page elsewhere cannot read the design folder through DNS rebinding.
function allowedHosts(host, extra) {
  const ok = new Set(['localhost', '127.0.0.1', '::1']);
  const wild = host === '0.0.0.0' || host === '::' || host === '';
  if (!wild) ok.add(host.replace(/^\[|\]$/g, '').toLowerCase());
  else {
    const ifs = os.networkInterfaces();
    for (const k of Object.keys(ifs)) for (const a of ifs[k] || []) ok.add(a.address.toLowerCase().replace(/%.*$/, ''));
    ok.add(os.hostname().toLowerCase());
  }
  for (const h of extra || []) ok.add(String(h).toLowerCase());
  return ok;
}
function hostName(v) {
  if (!v) return null;
  const m = /^\[([^\]]+)\](?::\d+)?$/.exec(v) || /^([^:]+)(?::\d+)?$/.exec(v);
  return m ? m[1].toLowerCase() : null;
}

// startServer({design, interleaf, host = '127.0.0.1', port = 0, live = true, allowHosts}) → {url, port, close()}
function startServer(opts) {
  const design = path.resolve(opts.design);
  if (!fs.existsSync(design)) throw new Error('no design folder at ' + design);
  const interleaf = path.resolve(opts.interleaf || path.join(UI_ROOT, 'interleaf'));
  if (!fs.existsSync(path.join(interleaf, 'tokens.json'))) throw new Error('no Interleaf at ' + interleaf + ' (tokens.json missing); pass --interleaf DIR');
  const host = opts.host || '127.0.0.1';
  const hosts = allowedHosts(host, opts.allowHosts);
  const live = opts.live !== false;
  const clients = new Set();
  const watchers = [];

  function handle(req, res) {
    const hn = hostName(req.headers.host);
    let on = null;
    if (req.headers.origin && req.headers.origin !== 'null') { try { on = new URL(req.headers.origin).hostname.replace(/^\[|\]$/g, '').toLowerCase(); } catch (e) { on = '?'; } }
    if (!hn || !hosts.has(hn) || on !== null && !hosts.has(on)) { res.writeHead(403, { 'content-type': 'text/plain' }); res.end('host not allowed (see --allow-host)\n'); return; }
    let u;
    try { u = new URL(req.url, 'http://x'); } catch (e) { res.writeHead(400); res.end(); return; }
    let p;
    try { p = decodeURIComponent(u.pathname); } catch (e) { res.writeHead(400); res.end(); return; }
    if (p.indexOf('\0') >= 0) { res.writeHead(400); res.end(); return; }
    if (p === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    if (p === '/') { res.writeHead(302, { location: '/_boards/' }); res.end(); return; }
    if (p === '/_boards/events') {
      if (!live) return notFound(res);
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': boards\n\n');
      clients.add(res);
      req.on('close', function () { clients.delete(res); });
      return;
    }
    if (p === '/_boards/api/canvas') {
      const body = JSON.stringify(describe(design));
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(body);
      return;
    }
    if (p === '/_boards/' || p === '/_boards/index.html') return sendFile(res, path.join(PREVIEW_DIR, 'index.html'));
    if (p.startsWith('/_boards/')) return sendFile(res, within(PREVIEW_DIR, p.slice('/_boards/'.length)));
    if (/(^|\/)support\.js$/.test(p)) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(runtimeSource({ live: live, events: '/_boards/events' }));
      return;
    }
    const ds = /(?:^|\/)ds\/interleaf\/(.*)$/.exec(p);
    if (ds) return sendFile(res, within(interleaf, ds[1]));
    const f = within(design, p.slice(1));
    if (f && fs.existsSync(f) && fs.statSync(f).isDirectory()) { res.writeHead(302, { location: '/_boards/' }); res.end(); return; }
    sendFile(res, f);
  }

  const server = http.createServer(function (req, res) {
    try { handle(req, res); } catch (e) {
      if (!res.headersSent) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end(String(e && e.message || e) + '\n'); } else res.destroy();
    }
  });

  if (live) {
    let timer = null, changed = new Set();
    const fire = function (root) {
      return function (ev, name) {
        if (name) changed.add(path.join(root, String(name)));
        clearTimeout(timer);
        timer = setTimeout(function () {
          const files = Array.from(changed);
          changed = new Set();
          const rel = files.map(function (f) { return path.relative(design, f); });
          for (const c of clients) c.write('event: change\ndata: ' + JSON.stringify({ files: rel }) + '\n\n');
        }, 120);
      };
    };
    for (const root of [design, interleaf, RUNTIME_DIR]) {
      try { watchers.push(fs.watch(root, { recursive: true }, fire(root))); } catch (e) { /* no recursive watch here */ }
    }
  }
  const keepalive = live ? setInterval(function () { for (const c of clients) c.write(': ping\n\n'); }, 25000) : null;

  return new Promise(function (resolve, reject) {
    server.once('error', reject);
    server.listen(opts.port || 0, host, function () {
      const port = server.address().port;
      const shown = host.indexOf(':') >= 0 ? '[' + host + ']' : host === '0.0.0.0' ? '127.0.0.1' : host;
      resolve({
        url: 'http://' + shown + ':' + port + '/', port: port, design: design, interleaf: interleaf,
        close: function () {
          for (const w of watchers) w.close();
          if (keepalive) clearInterval(keepalive);
          for (const c of clients) c.end();
          return new Promise(function (r) { server.close(function () { r(); }); server.closeAllConnections && server.closeAllConnections(); });
        },
      });
    });
  });
}

module.exports = { startServer: startServer, describe: describe, listBoards: listBoards, runtimeSource: runtimeSource, UI_ROOT: UI_ROOT };
