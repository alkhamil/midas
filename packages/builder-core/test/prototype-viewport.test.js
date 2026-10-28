import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewportLayout, chromeVisibility, overflowWarning, flowFrames, stepFrame, nextScalingMode, resolveScalingMode, SCALING_MODES } from '../src/prototype/viewport.js';

const viewport = { width: 800, height: 600 };
const tall = { width: 375, height: 2000 };
const wide = { width: 1600, height: 300 };
const small = { width: 200, height: 100 };

test('the view modes are, in order: actual size, responsive, fit width, fit width and height', () => {
    assert.deepEqual(SCALING_MODES, ['actual-size', 'responsive', 'fit-width', 'fit-width-and-height']);
});

test('actual size keeps the frame at 1:1, centred on both axes, and scrolls on the axes the frame overflows', () => {
    assert.deepEqual(viewportLayout({ viewport, frame: small, mode: 'actual-size' }), { scale: 1, width: 200, height: 100, offsetX: 300, offsetY: 250, scrollX: 0, scrollY: 0 });
    assert.deepEqual(viewportLayout({ viewport, frame: tall, mode: 'actual-size' }), { scale: 1, width: 375, height: 2000, offsetX: 212.5, offsetY: 0, scrollX: 0, scrollY: 1400 });
    assert.deepEqual(viewportLayout({ viewport, frame: wide, mode: 'actual-size' }), { scale: 1, width: 1600, height: 300, offsetX: 0, offsetY: 150, scrollX: 800, scrollY: 0 });
});

test('responsive gives the window to the frame at scale 1, whatever the frame size, and the window never scrolls', () => {
    const window = { scale: 1, width: 800, height: 600, offsetX: 0, offsetY: 0, scrollX: 0, scrollY: 0 };
    assert.deepEqual(viewportLayout({ viewport, frame: tall, mode: 'responsive' }), window);
    assert.deepEqual(viewportLayout({ viewport, frame: wide, mode: 'responsive' }), window);
    assert.deepEqual(viewportLayout({ viewport, frame: small, mode: 'responsive' }), window);
});

test('fit width scales the frame to the window width and scrolls vertically when the result is taller', () => {
    const t = viewportLayout({ viewport, frame: tall, mode: 'fit-width' });
    assert.equal(t.scale, 800 / 375);
    assert.equal(t.width, 800);
    assert.equal(t.offsetX, 0);
    assert.equal(t.scrollX, 0);
    assert.equal(t.scrollY, 2000 * (800 / 375) - 600);
    assert.equal(viewportLayout({ viewport, frame: wide, mode: 'fit-width' }).scrollY, 0);
    assert.deepEqual(viewportLayout({ viewport, frame: small, mode: 'fit-width' }), { scale: 4, width: 800, height: 400, offsetX: 0, offsetY: 100, scrollX: 0, scrollY: 0 });
});

test('fit width and height contains the frame: the smaller of the two scales, centred on both axes, never scrolling', () => {
    assert.deepEqual(viewportLayout({ viewport, frame: tall, mode: 'fit-width-and-height' }), { scale: 0.3, width: 112.5, height: 600, offsetX: 343.75, offsetY: 0, scrollX: 0, scrollY: 0 });
    assert.deepEqual(viewportLayout({ viewport, frame: wide, mode: 'fit-width-and-height' }), { scale: 0.5, width: 800, height: 150, offsetX: 0, offsetY: 225, scrollX: 0, scrollY: 0 });
    assert.deepEqual(viewportLayout({ viewport, frame: small, mode: 'fit-width-and-height' }), { scale: 4, width: 800, height: 400, offsetX: 0, offsetY: 100, scrollX: 0, scrollY: 0 });
});

test('a zero-sized window keeps scale 1 rather than dividing by zero', () => {
    assert.deepEqual(viewportLayout({ viewport: { width: 0, height: 0 }, frame: tall, mode: 'fit-width' }), { scale: 1, width: 375, height: 2000, offsetX: 0, offsetY: 0, scrollX: 375, scrollY: 2000 });
});

test('a view mode that does not exist is refused', () => {
    assert.throws(() => viewportLayout({ viewport, frame: tall, mode: 'fill-screen' }), /Unknown view mode "fill-screen"/);
});

test('Z moves through the four modes and back to actual size', () => {
    assert.equal(nextScalingMode('actual-size'), 'responsive');
    assert.equal(nextScalingMode('responsive'), 'fit-width');
    assert.equal(nextScalingMode('fit-width'), 'fit-width-and-height');
    assert.equal(nextScalingMode('fit-width-and-height'), 'actual-size');
});

test('Z from an unknown mode, or from the removed fill screen, moves on from actual size', () => {
    assert.equal(nextScalingMode('nonsense'), 'responsive');
    assert.equal(nextScalingMode(undefined), 'responsive');
    assert.equal(nextScalingMode('fill-screen'), 'actual-size');
});

test('a stored view mode is kept when it exists; fill screen becomes fit width and height; anything else is actual size', () => {
    for (const mode of SCALING_MODES) assert.equal(resolveScalingMode(mode), mode);
    assert.equal(resolveScalingMode('fill-screen'), 'fit-width-and-height');
    assert.equal(resolveScalingMode('nonsense'), 'actual-size');
    assert.equal(resolveScalingMode(''), 'actual-size');
    assert.equal(resolveScalingMode(null), 'actual-size');
    assert.equal(resolveScalingMode(3), 'actual-size');
});

test('a click on an empty area, a node with no interaction, or a disabled element hides the chrome', () => {
    const shown = { visible: true, pinnedHidden: false };
    for (const target of ['empty', 'node', 'disabled']) {
        assert.deepEqual(chromeVisibility(shown, { type: 'click', target, triggered: false }), { visible: false, pinnedHidden: false }, target);
    }
});

test('a click that triggers an interaction, a Button, a scrollbar, the chrome or the menu keeps the chrome', () => {
    const shown = { visible: true, pinnedHidden: false };
    assert.equal(chromeVisibility(shown, { type: 'click', target: 'node', triggered: true }).visible, true);
    assert.equal(chromeVisibility(shown, { type: 'click', target: 'empty', triggered: true }).visible, true);
    for (const target of ['button', 'scroll', 'chrome', 'menu']) {
        assert.equal(chromeVisibility(shown, { type: 'click', target, triggered: false }).visible, true, target);
    }
});

test('a click that hides nothing does not show a hidden chrome either', () => {
    const hidden = { visible: false, pinnedHidden: false };
    assert.equal(chromeVisibility(hidden, { type: 'click', target: 'button', triggered: false }).visible, false);
    assert.equal(chromeVisibility(hidden, { type: 'click', target: 'empty', triggered: false }).visible, false);
});

test('the pointer in the top edge zone shows the chrome; the pointer anywhere else does not', () => {
    const hidden = { visible: false, pinnedHidden: false };
    assert.equal(chromeVisibility(hidden, { type: 'pointer', y: 47 }).visible, true);
    assert.equal(chromeVisibility(hidden, { type: 'pointer', y: 48 }).visible, false);
    assert.equal(chromeVisibility(hidden, { type: 'pointer', y: 300 }).visible, false);
});

test('a shown chrome stays shown while the pointer moves elsewhere', () => {
    assert.equal(chromeVisibility({ visible: true, pinnedHidden: false }, { type: 'pointer', y: 300 }).visible, true);
});

test('an open menu shows the chrome, and closing it leaves the chrome as it was', () => {
    assert.equal(chromeVisibility({ visible: false, pinnedHidden: false }, { type: 'menu', open: true }).visible, true);
    assert.equal(chromeVisibility({ visible: true, pinnedHidden: false }, { type: 'menu', open: false }).visible, true);
    assert.equal(chromeVisibility({ visible: false, pinnedHidden: false }, { type: 'menu', open: false }).visible, false);
});

test('Ctrl+\\ pins the chrome hidden, and pressing it again shows the chrome', () => {
    const pinned = chromeVisibility({ visible: true, pinnedHidden: false }, { type: 'toggle-pinned' });
    assert.deepEqual(pinned, { visible: false, pinnedHidden: true });
    assert.deepEqual(chromeVisibility(pinned, { type: 'toggle-pinned' }), { visible: true, pinnedHidden: false });
});

test('while pinned, the chrome never shows: not at the top edge, not on a click, not with a menu', () => {
    const pinned = { visible: false, pinnedHidden: true };
    assert.deepEqual(chromeVisibility(pinned, { type: 'pointer', y: 0 }), { visible: false, pinnedHidden: true });
    assert.deepEqual(chromeVisibility(pinned, { type: 'click', target: 'button', triggered: true }), { visible: false, pinnedHidden: true });
    assert.deepEqual(chromeVisibility(pinned, { type: 'menu', open: true }), { visible: false, pinnedHidden: true });
});

test('overflow warning: the content is not bigger than the frame on the axis, so scrolling would not move anything', () => {
    const frame = { width: 375, height: 667 };
    const buttons = [{ x: 24, y: 200, w: 327, h: 48 }, { x: 24, y: 264, w: 327, h: 48 }];
    assert.equal(overflowWarning(frame, 'horizontal', buttons), true);
    assert.equal(overflowWarning(frame, 'vertical', buttons), true);
    assert.equal(overflowWarning(frame, 'horizontal', []), true);
});

test('overflow warning: content that runs past the frame on the axis clears the warning', () => {
    const frame = { width: 375, height: 667 };
    assert.equal(overflowWarning(frame, 'horizontal', [{ x: 0, y: 0, w: 600, h: 40 }]), false);
    assert.equal(overflowWarning(frame, 'vertical', [{ x: 0, y: 900, w: 40, h: 40 }]), false);
    assert.equal(overflowWarning(frame, 'vertical', [{ x: 0, y: 900, w: 600, h: 40 }]), false);
});

test('the frames of a flow are the top-level frames of its page, in order', () => {
    const page = { nodes: [
        { id: 'A', type: 'frame', parentId: null },
        { id: 'a-child', type: 'frame', parentId: 'A' },
        { id: 'S', type: 'section', parentId: null, isSection: true },
        { id: 'B', type: 'frame', parentId: 'S' },
        { id: 'C', type: 'frame', parentId: null },
    ] };
    assert.deepEqual(flowFrames(page), ['A', 'B', 'C']);
});

test('prev and next move through the frames, and are disabled at the ends', () => {
    const frames = ['A', 'B', 'C'];
    assert.deepEqual(stepFrame(frames, 'A', 'prev'), { target: null, index: 0, total: 3, prevDisabled: true, nextDisabled: false });
    // The state describes the current frame; the target is where the control goes.
    assert.deepEqual(stepFrame(frames, 'A', 'next'), { target: 'B', index: 0, total: 3, prevDisabled: true, nextDisabled: false });
    assert.deepEqual(stepFrame(frames, 'C', 'next'), { target: null, index: 2, total: 3, prevDisabled: false, nextDisabled: true });
    assert.equal(stepFrame(frames, 'B', 'prev').target, 'A');
});

test('a frame that is not in the list counts as no position', () => {
    assert.deepEqual(stepFrame(['A', 'B'], 'Z', 'next'), { target: null, index: -1, total: 2, prevDisabled: true, nextDisabled: true });
});
