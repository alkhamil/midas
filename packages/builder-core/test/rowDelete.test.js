// A row's own Delete: list-delete where id = $row.id removes exactly that row, through the same runner Preview uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvalCtx, runStateAction, normalizeStateVariable, cleanState, rowContext } from '../src/index.js';

const schema = [{ key: 'id', type: 'number' }, { key: 'name', type: 'string' }];
const list = normalizeStateVariable({ id: 'users', name: 'users', type: 'list', itemType: 'object', schema, initial: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Budi' }, { id: 3, name: 'Citra' }] });

test('list-delete with where id = $row.id removes only that row', () => {
    const ev = createEvalCtx(cleanState({ variables: [list], derived: [] }));
    const action = { type: 'list-delete', listId: 'users', where: { field: 'id', cmp: 'eq', value: { op: 'var', ref: '$row.id' } } };
    const env = ev.env({ row: rowContext({ id: 2, name: 'Budi' }, 2, [], 'id') });
    const r = runStateAction(action, ev, env);
    assert.equal(r.ok, true);
    assert.deepEqual(ev.get('users').map(x => x.id), [1, 3]);
});

test('outside a row the same action has no row to read: it fails and changes nothing', () => {
    const ev = createEvalCtx(cleanState({ variables: [list], derived: [] }));
    const action = { type: 'list-delete', listId: 'users', where: { field: 'id', cmp: 'eq', value: { op: 'var', ref: '$row.id' } } };
    const r = runStateAction(action, ev, ev.env());
    assert.equal(r.ok, false);
    assert.equal(ev.get('users').length, 3);
});
