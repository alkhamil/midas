// A part on a side (the Button's spinner) is ordered against the label. A template with no label orders it against the root: a start part first, an end part last.
// Button and Input keep their order. The canvas (instanceOf), Play and the export read this one rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { sidedPartOrder, instanceOf } from '../src/behavior-engine/template-master.js';
import { BUTTON } from '../src/templates/button.js';

test('the layers of a template with no label order against the root: start side parts first, end side parts last', () => {
    const spinnerOf = side => ({ ...BUTTON, props: { ...BUTTON.props, iconPlacement: { ...BUTTON.props.iconPlacement, default: side } } });
    const spinner = { id: 's', name: 'spinner', type: 'ellipse', behavior: { version: 2, part: 'spinner' } };
    const icon = { id: 'i', name: 'icon', type: 'frame', behavior: { version: 2, slot: 'iconStart' } };
    const noLabel = { ...BUTTON, anatomy: BUTTON.anatomy.filter(s => s.id !== 'label') };
    assert.deepEqual(sidedPartOrder(noLabel, [icon, spinner], { iconPlacement: 'start' }), ['s', 'i']);
    assert.deepEqual(sidedPartOrder(noLabel, [spinner, icon], { iconPlacement: 'end' }), ['i', 's']);
    assert.deepEqual(sidedPartOrder(noLabel, [spinner, icon], { iconPlacement: 'end' }), sidedPartOrder(spinnerOf('end'), [spinner, icon], { iconPlacement: 'end' }), 'the same answer twice');
});

test('instanceOf and sidedPartOrder agree for a template with no label', () => {
    const noLabel = { ...BUTTON, props: Object.fromEntries(Object.entries(BUTTON.props).filter(([name]) => name !== 'label')), anatomy: [{ id: 'iconStart', kind: 'icon', optional: true, managed: true }, { id: 'iconEnd', kind: 'icon', optional: true, managed: true }] };
    const master = { id: 'm', name: 'M', type: 'frame', parentId: null, fills: [] };
    const sub = [{ id: 'sp', name: 'spinner', type: 'ellipse', parentId: 'm', behavior: { part: 'spinner' } }];
    for (const iconPlacement of ['start', 'end']) {
        const copies = instanceOf(noLabel, master, sub, { iconPlacement, loading: true }, { id: s => `i-${s}` }).slice(1);
        assert.deepEqual(copies.map(n => n.id), sidedPartOrder(noLabel, copies, { iconPlacement }), iconPlacement);
    }
});

test('Button keeps its order: the spinner before the label for start, after it for end, the icon slots on their own sides', () => {
    const master = { id: 'm', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const sub = [
        { id: 'sp', name: 'spinner', type: 'ellipse', parentId: 'm', behavior: { part: 'spinner' } },
        { id: 'lb', name: 'label', type: 'text', parentId: 'm', text: 'Button' },
    ];
    const names = (placement, loading) => instanceOf(BUTTON, master, sub, { hasIcon: true, iconPlacement: placement, loading }, { id: s => `i-${s}` }).slice(1).map(n => n.name);
    assert.deepEqual(names('start', true), ['spinner', 'label']);
    assert.deepEqual(names('end', true), ['label', 'spinner']);
    assert.deepEqual(names('start', false), ['iconStart', 'label']);
    assert.deepEqual(names('end', false), ['label', 'iconEnd']);
    assert.deepEqual(sidedPartOrder(TEMPLATES.get('input'), [{ id: 'l', type: 'text' }, { id: 's', type: 'ellipse', behavior: { part: 'spinner' } }], {}), ['l', 's']);
});
