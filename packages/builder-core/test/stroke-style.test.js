// A Button's stroke style in Play and in the export. The canvas is the source: the node's stroke style (Solid, Dash, Dots).
// The host draws the border; a bound stroke leaves its colour to the class rule so states can recolour it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const white = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];
const model = buttonModel({ colors: ['primary'], variantModes: ['solid', 'outlined', 'dashed'] });
const variables = { collections: model.collections, items: model.items };
const border = model.items.find(i => i.name === 'border').id;

/** A Button instance drawn in Play. Returns the instance element. */
function drawn(instanceExtra, { variant = 'outlined' } = {}) {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: white, radius: 6, x: 400, y: 0, w: 120, h: 32, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 32, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': variant, 'c-color': 'primary', 'c-size': 'md' }, fills: white, radius: 6, ...instanceExtra };
    return toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables }, 'i1').root;
}
const boundStroke = extra => ({ stroke: '#d9d9d9', strokeWidth: 1, strokeAlign: 'inside', vars: { stroke: border }, ...extra });

for (const [strokeStyle, css] of [['dash', 'dashed'], ['dot', 'dotted'], ['solid', 'solid'], [undefined, 'solid']]) {
    test(`a bound ${strokeStyle ?? 'unset'} stroke draws ${css} on the host, whatever the Variant says`, () => {
        for (const variant of ['outlined', 'dashed']) {
            const el = drawn(boundStroke({ strokeStyle }), { variant });
            assert.equal(el.children.some(c => c.html), false, 'a CSS border, not an SVG with a fixed colour');
            assert.equal(el.style.borderStyle, css, `${variant}: the node's style`);
            assert.equal(el.style.borderColor, undefined, `${variant}: the colour follows the host states via the class rule`);
            assert.equal(el.style.borderWidth, '1px');
        }
    });
}

test('the Dashed Variant\'s own dash stays a CSS border, so hover and press still recolour it', () => {
    const el = drawn(boundStroke({ strokeStyle: 'dash', strokeDash: 4, strokeGap: 4 }), { variant: 'dashed' });
    assert.equal(el.children.some(c => c.html), false);
    assert.equal(el.style.borderStyle, 'dashed');
    assert.equal(el.style.borderColor, undefined);
});

test('an unbound stroke takes its own style on the host, and one with its own dash pattern is still drawn exactly, as SVG', () => {
    const plain = drawn({ stroke: '#d9d9d9', strokeWidth: 1, strokeStyle: 'dash' });
    assert.equal(plain.style.borderWidth, '1px');
    assert.equal(plain.style.borderStyle, 'dashed');
    assert.equal(plain.style.borderColor, '#d9d9d9');
    const custom = drawn({ stroke: '#d9d9d9', strokeWidth: 1, strokeStyle: 'dash', strokeDash: 6, strokeGap: 2 });
    assert.equal(custom.style.borderWidth, '0px');
    const svg = custom.children.find(c => c.html);
    assert.ok(svg, 'the SVG overlay draws the custom pattern');
    assert.match(svg.html, /stroke-dasharray="6 2"/);
});

/** The exported stylesheet for a master with the given stroke. */
const exportCss = masterExtra => generateComponent(TEMPLATES.get('button'), model.binding, variables, 'Button', { id: 'm', type: 'frame', layout: 'horizontal', counterAlign: 'center', radius: 6, stroke: '#d9d9d9', strokeWidth: 1, strokeAlign: 'inside', ...masterExtra }, () => []).files['Button.css'];
const rootRule = css => /\.button \{\n([\s\S]*?)\n\}/.exec(css)[1];

for (const [strokeStyle, css] of [['dash', 'dashed'], ['dot', 'dotted'], ['solid', 'solid'], [undefined, 'solid']]) {
    test(`the export's base border style is the master's ${strokeStyle ?? 'unset'} stroke (${css}); the Dashed Variant still sets its own`, () => {
        const sheet = exportCss({ strokeStyle });
        assert.match(rootRule(sheet), new RegExp(`\\n {2}border-style: ${css};`));
        assert.match(sheet, /\.button\[data-variant="dashed"\] \{\n {2}border-style: dashed;\n\}/);
    });
}

test('the export keeps the fill and the border on the root, with no overlay and no stacking patch', () => {
    const sheet = exportCss({});
    assert.match(rootRule(sheet), /\n {2}background-color: var\(--button-bg\);/);
    assert.match(rootRule(sheet), /\n {2}border-width: 1px;/);
    assert.doesNotMatch(sheet, /\.button::before/);
    assert.doesNotMatch(sheet, /z-index: -/);
    assert.doesNotMatch(sheet, /isolation/);
});

test('the export draws every stroke align on the host inside the box', () => {
    for (const strokeAlign of ['inside', 'center', 'outside']) {
        const sheet = exportCss({ strokeAlign, strokeWidth: 2 });
        assert.match(rootRule(sheet), /\n {2}border-width: 2px;/);
        assert.doesNotMatch(sheet, /\.button::before/);
    }
});
