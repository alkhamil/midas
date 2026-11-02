import test from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { setInstanceValue } from '../src/behavior-engine/panel.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { iconSlotBindings } from '../src/behavior-engine/icon-slot.js';

// The icon memory rules. Button has a start and an end icon placed by one switch (hasIcon, iconPlacement). Input has a prefix and a suffix,
// each with its own switch and a Text or Icon kind; its text and its icon are remembered per side (see the [input] tests).
const CASES = [
    { tid: 'button', start: 'iconStart', end: 'iconEnd', first: 'icon', second: 'iconEnd' },
];
const master = tid => ({ id: 'm', name: 'Master', type: 'frame', isInstance: false, behavior: { version: 2, templateId: tid, variables: {} } });
const inst = (props = {}) => ({ id: 'i1', name: 'Instance', type: 'frame', isInstance: true, sourceId: 'm', behavior: { version: 2, props } });
const tree = [{ id: 't', type: 'text' }];
const synced = (tid, props, children = []) => planInstanceAnatomy({ binding: master(tid).behavior, masterRoot: { isAutoLayout: true }, masterTree: tree, stored: props, children });
const names = { colour: 'fg', disabledColour: 'fg-disabled', size: 'icon-size' };

test('[input] a text switch off keeps its text, and it is there again when the switch is on', () => {
    const off = setInstanceValue(inst({ hasPrefix: true, prefixText: 'Rp' }), master('input'), 'hasPrefix', false);
    assert.equal(off.props.prefixText, 'Rp');
    const back = setInstanceValue({ ...inst(), behavior: off }, master('input'), 'hasPrefix', true);
    assert.equal(back.props.prefixText, 'Rp');
});

test('[input] the suffix text switch does not touch the prefix text', () => {
    const both = inst({ hasPrefix: true, prefixText: 'Rp', hasSuffix: true, suffixText: '.com' });
    const suffixOff = setInstanceValue(both, master('input'), 'hasSuffix', false);
    assert.equal(suffixOff.props.hasPrefix, true);
    assert.equal(suffixOff.props.prefixText, 'Rp');
    assert.equal(suffixOff.props.suffixText, '.com');
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

    test(`[${tid}] moving to an empty slot needs no picker: it shows the placeholder`, () => {
        const next = setInstanceValue(inst({ hasIcon: true, iconPlacement: 'start' }), master(tid), 'iconPlacement', 'end');
        assert.equal(next.props[second], null);
        const plan = synced(tid, next.props, []);
        assert.ok(plan.ops.some(o => o.op === 'insert' && o.slot === end && !('component' in o)));
    });
}

const input = master('input');
const asInst = behavior => ({ ...inst(), behavior });

for (const [side, Side, slot] of [['prefix', 'Prefix', 'prefixIcon'], ['suffix', 'Suffix', 'suffixIcon']]) {
    test(`[input] the ${side} icon is kept when the kind is Text, and restored and rebuilt when it is Icon again`, () => {
        const text = setInstanceValue(inst({ [`has${Side}`]: true, [`${side}Kind`]: 'icon', [slot]: 'check' }), input, `${side}Kind`, 'text');
        assert.equal(text.props[slot], 'check');
        assert.deepEqual(synced('input', text.props, [{ id: 's', slot, component: 'check' }]).ops, [{ op: 'remove', id: 's' }]);
        const back = setInstanceValue(asInst(text), input, `${side}Kind`, 'icon');
        assert.equal(back.props[slot], 'check');
        const plan = synced('input', back.props, []).ops;
        assert.deepEqual(plan.map(({ op, slot: s, component }) => ({ op, slot: s, component })), [{ op: 'insert', slot, component: 'check' }]);
    });

    test(`[input] the ${side} text is kept when the kind is Icon, and shown again with Text`, () => {
        const icon = setInstanceValue(inst({ [`has${Side}`]: true, [`${side}Text`]: 'Rp' }), input, `${side}Kind`, 'icon');
        assert.equal(icon.props[`${side}Text`], 'Rp');
        const back = setInstanceValue(asInst(icon), input, `${side}Kind`, 'text');
        assert.equal(back.props[`${side}Text`], 'Rp');
    });

    test(`[input] the ${side} switch off keeps its kind's content, and no icon layer is wanted while it is off`, () => {
        const off = setInstanceValue(inst({ [`has${Side}`]: true, [`${side}Kind`]: 'icon', [slot]: 'check' }), input, `has${Side}`, false);
        assert.equal(off.props[slot], 'check');
        assert.equal(off.props[`${side}Kind`], 'icon', 'the kind is kept too');
        assert.deepEqual(synced('input', off.props, [{ id: 's', slot, component: 'check' }]).ops, [{ op: 'remove', id: 's' }]);
        const on = setInstanceValue(asInst(off), input, `has${Side}`, true);
        assert.equal(on.props[slot], 'check');
    });
}

test('[input] the kind and content of one side do not touch the other side', () => {
    const both = inst({ hasPrefix: true, prefixKind: 'icon', prefixIcon: 'check', hasSuffix: true, suffixText: '.com' });
    const next = setInstanceValue(both, input, 'prefixKind', 'text');
    assert.equal(next.props.suffixText, '.com');
    assert.equal(next.props.hasSuffix, true);
    assert.equal(next.props.prefixIcon, 'check');
});

test('[input] a kind is not stored while its switch is off', () => {
    assert.throws(() => setInstanceValue(inst({}), input, 'prefixKind', 'icon'), /hidden by visibleIf/);
});
