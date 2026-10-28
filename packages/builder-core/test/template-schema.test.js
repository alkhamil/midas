import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BUTTON } from '../src/templates/button.js';

const clone = o => structuredClone(o);

test('the Button schema is valid', () => {
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
});

test('a schema without a required text slot is rejected', () => {
    const bad = clone(BUTTON);
    bad.anatomy = bad.anatomy.filter(s => s.kind !== 'text');
    assert.match(validateTemplateSchema(bad).join('\n'), /text slot/);
});

test('duplicate anatomy slot ids are rejected', () => {
    const bad = clone(BUTTON);
    bad.anatomy.push({ id: 'label', kind: 'text' });
    assert.match(validateTemplateSchema(bad).join('\n'), /duplicate anatomy slot "label"/);
});

test('visibleIf must name a boolean or enum prop that exists', () => {
    const bad = clone(BUTTON);
    bad.props.icon.visibleIf = { prop: 'missing', is: true };
    assert.match(validateTemplateSchema(bad).join('\n'), /visibleIf refers to unknown prop "missing"/);
});

test('a variable prop must name its collection', () => {
    const bad = clone(BUTTON);
    bad.props.variant.collection = '';
    assert.match(validateTemplateSchema(bad).join('\n'), /variant.*collection/);
});

test('an enum default must be one of its options', () => {
    const bad = clone(BUTTON);
    bad.props.iconPlacement.default = 'top';
    assert.match(validateTemplateSchema(bad).join('\n'), /iconPlacement.*default "top"/);
});

test('a token group must draw from a variable prop of the same name', () => {
    const bad = clone(BUTTON);
    bad.tokens.fromWidth = bad.tokens.fromSize;
    delete bad.tokens.fromSize;
    assert.match(validateTemplateSchema(bad).join('\n'), /tokens group "fromWidth" has no variable prop "Width"/);
});

test('a state token map must name only states of the template', () => {
    const bad = clone(BUTTON);
    bad.stateTokens = { pressed: { bg: 'bg-hover' } };
    assert.match(validateTemplateSchema(bad).join('\n'), /stateTokens names unknown state "pressed"/);
});

test('a state token map must override a token of the template, and name a token of the template', () => {
    const bad = clone(BUTTON);
    bad.stateTokens = { hover: { width: 'bg-hover' } };
    assert.match(validateTemplateSchema(bad).join('\n'), /stateTokens overrides "width", which is not a token/);
    const missing = clone(BUTTON);
    missing.stateTokens = { hover: { bg: 'bg-nope' } };
    assert.match(validateTemplateSchema(missing).join('\n'), /stateTokens maps "bg" to "bg-nope", which is not a token/);
});
