import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertBehaviorData, assertPagesBehavior } from '../src/behavior-engine/document-check.js';
import { BEHAVIOR_DATA_VERSION } from '../src/behavior-engine/data.js';

/** A file opened on its Flow page while its Components page (the master's) is still a stub. */
const lazyFile = () => ({
    variables: { collections: [] },
    pages: [
        { id: 'page-components', name: 'Components', nodes: [] },
        { id: 'page-flow', name: 'Flow', nodes: [{ id: 'home-next', name: 'Next', type: 'frame', parentId: null, isInstance: true, sourceId: 'main', behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Next' } } }] },
    ],
});

test('an instance whose master is on a page still to come is deferred, so a lazily opened page passes its check', () => {
    assert.doesNotThrow(() => assertPagesBehavior(lazyFile(), ['page-flow']));
});

test('the same file checked as complete refuses the instance: its master is missing', () => {
    assert.throws(() => assertBehaviorData(lazyFile()), /its master has no behavior binding/);
});
