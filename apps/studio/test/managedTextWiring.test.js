// The studio's wiring of the Input's managed text layers (docs/input-managed-text.md). midas.js is the editor's whole module and needs a
// browser (`document` at load), so these tests cannot call it. Two kinds of check stand in: (1) the wiring is read from the source, in the
// way the other studio tests read it (what calls what, in which order), and (2) the sequence syncInstance runs is replayed over a plain
// node list with the same builder-core functions, so the behaviour of the glue's inputs and outputs is exercised: a layer made on a
// toggle, bound at instance level, written from its prop, removed and made again. What neither reaches is listed in the docs, section 6.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as core from '@midas/builder-core';
import { inputModel } from '../../../scripts/input-model.mjs';

const { TEMPLATES, applyTemplateToFrame, instanceOf, managedTextLayer, planManagedTextBindings, applyBindTokens, resolveProps, literalFields, partWrites, nodeFieldPatch, slotShown } = core;
const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const body = name => {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} exists`);
    return src.slice(at, src.indexOf('\n}\n', at));
};

test('every name midas.js imports from builder-core is exported by it', () => {
    const line = src.split('\n').find(l => l.includes("from '@midas/builder-core'"));
    const names = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}')).split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    assert.deepEqual(names.filter(n => !(n in core)), []);
});

test('syncInstance: makes a text layer for an insert of a managed text slot, then binds, then writes the literal fields', () => {
    const sync = body('syncInstance');
    assert.ok(sync.includes('managedTextSlotOf(inst, op.slot)'), 'an insert of a text or control slot takes the text path');
    assert.ok(sync.indexOf('managedSlotLayer(') < sync.indexOf("node('frame'"), 'the text layer is made before the icon frame fallback');
    const order = ['applyStateBindings(', 'applyManagedTextBindings(', 'applyLiteralFields(', 'applyIconSlotBindings('].map(call => sync.indexOf(call));
    assert.ok(order.every(at => at >= 0), 'each step is called');
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'state bindings, managed text bindings, literal fields, icon bindings, in that order');
    assert.ok(sync.includes('doc.remove([op.id])'), 'a remove op removes the layer, text or icon alike');
});

test('instance creation runs the sync, so a new instance\'s managed layers are bound', () => {
    const at = src.indexOf('instanceOf(template, master');
    assert.ok(at >= 0);
    assert.ok(src.slice(at, at + 600).includes('syncInstance(copies[0])'), 'the new instance is synced right after it is built');
});

test('managed text layers are found by the template anatomy: a slot marker whose slot is not an icon', () => {
    const lookup = body('managedTextLayersOf');
    assert.ok(lookup.includes('c.behavior?.slot !== undefined') && lookup.includes("s.kind !== 'icon'"));
    const bind = body('applyManagedTextBindings');
    for (const part of ['managedTextLayersOf(inst, template)', 'planManagedTextBindings(', 'resolveProps(template, inst.behavior?.props', 'applyBindTokens(layers, ops)']) assert.ok(bind.includes(part), `applyManagedTextBindings uses ${part}`);
});

test('applyLiteralFields writes the primary layer under the template\'s primary slot, and a managed text layer by its slot id', () => {
    const fields = body('applyLiteralFields');
    assert.ok(fields.includes('[template.primarySlot]: label'), 'the target key is the primary slot, not a fixed label');
    assert.ok(!/root: inst, label,/.test(fields), 'no fixed label key remains');
    assert.ok(fields.includes('managedTextLayersOf(inst, template)') && fields.includes('c.behavior.slot'), 'managed text layers are targets by slot id');
    assert.ok(fields.includes('slotShown(template'), 'a managed slot\'s visibility follows slotShown, which a text slot answers from its own condition');
});

// ---- The replayed sequence: the same builder-core calls syncInstance and applyLiteralFields make, over a plain node list. ----

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
const binding = model.binding;
let seq = 0;
const uid = () => `u${++seq}`;
const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 343, h: 32, fills: [], layout: 'horizontal', component: true };
const made = applyTemplateToFrame(input, { frame, children: [], binding, variables, idOf: key => `m-${key}` });

/** An instance and its layers as a node list; the glue below edits it as the editor's `doc` would. */
function newInstance(props) {
    const nodes = instanceOf(input, frame, made.created, props, { id: () => uid() });
    return { inst: nodes[0], layers: nodes.slice(1) };
}
const resolved = state => resolveProps(input, state.inst.behavior.props);

/** syncInstance's plan and its two managed-text steps, over the node list (icon slots are not made: these props show none). */
function sync(state) {
    const { ops } = core.planInstanceAnatomy({
        binding: frame.behavior, masterRoot: { isAutoLayout: true }, masterTree: made.created, stored: state.inst.behavior.props,
        children: state.layers.map(c => ({ id: c.id, slot: c.behavior?.slot ?? null, name: c.name, component: null })),
    });
    for (const op of ops) {
        if (op.op === 'remove') state.layers = state.layers.filter(c => c.id !== op.id);
        else if (op.op === 'insert') {
            assert.notEqual(input.anatomy.find(s => s.id === op.slot).kind, 'icon', 'these props make no icon slot');
            state.layers.splice(op.index, 0, managedTextLayer(input, op.slot, resolved(state), { id: uid(), parentId: state.inst.id }));
        }
    }
    // applyManagedTextBindings
    const managed = state.layers.filter(c => c.behavior?.slot !== undefined && c.type === 'text').map(node => ({ key: node.behavior.slot, node }));
    applyBindTokens(managed, planManagedTextBindings({ template: input, binding, props: resolved(state), layers: managed, variables }).ops);
    // applyLiteralFields: the managed text layers are targets by slot id
    const target = Object.fromEntries(managed.map(l => [l.key, l.node]));
    for (const { key, field, value } of [...literalFields(input, resolved(state)), ...partWrites(input, resolved(state))]) {
        const n = target[key];
        if (n) Object.assign(n, nodeFieldPatch(field, value, n.type));
    }
    return state;
}
const edit = (state, props) => { state.inst.behavior = { ...state.inst.behavior, props: { ...state.inst.behavior.props, ...props } }; return sync(state); };
const names = state => state.layers.filter(n => n.type === 'text').map(n => n.name);
const itemNamed = name => variables.items.find(i => i.name === name).id;

test('a toggle makes the layer, a second sync changes nothing, and an edit of the text reaches the layer', () => {
    const state = newInstance({});
    assert.deepEqual(names(sync(state)), ['placeholder']);
    edit(state, { hasPrefix: true, prefixText: 'Rp' });
    assert.deepEqual(names(state), ['prefixText', 'placeholder']);
    const before = state.layers.map(n => n.id);
    sync(state);
    assert.deepEqual(state.layers.map(n => n.id), before, 'a second sync makes and removes nothing');
    edit(state, { prefixText: 'USD' });
    assert.equal(state.layers.find(n => n.name === 'prefixText').text, 'USD', 'the layer is written from its prop');
    edit(state, { value: 'Hi' });
    assert.equal(state.layers.find(n => n.name === 'value').text, 'Hi', 'the value layer is found by its slot id and written under the primary key');
});

test('the layer is bound at instance level: fill and typography, and the disabled colour while disabled', () => {
    const state = newInstance({});
    edit(state, { value: 'Hi' });
    const value = () => state.layers.find(n => n.name === 'value');
    assert.equal(value().vars['fills.0'], itemNamed('fg'));
    assert.ok(value().vars.typography, 'typography is bound');
    edit(state, { disabled: true });
    assert.equal(value().vars['fills.0'], itemNamed('fg-disabled'), 'disabled binds the state colour');
    edit(state, { disabled: false });
    assert.equal(value().vars['fills.0'], itemNamed('fg'));
});

test('a layer removed by its toggle comes back with the text the prop kept, bound again', () => {
    const state = newInstance({});
    edit(state, { hasSuffix: true, suffixText: '.com' });
    edit(state, { hasSuffix: false });
    assert.deepEqual(names(state), ['placeholder'], 'removed, not hidden');
    edit(state, { hasSuffix: true });
    const back = state.layers.find(n => n.name === 'suffixText');
    assert.equal(back.text, '.com');
    assert.ok(back.vars['fills.0'], 'bound as the first one was');
});

test('the counter layer carries the value length and follows the value', () => {
    const state = newInstance({ showCount: true, maxLength: 10 });
    sync(state);
    assert.equal(state.layers.find(n => n.name === 'count').text, '0 / 10');
    edit(state, { value: 'Hello' });
    assert.equal(state.layers.find(n => n.name === 'count').text, '5 / 10');
    assert.equal(slotShown(input, 'count', resolved(state)), true);
});
