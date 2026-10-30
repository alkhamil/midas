import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownedVarKeys } from '../src/behavior-engine/state-bindings.js';
import { withoutOwnedVars, mergeCopiedVars, sameVars, fieldsBoundBy, isCopiedField, isLayoutOwnedField } from '../src/behavior-engine/instance-vars.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);

const button = TEMPLATES.get('button');

test('the owned vars of Button are the fill of the root and the label (the persistent disabled colour)', () => {
    assert.deepEqual(ownedVarKeys(button), ['fills.0']);
});

test('withoutOwnedVars drops only the owned keys', () => {
    assert.deepEqual(withoutOwnedVars({ fill: 'a', stroke: 'b', radius: 'c' }, ['fill']), { stroke: 'b', radius: 'c' });
    assert.deepEqual(withoutOwnedVars(undefined, ['fill']), {});
});

test('a copy takes the master\'s vars, but keeps the instance\'s own owned binding', () => {
    const master = { fill: 'i-bg', stroke: 'i-border', radius: 'i-radius' };
    const instance = { fill: 'i-bg-disabled', stroke: 'i-border', radius: 'i-old' };
    assert.deepEqual(mergeCopiedVars(master, instance, ['fill']), { stroke: 'i-border', radius: 'i-radius', fill: 'i-bg-disabled' });
});

test('a master with a new binding reaches the instance, except the owned key', () => {
    const merged = mergeCopiedVars({ fill: 'i-bg', gap: 'i-gap-new' }, { fill: 'i-bg' }, ['fill']);
    assert.deepEqual(merged, { gap: 'i-gap-new', fill: 'i-bg' });
});

test('when the instance has no owned binding, the copy takes none for it: the derivation adds it on sync', () => {
    assert.deepEqual(mergeCopiedVars({ fill: 'i-bg', stroke: 'i-border' }, { stroke: 'i-border' }, ['fill']), { stroke: 'i-border' });
});

test('a copy with nothing left is undefined, so the instance loses its vars', () => {
    assert.equal(mergeCopiedVars({}, {}, ['fill']), undefined);
});

test('the owned keys of a template with no persistent states are none', () => {
    assert.deepEqual(ownedVarKeys({ ...button, persistentStates: {} }), []);
});

test('sameVars ignores key order, and tells apart a different binding or a missing key', () => {
    assert.equal(sameVars({ fill: 'a', gap: 'g' }, { gap: 'g', fill: 'a' }), true);
    assert.equal(sameVars({ fill: 'a' }, { fill: 'b' }), false);
    assert.equal(sameVars({ fill: 'a' }, { fill: 'a', gap: 'g' }), false);
    assert.equal(sameVars(undefined, {}), true);
});

test('a field bound through vars is recognised, so its materialized value is never an override', () => {
    assert.deepEqual([...fieldsBoundBy({ fill: 'i-bg', padH: 'i-px', w: 'i-w' })].sort(), ['fill', 'padL', 'padR', 'w']);
    assert.equal(fieldsBoundBy({ fill: 'i-bg' }).has('fill'), true);
    assert.equal(fieldsBoundBy({ gap: 'i-gap' }).has('stroke'), false);
    assert.equal(fieldsBoundBy(undefined).size, 0);
});

test('a field bound through vars is not copied from the master: its variable decides its value', () => {
    assert.equal(isCopiedField('fill', { fill: 'i-bg-danger' }), false);
    assert.equal(isCopiedField('padL', { padH: 'i-px' }), false);
    assert.equal(isCopiedField('w', { fill: 'i-bg' }), true);
    assert.equal(isCopiedField('fill', undefined), true);
});

// Layout ownership: the layout engine writes these fields of an instance child, so copying the master's value is rewritten again.
const autoRow = { type: 'frame', layout: 'horizontal' };
const plainFrame = { type: 'frame', layout: 'none' };

test('a flow child of an auto-layout parent is positioned by the layout: x and y are owned', () => {
    const label = { type: 'text', autoW: true };
    assert.equal(isLayoutOwnedField(label, autoRow, 'x'), true);
    assert.equal(isLayoutOwnedField(label, autoRow, 'y'), true);
});

test('an absolutely positioned child of an auto-layout parent keeps its own position', () => {
    const badge = { type: 'frame', layoutPositioning: 'absolute' };
    assert.equal(isLayoutOwnedField(badge, autoRow, 'x'), false);
    assert.equal(isLayoutOwnedField(badge, autoRow, 'y'), false);
});

test('a child of a frame that is not auto layout keeps its x and y', () => {
    const child = { type: 'frame', layoutSizingH: 'fixed' };
    assert.equal(isLayoutOwnedField(child, plainFrame, 'x'), false);
    assert.equal(isLayoutOwnedField(child, plainFrame, 'y'), false);
});

test('the root of an instance keeps its x and y', () => {
    assert.equal(isLayoutOwnedField({ type: 'frame', layout: 'horizontal' }, undefined, 'x'), false);
});

test('a hug frame owns the width and height it hugs, whatever its parent', () => {
    const hugRoot = { type: 'frame', layout: 'horizontal', layoutSizingH: 'hug', layoutSizingV: 'hug' };
    assert.equal(isLayoutOwnedField(hugRoot, undefined, 'w'), true);
    assert.equal(isLayoutOwnedField(hugRoot, undefined, 'h'), true);
    const half = { type: 'frame', layoutSizingH: 'hug', layoutSizingV: 'fixed' };
    assert.equal(isLayoutOwnedField(half, plainFrame, 'w'), true);
    assert.equal(isLayoutOwnedField(half, plainFrame, 'h'), false);
});

test('a fixed frame keeps its size', () => {
    const fixed = { type: 'frame', layoutSizingH: 'fixed', layoutSizingV: 'fixed' };
    assert.equal(isLayoutOwnedField(fixed, autoRow, 'w'), false);
    assert.equal(isLayoutOwnedField(fixed, autoRow, 'h'), false);
});

test('a text child is hug vertically by default, so its height is owned; its width is owned only when it auto-sizes', () => {
    assert.equal(isLayoutOwnedField({ type: 'text' }, autoRow, 'h'), true);
    assert.equal(isLayoutOwnedField({ type: 'text' }, autoRow, 'w'), false);
    assert.equal(isLayoutOwnedField({ type: 'text', autoW: true }, autoRow, 'w'), true);
    assert.equal(isLayoutOwnedField({ type: 'text', layoutSizingH: 'fixed', layoutSizingV: 'fixed' }, autoRow, 'h'), false);
});

test('a fill child is sized by its parent on the fill axis, and not on the other', () => {
    const fill = { type: 'frame', layoutSizingH: 'fill', layoutSizingV: 'fixed' };
    assert.equal(isLayoutOwnedField(fill, autoRow, 'w'), true);
    assert.equal(isLayoutOwnedField(fill, autoRow, 'h'), false);
    assert.equal(isLayoutOwnedField({ ...fill, layoutPositioning: 'absolute' }, autoRow, 'w'), false);
});

test('a fill child of a frame that is not auto layout keeps its position: only the fill axis is owned', () => {
    const fill = { type: 'frame', layoutSizingH: 'fill', layoutSizingV: 'fixed' };
    assert.equal(isLayoutOwnedField(fill, plainFrame, 'x'), false);
    assert.equal(isLayoutOwnedField(fill, plainFrame, 'w'), true);
});

test('a field that the layout never writes is copied (colours, names, sizes of fixed fields)', () => {
    assert.equal(isLayoutOwnedField({ type: 'frame', fills: solid('#fff') }, autoRow, 'fill'), false);
    assert.equal(isLayoutOwnedField({ type: 'text' }, autoRow, 'fontSize'), false);
});
