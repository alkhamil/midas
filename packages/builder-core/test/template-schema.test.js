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
