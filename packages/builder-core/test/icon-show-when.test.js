// An icon def may say `showWhen: <prop>`: its slot is on the instance from the start (an alwaysVisible slot) and drawn only while that boolean prop holds. A
// checkmark that Play can show on a click needs a layer to show, so the layer exists, hidden, while the prop is off. The prop must be a persistent state the
// root says as an attribute, so Play and the export can follow it without the engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { slotShown } from '../src/behavior-engine/template-master.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BOXY, modelFor, instanceFor } from './helpers/box-template.js';

/** BOXY whose checkmark is always on the instance and drawn while checked. */
const SHOWN = (() => {
    const t = structuredClone(BOXY);
    t.id = 'showy';
    t.name = 'Showy';
    t.anatomy[1] = { id: 'check', kind: 'icon', managed: true, alwaysVisible: true, parent: 'box' };
    delete t.icons[0].show;
    t.icons[0].showWhen = 'checked';
    return t;
})();
const model = modelFor(SHOWN);
const values = props => resolveProps(SHOWN, props);

test('the schema accepts showWhen on a persistent state prop and refuses anything else', () => {
    assert.deepEqual(validateTemplateSchema(SHOWN), []);
    const notBoolean = structuredClone(SHOWN);
    notBoolean.icons[0].showWhen = 'label';
    assert.ok(validateTemplateSchema(notBoolean).some(p => /showWhen/.test(p)));
    const notState = structuredClone(SHOWN);
    notState.icons[0].showWhen = 'hasLabel';
    assert.ok(validateTemplateSchema(notState).some(p => /showWhen/.test(p)), 'a prop that is not a state with an attribute has nothing to follow');
});

test('the slot is wanted whatever the prop and shown only while it holds', () => {
    assert.equal(slotShown(SHOWN, 'check', values({})), false);
    assert.equal(slotShown(SHOWN, 'check', values({ checked: true })), true);
    const ops = planAnatomy(SHOWN, values({}), []);
    assert.deepEqual(ops.find(op => op.slot === 'check'), { op: 'insert', slot: 'check', index: 0, parent: 'box' }, 'the layer is made even while unchecked');
    const held = [{ id: 'c', slot: 'check', name: 'check' }, { id: 'l', slot: 'label', name: 'label' }];
    assert.deepEqual(planAnatomy(SHOWN, values({ checked: true }), held), [], 'and stays when it is turned on');
    assert.deepEqual(planAnatomy(SHOWN, values({}), held), [], 'and when it is turned off');
});

test('an instance holds the layer hidden while unchecked and visible while checked', () => {
    const check = props => instanceFor(model, props).find(n => n.behavior?.slot === 'check');
    assert.equal(check({}).visible, false);
    assert.equal(check({ checked: true }).visible, true);
});

test('the export writes the slot under the prop, and Play draws it hidden or shown from the props', () => {
    const out = generateComponent(SHOWN, model.binding, model.variables, 'Showy', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Showy.jsx'], /\{checked && <span className="showy-check">\{checkIcon\}<\/span>\}/);
    const play = props => {
        const nodes = instanceFor(model, props);
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
        return root.children.find(c => c.attrs?.class === 'showy-box').children.find(c => c.attrs?.class === 'showy-check');
    };
    assert.equal(play({}).attrs.hidden, true);
    assert.equal(play({}).attrs['data-show-attr'], 'data-checked');
    assert.equal(play({ checked: true }).attrs.hidden, false);
});
