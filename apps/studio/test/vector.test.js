// Vector di preview harus sama dengan yang dilukis kanvas (pathFor): sub-path `contours`
// ikut digambar, segmen lurus jadi L, lengkung jadi C, contour tertutup secara default.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathData, pinBox, retargetIconLayers } from '../src/preview/live.js';

test('straight segments stay straight, curves stay curves', () => {
    assert.equal(pathData([{ x: 0, y: 0 }, { x: 10, y: 0 }], false), 'M0 0 L10 0');
    assert.equal(
        pathData([{ x: 0, y: 0, out: { x: 5, y: 0 } }, { x: 10, y: 0 }], false),
        'M0 0 C5 0 10 0 10 0'
    );
});

test('a closed path closes back to its first point', () => {
    assert.equal(
        pathData([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true),
        'M0 0 L10 0 L10 10 L0 0Z'
    );
});

test('contours draw as sub-paths, closed unless left open', () => {
    const hole = [{ x: 8, y: 8 }, { x: 16, y: 8 }, { x: 16, y: 16 }, { x: 8, y: 16 }];
    assert.equal(
        pathData([{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: 24 }, { x: 0, y: 24 }], true, [{ points: hole }]),
        'M0 0 L24 0 L24 24 L0 24 L0 0ZM8 8 L16 8 L16 16 L8 16 L8 8Z'
    );
    assert.equal(
        pathData([{ x: 0, y: 0 }, { x: 24, y: 0 }], false, [{ points: hole.slice(0, 2), closed: false }]),
        'M0 0 L24 0M8 8 L16 8'
    );
});

test('the icon wrapper keeps its box when the graphic swaps', () => {
    const wrapper = { x: 1, y: 2, w: 20, h: 20, fill: '#fff', layoutSizingH: 'hug', layoutSizingV: 'fixed' };
    const pinned = pinBox(wrapper);
    assert.equal(pinned.layoutSizingH, 'fixed');
    assert.equal(pinned.layoutSizingV, 'fixed');
    assert.equal(pinned.w, 20);
    assert.equal(wrapper.layoutSizingH, 'hug', 'the document node itself is not mutated');
    const fill = pinBox({ ...wrapper, layoutSizingH: 'fill' });
    assert.equal(fill.layoutSizingH, 'fill', 'fill sizing keeps stretching with the parent');
});

test('state colors follow the same-named layer in the new icon', () => {
    const nodes = { eye: { id: 'eye', name: 'Vector' }, eyeOff: { id: 'eyeOff', name: 'Vector' }, other: { id: 'other', name: 'Box' } };
    const ctx = { node: id => Object.values(nodes).find(n => n.id === id) || null, descendants: () => [nodes.eyeOff, nodes.other] };
    const inner = { target: { fill: 'eye', stroke: null } };
    retargetIconLayers(ctx, inner, { id: 'master' });
    assert.equal(inner.target.fill, 'eyeOff');
    assert.equal(inner.target.stroke, null);
});

test('empty input and rounding behave', () => {
    assert.equal(pathData([], true), '');
    assert.equal(pathData(null, false), '');
    assert.equal(pathData([{ x: 1.23456, y: 0 }, { x: 2, y: 0 }], false), 'M1.235 0 L2 0');
});
