import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyGuideHost, clonedGuides, guideWorldValue, hostFrameAt, pointInBox, pruneGuides } from '../src/engine/guides.js';

const frameA = { id: 'a', type: 'frame', box: { x: 100, y: 100, w: 400, h: 300 } };
const frameB = { id: 'b', type: 'frame', box: { x: 200, y: 150, w: 200, h: 200 } };
const section = { id: 's', type: 'frame', isSection: true, box: { x: 0, y: 0, w: 900, h: 900 } };

test('hostFrameAt picks the topmost frame at the drop point, never a section', () => {
    assert.equal(hostFrameAt([section, frameA, frameB], { x: 250, y: 200 })?.id, 'b');
    assert.equal(hostFrameAt([section, frameA, frameB], { x: 120, y: 120 })?.id, 'a');
    assert.equal(hostFrameAt([section, frameA], { x: 50, y: 50 }), null);
    assert.equal(hostFrameAt([frameA], { x: 600, y: 200 }), null);
});

test('dropping a ruler guide inside a frame binds it to that frame', () => {
    const gd = { id: 'g1', axis: 'x', value: 250 };
    applyGuideHost(gd, hostFrameAt([frameA], { x: 250, y: 200 }), 250);
    assert.equal(gd.frameId, 'a');
    assert.equal(gd.offset, 150);
    assert.equal(guideWorldValue(gd, frameA.box), 250);
});

test('a frame-bound guide follows when its frame moves', () => {
    const gd = { id: 'g1', axis: 'y', value: 260, frameId: 'a', offset: 160 };
    const moved = { ...frameA.box, x: 340, y: 480 };
    assert.equal(guideWorldValue(gd, moved), 640);
    // Page-level guides stay put.
    assert.equal(guideWorldValue({ axis: 'y', value: 260 }, null), 260);
});

test('dragging a bound guide out of the frame unbinds it back to page level', () => {
    const gd = { id: 'g1', axis: 'x', value: 700, frameId: 'a', offset: 600 };
    applyGuideHost(gd, hostFrameAt([frameA], { x: 700, y: 200 }), 700);
    assert.equal(gd.frameId, undefined);
    assert.equal(gd.offset, undefined);
    assert.equal(gd.value, 700);
});

test('a guide snapped to a rounded frame edge still binds to that frame', () => {
    // Small child frames are common (a 41 x 32 cell in a calendar). snapGuide rounds to two
    // decimals, so the snapped value can sit 0.003 outside the exact edge; it must still bind.
    const tiny = { id: 'tiny', type: 'frame', box: { x: 255.14285714285717, y: 826, w: 41.14285714285717, h: 32 } };
    const gd = { id: 'g-edge', axis: 'x', value: 255.14 };
    applyGuideHost(gd, hostFrameAt([tiny], { x: 256, y: 840 }), 255.14);
    assert.equal(gd.frameId, 'tiny');
    assert.equal(gd.offset, 0);
    assert.equal(gd.value, tiny.box.x);
    // The other edge rounds up by the same amount (296.2857 -> 296.29) and must clamp too.
    const right = { id: 'g-right', axis: 'x', value: 296.29 };
    applyGuideHost(right, hostFrameAt([tiny], { x: 256, y: 840 }), 296.29);
    assert.equal(right.frameId, 'tiny');
    assert.equal(right.value, tiny.box.x + tiny.box.w);
});

test('a guide snapped outside the frame span does not bind', () => {
    const gd = { id: 'g1', axis: 'x', value: 505 };
    applyGuideHost(gd, frameA, 505);
    assert.equal(gd.frameId, undefined);
});

test('pointInBox honours an optional tolerance pad', () => {
    assert.equal(pointInBox(frameA.box, 100, 400), true);
    assert.equal(pointInBox(frameA.box, 99, 200), false);
    assert.equal(pointInBox(frameA.box, 99, 200, 2), true);
});

test('deleting the host frame deletes its guides, page guides survive', () => {
    const guides = [
        { id: 'g1', axis: 'x', value: 1, frameId: 'a' },
        { id: 'g2', axis: 'y', value: 2 },
        { id: 'g3', axis: 'y', value: 3, frameId: 'b' },
    ];
    assert.deepEqual(pruneGuides(guides, new Set(['a'])).map(g => g.id), ['g2', 'g3']);
});

test('duplicating a frame duplicates its guides onto the copy', () => {
    const guides = [
        { id: 'g1', axis: 'x', value: 250, frameId: 'a', offset: 150 },
        { id: 'g2', axis: 'y', value: 20 },
    ];
    const copies = clonedGuides(guides, new Map([['a', 'a2']]), () => 'new-id');
    assert.deepEqual(copies, [{ id: 'new-id', axis: 'x', value: 250, frameId: 'a2', offset: 150 }]);
});
