// The Allow Clear icon is not the prefix and suffix icon: it is the icon size minus 2px (its own token, derived in the base data, never a number
// in the template), drawn in the placeholder colour (not the foreground), brighter on hover with its own colour token (hover has no static
// canvas visual: the canvas shows the rest colour; Play and the export show the hover), with a pointer cursor. It is swappable and remembered.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { INPUT } from '../src/templates/input.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { iconSlotBindings, iconSlotTargets } from '../src/behavior-engine/icon-slot.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { BASE_SNAPSHOT, planFromSnapshot, applyBasePlan } from '../src/index.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const json = name => JSON.parse(readFileSync(new URL(`../src/base-tokens/${name}`, import.meta.url), 'utf8'));
const roles = json('roles.json');
const sizes = json('antd-sizes.json');
const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `ci-${key}-${++seq}`;

/** The base variables, generated into a store, and the number a Semantic size resolves to. */
function baseStore() {
    const store = { collections: [], items: [] };
    applyBasePlan(store, planFromSnapshot(BASE_SNAPSHOT), () => `b${++seq}`);
    return store;
}
const semanticNumber = (store, name) => {
    const item = store.items.find(i => i.name === name && store.collections.find(c => c.id === i.collectionId)?.name === 'Semantic');
    assert.ok(item, `Semantic/${name} exists`);
    return variableValue(store, item, c => c.modes[0].id);
};
/** The Semantic name a role of the template resolves to in roles.json. */
const semanticOf = role => /^Semantic\/(.+)$/.exec(roles[role]?.base ?? '')?.[1];

test('the clear icon size is its own token, derived in the base data as the icon size minus 2 for every Size mode', () => {
    assert.ok(INPUT.tokens.fromSize.includes('clearIconSize'), 'a Size token');
    assert.equal(INPUT.tokenKinds.clearIconSize, 'length');
    const store = baseStore();
    for (const size of SIZE_MODES) {
        const icon = semanticNumber(store, semanticOf(INPUT.tokenRoles.iconSize[size]));
        const clear = semanticNumber(store, semanticOf(INPUT.tokenRoles.clearIconSize[size]));
        assert.equal(typeof icon, 'number');
        assert.equal(clear, icon - 2, `${size}: ${clear} is the icon size ${icon} minus 2`);
    }
});

test('the derivation is data: each clear icon size names the icon size it comes from and its offset, and the numbers agree', () => {
    const entries = Object.entries(sizes).filter(([name]) => name.startsWith('clearIconSize'));
    assert.equal(entries.length, SIZE_MODES.length, 'one per Size mode');
    for (const [name, spec] of entries) {
        assert.equal(spec.derived, true, `${name} is flagged derived`);
        assert.equal(spec.offset, -2, `${name} is the icon size - 2`);
        assert.equal(spec.value, sizes[spec.from].value + spec.offset, `${name} = ${spec.from} + ${spec.offset}`);
        assert.equal(spec.primitive, `size/${spec.value}`);
    }
});

test('the clear icon colour is the placeholder token, not the foreground, and the hover colour is its own token with its own role', () => {
    const clear = input.icons.find(def => def.slot === 'clear');
    assert.equal(clear.tokens.colour, 'placeholder');
    assert.equal(clear.tokens.colour, input.display.placeholder.fill, 'the very token the placeholder text uses');
    assert.notEqual(clear.tokens.colour, 'fg');
    assert.equal(clear.tokens.size, 'clearIconSize');
    assert.equal(clear.tokens.hoverColour, 'clear-hover');
    assert.ok(input.tokens.fromVariant.includes('clear-hover'));
    assert.equal(input.tokenKinds['clear-hover'], 'color');
    assert.notEqual(roles[input.tokenRoles['clear-hover']].base, roles[input.tokenRoles.placeholder].base, 'a distinct Semantic alias');
    assert.equal(roles[input.tokenRoles['clear-hover']].base, 'Semantic/colorTextSecondary', 'placeholder to secondary text, as antd');
    assert.deepEqual(input.display.clear, { size: 'clearIconSize' });
    assert.deepEqual(validateTemplateSchema(input), []);
});

test('a hover colour on an icon slot must be a token of the template, and a slot with one must be named', () => {
    const missing = structuredClone(INPUT);
    missing.icons.find(def => def.slot === 'clear').tokens.hoverColour = 'nope';
    assert.match(validateTemplateSchema(missing).join('\n'), /hoverColour token "nope" is not a token/);
    const placement = structuredClone(INPUT);
    delete placement.icons.find(def => def.slot === 'prefixIcon').slot;
    placement.icons.find(def => def.component === 'prefixIcon').tokens = { ...placement.icons.find(def => def.component === 'prefixIcon').tokens, hoverColour: 'clear-hover' };
    assert.match(validateTemplateSchema(placement).join('\n'), /has a hover colour but names no slot/);
});

test('the clear icon binds to the clear size and the placeholder colour; the prefix and suffix icons keep the icon size and the foreground', () => {
    assert.deepEqual(iconSlotTargets(input, 'clear'), {
        colour: { name: 'placeholder', dimension: 'variant' },
        disabledColour: { name: 'fg-disabled', dimension: 'variant' },
        size: { name: 'clearIconSize', dimension: 'size' },
    });
    assert.equal(iconSlotTargets(input, 'prefixIcon').size.name, 'iconSize');
    assert.equal(iconSlotTargets(input, 'prefixIcon').colour.name, 'fg');
});

test('swapping the clear icon keeps the size on the slot and the placeholder colour on every vector of the new icon', () => {
    const targets = iconSlotTargets(input, 'clear');
    const ids = { fg: 'v-placeholder', fgDisabled: 'v-fg-disabled', size: 's-clearIconSize', names: { colour: targets.colour.name, disabledColour: targets.disabledColour.name, size: targets.size.name } };
    for (const layers of [
        [{ id: 'icon', fillIndexes: [], stroke: false }, { id: 'a', fillIndexes: [0], stroke: false }],
        [{ id: 'icon', fillIndexes: [], stroke: false }, { id: 'b', fillIndexes: [0, 1], stroke: false }, { id: 'c', fillIndexes: [], stroke: true }],
    ]) {
        const plan = iconSlotBindings({ ...ids, disabled: false, layers });
        assert.deepEqual(plan.slot, { w: 's-clearIconSize', h: 's-clearIconSize' });
        for (const layer of plan.layers.filter(l => l.id !== 'icon')) for (const v of Object.values(layer.vars)) assert.equal(v, 'v-placeholder');
    }
});

test('the clear slot of an instance is fixed on both axes, so the size is the variable\'s', () => {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const layer = instanceOf(input, frame, made.created, { allowClear: true, value: 'x' }, { id: idOf }).find(c => c.behavior?.slot === 'clear');
    assert.deepEqual([layer.layoutSizingH, layer.layoutSizingV], ['fixed', 'fixed']);
});

/** The exported stylesheet of the Input. */
function css() {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    return generateComponent(input, model.binding, variables, 'Input', frame, id => made.created.filter(c => c.parentId === id)).files['Input.css'];
}
const blockOf = (sheet, name) => new RegExp(`\\.${name} \\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';
const HOVER = /\.input:not\(:has\(:disabled\)\) \.input-clear:hover \{\n\s*color: var\(--input-clear-hover\);\n\}/;

test('the exported clear icon is the clear size and the placeholder colour, with a pointer cursor', () => {
    const block = blockOf(css(), 'input-clear');
    assert.match(block, /color: var\(--input-placeholder\);/);
    assert.match(block, /width: var\(--input-clear-icon-size\);/);
    assert.match(block, /height: var\(--input-clear-icon-size\);/);
    assert.match(block, /cursor: pointer;/);
    assert.doesNotMatch(block, /--input-fg/, 'not the foreground');
});

test('the exported clear icon has a hover rule with the hover token, and the other icons have none', () => {
    const sheet = css();
    assert.match(sheet, HOVER);
    assert.doesNotMatch(sheet, /input-prefixIcon:hover|input-suffixIcon:hover/);
});

test('the exported stylesheet holds the clear size as the icon size minus 2 in every Size mode, and a hover colour in every Variant mode', () => {
    const sheet = css();
    const iconItem = model.items.find(i => i.collectionId === model.ids.size && i.name === 'iconSize');
    const clearItem = model.items.find(i => i.collectionId === model.ids.size && i.name === 'clearIconSize');
    assert.ok(clearItem, 'the fixture holds the clear icon size');
    const size = model.collections.find(c => c.id === model.ids.size);
    for (const mode of size.modes) {
        const at = c => (c.id === size.id ? mode.id : c.modes[0].id);
        const icon = variableValue(variables, iconItem, at), clear = variableValue(variables, clearItem, at);
        assert.equal(clear, icon - 2, `${mode.id}: fixture clear ${clear} = icon ${icon} - 2`);
        assert.match(sheet, new RegExp(`\\[data-size="${mode.id}"\\][^{]*\\{[^}]*--input-clear-icon-size: ${clear}px;`), `${mode.id} block holds ${clear}px`);
    }
    assert.match(sheet, /\[data-variant="outlined"\][^{]*\{[^}]*--input-clear-hover: #[0-9a-f]{6,8};/);
});

test('Play carries the same stylesheet: the hover rule and the clear size, and draws the clear icon from it, not inline', () => {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 32, fills: [], layout: 'horizontal', component: true };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const copies = instanceOf(input, frame, made.created, { allowClear: true, value: 'Hello' }, { id: idOf });
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, ...made.created, ...copies] }], variables }, copies[0].id);
    assert.deepEqual(problems, []);
    assert.match(styles, HOVER, 'the hover rule is in Play\'s stylesheet');
    const el = root.children.find(c => c.attrs?.class === 'input-clear');
    assert.ok(el, 'the clear icon is drawn');
    assert.equal(el.style.color, undefined, 'no inline colour: it would beat the hover rule');
    assert.equal(el.style.cursor, undefined, 'the cursor comes from the class');
    assert.equal(el.attrs.hidden, false);
});

test('hover is Play and export only: the registry says it has no static canvas visual, and the canvas keeps the rest colour', () => {
    const entry = INPUT.playOnly.find(p => p.id === 'clear-hover');
    assert.ok(entry, 'registered as play-only');
    assert.equal(entry.reason, 'hover has no static canvas visual');
    const targets = iconSlotTargets(input, 'clear');
    assert.equal(targets.colour.name, 'placeholder', 'the canvas binds the rest colour only');
});
