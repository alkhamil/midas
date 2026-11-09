// Badge's roles: the pill height (antd indicatorHeight, 20), the dot (antd dotSize, 6) and the count's inset (antd badge padding, 6) each derive a Semantic
// alias to an existing Primitives step, and the status colours read the preset roles of the matching palette. A zero inset reads Primitives padding/0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, planAutoFix, BASE_SNAPSHOT } from '../src/index.js';

test('the Badge sizes derive from existing Primitives steps: pill height 20, dot 6, count inset 6, none 0', () => {
    assert.deepEqual(ROLES['badge-height'], { base: 'Semantic/badgeHeight', derive: { from: 'Primitives/size/20' } });
    assert.deepEqual(ROLES['badge-dot'], { base: 'Semantic/badgeDot', derive: { from: 'Primitives/size/6' } });
    assert.deepEqual(ROLES['badge-padding-x'], { base: 'Semantic/badgePaddingX', derive: { from: 'Primitives/padding/6' } });
    assert.deepEqual(ROLES['badge-padding-none'], { base: 'Semantic/badgePaddingNone', derive: { from: 'Primitives/padding/0' } });
});

test('the status colours read the matching preset: success, processing (info), default (neutral), error (danger), warning', () => {
    assert.equal(ROLES['badge-status-success'].base, 'Semantic/presetSuccessSolid');
    assert.equal(ROLES['badge-status-processing'].base, 'Semantic/presetInfoSolid');
    assert.equal(ROLES['badge-status-default'].base, 'Semantic/presetNeutralSolid');
    assert.equal(ROLES['badge-status-error'].base, 'Semantic/presetDangerSolid');
    assert.equal(ROLES['badge-status-warning'].base, 'Semantic/presetWarningSolid');
});

test('Auto Fix resolves every Badge role: no needs value', () => {
    const names = ['badge-height', 'badge-dot', 'badge-padding-x', 'badge-padding-none', 'badge-status-success', 'badge-status-processing', 'badge-status-default', 'badge-status-error', 'badge-status-warning'];
    const template = { id: 'roletest', name: 'RoleTest', props: { status: { source: 'variable', collection: 'Status', modes: ['success'] } }, tokens: { fromStatus: ['x'] }, tokenKinds: { x: 'color' }, tokenRoles: { x: 'badge-status-success' } };
    const plan = planAutoFix({ template, binding: { version: 2, templateId: 'roletest', variables: { status: null } }, variables: { collections: [], items: [] }, layers: [], roles: ROLES, baseSnapshot: BASE_SNAPSHOT });
    assert.deepEqual(plan.needsValue, []);
    for (const name of names) assert.ok(ROLES[name], name);
});
