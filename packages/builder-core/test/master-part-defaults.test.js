// A master is built from the schema with its props at the sample values, so a conditional part whose condition is off (the Button's spinner while
// `loading` is off) is not built at all: no hidden layer lives on the master, and an instance makes the layer while its props ask for it.
// A part whose condition holds (the Input's sample placeholder) is built visible, as before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame } from '../src/behavior-engine/template-master.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

let seq = 0;
const idOf = key => `d-${key}-${++seq}`;
const build = (template, model) => {
    const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
    const out = applyTemplateToFrame(template, { frame, children: [], binding: { variables: model.binding.variables }, variables: { collections: model.collections, items: model.items }, idOf });
    return Object.fromEntries(out.created.map(n => [n.name, n]));
};

test('the Button master holds no spinner while loading is off: the spinner is an instance layer', () => {
    const layers = build(TEMPLATES.get('button'), buttonModel({ colors: ['primary'], variantModes: ['solid'] }));
    assert.equal(layers.spinner, undefined);
    assert.equal(layers.label.visible, true);
});

test('the Input master is its placeholder only, its sample text shown; the value, affix texts and counter are instance layers', () => {
    const layers = build(TEMPLATES.get('input'), inputModel());
    assert.deepEqual(Object.keys(layers), ['placeholder']);
    assert.equal(layers.placeholder.visible, true, 'the sample placeholder shows');
});

test('a part whose condition holds at the defaults is built visible; a template with no parts is unaffected', () => {
    const template = structuredClone(TEMPLATES.get('button'));
    template.props.loading.default = true;
    assert.equal(build(template, buttonModel({ colors: ['primary'], variantModes: ['solid'] })).spinner.visible, true);
    assert.equal(build(TEMPLATES.get('formitem'), { binding: { variables: {} }, collections: [], items: [] }).label.visible, true);
});
