// A managed text layer exists on an instance only while its shownWhen holds (docs/input-managed-text.md, step 4). The planner makes
// and removes it in anatomy order, like a managed icon slot; the text itself stays in the prop, so a layer removed and made again
// shows what the designer typed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';

const lit = (type, def) => ({ source: 'literal', type, default: def });
const FIELD = {
    id: 'field', name: 'Field',
    props: {
        value: lit('string', ''), prefixText: lit('string', ''), suffixText: lit('string', ''),
        hasPrefix: lit('boolean', false), prefixIcon: lit('iconComponent', null),
    },
    primarySlot: 'value',
    anatomy: [
        { id: 'prefixIcon', kind: 'icon', optional: true, managed: true },
        { id: 'prefixText', kind: 'text', optional: true, managed: true, shownWhen: { prop: 'prefixText', empty: false } },
        { id: 'value', kind: 'control', optional: true, managed: true, shownWhen: { prop: 'value', empty: false } },
        { id: 'suffixText', kind: 'text', optional: true, managed: true, shownWhen: { prop: 'suffixText', empty: false } },
    ],
    icons: [{ show: 'hasPrefix', component: 'prefixIcon', slot: 'prefixIcon', tokens: {} }],
};
const child = (id, slot = null, name = id) => ({ id, slot, name });
const FRESH = { value: '', prefixText: '', suffixText: '', hasPrefix: false, prefixIcon: null };
const PLACEHOLDER = child('ph', null, 'placeholder');

/** Applies a plan to a child list the way the editor does. */
function apply(children, ops) {
    const list = [...children];
    for (const op of ops) {
        if (op.op === 'remove') list.splice(list.findIndex(c => c.id === op.id), 1);
        else if (op.op === 'move') { const [c] = list.splice(list.findIndex(x => x.id === op.id), 1); list.splice(op.index, 0, c); }
        else if (op.op === 'insert') list.splice(op.index, 0, child(`new-${op.slot}`, op.slot, op.slot));
    }
    return list;
}
const slots = list => list.map(c => c.slot ?? c.name);

test('a fresh instance has only the master\'s layer: no managed text layer is made', () => {
    assert.deepEqual(planAnatomy(FIELD, FRESH, [PLACEHOLDER]), []);
});

test('a layer is made when its prop asks for it, with no component, and removed when it stops asking', () => {
    const typed = planAnatomy(FIELD, { ...FRESH, value: 'hi' }, [PLACEHOLDER]);
    assert.deepEqual(typed, [{ op: 'insert', slot: 'value', index: 1 }]);
    const withValue = apply([PLACEHOLDER], typed);
    assert.deepEqual(planAnatomy(FIELD, { ...FRESH, value: 'hi' }, withValue), [], 'idempotent');
    assert.deepEqual(planAnatomy(FIELD, FRESH, withValue), [{ op: 'remove', id: 'new-value' }]);
});

test('managed text layers sit in anatomy order around the primary one, whatever order they were asked for in', () => {
    const values = { ...FRESH, value: 'v', prefixText: '$', suffixText: 'kg' };
    const ops = planAnatomy(FIELD, values, [PLACEHOLDER]);
    assert.deepEqual(slots(apply([PLACEHOLDER], ops)), ['prefixText', 'placeholder', 'value', 'suffixText']);
    const late = apply([PLACEHOLDER, child('v', 'value')], planAnatomy(FIELD, { ...values, prefixText: '$' }, [PLACEHOLDER, child('v', 'value')]));
    assert.deepEqual(slots(late), ['prefixText', 'placeholder', 'value', 'suffixText']);
});

test('a text layer and an icon slot share the order: the prefix icon comes before the prefix text', () => {
    const values = { ...FRESH, hasPrefix: true, prefixText: '$' };
    assert.deepEqual(slots(apply([PLACEHOLDER], planAnatomy(FIELD, values, [PLACEHOLDER]))), ['prefixIcon', 'prefixText', 'placeholder']);
});

test('turning a prop off and on again makes the layer again, and the text comes from the prop that was kept', () => {
    const values = { ...FRESH, prefixText: '$' };
    const on = apply([PLACEHOLDER], planAnatomy(FIELD, values, [PLACEHOLDER]));
    const off = apply(on, planAnatomy(FIELD, { ...values, hasPrefix: false, prefixText: '' }, on));
    assert.deepEqual(slots(off), ['placeholder']);
    assert.deepEqual(planAnatomy(FIELD, values, off), [{ op: 'insert', slot: 'prefixText', index: 0 }], 'the same stored value asks for the layer again');
});

test('a managed text layer is never swapped for an icon: it carries no component', () => {
    const present = [child('p', 'prefixText'), PLACEHOLDER];
    assert.deepEqual(planAnatomy(FIELD, { ...FRESH, prefixText: '$' }, present), []);
});

test('a template whose only text layer is the managed primary has no required text slot to order against', () => {
    const only = { ...FIELD, anatomy: FIELD.anatomy.filter(s => s.id === 'value') };
    assert.deepEqual(planAnatomy(only, { ...FRESH, value: 'x' }, []), [{ op: 'insert', slot: 'value', index: 0 }]);
});
