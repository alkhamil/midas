// Text (antd Typography.Text): Type picks the colour, Size and strong the text style, italic and the decoration lines are node fields of the label, code and mark
// style the root frame itself (a fill, a padding, a radius and a border a state swaps in), disabled takes the disabled colour. The canvas, Play and the export read the
// same props; the label is a managed layer, made while the text is not empty.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { planStateBindings } from '../src/behavior-engine/state-bindings.js';
import { planManagedTextBindings } from '../src/behavior-engine/bind-tokens.js';
import { typographyOf } from '../src/behavior-engine/typography.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { varsWithOp } from '../src/behavior-engine/edits.js';
import { literalFields, decorationLinesOf } from '../src/behavior-engine/display.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEXT_TYPES } from '../src/templates/typography-base.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf } from './helpers/play-geometry.js';

const text = TEMPLATES.get('antd-text');
const model = modelFor(text);
const exported = generateComponent(model.template, model.binding, model.variables, 'Text', model.frame, id => model.created.filter(n => n.parentId === id));

/** The mode of each variable prop: the asked one (a name) or the prop's default. */
function modesFor(props) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = props[prop] ?? text.props[prop].defaultMode;
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
}

/** A node's value in these modes: the bound variable's value, else the node's own field. */
function canvasOf(node, key, modes) {
    const item = model.variables.items.find(i => i.id === node.vars?.[key]);
    if (!item) return node[key];
    return variableValue(model.variables, item, c => {
        const dim = Object.keys(model.binding.variables).find(d => model.binding.variables[d] === c.id);
        return dim ? modes[dim] : c.modes[0].id;
    });
}

/** An instance as the canvas holds it for these props: its layers, with the root's bindings moved to the state tokens the props turn on (what the studio's sync writes). */
function canvasInstance(props) {
    const nodes = instanceFor(model, props);
    const resolved = resolveProps(text, props);
    const { ops } = planStateBindings({ template: text, binding: model.binding, props: resolved, layers: [{ key: 'root', instance: nodes[0], master: model.frame }], variables: model.variables });
    for (const op of ops) nodes[0].vars = varsWithOp(nodes[0].vars, op);
    // The managed label has no master layer: its bindings are the instance's own (the colour of the Type, the style of the Size or of strong).
    const label = nodes.find(n => n.name === 'label');
    if (label) for (const op of planManagedTextBindings({ template: text, binding: model.binding, props: resolved, layers: [{ key: 'label', node: label }], variables: model.variables }).ops) label.vars = { ...label.vars, [op.varKey]: op.itemId };
    return nodes;
}

const rootValues = (props, type = 'default') => {
    const [root] = canvasInstance(props);
    const modes = modesFor({ type });
    return { padding: canvasOf(root, 'padH', modes), paddingY: canvasOf(root, 'padV', modes), radius: canvasOf(root, 'radius', modes), border: canvasOf(root, 'strokeWidth', modes), fill: canvasOf(root, 'fills.0', modes), stroke: canvasOf(root, 'stroke', modes) };
};

/** The Play tree of an instance. */
function playOf(props) {
    const nodes = canvasInstance(props);
    nodes[0].varModes = Object.fromEntries(Object.entries(modesFor(props)).map(([prop, mode]) => [model.binding.variables[prop], mode]));
    nodes[0].parentId = 'top';
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const found = elementsOf(root);
    return { nodes, styles, root, found, rootEl: found.find(({ el }) => el.attrs?.class === 'antd-text'), labelEl: found.find(({ el }) => el.attrs?.class === 'antd-text-label') };
}

test('Text is registered with Type and Size modes and the props the panel shows', () => {
    assert.ok(text, 'Text is in the registry');
    assert.deepEqual(validateTemplateSchema(text), []);
    assert.equal(text.primarySlot, 'label');
    assert.deepEqual(text.props.type.modes, TEXT_TYPES);
    assert.deepEqual(Object.keys(text.props).filter(p => text.props[p].source === 'literal'), ['label', 'strong', 'italic', 'underline', 'strikethrough', 'code', 'mark', 'disabled']);
});

test('the label is a managed layer: made while the text is not empty, removed when it is empty', () => {
    assert.deepEqual(instanceFor(model, {}).slice(1).map(n => n.name), ['label']);
    assert.deepEqual(instanceFor(model, { label: '' }).slice(1).map(n => n.name), []);
});

test('italic writes the label font style, and turning it off writes normal', () => {
    const fields = props => Object.fromEntries(literalFields(text, resolveProps(text, props)).map(f => [f.field, f.value]));
    assert.equal(fields({ italic: true }).fontStyle, 'italic');
    assert.equal(fields({}).fontStyle, 'normal');
    assert.equal(instanceFor(model, { italic: true }).find(n => n.name === 'label').fontStyle, 'italic');
});

test('underline and strikethrough compose into the one text decoration value, in every combination', () => {
    const decoration = props => instanceFor(model, props).find(n => n.name === 'label').textDecoration;
    assert.equal(decoration({}), 'none');
    assert.equal(decoration({ underline: true }), 'underline');
    assert.equal(decoration({ strikethrough: true }), 'line-through');
    assert.equal(decoration({ underline: true, strikethrough: true }), 'underline line-through');
    assert.deepEqual(decorationLinesOf('underline line-through'), { underline: true, strike: true });
    assert.deepEqual(decorationLinesOf('none'), { underline: false, strike: false });
});

test('Type swaps the label colour: each type resolves its own Semantic colour through the fg token', () => {
    const label = canvasInstance({}).find(n => n.name === 'label');
    assert.equal(model.variables.items.find(i => i.id === label.vars['fills.0']).name, 'fg');
    const colours = TEXT_TYPES.map(type => canvasOf(label, 'fills.0', modesFor({ type })));
    assert.equal(new Set(colours).size, TEXT_TYPES.length, 'five types, five colours');
    const typeCollection = model.variables.collections.find(c => c.id === model.binding.variables.type);
    for (const type of TEXT_TYPES) assert.ok(exported.files['Text.css'].includes('.antd-text[data-type="' + typeCollection.modes.find(m => m.name === type).id + '"]'), type + ' has its rule in the export');
});

test('Size swaps the text style (five sizes, five font sizes) and strong swaps to a heavier weight of the same size', () => {
    const styleOf = (props, size = 'md') => {
        const label = canvasInstance(props).find(n => n.name === 'label');
        const item = model.variables.items.find(i => i.id === label.vars.typography);
        const modes = modesFor({ size });
        return typographyOf(model.variables, item, c => { const dim = Object.keys(model.binding.variables).find(d => model.binding.variables[d] === c.id); return dim ? modes[dim] : c.modes[0].id; }).style;
    };
    const sizes = ['xs', 'sm', 'md', 'lg', 'xl'].map(size => styleOf({}, size).fontSize);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b));
    assert.equal(new Set(sizes).size, 5);
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
        const plain = styleOf({}, size), strong = styleOf({ strong: true }, size);
        assert.equal(strong.fontSize, plain.fontSize, 'the size is kept');
        assert.equal(strong.lineHeight, plain.lineHeight, 'the line height is kept');
        assert.notEqual(strong.fontWeight, plain.fontWeight, 'the weight changes');
    }
    assert.match(exported.files['Text.css'], /[data-strong][^{]*{[^}]*--antd-text-label-typography-font-weight:/, 'the export swaps the weight too');
});

test('code gives the root a fill, a padding, a radius and a border on the canvas, and turning it off restores the plain values', () => {
    const plain = rootValues({});
    assert.equal(plain.padding, 0);
    assert.equal(plain.paddingY, 0);
    assert.equal(plain.radius, 0);
    assert.equal(plain.border, 0);
    const code = rootValues({ code: true });
    assert.ok(code.padding > 0, 'a padding');
    assert.ok(code.paddingY > 0, 'a vertical padding, so the border (inside the box on the canvas) does not sit on the text');
    assert.ok(code.radius > 0, 'a radius');
    assert.ok(code.border > 0, 'a border');
    assert.notEqual(code.fill, plain.fill, 'a fill');
    assert.notEqual(code.stroke, plain.stroke, 'a border colour');
    assert.deepEqual(rootValues({ code: false }), plain);
});

test('mark gives the root the highlight fill only, and code and mark combine: mark wins the fill, code keeps its box', () => {
    const plain = rootValues({}), mark = rootValues({ mark: true }), both = rootValues({ code: true, mark: true }), code = rootValues({ code: true });
    assert.notEqual(mark.fill, plain.fill);
    assert.equal(mark.padding, 0);
    assert.equal(mark.paddingY, 0);
    assert.equal(mark.border, 0);
    assert.equal(both.fill, mark.fill, 'mark is declared after code, so its fill wins');
    assert.equal(both.padding, code.padding);
    assert.equal(both.radius, code.radius);
    assert.equal(both.border, code.border);
    assert.deepEqual(rootValues({ code: true, mark: true }, 'danger').padding, code.padding);
});

test('code and mark add no layer: the instance holds the root and its label whatever the styles', () => {
    for (const props of [{}, { code: true }, { mark: true }, { code: true, mark: true, strong: true, italic: true, underline: true, strikethrough: true, disabled: true }]) {
        assert.deepEqual(instanceFor(model, props).map(n => n.name), ['Text', 'label']);
    }
});

test('disabled takes the disabled colour for the label', () => {
    const { ops } = planStateBindings({ template: text, binding: model.binding, props: resolveProps(text, { disabled: true }), layers: [{ key: 'label', instance: { id: 'l', vars: instanceFor(model, {})[1].vars }, master: { vars: instanceFor(model, {})[1].vars } }], variables: model.variables });
    assert.equal(model.variables.items.find(i => i.id === ops.find(o => o.prop === 'fills.0')?.value)?.name, 'fg-disabled');
});

test('the export is clean (no problems, no unsupported slot) and draws every text style from the root attributes', () => {
    const out = generateComponent(model.template, model.binding, model.variables, 'Text', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    const jsx = out.files['Text.jsx'], css = out.files['Text.css'];
    assert.match(jsx, /data-italic=\{italic \|\| undefined\}/);
    assert.match(jsx, /data-underline=\{underline \|\| undefined\}/);
    assert.match(jsx, /data-strikethrough=\{strikethrough \|\| undefined\}/);
    assert.match(css, /\.antd-text\[data-italic\] \.antd-text-label \{\s*font-style: italic;/);
    assert.match(css, /\.antd-text\[data-underline\] \.antd-text-label \{\s*text-decoration: underline;/);
    assert.match(css, /\.antd-text\[data-underline\]\[data-strikethrough\] \.antd-text-label \{\s*text-decoration: underline line-through;/);
});

test('the export reads the code box from tokens: the border width is a custom property and the padding takes it off', () => {
    const css = exported.files['Text.css'];
    assert.match(css, /\.antd-text \{[^}]*border-width: var\(--antd-text-border-width\);/);
    assert.match(css, /padding-inline: max\(0px, calc\(var\(--antd-text-padding-x\) - var\(--antd-text-border-width\)\)\);/);
    assert.match(css, /\[data-code\] \{[^}]*--antd-text-border-width: 1px;[^}]*--antd-text-padding-x: 4px;[^}]*--antd-text-radius: 4px;/);
    assert.doesNotMatch(css, /\[data-code\]:not/, 'a marker carries no disabled guard');
});

test('Play draws the same: the root class and data attributes, the label font style and decoration, the code box from the same tokens', () => {
    const play = playOf({ italic: true, underline: true, strikethrough: true, code: true });
    assert.equal(play.rootEl.el.attrs['data-code'], true);
    assert.equal(play.rootEl.el.attrs['data-italic'], '');
    assert.equal(play.labelEl.el.style.fontStyle, 'italic');
    assert.equal(play.labelEl.el.style.textDecoration, 'underline line-through');
    assert.match(play.styles, /\.antd-text\[data-underline\]\[data-strikethrough\]/);
    const root = styleOf(play.styles, play.rootEl.chain);
    assert.ok(root, 'the root rule is in the stylesheet');
});
