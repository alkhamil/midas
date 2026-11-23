// Overlays (decisions 15 and 16 of docs/prototype-spec.md): open-overlay shows a top-level frame on top of the current one, close-overlay closes
// the topmost. Overlays are not history steps; navigation clears them; a click outside closes the topmost one that allows it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrototype } from '../src/prototype/validate.js';
import { createPlayer, respond } from '../src/prototype/player.js';
import { rewriteAction, planNodeRemoval } from '../src/prototype/plan.js';
import { PLAIN_ACTION_TYPES, ACTION_TYPES } from '../src/prototype/data.js';

const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, ...extra });
const layer = (id, parentId, extra = {}) => ({ id, name: id, type: 'rectangle', parentId, ...extra });
const proto = interactions => ({ version: 2, interactions });
const doc = pages => ({ pages });
const codesOf = d => validatePrototype(d).map(p => p.code);
const overlay = (destinationId, extra = {}) => ({ type: 'open-overlay', destinationId, placement: 'center', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 }, ...extra });
const navigate = destinationId => ({ type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } });

// A base frame A holds a button b (navigates to B) and an on-click that opens the overlay O; O is a top-level frame; B is another frame.
const base = () => doc([{ id: 'p', name: 'P', nodes: [
    frame('A', { prototype: proto([
        { id: 'i-open', trigger: { type: 'on-click' }, actions: [overlay('O')] },
        { id: 'i-hover', trigger: { type: 'while-hovering' }, actions: [overlay('O')] },
    ]) }),
    layer('b', 'A', { prototype: proto([{ id: 'i-b', trigger: { type: 'on-click' }, actions: [navigate('B')] }]) }),
    frame('B'),
    frame('O'),
] }]);

/** The player context over a document: the interactions of a layer, its top-level frame, the layers of a frame, and a variable's value. */
const ctx = (d, valueOf = () => undefined) => {
    const nodes = d.pages.flatMap(p => p.nodes);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const top = id => { let n = byId.get(id); while (n?.parentId) n = byId.get(n.parentId); return n?.id ?? null; };
    return {
        interactionsOf: id => byId.get(id)?.prototype?.interactions ?? [],
        frameOf: id => top(id),
        nodesOf: fid => nodes.filter(n => top(n.id) === fid).map(n => ({ id: n.id, interactions: n.prototype?.interactions ?? [] })),
        valueOf,
    };
};

test('open-overlay and close-overlay are plain actions, so a conditional may hold them', () => {
    assert.ok(PLAIN_ACTION_TYPES.includes('open-overlay'));
    assert.ok(PLAIN_ACTION_TYPES.includes('close-overlay'));
    assert.ok(ACTION_TYPES.includes('open-overlay'));
});

test('a valid open-overlay to a top-level frame, and a close-overlay, are valid', () => {
    const d = base();
    d.pages[0].nodes[0].prototype.interactions.push({ id: 'i-close', trigger: { type: 'on-click' }, actions: [{ type: 'close-overlay' }] });
    d.pages[0].nodes[0].prototype.interactions = d.pages[0].nodes[0].prototype.interactions.filter(i => i.id !== 'i-hover');
    assert.deepEqual(validatePrototype(d), []);
});

test('the overlay destination must be a top-level frame, and it must exist', () => {
    const missing = base();
    missing.pages[0].nodes[0].prototype.interactions[1].actions[0] = overlay('nope');
    missing.pages[0].nodes[0].prototype.interactions[1].trigger = { type: 'on-click' };
    assert.deepEqual(codesOf(missing), ['destination-missing']);
    const notFrame = base();
    notFrame.pages[0].nodes[0].prototype.interactions[1].actions[0] = overlay('b');
    notFrame.pages[0].nodes[0].prototype.interactions[1].trigger = { type: 'on-click' };
    assert.deepEqual(codesOf(notFrame), ['destination-not-frame']);
});

test('placement is center, below or above; closeOnOutside is a boolean; the transition is instant or dissolve', () => {
    for (const [action, code] of [
        [overlay('O', { placement: 'left' }), 'overlay-placement'],
        [overlay('O', { closeOnOutside: 'yes' }), 'overlay-close-outside'],
        [overlay('O', { transition: { type: 'slide-in', direction: 'left', durationMs: 200 } }), 'overlay-transition'],
    ]) {
        const d = base();
        d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [action] }];
        assert.deepEqual(codesOf(d), [code]);
    }
    for (const placement of ['center', 'below', 'above']) {
        const d = base();
        d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [overlay('O', { placement })] }];
        assert.deepEqual(codesOf(d), [], placement);
    }
});

test('an overlay cannot run on while-hovering, as a navigation cannot', () => {
    assert.deepEqual(codesOf(base()), ['trigger-action-mismatch']);
});

test('the open-overlay fields are the ones listed: an extra field is refused', () => {
    const d = base();
    d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [overlay('O', { zIndex: 3 })] }];
    assert.deepEqual(codesOf(d), ['action-shape']);
});

test('open-overlay puts the frame on top with its anchor; the frame underneath stays current; the effect says so', () => {
    const c = ctx(base());
    const { state, effects } = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c);
    assert.deepEqual(state.overlays, [{ frameId: 'O', anchorId: 'A', placement: 'center', closeOnOutside: true }]);
    assert.equal(state.current, 'A');
    assert.deepEqual(state.history, [], 'an overlay is not a history step');
    assert.deepEqual(effects, [{ type: 'open-overlay', frameId: 'O', anchorId: 'A', placement: 'center', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 } }]);
});

test('opening a frame that is already open changes nothing (an overlay that stays open on outside clicks)', () => {
    const d = base();
    d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [overlay('O', { closeOnOutside: false })] }];
    const c = ctx(d);
    const once = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c).state;
    const twice = respond(once, { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c);
    assert.equal(twice.state.overlays.length, 1);
    assert.deepEqual(twice.effects, []);
});

test('back closes the topmost overlay before it goes back a frame', () => {
    const c = ctx(base());
    const open = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c).state;
    const back = respond(open, { type: 'back' }, c);
    assert.deepEqual(back.state.overlays, []);
    assert.equal(back.state.current, 'A');
    assert.deepEqual(back.effects, [{ type: 'close-overlay', frameId: 'O' }]);
});

test('a navigation clears the overlays and is a history step; restart clears them too', () => {
    const c = ctx(base());
    const open = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c).state;
    const nav = respond(open, { type: 'pointer', nodeId: 'b', trigger: 'on-click' }, c);
    assert.deepEqual(nav.state.overlays, []);
    assert.equal(nav.state.current, 'B');
    assert.deepEqual(nav.state.history, ['A']);
    assert.deepEqual(respond(open, { type: 'restart', startFrameId: 'A' }, c).state.overlays, []);
});

test('a click outside a closeOnOutside overlay closes it; a click inside it does not', () => {
    const d = base();
    d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [overlay('O')] }];
    d.pages[0].nodes.push(layer('o1', 'O'), layer('x', 'A'));
    const c = ctx(d);
    const open = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c).state;
    const inside = respond(open, { type: 'pointer', nodeId: 'o1', trigger: 'on-click' }, c);
    assert.equal(inside.state.overlays.length, 1, 'a click inside the overlay keeps it open');
    // x sits in the base frame and has no interaction, so the click only closes the overlay (the anchor's own open would reopen it).
    const outside = respond(open, { type: 'pointer', nodeId: 'x', trigger: 'on-click' }, c);
    assert.deepEqual(outside.state.overlays, [], 'a click outside closes it');
    assert.deepEqual(outside.effects.filter(e => e.type === 'close-overlay'), [{ type: 'close-overlay', frameId: 'O' }]);
});

test('an overlay with closeOnOutside off stays open when the click lands outside it', () => {
    const d = base();
    d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [overlay('O', { closeOnOutside: false })] }];
    d.pages[0].nodes.push(layer('x', 'A'));
    const c = ctx(d);
    const open = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, c).state;
    const outside = respond(open, { type: 'pointer', nodeId: 'x', trigger: 'on-click' }, c);
    assert.equal(outside.state.overlays.length, 1);
});

test('a conditional may open an overlay', () => {
    const d = base();
    d.variables = { collections: [], items: [{ id: 'v', name: 'flag', type: 'boolean' }] };
    d.pages[0].nodes[0].prototype.interactions = [{ id: 'i-open', trigger: { type: 'on-click' }, actions: [{ type: 'conditional', branches: [{ condition: { variableId: 'v', operator: '==', value: true }, actions: [overlay('O')] }], else: [navigate('B')] }] }];
    const { state } = respond(createPlayer('A'), { type: 'pointer', nodeId: 'A', trigger: 'on-click' }, ctx(d, () => true));
    assert.deepEqual(state.overlays.map(o => o.frameId), ['O']);
});

test('rewriteAction remaps the overlay destination, and drops it when the frame is removed', () => {
    const dropped = [];
    const remapped = rewriteAction(overlay('O'), id => (id === 'O' ? 'O2' : id), dropped);
    assert.equal(remapped.destinationId, 'O2');
    assert.deepEqual(dropped, []);
    const gone = [];
    assert.equal(rewriteAction(overlay('O'), () => null, gone), undefined);
    assert.deepEqual(gone, ['O']);
});

test('deleting the overlay frame removes the open-overlay interaction that opens it, and reports it', () => {
    const d = base();
    const plan = planNodeRemoval(d.pages, new Set(['O']));
    const edit = plan.edits.find(e => e.nodeId === 'A');
    assert.ok(edit, 'the base frame is changed');
    assert.ok(!edit.interactions.some(i => i.id === 'i-open'), 'the interaction to the deleted frame is gone');
});
