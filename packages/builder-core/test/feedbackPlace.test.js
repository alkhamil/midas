// Show feedback: its placement is the same list as Open dropdown; Preview stacks it by the edge that placement touches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { framedPlacePos, normalizeActions, PLACEMENTS } from '../src/index.js';

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

test('a framed placement sits inside its frame edge; the alignment runs along it; centre centres it', () => {
    const frame = { x: 100, y: 200, w: 400, h: 300 };
    assert.deepEqual(framedPlacePos(frame, 100, 40, 'top', undefined), { x: 250, y: 200 });
    assert.deepEqual(framedPlacePos(frame, 100, 40, 'top-end', undefined), { x: 400, y: 200 });
    assert.deepEqual(framedPlacePos(frame, 100, 40, 'bottom-start', undefined), { x: 100, y: 460 });
    assert.deepEqual(framedPlacePos(frame, 100, 40, 'center', undefined), { x: 250, y: 330 });
    assert.deepEqual(framedPlacePos(frame, 100, 40, 'top-end', { x: -16, y: 12 }), { x: 384, y: 212 });
});

test('a modal defaults to the centre, a drawer to the right edge', () => {
    assert.equal(normalizeActions([{ type: 'show-feedback', kind: 'modal' }])[0].position, 'center');
    assert.equal(normalizeActions([{ type: 'show-feedback', kind: 'drawer' }])[0].position, 'right');
});

test('Relative to: a framed action keeps the frame it sits against; an empty one is the frame of its layer', () => {
    const [f] = normalizeActions([{ type: 'show-feedback', kind: 'alert', anchorFrameId: 'frameA' }]);
    assert.equal(f.anchorFrameId, 'frameA');
    const [o] = normalizeActions([{ type: 'open-overlay', targetComponentId: 'dlg', anchorFrameId: 'frameB' }]);
    assert.equal(o.anchorFrameId, 'frameB');
    const [e] = normalizeActions([{ type: 'show-feedback', kind: 'alert' }]);
    assert.equal(e.anchorFrameId, undefined);
});
