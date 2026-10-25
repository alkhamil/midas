import test from 'node:test';
import assert from 'node:assert/strict';
import { STATE_TYPES, checkValue, cleanState, defaultValue, formatValue, initialValues, normalizeStateVariable, parseSchema, truthy, uniqueStateName } from '../src/state.js';

const v = (type, extra = {}) => normalizeStateVariable({ id: `v-${type}`, name: type, type, ...extra });

test('there are eight state types', () => {
    assert.deepEqual(STATE_TYPES.map(t => t.id), ['string', 'number', 'boolean', 'option', 'list', 'object', 'date', 'file']);
});

test('every type has a legal default and checkValue accepts it', () => {
    for (const t of STATE_TYPES) {
        const x = v(t.id, t.id === 'option' ? { options: ['a', 'b'] } : {});
        assert.ok(x, t.id);
        assert.equal(x.scope, 'page');
        assert.equal(checkValue(x, x.initial).ok, true, t.id);
        assert.deepEqual(x.initial, defaultValue(x), t.id);
    }
});

test('checkValue rejects the wrong kind of value', () => {
    assert.equal(checkValue(v('string'), 5).ok, false);
    assert.equal(checkValue(v('number'), '5').ok, false);
    assert.equal(checkValue(v('number'), NaN).ok, false);
    assert.equal(checkValue(v('boolean'), 'true').ok, false);
    assert.equal(checkValue(v('option', { options: ['a', 'b'] }), 'c').ok, false);
    assert.equal(checkValue(v('date'), '2025-13-40').ok, false);
    assert.equal(checkValue(v('date'), '2025-01-31').ok, true);
    assert.equal(checkValue(v('file'), { name: 'a.png' }).ok, true);
    assert.equal(checkValue(v('file'), 'a.png').ok, false);
    const list = v('list', { schema: [{ key: 'qty', type: 'number' }] });
    assert.equal(checkValue(list, [{ qty: 1 }]).ok, true);
    assert.match(checkValue(list, [{ qty: 1 }, { qty: 'x' }]).error, /Row 2/);
    assert.equal(checkValue(list, 'nope').ok, false);
    assert.equal(checkValue(v('list', { itemType: 'number' }), [1, 2]).ok, true);
    assert.equal(checkValue(v('list', { itemType: 'number' }), [1, 'a']).ok, false);
});

test('an illegal initial value falls back to the default; an option takes its first value', () => {
    assert.equal(v('number', { initial: 'x' }).initial, 0);
    const o = v('option', { options: ['draft', 'sent'], initial: 'gone' });
    assert.equal(o.initial, 'draft');
    assert.deepEqual(v('option').options, ['option-1', 'option-2']);
    assert.equal(v('option', { options: ['a', 'b'], initial: 'b' }).initial, 'b');
});

test('list rows are fitted to the schema; the scope is page unless app', () => {
    const l = v('list', { schema: [{ key: 'name', type: 'string' }, { key: 'age', type: 'number' }], initial: [{ name: 'A', age: 3, extra: 1 }, { name: 'B', age: 'x' }, 'junk'], scope: 'app' });
    assert.deepEqual(l.initial, [{ name: 'A', age: 3 }, { name: 'B', age: 0 }]);
    assert.equal(l.scope, 'app');
    assert.equal(v('string', { scope: 'weird' }).scope, 'page');
});

test('normalize drops unknown fields and is idempotent', () => {
    const raw = { variables: [{ id: 'a', name: 'A', type: 'string', initial: 'x', secret: 1 }, { id: 'a', name: 'dup', type: 'string' }, { id: 'b', type: 'bogus' }, null], derived: [{ id: 'd', name: 'D', expr: { op: 'value', value: 1 }, junk: true }, { id: 'a', name: 'clash' }], extra: 1 };
    const once = cleanState(raw);
    assert.deepEqual(once.variables.map(x => x.id), ['a']);
    assert.equal(once.variables[0].secret, undefined);
    assert.deepEqual(once.derived.map(x => x.id), ['d']);
    assert.equal(once.extra, undefined);
    assert.deepEqual(cleanState(once), once);
    assert.deepEqual(cleanState(undefined), { variables: [], derived: [] });
});

test('initialValues is a fresh copy every time (Reset)', () => {
    const state = cleanState({ variables: [{ id: 'l', name: 'L', type: 'list', schema: [{ key: 'n', type: 'number' }], initial: [{ n: 1 }] }, { id: 'p', name: 'P', type: 'number', scope: 'app', initial: 4 }] });
    const a = initialValues(state);
    a.get('l').push({ n: 2 });
    assert.deepEqual(initialValues(state).get('l'), [{ n: 1 }]);
    assert.deepEqual([...initialValues(state, ['app']).keys()], ['p']);
});

test('parseSchema and helpers', () => {
    assert.deepEqual(parseSchema('name:string, price:number, ok:boolean, price:string, bad name:wat'), [{ key: 'name', type: 'string' }, { key: 'price', type: 'number' }, { key: 'ok', type: 'boolean' }, { key: 'bad-name', type: 'string' }]);
    assert.equal(formatValue([1, 2, 3]), '3');
    assert.equal(formatValue(true), 'true');
    assert.equal(formatValue(null), '');
    assert.equal(truthy([]), false);
    assert.equal(truthy('  '), false);
    assert.equal(truthy(0), false);
    assert.equal(truthy({ a: 1 }), true);
    assert.equal(uniqueStateName({ variables: [{ id: 'x', name: 'Count' }], derived: [] }, 'count'), 'count 2');
});
