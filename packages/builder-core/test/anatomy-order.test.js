// A managed slot that follows the label goes where the anatomy puts it among the layers around it: the Input's clear icon sits before its
// suffix text, as the schema (and antd) order them, not after it. The editor's plan and the generator's instance agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
const binding = model.binding;

let seq = 0;
const idOf = key => `a-${key}-${++seq}`;
const BOTH = { hasPrefix: true, prefixText: 'Rp', hasSuffix: true, suffixText: '.com', value: 'Hello', allowClear: true, showCount: true };

/** A master built by the generator and the instance of it for these props: the shown layers, in order. */
function shown(props) {
    const frame = { id: 'master', name: input.name, type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(input, { frame, children: [], binding, variables, idOf });
    return instanceOf(input, frame, made.created, props, { id: idOf }).slice(1).filter(n => n.visible !== false).map(n => n.behavior?.slot ?? n.behavior?.part ?? n.name);
}

test('the generator puts the clear icon before the suffix text, and the end icon after both', () => {
    const order = shown({ ...BOTH, hasIcon: true, iconPlacement: 'end' });
    assert.ok(order.indexOf('clear') > -1 && order.indexOf('suffixText') > -1, order.join());
    assert.ok(order.indexOf('clear') < order.indexOf('suffixText'), `clear before the suffix: ${order.join()}`);
    assert.equal(order.at(-1), 'iconEnd', 'the end icon is last');
    assert.equal(shown({ ...BOTH, hasIcon: true, iconPlacement: 'start' })[0], 'iconStart', 'the start icon is first');
});

test('the generator keeps a shown clear last when there is no suffix text', () => {
    const order = shown({ allowClear: true, value: 'x' });
    assert.equal(order.at(-1), 'clear');
});

/** The layers of an Input instance as the editor passes them to the plan: the generated ones, with names and slots. */
function children(props) {
    const frame = { id: 'master', name: input.name, type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(input, { frame, children: [], binding, variables, idOf });
    return instanceOf(input, frame, made.created, props, { id: idOf }).slice(1)
        .filter(n => n.behavior?.slot === undefined)
        .map(n => ({ id: n.id, slot: null, name: n.name, component: null }));
}

test('the plan inserts the clear icon before the suffix text, whatever the layers around it', () => {
    const values = resolveProps(input, { ...BOTH });
    const layers = children(BOTH);
    const names = layers.map(l => l.name);
    const ops = planAnatomy(input, values, layers);
    const insert = ops.find(op => op.op === 'insert' && op.slot === 'clear');
    assert.ok(insert, 'a clear layer is inserted');
    assert.equal(insert.index, names.indexOf('suffixText'), `at the suffix's place: ${names.join()}`);
});

test('the plan moves a clear icon that sits after the suffix text to before it', () => {
    const values = resolveProps(input, { ...BOTH });
    const layers = children(BOTH);
    const at = layers.findIndex(l => l.name === 'suffixText');
    const stored = [...layers.slice(0, at + 1), { id: 'clear-1', slot: 'clear', name: 'clear', component: null }, ...layers.slice(at + 1)];
    const move = planAnatomy(input, values, stored).find(op => op.op === 'move' && op.id === 'clear-1');
    assert.ok(move, 'the clear layer moves');
    assert.equal(move.index, at, 'to the place before the suffix text');
});

test('the plan leaves a clear icon that is already before the suffix text where it is', () => {
    const values = resolveProps(input, { ...BOTH });
    const layers = children(BOTH);
    const at = layers.findIndex(l => l.name === 'suffixText');
    const stored = [...layers.slice(0, at), { id: 'clear-1', slot: 'clear', name: 'clear', component: null }, ...layers.slice(at)];
    assert.deepEqual(planAnatomy(input, values, stored).filter(op => op.op === 'move' || op.op === 'insert'), []);
});
