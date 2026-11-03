// Applying a pasted Custom schema to a document: the text is parsed and held to the Custom rules, and the result is the document's next Behavior key (the
// templates it had plus this one), or the problems and nothing else. Editing an applied schema is refused while it would drop a prop that instances
// hold a value for, with the number of instances.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORM_ITEM } from '../src/templates/form-item.js';
import { BEHAVIOR_DATA_VERSION } from '../src/behavior-engine/data.js';
import { applyCustomSchema } from '../src/behavior-engine/custom-templates.js';

const custom = (id = 'custom-card', over = {}) => ({ ...structuredClone(FORM_ITEM), id, name: 'Card', ...over });
const text = schema => JSON.stringify(schema);
const behaviorOf = (...schemas) => ({ version: BEHAVIOR_DATA_VERSION, templates: Object.fromEntries(schemas.map(s => [s.id, s])) });

test('a valid schema becomes the next Behavior key: the templates the document had, and this one', () => {
    const out = applyCustomSchema(text(custom('custom-b')), behaviorOf(custom('custom-a')), []);
    assert.deepEqual(out.problems, undefined);
    assert.equal(out.id, 'custom-b');
    assert.deepEqual(Object.keys(out.behavior.templates), ['custom-a', 'custom-b']);
    assert.equal(out.behavior.version, BEHAVIOR_DATA_VERSION);
    const first = applyCustomSchema(text(custom()), undefined, []);
    assert.deepEqual(Object.keys(first.behavior.templates), ['custom-card'], 'a document with no behavior data gets its first Custom template');
});

test('the same id replaces the template (an edit); the document it came from is not changed', () => {
    const before = behaviorOf(custom());
    const copy = structuredClone(before);
    const out = applyCustomSchema(text(custom('custom-card', { name: 'Renamed' })), before, []);
    assert.equal(out.behavior.templates['custom-card'].name, 'Renamed');
    assert.deepEqual(before, copy);
});

test('a problem returns the problems and no behavior: bad JSON, a bad id, a clash with a built-in, an unknown accepted template', () => {
    assert.match(applyCustomSchema('{', undefined, []).problems[0], /not valid JSON/);
    assert.equal(applyCustomSchema('{', undefined, []).behavior, undefined);
    assert.match(applyCustomSchema(text(custom('card')), undefined, []).problems.join('\n'), /must be custom-/);
    assert.match(applyCustomSchema(text(custom('custom-card', { slots: [{ id: 'body', name: 'Body', layout: 'vertical', accepts: ['select'] }] })), undefined, []).problems.join('\n'), /accepts "select"/);
});

test('an edit that drops a prop instances hold a value for is refused, with the instance count; a prop nobody set may go', () => {
    const withNote = custom('custom-card', { props: { ...FORM_ITEM.props, note: { source: 'literal', type: 'string', default: '' } } });
    const slimmer = custom();
    const held = [{ note: 'a' }, { note: 'b', label: 'x' }, { label: 'y' }].map(props => ({ templateId: 'custom-card', props }));
    const refused = applyCustomSchema(text(slimmer), behaviorOf(withNote), held);
    assert.deepEqual(refused.problems, ['prop "note" is removed, and 2 instances hold a value for it']);
    assert.equal(refused.behavior, undefined);
    assert.deepEqual(applyCustomSchema(text(slimmer), behaviorOf(withNote), [held[0]]).problems, ['prop "note" is removed, and 1 instance holds a value for it']);
    assert.equal(applyCustomSchema(text(slimmer), behaviorOf(withNote), [held[2]]).problems, undefined, 'nobody set it');
    assert.equal(applyCustomSchema(text(slimmer), behaviorOf(withNote), [{ templateId: 'button', props: { note: 'z' } }]).problems, undefined, 'instances of another template are not this template\'s');
});
