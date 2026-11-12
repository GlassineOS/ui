// SPDX-License-Identifier: GPL-2.0-or-later
// Design boards: a live picture of the preview (spec 003 FR-013), for a viewer in another program (the
// hub's design view). One headless Chromium shows the preview of a design folder; its pixels go out
// as lossless PNG frames and the viewer's pointer, wheel, touch and keys come in. The protocol is JSON,
// one message per line (tools/boards stream: stdin and stdout; README "Boards").
//
// In (commands):
//   {"op":"open", "board":FILE, "voice"?, "scheme"?, "pen"?, "width"?, "height"?}   one board, alone in
//        the page at that size (default: its size on the canvas), as a shot renders it
//   {"op":"canvas", "page"?}                     the canvas index
//   {"op":"viewport", "width", "height"}         the page's size
//   {"op":"mouse", "type": "mousePressed"|"mouseReleased"|"mouseMoved", "x", "y", "button"?, "buttons"?,
//        "clickCount"?, "modifiers"?}
//   {"op":"wheel", "x", "y", "deltaX"?, "deltaY"?, "modifiers"?}
//   {"op":"touch", "type": "touchStart"|"touchMove"|"touchEnd"|"touchCancel", "points": [{"x","y","id"?}],
//        "modifiers"?}
//   {"op":"key", "type": "keyDown"|"keyUp"|"rawKeyDown"|"char", "key"?, "code"?, "text"?, "modifiers"?,
//        "keyCode"?}
//   {"op":"state"}                               the state again
//   {"op":"frame"}                               a whole frame now, changed or not
// Out (events):
//   {"ev":"ready", "url"}                        the preview's address inside the stream
//   {"ev":"frame", "seq", "width", "height", "png": BASE64}   every time the picture changes
//   {"ev":"state", "view": "canvas"|"board"|"view"|"other", "board"?, "voice"?, "scheme"?, "pen"?,
//        "page"?, "width", "height", "url"}         whenever what is shown changes
//   {"ev":"blocked", "url", "error"}             a request the page made elsewhere, refused
//   {"ev":"error", "message", "op"?}             a command that could not be done; the stream goes on
//   {"ev":"crashed", "message"}                  the page is gone; "canvas" or "open" starts a new one
// Coordinates are page pixels, the frame's pixels. The page loads nothing but the preview.
'use strict';
const path = require('path');
const { startServer, describe, listBoards } = require('./server.js');
const { openBrowser, boardUrl, isolate } = require('./browser.js');
const { readConfig, vendoredFaces, webCombinations } = require('./references.js');
const { validChoices, resolveChoices } = require('./shot.js');

const MOUSE = ['mousePressed', 'mouseReleased', 'mouseMoved'];
const TOUCH = ['touchStart', 'touchMove', 'touchEnd', 'touchCancel'];
const KEY = ['keyDown', 'keyUp', 'rawKeyDown', 'char'];
const BUTTONS = ['none', 'left', 'middle', 'right', 'back', 'forward'];
const MAX_SIDE = 4096;

function num(v, what) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(what + ' must be a number');
  return n;
}
function side(v, what) {
  const n = Math.round(num(v, what));
  if (n < 1 || n > MAX_SIDE) throw new Error(what + ' must be 1 to ' + MAX_SIDE);
  return n;
}
function short(v, max) { return v === undefined ? undefined : String(v).slice(0, max || 64); }
// a PNG's size from its header
function pngSize(buf) { return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }; }

// startStream({design, interleaf, web, chromium, width, height, onEvent}) → {url, send(cmd), close()}
async function startStream(opts) {
  const emit = opts.onEvent || function () {};
  const design = path.resolve(opts.design);
  const srv = await startServer({ design: design, interleaf: opts.interleaf, web: opts.web, live: true });
  const origin = new URL(srv.url).origin;
  const faces = vendoredFaces(srv.url, srv.interleaf, design, readConfig(design));
  const choices = validChoices(webCombinations(srv.interleaf));
  let browser;
  try { browser = await openBrowser({ chromium: opts.chromium }); } catch (e) { await srv.close(); throw e; }
  let size = { width: side(opts.width || 1280, 'width'), height: side(opts.height || 800, 'height') };
  let page = null, client = null, seq = 0, lastState = '', closed = false, timer = null;

  async function newPage() {
    if (page) { try { await page.close(); } catch (e) { /* gone */ } }
    page = await browser.newPage();
    await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await isolate(page, { origin: origin, faces: faces, onBlocked: function (e) { emit({ ev: 'blocked', url: e.url, error: e.error }); } });
    // links to other sites would open a tab of their own, outside isolate()
    await page.evaluateOnNewDocument('window.open = function () { return null; };');
    page.on('error', function (e) { emit({ ev: 'crashed', message: String(e && e.message || e) }); page = null; client = null; });
    client = await page.createCDPSession();
    client.on('Page.screencastFrame', function (f) {
      client.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(function () {});
      const buf = Buffer.from(f.data, 'base64');
      const s = pngSize(buf);
      emit({ ev: 'frame', seq: ++seq, width: s.width, height: s.height, png: f.data });
    });
    await screencast();
  }
  async function screencast() {
    await client.send('Page.stopScreencast').catch(function () {});
    await client.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: size.width, maxHeight: size.height });
  }
  async function ready() { if (!page) await newPage(); return page; }

  // what the page shows, read from its address
  async function state() {
    if (!page) return;
    const u = new URL(page.url());
    const s = { ev: 'state', view: 'other', width: size.width, height: size.height, url: u.pathname + u.search };
    if (u.origin === origin) {
      const q = u.searchParams;
      if (u.pathname === '/_boards/' || u.pathname === '/_boards/index.html') { s.view = 'canvas'; if (q.get('page')) s.page = q.get('page'); }
      else if (u.pathname === '/_boards/view.html') { s.view = 'view'; s.board = q.get('board') || undefined; }
      else if (/\.dc\.html$/.test(u.pathname)) { s.view = 'board'; s.board = decodeURIComponent(u.pathname.slice(1)); }
      if (s.view === 'board' || s.view === 'view') for (const k of ['voice', 'scheme', 'pen']) if (q.get(k)) s[k] = q.get(k);
    }
    const key = JSON.stringify(s);
    if (key !== lastState) { lastState = key; emit(s); }
  }
  function forceState() { lastState = ''; return state(); }

  async function setSize(w, h) {
    size = { width: side(w, 'width'), height: side(h, 'height') };
    const p = await ready();
    await p.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
    await screencast();
  }

  async function open(c) {
    const file = String(c.board || '');
    const desc = describe(design);
    if (listBoards(design).indexOf(file) < 0) throw new Error('no board ' + file + ' in the design');
    const b = desc.boards.find(function (x) { return x.file === file; }) || { props: {}, size: size };
    const pick = resolveChoices({ voice: c.voice, scheme: c.scheme, pen: c.pen }, b.props || {}, choices);
    const w = c.width !== undefined ? c.width : b.size && b.size.width || size.width;
    const h = c.height !== undefined ? c.height : b.size && b.size.height || size.height;
    await setSize(w, h);
    await page.goto(boardUrl(srv.url, file, pick.asked), { waitUntil: 'load', timeout: 30000 });
  }

  const ops = {
    open: open,
    canvas: async function (c) {
      const p = await ready();
      await p.goto(srv.url + '_boards/' + (c.page ? '?page=' + encodeURIComponent(short(c.page, 200)) : ''), { waitUntil: 'load', timeout: 30000 });
    },
    viewport: function (c) { return setSize(c.width, c.height); },
    mouse: async function (c) {
      if (MOUSE.indexOf(c.type) < 0) throw new Error('mouse type must be one of ' + MOUSE.join(', '));
      const button = c.button === undefined ? (c.type === 'mouseMoved' ? 'none' : 'left') : String(c.button);
      if (BUTTONS.indexOf(button) < 0) throw new Error('button must be one of ' + BUTTONS.join(', '));
      await ready();
      await client.send('Input.dispatchMouseEvent', { type: c.type, x: num(c.x, 'x'), y: num(c.y, 'y'), button: button,
        buttons: c.buttons === undefined ? undefined : num(c.buttons, 'buttons'), clickCount: c.clickCount === undefined ? (c.type === 'mouseMoved' ? 0 : 1) : num(c.clickCount, 'clickCount'),
        modifiers: c.modifiers === undefined ? 0 : num(c.modifiers, 'modifiers') });
    },
    wheel: async function (c) {
      await ready();
      await client.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: num(c.x, 'x'), y: num(c.y, 'y'), deltaX: num(c.deltaX || 0, 'deltaX'),
        deltaY: num(c.deltaY || 0, 'deltaY'), modifiers: c.modifiers === undefined ? 0 : num(c.modifiers, 'modifiers') });
    },
    touch: async function (c) {
      if (TOUCH.indexOf(c.type) < 0) throw new Error('touch type must be one of ' + TOUCH.join(', '));
      const points = (Array.isArray(c.points) ? c.points : []).slice(0, 10).map(function (p, i) { return { x: num(p.x, 'x'), y: num(p.y, 'y'), id: p.id === undefined ? i : num(p.id, 'id') }; });
      await ready();
      await client.send('Input.dispatchTouchEvent', { type: c.type, touchPoints: points, modifiers: c.modifiers === undefined ? 0 : num(c.modifiers, 'modifiers') });
    },
    key: async function (c) {
      if (KEY.indexOf(c.type) < 0) throw new Error('key type must be one of ' + KEY.join(', '));
      await ready();
      const e = { type: c.type, modifiers: c.modifiers === undefined ? 0 : num(c.modifiers, 'modifiers') };
      for (const k of ['key', 'code', 'text']) if (c[k] !== undefined) e[k] = short(c[k], 32);
      if (e.text !== undefined) e.unmodifiedText = e.text;
      if (c.keyCode !== undefined) e.windowsVirtualKeyCode = e.nativeVirtualKeyCode = num(c.keyCode, 'keyCode');
      await client.send('Input.dispatchKeyEvent', e);
    },
    state: function () { return forceState(); },
    frame: async function () {
      const p = await ready();
      const png = Buffer.from(await p.screenshot({ type: 'png' }));
      const s = pngSize(png);
      emit({ ev: 'frame', seq: ++seq, width: s.width, height: s.height, png: png.toString('base64') });
    },
  };

  // commands run one after another, in the order they came
  let queue = Promise.resolve();
  function send(c) {
    queue = queue.then(async function () {
      if (closed) return;
      if (!c || typeof c !== 'object' || !Object.prototype.hasOwnProperty.call(ops, c.op)) { emit({ ev: 'error', message: 'unknown command' + (c && c.op ? ' ' + short(c.op) : ''), op: c && short(c.op) }); return; }
      try { await ops[c.op](c); } catch (e) { emit({ ev: 'error', op: c.op, message: String(e && e.message || e) }); }
      try { await state(); } catch (e) { /* the page went away; the next command says so */ }
    });
    return queue;
  }

  await newPage();
  emit({ ev: 'ready', url: srv.url });
  await send({ op: 'canvas' });
  // what the page shows also changes from inside it (a link, the canvas's page buttons)
  timer = setInterval(function () { state().catch(function () {}); }, 300);

  return {
    url: srv.url,
    send: send,
    close: async function () {
      closed = true;
      clearInterval(timer);
      try { await browser.close(); } catch (e) { /* gone */ }
      await srv.close();
    },
  };
}

module.exports = { startStream: startStream, pngSize: pngSize };
