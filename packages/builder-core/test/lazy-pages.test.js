// Phase 2 of a lazily opened file: each page is checked when it loads. Cross-page rules run when either page arrives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPagesBehavior, assertBehaviorData, behaviorProblem } from '../src/behavior-engine/document-check.js';

const button = { id: 'm1', name: 'Button', type: 'frame', parentId: null, behavior: { version: 1, templateId: 'button', variables: { variant: null, size: null } } };
const instance = (over = {}) => ({ id: 'i1', name: 'Save', type: 'frame', parentId: null, isInstance: true, sourceId: 'm1', behavior: { version: 1, props: {} }, ...over });
const page = (id, name, nodes) => ({ id, name, nodes });
const doc = pages => ({ variables: { collections: [], items: [] }, pages });

test('a valid lazy open passes: each page checks clean when it loads', () => {
    const d = doc([page('a', 'Components', [button]), page('b', 'Screens', [instance()])]);
    assert.doesNotThrow(() => assertPagesBehavior(d, ['a']));
    assert.doesNotThrow(() => assertPagesBehavior(d, ['b']));
});

test('a later page with a managed layer outside its instance errors, naming the page and the node', () => {
    const stray = { id: 's1', name: 'iconStart', type: 'frame', parentId: null, behavior: { version: 1, slot: 'iconStart' } };
    const d = doc([page('a', 'Components', [button]), page('b', 'Screens', [stray])]);
    assert.throws(() => assertPagesBehavior(d, ['b']), /on page "Screens"/);
    assert.throws(() => assertPagesBehavior(d, ['b']), /"iconStart" \(s1\)/);
});

test('a cross-page instance is deferred while its master page is missing, then checked when that page arrives', () => {
    const bad = instance({ behavior: { version: 1, props: { hasIcon: 'yes' } } });
    const screens = page('b', 'Screens', [bad]);
    const withoutMaster = doc([screens]);
    assert.doesNotThrow(() => assertPagesBehavior(withoutMaster, ['b']));
    const withMaster = doc([page('a', 'Components', [button]), screens]);
    assert.throws(() => assertPagesBehavior(withMaster, ['a']), /on page "Screens"/);
});

test('the eager check still reports the page of a bad node', () => {
    const bad = instance({ behavior: { version: 1, props: { nope: true } } });
    assert.throws(() => assertBehaviorData(doc([page('a', 'Components', [button]), page('b', 'Screens', [bad])])), /on page "Screens"/);
});

test('the backstop in a partial document ignores an instance whose master page failed to load', () => {
    const d = doc([page('b', 'Screens', [instance()])]);
    assert.equal(behaviorProblem(d, { partial: true }), null);
    assert.deepEqual(behaviorProblem(d), { name: 'Save', problem: 'its master has no behavior binding' });
});
