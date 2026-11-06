// An instance of a master is made with the managed text layers its props ask for (docs/input-managed-text.md, step 4): the master holds none,
// the instance copy makes one per wanted slot, as a text layer carrying the prop's text, in anatomy order. The generator never builds one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON } from '../src/templates/button.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf, slotShown, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };

/** Button plus a managed text slot `note` after the label, shown while the `note` prop is not empty. */
const TEMPLATE = (() => {
    const t = structuredClone(BUTTON);
    t.id = 'notebutton'; t.name = 'NoteButton';
    t.anatomy.push({ id: 'note', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'note', empty: false } });
    t.props.note = { source: 'literal', type: 'string', default: '', node: { key: 'note', field: 'text' } };
    t.display.note = { fill: 'fg', typography: 'labelTypography' };
    return t;
})();

function master() {
    const frame = { id: 'm', name: 'NoteButton', type: 'frame', parentId: null, fills: [], x: 0, y: 0 };
    const { created } = applyTemplateToFrame(TEMPLATE, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` });
    return { frame, created };
}
const instance = (m, props) => instanceOf(TEMPLATE, m.frame, m.created, props, { id: src => `i-${src}`, varModes: {} });

test('the schema is valid and the master holds no managed text layer', () => {
    assert.deepEqual(validateTemplateSchema(TEMPLATE), []);
    const m = master();
    assert.ok(!m.created.some(n => n.name === 'note' || n.behavior?.slot === 'note'), 'the generator makes no layer for a managed text slot');
    assert.equal(layerSpecsOf(TEMPLATE).find(s => s.key === 'note').type, 'text');
});

test('a fresh instance has no managed text layer; one whose prop is set has a text layer carrying that text', () => {
    const m = master();
    assert.ok(!instance(m, {}).some(n => n.behavior?.slot === 'note'));
    const note = instance(m, { note: 'new' }).find(n => n.behavior?.slot === 'note');
    assert.ok(note, 'made on the instance');
    assert.equal(note.type, 'text');
    assert.equal(note.text, 'new');
    assert.equal(note.name, 'note');
    assert.equal(note.visible, true);
    assert.equal(note.parentId, 'i-m');
    assert.equal(note.sourceId, undefined, 'it is not a copy of a master layer');
});

test('the managed text layer sits after the label, where the anatomy puts it', () => {
    const names = instance(master(), { note: 'x' }).slice(1).map(n => n.name);
    assert.ok(names.indexOf('note') > names.indexOf('label'), names.join());
});

test('slotShown follows the slot condition for a managed text slot, and ignores icon defs', () => {
    assert.equal(slotShown(TEMPLATE, 'note', { note: 'x' }), true);
    assert.equal(slotShown(TEMPLATE, 'note', { note: '' }), false);
});
