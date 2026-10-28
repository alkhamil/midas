import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conditionalOp, conditionPatch, defaultVariableOf, withBranch } from '../src/prototype/conditional.js';
import { interactionPatch, nestedPatch } from '../src/prototype/play.js';
import { validatePrototype } from '../src/prototype/validate.js';

// The Prototype panel's edits of a conditional: each operation and field returns the whole conditional or action, and nothing else changes.
const instant = { type: 'instant', durationMs: 0 };
const go = destinationId => ({ type: 'navigate-to', destinationId, transition: instant });
const branch = (variableId, operator, value, actions) => ({ condition: { variableId, operator, value }, actions });
const cond = (branches, elseActions) => ({ type: 'conditional', branches, ...(elseActions ? { else: elseActions } : {}) });

const bool = { id: 'flag', name: 'flag', type: 'boolean' };
const num = { id: 'count', name: 'count', type: 'number' };
const str = { id: 'label', name: 'label', type: 'string' };
const variables = [bool, num, str];
const variableOf = id => variables.find(v => v.id === id);

test('a new branch compares the variable to its default and holds one navigation', () => {
    const c = conditionalOp(cond([branch('flag', '==', false, [go('A')])]), 'branch-add', { navigate: go('B'), variable: bool });
    assert.deepEqual(c.branches[1], { condition: { variableId: 'flag', operator: '==', value: true }, actions: [go('B')] });
});

test('adding a branch with no variable to compare is refused', () => {
    assert.throws(() => conditionalOp(cond([]), 'branch-add', { navigate: go('B') }), /no boolean, number or string variable/);
});

test('branches move up and down in place, and an end does not move', () => {
    const c = cond([branch('flag', '==', true, [go('A')]), branch('flag', '==', false, [go('B')])]);
    assert.deepEqual(conditionalOp(c, 'branch-down', { at: 'b0', navigate: go('X') }).branches.map(b => b.actions[0].destinationId), ['B', 'A']);
    assert.deepEqual(conditionalOp(c, 'branch-up', { at: 'b0', navigate: go('X') }), c);
    assert.deepEqual(conditionalOp(c, 'branch-remove', { at: 'b0', navigate: go('X') }).branches.map(b => b.actions[0].destinationId), ['B']);
});

test('the else is added with a navigation and removed as a whole', () => {
    const c = cond([branch('flag', '==', true, [go('A')])]);
    const added = conditionalOp(c, 'else-add', { navigate: go('B') });
    assert.deepEqual(added.else, [go('B')]);
    assert.equal('else' in conditionalOp(added, 'else-remove', { navigate: go('B') }), false);
});

test('actions in a branch or the else are added and removed by index', () => {
    const c = cond([branch('flag', '==', true, [go('A')])], [go('C')]);
    assert.deepEqual(conditionalOp(c, 'action-add', { at: 'b0', navigate: go('B') }).branches[0].actions, [go('A'), go('B')]);
    assert.equal('else' in conditionalOp(c, 'action-remove', { at: 'e', index: 0, navigate: go('X') }), false);
});

test('a condition field change: a new variable resets the comparison; an operator and a value must fit the type', () => {
    const c = branch('flag', '==', false, [go('A')]).condition;
    assert.deepEqual(conditionPatch(c, 'cond-variable', 'count', variableOf), { variableId: 'count', operator: '==', value: 0 });
    assert.deepEqual(conditionPatch(c, 'cond-operator', '!=', variableOf), { variableId: 'flag', operator: '!=', value: false });
    assert.throws(() => conditionPatch(c, 'cond-operator', '>', variableOf), /boolean takes/);
    assert.deepEqual(conditionPatch(c, 'cond-value', 'true', variableOf), { variableId: 'flag', operator: '==', value: true });
    const n = { variableId: 'count', operator: '>', value: 1 };
    assert.deepEqual(conditionPatch(n, 'cond-value', '7', variableOf), { variableId: 'count', operator: '>', value: 7 });
    assert.throws(() => conditionPatch(n, 'cond-value', 'many', variableOf), /needs a number/);
});

test('a new conditional starts on the first boolean variable, else the first number or string', () => {
    assert.equal(defaultVariableOf([num, bool, str]).id, 'flag');
    assert.equal(defaultVariableOf([num, str]).id, 'count');
    assert.equal(defaultVariableOf([{ id: 'c', type: 'color' }]), undefined);
});

test('a conditional default from the panel is valid, and its branch compares the first variable to its default', () => {
    const interaction = { id: 'go', trigger: { type: 'on-click' }, action: go('A') };
    const patch = interactionPatch(interaction, 'action', 'conditional', { firstDestination: 'B', variables });
    assert.deepEqual(patch.action.branches[0], { condition: { variableId: 'flag', operator: '==', value: true }, actions: [go('B')] });
    const d = {
        pages: [{ id: 'p', name: 'P', nodes: [
            { id: 'A', name: 'A', type: 'frame', parentId: null, prototype: { version: 1, interactions: [{ ...interaction, ...patch }] } },
            { id: 'B', name: 'B', type: 'frame', parentId: null },
        ] }],
        variables: { collections: [], items: variables.map(v => ({ ...v, collectionId: 'c', values: {} })) },
    };
    assert.deepEqual(validatePrototype(d), []);
});

test('a conditional cannot be set inside a conditional, nor on a hover trigger, nor without a variable to compare', () => {
    const interaction = { id: 'go', trigger: { type: 'on-click' }, action: go('A') };
    assert.throws(() => interactionPatch(interaction, 'action', 'conditional', { firstDestination: 'B', variables, nested: true }), /cannot sit inside/);
    const hover = { ...interaction, trigger: { type: 'while-hovering' } };
    assert.throws(() => interactionPatch(hover, 'action', 'conditional', { firstDestination: 'B', variables }), /cannot navigate/);
    assert.throws(() => interactionPatch(interaction, 'action', 'conditional', { firstDestination: 'B', variables: [] }), /no boolean, number or string variable/);
});

test('a trigger that would make a conditional navigate on hover is refused', () => {
    const interaction = { id: 'go', trigger: { type: 'on-click' }, action: cond([branch('flag', '==', true, [go('A')])]) };
    assert.throws(() => interactionPatch(interaction, 'trigger', 'while-hovering', {}), /cannot navigate/);
});

test('a field of a part inside a conditional changes that part and leaves the rest', () => {
    const interaction = { id: 'go', trigger: { type: 'on-click' }, action: cond([branch('flag', '==', true, [go('A')]), branch('flag', '==', false, [go('B')])], [go('C')]) };
    const context = { variables };
    assert.deepEqual(nestedPatch(interaction, 'cond-value', 'false', 'b0', 0, context).branches[0].condition, { variableId: 'flag', operator: '==', value: false });
    assert.deepEqual(nestedPatch(interaction, 'destination', 'D', 'e', 0, context).else, [go('D')]);
    assert.deepEqual(nestedPatch(interaction, 'action', 'open-link', 'b1', 0, context).branches[1].actions, [{ type: 'open-link', url: 'https://example.com' }]);
    assert.deepEqual(withBranch(interaction.action, 'b0', interaction.action.branches[0]), interaction.action);
});
