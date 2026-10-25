// Form container: the triggers, the form actions, and the Has form config as the file keeps them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGERS, STATE_ACTION_IDS, normalizeInteractions, normalizeConfig, BUILTINS, submitForm, outcomeOf, resetForm, isDirty } from '../src/index.js';

test('On finish and On finish failed are triggers; a submit runs Submit form and Reset form as State actions', () => {
    assert.ok(TRIGGERS.some(t => t.id === 'onFinish'));
    assert.ok(TRIGGERS.some(t => t.id === 'onFinishFailed'));
    assert.ok(STATE_ACTION_IDS.has('submit-form') && STATE_ACTION_IDS.has('reset-form'));
    const [it] = normalizeInteractions([{ id: 'ix', trigger: 'onClick', actions: [{ type: 'submit-form' }, { type: 'reset-form' }] }]);
    assert.deepEqual(it.actions.map(a => a.type), ['submit-form', 'reset-form']);
});

test('the outcome of a submit is onFinish when valid, onFinishFailed when not; $formValid and $isDirty are readable in conditions', () => {
    const fields = [{ id: 'a', label: 'Email', rules: { required: true }, value: '' }];
    assert.equal(outcomeOf(submitForm(fields)), 'onFinishFailed');
    assert.equal(outcomeOf(submitForm([{ ...fields[0], value: 'x' }])), 'onFinish');
    assert.ok(BUILTINS.some(b => b.id === '$formValid') && BUILTINS.some(b => b.id === '$isDirty'));
});

test('reset and dirty: a reset brings the initial values back; a changed field makes the form dirty', () => {
    const f = [{ id: 'a', label: 'Name', rules: {}, value: 'changed', initial: 'Ana' }];
    assert.equal(isDirty(f), true);
    assert.equal(resetForm(f)[0].value, 'Ana');
});

test('Has form keeps the names left out (a list of strings), and drops anything else', () => {
    assert.deepEqual(normalizeConfig('has-form', { exclude: ['Note', '', 3] }), { exclude: ['Note', '3'] });
    assert.deepEqual(normalizeConfig('has-form', {}), { exclude: [] });
});

test('a rule condition reads $isDirty and $formValid as the submit set them (regression: they were not mapped)', async () => {
    const { createEvalCtx, cleanState, testCondition } = await import('../src/index.js');
    const ev = createEvalCtx(cleanState({ variables: [], derived: [] }));
    ev.setExtra('isDirty', false);
    ev.setExtra('formValid', true);
    const notDirty = { op: 'compare', cmp: 'eq', a: { op: 'var', ref: '$isDirty' }, b: { op: 'value', value: false } };
    const valid = { op: 'compare', cmp: 'eq', a: { op: 'var', ref: '$formValid' }, b: { op: 'value', value: true } };
    assert.equal(testCondition(notDirty, ev.env()).value, true);
    assert.equal(testCondition(valid, ev.env()).value, true);
    ev.setExtra('isDirty', true);
    assert.equal(testCondition(notDirty, ev.env()).value, false);
});
