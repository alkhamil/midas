// The icon pass binds the icon tokens (size, colour) of the layers that are icons: a managed TEXT slot (value, prefixText, suffixText, count)
// is not one, or the pass would replace its colour binding with the icon size on both axes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { iconBoundKeysOf } from '../src/behavior-engine/anatomy.js';

test('the icon pass lists the managed icon slots only, never a managed text slot', () => {
    const input = TEMPLATES.get('input');
    const keys = iconBoundKeysOf(input).map(k => k.key);
    assert.deepEqual(keys, ['prefixIcon', 'clear', 'suffixIcon']);
    for (const slot of input.anatomy.filter(s => s.managed && s.kind !== 'icon')) assert.ok(!keys.includes(slot.id), `${slot.id} is text`);
});
