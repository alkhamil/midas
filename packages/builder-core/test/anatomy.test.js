import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';

const binding = { version: 2, templateId: 'button', variables: { variant: null, size: null } };
const masterRoot = { isAutoLayout: true };
const masterTree = [{ id: 'mLabel', type: 'text' }, { id: 'mIcon', type: 'vector' }];
const child = (id, slot = null) => ({ id, slot });
const plan = (stored, children, over = {}) => planInstanceAnatomy({ binding, masterRoot, masterTree, stored, children, ...over });

/** Applies a plan to a child list the way the editor does: removals, then moves and inserts at their final index. */
function apply(children, ops) {
    const list = [...children];
    for (const op of ops) {
        if (op.op === 'remove') list.splice(list.findIndex(c => c.id === op.id), 1);
        else if (op.op === 'move') {
            const [c] = list.splice(list.findIndex(x => x.id === op.id), 1);
            list.splice(op.index, 0, c);
        }
        else list.splice(op.index, 0, child(`new-${op.slot}`, op.slot));
    }
    return list;
}

const on = placement => ({ hasIcon: true, iconPlacement: placement });
const off = { hasIcon: false, iconPlacement: 'start' };

test('off to start: a managed start icon is inserted as the first child', () => {
    const { ops } = plan(on('start'), [child('label')]);
    assert.deepEqual(ops, [{ op: 'insert', slot: 'iconStart', index: 0 }]);
});

test('off to end: a managed end icon is inserted as the last child', () => {
    const { ops } = plan(on('end'), [child('label')]);
    assert.deepEqual(ops, [{ op: 'insert', slot: 'iconEnd', index: 1 }]);
});

test('start to end: the start icon is removed and one end icon is inserted last', () => {
    const { ops } = plan(on('end'), [child('iStart', 'iconStart'), child('label')]);
    assert.deepEqual(ops, [{ op: 'remove', id: 'iStart' }, { op: 'insert', slot: 'iconEnd', index: 1 }]);
});

test('start to off: the start icon is removed', () => {
    const { ops } = plan(off, [child('iStart', 'iconStart'), child('label')]);
    assert.deepEqual(ops, [{ op: 'remove', id: 'iStart' }]);
});

test('end to off: the end icon is removed', () => {
    const { ops } = plan(off, [child('label'), child('iEnd', 'iconEnd')]);
    assert.deepEqual(ops, [{ op: 'remove', id: 'iEnd' }]);
});

test('an icon at the wrong position is moved to its place, not replaced', () => {
    const { ops } = plan(on('start'), [child('label'), child('iStart', 'iconStart')]);
    assert.deepEqual(ops, [{ op: 'move', id: 'iStart', index: 0 }]);
});

test('two managed icons for one slot leave one', () => {
    const { ops } = plan(on('start'), [child('iStart', 'iconStart'), child('iDup', 'iconStart'), child('label')]);
    assert.deepEqual(ops, [{ op: 'remove', id: 'iDup' }]);
});

test('every transition ends in an empty plan when run again (idempotent)', () => {
    const starts = [[child('label')], [child('iStart', 'iconStart'), child('label')], [child('label'), child('iEnd', 'iconEnd')], [child('label'), child('iStart', 'iconStart')]];
    for (const stored of [on('start'), on('end'), off]) {
        for (const children of starts) {
            const once = apply(children, plan(stored, children).ops);
            assert.deepEqual(plan(stored, once).ops, [], JSON.stringify({ stored, children }));
        }
    }
});

test('an unbound master clears every managed layer of its instances, without needing a label', () => {
    const { ops, reason } = planInstanceAnatomy({ binding: undefined, masterRoot: { isAutoLayout: false }, masterTree: [], stored: on('start'), children: [child('iStart', 'iconStart'), child('label'), child('iEnd', 'iconEnd')] });
    assert.equal(reason, undefined);
    assert.deepEqual(ops, [{ op: 'remove', id: 'iStart' }, { op: 'remove', id: 'iEnd' }]);
});

test('a master that is not an auto layout frame: sync does nothing and says why', () => {
    const result = plan(on('start'), [child('label')], { masterRoot: { isAutoLayout: false } });
    assert.deepEqual(result, { ops: [], reason: 'the master is not an auto layout frame' });
});

test('a master with no text layer: sync does nothing and says why, even when an icon would be removed', () => {
    const result = plan(off, [child('iStart', 'iconStart')], { masterTree: [{ id: 'mIcon', type: 'vector' }] });
    assert.deepEqual(result, { ops: [], reason: 'the master has no text layer' });
});

test('a new instance gets managed layers only from its own values: nothing is copied from the master', () => {
    const { ops } = plan(off, [child('mLabel')]);
    assert.deepEqual(ops, []);
});

test('a duplicated instance keeps its managed layers and values consistent', () => {
    const original = [child('iStart', 'iconStart'), child('label')];
    const copy = [child('iStart2', 'iconStart'), child('label2')];
    assert.deepEqual(plan(on('start'), original).ops, []);
    assert.deepEqual(plan(on('start'), copy).ops, []);
});

// The icon of the slot: the component the managed layer shows (null for the placeholder).
const iconOn = (placement, icon) => ({ hasIcon: true, iconPlacement: placement, icon });
const inSlot = (id, slot, component) => ({ id, slot, component });

test('an icon chosen for a new slot is inserted with that component', () => {
    const { ops } = plan(iconOn('start', 'ic-check'), [child('label')]);
    assert.deepEqual(ops, [{ op: 'insert', slot: 'iconStart', index: 0, component: 'ic-check' }]);
});

test('a different icon swaps the slot in place: same layer, same position, no insert', () => {
    const { ops } = plan(iconOn('start', 'ic-b'), [inSlot('iStart', 'iconStart', 'ic-a'), child('label')]);
    assert.deepEqual(ops, [{ op: 'swap', id: 'iStart', component: 'ic-b' }]);
});

test('the same icon in its slot is left alone', () => {
    const { ops } = plan(iconOn('start', 'ic-a'), [inSlot('iStart', 'iconStart', 'ic-a'), child('label')]);
    assert.deepEqual(ops, []);
});

test('no icon chosen empties a slot that held one (the placeholder)', () => {
    const { ops } = plan(iconOn('start', null), [inSlot('iStart', 'iconStart', 'ic-a'), child('label')]);
    assert.deepEqual(ops, [{ op: 'swap', id: 'iStart', component: null }]);
});

test('an icon with no icon prop value is the placeholder when a slot is inserted', () => {
    const { ops } = plan(iconOn('end', null), [child('label')]);
    assert.deepEqual(ops, [{ op: 'insert', slot: 'iconEnd', index: 1 }]);
});
