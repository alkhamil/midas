// An interaction holds an ordered list of actions (decision 18 of docs/prototype-spec.md): they run top to bottom, a frame change ends the list,
// the validator needs at least one action, and the planners keep the list's other actions when one destination goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, respond } from '../src/prototype/player.js';
import { validatePrototype } from '../src/prototype/validate.js';
import { planNodeRemoval, planCopiedInteractions } from '../src/prototype/plan.js';
import { PROTOTYPE_VERSION } from '../src/prototype/data.js';

const instant = { type: 'instant', durationMs: 0 };
const navigate = destinationId => ({ type: 'navigate-to', destinationId, transition: instant });
const link = url => ({ type: 'open-link', url });
const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, ...extra });
const doc = (actions, extra = []) => ({ pages: [{ id: 'p', name: 'P', nodes: [
    frame('A', { prototype: { version: PROTOTYPE_VERSION, interactions: [{ id: 'i', trigger: { type: 'on-click' }, actions }] } }),
    frame('B'),
    frame('C'),
    ...extra,
] }] });
const ctxOf = d => {
    const nodes = d.pages.flatMap(p => p.nodes);
    const byId = new Map(nodes.map(n => [n.id, n]));
    return {
        interactionsOf: id => byId.get(id)?.prototype?.interactions ?? [],
        frameOf: id => (byId.get(id)?.parentId ? null : id),
        nodesOf: fid => nodes.filter(n => n.id === fid).map(n => ({ id: n.id, interactions: n.prototype?.interactions ?? [] })),
        valueOf: () => undefined,
    };
};
const click = { type: 'pointer', nodeId: 'A', trigger: 'on-click' };

test('the version is 2, and an interaction with an action list is valid', () => {
    assert.equal(PROTOTYPE_VERSION, 2);
    assert.deepEqual(validatePrototype(doc([link('https://example.com'), navigate('B')])), []);
});

test('an interaction with no actions, or with a missing list, is refused', () => {
    assert.deepEqual(validatePrototype(doc([])).map(p => p.code), ['interaction-actions']);
    const old = { pages: [{ id: 'p', name: 'P', nodes: [frame('A', { prototype: { version: PROTOTYPE_VERSION, interactions: [{ id: 'i', trigger: { type: 'on-click' }, action: navigate('B') }] } }), frame('B')] }] };
    assert.deepEqual(validatePrototype(old).map(p => p.code), ['node-prototype-shape']);
});

test('every action in the list is checked, and a hover trigger refuses a navigation anywhere in it', () => {
    assert.deepEqual(validatePrototype(doc([link('https://example.com'), navigate('Nope')])).map(p => p.code), ['destination-missing']);
    const hover = { pages: [{ id: 'p', name: 'P', nodes: [frame('A', { prototype: { version: PROTOTYPE_VERSION, interactions: [{ id: 'i', trigger: { type: 'while-hovering' }, actions: [link('https://example.com'), navigate('B')] }] } }), frame('B')] }] };
    assert.deepEqual(validatePrototype(hover).map(p => p.code), ['trigger-action-mismatch']);
});

test('the actions run top to bottom: an open-link, then a navigation', () => {
    const d = doc([link('https://example.com'), navigate('B')]);
    const { state, effects } = respond(createPlayer('A'), click, ctxOf(d));
    assert.deepEqual(effects.map(e => e.type), ['open-link', 'navigate']);
    assert.equal(state.current, 'B');
});

test('a frame change ends the list: the actions after a navigation do not run', () => {
    const d = doc([navigate('B'), link('https://example.com')]);
    const { effects } = respond(createPlayer('A'), click, ctxOf(d));
    assert.deepEqual(effects.map(e => e.type), ['navigate']);
});

test('a Set variable before a navigation is written before the frame changes', () => {
    const d = doc([{ type: 'set-variable', variableId: 'flag', value: true }, navigate('B')], []);
    d.variables = { collections: [], items: [{ id: 'flag', name: 'flag', type: 'boolean' }] };
    const { state } = respond(createPlayer('A'), click, ctxOf(d));
    assert.equal(state.current, 'B');
    assert.equal(state.variables.flag, true);
});

test('deleting a destination drops only the actions that name it, and keeps the interaction when one action is left', () => {
    const d = doc([link('https://example.com'), navigate('B'), navigate('C')]);
    const plan = planNodeRemoval(d.pages, new Set(['B']));
    const edit = plan.edits.find(e => e.nodeId === 'A');
    assert.deepEqual(edit.interactions[0].actions, [link('https://example.com'), navigate('C')]);
    assert.deepEqual(plan.report.map(r => r.code), ['action-removed']);
});

test('deleting the only destination of an interaction removes the interaction, and reports it', () => {
    const d = doc([navigate('B')]);
    const plan = planNodeRemoval(d.pages, new Set(['B']));
    assert.deepEqual(plan.edits.find(e => e.nodeId === 'A').interactions, []);
    assert.deepEqual(plan.report.map(r => r.code), ['interaction-removed']);
});

test('copying keeps the list in order, and remaps each navigation', () => {
    const d = doc([link('https://example.com'), navigate('B')]);
    const node = d.pages[0].nodes[0];
    const { prototypes, report } = planCopiedInteractions({ nodes: [node], copyOf: new Map([['B', 'B2']]), exists: id => id === 'B' });
    assert.deepEqual(prototypes.get('A').interactions[0].actions, [link('https://example.com'), navigate('B2')]);
    assert.deepEqual(report, []);
});
