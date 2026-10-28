import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionHolds, chooseBranch } from '../src/prototype/conditional.js';
import { createPlayer, respond } from '../src/prototype/player.js';
import { playContext } from '../src/prototype/play.js';

const instant = { type: 'instant', durationMs: 0 };
const navTo = destinationId => ({ type: 'navigate-to', destinationId, transition: instant });
const branch = (variableId, operator, value, actions) => ({ condition: { variableId, operator, value }, actions });
const cond = (branches, elseActions) => ({ type: 'conditional', branches, ...(elseActions ? { else: elseActions } : {}) });
const onClick = (id, action) => ({ id, trigger: { type: 'on-click' }, action });

test('a boolean condition holds for == and != only', () => {
    assert.equal(conditionHolds({ operator: '==', value: true }, true), true);
    assert.equal(conditionHolds({ operator: '==', value: true }, false), false);
    assert.equal(conditionHolds({ operator: '!=', value: true }, false), true);
});

test('a number condition holds for each operator', () => {
    const holds = (operator, value, literal) => conditionHolds({ operator, value: literal }, value);
    assert.equal(holds('==', 3, 3), true);
    assert.equal(holds('!=', 3, 3), false);
    assert.equal(holds('>', 4, 3), true);
    assert.equal(holds('>', 3, 3), false);
    assert.equal(holds('<', 2, 3), true);
    assert.equal(holds('<', 3, 3), false);
    assert.equal(holds('>=', 3, 3), true);
    assert.equal(holds('<=', 3, 3), true);
    assert.equal(holds('<=', 4, 3), false);
});

test('a string condition compares the text exactly', () => {
    assert.equal(conditionHolds({ operator: '==', value: 'on' }, 'on'), true);
    assert.equal(conditionHolds({ operator: '==', value: 'on' }, 'ON'), false);
    assert.equal(conditionHolds({ operator: '!=', value: 'on' }, 'off'), true);
});

test('a variable with no value in the mode does not hold its condition', () => {
    assert.equal(conditionHolds({ operator: '!=', value: true }, undefined), false);
});

test('the first branch whose condition holds is chosen, in order; the else runs when none holds', () => {
    const values = { flag: true, count: 5 };
    const valueOf = id => values[id];
    const c = cond([branch('count', '>', 9, [navTo('X')]), branch('flag', '==', true, [navTo('A')]), branch('count', '==', 5, [navTo('B')])], [navTo('C')]);
    assert.deepEqual(chooseBranch(c, valueOf), [navTo('A')]);
    assert.deepEqual(chooseBranch(cond([branch('flag', '==', false, [navTo('A')])], [navTo('C')]), valueOf), [navTo('C')]);
    assert.deepEqual(chooseBranch(cond([branch('flag', '==', false, [navTo('A')])]), valueOf), []);
});

// A player on frame A with one button, whose on-click is a conditional. The variable values are the player's input.
const nodes = {
    btn: { frame: 'A', interactions: [] },
    A: { frame: 'A', interactions: [] },
    B: { frame: 'B', interactions: [] },
    C: { frame: 'C', interactions: [] },
};
const withValues = values => ({
    interactionsOf: id => nodes[id]?.interactions ?? [],
    frameOf: id => nodes[id]?.frame ?? null,
    nodesOf: frameId => Object.entries(nodes).filter(([, n]) => n.frame === frameId).map(([id, n]) => ({ id, interactions: n.interactions })),
    valueOf: (nodeId, variableId) => values[variableId],
});
const pointer = { type: 'pointer', nodeId: 'btn', trigger: 'on-click' };
const setButton = interaction => { nodes.btn.interactions = [interaction]; };

test('a conditional on a click runs its branch when the condition holds, and the else when it does not', () => {
    setButton(onClick('go', cond([branch('flag', '==', true, [navTo('B')])], [navTo('C')])));
    const yes = respond(createPlayer('A'), pointer, withValues({ flag: true }));
    assert.deepEqual(yes.state, { current: 'B', history: ['A'] });
    assert.equal(yes.effects[0].to, 'B');
    const no = respond(createPlayer('A'), pointer, withValues({ flag: false }));
    assert.deepEqual(no.state, { current: 'C', history: ['A'] });
});

test('a conditional with no else does nothing when no branch holds', () => {
    setButton(onClick('go', cond([branch('flag', '==', true, [navTo('B')])])));
    const { state, effects } = respond(createPlayer('A'), pointer, withValues({ flag: false }));
    assert.deepEqual(state, { current: 'A', history: [] });
    assert.deepEqual(effects, []);
});

test('the chosen branch runs its actions in order: an open-link, then the navigation', () => {
    setButton(onClick('go', cond([branch('flag', '==', true, [{ type: 'open-link', url: 'https://example.com' }, navTo('B')])])));
    const { state, effects } = respond(createPlayer('A'), pointer, withValues({ flag: true }));
    assert.equal(state.current, 'B');
    assert.deepEqual(effects.map(e => e.type), ['open-link', 'navigate']);
});

test('the value of a variable on a node follows the node\'s mode, then its parents\', then the page\'s, then the first mode', () => {
    const variables = {
        collections: [{ id: 'col', name: 'Mode', modes: [{ id: 'm1', name: 'One' }, { id: 'm2', name: 'Two' }] }],
        items: [{ id: 'flag', name: 'flag', type: 'boolean', collectionId: 'col', values: { m1: true, m2: false } }],
    };
    const pages = [{ id: 'p', name: 'P', varModes: { col: 'm2' }, nodes: [
        { id: 'frame', name: 'frame', type: 'frame', parentId: null, varModes: { col: 'm1' } },
        { id: 'inner', name: 'inner', type: 'frame', parentId: 'frame' },
        { id: 'loose', name: 'loose', type: 'frame', parentId: null },
    ] }];
    const ctx = playContext({ pages, variables });
    assert.equal(ctx.valueOf('inner', 'flag'), true, 'the parent frame sets the mode');
    assert.equal(ctx.valueOf('loose', 'flag'), false, 'the page sets the mode');
    const bare = playContext({ pages: [{ id: 'q', name: 'Q', nodes: [{ id: 'x', name: 'x', type: 'frame', parentId: null }] }], variables });
    assert.equal(bare.valueOf('x', 'flag'), true, 'with no mode set, the first mode');
    assert.equal(ctx.valueOf('inner', 'nothing'), undefined, 'a variable that does not exist has no value');
});
