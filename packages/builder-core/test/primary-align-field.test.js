// A boolean prop may write the root's primaryAlign: on aligns the row's content to the end, off to the start (a Switch's handle moves with `checked`). The
// canvas holds the node field, Play draws it from the instance and the export from a data attribute the stylesheet selects on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { literalFields, nodeFieldPatch, fieldStyleOf } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BOXY, modelFor, instanceFor } from './helpers/box-template.js';

/** BOXY whose checked prop also moves the root's content to the end. */
const ALIGNED = (() => {
    const t = structuredClone(BOXY);
    t.id = 'aligny';
    t.name = 'Aligny';
    t.props.checked.node = { key: 'root', field: 'primaryAlign' };
    return t;
})();
const model = modelFor(ALIGNED);

test('the schema may write primaryAlign from a boolean prop', () => {
    assert.deepEqual(validateTemplateSchema(ALIGNED), []);
    const bad = structuredClone(ALIGNED);
    bad.props.hasLabel.node = { key: 'label', field: 'primaryAlign' };
    assert.ok(validateTemplateSchema(bad).some(p => /primaryAlign/.test(p)), 'a text layer has no alignment of its own');
});

test('checked writes end, unchecked writes start, on the root', () => {
    const write = checked => literalFields(ALIGNED, { checked }).find(w => w.field === 'primaryAlign');
    assert.deepEqual(write(true), { key: 'root', field: 'primaryAlign', value: 'end' });
    assert.deepEqual(write(false), { key: 'root', field: 'primaryAlign', value: 'start' });
    assert.deepEqual(nodeFieldPatch('primaryAlign', 'end', 'frame'), { primaryAlign: 'end' });
});

test('an instance root carries the alignment its prop writes', () => {
    assert.equal(instanceFor(model, { checked: true })[0].primaryAlign, 'end');
    assert.equal(instanceFor(model, {})[0].primaryAlign, 'start');
});

test('the root says its alignment as a data attribute in Play and in the export, and the stylesheet selects on it', () => {
    assert.deepEqual(fieldStyleOf(ALIGNED, { checked: true }).attrs, { 'data-checked-align': 'end' });
    const out = generateComponent(model.template, model.binding, model.variables, 'Aligny', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Aligny.jsx'], /data-checked-align=\{checked \? "end" : "start"\}/);
    assert.match(out.files['Aligny.css'], /\.aligny\[data-checked-align="end"\] \{\s*justify-content: flex-end;\s*\}/);
    assert.match(out.files['Aligny.css'], /\.aligny\[data-checked-align="start"\] \{\s*justify-content: flex-start;\s*\}/);
    assert.doesNotMatch(out.files['Aligny.jsx'], /--aligny-checked/, 'it is not a custom property');
    const nodes = instanceFor(model, { checked: true });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.equal(root.attrs['data-checked-align'], 'end');
    assert.equal(root.style.justifyContent, 'flex-end', 'Play lays the instance out from its own alignment');
});
