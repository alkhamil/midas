// Phase 2: templates, conditions, rules, State / list / feedback actions, simulated request with scenarios, old interactions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanState, coerceTo, interpolate, placeholdersOf, scenariosOf, DEFAULT_SCENARIOS } from '../src/state.js';
import { createEvalCtx } from '../src/evalctx.js';
import { describeExpr, evaluate } from '../src/expr.js';
import { normalizeRules, selectRule, testCondition, ruleSummary } from '../src/rules.js';
import { normalizeAction, normalizeInteractions, TRIGGERS, ACTIONS, interactionsForNode } from '../src/behavior.js';
import { requestDelay, resolveOutcome, runActions, runInteraction, runStateAction } from '../src/actions.js';
import { validateInput } from '../src/validate.js';

const V = ref => ({ op: 'var', ref }), L = value => ({ op: 'value', value });
const mkState = (extra = {}) => cleanState({
    variables: [
        { id: 'attempts', name: 'Attempts', type: 'number', initial: 0 },
        { id: 'email', name: 'Email', type: 'string', initial: '' },
        { id: 'open', name: 'Open', type: 'boolean', initial: false },
        { id: 'cart', name: 'Cart', type: 'list', schema: [{ key: 'name', type: 'string' }, { key: 'price', type: 'number' }, { key: 'qty', type: 'number' }], initial: [{ name: 'Tea', price: 10, qty: 1 }, { name: 'Cake', price: 25, qty: 2 }] },
    ],
    derived: [
        { id: 'total', name: 'total', expr: { op: 'sum', list: V('cart'), field: 'price' } },
        { id: 'count', name: 'Item count', expr: { op: 'count', list: V('cart') } },
    ],
    ...extra,
});

test('templates fill {names} (any case), keep unknown names visible, and format values', () => {
    const ev = createEvalCtx(mkState());
    assert.equal(ev.interpolate('Total: Rp {total}'), 'Total: Rp 35');
    assert.equal(ev.interpolate('Active: {Item count} / {ATTEMPTS}'), 'Active: 2 / 0');
    assert.equal(ev.interpolate('Hi {nobody}!'), 'Hi {nobody}!');
    assert.equal(ev.interpolate('{ open }'), 'false');
    assert.equal(ev.interpolate('{cart} rows'), '2 rows');
    assert.deepEqual(placeholdersOf('a {x} b {y} {x} {}'), ['x', 'y']);
    assert.equal(interpolate('plain', () => ({ found: false })), 'plain');
    ev.set('attempts', 5);
    assert.equal(ev.interpolate('{attempts} of 5'), '5 of 5');
});

test('builtins: $loading, $response, $responseKind read through env', () => {
    const ev = createEvalCtx(mkState());
    ev.setExtra('response', 'Error'); ev.setExtra('responseKind', 'error'); ev.setExtra('loading', true);
    const env = ev.env();
    assert.equal(evaluate(V('$response'), env).value, 'Error');
    assert.equal(evaluate({ op: 'equals', a: V('$responseKind'), b: L('error') }, env).value, true);
    assert.equal(evaluate(V('$loading'), env).value, true);
    assert.equal(ev.interpolate('Last: {$response}'), 'Last: Error');
});

test('field validity is a condition source; derived values cannot read it', () => {
    const ev = createEvalCtx(mkState());
    const env = ev.env({ fieldValid: id => (id === 'f1' ? true : id === 'f2' ? false : undefined) });
    assert.equal(evaluate({ op: 'valid', field: 'f1' }, env).value, true);
    assert.equal(evaluate({ op: 'invalid', field: 'f2' }, env).value, true);
    assert.equal(evaluate({ op: 'valid', field: 'f2' }, env).value, false);
    assert.match(evaluate({ op: 'valid', field: 'zzz' }, env).error, /Choose a field/);
    assert.match(evaluate({ op: 'valid', field: 'f1' }, ev.env()).error, /only available in conditions/);
    assert.equal(describeExpr({ op: 'compare', cmp: 'gte', a: V('attempts'), b: L(5) }, id => (id === 'attempts' ? 'Attempts' : id)), 'Attempts is at least 5');
    assert.equal(describeExpr({ op: 'invalid', field: 'f2' }, x => x, () => 'Email'), 'Email is invalid');
});

test('validateInput: same answers as the old Preview check, from the shared rules', () => {
    const v = (opts, value, extra) => validateInput(opts, value, extra);
    assert.equal(v({ inputType: 'email' }, 'a@b.co').valid, true);
    assert.equal(v({ inputType: 'email' }, 'nope').reason, 'email');
    assert.equal(v({ inputType: 'number' }, '12.5').valid, true);
    assert.equal(v({ inputType: 'number' }, 'abc').reason, 'number');
    assert.equal(v({ required: true }, '', { touched: false }).valid, true);          // never touched: fine
    assert.equal(v({ required: true }, '', { touched: true }).reason, 'required');
    assert.equal(v({ required: true }, '   ', { touched: false, strict: true }).valid, false);   // a submit
    assert.equal(v({ required: false }, '', { strict: true }).valid, true);
    assert.match(v({ inputType: 'email', label: 'Email' }, 'x').message, /Email/);
    assert.equal(v({ inputType: 'text' }, 'anything').valid, true);
});

test('conditions: no condition = always; broken condition = error', () => {
    const ev = createEvalCtx(mkState());
    assert.deepEqual(testCondition(undefined, ev.env()), { ok: true, value: true });
    assert.equal(testCondition({ op: 'compare', cmp: 'gte', a: V('attempts'), b: L(5) }, ev.env()).value, false);
    ev.set('attempts', 5);
    assert.equal(testCondition({ op: 'compare', cmp: 'gte', a: V('attempts'), b: L(5) }, ev.env()).value, true);
    assert.equal(testCondition(V('nope'), ev.env()).ok, false);
});

const act = (a) => normalizeAction(a);
const withRules = items => normalizeRules({ items }, list => (list || []).map(act));

test('rules: first enabled match wins, then stop; otherwise only when nothing matched; disabled rules are skipped', () => {
    const rules = withRules([
        { id: 'a', name: 'AC-3 Lockout', if: { op: 'compare', cmp: 'gte', a: V('attempts'), b: L(5) }, actions: [{ type: 'show-feedback', kind: 'modal', message: 'Locked' }] },
        { id: 'b', name: 'Second', if: { op: 'compare', cmp: 'gte', a: V('attempts'), b: L(1) }, actions: [{ type: 'show-feedback', message: 'Wrong' }] },
        { id: 'c', name: 'Off', enabled: false, actions: [{ type: 'show-feedback', message: 'never' }] },
    ]);
    rules.otherwise = { actions: [act({ type: 'show-feedback', message: 'fine' })] };
    const pick = n => { const ev = createEvalCtx(mkState()); ev.set('attempts', n); return selectRule(rules, c => testCondition(c, ev.env()).value); };
    assert.equal(pick(7).rule.name, 'AC-3 Lockout');          // both match: the first wins
    assert.equal(pick(2).rule.name, 'Second');
    assert.equal(pick(0).via, 'otherwise');                   // the disabled rule has no condition, still skipped
    assert.equal(selectRule(undefined, () => true), null);
    const noOther = { items: rules.items };
    assert.equal(selectRule(noOther, () => false), null);
    assert.equal(selectRule(withRules([{ name: 'Always', actions: [] }]), () => false).rule.name, 'Always');   // no condition = always
    assert.match(ruleSummary(rules.items[0], c => describeExpr(c, x => x)), /^If attempts is at least 5 → 1 action$/);
});

test('old interactions keep their shape; new fields are optional', () => {
    const old = normalizeInteractions([{ id: 'i1', trigger: 'onClick', action: { type: 'navigate', targetFrameId: 'f' } }]);
    assert.deepEqual(old, [{ id: 'i1', trigger: 'onClick', actions: [{ type: 'navigate', targetFrameId: 'f', transition: undefined }].map(a => ({ type: a.type, targetFrameId: a.targetFrameId })) }]);
    assert.equal(old[0].if, undefined);
    assert.equal(old[0].rules, undefined);
    assert.equal(normalizeInteractions([{}])[0].actions.length, 1);
    const n = normalizeInteractions([{ trigger: 'onLoad', if: V('open'), actions: [], rules: { items: [{ name: 'R', actions: [{ type: 'set-state', variableId: 'open', op: 'toggle' }] }] } }]);
    assert.equal(n[0].trigger, 'onLoad');
    assert.deepEqual(n[0].if, V('open'));
    assert.equal(n[0].actions.length, 0);                      // an interaction made of rules has no plain actions
    assert.equal(n[0].rules.items[0].actions[0].op, 'toggle');
    assert.equal(normalizeInteractions([{ trigger: 'bogus' }])[0].trigger, 'onClick');
    assert.deepEqual(interactionsForNode({}, null, { interactions: [{ trigger: 'onSearch', actions: [{ type: 'list-clear', listId: 'x' }] }] }).list[0].actions[0], { type: 'list-clear', listId: 'x' });
    assert.ok(['onLoad', 'onSearch', 'onOpenChange'].every(t => TRIGGERS.some(x => x.id === t)));
    assert.ok(['set-state', 'list-add', 'list-update', 'list-delete', 'list-clear', 'show-feedback', 'request', 'validate-field'].every(t => ACTIONS.some(x => x.id === t)));
    assert.ok(['navigate', 'open-dropdown', 'open-overlay', 'set-variable', 'change-variant'].every(t => ACTIONS.some(x => x.id === t)));
});

test('normalize: State and feedback actions get complete, safe fields', () => {
    assert.deepEqual(act({ type: 'set-state', variableId: 'a', op: 'increment' }), { type: 'set-state', variableId: 'a', op: 'increment', value: L(1) });
    assert.deepEqual(act({ type: 'set-state', variableId: 'a', op: 'weird' }), { type: 'set-state', variableId: 'a', op: 'set', value: L('') });
    assert.equal(act({ type: 'set-state', variableId: 'a', op: 'toggle' }).value, undefined);
    assert.equal(act({ type: 'show-feedback' }).kind, 'alert');
    assert.equal(act({ type: 'show-feedback', kind: 'modal' }).blocking, true);
    assert.equal(act({ type: 'show-feedback', kind: 'alert' }).blocking, false);
    assert.equal(act({ type: 'show-feedback', kind: 'alert', level: 'nope' }).level, 'info');
    assert.equal(act({ type: 'show-feedback', kind: 'alert' }).duration, 3000);
    assert.equal(act({ type: 'show-feedback', kind: 'modal' }).duration, 0);
    assert.equal(act({ type: 'show-feedback', kind: 'drawer' }).position, 'right');
    assert.equal(act({ type: 'request', delay: 99999 }).delay, 10000);
    assert.equal(act({ type: 'request' }).delay, 800);
    const pop = act({ type: 'show-feedback', kind: 'popconfirm', onConfirm: [{ type: 'list-clear', listId: 'cart' }] });
    assert.deepEqual(pop.onConfirm, [{ type: 'list-clear', listId: 'cart' }]);
    assert.equal(act({ type: 'show-feedback', kind: 'alert', onConfirm: [{ type: 'list-clear' }] }).onConfirm, undefined);
    assert.equal(act({ type: 'list-delete', listId: 'cart', where: { field: 'name', cmp: 'eq', value: L('Tea') } }).where.field, 'name');
    assert.equal(act({ type: 'list-delete', listId: 'cart', where: { cmp: 'eq' } }).where, undefined);
});

const run = (a, ev) => runStateAction(act(a), ev, ev.env());

test('set State: set / increment / decrement / toggle / reset, and what goes wrong', () => {
    const ev = createEvalCtx(mkState());
    assert.deepEqual(run({ type: 'set-state', variableId: 'attempts', op: 'increment' }, ev), { ok: true });
    run({ type: 'set-state', variableId: 'attempts', op: 'increment', value: L(4) }, ev);
    assert.equal(ev.get('attempts'), 5);
    run({ type: 'set-state', variableId: 'attempts', op: 'decrement', value: L(2) }, ev);
    assert.equal(ev.get('attempts'), 3);
    run({ type: 'set-state', variableId: 'attempts', op: 'set', value: L('9') }, ev);        // "9" fits a Number
    assert.equal(ev.get('attempts'), 9);
    run({ type: 'set-state', variableId: 'email', op: 'set', value: V('attempts') }, ev);   // a number into a String
    assert.equal(ev.get('email'), '9');
    run({ type: 'set-state', variableId: 'open', op: 'toggle' }, ev);
    assert.equal(ev.get('open'), true);
    run({ type: 'set-state', variableId: 'attempts', op: 'reset' }, ev);
    assert.equal(ev.get('attempts'), 0);
    assert.equal(run({ type: 'set-state', variableId: 'attempts', op: 'set', value: L('abc') }, ev).ok, false);
    assert.equal(ev.get('attempts'), 0);                                                     // nothing changed
    assert.match(run({ type: 'set-state', variableId: 'email', op: 'toggle' }, ev).error, /Boolean/);
    assert.match(run({ type: 'set-state', variableId: 'email', op: 'increment' }, ev).error, /Number/);
    assert.match(run({ type: 'set-state', variableId: 'nope', op: 'reset' }, ev).error, /Choose/);
    assert.match(run({ type: 'set-state', variableId: 'total', op: 'reset' }, ev).error, /Choose/);   // derived: not a variable
    assert.equal(coerceTo({ type: 'option', options: ['a'] }, 'b'), undefined);
});

test('list operations: add, update, delete, clear; derived values follow', () => {
    const ev = createEvalCtx(mkState());
    assert.equal(ev.get('total'), 35);
    run({ type: 'list-add', listId: 'cart', row: { name: L('Milk'), price: L('5'), qty: L(1) } }, ev);
    assert.deepEqual(ev.get('cart').at(-1), { name: 'Milk', price: 5, qty: 1 });             // "5" became 5
    assert.equal(ev.get('total'), 40);
    run({ type: 'list-add', listId: 'cart', row: { name: V('email') } }, ev);                 // missing fields get defaults
    assert.deepEqual(ev.get('cart').at(-1), { name: '', price: 0, qty: 0 });
    run({ type: 'list-update', listId: 'cart', where: { field: 'name', cmp: 'eq', value: L('Tea') }, set: { qty: L(3), price: L(12) } }, ev);
    assert.deepEqual(ev.get('cart')[0], { name: 'Tea', price: 12, qty: 3 });
    assert.equal(ev.get('cart')[1].qty, 2);                                                   // others untouched
    run({ type: 'list-update', listId: 'cart', set: { qty: L(0) } }, ev);                     // no "where": every row
    assert.ok(ev.get('cart').every(r => r.qty === 0));
    run({ type: 'list-delete', listId: 'cart', where: { field: 'price', cmp: 'gte', value: L(20) } }, ev);
    assert.deepEqual(ev.get('cart').map(r => r.name), ['Tea', 'Milk', '']);
    assert.equal(ev.get('count'), 3);
    run({ type: 'list-delete', listId: 'cart', where: { field: 'name', cmp: 'eq', value: L('') } }, ev);
    assert.equal(ev.get('cart').length, 2);
    run({ type: 'list-clear', listId: 'cart' }, ev);
    assert.deepEqual(ev.get('cart'), []);
    assert.equal(ev.get('total'), 0);
    assert.match(run({ type: 'list-clear', listId: 'email' }, ev).error, /not a List/);
});

test('primitive lists use the value itself', () => {
    const ev = createEvalCtx(cleanState({ variables: [{ id: 'tags', name: 'Tags', type: 'list', itemType: 'string', initial: ['a', 'b'] }] }));
    run({ type: 'list-add', listId: 'tags', row: { value: L('c') } }, ev);
    run({ type: 'list-delete', listId: 'tags', where: { field: '', cmp: 'eq', value: L('a') } }, ev);
    assert.deepEqual(ev.get('tags'), ['b', 'c']);
});

test('scenarios: defaults, custom, the active one, Slow', () => {
    assert.deepEqual(scenariosOf(mkState()), DEFAULT_SCENARIOS);
    const st = mkState({ scenarios: [{ id: 'ok', name: 'Success', kind: 'success' }, { id: 'bad', name: 'Wrong credentials', kind: 'error' }, { id: 'bad', name: 'dup' }, { id: 'x', kind: 'nonsense' }] });
    assert.deepEqual(st.scenarios.map(s => s.id), ['ok', 'bad', 'x']);
    assert.equal(st.scenarios[2].kind, 'error');
    assert.equal(resolveOutcome(st, 'bad').name, 'Wrong credentials');
    assert.equal(resolveOutcome(st, 'gone').name, 'Success');                 // unknown active: the first
    assert.equal(resolveOutcome(mkState(), undefined).name, 'Success');
    assert.equal(requestDelay({ delay: 500 }, false), 500);
    assert.equal(requestDelay({ delay: 500 }, true), 1500);
    assert.equal(requestDelay({}, false), 800);
});

// A host that records what happened, with a request that resolves at once.
function fakeHost(state, { scenario = 'success', fields = {} } = {}) {
    const ev = createEvalCtx(state), log = [];
    const host = {
        ev, log,
        env: () => ev.env({ fieldValid: id => fields[id] }),
        perform: a => { log.push(['perform', a.type]); },
        feedback: f => { log.push(['feedback', f.kind, f.level, f.message]); },
        validateField: id => { log.push(['validate', id]); return fields[id] !== false; },
        request: async a => { log.push(['request', ev.extra('loading')]); return resolveOutcome(state, scenario); },
        changed: () => {}, warn: m => { log.push(['warn', m]); },
    };
    return host;
}

test('a simulated request: loading while it waits, then the active outcome picks the rule', async () => {
    const state = mkState({ scenarios: [{ id: 'ok', name: 'Success', kind: 'success' }, { id: 'dis', name: 'Account disabled', kind: 'error' }] });
    const it = normalizeInteractions([{ trigger: 'onClick', actions: [{ type: 'set-state', variableId: 'attempts', op: 'increment' }, { type: 'request', delay: 10 }], rules: {
        items: [
            { name: 'Disabled', if: { op: 'equals', a: V('$response'), b: L('Account disabled') }, actions: [{ type: 'show-feedback', kind: 'modal', level: 'error', message: 'Contact the admin' }] },
            { name: 'OK', if: { op: 'equals', a: V('$responseKind'), b: L('success') }, actions: [{ type: 'show-feedback', kind: 'alert', level: 'success', message: 'Welcome back, attempts: {attempts}' }, { type: 'navigate', targetFrameId: 'home' }] },
        ],
        otherwise: { actions: [{ type: 'show-feedback', level: 'error', message: 'Wrong' }] },
    } }])[0];
    let host = fakeHost(state, { scenario: 'dis' });
    let r = await runInteraction(it, host);
    assert.equal(r.rule, 'Disabled');
    assert.deepEqual(host.log, [['request', true], ['feedback', 'modal', 'error', 'Contact the admin']]);
    assert.equal(host.ev.extra('loading'), false);
    assert.equal(host.ev.get('attempts'), 1);
    assert.equal(host.ev.extra('response'), 'Account disabled');
    host = fakeHost(state, { scenario: 'ok' });
    r = await runInteraction(it, host);
    assert.equal(r.rule, 'OK');
    assert.deepEqual(host.log, [['request', true], ['feedback', 'alert', 'success', 'Welcome back, attempts: 1'], ['perform', 'navigate']]);
});

test('if gates the whole interaction; "otherwise" runs when no rule matches; a bad condition warns and counts as no', async () => {
    const it = normalizeInteractions([{ trigger: 'onClick', if: { op: 'compare', cmp: 'lt', a: V('attempts'), b: L(5) }, actions: [{ type: 'set-state', variableId: 'attempts', op: 'increment' }], rules: { items: [{ name: 'Bad', if: V('ghost'), actions: [] }], otherwise: { actions: [{ type: 'show-feedback', message: 'otherwise' }] } } }])[0];
    const host = fakeHost(mkState());
    host.ev.set('attempts', 5);
    assert.deepEqual(await runInteraction(it, host), { ran: false });
    assert.equal(host.ev.get('attempts'), 5);                 // blocked: not even the actions ran
    host.ev.set('attempts', 1);
    const r = await runInteraction(it, host);
    assert.equal(r.via, 'otherwise');
    assert.equal(host.ev.get('attempts'), 2);
    assert.ok(host.log.some(l => l[0] === 'warn' && /does not exist/.test(l[1])));
});

test('field validity conditions drive "check field" and feedback; State errors are reported, not thrown', async () => {
    const it = normalizeInteractions([{ trigger: 'onClick', actions: [{ type: 'validate-field', fieldId: 'email' }, { type: 'set-state', variableId: 'ghost', op: 'reset' }], rules: { items: [{ name: 'Invalid email', if: { op: 'invalid', field: 'email' }, actions: [{ type: 'show-feedback', level: 'error', message: 'Fix your email' }] }], otherwise: { actions: [{ type: 'request' }] } } }])[0];
    let host = fakeHost(mkState(), { fields: { email: false } });
    let r = await runInteraction(it, host);
    assert.equal(r.rule, 'Invalid email');
    assert.deepEqual(host.log.filter(l => l[0] !== 'warn'), [['validate', 'email'], ['feedback', 'alert', 'error', 'Fix your email']]);
    assert.ok(host.log.some(l => l[0] === 'warn' && /Choose a State variable/.test(l[1])));
    host = fakeHost(mkState(), { fields: { email: true } });
    r = await runInteraction(it, host);
    assert.equal(r.via, 'otherwise');
    assert.ok(host.log.some(l => l[0] === 'request'));
});

test('a confirmation carries actions of its own', async () => {
    const [it] = normalizeInteractions([{ trigger: 'onClick', actions: [{ type: 'show-feedback', kind: 'popconfirm', message: 'Delete?', onConfirm: [{ type: 'list-clear', listId: 'cart' }] }] }]);
    const host = fakeHost(mkState());
    let confirm;
    host.feedback = f => { confirm = f.onConfirm; };
    await runInteraction(it, host);
    assert.deepEqual(confirm, [{ type: 'list-clear', listId: 'cart' }]);
    await runActions(confirm, host);                            // what pressing OK does
    assert.deepEqual(host.ev.get('cart'), []);
});
