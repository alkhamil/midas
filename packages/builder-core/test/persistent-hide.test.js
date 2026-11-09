// A persistent state may hide its element (`hide: true`): while its prop holds, Play and the export hide the root (display none, from the stylesheet),
// and the canvas keeps the node: nothing on the canvas changes. Only an attribute state may hide (a pseudo-class would hide on hover).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BOXY, modelFor, instanceFor } from './helpers/box-template.js';

/** BOXY with a state that hides the root while `empty` holds. */
const HIDING = (() => {
    const t = structuredClone(BOXY);
    t.id = 'hiding';
    t.name = 'Hiding';
    t.props.empty = { source: 'literal', type: 'boolean', default: false };
    t.persistentStates.zeroHidden = { prop: 'empty', tokens: {}, hide: true };
    t.statePseudo.zeroHidden = '[data-zero-hidden]';
    return t;
})();
const model = modelFor(HIDING);

test('the schema accepts a hiding attribute state, and refuses one that is a pseudo-class', () => {
    assert.deepEqual(validateTemplateSchema(HIDING), []);
    const bad = structuredClone(HIDING);
    bad.statePseudo.zeroHidden = ':hover';
    assert.ok(validateTemplateSchema(bad).some(p => /hide/.test(p)), 'a pseudo-class would hide on hover');
});

test('the stylesheet hides the root while the state holds, in Play and the export alike', () => {
    const out = generateComponent(model.template, model.binding, model.variables, 'Hiding', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Hiding.css'], /\.hiding\[data-zero-hidden\] \{\s*display: none;\s*\}/);
});

test('the canvas keeps the node: the instance root is shown whether the state holds or not', () => {
    const shown = instanceFor(model, { empty: true })[0];
    assert.notEqual(shown.visible, false);
    assert.equal(shown.visible, instanceFor(model, { empty: false })[0].visible);
});

test('Play marks the root with the state attribute while the prop holds', () => {
    const nodes = instanceFor(model, { empty: true });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.ok('data-zero-hidden' in root.attrs, 'the root carries the state attribute the stylesheet hides');
});
