// How an icon's layers take the icon tokens: a part that holds the tokens itself (a spinner's arc) is coloured by its fill when it is a fill arc
// (an ellipse with no stroke width), by its stroke otherwise; an icon slot's instance fills the slot on both axes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { partColourTargets, iconFillSizing } from '../src/behavior-engine/icon-slot.js';

test('a fill arc (an ellipse with no stroke width) is coloured by its first fill, not its stroke', () => {
    assert.deepEqual(partColourTargets({ type: 'ellipse', strokeWidth: 0 }), { fillIndexes: [0], stroke: false });
    assert.deepEqual(partColourTargets({ type: 'ellipse' }), { fillIndexes: [0], stroke: false });
});

test('a stroked part is coloured by its stroke', () => {
    assert.deepEqual(partColourTargets({ type: 'ellipse', strokeWidth: 2 }), { fillIndexes: [], stroke: true });
    assert.deepEqual(partColourTargets({ type: 'rectangle', strokeWidth: 0 }), { fillIndexes: [], stroke: true });
});

test('an icon instance fills its slot on both axes; one that already does is left alone', () => {
    assert.deepEqual(iconFillSizing({ layoutSizingH: 'hug', layoutSizingV: 'fill' }), { layoutSizingH: 'fill', layoutSizingV: 'fill' });
    assert.equal(iconFillSizing({ layoutSizingH: 'fill', layoutSizingV: 'fill' }), null);
});
