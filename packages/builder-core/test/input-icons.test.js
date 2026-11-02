// The Input's prefix and suffix icons: each is the icon size wide and high (fixed, never hugging) and the foreground colour, in the slot and
// in the vector paths of the icon swapped into it, on the canvas bindings, in Play and in the export.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { iconSlotBindings, iconSlotTargets } from '../src/behavior-engine/icon-slot.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { inputModel } from '../../../scripts/input-model.mjs';
import { buttonModel } from '../../../scripts/button-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
let seq = 0;
const idOf = key => `ii-${key}-${++seq}`;

/** The generated master of the Input, and the exported stylesheet. */
function exported(template = input, m = model) {
    const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(template, { frame, children: [], binding: m.binding, variables: { collections: m.collections, items: m.items }, idOf });
    return generateComponent(template, m.binding, { collections: m.collections, items: m.items }, template.name, frame, id => made.created.filter(c => c.parentId === id)).files[`${template.name}.css`];
}
const blockOf = (css, name) => new RegExp(`\\.${name} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';

test('the prefix and suffix icon follow the icon size and the foreground tokens, in the variable collections the icon slots bind', () => {
    for (const slot of ['prefixIcon', 'suffixIcon']) {
        assert.deepEqual(iconSlotTargets(input, slot), {
            colour: { name: 'fg', dimension: 'variant' },
            disabledColour: { name: 'fg-disabled', dimension: 'variant' },
            size: { name: 'iconSize', dimension: 'size' },
        }, slot);
    }
});

test('the exported prefix and suffix icon are the icon size wide and high and take the foreground colour', () => {
    const css = exported();
    for (const slot of ['prefixIcon', 'suffixIcon']) {
        const block = blockOf(css, `input-${slot}`);
        assert.match(block, /width: var\(--input-icon-size\);/, `${slot} width`);
        assert.match(block, /height: var\(--input-icon-size\);/, `${slot} height`);
        assert.match(block, /color: var\(--input-fg\);/, `${slot} colour`);
    }
});

test('the disabled state changes the foreground token the icons read, so a disabled Input\'s icons take the disabled colour', () => {
    const css = exported();
    assert.match(css, /:has\(:disabled\) \{[^}]*--input-fg: #[0-9a-f]{6,8};/);
});

test('Button\'s icons take the foreground colour in the export too: one rule for every icon slot', () => {
    const bm = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const css = exported(TEMPLATES.get('button'), bm);
    for (const slot of ['iconStart', 'iconEnd']) assert.match(blockOf(css, `button-${slot}`), /color: var\(--button-fg\);/, slot);
});

test('Play draws the icon slot in the foreground colour, and the vector paths of the swapped icon follow it, fill and stroke', () => {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 32, fills: [], layout: 'horizontal', component: true };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const copies = instanceOf(input, frame, made.created, { hasPrefix: true, prefixKind: 'icon', prefixIcon: 'x' }, { id: idOf });
    const slot = copies.find(c => c.behavior?.slot === 'prefixIcon');
    const solid = [{ type: 'solid', color: '#111111', opacity: 1, visible: true }];
    const glyph = { id: 'g1', name: 'glyph', type: 'path', parentId: slot.id, x: 0, y: 0, w: 10, h: 10, fills: solid, vars: { 'fills.0': 'v-fg' }, stroke: '#222222', strokeWidth: 0, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true };
    const stroke = { id: 'g2', name: 'stroke', type: 'path', parentId: slot.id, x: 0, y: 0, w: 10, h: 10, fills: [], vars: { stroke: 'v-fg' }, stroke: '#222222', strokeWidth: 1, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], closed: false };
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [frame, ...made.created, ...copies, glyph, stroke] }], variables }, copies[0].id);
    assert.deepEqual(problems, []);
    const el = root.children.find(c => c.attrs?.class === 'input-prefixIcon');
    assert.equal(el.style.color, undefined, 'the colour comes from the class, so a hover rule can win');
    assert.match(styles, /\.input-prefixIcon \{[^}]*color: var\(--input-fg\);/);
    const [filled, stroked] = el.children.map(c => c.html);
    assert.match(filled, /fill="currentColor"/, 'a bound fill follows the slot colour');
    assert.match(stroked, /stroke="currentColor"/, 'a bound stroke follows it too');
});

test('swapping the icon keeps the size on the slot and the colour on every vector of the new icon, and the disabled colour when disabled', () => {
    const ids = { fg: 'v-fg', fgDisabled: 'v-fg-disabled', size: 's-iconSize', names: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } };
    const icon = (...layers) => [{ id: 'icon', fillIndexes: [], stroke: false }, ...layers];
    const first = icon({ id: 'a', fillIndexes: [0], stroke: false }, { id: 'b', fillIndexes: [], stroke: true });
    const second = icon({ id: 'c', fillIndexes: [0, 1], stroke: false }, { id: 'd', fillIndexes: [0], stroke: true }, { id: 'e', fillIndexes: [], stroke: true });
    for (const layers of [first, second]) {
        const rest = iconSlotBindings({ ...ids, disabled: false, layers });
        assert.deepEqual(rest.slot, { w: 's-iconSize', h: 's-iconSize' }, 'the slot is the icon size');
        const byId = Object.fromEntries(rest.layers.map(l => [l.id, l.vars]));
        for (const layer of layers.slice(1)) {
            for (const i of layer.fillIndexes) assert.equal(byId[layer.id][`fills.${i}`], 'v-fg', `${layer.id} fill ${i}`);
            if (layer.stroke && layer.fillIndexes.length === 0) assert.equal(byId[layer.id].stroke, 'v-fg', `${layer.id} stroke`);
        }
        const off = iconSlotBindings({ ...ids, disabled: true, layers });
        for (const l of off.layers) for (const v of Object.values(l.vars)) assert.equal(v, 'v-fg-disabled');
    }
});

test('the generated prefix and suffix icon layers are fixed on both axes', () => {
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const copies = instanceOf(input, frame, made.created, { hasPrefix: true, prefixKind: 'icon', hasSuffix: true, suffixKind: 'icon' }, { id: idOf });
    for (const slot of ['prefixIcon', 'suffixIcon']) {
        const layer = copies.find(c => c.behavior?.slot === slot);
        assert.deepEqual([layer.layoutSizingH, layer.layoutSizingV], ['fixed', 'fixed'], slot);
    }
});
