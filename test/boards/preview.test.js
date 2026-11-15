// SPDX-License-Identifier: GPL-2.0-or-later
// The preview's pure logic (boards/preview/preview-common.js): addresses, the render, matrix axes,
// the flow map and its walk, search ranking. Node only.
'use strict';
const test = require('node:test');
const assert = require('assert');
const path = require('path');
const L = require(path.join(__dirname, '..', '..', 'boards', 'preview', 'preview-common.js'));

const B = (file, page, x, y, more) => Object.assign({ file, page, x, y, w: 100, h: 200, title: file.replace('.dc.html', ''), onCanvas: true, states: [], links: [] }, more || {});
const data = {
  title: 'T',
  pages: [{ id: 'a', name: 'Settings' }, { id: 'b', name: 'Other' }],
  boards: [
    B('more.dc.html', 'a', 0, 0, { title: 'More', links: [{ to: 'bt.dc.html', text: 'Bluetooth' }] }),
    B('bt.dc.html', 'a', 200, 0, { title: 'Bluetooth', links: [{ to: 'pair.dc.html', text: 'Pair' }],
      states: [{ id: 'off', name: 'Off', props: {} }, { id: 'on', name: 'On', props: {}, from: [{ state: 'off', label: 'Switch on' }] },
        { id: 'scan', name: 'Scanning', props: {}, from: [{ state: 'on', label: 'Scan' }] }] }),
    B('pair.dc.html', 'a', 400, 0, { title: 'Bluetooth › Pairing', links: [{ to: 'failed.dc.html', text: 'No answer' }, { to: 'far.dc.html', text: 'Elsewhere' }] }),
    B('failed.dc.html', 'a', 400, 300, { title: 'Bluetooth › Failed', links: [{ to: 'pair.dc.html', text: 'Try again' }, { to: 'bt.dc.html', text: 'Back' }] }),
    B('about.dc.html', 'a', 0, 300, { title: 'About' }),
    B('far.dc.html', 'b', 0, 0, { title: 'Far away' }),
    B('loose.dc.html', null, null, null, { onCanvas: false, title: 'Loose' }),
  ],
};

test('addresses: parse and serialise round trip, board first, bad values dropped', () => {
  const a = L.parse('?voice=stationery&board=sub%2FX.dc.html&state=on&pen=2&p.compact=true&scheme=nope&look=device&size=760x1140');
  assert.strictEqual(a.board, 'sub/X.dc.html');
  assert.deepStrictEqual([a.voice, a.scheme, a.pen, a.state, a.look, a.size], ['stationery', null, '2', 'on', 'device', '760x1140']);
  assert.deepStrictEqual(a.props, { compact: 'true' });
  const s = L.serialise(a);
  assert.match(s, /^\?board=sub%2FX\.dc\.html&/);
  assert.strictEqual(s, '?board=sub%2FX.dc.html&state=on&voice=stationery&pen=2&look=device&size=760x1140&p.compact=true');
  assert.deepStrictEqual(L.parse(s), a);
  assert.strictEqual(L.serialise({}), '');
  assert.strictEqual(L.parse('?state=Bad%20Id').state, null);
  assert.strictEqual(L.parse('?rows=state&cols=voice&at=2,1').at, '2,1');
  assert.strictEqual(L.parse('?rows=size').rows, null);
  assert.deepStrictEqual(L.parse('?p.__x=1&p.bad-name=2&p.ok=3').props, { __x: '1', ok: '3' });
});

test('board addresses carry the render, the state and props', () => {
  assert.strictEqual(L.boardHref('sub/A b.dc.html'), '../sub/A%20b.dc.html');
  assert.strictEqual(L.boardSrc('A.dc.html', {}), '../A.dc.html');
  assert.strictEqual(L.boardSrc('A.dc.html', { render: { voice: 'white', scheme: null, pen: '3' }, state: 'on', props: { z: 1, a: true } }),
    '../A.dc.html?voice=white&pen=3&state=on&p.a=true&p.z=1');
});

test('render: the address wins over the remembered one; names', () => {
  assert.deepStrictEqual(L.render({ voice: 'editorial' }, { voice: 'white', scheme: 'night' }), { voice: 'editorial', scheme: 'night', pen: null });
  assert.strictEqual(L.renderName({ voice: null, scheme: null, pen: null }), 'As each board');
  assert.strictEqual(L.renderName({ voice: 'white', scheme: 'eink', pen: '1' }), 'White · E-ink · Pen 1');
  assert.strictEqual(L.theme('stationery', 'night'), 'stationery-night');
  assert.strictEqual(L.shotCommand('designs/shell/a.dc.html', { voice: 'white', scheme: null, pen: '2' }, 'on'), 'tools/boards shot designs/shell/a.dc.html --voice white --pen 2 --state on');
});

test('reading order and links in', () => {
  assert.deepStrictEqual(L.readingOrder(L.onPage(data, 'a')).map((b) => b.title), ['More', 'Bluetooth', 'Bluetooth › Pairing', 'About', 'Bluetooth › Failed']);
  assert.deepStrictEqual(L.onPage({ pages: [], boards: data.boards }, null).length, 6);
  assert.deepStrictEqual(L.linksIn(data, 'pair.dc.html'), [{ file: 'bt.dc.html', text: 'Pair' }, { file: 'failed.dc.html', text: 'Try again' }]);
});

test('matrix: two different axes, state only with states, at clamped', () => {
  const bt = data.boards[1], plain = data.boards[0];
  assert.deepStrictEqual(L.axesOf(plain), ['voice', 'scheme', 'pen']);
  assert.deepStrictEqual(L.axesOf(bt), ['voice', 'scheme', 'pen', 'state']);
  let m = L.matrix(plain, {});
  assert.deepStrictEqual([m.rows, m.cols, m.cells.length, m.cells[0].length], ['voice', 'scheme', 3, 3]);
  assert.deepStrictEqual(m.cells[2][1].render, { voice: 'stationery', scheme: 'night', pen: null });
  m = L.matrix(plain, { rows: 'state', cols: 'pen', render: { pen: '2', voice: 'white' } });
  assert.deepStrictEqual([m.rows, m.cols], ['voice', 'pen']);
  assert.deepStrictEqual(m.cells[0][2].render, { voice: 'white', scheme: null, pen: '3' });
  m = L.matrix(bt, { rows: 'state', cols: 'voice', at: '9,1', render: { scheme: 'eink' } });
  assert.deepStrictEqual([m.rows, m.cols, m.rowValues.map((v) => v.name), m.at], ['state', 'voice', ['Off', 'On', 'Scanning'], [2, 1]]);
  assert.deepStrictEqual([m.cells[1][2].state, m.cells[1][2].render], ['on', { voice: 'stationery', scheme: 'eink', pen: null }]);
  m = L.matrix(bt, { rows: 'scheme', cols: 'scheme' });
  assert.deepStrictEqual([m.rows, m.cols], ['scheme', 'voice']);
  m = L.matrix(bt, { rows: 'voice', cols: 'state', state: 'scan' });
  assert.strictEqual(m.cells[0][0].state, 'off');
  assert.strictEqual(L.matrix(bt, { rows: 'voice', cols: 'pen', state: 'scan' }).cells[0][0].state, 'scan');
});

test('flow: links and state steps as arrows, boards no arrow touches apart, a board elsewhere marked', () => {
  const g = L.flow(data, 'a');
  const e = g.edges.map((x) => x.from + '>' + x.to + ':' + x.label + ':' + x.kind);
  assert.deepStrictEqual(e, [
    'more.dc.html>bt.dc.html:Bluetooth:link',
    'bt.dc.html>pair.dc.html:Pair:link',
    'bt.dc.html#off>bt.dc.html#on:Switch on:state',
    'bt.dc.html#on>bt.dc.html#scan:Scan:state',
    'pair.dc.html>failed.dc.html:No answer:link',
    'pair.dc.html>far.dc.html:Elsewhere:link',
    'failed.dc.html>pair.dc.html:Try again:link',
    'failed.dc.html>bt.dc.html:Back:link',
  ]);
  assert.deepStrictEqual(g.apart, ['about.dc.html']);
  const far = g.nodes.find((n) => n.id === 'far.dc.html');
  assert.ok(far.offPage);
  assert.strictEqual(g.nodes.find((n) => n.id === 'bt.dc.html#on').stateName, 'On');
  assert.ok(!g.nodes.some((n) => n.file === 'loose.dc.html'));
  const pos = L.layers(g);
  assert.deepStrictEqual([pos['more.dc.html'].col, pos['bt.dc.html'].col, pos['pair.dc.html'].col, pos['failed.dc.html'].col, pos['far.dc.html'].col], [0, 1, 2, 3, 3]);
  assert.deepStrictEqual([pos['bt.dc.html#off'].col, pos['bt.dc.html#on'].col, pos['bt.dc.html#scan'].col], [0, 1, 2]);
  assert.strictEqual(pos['about.dc.html'], undefined);
  // two nodes in one column get different rows
  assert.notStrictEqual(pos['failed.dc.html'].row, pos['far.dc.html'].row);
  // a cycle with no start still lays out
  const c = L.layers({ nodes: [{ id: 'x' }, { id: 'y' }], edges: [{ from: 'x', to: 'y' }, { from: 'y', to: 'x' }], apart: [] });
  assert.deepStrictEqual([c.x.col, c.y.col], [0, 1]);
});

test('flow walk: along the first arrow to a node not yet walked', () => {
  const g = L.flow(data, 'a');
  assert.deepStrictEqual(L.walk(g, 'more.dc.html').map((s) => s.id + (s.label ? ':' + s.label : '')),
    ['more.dc.html', 'bt.dc.html:Bluetooth', 'pair.dc.html:Pair', 'failed.dc.html:No answer']);
  assert.deepStrictEqual(L.walk(g, 'bt.dc.html#off').map((s) => s.id), ['bt.dc.html#off', 'bt.dc.html#on', 'bt.dc.html#scan']);
  assert.deepStrictEqual(L.walk(g, 'nope'), []);
});

test('search: ranks exact, prefix, word start, anywhere, letters; states and pages; current page first', () => {
  assert.deepStrictEqual(['blue', 'bluetooth', 'tooth', 'ooth', 'bth', 'xyz'].map((q) => L.score('Bluetooth', q).score), [80, 100, 40, 40, 10, 0]);
  assert.deepStrictEqual(L.score('Bluetooth › Pairing', 'pair'), { score: 60, at: [12, 16] });
  const r = L.search(data, 'blue', { page: 'a' });
  assert.deepStrictEqual(r.slice(0, 3).map((x) => x.title), ['Bluetooth', 'Bluetooth › Failed', 'Bluetooth › Pairing']);
  assert.strictEqual(r[0].states, 3);
  assert.deepStrictEqual(r[0].at, [0, 4]);
  const s = L.search(data, 'scan', {});
  assert.deepStrictEqual([s[0].kind, s[0].file, s[0].state, s[0].sub], ['state', 'bt.dc.html', 'scan', 'Bluetooth · state 3 of 3']);
  const p = L.search(data, 'settings', {});
  assert.deepStrictEqual([p[0].kind, p[0].page], ['page', 'a']);
  // a file name finds a board whose title differs
  assert.strictEqual(L.search(data, 'failed.dc', {})[0].file, 'failed.dc.html');
  // empty: boards, the current page's first
  assert.strictEqual(L.search(data, '', { page: 'b' })[0].file, 'far.dc.html');
  assert.ok(L.search(data, '', {}).every((x) => x.kind === 'board'));
  // the board on the current page wins a tie
  const two = { pages: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], boards: [B('x1.dc.html', 'a', 0, 0, { title: 'Wi-Fi' }), B('x2.dc.html', 'b', 0, 0, { title: 'Wi-Fi' })] };
  assert.strictEqual(L.search(two, 'wi-fi', { page: 'b' })[0].file, 'x2.dc.html');
  assert.strictEqual(L.search(data, 'b', { limit: 2 }).length, 2);
});
