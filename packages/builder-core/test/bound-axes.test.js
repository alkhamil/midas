// A dimension bound to a variable is fixed: the axis takes the variable's value in every Size mode, so hug and fill cannot survive on it.
// One rule for every node and every template: the binding writers fix the axis (fixBoundAxes), and every reader of a node's sizing asks
// one function (sizingOf) that answers `fixed` for a bound axis, so the layout pass, Play and the export cannot disagree with the data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sizingOf, fixBoundAxes } from '../src/geometry/autolayout.js';
import { planBindTokens, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { isLayoutOwnedField } from '../src/behavior-engine/instance-vars.js';
import { flowSizing } from '../src/behavior-engine/layout.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

test('sizingOf answers fixed for a bound axis, whatever the node says, and the node\'s own sizing for an unbound one', () => {
    const frame = (over = {}) => ({ type: 'frame', layoutSizingH: 'hug', layoutSizingV: 'fill', ...over });
    assert.equal(sizingOf(frame(), 'h'), 'hug');
    assert.equal(sizingOf(frame(), 'v'), 'fill');
    assert.equal(sizingOf(frame({ vars: { w: 'v-size' } }), 'h'), 'fixed', 'a bound width is fixed');
    assert.equal(sizingOf(frame({ vars: { w: 'v-size' } }), 'v'), 'fill', 'the other axis keeps its own sizing');
    assert.equal(sizingOf(frame({ vars: { h: 'v-size' } }), 'v'), 'fixed', 'a bound height is fixed');
    assert.equal(sizingOf({ type: 'text', autoW: true, vars: { w: 'v' } }, 'h'), 'fixed', 'a text layer too');
    assert.equal(sizingOf({ type: 'text', autoW: true }, 'h'), 'hug', 'the text default stays');
    assert.equal(sizingOf({ type: 'text' }, 'v'), 'hug');
    assert.equal(sizingOf({ type: 'rect' }, 'h'), 'fixed');
});

test('fixBoundAxes writes fixed on a bound axis only, and says whether it changed anything', () => {
    const n = { type: 'frame', layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { w: 'a', h: 'a' } };
    assert.equal(fixBoundAxes(n), true);
    assert.deepEqual([n.layoutSizingH, n.layoutSizingV], ['fixed', 'fixed']);
    assert.equal(fixBoundAxes(n), false, 'a second call changes nothing');
    const onlyWidth = { type: 'frame', layoutSizingH: 'fill', layoutSizingV: 'hug', vars: { w: 'a' } };
    fixBoundAxes(onlyWidth);
    assert.deepEqual([onlyWidth.layoutSizingH, onlyWidth.layoutSizingV], ['fixed', 'hug']);
    const unbound = { type: 'frame', vars: { 'fills.0': 'c' } };
    assert.equal(fixBoundAxes(unbound), false);
    assert.equal('layoutSizingH' in unbound, false, 'an unbound node gets no sizing field');
});

test('Bind tokens fixes a layer whose width and height it binds, on a hug layer', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const template = TEMPLATES.get('button');
    const node = { type: 'frame', layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const layers = [{ key: 'spinner', node }];
    const { ops } = planBindTokens({ template, binding: model.binding, layers, variables: { collections: model.collections, items: model.items } });
    assert.deepEqual(ops.map(o => o.varKey).sort(), ['h', 'stroke', 'w']);
    applyBindTokens(layers, ops);
    assert.ok(node.vars.w && node.vars.h, 'the size is bound');
    assert.deepEqual([node.layoutSizingH, node.layoutSizingV], ['fixed', 'fixed']);
});

test('an axis that is already bound but still hugs is fixed by the next bind, not kept', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const template = TEMPLATES.get('button');
    const size = model.items.find(i => i.name === 'iconSize');
    const node = { type: 'frame', layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { w: size.id, h: size.id } };
    const layers = [{ key: 'spinner', node }];
    applyBindTokens(layers, planBindTokens({ template, binding: model.binding, layers, variables: { collections: model.collections, items: model.items } }).ops);
    assert.deepEqual([node.layoutSizingH, node.layoutSizingV], ['fixed', 'fixed']);
});

test('a layer bound on an axis is not layout-owned on it: the layout engine does not rewrite its size', () => {
    const parent = { type: 'frame', layout: 'horizontal' };
    assert.equal(isLayoutOwnedField({ type: 'frame', layoutSizingH: 'hug' }, parent, 'w'), true);
    assert.equal(isLayoutOwnedField({ type: 'frame', layoutSizingH: 'hug', vars: { w: 'v' } }, parent, 'w'), false);
    assert.equal(isLayoutOwnedField({ type: 'frame', layoutSizingH: 'fill', vars: { w: 'v' } }, parent, 'w'), false);
    assert.equal(isLayoutOwnedField({ type: 'frame', layoutSizingV: 'hug', vars: { w: 'v' } }, parent, 'h'), true, 'the other axis still is');
});

test('Play sizes a child bound on an axis at its value, never hugging or filling', () => {
    const parent = { type: 'frame', layout: 'horizontal', layoutSizingH: 'fixed', layoutSizingV: 'fixed' };
    const hug = flowSizing({ type: 'frame', w: 14, h: 14, layoutSizingH: 'hug', layoutSizingV: 'hug', vars: { w: 'v', h: 'v' } }, parent);
    assert.deepEqual([hug.width, hug.height, hug.flexShrink], ['14px', '14px', '0']);
    const fill = flowSizing({ type: 'frame', w: 14, h: 14, layoutSizingH: 'fill', layoutSizingV: 'fill', vars: { w: 'v', h: 'v' } }, parent);
    assert.deepEqual([fill.width, fill.height, fill.flex, fill.alignSelf], ['14px', '14px', undefined, undefined]);
    const free = flowSizing({ type: 'frame', w: 14, h: 14, layoutSizingH: 'hug', layoutSizingV: 'hug' }, parent);
    assert.deepEqual([free.width, free.height], [undefined, undefined], 'unbound hug is unchanged');
});

test('a generated slot layer that a size token drives is created fixed, not hugging', () => {
    for (const [id, make, props, slots] of [
        ['button', buttonModel, { hasIcon: true, iconPlacement: 'start' }, ['iconStart']],
        ['input', inputModel, { hasPrefix: true, prefixKind: 'icon', hasSuffix: true, suffixKind: 'icon', allowClear: true, value: 'x' }, ['prefixIcon', 'suffixIcon', 'clear']],
    ]) {
        const template = TEMPLATES.get(id), model = make();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        let n = 0;
        const made = applyTemplateToFrame(template, { frame, children: [], binding: model.binding, variables: { collections: model.collections, items: model.items }, idOf: k => `${k}-${++n}` });
        const copies = instanceOf(template, frame, made.created, props, { id: k => `i-${k}-${++n}` });
        for (const slot of slots) {
            const layer = copies.find(c => c.behavior?.slot === slot);
            assert.ok(layer, `${id} instance has ${slot}`);
            assert.deepEqual([layer.layoutSizingH, layer.layoutSizingV], ['fixed', 'fixed'], `${id} ${slot} is fixed`);
        }
    }
});

test('the exported icon slots are fixed to the icon size token, which holds the variable value in every Size mode', () => {
    const model = inputModel();
    const input = TEMPLATES.get('input');
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    let n = 0;
    const variables = { collections: model.collections, items: model.items };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf: k => `${k}-${++n}` });
    const css = generateComponent(input, model.binding, variables, 'Input', frame, id => made.created.filter(c => c.parentId === id)).files['Input.css'];
    for (const slot of ['prefixIcon', 'suffixIcon']) {
        const block = new RegExp(`\\.input-${slot} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
        assert.match(block, /width: var\(--input-icon-size\);/);
        assert.match(block, /height: var\(--input-icon-size\);/);
    }
    const sizeItem = model.items.find(i => i.collectionId === model.ids.size && i.name === 'iconSize');
    const collection = model.collections.find(c => c.id === model.ids.size);
    for (const mode of collection.modes) {
        const value = variableValue(variables, sizeItem, c => (c.id === collection.id ? mode.id : c.modes[0].id));
        assert.equal(typeof value, 'number', `${mode.id} resolves to a number`);
        assert.match(css, new RegExp(`\\[data-size="${mode.id}"\\][^{]*\\{[^}]*--input-icon-size: ${value}px;`), `the ${mode.id} block holds ${value}px`);
    }
    assert.deepEqual(collection.modes.map(m => m.id), SIZE_MODES);
});
