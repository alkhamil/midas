import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boundsIn, descendantsOf, effectBleed, planRasterRoots } from '../src/engine/rasterRoutes.js';

// A scene item as the planner sees it: its parent, the reasons its own paint needs the raster path, and the parents of the masks
// that clip it (the mask's parent is the group the mask and its content share).
const item = (id, parentId = null, extra = {}) => ({ id, parentId, reasons: [], maskParents: [], ...extra });

test('plain layers need no raster route, however many there are', () => {
    const items = [item('frame'), ...Array.from({ length: 400 }, (_, i) => item('n' + i, 'frame')), item('top')];
    assert.equal(planRasterRoots(items).size, 0);
});

test('a masked group is one raster root: the mask and the content it clips stay inside it', () => {
    const items = [item('G'), item('M', 'G'), item('C', 'G', { maskParents: ['G'] }), item('P')];
    assert.deepEqual([...planRasterRoots(items)], [['G', new Set(['mask'])]]);
});

test('an effect node is its own root, and a plain sibling is left on the GPU', () => {
    const items = [item('F'), item('E', 'F', { reasons: ['effect'] }), item('P', 'F')];
    assert.deepEqual([...planRasterRoots(items)], [['E', new Set(['effect'])]]);
});

test('an effect inside a masked group does not get its own root: the group is the root', () => {
    const items = [item('G'), item('M', 'G'), item('E', 'G', { reasons: ['effect'], maskParents: ['G'] })];
    assert.deepEqual([...planRasterRoots(items)], [['G', new Set(['mask', 'effect'])]]);
});

test('a node clipped by a mask whose group is itself clipped climbs to the outer group', () => {
    const items = [item('R'), item('Q', 'R', { maskParents: ['R'] }), item('X', 'Q', { reasons: ['effect'], maskParents: ['R'] })];
    assert.deepEqual([...planRasterRoots(items)], [['R', new Set(['mask', 'effect'])]]);
});

test('a backdrop effect in a frame makes the frame the root, and the children inside it are not roots of their own', () => {
    const items = [item('F', null, { reasons: ['backdrop'] }), item('E', 'F', { reasons: ['effect'] })];
    assert.deepEqual([...planRasterRoots(items)], [['F', new Set(['backdrop'])]]);
});

test('an oversized node has no route: the atlas clamps its resolution', () => {
    assert.equal(planRasterRoots([item('big')]).size, 0);
});

test('descendantsOf lists the root and everything below it', () => {
    const items = [item('G'), item('A', 'G'), item('B', 'A'), item('C')];
    assert.deepEqual([...descendantsOf(items, 'G')].sort(), ['A', 'B', 'G']);
});

test('effectBleed is the margin an effect paints beyond the node box', () => {
    assert.equal(effectBleed([{ type: 'drop', visible: true, x: 4, y: 2, blur: 10, spread: 1 }]), 22);
    assert.equal(effectBleed([{ type: 'layerBlur', visible: true, radius: 8 }]), 12);
    assert.equal(effectBleed([{ type: 'inner', visible: true, blur: 10 }]), 0);
    assert.equal(effectBleed([{ type: 'drop', visible: false, blur: 40 }]), 0, 'a hidden effect paints nothing');
    assert.equal(effectBleed([{ type: 'drop', visible: true, x: 0, y: 0, blur: 4 }, { type: 'layerBlur', visible: true, radius: 8 }]), 12);
});

test('boundsIn maps a world box into a root’s local space through the inverse matrix', () => {
    const inv = [1, 0, 0, 1, -100, -50];
    assert.deepEqual(boundsIn({ x: 110, y: 60, w: 20, h: 10 }, inv), { x: 10, y: 10, w: 20, h: 10 });
});
