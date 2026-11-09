// An overflow text is derived from a count and a limit: above the limit it reads `<limit>+` (Badge's 99+), else the count. It is never stored: the
// canvas, Play and the export all compute it from the props. The counter's label is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overflowLabel, counterLabel, partWrites } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { BOXY, modelFor } from './helpers/box-template.js';

test('the label is the count, or the limit with a plus once the count is above it', () => {
    assert.equal(overflowLabel(12, 99), '12');
    assert.equal(overflowLabel(99, 99), '99', 'at the limit it is still the count');
    assert.equal(overflowLabel(100, 99), '99+');
    assert.equal(overflowLabel(1000, 99), '99+');
    assert.equal(overflowLabel(null, 99), '', 'no count, no text');
});

test('the counter label keeps its output', () => {
    assert.equal(counterLabel('abc', 10), '3 / 10');
    assert.equal(counterLabel('abc', undefined), '3');
});

/** BOXY with its label derived as an overflow: the label shows the count, or the limit and a plus. The label takes no text prop of its own. */
const OVERFLOWING = (() => {
    const t = structuredClone(BOXY);
    t.id = 'overflowy';
    t.name = 'Overflowy';
    t.props.count = { source: 'literal', type: 'number', default: 0 };
    t.props.overflowCount = { source: 'literal', type: 'number', default: 99 };
    delete t.props.label.node;
    t.anatomy = t.anatomy.map(slot => (slot.id === 'label' ? { ...slot, shownWhen: undefined, optional: false, managed: false, text: { overflow: { value: 'count', limit: 'overflowCount' } } } : slot));
    return t;
})();

test('the schema accepts an overflow text', () => {
    assert.deepEqual(validateTemplateSchema(OVERFLOWING), []);
});

test('the canvas writes the derived label to its node, never a stored value', () => {
    const text = count => partWrites(OVERFLOWING, { count, overflowCount: 99 }).find(w => w.key === 'label' && w.field === 'text')?.value;
    assert.equal(text(120), '99+');
    assert.equal(text(7), '7');
});

test('the export writes the derived label into the span, as an expression of the props', () => {
    const model = modelFor(OVERFLOWING);
    const out = generateComponent(model.template, model.binding, model.variables, 'Overflowy', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Overflowy.jsx'], /Number\(count\) > Number\(overflowCount\) \? `\$\{overflowCount\}\+` : \(count \?\? ""\)/);
    assert.doesNotMatch(out.files['Overflowy.jsx'], /\{label\}/, 'the label is not a stored text prop');
});
