// The layers of a managed container go in the order the anatomy names them, and a clone of a master keeps the marker of its managed container (so the sync does not make a
// second one). Root cause of the InputNumber instance bugs: two stepper layers, the chevrons down above up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps, withInstanceBehavior } from '../src/behavior-engine/instance-props.js';
import { markManagedContainers } from '../src/behavior-engine/template-master.js';

const number = TEMPLATES.get('inputnumber');

test('a container with several slots gets them inserted in anatomy order, each among its siblings', () => {
    const ops = planAnatomy(number, resolveProps(number, {}), [{ id: 'p', slot: null, name: 'placeholder' }]);
    const inserts = ops.filter(o => o.op === 'insert');
    assert.deepEqual(inserts.map(o => [o.slot, o.index]), [['stepper', 1], ['stepUp', 0], ['stepDivider', 1], ['stepDown', 2]]);
});

test('with the first and the last held, a missing middle slot goes between them', () => {
    const held = [{ id: 'p', slot: null }, { id: 's', slot: 'stepper' }, { id: 'u', slot: 'stepUp', parent: 'stepper' }, { id: 'd', slot: 'stepDown', parent: 'stepper' }];
    assert.deepEqual(planAnatomy(number, resolveProps(number, {}), held).map(o => [o.op, o.slot, o.index]), [['insert', 'stepDivider', 1]]);
});

test('a clone of the master keeps the group marker, and the managed container becomes the slot-marked frame; a box that is not managed stays a group', () => {
    const copy = { behavior: { version: 2, group: 'stepper' } };
    withInstanceBehavior(copy, { behavior: copy.behavior });
    assert.equal(copy.behavior.group, 'stepper', 'the marker is not dropped by the copy');
    markManagedContainers(number, [copy]);
    assert.equal(copy.behavior.slot, 'stepper');
    assert.equal(copy.behavior.group, undefined);
    const checkbox = TEMPLATES.get('checkbox');
    const box = { behavior: { version: 2, group: 'box' } };
    markManagedContainers(checkbox, [box]);
    assert.equal(box.behavior.group, 'box', 'the Checkbox box is not managed');
});
