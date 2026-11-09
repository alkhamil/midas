// Colour presets: one Color mode per base palette (primary, secondary, tertiary, info, danger, warning, success, neutral). A preset reads its own palette,
// so there is no alias and no gap: every palette the base holds is a preset. Four uses per preset (subtle fill, border, solid fill, text) are roles of
// roles.json that derive a Semantic alias to one palette step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_PRESETS, PRESET_USES, presetRole, presetRoleMap } from '../src/templates/color-presets.js';
import { ROLES, planAutoFix, BASE_SNAPSHOT } from '../src/index.js';
import { variableProps } from '../src/behavior-engine/registry.js';

const EXPECTED = ['primary', 'secondary', 'tertiary', 'info', 'danger', 'warning', 'success', 'neutral'];

test('the presets are the eight base palettes, in that order', () => {
    assert.deepEqual(COLOR_PRESETS, EXPECTED);
});

test('the uses are four steps of a palette: subtle 50, border 200, solid 500, text 600', () => {
    assert.deepEqual(PRESET_USES, { subtle: 50, border: 200, solid: 500, text: 600 });
});

test('every preset use is a role that derives its own palette step', () => {
    for (const preset of COLOR_PRESETS) {
        for (const [use, step] of Object.entries(PRESET_USES)) {
            const role = ROLES[presetRole(preset, use)];
            assert.ok(role, `${presetRole(preset, use)} exists`);
            assert.equal(role.derive.from, `Primitives/${preset}/${step}`);
        }
    }
});

test('the role table holds exactly the 32 preset entries, and nothing else of the presets', () => {
    const names = Object.keys(ROLES).filter(k => k.startsWith('preset-'));
    assert.equal(names.length, 32);
    assert.deepEqual(names.sort(), COLOR_PRESETS.flatMap(p => Object.keys(PRESET_USES).map(u => presetRole(p, u))).sort());
});

test('a use maps every preset mode to its role of that use', () => {
    const map = presetRoleMap('solid');
    assert.deepEqual(Object.keys(map), COLOR_PRESETS);
    for (const [preset, role] of Object.entries(map)) assert.equal(role, presetRole(preset, 'solid'));
});

/** A template whose two tokens are coloured per Color preset: the fill (subtle) and the solid. */
const TAGGY = {
    id: 'taggy',
    name: 'Taggy',
    props: { color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'primary' } },
    tokens: { fromColor: ['tag-bg', 'tag-solid'] },
    tokenKinds: { 'tag-bg': 'color', 'tag-solid': 'color' },
    tokenRoles: { 'tag-bg': presetRoleMap('subtle'), 'tag-solid': presetRoleMap('solid') },
};

test('Auto Fix resolves every preset of every use: no needs value, every mode aliases its palette', () => {
    const binding = { version: 2, templateId: 'taggy', variables: Object.fromEntries(variableProps(TAGGY).map(([d]) => [d, null])) };
    const plan = planAutoFix({ template: TAGGY, binding, variables: { collections: [], items: [] }, layers: [], roles: ROLES, baseSnapshot: BASE_SNAPSHOT });
    assert.deepEqual(plan.needsValue, []);
    const aliased = new Set(plan.derived.map(d => d.name));
    for (const preset of COLOR_PRESETS) {
        const semantic = `Semantic/preset${preset[0].toUpperCase()}${preset.slice(1)}Solid`;
        assert.ok(aliased.has(semantic), `${preset} aliases its palette as ${semantic}`);
    }
});

test('every preset palette exists in the base Primitives', () => {
    const palettes = new Set(BASE_SNAPSHOT.items.filter(i => i.collection === 'Primitives').map(i => i.name.split('/')[0]));
    for (const preset of COLOR_PRESETS) assert.ok(palettes.has(preset), preset);
});
