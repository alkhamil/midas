// The Input's Behavior panel model: Has Prefix and Has Suffix switches, then for each side its Text or Icon kind (a segmented control) and
// the content the kind picks: a text field, or an icon swap. All of a side's rows sit under Slots. A side that is off lists only its switch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instancePanel, masterPanel } from '../src/behavior-engine/panel.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const model = inputModel();
const master = { id: 'm', name: 'Input', type: 'frame', isInstance: false, behavior: { version: 2, templateId: 'input', variables: model.binding.variables } };
const instance = props => ({ id: 'i', name: 'Field', type: 'frame', isInstance: true, sourceId: 'm', behavior: { version: 2, props } });
const modes = { variant: null, status: null, size: null };
const rowsOf = props => instancePanel(instance(props), master, model.collections, modes).rows;
const names = rows => rows.filter(r => r.kind !== 'variable').map(r => r.prop);
const row = (rows, prop) => rows.find(r => r.prop === prop);

test('both sides off: the Slots list only the two switches, the clear and the count belong to the value', () => {
    const rows = rowsOf({});
    const slotRows = rows.filter(r => r.slot).map(r => r.prop);
    assert.deepEqual(slotRows, ['allowClear', 'hasPrefix', 'hasSuffix']);
    for (const gone of ['prefixKind', 'prefixText', 'prefixIcon', 'suffixKind', 'suffixText', 'suffixIcon', 'hasIcon', 'iconPlacement', 'icon', 'iconEnd']) assert.equal(row(rows, gone), undefined, `${gone} is not listed`);
});

test('a prefix with the Text kind lists its kind (segmented, Text and Icon) and its text field, and no icon row', () => {
    const rows = rowsOf({ hasPrefix: true, prefixText: 'Rp' });
    assert.deepEqual(names(rows).filter(n => n.startsWith('prefix') || n === 'hasPrefix'), ['hasPrefix', 'prefixKind', 'prefixText']);
    const kind = row(rows, 'prefixKind');
    assert.deepEqual([kind.type, kind.control, kind.value, kind.options.map(o => o.id)], ['enum', 'segmented', 'text', ['text', 'icon']]);
    assert.equal(row(rows, 'prefixText').value, 'Rp');
    for (const prop of ['hasPrefix', 'prefixKind', 'prefixText']) assert.equal(row(rows, prop).slot, true, `${prop} is a slot row`);
});

test('a prefix with the Icon kind lists an icon swap row labelled Prefix icon, and no text field', () => {
    const rows = rowsOf({ hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check', prefixText: 'Rp' });
    assert.deepEqual(names(rows).filter(n => n.startsWith('prefix') || n === 'hasPrefix'), ['hasPrefix', 'prefixKind', 'prefixIcon']);
    const icon = row(rows, 'prefixIcon');
    assert.deepEqual([icon.kind, icon.slot, icon.label, icon.value], ['icon', true, 'Prefix icon', 'check']);
});

test('the suffix has the same rows, and the two sides are independent', () => {
    const rows = rowsOf({ hasPrefix: true, hasSuffix: true, suffixKind: 'icon', suffixIcon: 'check' });
    assert.deepEqual(names(rows).filter(n => /^(has)?(prefix|suffix)/i.test(n)), ['hasPrefix', 'prefixKind', 'prefixText', 'hasSuffix', 'suffixKind', 'suffixIcon']);
    assert.equal(row(rows, 'suffixIcon').label, 'Suffix icon');
});

test('Allow Clear lists its clear icon row, and Show Count its switch', () => {
    const rows = rowsOf({ allowClear: true, showCount: true });
    assert.equal(row(rows, 'clearIcon').label, 'Clear icon');
    assert.equal(row(rows, 'showCount').type, 'boolean');
});

test('a switch needs the Variant and Size collections: it is disabled, naming them, while the master leaves them unbound', () => {
    const unbound = { ...master, behavior: { ...master.behavior, variables: { variant: null, status: null, size: null } } };
    const rows = instancePanel(instance({}), unbound, model.collections, modes).rows;
    assert.equal(row(rows, 'hasPrefix').disabled, true);
    assert.match(row(rows, 'hasPrefix').hint, /Bind .*collection/);
});

test('the master contract keeps the side switches, kinds, texts and icons out: they are the instance\'s choices, as Button\'s icon switch is', () => {
    const contract = masterPanel(master, model.collections).contract.props.map(p => p.name);
    for (const prop of ['hasPrefix', 'prefixKind', 'prefixText', 'prefixIcon', 'hasSuffix', 'suffixKind', 'suffixText', 'suffixIcon', 'hasIcon', 'iconPlacement']) assert.ok(!contract.includes(prop), `${prop} is not in the contract`);
    for (const prop of ['value', 'placeholder', 'kind', 'maxLength', 'disabled']) assert.ok(contract.includes(prop), `${prop} is in the contract`);
});
