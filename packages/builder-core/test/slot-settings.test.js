// A slot's own settings decide what it takes: preferred instances when Only allow preferred is on, the template's list only when it is off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slotAccepts } from '../src/behavior-engine/slot-rules.js';

test('preferred settings decide, and a template list does not widen them', () => {
    const prop = { onlyPreferred: true, preferred: ['r1'], onlyAccepts: true, accepts: ['radio', 'antd-list-item'] };
    assert.equal(slotAccepts(prop, { ids: ['r1'], templates: ['radio'] }), true);
    assert.equal(slotAccepts(prop, { ids: ['li1'], templates: ['antd-list-item'] }), false);
});

test('without the settings, the template list decides', () => {
    const prop = { onlyAccepts: true, accepts: ['radio'] };
    assert.equal(slotAccepts(prop, { ids: ['x'], templates: ['radio'] }), true);
    assert.equal(slotAccepts(prop, { ids: ['x'], templates: ['antd-list-item'] }), false);
});
