// `sampleProps`: the props a generated master and its demo instance start with (Generate Design System), so the Input shows
// "Input placeholder" instead of an empty, hidden placeholder. Schema data; the engine names no template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { validateTemplateSchema as templateProblems } from '../src/behavior-engine/validate-schema.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `s-${key}-${++seq}`;
const build = template => {
    const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
    return { frame, created: applyTemplateToFrame(template, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf }).created };
};

test('the Input master is generated with a visible placeholder reading "Input placeholder"', () => {
    const placeholder = build(input).created.find(n => n.name === 'placeholder');
    assert.equal(placeholder.text, 'Input placeholder');
    assert.equal(placeholder.visible, true);
});

test('a demo instance built from the sample props shows the same placeholder and stores it', () => {
    const { frame, created } = build(input);
    const [root, ...layers] = instanceOf(input, frame, created, { ...input.sampleProps }, { id: idOf });
    assert.equal(root.behavior.props.placeholder, 'Input placeholder');
    const placeholder = layers.find(n => n.name === 'placeholder');
    assert.equal(placeholder.text, 'Input placeholder');
    assert.equal(placeholder.visible, true);
});

test('a template without sampleProps builds no conditional part: the placeholder is an instance layer', () => {
    const template = structuredClone(input);
    delete template.sampleProps;
    assert.equal(build(template).created.find(n => n.name === 'placeholder'), undefined);
});

test('the validator refuses sampleProps that name no literal prop, or a value of the wrong type', () => {
    const bad = patch => { const t = structuredClone(input); t.sampleProps = patch; return templateProblems(t); };
    assert.deepEqual(templateProblems(input), []);
    assert.ok(bad({ nope: 'x' }).some(p => /sampleProps/.test(p)));
    assert.ok(bad({ variant: 'outlined' }).some(p => /sampleProps/.test(p)), 'a variable prop is not a sample prop');
    assert.ok(bad({ placeholder: 3 }).some(p => /sampleProps/.test(p)));
    assert.ok(bad([]).some(p => /sampleProps/.test(p)));
});
