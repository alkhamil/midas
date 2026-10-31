import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iconPickerEntries, iconPageRank, iconEntryMatches, iconSlotBindings, iconSlotTargets, isIconSlotVarKey, missingIconVariable } from '../src/behavior-engine/icon-slot.js';
import { BUTTON } from '../src/templates/button.js';

const names = { colour: 'button/fg', disabledColour: 'button/fg-disabled', size: 'button/icon-size' };
const vars = { fg: 'v-fg', fgDisabled: 'v-fg-disabled', size: 'v-icon-size', names };

test('the icon variables are named from the template: its group and its icon tokens, with the dimension that holds them', () => {
    assert.deepEqual(iconSlotTargets(BUTTON, 'iconStart'), {
        colour: { name: 'button/fg', dimension: 'variant' },
        disabledColour: { name: 'button/fg-disabled', dimension: 'variant' },
        size: { name: 'button/icon-size', dimension: 'size' },
    });
});

test('the slot binds its width and height to the icon size variable', () => {
    assert.deepEqual(iconSlotBindings({ ...vars, disabled: false, layers: [] }).slot, { w: 'v-icon-size', h: 'v-icon-size' });
});

test('every visible fill of an icon layer binds to the foreground colour, by fill index', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: false, layers: [{ id: 'p1', fillIndexes: [0, 2], stroke: false }] });
    assert.deepEqual(layers, [{ id: 'p1', vars: { 'fills.0': 'v-fg', 'fills.2': 'v-fg' } }]);
});

test('a layer with no fill but a stroke binds its stroke to the foreground colour', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: false, layers: [{ id: 'p2', fillIndexes: [], stroke: true }] });
    assert.deepEqual(layers, [{ id: 'p2', vars: { stroke: 'v-fg' } }]);
});

test('a layer with neither a fill nor a stroke binds nothing', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: false, layers: [{ id: 'p3', fillIndexes: [], stroke: false }] });
    assert.deepEqual(layers, [{ id: 'p3', vars: {} }]);
});

test('disabled switches the icon colour to the disabled foreground', () => {
    const { layers } = iconSlotBindings({ ...vars, disabled: true, layers: [{ id: 'p1', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(layers, [{ id: 'p1', vars: { 'fills.0': 'v-fg-disabled' } }]);
});

test('a missing variable is reported and nothing is guessed in its place', () => {
    const result = iconSlotBindings({ fg: null, fgDisabled: 'v-fg-disabled', size: null, disabled: false, names, layers: [{ id: 'p1', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(result.missing, ['button/fg', 'button/icon-size']);
    assert.deepEqual(result.slot, {});
    assert.deepEqual(result.layers, [{ id: 'p1', vars: {} }]);
});

test('disabled with no disabled foreground variable is reported, never the plain foreground', () => {
    const result = iconSlotBindings({ fg: 'v-fg', fgDisabled: null, size: 'v-icon-size', disabled: true, names, layers: [{ id: 'p1', fillIndexes: [0], stroke: false }] });
    assert.deepEqual(result.missing, ['button/fg-disabled']);
    assert.deepEqual(result.layers, [{ id: 'p1', vars: {} }]);
});

test('the keys the icon slot owns are fills by index, stroke, and the slot size', () => {
    assert.equal(isIconSlotVarKey('fills.0'), true);
    assert.equal(isIconSlotVarKey('fills.12'), true);
    assert.equal(isIconSlotVarKey('stroke'), true);
    assert.equal(isIconSlotVarKey('w'), true);
    assert.equal(isIconSlotVarKey('h'), true);
    assert.equal(isIconSlotVarKey('fill'), false);
    assert.equal(isIconSlotVarKey('radius'), false);
});

test('a missing icon variable is named with the collection it was searched in and the mode of the instance', () => {
    assert.equal(
        missingIconVariable({ name: 'button/icon-size', collectionName: 'Size', modeName: 'Small' }),
        'button/icon-size in the Size collection (mode Small)',
    );
});

const comp = (id, name, extra = {}) => ({ id, name, type: 'frame', component: true, ...extra });
const iconPages = () => [
    { id: 'p1', name: 'Screens', nodes: [comp('eye', 'eye'), comp('card', 'card')] },
    { id: 'p2', name: 'Icons', nodes: [comp('check', 'check'), comp('nested', 'arrows/Arrow Left')] },
    { id: 'p3', name: 'Flows', nodes: [{ id: 'plain', name: 'plain', type: 'frame' }] },
];

test('the picker lists every component on every page: no naming rule, no flag', () => {
    const entries = iconPickerEntries(iconPages());
    assert.deepEqual(entries.map(e => e.id).sort(), ['card', 'check', 'eye', 'nested']);
    const eye = entries.find(e => e.id === 'eye');
    assert.equal(eye.page, 'Screens');
    assert.deepEqual(eye.ids, new Set(['eye']));
});

test('entries from a page named Icon or Icons list first, under their own group', () => {
    const entries = iconPickerEntries([...iconPages(), { id: 'p4', name: 'Icon', nodes: [comp('star', 'star')] }]);
    assert.deepEqual(entries.map(e => e.page), ['Icons', 'Icons', 'Icon', 'Screens', 'Screens']);
    assert.equal(entries[0].page, 'Icons');
    const nested = entries.find(e => e.id === 'nested');
    assert.equal(nested.group, 'arrows');
    assert.deepEqual(nested.path, ['arrows']);
    assert.equal(nested.leaf, 'Arrow Left');
});

test('a component set lists once, starting from its default variant', () => {
    const pages = [{
        id: 'p1', name: 'Icons', nodes: [
            { id: 'set', name: 'arrows', type: 'frame', componentSet: true, valueOrder: { style: ['line', 'solid'] } },
            comp('v1', 'arrow', { parentId: 'set', variant: { style: 'solid' } }),
            comp('v2', 'arrow', { parentId: 'set', variant: { style: 'line' } }),
        ],
    }];
    const entries = iconPickerEntries(pages);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, 'v2');
    assert.deepEqual(entries[0].ids, new Set(['v1', 'v2']));
});

test('soft-deleted components are skipped, on the node and on the set', () => {
    const pages = [{
        id: 'p1', name: 'Icons', nodes: [
            comp('gone', 'gone', { softDeleted: true }),
            { id: 'set', name: 'old', type: 'frame', componentSet: true, softDeleted: true },
            comp('v1', 'old icon', { parentId: 'set' }),
            comp('kept', 'kept'),
        ],
    }];
    assert.deepEqual(iconPickerEntries(pages).map(e => e.id), ['kept']);
});

test('a page that arrives later is listed too', () => {
    const pages = iconPages();
    assert.ok(!iconPickerEntries(pages).some(e => e.id === 'late'));
    pages.push({ id: 'p9', name: 'Late', nodes: [comp('late', 'late icon')] });
    assert.ok(iconPickerEntries(pages).some(e => e.id === 'late'));
});

test('no components in the file lists none', () => {
    assert.deepEqual(iconPickerEntries([]), []);
    assert.deepEqual(iconPickerEntries([{ id: 'p', name: 'Empty', nodes: [] }]), []);
});

test('search matches a substring of the group and leaf name', () => {
    assert.equal(iconEntryMatches({ group: 'arrows', leaf: 'Arrow Left' }, 'arrow'), true);
    assert.equal(iconEntryMatches({ group: 'arrows', leaf: 'Arrow Left' }, 'LEFT'), true);
    assert.equal(iconEntryMatches({ group: '', leaf: 'eye' }, 'eye'), true);
    assert.equal(iconEntryMatches({ group: '', leaf: 'eye' }, 'check'), false);
    assert.equal(iconEntryMatches({ group: '', leaf: 'eye' }, ''), true);
});

test('only a page named Icon or Icons ranks first', () => {
    assert.equal(iconPageRank('Icons'), 0);
    assert.equal(iconPageRank('Icon'), 0);
    assert.equal(iconPageRank('Screens'), 1);
    assert.equal(iconPageRank('My Icons'), 1);
});
