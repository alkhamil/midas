// A Button's stroke style in Play and in the export. The canvas is the source: the node's stroke style (Solid, Dash, Dots), its
// alignment and its radius. A bound stroke keeps the host's state colour.
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
const strokeOf = el => el.children.at(-1);

for (const [strokeStyle, css] of [['dash', 'dashed'], ['dot', 'dotted'], ['solid', 'solid'], [undefined, 'solid']]) {
    test(`a bound ${strokeStyle ?? 'unset'} stroke draws ${css} in Play, with the host's state colour, whatever the Variant says`, () => {
        for (const variant of ['outlined', 'dashed']) {
            const stroke = strokeOf(drawn(boundStroke({ strokeStyle }), { variant }));
            assert.equal(stroke.html, undefined, 'a CSS border, not an SVG with a fixed colour');
            assert.equal(stroke.style.borderStyle, css, `${variant}: the node's style`);
            assert.equal(stroke.style.borderColor, 'inherit', `${variant}: the colour follows the host's states`);
        }
    });
}

test('the Dashed Variant\'s own dash (Dash 4, Gap 4 on the instance) stays a CSS border, so hover and press still recolour it', () => {
    const stroke = strokeOf(drawn(boundStroke({ strokeStyle: 'dash', strokeDash: 4, strokeGap: 4 }), { variant: 'dashed' }));
    assert.equal(stroke.html, undefined);
    assert.equal(stroke.style.borderStyle, 'dashed');
    assert.equal(stroke.style.borderColor, 'inherit');
});

for (const [strokeAlign, inset, radius] of [['inside', '0px', '6px'], ['center', '-1px', '7px'], ['outside', '-2px', '8px']]) {
    test(`a bound ${strokeAlign} Dash and Dots stroke keeps its place and its corners: inset ${inset}, radius ${radius}`, () => {
        for (const strokeStyle of ['dash', 'dot']) {
            const stroke = strokeOf(drawn(boundStroke({ strokeStyle, strokeAlign, strokeWidth: 2 })));
            assert.equal(stroke.style.inset, inset);
            assert.equal(stroke.style.borderRadius, radius);
            assert.equal(stroke.style.borderWidth, '2px');
        }
    });
}

test('an unbound stroke takes its own style, and one with its own dash pattern is still drawn exactly, as SVG', () => {
    assert.equal(strokeOf(drawn({ stroke: '#d9d9d9', strokeWidth: 1, strokeStyle: 'dash' })).style.border, '1px dashed #d9d9d9');
    assert.match(strokeOf(drawn({ stroke: '#d9d9d9', strokeWidth: 1, strokeStyle: 'dash', strokeDash: 6, strokeGap: 2 })).html, /stroke-dasharray="6 2"/);
});

/** The exported stylesheet for a master with the given stroke. */
const exportCss = masterExtra => generateComponent(TEMPLATES.get('button'), model.binding, variables, 'Button', { id: 'm', type: 'frame', layout: 'horizontal', counterAlign: 'center', radius: 6, stroke: '#d9d9d9', strokeWidth: 1, strokeAlign: 'inside', ...masterExtra }, () => []).files['Button.css'];
const rootRule = css => /\.button \{\n([\s\S]*?)\n\}/.exec(css)[1];
const beforeRule = css => /\.button::before \{\n([\s\S]*?)\n\}/.exec(css)[1];
const escape = s => s.replace(/[()+]/g, '\\$&');

for (const [strokeStyle, css] of [['dash', 'dashed'], ['dot', 'dotted'], ['solid', 'solid'], [undefined, 'solid']]) {
    test(`the export's base border style is the master's ${strokeStyle ?? 'unset'} stroke (${css}); the Dashed Variant still sets its own`, () => {
        const sheet = exportCss({ strokeStyle });
        assert.match(rootRule(sheet), new RegExp(`\\n {2}border-style: ${css};`));
        assert.match(sheet, /\.button\[data-variant="dashed"\] \{\n {2}border-style: dashed;\n\}/);
    });
}

test('the export keeps the fill on the root, and its stroke overlay draws no fill', () => {
    const sheet = exportCss({});
    assert.match(rootRule(sheet), /\n {2}background-color: var\(--button-bg\);/);
    assert.doesNotMatch(beforeRule(sheet), /background/);
    assert.doesNotMatch(sheet, /z-index: -/);
    assert.doesNotMatch(sheet, /isolation/);
});

for (const [strokeAlign, width, inset, radius] of [['inside', 1, '0', 'inherit'], ['center', 2, '-1px', 'calc(var(--button-radius) + 1px)'], ['outside', 2, '-2px', 'calc(var(--button-radius) + 2px)']]) {
    test(`the export's ${strokeAlign} stroke overlay: ${width}px wide, inset ${inset}, radius ${radius}`, () => {
        const before = beforeRule(exportCss({ strokeAlign, strokeWidth: width }));
        assert.match(before, new RegExp(`\\n {2}border-width: ${width}px;`));
        assert.match(before, new RegExp(`\\n {2}inset: ${escape(inset)};`));
        assert.match(before, new RegExp(`\\n {2}border-radius: ${escape(radius)};`));
        assert.match(before, /\n {2}border-style: inherit;/);
        assert.match(before, /\n {2}border-color: inherit;/);
    });
}
