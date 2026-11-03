// The generated .tsx of a template with content slots, compiled and rendered to HTML: what a consumer's React draws for a single slot (children) and for
// several (named props), with the slot empty (showEmpty off: no element; on: an empty one) and filled. The compiler is esbuild and the renderer
// react-dom/server, both already in the workspace (the studio's own build and dependencies); nothing here is a new dependency.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { generateComponent, TEMPLATES } from '@midas/builder-core';
import { buttonModel } from '../../../scripts/button-model.mjs';

const require = createRequire(import.meta.url);
const { transformSync } = require('esbuild');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const master = { id: 'm', type: 'frame', layout: 'horizontal' };

/** A component compiled from a template with these slots: a div root, so the slot elements nest as they would in a real component. */
function componentOf(...slots) {
    const template = { ...structuredClone(TEMPLATES.get('button')), id: 'cardtest', name: 'CardTest', element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: ['disabled'] }, slots };
    const { files, problems } = generateComponent(template, model.binding, variables, 'CardTest', master, () => []);
    assert.deepEqual(problems, []);
    const source = files['CardTest.tsx'].replace(/^import '\.\/CardTest\.css';\n/m, '');
    const { code } = transformSync(source, { loader: 'tsx', format: 'cjs', jsx: 'automatic', target: 'es2022' });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    return module.exports.CardTest;
}
const html = (Component, props = {}, ...kids) => renderToStaticMarkup(createElement(Component, props, ...kids));
const slotElements = markup => [...markup.matchAll(/<div class="cardtest-(\w+)">(.*?)<\/div>/g)].map(m => [m[1], m[2]]);

const CONTENT = { id: 'content', name: 'Content', layout: 'vertical' };
const HEADER = { id: 'header', name: 'Header', layout: 'horizontal' };
const BODY = { id: 'body', name: 'Body', layout: 'vertical' };

test('a single slot renders its children inside the slot element, after the other layers, and nothing when there are none', () => {
    const Card = componentOf(CONTENT);
    const filled = html(Card, {}, createElement('span', null, 'hello'));
    assert.deepEqual(slotElements(filled), [['content', '<span>hello</span>']]);
    assert.ok(filled.indexOf('cardtest-label') < filled.indexOf('cardtest-content'), 'the slot comes after the label');
    assert.deepEqual(slotElements(html(Card)), [], 'empty, showEmpty off: no element');
});

test('an empty slot takes no element, whatever "empty" is in React: undefined, null, false, an empty string, an empty array', () => {
    const Card = componentOf(CONTENT);
    for (const empty of [undefined, null, false, true, '', [], [null, false]]) assert.deepEqual(slotElements(html(Card, { children: empty })), [], JSON.stringify(empty));
    for (const full of ['text', 0, [createElement('i', { key: 1 })]]) assert.equal(slotElements(html(Card, { children: full })).length, 1, JSON.stringify(full));
});

test('a slot with showEmpty is an element while its prop is empty, and holds the children once there are some', () => {
    const Card = componentOf({ ...CONTENT, showEmpty: true });
    assert.deepEqual(slotElements(html(Card)), [['content', '']]);
    assert.deepEqual(slotElements(html(Card, {}, 'x')), [['content', 'x']]);
});

test('several slots are named props in schema order; each one is its own element, and an empty one without showEmpty is left out', () => {
    const Card = componentOf(HEADER, { ...BODY, showEmpty: true });
    assert.deepEqual(slotElements(html(Card, { header: 'H', body: 'B' })), [['header', 'H'], ['body', 'B']]);
    assert.deepEqual(slotElements(html(Card, { body: 'B' })), [['body', 'B']], 'no header prop, no header element');
    assert.deepEqual(slotElements(html(Card, { header: 'H' })), [['header', 'H'], ['body', '']], 'body shows empty');
    assert.deepEqual(slotElements(html(Card)), [['body', '']]);
});

test('the root takes className after the template class, style and rest props, and children is not rendered outside its slot', () => {
    const Card = componentOf(HEADER, BODY);
    const markup = html(Card, { className: 'mine', style: { color: 'red' }, id: 'card-1', 'data-x': 'y', header: 'H' });
    assert.match(markup, /^<div class="cardtest mine"[^>]*style="color:red"/);
    assert.match(markup, /id="card-1"/);
    assert.match(markup, /data-x="y"/);
    const single = componentOf(CONTENT);
    assert.equal((html(single, {}, 'once').match(/once/g) ?? []).length, 1);
});

/** The List template compiled from its own schema (no variables: it has none). */
function listComponent(template = TEMPLATES.get('list')) {
    const { files, problems } = generateComponent(template, { variables: {} }, { collections: [], items: [] }, 'List', master, () => []);
    assert.deepEqual(problems, []);
    const { code } = transformSync(files['List.tsx'].replace(/^import '\.\/List\.css';\n/m, ''), { loader: 'tsx', format: 'cjs', jsx: 'automatic', target: 'es2022' });
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    return module.exports.List;
}
const itemMarkup = markup => markup.match(/<div class="list-item">(.*)<\/div><\/div>$/)?.[1] ?? null;

test('List draws its item itemCount times in one item element: 3 by default, as many as asked, none for 0', () => {
    const List = listComponent();
    const row = createElement('b', null, 'row');
    assert.equal(itemMarkup(html(List, {}, row)), '<b>row</b>'.repeat(3));
    assert.equal(itemMarkup(html(List, { itemCount: 5 }, row)), '<b>row</b>'.repeat(5));
    assert.equal(itemMarkup(html(List, { itemCount: 1 }, row)), '<b>row</b>');
    assert.equal(itemMarkup(html(List, { itemCount: 0 }, row)), '', 'no copies: the item element is there (showEmpty) and empty');
    assert.equal((html(List, { itemCount: 4 }, row).match(/<div class="list-item">/g) ?? []).length, 1, 'one item element, however many copies');
});

test('itemCount is clamped to a whole number of 0 or more; a value that is not a number falls back to the default of 3', () => {
    const List = listComponent();
    const row = createElement('i', null, 'x');
    const count = itemCount => (itemMarkup(html(List, { itemCount }, row))?.match(/<i>/g) ?? []).length;
    assert.equal(count(2.9), 2);
    assert.equal(count(-3), 0);
    for (const bad of [NaN, Infinity, -Infinity, null]) assert.equal(count(bad), 3, String(bad));
});

test('with no children there are no copies, whatever itemCount says; the item element still shows because the slot has showEmpty', () => {
    const List = listComponent();
    for (const empty of [undefined, null, false, '', []]) assert.equal(itemMarkup(html(List, { itemCount: 4, children: empty })), '', JSON.stringify(empty));
});

test('a repeating slot without showEmpty has no element when there are no copies', () => {
    const template = structuredClone(TEMPLATES.get('list'));
    template.slots[0].showEmpty = false;
    const List = listComponent(template);
    assert.doesNotMatch(html(List, { itemCount: 0 }, 'x'), /list-item/);
    assert.match(html(List, { itemCount: 2 }, 'x'), /<div class="list-item">xx<\/div>/);
});

test('repeated copies share no id: the component gives none, and a consumer\'s own id is repeated as given, never rewritten', () => {
    const List = listComponent();
    assert.doesNotMatch(html(List, { itemCount: 4 }, createElement('b', null, 'row')), /\bid=|data-node-id/);
    assert.equal((html(List, { itemCount: 2 }, createElement('b', { id: 'mine' }, 'row')).match(/id="mine"/g) ?? []).length, 2);
});
