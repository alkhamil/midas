import test from 'node:test';
import assert from 'node:assert/strict';
import { withInstanceBehavior } from '../src/behavior-engine/instance-props.js';

test('a template layer keeps its marker when it is copied into an instance; the binding does not', () => {
    const part = withInstanceBehavior({ name: 'spinner', isInstance: false }, { behavior: { version: 2, part: 'spinner' } });
    assert.deepEqual(part.behavior, { version: 2, part: 'spinner' });
    const slot = withInstanceBehavior({ name: 'clear', isInstance: false }, { behavior: { version: 2, slot: 'clear' } });
    assert.deepEqual(slot.behavior, { version: 2, slot: 'clear' });
    const plain = withInstanceBehavior({ name: 'Box', isInstance: false }, { behavior: { version: 2, props: {} } });
    assert.equal('behavior' in plain, false, 'a plain layer keeps no behavior data');
    const master = withInstanceBehavior({ name: 'Button', isInstance: true }, { behavior: { version: 2, templateId: 'button', variables: {} } });
    assert.deepEqual(master.behavior, { version: 2, props: {} }, 'the instance root keeps its own props, not the binding');
});
