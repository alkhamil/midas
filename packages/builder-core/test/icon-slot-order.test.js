// A managed icon slot is created where its anatomy puts it: before the label when it precedes it, after it otherwise, the same place the
// anatomy plan gives it when the icon is switched on later. While the Button is loading, the spinner takes the start icon's place: the
// start slot is not drawn, and the spinner sits in the row before the label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const template = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const binding = { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } };

let seq = 0;
const idOf = key => `c-${key}-${++seq}`;

/** A master built by the generator, and the instance of it for these props: the layers shown, in order. */
function instance(props) {
    const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
    const copies = instanceOf(template, frame, made.created, props, { id: idOf });
    return copies.slice(1).filter(n => n.visible !== false).map(n => (n.behavior?.slot ?? n.behavior?.part ?? n.name));
}

test('an icon at the start is created before the label', () => {
    assert.deepEqual(instance({ hasIcon: true, iconPlacement: 'start', loading: false }), ['iconStart', 'label']);
});

test('an icon at the end is created after the label', () => {
    assert.deepEqual(instance({ hasIcon: true, iconPlacement: 'end', loading: false }), ['label', 'iconEnd']);
});

test('while loading, the spinner takes the start icon place: the start slot is not created, the spinner precedes the label', () => {
    assert.deepEqual(instance({ hasIcon: true, iconPlacement: 'start', loading: true }), ['spinner', 'label']);
});

test('while loading with an end icon, the spinner precedes the label and the end icon stays after it', () => {
    assert.deepEqual(instance({ hasIcon: true, iconPlacement: 'end', loading: true }), ['spinner', 'label', 'iconEnd']);
});

test('the creation order is the order the anatomy plan gives when the icon is switched on later', () => {
    for (const placement of ['start', 'end']) {
        const values = { hasIcon: true, iconPlacement: placement, loading: false, label: 'Button', disabled: false, size: 'sm', variant: 'solid', color: 'primary' };
        const ops = planAnatomy(template, values, [], false).filter(op => op.op === 'insert');
        const planned = [...ops].sort((a, b) => a.index - b.index).map(op => op.slot);
        assert.deepEqual(instance({ hasIcon: true, iconPlacement: placement, loading: false }).filter(n => n !== 'label' && n !== 'spinner'), planned.filter(n => n !== 'label'), placement);
    }
});
