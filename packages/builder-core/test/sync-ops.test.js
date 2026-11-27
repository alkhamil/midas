// Which layer kind a sync op acts on: remove, move and swap are themselves; an inserted slot is a text layer, a content slot or an icon slot,
// in that order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncOpKindOf } from '../src/behavior-engine/sync-ops.js';

const template = {
    anatomy: [{ id: 'label', kind: 'text' }, { id: 'iconStart', kind: 'icon' }, { id: 'box', kind: 'frame' }],
    slots: [{ id: 'extra' }],
};

test('remove, move and swap are their own kinds, whatever the template', () => {
    assert.equal(syncOpKindOf(template, { op: 'remove', id: 'x' }), 'remove');
    assert.equal(syncOpKindOf(template, { op: 'move', id: 'x', index: 0 }), 'move');
    assert.equal(syncOpKindOf(null, { op: 'swap', id: 'x', component: 'c' }), 'swap');
});

test('an inserted non-icon anatomy slot is a managed text layer', () => {
    assert.equal(syncOpKindOf(template, { op: 'insert', slot: 'label' }), 'text');
});

test('an inserted icon slot is an icon layer; an unknown slot is an icon layer too', () => {
    assert.equal(syncOpKindOf(template, { op: 'insert', slot: 'iconStart' }), 'icon');
    assert.equal(syncOpKindOf(template, { op: 'insert', slot: 'unknown' }), 'icon');
    assert.equal(syncOpKindOf(null, { op: 'insert', slot: 'label' }), 'icon', 'no template: nothing to classify by');
});

test('an inserted content slot that is not an anatomy part is a content layer', () => {
    assert.equal(syncOpKindOf(template, { op: 'insert', slot: 'extra' }), 'content');
});

test('a content slot that is also a non-icon anatomy part is a text layer (the order the studio has always used)', () => {
    const both = { anatomy: [{ id: 'box', kind: 'frame' }], slots: [{ id: 'box' }] };
    assert.equal(syncOpKindOf(both, { op: 'insert', slot: 'box' }), 'text');
});
