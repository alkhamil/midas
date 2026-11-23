// Set variable (decision 17 of docs/prototype-spec.md): an action writes a document variable's value for the Play session. The document is not
// written; a conditional reads the written value; restart puts the document's values back; navigation keeps the written values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePrototype } from '../src/prototype/validate.js';
import { createPlayer, respond } from '../src/prototype/player.js';
import { interactionPatch } from '../src/prototype/play.js';

const VARIABLES = { collections: [], items: [{ id: 'flag', name: 'flag', type: 'boolean' }, { id: 'count', name: 'count', type: 'number' }, { id: 'name', name: 'name', type: 'string' }] };
const setVar = (variableId, value) => ({ type: 'set-variable', variableId, value });
const navigate = destinationId => ({ type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } });
const doc = (interactions, extra = {}) => ({
    variables: VARIABLES,
    pages: [{ id: 'p', name: 'P', nodes: [
        { id: 'A', name: 'A', type: 'frame', parentId: null, prototype: { version: 2, interactions } },
        { id: 'B', name: 'B', type: 'frame', parentId: null },
        ...(extra.nodes ?? []),
    ] }],
});
const ctxOf = (d, valueOf = () => undefined) => {
    const nodes = d.pages.flatMap(p => p.nodes);
    const byId = new Map(nodes.map(n => [n.id, n]));
    return {
        interactionsOf: id => byId.get(id)?.prototype?.interactions ?? [],
        frameOf: id => (byId.get(id)?.parentId ? null : id),
        nodesOf: fid => nodes.filter(n => n.id === fid).map(n => ({ id: n.id, interactions: n.prototype?.interactions ?? [] })),
        valueOf,
    };
};
const click = { type: 'pointer', nodeId: 'A', trigger: 'on-click' };

test('a Set variable action is valid for a boolean, number or string variable of the document, and its value has the variable\'s type', () => {
    assert.deepEqual(validatePrototype(doc([{ id: 'i', trigger: { type: 'on-click' }, actions: [setVar('flag', true)] }])), []);
    assert.deepEqual(validatePrototype(doc([{ id: 'i', trigger: { type: 'on-click' }, actions: [setVar('count', 3)] }])), []);
    assert.deepEqual(validatePrototype(doc([{ id: 'i', trigger: { type: 'on-click' }, actions: [setVar('name', 'Ada')] }])), []);
});

test('an unknown variable, a variable of another type, or a value of the wrong type is refused', () => {
    const codes = action => validatePrototype(doc([{ id: 'i', trigger: { type: 'on-click' }, actions: [action] }])).map(p => p.code);
    assert.deepEqual(codes(setVar('nope', true)), ['variable-missing']);
    assert.deepEqual(codes(setVar('flag', 'yes')), ['variable-value-type']);
    assert.deepEqual(codes({ type: 'set-variable', variableId: 'flag' }), ['variable-value-type'], 'a missing value is a value of the wrong type');
    assert.deepEqual(codes({ type: 'set-variable', variableId: 'flag', value: true, extra: 1 }), ['action-shape']);
});

test('the player writes the value for the session: the next conditional reads it, and the document is unchanged', () => {
    const cond = { type: 'conditional', branches: [{ condition: { variableId: 'flag', operator: '==', value: true }, actions: [navigate('B')] }], else: [navigate('A')] };
    const d = doc([{ id: 'set', trigger: { type: 'on-click' }, actions: [setVar('flag', true)] }, { id: 'go', trigger: { type: 'on-click' }, actions: [cond] }]);
    const before = JSON.stringify(d);
    const c = ctxOf(d, () => false);
    const after = respond(createPlayer('A'), click, c).state;
    assert.equal(after.variables.flag, true, 'the session holds the written value');
    assert.equal(JSON.stringify(d), before, 'the document is not written');
    // The condition reads the written value (true), not the document's (false): the first branch runs, so B is the next frame.
    const next = respond(after, click, c).state;
    assert.equal(next.current, 'B');
});

test('navigation keeps the written values; restart puts them back to the document\'s', () => {
    const d = doc([]);
    const c = ctxOf(d);
    const written = { ...createPlayer('A'), variables: { flag: true } };
    assert.deepEqual(respond(written, { type: 'navigate', frameId: 'B' }, c).state.variables, { flag: true });
    assert.deepEqual(respond(written, { type: 'restart', startFrameId: 'A' }, c).state.variables, {});
});

test('the Play runtime gives a written value to a conditional on a timer as well as on a click', () => {
    const d = doc([{ id: 'timer', trigger: { type: 'after-delay', delayMs: 100 }, actions: [setVar('count', 5)] }]);
    const state = respond(createPlayer('A'), { type: 'timer', nodeId: 'A', interactionId: 'timer' }, ctxOf(d)).state;
    assert.equal(state.variables.count, 5);
});

test('the panel: Set variable takes the first variable of the document, and its value is typed by the variable', () => {
    const interaction = { id: 'i', trigger: { type: 'on-click' }, actions: [{ type: 'back' }] };
    const variables = VARIABLES.items.map(v => ({ id: v.id, name: v.name, type: v.type }));
    const { actions: [action] } = interactionPatch(interaction, 'action', 'set-variable', { variables });
    assert.deepEqual(action, { type: 'set-variable', variableId: 'flag', value: false });
    const counted = interactionPatch({ ...interaction, actions: [action] }, 'variable', 'count', { variables });
    assert.deepEqual(counted.actions[0], { type: 'set-variable', variableId: 'count', value: 0 });
    assert.deepEqual(interactionPatch(counted, 'value', '7', { variables }).actions[0].value, 7);
    assert.throws(() => interactionPatch(counted, 'value', 'lots', { variables }), /number/);
    assert.deepEqual(interactionPatch({ ...interaction, actions: [setVar('flag', false)] }, 'value', 'true', { variables }).actions[0].value, true);
});

test('the panel refuses Set variable with no variable to set', () => {
    const interaction = { id: 'i', trigger: { type: 'on-click' }, actions: [{ type: 'back' }] };
    assert.throws(() => interactionPatch(interaction, 'action', 'set-variable', { variables: [] }), /no boolean, number or string variable/);
});
