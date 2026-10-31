import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { borderStyleOf } from '../src/behavior-engine/variant-style.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary'], variantModes: ['solid', 'dashed'], sizeModes: [{ id: 'sm', name: 'Small' }] });
const variables = { collections: model.collections, items: model.items };

test('a dashed Variant has the dashed border style; the other Variant modes are solid', () => {
    assert.equal(borderStyleOf(button, { variant: 'dashed', color: 'primary', size: 'sm' }), 'dashed');
    assert.equal(borderStyleOf(button, { variant: 'solid', color: 'primary', size: 'sm' }), 'solid');
});

test('a template with no variant styles has no border style to set', () => {
    const plain = { ...button, props: { ...button.props, variant: { source: 'variable', collection: 'Variant' } } };
    assert.equal(borderStyleOf(plain, { variant: 'dashed' }), null);
});

test('the stylesheet sets the dashed border style on the dashed Variant, and the root has a 1px solid border', () => {
    const css = generateComponent(button, model.binding, variables, 'Button', { id: 'm', type: 'frame', layout: 'horizontal', primaryAxisAlign: 'center', counterAxisAlign: 'center' }, () => []).files['Button.css'];
    assert.match(css, /\.button\[data-variant="dashed"\] \{\n  border-style: dashed;\n\}/);
    assert.doesNotMatch(css, /\.button\[data-variant="solid"\] \{\n  border-style/);
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*border-width: 1px;\n\s*border-style: solid;/);
});

test('Play draws a dashed Button with the same stylesheet, so its border is dashed too', async () => {
    const { toDomTree } = await import('../src/prototype/dom-tree.js');
    const solid = [{ type: 'solid', color: '#4338ca', opacity: 1, visible: true }];
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 80, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'dashed', 'c-color': 'primary', 'c-size': 'sm' } };
    const { root, styles } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables }, 'i1');
    assert.equal(root.attrs['data-variant'], 'dashed');
    assert.match(styles, /\.button\[data-variant="dashed"\] \{\n  border-style: dashed;\n\}/);
});

test('a variant style names a border style the schema can draw: a wavy one is refused', () => {
    const bad = structuredClone(BUTTON);
    bad.props.variant.styles = { dashed: { borderStyle: 'wavy' } };
    assert.match(validateTemplateSchema(bad).join('\n'), /style for mode "dashed" has no border style/);
});

test('the base rule draws the border from the variable, and a transparent-border variant still emits the border rule with the variable', () => {
    const css = generateComponent(button, model.binding, variables, 'Button', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []).files['Button.css'];
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*border-color: var\(--button-border\);\n/);
    assert.match(css, /\[data-variant="solid"\][^\{]*\{\n(?:.*\n)*?\s*--button-border: #00000000;\n/);
});
