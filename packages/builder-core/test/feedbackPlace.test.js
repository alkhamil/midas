// Show feedback: its placement is the same list as Open dropdown; Preview stacks it by the edge that placement touches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackRegion, normalizeActions, PLACEMENTS, placeOverlayPos } from '../src/index.js';

test('the Position list is the same twelve placements an Open dropdown offers', () => {
    assert.equal(PLACEMENTS.length, 12);
    assert.ok(PLACEMENTS.includes('top') && PLACEMENTS.includes('bottom-end') && PLACEMENTS.includes('left-start'));
});

test('a placement is kept; an old feedback position maps onto a placement', () => {
    assert.equal(normalizeActions([{ type: 'show-feedback', kind: 'alert', position: 'bottom-start' }])[0].position, 'bottom-start');
    assert.equal(normalizeActions([{ type: 'show-feedback', kind: 'alert', position: 'top-right' }])[0].position, 'top-end');
    assert.equal(normalizeActions([{ type: 'show-feedback', kind: 'alert' }])[0].position, 'top-end', 'default for an alert');
    assert.equal(normalizeActions([{ type: 'show-feedback', kind: 'drawer' }])[0].position, 'right', 'default for a drawer');
});

test('the canvas copy uses the same placement as an Open dropdown, against the frame', () => {
    const frame = { x: 100, y: 200, w: 400, h: 300 };
    assert.deepEqual(placeOverlayPos(frame, 100, 40, 'top-end', { x: -16, y: 12 }), { x: 384, y: 172 });
});

test('Preview stacks a feedback by the edge its placement touches; drawers and modals keep their own place', () => {
    assert.equal(feedbackRegion('alert', 'bottom-start'), 'bottom');
    assert.equal(feedbackRegion('alert', 'top-start'), 'top');
    assert.equal(feedbackRegion('alert', 'right'), 'top-right');
    assert.equal(feedbackRegion('drawer', 'bottom'), 'right');
    assert.equal(feedbackRegion('modal', 'top'), 'center');
});
