// Per-side stroke widths and the uniform weight are one value: turning per-side on seeds the sides from the weight, turning it off
// collapses them back, and the canvas, Play and generated CSS all read the same widths through strokeSideWidths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setStrokeSides, setStrokeSide, setStrokeWeight, strokeWeightOf, strokeSideWidths, strokeSidesUniform } from '../src/geometry/shapes.js';
import { screenTree, makeContext } from '../src/library/screen.js';
import { applyBindTokens } from '../src/behavior-engine/bind-tokens.js';

const frame = (props = {}) => ({ id: 'f', type: 'frame', stroke: '#4338ca', strokeWidth: 1, ...props });
const sides = n => [n.strokeT, n.strokeR, n.strokeB, n.strokeL];

test('toggling per-side on a node with weight 1 sets L/T/R/B to 1', () => {
    const n = frame();
    setStrokeSides(n, 'custom');
    assert.equal(n.strokeSides, 'custom');
    assert.deepEqual(sides(n), [1, 1, 1, 1]);
    assert.deepEqual(strokeSideWidths(n), { t: 1, r: 1, b: 1, l: 1 });
    assert.equal(strokeSidesUniform(n), true);
});

test('per-side seeds from the current weight even when stale side widths exist, never from 0', () => {
    const n = frame({ strokeWidth: 2, strokeT: 0, strokeR: 0, strokeB: 0, strokeL: 0 });
    setStrokeSides(n, 'custom');
    assert.deepEqual(sides(n), [2, 2, 2, 2]);
});

test('turning per-side off collapses the sides into the uniform weight and removes them', () => {
    const n = frame();
    setStrokeSides(n, 'custom');
    setStrokeSide(n, 'strokeT', 4);
    setStrokeSide(n, 'strokeL', 0);
    assert.equal(n.strokeWidth, 4, 'the weight follows the widest side');
    setStrokeSides(n, 'all');
    assert.equal(n.strokeWidth, 4);
    assert.equal(n.strokeSides, undefined);
    assert.deepEqual(sides(n), [undefined, undefined, undefined, undefined]);
    assert.deepEqual(strokeSideWidths(n), { t: 4, r: 4, b: 4, l: 4 });
});

test('from per-side to a single side keeps that side\'s width', () => {
    const n = frame();
    setStrokeSides(n, 'custom');
    setStrokeSide(n, 'strokeB', 3);
    setStrokeSides(n, 'bottom');
    assert.equal(n.strokeWidth, 3);
    assert.deepEqual(strokeSideWidths(n), { t: 0, r: 0, b: 3, l: 0 });
});

test('the weight shows the shared width, and null (Mixed) when the sides differ', () => {
    const n = frame();
    setStrokeSides(n, 'custom');
    assert.equal(strokeWeightOf(n), 1);
    setStrokeSide(n, 'strokeR', 3);
    assert.equal(strokeWeightOf(n), null);
    setStrokeWeight(n, 2);
    assert.deepEqual(sides(n), [2, 2, 2, 2]);
    assert.equal(strokeWeightOf(n), 2);
    assert.equal(strokeWeightOf(frame({ strokeWidth: 5 })), 5);
});

test('a bound stroke that gains its width while per-side is on gets that width on every side', () => {
    const n = frame({ strokeWidth: 0, strokeSides: 'custom', strokeT: 0, strokeR: 0, strokeB: 0, strokeL: 0, vars: {} });
    applyBindTokens([{ key: 'root', node: n }], [{ key: 'root', varKey: 'stroke', itemId: 'i-border' }]);
    assert.equal(n.strokeWidth, 1);
    assert.deepEqual(sides(n), [1, 1, 1, 1]);
});

test('generated CSS draws the same side widths the canvas reads', () => {
    const n = frame({ strokeWidth: 1 });
    setStrokeSides(n, 'custom');
    setStrokeSide(n, 'strokeT', 0);
    const node = { ...n, parentId: null, x: 0, y: 0, w: 100, h: 40, fills: [], name: 'Box' };
    const ctx = makeContext({ nodes: [node], variables: { collections: [], items: [] } });
    const { t, r, b, l } = strokeSideWidths(n);
    assert.equal(screenTree(ctx, 'f').tree.style.borderWidth, [t, r, b, l].map(v => `${v}px`).join(' '));
    assert.equal(screenTree(ctx, 'f').tree.style.borderWidth, '0px 1px 1px 1px');
});

