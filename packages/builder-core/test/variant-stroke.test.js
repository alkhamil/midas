// A Variant with a border style (dashed) draws the root stroke in that style on every surface. The modes a real file has are made by Auto Fix with ids that are
// not their names (`uuid` for `dashed`), so a style is found by the mode's name, as the token roles are (case-insensitively), never by its id: matching ids left
// every real Dashed Button solid on the canvas, in the export and (through the node's own style) in Play. This file pins the rule and then the style on each
// surface: the node the canvas draws and Play reads (dash, dot, solid), Play's overlay, and the export's stylesheet, for dashed and dotted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { borderStyleOf, variantStrokePatch } from '../src/behavior-engine/variant-style.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const mode = (id, name) => ({ id, name });
const modesWith = variant => ({ variant, color: mode('c1', 'primary'), size: mode('s1', 'md') });

test('a Variant\'s border style is found by the mode\'s name, whatever its id: dashed by uuid and by name, case-insensitively', () => {
    assert.equal(borderStyleOf(button, modesWith(mode('9f3c-uuid', 'dashed'))), 'dashed');
    assert.equal(borderStyleOf(button, modesWith(mode('9f3c-uuid', 'Dashed'))), 'dashed');
    assert.equal(borderStyleOf(button, modesWith(mode('dashed', 'Anything'))), 'dashed', 'a mode whose id is the key still matches');
    assert.equal(borderStyleOf(button, modesWith(mode('aa11', 'Solid'))), 'solid');
    assert.equal(borderStyleOf(button, modesWith(null)), 'solid');
    assert.equal(borderStyleOf(button, {}), 'solid');
});

test('a template with no variant styles has no border style, and a dotted mode is dotted', () => {
    const plain = { ...button, props: { ...button.props, variant: { source: 'variable', collection: 'Variant' } } };
    assert.equal(borderStyleOf(plain, modesWith(mode('x', 'dashed'))), null);
    const dotted = { ...button, props: { ...button.props, variant: { ...button.props.variant, styles: { dotted: { borderStyle: 'dotted' } } } } };
    assert.equal(borderStyleOf(dotted, modesWith(mode('u', 'Dotted'))), 'dotted');
});

test('the node the canvas draws and Play reads gets the style the Variant says: dashed is dash 4 4, dotted is dot, solid is solid; what already holds is left', () => {
    assert.deepEqual(variantStrokePatch({}, 'dashed'), { strokeStyle: 'dash', strokeDash: 4, strokeGap: 4 });
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 4 }, 'dashed'), null, 'already dashed');
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 9 }, 'dashed'), { strokeStyle: 'dash', strokeDash: 4, strokeGap: 4 }, 'the Variant sets its dash when the Variant changes');
    assert.deepEqual(variantStrokePatch({}, 'dotted'), { strokeStyle: 'dot' });
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dot' }, 'dotted'), null);
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dash', strokeDash: 4 }, 'solid'), { strokeStyle: 'solid' });
    assert.deepEqual(variantStrokePatch({}, 'solid'), null, 'a node with no style is solid');
    assert.deepEqual(variantStrokePatch({ strokeStyle: 'dash' }, null), null, 'no variant styles: the node keeps what it has');
});

/** The Button model with its Variant modes given ids that are not their names, as a real file has them. */
function realModel() {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid', 'dashed', 'outlined'] });
    const ids = new Map();
    const collections = model.collections.map(c => c.name !== 'Button Variant' ? c : { ...c, modes: c.modes.map(m => { ids.set(m.id, `uuid-${m.id}`); return { id: `uuid-${m.id}`, name: m.name }; }) });
    const variant = model.collections.find(c => c.name === 'Button Variant');
    const items = model.items.map(i => i.collectionId !== variant.id ? i : { ...i, values: Object.fromEntries(Object.entries(i.values).map(([k, v]) => [ids.get(k) ?? k, v])) });
    return { model, collections, items };
}
const master = { id: 'm', type: 'frame', layout: 'horizontal' };

test('the export sets the dashed border style on the dashed mode by its id, though the id is not the name; solid has no rule', () => {
    const { model, collections, items } = realModel();
    const css = generateComponent(button, model.binding, { collections, items }, 'Button', master, () => []).files['Button.css'];
    assert.match(css, /\.button\[data-variant="uuid-dashed"\] \{\n  border-style: dashed;\n\}/);
    assert.doesNotMatch(css, /\[data-variant="uuid-solid"\] \{\n  border-style/);
});

test('the export sets the dotted border style on a dotted mode', () => {
    const { model, collections, items } = realModel();
    const dotted = structuredClone(button);
    dotted.props.variant.styles = { dashed: { borderStyle: 'dotted' } };
    const css = generateComponent(dotted, model.binding, { collections, items }, 'Button', master, () => []).files['Button.css'];
    assert.match(css, /\.button\[data-variant="uuid-dashed"\] \{\n  border-style: dotted;\n\}/);
});

test('Play draws the node\'s own stroke style on a bound stroke: dash is dashed, dot is dotted, solid is solid', () => {
    const { model, collections, items } = realModel();
    const solid = [{ type: 'solid', color: '#4338ca', opacity: 1, visible: true }];
    const mast = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 80, h: 40, stroke: '#000000', strokeWidth: 1, vars: { stroke: items.find(i => i.name === 'border').id }, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const overlayStyle = strokeStyle => {
        const instance = { ...mast, id: 'i1', component: false, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: {} }, varModes: { [model.ids.variant]: 'uuid-dashed' }, strokeStyle };
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [mast, instance] }], variables: { collections, items } }, 'i1');
        return root.style.borderStyle;
    };
    assert.equal(overlayStyle('dash'), 'dashed');
    assert.equal(overlayStyle('dot'), 'dotted');
    assert.equal(overlayStyle('solid'), 'solid');
    assert.equal(overlayStyle(undefined), 'solid');
});
