// Bulk delete: "is one of" on the selected ids, the selection cleared after, and the selection count drives visibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvalCtx, runStateAction, normalizeStateVariable, cleanState, compareValues, COMPARATORS, planTableState, evaluateState, initialValues } from '../src/index.js';

const schema = [{ key: 'id', type: 'number' }, { key: 'name', type: 'string' }];
const rows = [1, 2, 3, 4, 5].map(id => ({ id, name: `U${id}` }));

test('"is one of" matches a row whose id is in the list (numbers and their text forms alike)', () => {
    assert.ok(COMPARATORS.some(c => c.id === 'in'));
    assert.equal(compareValues('in', 2, ['1', '2']), true);
    assert.equal(compareValues('in', 3, ['1', '2']), false);
    assert.equal(compareValues('in', 3, []), false);
    assert.equal(compareValues('in', 3, 'not a list'), false);
});

test('bulk delete: removes every selected row, leaves the others, and reset clears the selection', () => {
    const list = normalizeStateVariable({ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial: rows });
    const plan = planTableState({ variables: [list], derived: [] }, list, () => 'x' + Math.random().toString(36).slice(2, 7), {});
    const state = cleanState({ variables: [list, ...plan.variables], derived: plan.derived });
    const ev = createEvalCtx(state);
    ev.set(plan.ids.selected, ['2', '4']);
    const del = { type: 'list-delete', listId: 'users', where: { field: 'id', cmp: 'in', value: { op: 'var', ref: plan.ids.selected } } };
    assert.equal(runStateAction(del, ev, ev.env()).ok, true);
    assert.deepEqual(ev.get('users').map(r => r.id), [1, 3, 5]);
    const reset = { type: 'set-state', variableId: plan.ids.selected, op: 'reset' };
    assert.equal(runStateAction(reset, ev, ev.env()).ok, true);
    assert.equal(ev.get(plan.ids.selectedCount), 0);
});

test('nothing selected: the bulk delete removes nothing', () => {
    const list = normalizeStateVariable({ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial: rows });
    const plan = planTableState({ variables: [list], derived: [] }, list, () => 'y' + Math.random().toString(36).slice(2, 7), {});
    const state = cleanState({ variables: [list, ...plan.variables], derived: plan.derived });
    const ev = createEvalCtx(state);
    const del = { type: 'list-delete', listId: 'users', where: { field: 'id', cmp: 'in', value: { op: 'var', ref: plan.ids.selected } } };
    assert.equal(runStateAction(del, ev, ev.env()).ok, true);
    assert.equal(ev.get('users').length, 5);
    assert.equal(evaluateState(state, initialValues(state)).errors.size, 0);
});
