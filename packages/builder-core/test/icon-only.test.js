import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { literalFields } from '../src/behavior-engine/display.js';
import { placementsOfSlot, iconOnlyOf } from '../src/behavior-engine/anatomy.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary'], variantModes: ['solid'], sizeModes: [{ id: 'sm', name: 'Small' }] });
const binding = () => model.binding;
const variables = () => ({ collections: model.collections, items: model.items });

test('the icon slot shows for start and for only; the end slot only for end', () => {
    assert.deepEqual(placementsOfSlot(button, 'iconStart'), ['start', 'only']);
    assert.deepEqual(placementsOfSlot(button, 'iconEnd'), ['end']);
});

test('an instance is icon-only when its icon is shown and its placement is only', () => {
    assert.equal(iconOnlyOf(button, { hasIcon: true, iconPlacement: 'only' }), true);
    assert.equal(iconOnlyOf(button, { hasIcon: false, iconPlacement: 'only' }), false);
    assert.equal(iconOnlyOf(button, { hasIcon: true, iconPlacement: 'start' }), false);
});

test('an icon-only instance hides its label, and a label otherwise stays visible', () => {
    const only = literalFields(button, resolveProps(button, { hasIcon: true, iconPlacement: 'only' }));
    assert.deepEqual(only.filter(f => f.field === 'visible'), [{ key: 'label', field: 'visible', value: false }]);
    const plain = literalFields(button, resolveProps(button, { hasIcon: true, iconPlacement: 'start' }));
    assert.deepEqual(plain.filter(f => f.field === 'visible'), [{ key: 'label', field: 'visible', value: true }]);
});

test('the component hides the label and sets the icon-only class when the instance is icon-only', () => {
    const jsx = generateComponent(button, binding(), variables(), 'Button', { id: 'm', type: 'frame', layout: 'horizontal', primaryAxisAlign: 'center', counterAxisAlign: 'center' }, () => []).files['Button.jsx'];
    assert.match(jsx, /const iconOnly = hasIcon && \(iconPlacement === "only"\);/);
    assert.match(jsx, /className=\{iconOnly \? "button button-icon-only" : "button"\}/);
    assert.match(jsx, /\{!iconOnly && <span className="button-label">\{label\}<\/span>\}/);
    assert.match(jsx, /\{hasIcon && \(iconPlacement === "start" \|\| iconPlacement === "only"\) && <span className="button-iconStart">/);
});

test('the stylesheet has no padding for an icon-only Button, and a minimum width of the control height', () => {
    const css = generateComponent(button, binding(), variables(), 'Button', { id: 'm', type: 'frame', layout: 'horizontal', primaryAxisAlign: 'center', counterAxisAlign: 'center' }, () => []).files['Button.css'];
    assert.match(css, /\.button-icon-only \{\n {2}padding-inline: 0;\n\}/);
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*min-width: var\(--button-height\);/);
});

test('the placement prop cannot name an icon-only value it does not offer', () => {
    const bad = structuredClone(BUTTON);
    bad.props.iconPlacement.iconOnly = ['top'];
    assert.match(validateTemplateSchema(bad).join('\n'), /icon-only placement "top" is not an option of "iconPlacement"/);
});

test('Play draws an icon-only instance with the icon-only class and no label element', async () => {
    const { toDomTree } = await import('../src/prototype/dom-tree.js');
    const solid = [{ type: 'solid', color: '#4338ca', opacity: 1, visible: true }];
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 40, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add', hasIcon: true, iconPlacement: 'only' } }, varModes: { 'c-variant': 'solid', 'c-color': 'primary', 'c-size': 'sm' } };
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables: variables() }, 'i1');
    assert.equal(root.attrs.class, 'button button-icon-only');
    assert.equal(root.children.some(child => child.attrs?.class === 'button-label'), false);
});
