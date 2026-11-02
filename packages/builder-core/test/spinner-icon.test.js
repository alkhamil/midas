// The Button's spinner and its icons are one class of part: each is the icon size (width and height) and the foreground colour. They share
// one definition (ICON_TOKENS), one binding function (iconSlotBindings, with the disabled colour) and one export rule, on the canvas, in
// Play and in the export, at every Size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON } from '../src/templates/button.js';
import { INPUT } from '../src/templates/input.js';
import { ICON_TOKENS } from '../src/templates/icon-slots.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { iconSlotBindings, iconSlotTargets } from '../src/behavior-engine/icon-slot.js';
import { iconBoundKeysOf } from '../src/behavior-engine/anatomy.js';
import { planBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const clone = o => structuredClone(o);
const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
const variables = { collections: model.collections, items: model.items };
const sizeCollection = model.collections.find(c => c.id === model.ids.size);

test('the spinner and the icon slots share one token definition: the icon size and the foreground colours', () => {
    assert.deepEqual(ICON_TOKENS, { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' });
    const spinner = BUTTON.parts.find(p => p.id === 'spinner');
    assert.equal(spinner.tokens, ICON_TOKENS, 'the spinner part holds the very same definition');
    for (const def of BUTTON.icons) assert.equal(def.tokens, ICON_TOKENS, `${def.slot} holds it too`);
    assert.deepEqual(BUTTON.display.spinner, { stroke: ICON_TOKENS.colour, size: ICON_TOKENS.size });
    for (const slot of ['iconStart', 'iconEnd']) assert.deepEqual(BUTTON.display[slot], { size: ICON_TOKENS.size });
});

test('the spinner and the icon slots are bound through the same function and the same variables', () => {
    assert.deepEqual(iconBoundKeysOf(BUTTON), [{ key: 'iconStart', kind: 'slot' }, { key: 'iconEnd', kind: 'slot' }, { key: 'spinner', kind: 'part' }]);
    assert.deepEqual(iconSlotTargets(BUTTON, 'spinner'), iconSlotTargets(BUTTON, 'iconStart'));
    const ids = { fg: 'v-fg', fgDisabled: 'v-fg-disabled', size: 's-iconSize', names: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } };
    const layer = { id: 'arc', fillIndexes: [], stroke: true };
    const rest = iconSlotBindings({ ...ids, disabled: false, layers: [layer] });
    assert.deepEqual(rest.slot, { w: 's-iconSize', h: 's-iconSize' });
    assert.deepEqual(rest.layers[0].vars, { stroke: 'v-fg' });
    const off = iconSlotBindings({ ...ids, disabled: true, layers: [layer] });
    assert.deepEqual(off.layers[0].vars, { stroke: 'v-fg-disabled' }, 'a disabled Button\'s spinner takes the disabled colour, as its icons do');
});

test('a part with icon tokens must name tokens of the template, and only a frame part can carry them', () => {
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
    const missing = clone(BUTTON);
    missing.parts[0].tokens = { colour: 'fg', disabledColour: 'fg-disabled', size: 'nope' };
    assert.match(validateTemplateSchema(missing).join('\n'), /part "spinner" size token "nope" is not a token/);
    const text = clone(INPUT);
    text.parts.find(p => p.id === 'count').tokens = ICON_TOKENS;
    assert.match(validateTemplateSchema(text).join('\n'), /part "count" has icon tokens but is not a frame part/);
});

test('Bind tokens binds the spinner\'s size and colour to the variables the icon slots use, in every Size mode', () => {
    const spinnerNode = { type: 'frame', layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { ops } = planBindTokens({ template: BUTTON, binding: model.binding, layers: [{ key: 'spinner', node: spinnerNode }], variables });
    const size = model.items.find(i => i.collectionId === model.ids.size && i.name === 'iconSize');
    const fg = model.items.find(i => i.collectionId === model.ids.variant && i.name === 'fg') ?? model.items.find(i => i.name === 'fg');
    assert.ok(ops.some(o => o.varKey === 'w' && o.itemId === size.id) && ops.some(o => o.varKey === 'h' && o.itemId === size.id), 'width and height are the icon size');
    assert.ok(ops.some(o => o.varKey === 'stroke' && o.itemId === fg.id), 'the stroke is the foreground colour');
    for (const mode of sizeCollection.modes) {
        const value = variableValue(variables, size, c => (c.id === sizeCollection.id ? mode.id : c.modes[0].id));
        assert.equal(typeof value, 'number', `${mode.id}: the icon size is a number`);
    }
});

/** The stylesheet of the Button. */
function cssOf() {
    const frame = { id: 'master', name: 'Button', type: 'frame', parentId: null, fills: [] };
    let n = 0;
    const made = applyTemplateToFrame(BUTTON, { frame, children: [], binding: model.binding, variables, idOf: k => `${k}-${++n}` });
    return generateComponent(BUTTON, model.binding, variables, 'Button', frame, id => made.created.filter(c => c.parentId === id)).files['Button.css'];
}

test('the export gives the spinner the icon size and the foreground colour: the arc draws with currentColor, so the colour is `color`', () => {
    const css = cssOf();
    const spinner = /\.button-spinner \{([^}]*)\}/.exec(css)?.[1] ?? '';
    assert.match(spinner, /color: var\(--button-fg\);/);
    assert.match(spinner, /width: var\(--button-icon-size\);/);
    assert.match(spinner, /height: var\(--button-icon-size\);/);
    assert.doesNotMatch(spinner, /border-color/, 'an SVG arc has no border');
    const slot = /\.button-iconStart \{([^}]*)\}/.exec(css)[1];
    assert.equal(/width: (var\([^)]*\));/.exec(slot)[1], /width: (var\([^)]*\));/.exec(spinner)[1], 'the same size variable');
});

test('the spinner and the icon slots hold the same size in every Size mode of the exported stylesheet', () => {
    const css = cssOf();
    const size = model.items.find(i => i.collectionId === model.ids.size && i.name === 'iconSize');
    for (const mode of sizeCollection.modes) {
        const value = variableValue(variables, size, c => (c.id === sizeCollection.id ? mode.id : c.modes[0].id));
        assert.match(css, new RegExp(`\\[data-size="${mode.id}"\\][^{]*\\{[^}]*--button-icon-size: ${value}px;`), `${mode.id}: ${value}px`);
    }
});

test('Play draws the spinner at the icon size in every Size mode, whatever its sizing was, in the foreground colour', () => {
    const size = model.items.find(i => i.collectionId === model.ids.size && i.name === 'iconSize');
    for (const mode of sizeCollection.modes) {
        const value = variableValue(variables, size, c => (c.id === sizeCollection.id ? mode.id : c.modes[0].id));
        const frame = { id: 'master', name: 'Button', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 32, fills: [], component: true, layout: 'horizontal', gap: 6, padding: 12 };
        let n = 0;
        const made = applyTemplateToFrame(BUTTON, { frame, children: [], binding: model.binding, variables, idOf: k => `${k}-${++n}` });
        const copies = instanceOf(BUTTON, frame, made.created, { loading: true, label: 'Save' }, { id: k => `i-${k}-${++n}`, varModes: { [model.ids.size]: mode.id, [model.ids.variant]: 'solid', [model.ids.color]: 'primary' } });
        const arc = copies.find(c => c.behavior?.part === 'spinner');
        // The canvas has resolved the bound size into the node, as it does on a Size change; the layer was hugging before the rule.
        Object.assign(arc, { w: value, h: value, vars: { w: size.id, h: size.id }, layoutSizingH: 'hug', layoutSizingV: 'hug', stroke: '#112233' });
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [frame, ...made.created, ...copies] }], variables }, copies[0].id);
        const el = root.children.find(c => c.nodeId === arc.id);
        assert.ok(el, `${mode.id}: the spinner is drawn`);
        assert.equal(el.style.width, `${value}px`, `${mode.id} width`);
        assert.equal(el.style.height, `${value}px`, `${mode.id} height`);
        assert.match(el.html, /stroke="#112233"/, 'the arc takes the node\'s foreground colour');
    }
});
