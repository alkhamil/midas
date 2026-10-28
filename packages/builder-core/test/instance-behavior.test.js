import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withInstanceBehavior } from '../src/behavior-engine/instance-props.js';
import { assertBehaviorData } from '../src/behavior-engine/document-check.js';

const collections = [{ id: 'c-variant', name: 'Variant', modes: [{ id: 'primary', name: 'Primary' }] }];
const boundMaster = { id: 'btn', name: 'Button', type: 'frame', isInstance: false, behavior: { version: 2, templateId: 'button', variables: { variant: 'c-variant', size: null } } };

test('instancing a bound master gives the instance props only, without the binding', () => {
    const copy = withInstanceBehavior({ id: 'i1', isInstance: true }, boundMaster);
    assert.deepEqual(copy.behavior, { version: 2, props: {} });
});

test('a plain layer copied inside an instance keeps no behavior data', () => {
    assert.equal('behavior' in withInstanceBehavior({ id: 'l', isInstance: false }, boundMaster), false);
    assert.equal('behavior' in withInstanceBehavior({ id: 'l', isInstance: false }, { id: 'l0', type: 'text' }), false);
});

test('a document with a bound master and its instance saves and reopens without error', () => {
    const copy = withInstanceBehavior({ id: 'i1', name: 'Button copy', type: 'frame', isInstance: true, sourceId: 'btn' }, boundMaster);
    const saved = JSON.stringify({ variables: { collections }, pages: [{ id: 'p1', nodes: [boundMaster, copy] }] });
    const reopened = JSON.parse(saved);
    assert.equal('templateId' in reopened.pages[0].nodes[1].behavior, false);
    assert.doesNotThrow(() => assertBehaviorData(reopened));
});
