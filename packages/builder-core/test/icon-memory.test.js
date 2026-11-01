import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { setInstanceValue } from '../src/behavior-engine/panel.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { iconSlotBindings } from '../src/behavior-engine/icon-slot.js';

// The icon memory rules. Button moves its icon between a start and an end slot by its placement; Input has two switches, each with its
// own icon and text, that never move: each one is remembered while its switch is off.
const CASES = [
    { tid: 'button', start: 'iconStart', end: 'iconEnd', first: 'icon', second: 'iconEnd' },
];
const master = tid => ({ id: 'm', name: 'Master', type: 'frame', isInstance: false, behavior: { version: 2, templateId: tid, variables: {} } });
const inst = (props = {}) => ({ id: 'i1', name: 'Instance', type: 'frame', isInstance: true, sourceId: 'm', behavior: { version: 2, props } });
const tree = [{ id: 't', type: 'text' }];
const synced = (tid, props, children = []) => planInstanceAnatomy({ binding: master(tid).behavior, masterRoot: { isAutoLayout: true }, masterTree: tree, stored: props, children });
const names = { colour: 'fg', disabledColour: 'fg-disabled', size: 'icon-size' };

test('[input] each switch keeps its icon and text while off, and restores them when it is turned on again', () => {
    const on = inst({ hasPrefix: true, prefixIcon: 'check', prefixText: 'Rp' });
    const off = setInstanceValue(on, master('input'), 'hasPrefix', false);
    assert.equal(off.props.prefixIcon, 'check');
    assert.equal(off.props.prefixText, 'Rp');
    assert.deepEqual(synced('input', off.props, [{ id: 's', slot: 'prefix', component: 'check' }]).ops, [{ op: 'remove', id: 's' }]);
    const back = setInstanceValue({ ...inst(), behavior: off }, master('input'), 'hasPrefix', true);
    assert.deepEqual(synced('input', back.props, []).ops, [{ op: 'insert', slot: 'prefix', index: 0, component: 'check' }]);
    assert.equal(back.props.prefixText, 'Rp');
});

test('[input] the suffix switch does not touch the prefix', () => {
    const both = inst({ hasPrefix: true, prefixIcon: 'check', hasSuffix: true, suffixIcon: 'arrow' });
    const suffixOff = setInstanceValue(both, master('input'), 'hasSuffix', false);
    assert.equal(suffixOff.props.hasPrefix, true);
    assert.equal(suffixOff.props.prefixIcon, 'check');
    assert.equal(suffixOff.props.suffixIcon, 'arrow');
});

test('turning hasIcon off keeps the chosen icon in the file; turning it on restores and rebinds it', () => {
    const off = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'start', icon: 'check' }), master('button'), 'hasIcon', false);
    assert.equal(off.props.icon, 'check');
    assert.deepEqual(synced('button', off.props, [{ id: 's', slot: 'iconStart', component: 'check' }]).ops, [{ op: 'remove', id: 's' }]);
    const saved = JSON.parse(JSON.stringify({ behavior: off.props }));
    assert.equal(saved.behavior.icon, 'check');
    const back = setInstanceValue({ ...inst(), behavior: off }, master('button'), 'hasIcon', true);
    const plan = synced('button', back.props, []);
    assert.deepEqual(plan.ops, [{ op: 'insert', slot: 'iconStart', index: 0, component: 'check' }]);
    const bound = iconSlotBindings({ fg: 'v-fg', fgDisabled: 'v-fg-disabled', size: 's-iconSize', disabled: false, names, layers: [{ id: 'new', fillIndexes: [], stroke: false }] });
    assert.deepEqual(bound.slot, { w: 's-iconSize', h: 's-iconSize' });
    assert.deepEqual(bound.missing, []);
});

for (const { tid, start, end, first, second } of CASES) {
    test(`[${tid}] start to end moves the icon to the new slot and clears the old one`, () => {
        const next = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'start', [first]: 'check' }), master(tid), 'iconPlacement', 'end');
        assert.equal(next.props[second], 'check');
        const plan = synced(tid, next.props, [{ id: 's', slot: start, component: 'check' }]);
        assert.ok(plan.ops.some(o => o.op === 'remove' && o.id === 's'));
        assert.ok(plan.ops.some(o => o.op === 'insert' && o.slot === end && o.component === 'check'));
    });

    test(`[${tid}] start to both duplicates the shown icon only where the other side has none`, () => {
        const dup = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'start', [first]: 'check' }), master(tid), 'iconPlacement', 'both');
        assert.equal(dup.props[second], 'check');
        const kept = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'start', [first]: 'check', [second]: 'other' }), master(tid), 'iconPlacement', 'both');
        assert.equal(kept.props[second], 'other');
    });

    test(`[${tid}] both to start keeps the start icon and remembers the end icon for the way back`, () => {
        const toStart = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'both', [first]: 'check', [second]: 'other' }), master(tid), 'iconPlacement', 'start');
        assert.equal(toStart.props[first], 'check');
        assert.equal(toStart.props[second], 'other');
        const back = setInstanceValue({ ...inst(), behavior: toStart }, master(tid), 'iconPlacement', 'both');
        const plan = synced(tid, back.props, [{ id: 's', slot: start, component: 'check' }]);
        assert.ok(plan.ops.some(o => o.op === 'insert' && o.slot === end && o.component === 'other'));
    });

    test(`[${tid}] moving to an empty slot needs no picker: it shows the placeholder`, () => {
        const next = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'start' }), master(tid), 'iconPlacement', 'end');
        assert.equal(next.props[second], null);
        const plan = synced(tid, next.props, []);
        assert.ok(plan.ops.some(o => o.op === 'insert' && o.slot === end && !('component' in o)));
    });
}
