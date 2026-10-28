import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, respond } from '../src/prototype/player.js';

const instant = { type: 'instant', durationMs: 0 };
const nav = (id, destinationId, trigger = { type: 'on-click' }, transition = instant) => ({ id, trigger, action: { type: 'navigate-to', destinationId, transition } });
const back = (id, trigger = { type: 'on-click' }) => ({ id, trigger, action: { type: 'back' } });
const link = (id, url, trigger = { type: 'on-click' }) => ({ id, trigger, action: { type: 'open-link', url } });

// Frame A holds a button (btnA) that navigates to B on click, and a label with a hover; frame B holds btnB that goes to C after a delay.
const nodes = {
    A: { frame: 'A', interactions: [] },
    btnA: { frame: 'A', interactions: [nav('go-b', 'B'), { id: 'hover', trigger: { type: 'mouse-enter' }, action: { type: 'open-link', url: 'https://example.com' } }] },
    B: { frame: 'B', interactions: [] },
    btnB: { frame: 'B', interactions: [nav('go-c', 'C', { type: 'after-delay', delayMs: 800 }), back('back-b')] },
    C: { frame: 'C', interactions: [] },
};
const ctx = {
    interactionsOf: id => nodes[id]?.interactions ?? [],
    frameOf: id => nodes[id]?.frame ?? null,
    nodesOf: frameId => Object.entries(nodes).filter(([, n]) => n.frame === frameId).map(([id, n]) => ({ id, interactions: n.interactions })),
};

test('a fresh player is on its start frame with no history', () => {
    assert.deepEqual(createPlayer('A'), { current: 'A', history: [] });
});

test('an on-click navigate-to moves to the destination, pushes the previous frame, and reports the transition', () => {
    const { state, effects } = respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'on-click' }, ctx);
    assert.deepEqual(state, { current: 'B', history: ['A'] });
    assert.deepEqual(effects.filter(e => e.type === 'navigate'), [{ type: 'navigate', from: 'A', to: 'B', transition: instant }]);
});

test('back returns to the previous frame and pops the history', () => {
    const start = { current: 'B', history: ['A'] };
    const { state, effects } = respond(start, { type: 'pointer', nodeId: 'btnB', trigger: 'on-click' }, ctx);
    assert.deepEqual(state, { current: 'A', history: [] });
    assert.deepEqual(effects, [{ type: 'navigate', from: 'B', to: 'A', transition: { type: 'instant', durationMs: 0 } }]);
});

test('a back with an empty history does nothing', () => {
    const { state, effects } = respond({ current: 'A', history: [] }, { type: 'back' }, ctx);
    assert.deepEqual(state, { current: 'A', history: [] });
    assert.deepEqual(effects, []);
});

test('a back interaction behaves like the back command', () => {
    const { state } = respond({ current: 'B', history: ['A'] }, { type: 'pointer', nodeId: 'btnB', trigger: 'on-click' }, { ...ctx, interactionsOf: id => (id === 'btnB' ? [back('back-b')] : []) });
    assert.deepEqual(state, { current: 'A', history: [] });
});

test('restart goes back to the start frame and clears the history', () => {
    const { state, effects } = respond({ current: 'C', history: ['A', 'B'] }, { type: 'restart', startFrameId: 'A' }, ctx);
    assert.deepEqual(state, { current: 'A', history: [] });
    assert.deepEqual(effects, [{ type: 'navigate', from: 'C', to: 'A', transition: { type: 'instant', durationMs: 0 } }]);
});

test('a pointer event only runs the interactions with that trigger', () => {
    const { state, effects } = respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'mouse-enter' }, ctx);
    assert.deepEqual(state, { current: 'A', history: [] });
    assert.deepEqual(effects, [{ type: 'open-link', url: 'https://example.com' }]);
});

test('an unknown pointer trigger or a node with no interactions does nothing', () => {
    assert.deepEqual(respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'mouse-down' }, ctx).effects, []);
    assert.deepEqual(respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, ctx).effects, []);
});

test('after-delay is reported as a schedule when the frame is entered, not run', () => {
    const { state, effects } = respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'on-click' }, ctx);
    assert.equal(state.current, 'B');
    assert.deepEqual(effects.filter(e => e.type === 'schedule'), [{ type: 'schedule', nodeId: 'btnB', interactionId: 'go-c', delayMs: 800 }]);
});

test('a timer fires the after-delay interaction on the frame it belongs to', () => {
    const start = { current: 'B', history: ['A'] };
    const { state, effects } = respond(start, { type: 'timer', nodeId: 'btnB', interactionId: 'go-c' }, ctx);
    assert.deepEqual(state, { current: 'C', history: ['A', 'B'] });
    assert.deepEqual(effects[0], { type: 'navigate', from: 'B', to: 'C', transition: instant });
});

test('a timer that belongs to a frame the player has left is ignored', () => {
    const { state, effects } = respond({ current: 'A', history: [] }, { type: 'timer', nodeId: 'btnB', interactionId: 'go-c' }, ctx);
    assert.deepEqual(state, { current: 'A', history: [] });
    assert.deepEqual(effects, []);
});

test('a transition with its direction and easing is passed through unchanged', () => {
    const slide = { type: 'slide-in', direction: 'left', durationMs: 300, easing: 'ease-out' };
    const c2 = { ...ctx, interactionsOf: id => (id === 'btnA' ? [nav('go-b', 'B', { type: 'on-click' }, slide)] : []) };
    assert.deepEqual(respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'on-click' }, c2).effects.filter(e => e.type === 'navigate'), [{ type: 'navigate', from: 'A', to: 'B', transition: slide }]);
});

test('while-hovering runs its action on mouse-enter', () => {
    const hover = { id: 'h', trigger: { type: 'while-hovering' }, action: { type: 'open-link', url: 'https://example.com' } };
    const c2 = { ...ctx, interactionsOf: id => (id === 'btnA' ? [hover] : []) };
    assert.deepEqual(respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'mouse-enter' }, c2).effects, [{ type: 'open-link', url: 'https://example.com' }]);
});

test('while-pressing runs its action on mouse-down', () => {
    const press = { id: 'p', trigger: { type: 'while-pressing' }, action: { type: 'open-link', url: 'https://example.com' } };
    const c2 = { ...ctx, interactionsOf: id => (id === 'btnA' ? [press] : []) };
    assert.deepEqual(respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'mouse-down' }, c2).effects, [{ type: 'open-link', url: 'https://example.com' }]);
});

test('the player never mutates the state it is given', () => {
    const start = { current: 'A', history: [] };
    respond(start, { type: 'pointer', nodeId: 'btnA', trigger: 'on-click' }, ctx);
    assert.deepEqual(start, { current: 'A', history: [] });
});

test('a navigate event moves to a frame through the history, like a navigate-to, and back returns', () => {
    const moved = respond({ current: 'A', history: [] }, { type: 'navigate', frameId: 'B' }, ctx);
    assert.deepEqual(moved.state, { current: 'B', history: ['A'] });
    assert.equal(moved.effects.find(e => e.type === 'navigate').to, 'B');
    assert.deepEqual(respond(moved.state, { type: 'back' }, ctx).state, { current: 'A', history: [] });
});

test('a navigate event to the frame the player is already on does nothing', () => {
    const same = respond({ current: 'A', history: [] }, { type: 'navigate', frameId: 'A' }, ctx);
    assert.deepEqual(same, { state: { current: 'A', history: [] }, effects: [] });
});

test('a mouse-leave interaction runs when the pointer leaves its node', () => {
    const leave = { id: 'out', trigger: { type: 'mouse-leave' }, action: { type: 'open-link', url: 'https://example.com' } };
    const c2 = { ...ctx, interactionsOf: id => (id === 'btnA' ? [leave] : []) };
    assert.deepEqual(respond(createPlayer('A'), { type: 'pointer', nodeId: 'btnA', trigger: 'mouse-leave' }, c2).effects, [{ type: 'open-link', url: 'https://example.com' }]);
});
