// A master is built from the schema with its props at their defaults, so a part that its condition shows only for a prop that is off (the Button's spinner while
// `loading` is off, the Input's counter while `showCount` is off, its placeholder while there is none) starts hidden: nothing of it is drawn, and it takes no
// room. Instances already follow their props (partWrites); the master used to draw every part, so a Button that was not loading showed a spinner.
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

test('the Button master starts with its spinner hidden: loading is off', () => {
    const layers = build(TEMPLATES.get('button'), buttonModel({ colors: ['primary'], variantModes: ['solid'] }));
    assert.equal(layers.spinner.visible, false);
    assert.equal(layers.label.visible, true);
});

test('the Input master starts with its counter and placeholder hidden (no count, no placeholder text yet) and its affix texts hidden', () => {
    const layers = build(TEMPLATES.get('input'), inputModel());
    assert.equal(layers.count.visible, false, 'showCount is off');
    assert.equal(layers.placeholder.visible, false, 'no placeholder text');
    assert.equal(layers.prefixText.visible, false);
    assert.equal(layers.suffixText.visible, false);
    assert.equal(layers.value.visible, true, 'the value layer stays: the master is never blank');
});

test('a part whose condition holds at the defaults stays visible; a template with no parts is unaffected', () => {
    const template = structuredClone(TEMPLATES.get('button'));
    template.props.loading.default = true;
    assert.equal(build(template, buttonModel({ colors: ['primary'], variantModes: ['solid'] })).spinner.visible, true);
    assert.equal(build(TEMPLATES.get('formitem'), { binding: { variables: {} }, collections: [], items: [] }).label.visible, true);
});
