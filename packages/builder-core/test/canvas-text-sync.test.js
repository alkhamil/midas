// Canvas text is the source of truth: Play draws the text the canvas layer holds, and a canvas text edit writes back to the prop that stores it
// (label, value, placeholder...), so the Behavior tab and Play show the same text. One generic rule for every template with managed text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { textWriteBacks, textPropOfKey } from '../src/behavior-engine/display.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { labelEntryOf } from '../src/behavior-engine/layers.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

// The templates whose primary text part is the label, with the props that put the text layer on the canvas.
const CASES = [
    ['button', {}],
    ['checkbox', {}],
    ['radio', {}],
    ['antd-tag', {}],
    ['antd-text', {}],
    ['antd-title', {}],
    ['antd-avatar', { content: 'text', label: 'AB' }],
];

const walk = (el, fn) => { fn(el); for (const c of el.children ?? []) walk(c, fn); };
const textsOf = root => { const out = []; walk(root, el => { if (el.text !== undefined) out.push(el.text); for (const c of el.children ?? []) if (c.text !== undefined) out.push(c.text); }); return out; };

for (const [id, props] of CASES) {
    test(`${id}: Play draws the text edited on the canvas layer, not the stored prop`, () => {
        const template = TEMPLATES.get(id);
        const model = modelFor(template);
        const nodes = instanceFor(model, props);
        const label = labelEntryOf(nodes[0].id, id => nodes.filter(n => n.parentId === id), nodes[0], template.primarySlot)?.node;
        assert.ok(label, 'the instance holds its label layer');
        label.text = 'Edited on canvas';
        const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
        assert.deepEqual(problems, []);
        assert.ok(textsOf(root).includes('Edited on canvas'), `Play shows the canvas text (got ${JSON.stringify(textsOf(root))})`);
    });

    test(`${id}: a canvas text edit writes back to the prop that stores it`, () => {
        const template = TEMPLATES.get(id);
        const key = template.primarySlot;
        const prop = textPropOfKey(template, key);
        assert.ok(prop, 'the primary slot has a backing text prop');
        const writes = textWriteBacks(template, { ...props }, k => (k === key ? 'Edited on canvas' : undefined));
        assert.deepEqual(writes, { [prop]: 'Edited on canvas' });
    });
}

for (const id of ['checkbox', 'antd-text', 'antd-tag']) {
    test(`${id}: a text layer renamed on the canvas (the editor names a layer after its text) is still the slot's layer in Play`, () => {
        const template = TEMPLATES.get(id);
        const model = modelFor(template);
        const nodes = instanceFor(model, {});
        const label = labelEntryOf(nodes[0].id, k => nodes.filter(n => n.parentId === k), nodes[0], template.primarySlot).node;
        Object.assign(label, { name: 'Renamed', text: 'Renamed text' });
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
        assert.ok(textsOf(root).includes('Renamed text'));
    });
}

test('a layer whose text already equals its prop writes nothing back', () => {
    const t = TEMPLATES.get('button');
    assert.deepEqual(textWriteBacks(t, { label: 'Same' }, () => 'Same'), {});
});

test('Input: value and placeholder are written back from their layers; a masked value is never', () => {
    const input = TEMPLATES.get('input');
    assert.equal(textPropOfKey(input, 'value'), 'value');
    assert.equal(textPropOfKey(input, 'placeholder'), 'placeholder');
    const texts = { value: 'typed', placeholder: 'hint' };
    assert.deepEqual(textWriteBacks(input, { value: '', placeholder: '', kind: 'text' }, k => texts[k]), { value: 'typed', placeholder: 'hint' });
    assert.deepEqual(textWriteBacks(input, { value: 'abc', placeholder: '', kind: 'password' }, k => (k === 'value' ? '•••' : undefined)), {}, 'the bullets of a masked value are not the value');
});

test('a key with no backing prop has none', () => {
    assert.equal(textPropOfKey(TEMPLATES.get('button'), 'nope'), undefined);
});
