import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addInteraction, editInteraction, removeInteraction, planNodeRemoval, planCopiedInteractions, assertCanOwnInteractions, withFlowStart, flowStartOf } from '../src/prototype/plan.js';

const link = (id, destinationId) => ({ id, trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } } });
const proto = interactions => ({ version: 1, interactions });

test('adding an interaction starts a versioned prototype and appends the interaction', () => {
    assert.deepEqual(addInteraction(undefined, link('a', 'B')), proto([link('a', 'B')]));
    assert.deepEqual(addInteraction(proto([link('a', 'B')]), link('b', 'C')), proto([link('a', 'B'), link('b', 'C')]));
});

test('adding an interaction with an id the node already has is refused', () => {
    assert.throws(() => addInteraction(proto([link('a', 'B')]), link('a', 'C')), /already has interaction "a"/);
});

test('editing an interaction replaces its trigger or action and keeps its id and place', () => {
    const edited = editInteraction(proto([link('a', 'B'), link('b', 'C')]), 'a', { trigger: { type: 'mouse-enter' } });
    assert.deepEqual(edited.interactions.map(i => i.id), ['a', 'b']);
    assert.deepEqual(edited.interactions[0].trigger, { type: 'mouse-enter' });
    assert.deepEqual(edited.interactions[0].action, link('a', 'B').action);
});

test('editing an unknown interaction is refused', () => {
    assert.throws(() => editInteraction(proto([link('a', 'B')]), 'zz', { trigger: { type: 'mouse-enter' } }), /no interaction "zz"/);
});

test('removing the last interaction leaves no prototype data at all', () => {
    assert.equal(removeInteraction(proto([link('a', 'B')]), 'a'), undefined);
    assert.deepEqual(removeInteraction(proto([link('a', 'B'), link('b', 'C')]), 'a'), proto([link('b', 'C')]));
});

test('a managed layer cannot own interactions', () => {
    assert.throws(() => assertCanOwnInteractions({ behavior: { version: 2, slot: 'iconStart' } }), /managed layer cannot own interactions/);
    assert.doesNotThrow(() => assertCanOwnInteractions({ behavior: { version: 2, templateId: 'button', variables: {} } }));
});

const nodes = [
    { id: 'A', name: 'A', type: 'frame', parentId: null, prototype: proto([link('to-b', 'B'), link('to-c', 'C')]) },
    { id: 'B', name: 'B', type: 'frame', parentId: null },
    { id: 'C', name: 'C', type: 'frame', parentId: null },
    { id: 'btn', name: 'Button', type: 'frame', parentId: 'A', prototype: proto([link('btn-to-b', 'B')]) },
];
const pages = [{ id: 'p', name: 'Screens', nodes, prototype: { version: 1, flows: [{ id: 'f', name: 'Main', startFrameId: 'B' }] } }];

test('deleting a destination removes the interactions that point at it, and reports each one', () => {
    const plan = planNodeRemoval(pages, new Set(['B']));
    assert.deepEqual(plan.edits, [
        { pageId: 'p', page: 'Screens', node: 'A', nodeId: 'A', interactions: [link('to-c', 'C')] },
        { pageId: 'p', page: 'Screens', node: 'Button', nodeId: 'btn', interactions: [] },
    ]);
    assert.deepEqual(plan.report.map(r => r.code), ['interaction-removed', 'interaction-removed', 'flow-start-removed']);
});

// Conditionals: a navigation to a deleted node leaves the conditional with the other branches; an emptied branch goes; a conditional with
// nothing left goes with its interaction.
const branch = (variableId, actions) => ({ condition: { variableId, operator: '==', value: true }, actions });
const cond = (branches, elseActions) => ({ type: 'conditional', branches, ...(elseActions ? { else: elseActions } : {}) });
const condInteraction = (id, action) => ({ id, trigger: { type: 'on-click' }, action });
const navTo = destinationId => ({ type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } });
const condNodes = [
    { id: 'A', name: 'A', type: 'frame', parentId: null, prototype: proto([condInteraction('c1', cond([branch('v', [navTo('B')]), branch('v', [navTo('C')])], [navTo('B'), { type: 'back' }]))]) },
    { id: 'Z', name: 'Z', type: 'frame', parentId: null, prototype: proto([condInteraction('c2', cond([branch('v', [navTo('B')])]))]) },
    { id: 'Y', name: 'Y', type: 'frame', parentId: null, prototype: proto([condInteraction('c3', cond([branch('v', [navTo('C')])], [navTo('B')]))]) },
    { id: 'B', name: 'B', type: 'frame', parentId: null },
    { id: 'C', name: 'C', type: 'frame', parentId: null },
];
const condPages = [{ id: 'p', name: 'Screens', nodes: condNodes }];

test('deleting a destination drops the nested navigations to it: an emptied branch goes, and the others stay', () => {
    const plan = planNodeRemoval(condPages, new Set(['B']));
    const a = plan.edits.find(e => e.nodeId === 'A').interactions;
    assert.deepEqual(a, [condInteraction('c1', cond([branch('v', [navTo('C')])], [{ type: 'back' }]))]);
});

test('a conditional with no branch and no else left goes with its interaction, and reports it', () => {
    const plan = planNodeRemoval(condPages, new Set(['B']));
    assert.deepEqual(plan.edits.find(e => e.nodeId === 'Z').interactions, []);
    assert.deepEqual(plan.report.filter(r => r.node === 'Z').map(r => r.code), ['interaction-removed']);
});

test('an else left empty goes, and the conditional stays with its branches', () => {
    const plan = planNodeRemoval(condPages, new Set(['B']));
    assert.deepEqual(plan.edits.find(e => e.nodeId === 'Y').interactions, [condInteraction('c3', cond([branch('v', [navTo('C')])]))]);
});

test('each nested navigation that is dropped is reported, with its destination', () => {
    const plan = planNodeRemoval(condPages, new Set(['B']));
    assert.deepEqual(plan.report.filter(r => r.node === 'A'), [
        { code: 'action-removed', page: 'Screens', node: 'A', interaction: 'c1', destination: 'B' },
        { code: 'action-removed', page: 'Screens', node: 'A', interaction: 'c1', destination: 'B' },
    ]);
});

test('deleting a node removes its own interactions with it: the node is not in the plan', () => {
    const plan = planNodeRemoval(pages, new Set(['A']));
    assert.equal(plan.edits.some(e => e.nodeId === 'A'), false);
    assert.deepEqual(plan.report.map(r => r.code), []);
});

test('a flow that starts at a deleted frame is reported, and its start is cleared', () => {
    const plan = planNodeRemoval(pages, new Set(['B']));
    assert.deepEqual(plan.flows, [{ pageId: 'p', page: 'Screens', flowId: 'f', flowName: 'Main' }]);
});

// Copies: the nodes copied together, their copy ids, and the nodes that exist in the document.
const copies = { A: 'A2', B: 'B2' };
const copyOf = new Map(Object.entries(copies));
const existing = new Set(['A', 'B', 'C', 'D', 'X']); // X is on another page

test('a copied link to a node copied with it points at the copy, with a new interaction id', () => {
    const { prototypes, report } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([link('a1', 'B')]) }], copyOf, exists: id => existing.has(id) });
    assert.deepEqual(prototypes.get('A'), proto([{ ...link('i1', 'B2') }]));
    assert.deepEqual(report, []);
});

test('a link to a node that was not copied keeps pointing at the original, including on another page', () => {
    const { prototypes } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([link('a1', 'X'), link('a2', 'C')]) }], copyOf, exists: id => existing.has(id) });
    assert.deepEqual(prototypes.get('A').interactions.map(i => i.action.destinationId), ['X', 'C']);
});

test('a link to a node that no longer exists is dropped and reported', () => {
    const { prototypes, report } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([link('a1', 'gone'), link('a2', 'C')]) }], copyOf, exists: id => existing.has(id) });
    assert.deepEqual(prototypes.get('A').interactions.map(i => i.action.destinationId), ['C']);
    assert.deepEqual(report, [{ code: 'interaction-dropped-on-copy', node: 'A', interaction: 'a1', destination: 'gone' }]);
});

test('the copy keeps the scroll behaviour, and a node left with nothing has no prototype', () => {
    const scrolls = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: { version: 1, interactions: [], overflow: 'vertical' } }], copyOf, exists: () => true });
    assert.deepEqual(scrolls.prototypes.get('A'), { version: 1, interactions: [], overflow: 'vertical' });
    const dropped = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([link('a1', 'gone')]) }], copyOf, exists: () => false });
    assert.equal(dropped.prototypes.get('A'), undefined);
});

test('an open-link needs no destination and is copied as it is', () => {
    const open = { id: 'o', trigger: { type: 'on-click' }, action: { type: 'open-link', url: 'https://example.com' } };
    const { prototypes } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([open]) }], copyOf, exists: () => false });
    assert.deepEqual(prototypes.get('A').interactions, [{ ...open, id: 'i1' }]);
});

test('a page has one flow start: setting it replaces the start, and clearing it leaves no prototype data', () => {
    const first = withFlowStart(undefined, 'A', 'Flow');
    assert.deepEqual(first, { version: 1, flows: [{ id: 'flow', name: 'Flow', startFrameId: 'A' }] });
    assert.deepEqual(withFlowStart(first, 'B', 'Flow'), { version: 1, flows: [{ id: 'flow', name: 'Flow', startFrameId: 'B' }] });
    assert.equal(withFlowStart(first, null, 'Flow'), undefined);
    const kept = { version: 1, flows: [{ id: 'flow-main', name: 'Main', startFrameId: 'A' }] };
    assert.deepEqual(withFlowStart(kept, 'B', 'Flow'), { version: 1, flows: [{ id: 'flow-main', name: 'Main', startFrameId: 'B' }] });
});

test('the flow start of a page is the start of its first flow, or null', () => {
    assert.equal(flowStartOf({ version: 1, flows: [{ id: 'f', name: 'Main', startFrameId: 'A' }] }), 'A');
    assert.equal(flowStartOf(undefined), null);
});

test('a copied conditional remaps the navigations in its branches and its else to the copies, and keeps the rest', () => {
    const action = cond([branch('v', [navTo('B')])], [navTo('X')]);
    const { prototypes, report } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([condInteraction('c1', action)]) }], copyOf, exists: id => existing.has(id) });
    assert.deepEqual(prototypes.get('A').interactions, [condInteraction('i1', cond([branch('v', [navTo('B2')])], [navTo('X')]))]);
    assert.deepEqual(report, []);
});

test('a nested navigation to a node that no longer exists is dropped with its branch, and reported', () => {
    const action = cond([branch('v', [navTo('gone')]), branch('v', [navTo('C')])]);
    const { prototypes, report } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([condInteraction('c1', action)]) }], copyOf, exists: id => existing.has(id) });
    assert.deepEqual(prototypes.get('A').interactions, [condInteraction('i1', cond([branch('v', [navTo('C')])]))]);
    assert.deepEqual(report, [{ code: 'interaction-dropped-on-copy', node: 'A', interaction: 'c1', destination: 'gone' }]);
});

test('a conditional whose every navigation is gone is left out of the copy', () => {
    const action = cond([branch('v', [navTo('gone')])]);
    const { prototypes, report } = planCopiedInteractions({ nodes: [{ id: 'A', name: 'A', prototype: proto([condInteraction('c1', action)]) }], copyOf, exists: id => existing.has(id) });
    assert.equal(prototypes.get('A'), undefined);
    assert.equal(report.length, 1);
});
