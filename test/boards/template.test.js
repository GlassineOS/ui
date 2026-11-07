// SPDX-License-Identifier: GPL-2.0-or-later
// The board reader under plain node: holes, attributes, props, the subset checks, the renderer.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const T = require('../../boards/runtime/template.js');

function board(template, script, head) {
  return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>T</title>\n<script src="./support.js"></script>\n' + (head || '') +
    '</head>\n<body>\n<x-dc>\n' + template + '\n</x-dc>\n' + (script || '<script type="text/x-dc" data-dc-script>\nclass Component extends DCLogic {}\n</script>') + '\n</body>\n</html>\n';
}
const parse = (tpl, script, head) => T.parseBoard(board(tpl, script, head), 'T.dc.html');
const features = (doc) => doc.issues.map((i) => i.feature);
// a plain h for rendering without a DOM
const h = (tag, props, children) => ({ tag, props, children: children || [] });
function render(doc, vals, imports) {
  const errors = [];
  const out = T.renderNodes(doc.template, T.rootScope(vals), {
    h, onError: (m, line) => errors.push({ m, line }),
    renderImport: (n, props) => { (imports || []).push({ name: n.name, props, style: n.style, hint: n.hint }); return { tag: 'import:' + n.name, props, children: [] }; },
  });
  return { out: out.filter((x) => typeof x !== 'string' || x.trim()), errors };
}

test('subset version', () => { assert.strictEqual(T.SUBSET_VERSION, 1); });

test('holes: paths, literals, whitespace inside the braces', () => {
  assert.deepStrictEqual(T.parseHole(' user.name ').path, ['user', 'name']);
  assert.deepStrictEqual(T.parseHole('$index').path, ['$index']);
  assert.strictEqual(T.parseHole(' true ').lit, true);
  assert.strictEqual(T.parseHole('false').lit, false);
  assert.strictEqual(T.parseHole('3').lit, 3);
  assert.strictEqual(T.parseHole('a + b'), null);
  assert.strictEqual(T.parseHole('!x'), null);
  assert.strictEqual(T.parseHole('fn()'), null);
  assert.strictEqual(T.parseHole("'str'"), null);
});

test('attribute bindings: literal, whole hole (raw), interpolated', () => {
  assert.deepStrictEqual(T.binding('plain &amp; text'), { lit: 'plain & text' });
  assert.deepStrictEqual(T.binding('{{ fn }}').hole.path, ['fn']);
  const b = T.binding('width: {{ w }}px; color: {{c}}');
  assert.ok(b.parts);
  assert.strictEqual(T.evalBinding(b, T.rootScope({ w: 12, c: '#111' })), 'width: 12px; color: #111');
  assert.strictEqual(T.evalBinding(b, T.rootScope({})), 'width: px; color: ');
  const f = () => 1;
  assert.strictEqual(T.evalBinding(T.binding('{{f}}'), T.rootScope({ f })), f);
  assert.deepStrictEqual(T.evalBinding(T.binding('{{ o }}'), T.rootScope({ o: { a: 1 } })), { a: 1 });
});

test('kebab props become camelCase', () => {
  assert.strictEqual(T.kebabToCamel('on-fit'), 'onFit');
  assert.strictEqual(T.kebabToCamel('show-win'), 'showWin');
  assert.strictEqual(T.kebabToCamel('settings-page'), 'settingsPage');
});

test('the parts of a board file', () => {
  const doc = T.parseBoard(board('<helmet>\n<link rel="stylesheet" href="https://fonts.example/css?a=1&amp;b=2">\n<style>body{margin:0}</style>\n</helmet>\n<div>{{ x }}</div>',
    '<script type="text/x-dc" data-dc-script data-props=\'{"voice":{"editor":"enum","options":["white"],"default":"white"},"$preview":{"width":760,"height":110}}\'>\nclass Component extends DCLogic {}\n</script>',
    '<script src="data/fixtures.js"></script>\n'), 'X.dc.html');
  assert.deepStrictEqual(doc.issues, []);
  assert.strictEqual(doc.lang, 'en');
  assert.strictEqual(doc.title, 'T');
  assert.deepStrictEqual(doc.headScripts.map((s) => s.src), ['data/fixtures.js']);
  assert.deepStrictEqual(doc.helmet.map((n) => n.tag), ['link', 'style']);
  assert.strictEqual(doc.helmet[0].attrs.href, 'https://fonts.example/css?a=1&b=2');
  assert.deepStrictEqual(doc.preview, { width: 760, height: 110 });
  assert.strictEqual(doc.props.voice.default, 'white');
  assert.match(doc.code, /class Component extends DCLogic/);
});

test('data-props in double quotes with entities', () => {
  const doc = parse('<div></div>', '<script type="text/x-dc" data-dc-script data-props="{&quot;$preview&quot;:{&quot;width&quot;:700,&quot;height&quot;:440},&quot;app&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;a&quot;,&quot;b&quot;],&quot;default&quot;:&quot;a&quot;}}">\nclass Component extends DCLogic {}\n</script>');
  assert.deepStrictEqual(doc.issues, []);
  assert.deepStrictEqual(doc.preview, { width: 700, height: 440 });
  assert.deepStrictEqual(doc.props.app.options, ['a', 'b']);
});

test('bad data-props JSON is an error', () => {
  const doc = parse('<div></div>', '<script type="text/x-dc" data-dc-script data-props=\'{"a":\'>\nclass Component extends DCLogic {}\n</script>');
  assert.deepStrictEqual(features(doc), ['data-props is not JSON']);
});

test('sc-for inside tbody and select stays in place; attribute case is kept', () => {
  const doc = parse('<table><tbody><sc-for list="{{ rows }}" as="r" hint-placeholder-count="2"><tr><td>{{ r.n }}</td></tr></sc-for></tbody></table>' +
    '<select><sc-for list="{{ rows }}" as="o" hint-placeholder-count="2"><option value="{{ o.n }}">{{ o.n }}</option></sc-for></select>' +
    '<svg viewBox="0 0 4 4"><path d="{{ d }}"></path></svg><button onClick="{{ go }}" onKeyDown="{{ go }}">x</button>');
  assert.deepStrictEqual(doc.issues, []);
  const go = () => 0;
  const { out, errors } = render(doc, { rows: [{ n: 1 }, { n: 2 }], d: 'M0 0', go });
  assert.deepStrictEqual(errors, []);
  const [table, select, svg, button] = out;
  assert.strictEqual(table.children[0].children.length, 2);
  assert.strictEqual(table.children[0].children[1].children[0].children[0], '2');
  assert.deepStrictEqual(select.children.map((o) => o.props.value), [1, 2]);
  assert.strictEqual(svg.props.viewBox, '0 0 4 4');
  assert.strictEqual(svg.children[0].props.d, 'M0 0');
  assert.strictEqual(button.props.onclick, go);
  assert.strictEqual(button.props.onkeydown, go);
});

test('loops: $index, nested scopes, shadowing', () => {
  const doc = parse('<sc-for list="{{ a }}" as="x" hint-placeholder-count="1"><sc-for list="{{ x.b }}" as="y" hint-placeholder-count="1"><i>{{ x.n }}{{ y }}{{ $index }}</i></sc-for><b>{{ $index }}</b></sc-for>');
  const { out } = render(doc, { a: [{ n: 'p', b: ['u', 'v'] }, { n: 'q', b: [] }] });
  assert.deepStrictEqual(out.map((e) => e.tag + ':' + e.children.join('')), ['i:pu0', 'i:pv1', 'b:0', 'b:1']);
});

test('conditions follow truthiness', () => {
  const doc = parse('<sc-if value="{{ on }}" hint-placeholder-val="{{ true }}"><p>yes</p></sc-if>');
  assert.strictEqual(render(doc, { on: 1 }).out.length, 1);
  assert.strictEqual(render(doc, { on: '' }).out.length, 0);
  assert.strictEqual(render(doc, {}).out.length, 0);
});

test('dc-import: props kebab→camel, raw values, style and hint-size', () => {
  const doc = parse('<dc-import name="Card" item="{{ it }}" on-fit="{{ fit }}" show-win="{{ true }}" label="a {{ n }}" theme="white" style="position: static" hint-size="760px,1140px"></dc-import>');
  assert.deepStrictEqual(doc.issues, []);
  assert.deepStrictEqual(doc.imports, ['Card']);
  assert.ok(doc.importLines.Card > 0);
  const imports = [];
  const it = { a: 1 }, fit = () => 0;
  render(doc, { it, fit, n: 2 }, imports);
  assert.deepStrictEqual(Object.keys(imports[0].props), ['item', 'onFit', 'showWin', 'label', 'theme']);
  assert.strictEqual(imports[0].props.item, it);
  assert.strictEqual(imports[0].props.onFit, fit);
  assert.strictEqual(imports[0].props.showWin, true);
  assert.strictEqual(imports[0].props.label, 'a 2');
  assert.deepStrictEqual(imports[0].style, { lit: 'position: static' });
  assert.deepStrictEqual(imports[0].hint, { w: '760px', h: '1140px' });
});

test('class/for/events/ref/textarea mapping', () => {
  const doc = parse('<label class="c {{ k }}" for="n">L</label><input type="text" onChange="{{ f }}"><input type="checkbox" checked="{{ on }}" onChange="{{ f }}"><div ref="{{ r }}" onDoubleClick="{{ f }}" onFocus="{{ f }}"></div><textarea>{{ t }} &amp; more</textarea>');
  assert.deepStrictEqual(doc.issues, []);
  const f = () => 0, r = () => 0;
  const { out } = render(doc, { k: 'x', f, r, on: true, t: 'hi' });
  assert.strictEqual(out[0].props.class, 'c x');
  assert.strictEqual(out[0].props.for, 'n');
  assert.strictEqual(out[1].props.oninput, f);
  assert.strictEqual(out[2].props.onchange, f);
  assert.strictEqual(out[2].props.checked, true);
  assert.strictEqual(out[3].props.ref, r);
  assert.strictEqual(out[3].props.ondblclick, f);
  assert.strictEqual(out[3].props.onfocusin, f);
  assert.strictEqual(out[4].props.defaultValue, 'hi & more');
});

test('entities in text are decoded; unknown ones are unsupported', () => {
  const doc = parse('<p>a &amp; b &quot;c&quot; &#x27;d&#x27; &#8212;</p>');
  assert.deepStrictEqual(doc.issues, []);
  assert.strictEqual(render(doc, {}).out[0].children[0], 'a & b "c" \'d\' —');
  assert.deepStrictEqual(features(parse('<p>&bogus;</p>')), ['character reference']);
});

test('render errors: objects in text, non-arrays in loops, non-functions as events', () => {
  const doc = parse('<p>{{ o }}</p><sc-for list="{{ o }}" as="x" hint-placeholder-count="1"></sc-for><b onClick="{{ s }}">x</b><i title="a {{ o }}"></i>');
  const { errors } = render(doc, { o: { a: 1 }, s: 'str' });
  assert.deepStrictEqual(errors.map((e) => e.m), ['{{ o }} in text is object', '<sc-for list="{{ o }}"> is object, not an array', 'onClick="{{ s }}" is string, not a function', '{{ o }} inside a string is object']);
  assert.deepStrictEqual(render(doc, {}).errors, []);
});

test('unsupported features are named', () => {
  const cases = [
    ['<p>{{ a + b }}</p>', 'expression in a hole'],
    ['<p>{{ !x }}</p>', 'expression in a hole'],
    ['<sc-switch></sc-switch>', 'element'],
    ['<Card></Card>', 'capitalized tag'],
    ['<dc-import name="Card" hint-size="1px,1px"/>', 'self-closing tag'],
    ['<dc-import name="{{ n }}"></dc-import>', '<dc-import> name with a hole'],
    ['<dc-import name="Card" hint-color="x"></dc-import>', 'attribute of <dc-import>'],
    ['<sc-if value="x"></sc-if>', '<sc-if> value that is not one {{ hole }}'],
    ['<sc-if value="{{ x }}" else="1"></sc-if>', 'attribute of <sc-if>'],
    ['<sc-for list="{{ x }}" as="a b"></sc-for>', '<sc-for> as that is not a name'],
    ['<button onclick="go()">x</button>', 'inline event handler'],
    ['<button onClick="go">x</button>', 'event attribute that is not one {{ hole }}'],
    ['<button onClickCapture="{{ go }}">x</button>', 'event attribute'],
    ['<div ref="r"></div>', 'ref that is not one {{ hole }}'],
    ['<div key="{{ k }}"></div>', 'attribute'],
    ['<script>alert(1)</script>', '<script> in the template'],
    ['<div><helmet></helmet></div>', '<helmet> below the top of <x-dc>'],
    ['<helmet><script src="x.js"></script></helmet>', 'element in <helmet>'],
    ['<div><span></div>', 'unclosed element'],
    ['<p>{{ x </p>', 'unclosed hole'],
  ];
  for (const [tpl, feature] of cases) assert.ok(features(parse(tpl)).includes(feature), tpl + ' → ' + JSON.stringify(features(parse(tpl))));
});

test('unsupported board structure is named', () => {
  assert.ok(features(parse('<div></div>', '<script type="text/x-dc" data-dc-script>\nfunction Component() {}\n</script>')).includes('logic that is not "class Component extends DCLogic"'));
  assert.ok(features(parse('<div></div>', '<script type="text/x-dc" data-dc-script>\nimport x from "y";\nclass Component extends DCLogic {}\n</script>')).includes('import or export in the logic'));
  assert.ok(features(parse('<div></div>', undefined, '<script>window.x = 1</script>\n')).includes('inline <script> in <head>'));
  assert.ok(features(parse('<div></div>', undefined, '<script src="https://cdn.example/x.js"></script>\n')).includes('remote <script> in <head>'));
  assert.ok(features(parse('<div></div>', undefined, '<style>a{}</style>\n')).includes('element in <head>'));
  assert.ok(features(T.parseBoard(board('<div></div>').replace('<script src="./support.js">', '<script defer src="./support.js">'), 'X')).includes('attribute of the support.js script'));
  assert.ok(features(T.parseBoard('<html><body><div></div></body></html>', 'X')).includes('board without <x-dc>'));
  const extra = T.parseBoard(board('<div></div>').replace('</body>', '<p>stray</p></body>'), 'X');
  assert.ok(features(extra).includes('content in <body> outside <x-dc> and the logic script'));
});

test('implied end tags of li and option are accepted', () => {
  const doc = parse('<ul><li>a<li>b</ul><select><option>x<option>y</select>');
  assert.deepStrictEqual(doc.issues, []);
  const { out } = render(doc, {});
  assert.strictEqual(out[0].children.length, 2);
  assert.strictEqual(out[1].children.length, 2);
});

test('importCycles: the imports that lead back to the board, with the way there', () => {
  const g = { A: ['B', 'C'], B: ['A'], C: ['D'], D: [], S: ['S'] };
  const of = (f) => (g[f] || []).map((t, i) => ({ name: t, file: t, line: i + 1 }));
  assert.deepStrictEqual(T.importCycles('A', of), [{ name: 'B', line: 1, chain: ['A', 'B', 'A'] }]);
  assert.deepStrictEqual(T.importCycles('S', of), [{ name: 'S', line: 1, chain: ['S', 'S'] }]);
  assert.deepStrictEqual(T.importCycles('C', of), []);
});
