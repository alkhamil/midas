// Overlay placement: centred, or against the trigger below or above it, kept inside the stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlayPlacement, OVERLAY_GAP } from '../src/prototype/overlay-place.js';

const stage = { w: 400, h: 300 };
const overlay = { w: 100, h: 60 };
const anchor = { x: 50, y: 40, w: 80, h: 30 };

test('center puts the overlay in the middle of the stage', () => {
    assert.deepEqual(overlayPlacement({ placement: 'center', overlay, stage }), { x: 150, y: 120 });
});

test('below puts it under the trigger, left edges aligned, with the gap', () => {
    assert.deepEqual(overlayPlacement({ placement: 'below', overlay, stage, anchor }), { x: 50, y: 40 + 30 + OVERLAY_GAP });
});

test('above puts it over the trigger, with the gap', () => {
    const low = { x: 50, y: 200, w: 80, h: 30 };
    assert.deepEqual(overlayPlacement({ placement: 'above', overlay, stage, anchor: low }), { x: 50, y: 200 - 60 - OVERLAY_GAP });
});

test('an overlay that would leave the stage is kept inside it', () => {
    const low = { x: 0, y: 290, w: 80, h: 30 };
    assert.equal(overlayPlacement({ placement: 'below', overlay, stage, anchor: { ...anchor, x: 350, y: 280 } }).x, 300, 'right edge kept inside');
    assert.equal(overlayPlacement({ placement: 'below', overlay, stage, anchor: low }).y, 240, 'bottom edge kept inside');
    assert.equal(overlayPlacement({ placement: 'above', overlay, stage, anchor: { x: 0, y: 5, w: 10, h: 10 } }).y, 0, 'top edge kept inside');
});

test('an overlay larger than the stage sits at its top-left corner', () => {
    assert.deepEqual(overlayPlacement({ placement: 'center', overlay: { w: 500, h: 400 }, stage }), { x: 0, y: 0 });
});

test('a below or above placement with no trigger box falls back to the centre', () => {
    assert.deepEqual(overlayPlacement({ placement: 'below', overlay, stage, anchor: null }), { x: 150, y: 120 });
});
