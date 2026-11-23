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
