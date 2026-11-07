// A managed frame container (the Switch's inner text frames) is an instance layer like any managed slot: the plan inserts it
// while its condition holds and removes it when it fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planAnatomy } from '../src/behavior-engine/anatomy.js';

const template = {
    id: 'probe',
    props: {},
    icons: [],
    parts: [],
    anatomy: [
        { id: 'handle', kind: 'frame' },
        { id: 'innerOn', kind: 'frame', managed: true, shownWhen: { prop: 'checkedChildren', empty: false } },
        { id: 'innerOff', kind: 'frame', managed: true, shownWhen: { prop: 'uncheckedChildren', empty: false } },
    ],
};

test('the plan inserts the container whose condition holds', () => {
    const ops = planAnatomy(template, { checkedChildren: 'on', uncheckedChildren: '' }, []);
    assert.deepEqual(ops.filter(o => o.op === 'insert').map(o => o.slot), ['innerOn']);
});

test('the plan removes the container whose condition fails', () => {
    const children = [{ id: 'c-on', slot: 'innerOn' }, { id: 'c-off', slot: 'innerOff' }];
    const ops = planAnatomy(template, { checkedChildren: '', uncheckedChildren: '' }, children);
    assert.deepEqual(ops.filter(o => o.op === 'remove').map(o => o.id).sort(), ['c-off', 'c-on']);
});
