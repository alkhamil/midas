// Radio Group: a frame that lays its Radio instances out in a row or a column. Direction writes the frame's layout; Size sets the gap between the options.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent, componentNameOf } from '../src/behavior-engine/codegen.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const group = TEMPLATES.get('antd-radio-group');
const model = modelFor(group);

test('Radio Group is registered, valid, and takes Size from the variable collection, the rest from literals', () => {
    assert.ok(group, 'Radio Group is in the registry');
    assert.equal(group.name, 'Radio Group');
    assert.deepEqual(validateTemplateSchema(group, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.deepEqual(Object.keys(group.props).sort(), ['direction', 'size']);
    assert.equal(group.props.size.source, 'variable');
    assert.equal(group.props.direction.source, 'literal');
});

test('the options are Radio instances only, held in the options frame; a new group starts with two Radios', () => {
    const items = group.slots.find(s => s.id === 'items');
    assert.equal(items.holds, 'instance');
    assert.deepEqual(items.accepts, ['radio']);
    assert.equal(items.onlyAccepts, true);
    assert.equal(items.box, 'options', 'the options frame is the slot box, so the Radios sit in it');
    assert.equal(items.start, 2);
    assert.equal(items.min, 2);
    assert.equal(items.seed[0].template, 'radio');
});

test('Direction writes the options frame layout; horizontal is the default, as antd', () => {
    assert.equal(group.props.direction.default, 'horizontal');
    assert.deepEqual(group.props.direction.node, { key: 'options', field: 'layout' });
    const layout = props => instanceFor(model, props).find(n => n.name === 'options').layout;
    assert.equal(layout({ direction: 'horizontal' }), 'horizontal');
    assert.equal(layout({ direction: 'vertical' }), 'vertical');
});

test('the gap between the options is a Size token', () => {
    assert.deepEqual(group.display.options, { gap: 'gap' });
    assert.deepEqual(Object.keys(group.tokenRoles.gap).sort(), ['default', 'lg', 'md', 'sm', 'xl', 'xs']);
});

test('the export draws the options frame with the gap token, and takes the direction as its own prop', () => {
    const files = generateComponent(group, model.binding, model.variables, componentNameOf(group), model.frame, () => []).files;
    assert.match(files['RadioGroup.css'], /\.antd-radio-group-options \{\s*gap: var\(--antd-radio-group-gap\)/);
    assert.match(files['RadioGroup.tsx'], /direction = "horizontal"/);
});

// Selection in the options frame: a Radio there is exclusive (Play marks it, the canvas clears the others); a loose Radio is not.
import { toDomTree } from '../src/prototype/dom-tree.js';

/** The DOM node carrying a toggle (a data-toggle attribute), found below a root. */
const toggleRootOf = node => (node.attrs?.['data-toggle'] ? node : (node.children ?? []).map(toggleRootOf).find(Boolean));

test('a Radio in the options frame is exclusive in Play; a Radio standing alone is not', () => {
    const radio = TEMPLATES.get('radio');
    const radioModel = modelFor(radio);
    const [inst] = instanceFor(radioModel, { checked: false });
    const master = [radioModel.frame, ...radioModel.created];
    const row = { id: 'row', type: 'frame', name: 'Row', parentId: null, x: 0, y: 0, w: 300, h: 80, fills: [], layout: 'horizontal' };
    const loose = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [...master, row, { ...inst, parentId: row.id }] }], variables: radioModel.variables }, row.id);
    assert.equal(toggleRootOf(loose.root).attrs['data-toggle-exclusive'], undefined, 'a loose Radio has no group');
    const box = { id: 'options-box', type: 'frame', name: 'Options', parentId: row.id, propBind: { slot: 'items' }, fills: [], layout: 'horizontal' };
    const boxed = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [...master, row, box, { ...inst, parentId: box.id }] }], variables: radioModel.variables }, row.id);
    assert.equal(toggleRootOf(boxed.root).attrs['data-toggle-exclusive'], true);
});
