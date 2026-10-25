import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanState } from '../src/state.js';
import { compareValues, evaluate, evaluateState, refsOf, validateExpr } from '../src/expr.js';

const users = [{ name: 'Ann', status: 'active', age: 30 }, { name: 'Bob', status: 'inactive', age: 17 }, { name: 'Cy', status: 'active', age: 25 }];
const vals = new Map([['users', users], ['name', 'Ada'], ['n', 3], ['empty', []], ['nums', [1, 2, 3.5]]]);
const env = { resolve: ref => (vals.has(ref) ? { found: true, value: vals.get(ref) } : { found: false }) };
const run = e => evaluate(e, env);
const V = ref => ({ op: 'var', ref }), L = value => ({ op: 'value', value });

test('count, length, isEmpty', () => {
    assert.equal(run({ op: 'count', list: V('users') }).value, 3);
    assert.equal(run({ op: 'length', of: V('name') }).value, 3);
    assert.equal(run({ op: 'length', of: V('users') }).value, 3);
    assert.equal(run({ op: 'isEmpty', of: V('empty') }).value, true);
    assert.equal(run({ op: 'isEmpty', of: V('users') }).value, false);
    assert.equal(run({ op: 'isEmpty', of: L('  ') }).value, true);
    assert.equal(run({ op: 'isEmpty', of: V('n') }).value, false);
});

test('sum of a field and of plain numbers; text that is not a number is skipped', () => {
    assert.equal(run({ op: 'sum', list: V('users'), field: 'age' }).value, 72);
    assert.equal(run({ op: 'sum', list: V('nums') }).value, 6.5);
    assert.equal(run({ op: 'sum', list: V('empty') }).value, 0);
    assert.equal(run({ op: 'sum', list: L([{ p: '10' }, { p: 'x' }, { p: 5 }]), field: 'p' }).value, 15);
});

test('filter by field + comparison, and count of a filter', () => {
    const active = { op: 'filter', list: V('users'), field: 'status', cmp: 'eq', value: L('active') };
    assert.deepEqual(run(active).value.map(u => u.name), ['Ann', 'Cy']);
    assert.equal(run({ op: 'count', list: active }).value, 2);
    assert.equal(run({ op: 'count', list: { op: 'filter', list: V('users'), field: 'age', cmp: 'gte', value: L(25) } }).value, 2);
    assert.equal(run({ op: 'count', list: { op: 'filter', list: V('users'), field: 'name', cmp: 'contains', value: L('b') } }).value, 1);
    assert.equal(run({ op: 'count', list: { op: 'filter', list: V('users'), field: 'name', cmp: 'startsWith', value: L('c') } }).value, 1);
});

test('equals, every comparison, and / or / not', () => {
    assert.equal(run({ op: 'equals', a: V('n'), b: L(3) }).value, true);
    assert.equal(run({ op: 'equals', a: V('n'), b: L('3') }).value, true);
    assert.equal(run({ op: 'equals', a: V('name'), b: L('ada') }).value, false);
    const c = (cmp, a, b) => compareValues(cmp, a, b);
    assert.deepEqual([c('eq', 1, 1), c('ne', 1, 2), c('gt', 3, 2), c('gte', 2, 2), c('lt', 1, 2), c('lte', 2, 2)], [true, true, true, true, true, true]);
    assert.equal(c('gt', '10', 9), true);
    assert.equal(c('lt', 'apple', 'banana'), true);
    assert.equal(c('contains', ['a', 'b'], 'b'), true);
    assert.equal(c('endsWith', 'Hello', 'LO'), true);
    assert.equal(run({ op: 'and', args: [L(true), { op: 'compare', cmp: 'gt', a: V('n'), b: L(1) }] }).value, true);
    assert.equal(run({ op: 'and', args: [L(true), L(false)] }).value, false);
    assert.equal(run({ op: 'or', args: [L(false), V('users')] }).value, true);
    assert.equal(run({ op: 'or', args: [] }).value, false);
    assert.equal(run({ op: 'and', args: [] }).value, true);
    assert.equal(run({ op: 'not', arg: V('empty') }).value, true);
});

test('mistakes come back as errors, not exceptions', () => {
    assert.match(run({ op: 'count', list: V('n') }).error, /list/i);
    assert.match(run({ op: 'count', list: V('nope') }).error, /does not exist/);
    assert.match(run({ op: 'length', of: V('n') }).error, /text or a list/);
    assert.match(run({ op: 'bogus' }).error, /Unknown operation/);
    assert.match(run(null).error, /missing/);
    assert.match(run({ op: 'compare', cmp: 'weird', a: L(1), b: L(1) }).error, /Unknown comparison/);
});

const state = ds => cleanState({ variables: [{ id: 'users', name: 'Users', type: 'list', schema: [{ key: 'status', type: 'string' }, { key: 'age', type: 'number' }], initial: [] }], derived: ds });

test('derived variables read state and each other, in any order', () => {
    const s = state([
        { id: 'big', name: 'big', expr: { op: 'compare', cmp: 'gte', a: V('activeCount'), b: L(2) } },
        { id: 'activeCount', name: 'activeCount', expr: { op: 'count', list: { op: 'filter', list: V('users'), field: 'status', cmp: 'eq', value: L('active') } } },
    ]);
    const r = evaluateState(s, new Map([['users', users]]));
    assert.equal(r.values.get('activeCount'), 2);
    assert.equal(r.values.get('big'), true);
    assert.equal(r.errors.size, 0);
    assert.equal(evaluateState(s, new Map([['users', users.slice(1)]])).values.get('big'), false);
});

test('a cycle is detected, every variable of the loop gets the error, the others still work', () => {
    const s = state([
        { id: 'a', name: 'a', expr: { op: 'not', arg: V('b') } },
        { id: 'b', name: 'b', expr: { op: 'not', arg: V('a') } },
        { id: 'self', name: 'self', expr: V('self') },
        { id: 'ok', name: 'ok', expr: { op: 'count', list: V('users') } },
        { id: 'uses', name: 'uses', expr: { op: 'not', arg: V('a') } },
    ]);
    const r = evaluateState(s, new Map([['users', users]]));
    assert.match(r.errors.get('a'), /Circular: a → b → a/);
    assert.match(r.errors.get('b'), /Circular/);
    assert.match(r.errors.get('self'), /Circular: self → self/);
    assert.ok(r.errors.has('uses'));
    assert.equal(r.values.get('ok'), 3);
    assert.equal(r.values.has('a'), false);
});

test('refsOf and validateExpr', () => {
    const e = { op: 'and', args: [{ op: 'compare', cmp: 'gt', a: V('x'), b: L(1) }, { op: 'isEmpty', of: { op: 'filter', list: V('y'), field: 'f', cmp: 'eq', value: V('z') } }] };
    assert.deepEqual([...refsOf(e)].sort(), ['x', 'y', 'z']);
    assert.deepEqual(validateExpr(e, new Set(['x', 'y', 'z'])), []);
    assert.match(validateExpr(e, new Set(['x'])).join('|'), /unknown variable/);
    assert.match(validateExpr({ op: 'filter', list: V('x'), cmp: 'nope', value: L(1) }, new Set(['x'])).join('|'), /unknown comparison/);
    assert.match(validateExpr({ op: 'count' }, new Set()).join('|'), /missing/);
    assert.match(validateExpr({ op: 'eval', code: 'x' }, new Set()).join('|'), /unknown operation/);
});

import { defaultExpr, getAt, setAt, OPERATIONS } from '../src/expr.js';

test('every operation has a default that is valid and evaluates', () => {
    const e2 = { resolve: r => (r === 'xs' ? { found: true, value: [{ a: 1 }, { a: 2 }] } : { found: false }) };
    for (const o of OPERATIONS.filter(x => !['valid', 'invalid'].includes(x.id) && !x.hidden)) {
        const e = defaultExpr(o.id, 'xs');
        assert.equal(e.op, o.id);
        assert.deepEqual(validateExpr(e, new Set(['xs'])), [], o.id);
        if (!['length'].includes(o.id)) assert.equal(evaluate(e, e2).ok, true, o.id);
    }
});

test('getAt / setAt edit a copy of the tree', () => {
    const e = { op: 'and', args: [{ op: 'not', arg: { op: 'var', ref: 'a' } }, { op: 'var', ref: 'b' }] };
    assert.equal(getAt(e, 'args.0.arg.ref'), 'a');
    const f = setAt(e, 'args.0.arg', { op: 'var', ref: 'z' });
    assert.equal(getAt(f, 'args.0.arg.ref'), 'z');
    assert.equal(getAt(e, 'args.0.arg.ref'), 'a');
    assert.equal(setAt(e, '', { op: 'value', value: 1 }).op, 'value');
    assert.equal(setAt(e, 'args.1', undefined).args.length, 1);
    assert.equal(setAt(e, ['args', 2], { op: 'value', value: 3 }).args.length, 3);
});
