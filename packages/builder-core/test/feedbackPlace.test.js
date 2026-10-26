// Show feedback on the canvas: at the frame edge (or centre) for its position, moved by the offset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackPlacePos, normalizeActions } from '../src/index.js';

const frame = { x: 100, y: 200, w: 400, h: 300 };

test('each position sits at its frame edge; the component is centred on the edges it does not touch', () => {
    assert.deepEqual(feedbackPlacePos(frame, 100, 40, 'top', undefined), { x: 250, y: 200 });
    assert.deepEqual(feedbackPlacePos(frame, 100, 40, 'top-right', undefined), { x: 400, y: 200 });
    assert.deepEqual(feedbackPlacePos(frame, 100, 40, 'bottom', undefined), { x: 250, y: 460 });
    assert.deepEqual(feedbackPlacePos(frame, 100, 40, 'center', undefined), { x: 250, y: 330 });
    assert.deepEqual(feedbackPlacePos(frame, 100, 300, 'right', undefined), { x: 400, y: 200 });
});

test('the offset moves the component from its position, in x and y', () => {
    assert.deepEqual(feedbackPlacePos(frame, 100, 40, 'top-right', { x: -16, y: 12 }), { x: 384, y: 212 });
});

test('an unknown position falls back to the centre', () => {
    assert.deepEqual(feedbackPlacePos(frame, 100, 40, 'nowhere', undefined), { x: 250, y: 330 });
});

test('a Show feedback action keeps its offset and the canvas copy it placed', () => {
    const [a] = normalizeActions([{ type: 'show-feedback', kind: 'alert', position: 'top-right', offset: { x: 8, y: 0 }, overlayInstanceId: 'ov1' }]);
    assert.deepEqual(a.offset, { x: 8, y: 0 });
    assert.equal(a.overlayInstanceId, 'ov1');
    const [b] = normalizeActions([{ type: 'show-feedback', kind: 'alert', offset: { x: 0, y: 0 } }]);
    assert.equal(b.offset, undefined, 'a zero offset is not kept');
});
