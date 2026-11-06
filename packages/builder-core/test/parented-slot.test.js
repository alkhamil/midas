// A managed slot may name a container of the anatomy as its `parent` (the checkmark lives in the box). The planner puts it inside that container with no
// ordering of its own, an instance holds it under its copy of the container, and Play and the export draw it inside the container's element.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BOXY, modelFor, instanceFor } from './helpers/box-template.js';

const model = modelFor(BOXY);
const values = props => resolveProps(model.template, props);

test('a parented slot is inserted into its container, index 0, and the label keeps the root order', () => {
    const ops = planAnatomy(model.template, values({ checked: true }), []);
    assert.deepEqual(ops.find(op => op.slot === 'check'), { op: 'insert', slot: 'check', index: 0, parent: 'box' });
    assert.equal(ops.find(op => op.slot === 'label').parent, undefined, 'a root slot has no parent');
});

test('a second plan over its own result changes nothing, and unchecking removes the layer wherever it sits', () => {
    const children = [{ id: 'c1', slot: 'check', name: 'check' }, { id: 'l1', slot: 'label', name: 'label' }];
    assert.deepEqual(planAnatomy(model.template, values({ checked: true }), children), []);
    assert.deepEqual(planAnatomy(model.template, values({ checked: false }), children), [{ op: 'remove', id: 'c1' }]);
});

test('an instance holds the slot under its copy of the container', () => {
    const nodes = instanceFor(model, { checked: true });
    const box = nodes.find(n => n.behavior?.group === 'box');
    const check = nodes.find(n => n.behavior?.slot === 'check');
    assert.equal(check.parentId, box.id);
    assert.equal(nodes.find(n => n.behavior?.slot === 'label').parentId, nodes[0].id);
});

test('Play draws the slot inside the box element', () => {
    const nodes = instanceFor(model, { checked: true });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    const box = root.children.find(c => c.attrs?.class === 'boxy-box');
    assert.ok(box.children.some(c => c.attrs?.class === 'boxy-check'), 'the check is a child of the box');
    assert.ok(!root.children.some(c => c.attrs?.class === 'boxy-check'), 'and not of the root');
});

test('the export writes the slot inside the box element', () => {
    const jsx = generateComponent(model.template, model.binding, model.variables, 'Boxy', model.frame, id => model.created.filter(n => n.parentId === id)).files['Boxy.jsx'];
    assert.match(jsx, /<div className="boxy-box">\s*\{checked && <span className="boxy-check">\{checkIcon\}<\/span>\}\s*<\/div>/);
});
