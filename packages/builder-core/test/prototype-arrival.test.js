// The after-delay interactions of a frame start when the player arrives on it, the start of Play included, and a top-level frame's own
// timer runs while it is the current frame (frameOf is null for a top-level frame).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalEffects, createPlayer, respond } from '../src/prototype/player.js';

const delayed = { id: 'i1', trigger: { type: 'after-delay', delayMs: 500 }, actions: [{ type: 'navigate-to', destinationId: 'f2', transition: { type: 'instant' } }] };
const nodes = { f1: { id: 'f1', interactions: [delayed] }, f2: { id: 'f2', interactions: [] } };
const ctx = {
    interactionsOf: id => nodes[id]?.interactions ?? [],
    frameOf: () => null,
    nodesOf: () => [],
    valueOf: () => undefined,
};

test('arriving on a frame schedules its after-delay interactions, the start frame included', () => {
    assert.deepEqual(arrivalEffects('f1', ctx), [{ type: 'schedule', nodeId: 'f1', interactionId: 'i1', delayMs: 500 }]);
    assert.deepEqual(arrivalEffects('f2', ctx), []);
});

test("a top-level frame's after-delay timer runs while that frame is current", () => {
    const state = createPlayer('f1');
    const { state: next, effects } = respond(state, { type: 'timer', nodeId: 'f1', interactionId: 'i1' }, ctx);
    assert.equal(next.current, 'f2', 'the timer navigates to the destination');
    assert.ok(effects.some(e => e.type === 'navigate' && e.to === 'f2'));
});

test('a timer does nothing once the player has left the frame it was started on', () => {
    const state = { ...createPlayer('f2') };
    assert.deepEqual(respond(state, { type: 'timer', nodeId: 'f1', interactionId: 'i1' }, ctx).effects, []);
});
