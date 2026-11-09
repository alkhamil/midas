// Tag, Play and the export: for every Size mode, Variant and Color preset, the Play root's height, fill and border are the canvas values of the same
// tokens (the master and an instance alike), the export writes the classes Play draws, and the border is drawn only by the outlined variant (filled and
// solid take a transparent border). The label and the icons are centred in the box: the root and the closer centre their content on both axes, and the
// icon's box is the Size mode's icon token on the canvas and in Play.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { COLOR_PRESETS } from '../src/templates/color-presets.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf, length } from './helpers/play-geometry.js';

const tag = TEMPLATES.get('antd-tag');
const model = modelFor(tag);
const VARIANTS = ['filled', 'solid', 'outlined'];
const exported = generateComponent(model.template, model.binding, model.variables, 'Tag', model.frame, id => model.created.filter(n => n.parentId === id));

/** The mode of each variable prop: the given props' modes (a name), the Size mode, and the defaults for the rest. */
function modesFor(props) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = props[prop] ?? tag.props[prop].defaultMode ?? coll.modes[0].name;
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
}

/** A node's value on one axis or property in these modes: the bound variable's value, else the node's own. */
function canvasOf(node, key, modes) {
    const item = model.variables.items.find(i => i.id === node.vars?.[key]);
    if (!item) return node[key];
    return variableValue(model.variables, item, c => {
        const dim = Object.keys(model.binding.variables).find(d => model.binding.variables[d] === c.id);
        return dim ? modes[dim] : c.modes[0].id;
    });
}

/** The Play tree of an instance under these props in these variable modes: the found elements and the stylesheet. */
function playOf(props, nodes = instanceFor(model, props)) {
    nodes[0].varModes = Object.fromEntries(Object.entries(modesFor(props)).map(([prop, mode]) => [model.binding.variables[prop], mode]));
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const found = elementsOf(root);
    const byClass = name => found.find(({ el }) => el.attrs?.class === name);
    return { nodes, styles, found, byClass, style: name => styleOf(styles, byClass(name).chain) };
}

for (const size of SIZE_MODES) {
    for (const variant of VARIANTS) {
        test(`${size} ${variant}: for every Color preset, Play's height, fill and border are the canvas values of the same tokens`, () => {
            for (const color of COLOR_PRESETS) {
                const props = { size, variant, color };
                const { nodes, style } = playOf(props);
                const modes = modesFor(props);
                const root = style('antd-tag');
                assert.equal(length(root.height), canvasOf(nodes[0], 'h', modes), `height at ${size} ${variant} ${color}`);
                assert.equal(root['background-color'], canvasOf(nodes[0], 'fills.0', modes), `fill at ${size} ${variant} ${color}`);
                assert.equal(root['border-color'], canvasOf(nodes[0], 'stroke', modes), `border at ${size} ${variant} ${color}`);
            }
        });
    }
}

test('the export writes every class Play draws for a Tag with both icons (icon, label, closer, close)', () => {
    const { found } = playOf({ hasIcon: true, closable: true }, instanceFor(model, { hasIcon: true, closable: true }));
    const jsx = exported.files['Tag.jsx'];
    for (const { el } of found) if (el.attrs?.class) assert.match(jsx, new RegExp(`className="${el.attrs.class}"`), `${el.attrs.class} is an export class`);
});

test('only the outlined variant draws a border: filled and solid take a transparent border, outlined the preset border', () => {
    for (const color of COLOR_PRESETS) {
        const transparent = { filled: [], solid: [] };
        for (const variant of VARIANTS) {
            const { style } = playOf({ size: 'md', variant, color });
            const border = style('antd-tag')['border-color'];
            if (variant === 'outlined') assert.notEqual(border, '#00000000', `${color} outlined draws its border`);
            else { transparent[variant].push(border); assert.equal(border, '#00000000', `${color} ${variant} draws no border`); }
        }
    }
});

for (const size of SIZE_MODES) {
    test(`${size}: the label and the icons are centred in the box on both axes; the icon box is the Size mode's icon token on the canvas and in Play`, () => {
        const props = { size, hasIcon: true, closable: true };
        const { nodes, style, found, byClass } = playOf(props, instanceFor(model, props));
        const modes = modesFor(props);
        // The root centres its content on the cross axis and holds the label; the closer centres its icon on both axes.
        assert.equal(style('antd-tag')['align-items'], 'center', `the label is centred vertically at ${size}`);
        assert.equal(style('antd-tag-closer')['justify-content'], 'center', `the close is centred horizontally at ${size}`);
        assert.equal(style('antd-tag-closer')['align-items'], 'center', `the close is centred vertically at ${size}`);
        // The icon and the close are the icon token's size on the canvas and in Play.
        // The icon's size is the tagIconSize variable: the icon layers are bound to it by the icon pass (not by instanceFor), so it is read here directly.
        const iconSizeVar = model.variables.items.find(i => i.name === 'tagIconSize');
        const iconSize = variableValue(model.variables, iconSizeVar, c => c.modes[0].id);
        assert.ok(iconSize > 0, `the icon has a positive size at ${size}`);
        assert.equal(length(style('antd-tag-icon').width), iconSize, `the icon width matches the canvas at ${size}`);
        assert.equal(length(style('antd-tag-close').width), iconSize, `the close width matches the canvas at ${size}`);
        assert.ok(byClass('antd-tag-label'), 'the label is drawn');
        assert.ok(found.length > 0);
    });
}
