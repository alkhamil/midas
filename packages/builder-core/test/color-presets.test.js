// Colour presets: one Color mode per preset (default, primary, success, warning, danger, then the hues red, orange, gold, green, cyan, blue, purple).
// Each preset reads a palette of the base Primitives; a palette that does not exist yet is named by its role and reported as needs value, never a literal.
// Four uses per preset (subtle fill, border, solid fill, text) are roles that alias the palette step through Semantic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_PRESETS, PRESET_PALETTE, PRESET_USES, presetRoleMap } from '../src/templates/color-presets.js';
import { ROLES, planAutoFix } from '../src/index.js';
import { variableProps } from '../src/behavior-engine/registry.js';
import { BASE_SNAPSHOT } from '../src/index.js';

const EXPECTED = ['default', 'primary', 'success', 'warning', 'danger', 'red', 'orange', 'gold', 'green', 'cyan', 'blue', 'purple'];

test('the presets are the twelve named, in that order', () => {
    assert.deepEqual(COLOR_PRESETS, EXPECTED);
});

test('each preset reads a palette: the existing ones are reused, orange and purple name their own', () => {
    assert.deepEqual(PRESET_PALETTE, {
        default: 'neutral', primary: 'primary', success: 'success', warning: 'warning', danger: 'danger',
        red: 'danger', orange: 'orange', gold: 'warning', green: 'success', cyan: 'tertiary', blue: 'info', purple: 'purple',
    });
});

test('the uses are four steps of a palette: subtle 50, border 200, solid 500, text 600', () => {
    assert.deepEqual(PRESET_USES, { subtle: 50, border: 200, solid: 500, text: 600 });
});

test('every preset use is a role that aliases its palette step', () => {
    for (const preset of COLOR_PRESETS) {
        for (const [use, step] of Object.entries(PRESET_USES)) {
            const role = ROLES[`preset-${preset}-${use}`];
            assert.ok(role, `preset-${preset}-${use} exists`);
            assert.equal(role.derive.from, `Primitives/${PRESET_PALETTE[preset]}/${step}`);
        }
    }
});

test('a use maps every preset mode to its role, per mode, and the role is a role of the table', () => {
    const map = presetRoleMap('solid');
    assert.deepEqual(Object.keys(map), COLOR_PRESETS);
    for (const role of Object.values(map)) assert.ok(ROLES[role], role);
});

/** A template whose two tokens are coloured per Color preset: the fill (subtle) and the solid. */
const TAGGY = {
    id: 'taggy',
    name: 'Taggy',
    props: { color: { source: 'variable', collection: 'Color', modes: COLOR_PRESETS, defaultMode: 'default' } },
    tokens: { fromColor: ['tag-bg', 'tag-solid'] },
    tokenKinds: { 'tag-bg': 'color', 'tag-solid': 'color' },
    tokenRoles: { 'tag-bg': presetRoleMap('subtle'), 'tag-solid': presetRoleMap('solid') },
};

test('Auto Fix aliases every preset of an existing palette and names the missing ones as needs value', () => {
    const binding = { version: 2, templateId: 'taggy', variables: Object.fromEntries(variableProps(TAGGY).map(([d]) => [d, null])) };
    const plan = planAutoFix({ template: TAGGY, binding, variables: { collections: [], items: [] }, layers: [], roles: ROLES, baseSnapshot: BASE_SNAPSHOT });
    // Auto Fix names a flagged value by its token and mode: Color/tag-bg.orange.
    const flagged = new Set(plan.needsValue.map(v => v.name.slice(v.name.lastIndexOf('.') + 1)));
    assert.deepEqual([...flagged].sort(), ['orange', 'purple'], 'only the two palettes the base lacks are flagged');
    const aliased = new Set(plan.derived.map(d => d.name));
    for (const preset of COLOR_PRESETS.filter(p => p !== 'orange' && p !== 'purple')) {
        assert.ok([...aliased].some(n => n.includes('Semantic/preset') && n.toLowerCase().includes(preset)), `${preset} aliases its palette through Semantic`);
    }
});

test('the base Primitives hold no orange or purple palette yet: the two presets are the only gaps', () => {
    const palettes = new Set(BASE_SNAPSHOT.items.filter(i => i.collection === 'Primitives').map(i => i.name.split('/')[0]));
    for (const palette of new Set(Object.values(PRESET_PALETTE))) {
        assert.equal(palettes.has(palette), palette !== 'orange' && palette !== 'purple', palette);
    }
});
