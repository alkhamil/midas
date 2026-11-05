// The placeholder text typed in the Behavior panel is drawn while there is no value, on the canvas (the placeholder part is visible and holds the text), in Play
// (the input's placeholder) and in the export (the input's placeholder and the ::placeholder colour), in every state the Input can be in: rest, disabled, read
// only, each status and each variant. A value still beats it. Pinned across the matrix because a report said it was not visible; it could not be reproduced on
// the current build in the studio (canvas data, canvas pixels, Play DOM and pixels were right), so these keep it that way.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { partWrites, literalFields } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
const STATES = [{}, { disabled: true }, { readOnly: true }, { disabled: true, readOnly: true }, { showCount: true }, { hasPrefix: true, prefixText: 'https://' }, { allowClear: true }];

test('on the canvas the placeholder part is visible and holds the typed text in every state, until a value is typed', () => {
    for (const state of STATES) {
        const props = resolveProps(input, { ...state, placeholder: 'Enter your name' });
        const shown = partWrites(input, props).find(w => w.key === 'placeholder' && w.field === 'visible');
        const text = literalFields(input, props).find(w => w.key === 'placeholder' && w.field === 'text');
        assert.equal(shown.value, !state.readOnly, JSON.stringify(state));
        assert.equal(text.value, 'Enter your name', JSON.stringify(state));
    }
    const withValue = resolveProps(input, { placeholder: 'Enter your name', value: 'Ana' });
    assert.equal(partWrites(input, withValue).find(w => w.key === 'placeholder' && w.field === 'visible').value, false, 'a value beats it');
    const readOnlyEmpty = resolveProps(input, { placeholder: 'Enter your name', readOnly: true });
    assert.equal(partWrites(input, readOnlyEmpty).find(w => w.key === 'placeholder' && w.field === 'visible').value, false, 'read only shows the value, not the placeholder');
});

function playInput(props, modes) {
    const master = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const created = applyTemplateToFrame(input, { frame: master, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` }).created;
    const [root, ...copies] = instanceOf(input, master, created, props, { id: src => `i-${src}`, varModes: modes });
    const frame = { ...root, id: 'inst', x: 0, y: 0, w: 200, h: 32 };
    const kids = copies.map(n => (n.parentId === root.id ? { ...n, parentId: 'inst' } : n));
    const doc = { pages: [{ id: 'p', name: 'Screens', nodes: [master, ...created, frame, ...kids] }], variables };
    const find = el => (el.tag === 'input' ? el : (el.children ?? []).map(find).find(Boolean));
    return find(toDomTree(doc, 'inst').root);
}

test('in Play the input carries the placeholder in every state, status and variant, and drops it once there is a value', () => {
    for (const variant of ['outlined', 'filled', 'borderless']) for (const status of ['default', 'error', 'warning']) for (const state of STATES) {
        const control = playInput({ ...state, placeholder: 'Enter your name' }, { [model.ids.variant]: variant, [model.ids.status]: status, [model.ids.size]: 'md' });
        assert.equal(control.attrs.placeholder, state.readOnly ? undefined : 'Enter your name', `${variant} ${status} ${JSON.stringify(state)}`);
    }
    assert.equal(playInput({ placeholder: 'Enter your name', value: 'Ana' }, {}).attrs.placeholder, undefined);
});

test('a value cleared while readOnly is on leaves an empty box on every surface', () => {
    const props = resolveProps(input, { placeholder: 'Enter your name', value: '', readOnly: true });
    const writes = partWrites(input, props);
    assert.equal(writes.find(w => w.key === 'placeholder' && w.field === 'visible').value, false, 'the canvas hides the placeholder');
    assert.equal(writes.find(w => w.key === 'value' && w.field === 'visible').value, false, 'the canvas hides the empty value');
    const control = playInput({ placeholder: 'Enter your name', value: '', readOnly: true }, {});
    assert.equal(control.attrs.placeholder, undefined, 'Play passes no placeholder');
    assert.equal(control.attrs.value, '', 'Play keeps the empty input box');
    const { files } = generateComponent(input, model.binding, variables, 'Input', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []);
    assert.match(files['Input.jsx'], /readOnly !== true \? placeholder : undefined/, 'the export gates the placeholder on readOnly too');
});

test('the export puts the placeholder on the input while the value is empty, and colours it with the placeholder token', () => {
    const { files } = generateComponent(input, model.binding, variables, 'Input', { id: 'm', type: 'frame', layout: 'horizontal' }, () => []);
    assert.match(files['Input.jsx'], /placeholder=\{String\(value \?\? ""\) === "" && readOnly !== true \? placeholder : undefined\}/);
    assert.match(files['Input.css'], /\.input-value::placeholder \{\n  color: var\(--input-placeholder\);/);
});
