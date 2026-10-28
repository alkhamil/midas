import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addInteraction, editInteraction, removeInteraction, planNodeRemoval, assertCanOwnInteractions } from '../src/prototype/plan.js';

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
        { pageId: 'p', page: 'Screens', node: 'A', nodeId: 'A', removeInteractions: ['to-b'] },
        { pageId: 'p', page: 'Screens', node: 'Button', nodeId: 'btn', removeInteractions: ['btn-to-b'] },
    ]);
    assert.deepEqual(plan.report.map(r => r.code), ['interaction-removed', 'interaction-removed', 'flow-start-removed']);
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
