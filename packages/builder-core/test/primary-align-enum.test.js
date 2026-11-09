// An enum prop may write the root's primaryAlign through a value map: each option maps to start, center or end. The data attribute Play and the export
// carry and the stylesheet's rules follow the mapping, so a three-way alignment reads as a boolean's two-way one does. A boolean keeps its own output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { literalFields, fieldStyleOf } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BOXY, modelFor, instanceFor } from './helpers/box-template.js';

/** BOXY whose `placement` enum moves the root's content to the start, the centre or the end. */
const PLACED = (() => {
    const t = structuredClone(BOXY);
    t.id = 'placed';
    t.name = 'Placed';
    t.props.placement = { source: 'literal', type: 'enum', options: ['start', 'center', 'end'], default: 'start', node: { key: 'root', field: 'primaryAlign', values: { start: 'start', center: 'center', end: 'end' } } };
    return t;
})();
const model = modelFor(PLACED);

test('the schema accepts an enum mapping onto primaryAlign', () => {
    assert.deepEqual(validateTemplateSchema(PLACED), []);
});

test('each option writes its mapped alignment onto the root', () => {
    const write = placement => literalFields(PLACED, { placement }).find(w => w.field === 'primaryAlign');
    assert.equal(write('start').value, 'start');
    assert.equal(write('center').value, 'center');
    assert.equal(write('end').value, 'end');
});

test('an instance root carries the alignment its enum writes', () => {
    assert.equal(instanceFor(model, { placement: 'center' })[0].primaryAlign, 'center');
});

test('the root says the chosen alignment as a data attribute, Play and the export alike', () => {
    assert.deepEqual(fieldStyleOf(PLACED, { placement: 'center' }).attrs, { 'data-placement-align': 'center' });
    const out = generateComponent(model.template, model.binding, model.variables, 'Placed', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Placed.jsx'], /data-placement-align=\{\{"start": "start", "center": "center", "end": "end"\}\[placement\]\}/);
    assert.match(out.files['Placed.css'], /\.placed\[data-placement-align="center"\] \{\s*justify-content: center;\s*\}/);
    assert.match(out.files['Placed.css'], /\.placed\[data-placement-align="start"\] \{\s*justify-content: flex-start;\s*\}/);
    assert.match(out.files['Placed.css'], /\.placed\[data-placement-align="end"\] \{\s*justify-content: flex-end;\s*\}/);
    const nodes = instanceFor(model, { placement: 'center' });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.equal(root.attrs['data-placement-align'], 'center');
    assert.equal(root.style.justifyContent, 'center', 'Play lays the instance out from the chosen alignment');
});
