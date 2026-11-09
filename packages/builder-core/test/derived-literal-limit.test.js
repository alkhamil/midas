// A derived boolean may compare its value with a literal number as well as with another prop: `{ value: 'count', limit: 0, cmp: 'lte' }` holds while
// the count is zero or below. An empty or missing value never holds (no number to compare). A prop-named limit keeps its behaviour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { BOXY } from './helpers/box-template.js';

/** BOXY with a count and a derived boolean that holds while the count is zero. */
const COUNTED = (() => {
    const t = structuredClone(BOXY);
    t.id = 'counted';
    t.name = 'Counted';
    t.props.count = { source: 'literal', type: 'number', default: 0 };
    t.props.empty = { source: 'literal', type: 'boolean', default: false, derived: { value: 'count', limit: 0, cmp: 'lte' } };
    return t;
})();

test('the schema accepts a literal limit on a derived boolean', () => {
    assert.deepEqual(validateTemplateSchema(COUNTED), []);
});

test('the derived boolean holds at zero and below, never above, and never for an empty count', () => {
    const empty = count => resolveProps(COUNTED, { count }).empty;
    assert.equal(empty(0), true);
    assert.equal(empty(-1), true);
    assert.equal(empty(3), false);
    assert.equal(empty(null), false);
    assert.equal(empty(undefined), true, 'a missing count is its default, zero');
});

test('a prop-named limit still reads that prop', () => {
    const t = structuredClone(COUNTED);
    t.props.cap = { source: 'literal', type: 'number', default: 5 };
    t.props.near = { source: 'literal', type: 'boolean', default: false, derived: { value: 'count', limit: 'cap', cmp: 'gte' } };
    assert.deepEqual(validateTemplateSchema(t), []);
    assert.equal(resolveProps(t, { count: 5, cap: 5 }).near, true);
    assert.equal(resolveProps(t, { count: 4, cap: 5 }).near, false);
});
