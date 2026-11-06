// A container of the anatomy (a frame slot) may hold nothing when the display maps it: it is a drawn box (a Switch's handle), and such a box also counts as
// the content a template needs. An empty container the display does not draw is still refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BOXY } from './helpers/box-template.js';

/** A template that is one drawn box and nothing else. */
const BOX_ONLY = (() => {
    const t = structuredClone(BOXY);
    t.anatomy = [{ id: 'box', kind: 'frame', layout: 'horizontal' }];
    t.icons = [];
    delete t.primarySlot;
    t.props = { variant: t.props.variant, checked: t.props.checked, disabled: t.props.disabled };
    t.display = { root: { gap: 'gap' }, box: t.display.box };
    const dropped = ['check-fg', 'glyph-fg-disabled', 'indicatorSize', 'labelTypography', 'fg', 'fg-disabled'];
    t.tokens = { fromVariant: t.tokens.fromVariant.filter(n => !dropped.includes(n)) };
    for (const n of dropped) { delete t.tokenRoles[n]; delete t.tokenKinds[n]; }
    t.persistentStates = { checked: t.persistentStates.checked, disabled: { prop: 'disabled', tokens: { 'box-bg': 'box-bg-disabled', 'box-border': 'box-border-disabled' } } };
    delete t.sampleProps;
    return t;
})();

test('an empty container the display draws is a box, and a template may be only that', () => {
    assert.deepEqual(validateTemplateSchema(BOX_ONLY), []);
});

test('an empty container the display does not map is still refused', () => {
    const bad = structuredClone(BOX_ONLY);
    delete bad.display.box;
    const problems = validateTemplateSchema(bad);
    assert.ok(problems.some(p => /holds no slot/.test(p)));
    assert.ok(problems.some(p => /anatomy needs/.test(p)));
});
