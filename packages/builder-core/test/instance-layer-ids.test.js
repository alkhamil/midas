// The layers an instance gets for a managed slot it does not hold (made from the slot's stub) carry plain ids: the id function is given the slot's key,
// so no id reads "[object Object]". Each slot's id is unique within its instance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

test('a managed slot made on an instance has a plain, unique id', () => {
    for (const id of ['antd-badge', 'checkbox']) {
        const model = modelFor(TEMPLATES.get(id));
        const props = id === 'antd-badge' ? { type: 'count', count: 5 } : { hasLabel: true, label: 'x' };
        const nodes = instanceFor(model, props);
        const ids = nodes.map(n => n.id);
        for (const nodeId of ids) assert.doesNotMatch(nodeId, /object Object/, `${id}: ${nodeId}`);
        assert.equal(new Set(ids).size, ids.length, `${id}: ids are unique`);
    }
});
