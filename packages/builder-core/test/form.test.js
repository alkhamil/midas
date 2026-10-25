// Form container: one validation pass, the first invalid field, excluded fields, outcome events, dirty state, reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import { submitForm, outcomeOf, isDirty, resetForm } from '../src/index.js';

const login = (over = {}) => [
    { id: 'user', label: 'Email', rules: { required: true, type: 'email' }, value: '', initial: '', ...over.user },
    { id: 'pass', label: 'Password', rules: { required: true, min: 8 }, value: '', initial: '', ...over.pass },
];

test('a submit checks every included field in one pass and collects all the errors', () => {
    const r = submitForm(login());
    assert.equal(r.valid, false);
    assert.deepEqual(Object.keys(r.errors), ['user', 'pass']);
    assert.equal(r.firstInvalid, 'user');
    assert.equal(outcomeOf(r), 'onFinishFailed');
});

test('the first invalid field (in form order) is the one that gets focus', () => {
    const r = submitForm(login({ user: { value: 'ana@x.io' }, pass: { value: 'short' } }));
    assert.equal(r.firstInvalid, 'pass');
    assert.deepEqual(Object.keys(r.errors), ['pass']);
});

test('a valid form gives onFinish and no errors', () => {
    const r = submitForm(login({ user: { value: 'ana@x.io' }, pass: { value: 'longenough' } }));
    assert.deepEqual(r, { valid: true, errors: {}, firstInvalid: null });
    assert.equal(outcomeOf(r), 'onFinish');
});

test('an excluded field is not checked', () => {
    const fields = login({ pass: { value: '', include: false } }).map(f => (f.id === 'user' ? { ...f, value: 'ana@x.io' } : f));
    assert.equal(submitForm(fields).valid, true);
});

test('dirty: a field that differs from its initial value; reset brings the initial values back and clears errors', () => {
    const fields = login({ user: { initial: 'ana@x.io', value: 'ana@x.io' }, pass: { initial: '', value: '' } });
    assert.equal(isDirty(fields), false);
    const edited = fields.map(f => (f.id === 'pass' ? { ...f, value: 'newpassword' } : f));
    assert.equal(isDirty(edited), true);
    const back = resetForm(edited.map(f => ({ ...f, error: 'x' })));
    assert.equal(isDirty(back), false);
    assert.equal(back.find(f => f.id === 'pass').value, '');
    assert.equal(back.find(f => f.id === 'pass').error, undefined);
});
