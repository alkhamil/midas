// Tag's roles: the height per Size mode (antd tag: 20 sm, 24 md, 28 lg; xs reads sm, xl reads lg), the horizontal inset (8), the close and icon size
// (12) each derive a Semantic alias to an existing Primitives step. The radius and gap and text reuse the shared roles. Nothing is a raw value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, planAutoFix, BASE_SNAPSHOT } from '../src/index.js';

test('the Tag sizes derive from existing Primitives steps: height 20 / 24 / 28, inset 8, icon 12', () => {
    assert.deepEqual(ROLES['tag-height-sm'], { base: 'Semantic/tagHeightSM', derive: { from: 'Primitives/size/20' } });
    assert.deepEqual(ROLES['tag-height'], { base: 'Semantic/tagHeightMD', derive: { from: 'Primitives/size/24' } });
    assert.deepEqual(ROLES['tag-height-lg'], { base: 'Semantic/tagHeightLG', derive: { from: 'Primitives/size/28' } });
    assert.deepEqual(ROLES['tag-padding-x'], { base: 'Semantic/tagPaddingX', derive: { from: 'Primitives/padding/8' } });
    assert.deepEqual(ROLES['tag-icon-size'], { base: 'Semantic/tagIconSize', derive: { from: 'Primitives/size/12' } });
});

test('the Tag xs and xl heights read the nearest given step (sm and lg)', () => {
    assert.deepEqual(ROLES['tag-height-xs'].derive, ROLES['tag-height-sm'].derive);
    assert.deepEqual(ROLES['tag-height-xl'].derive, ROLES['tag-height-lg'].derive);
});

test('Auto Fix resolves every Tag role: no needs value', () => {
    const names = ['tag-height-xs', 'tag-height-sm', 'tag-height', 'tag-height-lg', 'tag-height-xl', 'tag-padding-x', 'tag-icon-size'];
    const template = { id: 'roletest', name: 'RoleTest', props: {}, tokens: { fromSize: ['x'] }, tokenKinds: { x: 'length' }, tokenRoles: { x: 'tag-height' } };
    const plan = planAutoFix({ template, binding: { version: 2, templateId: 'roletest', variables: {} }, variables: { collections: [], items: [] }, layers: [], roles: ROLES, baseSnapshot: BASE_SNAPSHOT });
    assert.deepEqual(plan.needsValue, []);
    for (const name of names) assert.ok(ROLES[name], name);
});
