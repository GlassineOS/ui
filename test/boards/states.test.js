// SPDX-License-Identifier: GPL-2.0-or-later
// Named states, links, loads and board hashes (spec 003 FR-050) under plain node: the reader's
// "$states" checks, the props of a board opened with ?state=, describe()'s per-board data, and the
// state options of shot and check.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const T = require('../../boards/runtime/template.js');
const { describe, refPath } = require('../../boards/lib/server.js');
const S = require('../../boards/lib/shot.js');
const { renderList, textSummary } = require('../../boards/lib/check.js');
const SAMPLES = path.join(ROOT, 'boards', 'samples');
const TMP = path.join(ROOT, 'out', 'test', 'boards-states');

const PROPS = { bt: { editor: 'enum', options: ['off', 'on', 'scan'], default: 'off' }, paired: { editor: 'text', default: '' } };
function board(dataProps, template, head) {
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>T</title>\n<script src="./support.js"></script>\n' + (head || '') +
    '</head>\n<body>\n<x-dc>\n' + (template || '<p>x</p>') + '\n</x-dc>\n<script type="text/x-dc" data-dc-script data-props=\'' + JSON.stringify(dataProps) +
    '\'>\nclass Component extends DCLogic {}\n</script>\n</body>\n</html>\n';
}
const parseStates = (states, props) => T.parseBoard(board(Object.assign({ $states: states }, props || PROPS)), 'T.dc.html');
const faults = (doc) => doc.issues.map((i) => i.kind + ' ' + i.feature + ': ' + i.detail);

test('$states: read in order, "from" defaults to none, props copied', () => {
  const doc = parseStates([
    { id: 'off', name: 'Off', props: { bt: 'off' } },
    { id: 'connected', name: 'Connected', props: { bt: 'on', paired: 'K380' }, from: [{ state: 'off', label: 'Pair' }] },
  ]);
  assert.deepStrictEqual(doc.issues, []);
  assert.deepStrictEqual(doc.states, [
    { id: 'off', name: 'Off', props: { bt: 'off' }, from: [] },
    { id: 'connected', name: 'Connected', props: { bt: 'on', paired: 'K380' }, from: [{ state: 'off', label: 'Pair' }] },
  ]);
  // "$states" may come before the props it names
  const before = T.parseBoard(board({ $states: [{ id: 'a', name: 'A', props: { bt: 'on' } }], bt: PROPS.bt }), 'T.dc.html');
  assert.deepStrictEqual(before.issues, []);
  // no "$states": none
  assert.deepStrictEqual(T.parseBoard(board(PROPS), 'T.dc.html').states, []);
});

test('$states: every fault is an issue on the data-props line', () => {
  const doc = parseStates([
    { id: 'off', name: 'Off', props: { bt: 'off' } },
    { id: 'off', name: 'Again', props: {} },
    { id: 'Bad Id', name: 'X', props: {} },
    { id: 'u', name: 'U', props: { volume: 3 } },
    { id: 'v', name: 'V', props: { bt: 'blue' } },
    { id: 'n', name: 7, props: {} },
    { id: 'f', name: 'F', props: {}, from: [{ state: 'nowhere', label: 'Go' }, { state: 'off', label: 3 }] },
    { id: 's', name: 'S', props: {}, from: [{ state: 's', label: 'Loop' }] },
    { id: 'k', name: 'K', props: {}, extra: 1 },
    'text',
  ]);
  assert.ok(doc.issues.every((i) => i.feature === '$states' && i.line === 12), JSON.stringify(doc.issues));
  const f = faults(doc);
  for (const re of [/^error \$states: state "off": id used twice$/, /^error \$states: state "Bad Id": id "Bad Id" is not of/, /^error \$states: state "u": prop "volume" is not declared/,
    /^error \$states: state "v": prop "bt" value "blue" is not one of its options \("off", "on", "scan"\)/, /^error \$states: state "n": name is not a string/,
    /^error \$states: state "f": from label is not a string/, /^unsupported \$states: state "k": key "extra"/, /^unsupported \$states: state 10: is not an object/,
    /^error \$states: state "s": from names the state itself/]) {
    assert.ok(f.some((x) => re.test(x)), re + '\n' + f.join('\n'));
  }
  // a step from a state that does not exist is named once every id is known
  assert.ok(!f.some((x) => /from state "nowhere"/.test(x)), 'state "f" is not well-formed, so its steps are not read');
  const step = parseStates([{ id: 'a', name: 'A', props: {}, from: [{ state: 'nowhere', label: 'Go' }] }]);
  assert.deepStrictEqual(faults(step), ['error $states: state "a": from state "nowhere" is not a state of this board']);
  assert.deepStrictEqual(faults(parseStates({ id: 'x' })), ['unsupported $states: is not an array']);
  assert.deepStrictEqual(faults(parseStates([{ id: 'a', name: 'A', props: [] }])), ['error $states: state "a": props is not an object']);
  // an option is matched exactly: "1" is not 1
  const pen = parseStates([{ id: 'a', name: 'A', props: { pen: 1 } }], { pen: { editor: 'enum', options: ['1', '2'] } });
  assert.match(faults(pen)[0], /value 1 is not one of its options/);
  // a prop without options takes any value
  assert.deepStrictEqual(parseStates([{ id: 'a', name: 'A', props: { paired: { any: 'thing' } } }]).issues, []);
  // other "$" entries are still outside the subset
  assert.deepStrictEqual(faults(T.parseBoard(board({ $other: 1 }), 'T.dc.html')), ['unsupported data-props entry: $other']);
});

test('boardProps: defaults, then the state, then voice/scheme/pen, then p.NAME', () => {
  const doc = parseStates([{ id: 'scan', name: 'Scanning', props: { bt: 'scan', voice: 'editorial' } }],
    Object.assign({ voice: { editor: 'enum', options: ['white', 'editorial'], default: 'white' }, n: { editor: 'int', default: 1 } }, PROPS));
  const q = (s) => new URLSearchParams(s);
  assert.deepStrictEqual(T.boardProps(doc, q('')), { props: { voice: 'white', n: 1, bt: 'off', paired: '' }, state: null, unknownState: null });
  assert.deepStrictEqual(T.boardProps(doc, q('state=scan')).props, { voice: 'editorial', n: 1, bt: 'scan', paired: '' });
  assert.strictEqual(T.boardProps(doc, q('state=scan')).state, 'scan');
  // the preview's voice and an explicit p.NAME win over the state
  assert.deepStrictEqual(T.boardProps(doc, q('state=scan&voice=white&p.bt=on&p.n=4')).props, { voice: 'white', n: 4, bt: 'on', paired: '' });
  // an unknown id: named, the defaults stay
  assert.deepStrictEqual(T.boardProps(doc, q('state=nope')), { props: { voice: 'white', n: 1, bt: 'off', paired: '' }, state: null, unknownState: 'nope' });
  assert.strictEqual(T.boardProps(doc, q('state=')).unknownState, null);
});

test('refPath: as the runtime resolves a URL a board names', () => {
  assert.strictEqual(refPath('sub/A.dc.html', 'B.dc.html', true), 'sub/B.dc.html');
  assert.strictEqual(refPath('sub/A.dc.html', '../B.dc.html?x=1#y', true), 'B.dc.html');
  assert.strictEqual(refPath('sub/A.dc.html', '/B.dc.html', true), 'B.dc.html');
  assert.strictEqual(refPath('sub/A.dc.html', '/B.dc.html', false), null);
  assert.strictEqual(refPath('A.dc.html', 'My%20Board.dc.html', true), 'My Board.dc.html');
  for (const r of ['https://x/B.dc.html', '//x/B.dc.html', 'javascript:x', '#top', '../../out.dc.html', '..']) assert.strictEqual(refPath('A.dc.html', r, true), null, r);
});

test('describe: states, links, imports, loads and hash of the samples', () => {
  const d = describe(SAMPLES);
  assert.strictEqual(d.subset, 2);
  const by = Object.fromEntries(d.boards.map((b) => [b.file, b]));
  const st = by['States.dc.html'];
  assert.deepStrictEqual(st.states.map((s) => s.id), ['off', 'on', 'scanning', 'connected']);
  assert.deepStrictEqual(st.states[3], { id: 'connected', name: 'Connected', props: { bt: 'on', paired: 'Keyboard K380' }, from: [{ state: 'scanning', label: 'Pair' }] });
  assert.deepStrictEqual(st.links, [{ to: 'Counter.dc.html', text: 'Open the counter', line: 24 }, { to: 'Main.dc.html', text: 'Main', line: 24 }]);
  assert.deepStrictEqual(st.imports, ['sub/Badge.dc.html']);
  assert.deepStrictEqual(st.loads, ['data/sample.js']);
  assert.match(st.hash, /^[0-9a-f]{64}$/);
  assert.deepStrictEqual(by['sub/Nested.dc.html'].links, [{ to: 'Counter.dc.html', text: 'Counter (from the canvas root)', line: 22 }]);
  assert.deepStrictEqual(by['Main.dc.html'].imports, ['Card.dc.html']);
  for (const b of d.boards) {
    assert.ok(Array.isArray(b.states) && Array.isArray(b.links) && Array.isArray(b.imports) && Array.isArray(b.loads), b.file);
    if (b.file !== 'States.dc.html') assert.deepStrictEqual(b.states, [], b.file);
  }
  assert.strictEqual(new Set(d.boards.map((b) => b.hash)).size, d.boards.length);
});

// a design folder written from {path: content}
function folder(name, files) {
  const dir = path.join(TMP, name);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of Object.keys(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), files[f]);
  }
  return dir;
}
const HEAD = '<script src="data/f.js"></script>\n<script src="ds/web/x.js"></script>\n<script src="https://cdn.example/x.js"></script>\n';
const TPL = '<helmet>\n<link rel="stylesheet" href="a.css?v=1">\n<link rel="stylesheet" href="ds/web/tokens.css">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">\n<link rel="stylesheet" href="/abs.css">\n<link rel="stylesheet" href="gone.css">\n</helmet>\n' +
  '<a href="B.dc.html">  To <b>B</b>\n now </a><a href="{{ x }}.dc.html">hole</a><a href="sub/{{ x }}">part</a><a href="https://x/C.dc.html">far</a><a href="#top">top</a><a href="data/f.js">file</a><sc-if value="{{ y }}"><a href="/sub/C.dc.html"></a></sc-if>\n<dc-import name="B"></dc-import>';
const FILES = {
  'A.dc.html': board({}, TPL, HEAD),
  'B.dc.html': board({}, '<dc-import name="sub/C"></dc-import>'),
  'sub/C.dc.html': board({}, '<p>c</p>', '<script src="../data/f.js"></script>\n'),
  'L.dc.html': board({}, '<dc-import name="M"></dc-import>'),
  'M.dc.html': board({}, '<dc-import name="L"></dc-import>'),
  'N.dc.html': board({}, '<dc-import name="Nope"></dc-import>'),
  'data/f.js': 'window.F = 1;\n',
  'a.css': 'p { color: red }\n',
  'abs.css': 'p {}\n',
  'ds/web/tokens.css': ':root {}\n',
};

test('describe: links, loads and imports as the contract names them', () => {
  const by = Object.fromEntries(describe(folder('parts', FILES)).boards.map((b) => [b.file, b]));
  const a = by['A.dc.html'];
  assert.deepStrictEqual(a.links, [{ to: 'B.dc.html', text: 'To B now', line: 20 }, { to: 'sub/C.dc.html', text: '', line: 21 }]);
  assert.deepStrictEqual(a.loads, ['data/f.js', 'a.css', 'gone.css']);
  assert.deepStrictEqual(a.imports, ['B.dc.html']);
  assert.deepStrictEqual(by['sub/C.dc.html'].loads, ['data/f.js']);
  assert.deepStrictEqual(by['N.dc.html'].imports, ['Nope.dc.html']);
  // a cycle is still an issue, and both boards still get a hash
  assert.ok(by['L.dc.html'].issues.some((i) => i.feature === 'dc-import cycle'));
  assert.match(by['L.dc.html'].hash, /^[0-9a-f]{64}$/);
  assert.match(by['N.dc.html'].hash, /^[0-9a-f]{64}$/);
});

test('hash: identical inputs give the same hash; a changed import or load changes the importing board', () => {
  const base = Object.fromEntries(describe(folder('h1', FILES)).boards.map((b) => [b.file, b.hash]));
  // the same files in another folder
  assert.deepStrictEqual(Object.fromEntries(describe(folder('h2', FILES)).boards.map((b) => [b.file, b.hash])), base);
  // a file no board loads changes nothing
  assert.deepStrictEqual(Object.fromEntries(describe(folder('h3', Object.assign({}, FILES, { 'other.css': 'x' }))).boards.map((b) => [b.file, b.hash])), base);
  const changed = function (name, edit) {
    const h = Object.fromEntries(describe(folder(name, Object.assign({}, FILES, edit))).boards.map((b) => [b.file, b.hash]));
    return Object.keys(base).filter((f) => h[f] !== base[f]).sort();
  };
  // an imported board two steps down: every board above it
  assert.deepStrictEqual(changed('h4', { 'sub/C.dc.html': FILES['sub/C.dc.html'].replace('<p>c</p>', '<p>C</p>') }), ['A.dc.html', 'B.dc.html', 'sub/C.dc.html']);
  // a loaded stylesheet: the board that loads it
  assert.deepStrictEqual(changed('h5', { 'a.css': 'p { color: blue }\n' }), ['A.dc.html']);
  // a loaded script: every board that loads it, also through an import
  assert.deepStrictEqual(changed('h6', { 'data/f.js': 'window.F = 2;\n' }), ['A.dc.html', 'B.dc.html', 'sub/C.dc.html']);
  // a missing load that appears: the board that names it
  assert.deepStrictEqual(changed('h7', { 'gone.css': 'p {}\n' }), ['A.dc.html']);
  // the Interleaf web form and remote URLs are not the design's: no change
  assert.deepStrictEqual(changed('h8', { 'ds/web/tokens.css': ':root { --x: 1 }\n' }), []);
  // a board of a cycle: both, whichever the walk starts from
  assert.deepStrictEqual(changed('h9', { 'M.dc.html': FILES['M.dc.html'] + '\n' }), ['L.dc.html', 'M.dc.html']);
  // the import that appears where none was
  assert.deepStrictEqual(changed('h10', { 'Nope.dc.html': board({}) }), ['N.dc.html']);
});

test('describe: a board on the canvas but missing has no states, links, imports, loads or hash', () => {
  const dir = folder('missing', { 'A.dc.html': board({}), 'canvas.json': JSON.stringify({ boards: { 'Gone.dc.html': { x: 0, y: 0, w: 10, h: 10 } } }) });
  const g = describe(dir).boards.find((b) => b.file === 'Gone.dc.html');
  assert.deepStrictEqual([g.exists, g.states, g.links, g.imports, g.loads, g.hash], [false, [], [], [], [], null]);
});

test('check: every board once, then once per named state; a board with issues once', () => {
  const b = (file, states, issues) => ({ file: file, states: states.map((id) => ({ id: id })), issues: issues || [] });
  const list = renderList([b('A.dc.html', []), b('S.dc.html', ['off', 'on']), b('X.dc.html', ['off'], [{ kind: 'error' }])]);
  assert.deepStrictEqual(list.map((x) => x.b.file + '#' + x.state), ['A.dc.html#null', 'S.dc.html#null', 'S.dc.html#off', 'S.dc.html#on', 'X.dc.html#null']);
  const rep = { subset: 2, missing: [], summary: { boards: 2, renders: 3, clean: 1, failing: 2, failingBoards: 1, missing: 0 },
    boards: [{ board: 'S.dc.html', state: null, ok: true }, { board: 'S.dc.html', state: 'on', ok: false, settled: true, errors: [{ kind: 'render', message: 'm' }], unsupported: [], console: [], requests: [], external: [] },
      { board: 'S.dc.html', state: 'off', ok: false, settled: false, errors: [], unsupported: [], console: [], requests: [], external: [] }] };
  const t = textSummary(rep).split('\n');
  assert.strictEqual(t[0], 'boards check (subset 2): 2 boards in 3 renders, 1 clean, 2 failing (1 boards)');
  assert.ok(t.includes('  FAIL S.dc.html#on') && t.includes('  FAIL S.dc.html#off (did not settle)'), t.join('\n'));
});

test('shot: the state, what it means for voice, scheme and pen, and the image name', () => {
  const st = { file: 'S.dc.html', states: [{ id: 'dark', name: 'Dark', props: { scheme: 'night' } }] };
  assert.strictEqual(S.pickState(st, undefined), null);
  assert.strictEqual(S.pickState(st, 'dark').id, 'dark');
  assert.throws(() => S.pickState(st, 'nope'), /unknown state "nope" of S\.dc\.html: the states are dark/);
  assert.throws(() => S.pickState({ file: 'A.dc.html', states: [] }, 'x'), /the board names no states/);
  const choices = { voice: ['white'], scheme: ['paper', 'night'], pen: [1] };
  const props = { scheme: { editor: 'enum', default: 'paper' } };
  assert.strictEqual(S.resolveChoices({}, S.stateProps(props, S.pickState(st, 'dark')), choices).scheme, 'night');
  assert.strictEqual(S.resolveChoices({ scheme: 'paper' }, S.stateProps(props, S.pickState(st, 'dark')), choices).scheme, 'paper');
  assert.strictEqual(props.scheme.default, 'paper');
  const size = { width: 10, height: 20 };
  assert.strictEqual(S.defaultImage({ board: 'sub/S.dc.html', state: 'dark', voice: 'white', scheme: 'night', pen: 1 }, size), path.join('out', 'shots', 'sub_S-dark-white-night-1-10x20.png'));
  assert.strictEqual(S.defaultImage({ board: 'S.dc.html', state: null, voice: 'white', scheme: 'paper', pen: 1 }, size), path.join('out', 'shots', 'S-white-paper-1-10x20.png'));
});

test('tools/boards: shot --state names the states before any browser; version is 2', () => {
  const env = Object.assign({}, process.env, { CHROMIUM: '/nonexistent' });
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/boards'), 'shot', path.join(SAMPLES, 'States.dc.html'), '--state', 'nope'], { cwd: ROOT, encoding: 'utf8', env: env });
  assert.strictEqual(r.status, 2, r.stderr);
  assert.match(r.stderr, /unknown state "nope" of States\.dc\.html: the states are off, on, scanning, connected/);
  assert.strictEqual(r.stdout, '');
  const v = spawnSync(process.execPath, [path.join(ROOT, 'tools/boards'), 'version'], { encoding: 'utf8' });
  assert.strictEqual(v.stdout, 'boards subset 2\n');
});
