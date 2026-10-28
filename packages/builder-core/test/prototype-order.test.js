import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { layoutOrder } from '../src/geometry/autolayout.js';

// The canvas: a child's flow position is `layoutOrder` (a Figma import stores its children back to front, `layoutFlip`), and its paint
// order is the stored order, reversed when the frame paints its first child on top (`layoutReverseZ`). Play follows both.
const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 600, fills: [], ...extra });
const box = (id, parentId, extra = {}) => ({ id, name: id, type: 'rect', parentId, x: 0, y: 0, w: 120, h: 40, fills: [], ...extra });
const rootOf = nodes => toDomTree({ pages: [{ id: 'p', name: 'P', nodes }] }, 'A').root;
/** The child ids in flow order: by the CSS `order` each in-flow child carries (an absent order is 0). */
const flowIds = root => root.children.filter(c => c.style.position !== 'absolute').slice().sort((a, b) => Number(a.style.order ?? 0) - Number(b.style.order ?? 0)).map(c => c.nodeId);

test('an imported column keeps its visual order: the first visual child is the last stored, and it is laid out first', () => {
    // Stored back to front, as the importer writes it: logo is the last stored, so it is the top of the column.
    const stored = ['cta', 'forgot', 'password', 'email', 'subtitle', 'title', 'logo'];
    const root = rootOf([frame('A', { layout: 'vertical', layoutFlip: true, layoutReverseZ: true }), ...stored.map(id => box(id, 'A'))]);
    assert.deepEqual(flowIds(root), ['logo', 'title', 'subtitle', 'email', 'password', 'forgot', 'cta']);
    assert.deepEqual(layoutOrder({ layoutFlip: true, type: 'frame', layout: 'vertical' }, stored), stored.slice().reverse());
});

test('the paint order of an imported column is the stored order reversed, so the first visual child is painted last', () => {
    const stored = ['cta', 'forgot', 'password', 'email', 'subtitle', 'title', 'logo'];
    const root = rootOf([frame('A', { layout: 'vertical', layoutFlip: true, layoutReverseZ: true }), ...stored.map(id => box(id, 'A'))]);
    assert.deepEqual(root.children.map(c => c.nodeId), ['logo', 'title', 'subtitle', 'email', 'password', 'forgot', 'cta']);
});

test('a column of four or more children without a flip keeps its order in the flow and in the paint', () => {
    const root = rootOf([frame('A', { layout: 'vertical' }), box('a', 'A'), box('b', 'A'), box('c', 'A'), box('d', 'A'), box('e', 'A')]);
    assert.deepEqual(flowIds(root), ['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(root.children.map(c => c.nodeId), ['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(root.children.map(c => c.style.order), ['0', '1', '2', '3', '4']);
});

test('first on top without a flip: the flow keeps the stored order, and the paint runs from the last stored child', () => {
    const root = rootOf([frame('A', { layout: 'horizontal', layoutReverseZ: true }), box('a', 'A'), box('b', 'A'), box('c', 'A')]);
    assert.deepEqual(flowIds(root), ['a', 'b', 'c']);
    assert.deepEqual(root.children.map(c => c.nodeId), ['c', 'b', 'a']);
});

test('an absolutely positioned child of an auto layout is not in the flow, and keeps its place in the paint', () => {
    const root = rootOf([frame('A', { layout: 'vertical' }), box('a', 'A'), box('badge', 'A', { layoutPositioning: 'absolute', x: 200, y: 4 }), box('b', 'A')]);
    assert.deepEqual(flowIds(root), ['a', 'b']);
    const badge = root.children.find(c => c.nodeId === 'badge');
    assert.equal(badge.style.order, undefined);
    assert.deepEqual([badge.style.position, badge.style.left], ['absolute', '200px']);
    assert.deepEqual(root.children.map(c => c.nodeId), ['a', 'badge', 'b']);
});

test('in a plain frame the children are placed at their x and y, and paint in the stored order: the last stored is on top', () => {
    const root = rootOf([frame('A'), box('under', 'A', { x: 10, y: 10 }), box('over', 'A', { x: 10, y: 10 })]);
    assert.deepEqual(root.children.map(c => c.nodeId), ['under', 'over']);
    assert.equal(root.children[0].style.order, undefined);
    assert.equal(root.children[1].style.left, '10px');
});

test('building the flow order does not change the document', () => {
    const nodes = [frame('A', { layout: 'vertical', layoutFlip: true }), box('a', 'A'), box('b', 'A')];
    const before = JSON.stringify(nodes);
    rootOf(nodes);
    assert.equal(JSON.stringify(nodes), before);
});
