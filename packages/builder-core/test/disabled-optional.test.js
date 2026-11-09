// A template may declare no disabled state (a non-interactive one, such as Badge). Such a template has no disabled attribute, no disabled rule and no
// guard in the export, Play or the stylesheet; a template that names a disabled state keeps all of them. A name that is not a state is still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { BOXY } from './helpers/box-template.js';

const badge = TEMPLATES.get('antd-badge');

test('Badge declares no disabled state, and its schema is valid without one', () => {
    assert.equal(badge.element.disabledState, undefined);
    assert.deepEqual(validateTemplateSchema(badge), []);
});

test('a template with no disabled state exports no disabled attribute, rule or guard', () => {
    const model = modelFor(badge);
    const out = generateComponent(model.template, model.binding, model.variables, 'Badge', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.doesNotMatch(out.files['Badge.jsx'], /disabled/i);
    assert.doesNotMatch(out.files['Badge.css'], /disabled/i);
});

test('Play gives such a root no disabled attribute', () => {
    const model = modelFor(badge);
    // A zero count: its root is the hidden one, the case a disabled state on the hiding state would have marked.
    const nodes = instanceFor(model, { type: 'count', count: 0 });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.equal(root.attrs.disabled, undefined);
    assert.equal(root.attrs['aria-disabled'], undefined);
});

test('a template that names a disabled state still exports it, and a name that is not a state is refused', () => {
    assert.deepEqual(validateTemplateSchema(BOXY), []);
    const bad = structuredClone(BOXY);
    bad.element.disabledState = 'nope';
    assert.ok(validateTemplateSchema(bad).some(p => /disabledState/.test(p)));
    const model = modelFor(BOXY);
    const out = generateComponent(model.template, model.binding, model.variables, 'Boxy', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.match(out.files['Boxy.jsx'], /disabled/);
});
