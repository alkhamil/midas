import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playContext, destinationOptions, destinationLabel, nextInteractionId, defaultNavigate, playStartOf, interactionPatch, transitionFieldsOf } from '../src/prototype/play.js';
import { buildPrototypeFixture } from '../../../scripts/make-prototype-fixture.js';

test('the player context reads interactions, frames and nodes from the document, without changing it', () => {
    const doc = buildPrototypeFixture();
    const before = JSON.stringify(doc);
    const ctx = playContext(doc.pages);
    assert.deepEqual(ctx.interactionsOf('home-next').map(i => i.id), ['home-next-go']);
    assert.equal(ctx.frameOf('home-next'), 'frame-home');
    assert.equal(ctx.frameOf('frame-home'), null);
    assert.ok(ctx.nodesOf('frame-home').some(n => n.id === 'home-next'));
    assert.equal(JSON.stringify(doc), before);
});

test('destinations are the top-level frames on any page, with their page name', () => {
    const options = destinationOptions(buildPrototypeFixture().pages);
    assert.ok(options.some(o => o.id === 'frame-home' && o.page === 'Flow' && o.name === 'Home'));
    assert.ok(options.some(o => o.id === 'main' && o.page === 'Components'), 'a top-level master on another page is a destination too');
    assert.ok(options.some(o => o.id === 'inst-start'), 'a top-level instance is a frame, so it is a destination too');
});

test('a new interaction id is not one the node already has', () => {
    const id = nextInteractionId(['i1', 'i2']);
    assert.equal(['i1', 'i2'].includes(id), false);
    assert.match(id, /^i[a-z0-9]+$/);
});

test('the default interaction is an on-click navigate-to with an instant transition', () => {
    assert.deepEqual(defaultNavigate('i9', 'frame-home'), { id: 'i9', trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId: 'frame-home', transition: { type: 'instant', durationMs: 0 } } });
});

test('Play starts at the flow of the active page, else the selected top-level frame, else the first top-level frame', () => {
    const doc = buildPrototypeFixture();
    assert.equal(playStartOf(doc.pages, 'page-flow', null), 'frame-home');
    assert.equal(playStartOf(doc.pages, 'page-flow', 'frame-done'), 'frame-home');
    const plain = [{ id: 'p', name: 'P', nodes: [{ id: 'A', type: 'frame', parentId: null }, { id: 'B', type: 'frame', parentId: null }] }];
    assert.equal(playStartOf(plain, 'p', 'B'), 'B');
    assert.equal(playStartOf(plain, 'p', null), 'A');
    assert.equal(playStartOf([{ id: 'e', name: 'E', nodes: [] }], 'e', null), null);
});

test('a trigger edit sets the trigger, and after-delay starts with a delay of 500 ms that other triggers drop', () => {
    const i = { id: 'x', trigger: { type: 'on-click' }, action: { type: 'back' } };
    assert.deepEqual(interactionPatch(i, 'trigger', 'after-delay', {}), { trigger: { type: 'after-delay', delayMs: 500 } });
    assert.deepEqual(interactionPatch(i, 'trigger', 'mouse-enter', {}), { trigger: { type: 'mouse-enter' } });
    assert.deepEqual(interactionPatch(i, 'delay', '800', {}), { trigger: { type: 'after-delay', delayMs: 800 } });
});

test('an action edit starts navigate-to on the first destination, and open-link on an https address', () => {
    const i = { id: 'x', trigger: { type: 'on-click' }, action: { type: 'back' } };
    assert.deepEqual(interactionPatch(i, 'action', 'navigate-to', { firstDestination: 'frame-b' }).action, { type: 'navigate-to', destinationId: 'frame-b', transition: { type: 'instant', durationMs: 0 } });
    assert.throws(() => interactionPatch(i, 'action', 'navigate-to', {}), /no top-level frame/);
    assert.deepEqual(interactionPatch(i, 'action', 'open-link', {}).action, { type: 'open-link', url: 'https://example.com' });
    assert.throws(() => interactionPatch(i, 'action', 'overlay', {}), /not available yet/);
});

test('a destination or transition edit keeps the rest of the action', () => {
    const i = { id: 'x', trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId: 'frame-b', transition: { type: 'dissolve', durationMs: 200, easing: 'linear' } } };
    assert.deepEqual(interactionPatch(i, 'destination', 'frame-c', {}).action, { ...i.action, destinationId: 'frame-c' });
    assert.deepEqual(interactionPatch(i, 'transition', 'slide-in', {}).action.transition, { type: 'slide-in', durationMs: 200, easing: 'linear', direction: 'left' });
    assert.deepEqual(interactionPatch(i, 'transition', 'instant', {}).action.transition, { type: 'instant', durationMs: 0 });
    assert.deepEqual(interactionPatch(i, 'duration', '350', {}).action.transition, { type: 'dissolve', durationMs: 350, easing: 'linear' });
    assert.deepEqual(interactionPatch(i, 'easing', 'ease-in', {}).action.transition, { type: 'dissolve', durationMs: 200, easing: 'ease-in' });
});

test('the transition fields that apply to a transition type', () => {
    assert.deepEqual(transitionFieldsOf('instant'), { direction: false, duration: false, easing: false });
    assert.deepEqual(transitionFieldsOf('dissolve'), { direction: false, duration: true, easing: true });
    assert.deepEqual(transitionFieldsOf('push'), { direction: true, duration: true, easing: true });
});

test('a nested layer belongs to its top-level frame: its after-delay schedules and its timer is accepted', () => {
    const pages = [{ id: 'p', name: 'P', nodes: [
        { id: 'F', type: 'frame', parentId: null },
        { id: 'G', type: 'group', parentId: 'F' },
        { id: 'deep', type: 'frame', parentId: 'G', prototype: { version: 1, interactions: [{ id: 'd', trigger: { type: 'after-delay', delayMs: 100 }, action: { type: 'back' } }] } },
    ] }];
    const ctx = playContext(pages);
    assert.equal(ctx.frameOf('deep'), 'F');
    assert.deepEqual(ctx.nodesOf('F').map(n => n.id), ['G', 'deep']);
});

test('a while-hovering or while-pressing trigger cannot be given a navigation, and a navigation cannot be given one of these triggers', () => {
    const nav = { id: 'x', trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId: 'B', transition: { type: 'instant', durationMs: 0 } } };
    assert.throws(() => interactionPatch(nav, 'trigger', 'while-hovering', {}), /cannot navigate/);
    const hover = { id: 'h', trigger: { type: 'while-pressing' }, action: { type: 'open-link', url: 'https://example.com' } };
    assert.throws(() => interactionPatch(hover, 'action', 'navigate-to', { firstDestination: 'B' }), /cannot navigate/);
    assert.deepEqual(interactionPatch(hover, 'trigger', 'while-hovering', {}), { trigger: { type: 'while-hovering' } });
});

test('a delay or a duration that is not a whole number of zero or more is refused, not written', () => {
    const i = { id: 'x', trigger: { type: 'after-delay', delayMs: 500 }, action: { type: 'back' } };
    assert.throws(() => interactionPatch(i, 'delay', 'soon', {}), /whole number/);
    assert.throws(() => interactionPatch(i, 'delay', '-5', {}), /whole number/);
    const n = { id: 'n', trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId: 'B', transition: { type: 'dissolve', durationMs: 200, easing: 'linear' } } };
    assert.throws(() => interactionPatch(n, 'duration', '', {}), /whole number/);
});

test('a destination on another page is named with its page, one on this page by its name alone', () => {
    assert.equal(destinationLabel({ id: 'c', name: 'Checkout', page: 'Cart' }, 'Flow'), 'Cart / Checkout');
    assert.equal(destinationLabel({ id: 'h', name: 'Home', page: 'Flow' }, 'Flow'), 'Home');
});
