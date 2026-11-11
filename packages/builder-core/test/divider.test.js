// Divider: a rule of vector line nodes. Horizontal it is a line, or a line, a text and a line (the text at the start, centre or end); vertical it is one line and has
// no text. The text and the lines are managed layers: made while their props ask for them, removed when they do not, never hidden. A placement shortens one side to
// its token and lets the other fill; the lines take their colour and width from tokens and their dash from the Style mode.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { resolveProps, isPropVisible } from '../src/behavior-engine/instance-props.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { borderStyleOf, variantStrokePatch } from '../src/behavior-engine/variant-style.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { strokeDashArray, strokeIsOn } from '../src/geometry/shapes.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const divider = TEMPLATES.get('antd-divider');
const model = modelFor(divider);

/** An instance under these props, with its managed layers bound to their tokens the way the studio binds them after a sync. */
const inst = props => {
    const nodes = instanceFor(model, props);
    const layers = nodes.slice(1).filter(n => n.behavior?.slot !== undefined).map(node => ({ key: node.behavior.slot, node }));
    const { ops, problems } = planManagedTextBindings({ template: divider, binding: model.binding, props: resolveProps(divider, props), layers, variables: model.variables });
    assert.deepEqual(problems, [], 'every token of the lines and the text has a variable');
    applyBindTokens(layers, ops);
    return nodes;
};
const layers = props => inst(props).slice(1).map(n => n.name);
const nodeOf = (props, name) => inst(props).find(n => n.name === name);
const item = id => model.variables.items.find(i => i.id === id);
const modeNamed = (name) => c => c.modes.find(m => m.name === name)?.id ?? c.modes[0].id;
const valueOf = (id, mode = 'small') => variableValue(model.variables, item(id), modeNamed(mode));
/** What the plan does to an instance holding `nodes` when its props become `stored`. */
const planFor = (nodes, stored) => {
    const root = nodes[0];
    const groups = new Map(nodes.filter(n => n.behavior?.group !== undefined).map(n => [n.id, n.behavior.group]));
    const children = nodes.filter(n => n !== root).map(n => ({ id: n.id, slot: n.behavior?.slot ?? null, name: n.name, component: null, ...(n.parentId === root.id || !groups.has(n.parentId) ? {} : { parent: groups.get(n.parentId) }) }));
    return planInstanceAnatomy({ binding: model.binding, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'x', type: 'frame' }], stored, children }).ops;
};

test('Divider is registered: a non-control, no disabled state, the props it declares', () => {
    assert.ok(divider, 'Divider is in the registry');
    assert.equal(divider.isControl, undefined);
    assert.equal(divider.primarySlot, 'label');
    assert.equal(divider.element.disabledState, undefined);
    assert.deepEqual(Object.keys(divider.props), ['lineStyle', 'size', 'orientation', 'hasText', 'label', 'placement', 'plain', 'isVertical', 'shortBefore', 'shortAfter']);
    assert.deepEqual(divider.props.lineStyle.modes, ['solid', 'dashed', 'dotted']);
    assert.deepEqual(divider.props.size.modes, ['small', 'middle', 'large']);
    assert.deepEqual(divider.props.orientation.options, ['horizontal', 'vertical']);
    assert.deepEqual(divider.props.placement.options, ['start', 'center', 'end']);
    assert.ok(divider.anatomy.filter(s => s.kind === 'line').every(s => s.managed && s.optional), 'every line is a managed layer');
});

test('the layers follow the props: a line alone, line + text + line, a short side at the start or the end, one vertical line', () => {
    assert.deepEqual(layers({}), ['lineBefore']);
    assert.deepEqual(layers({ hasText: true }), ['lineBefore', 'label', 'lineAfter']);
    assert.deepEqual(layers({ hasText: true, placement: 'start' }), ['lineBeforeShort', 'label', 'lineAfter']);
    assert.deepEqual(layers({ hasText: true, placement: 'end' }), ['lineBefore', 'label', 'lineAfterShort']);
    assert.deepEqual(layers({ orientation: 'vertical' }), ['lineVertical']);
    assert.ok(inst({ hasText: true }).slice(1).filter(n => n.type === 'line').length === 2 && inst({}).slice(1).every(n => n.type === 'line'), 'the rules are vector line nodes');
});

test('Text on adds the text layer and the second line; off removes both; the text stays in its prop and an empty text asks for no layer', () => {
    const horizontal = inst({});
    const on = planFor(horizontal, { hasText: true });
    assert.deepEqual(on.filter(op => op.op === 'insert').map(op => op.slot).sort(), ['label', 'lineAfter']);
    assert.equal(on.some(op => op.op === 'remove'), false, 'nothing is removed when the text is turned on');
    const withText = inst({ hasText: true, label: 'Heading' });
    assert.equal(withText.find(n => n.name === 'label').text, 'Heading');
    const off = planFor(withText, { hasText: false, label: 'Heading' });
    assert.deepEqual(off.filter(op => op.op === 'remove').map(op => withText.find(n => n.id === op.id).name).sort(), ['label', 'lineAfter']);
    assert.deepEqual(layers({ hasText: false, label: 'Heading' }), ['lineBefore'], 'off: the text is in its prop, not in a layer');
    assert.equal(nodeOf({ hasText: true, label: 'Heading' }, 'label').text, 'Heading', 'back on: the text comes back');
    assert.deepEqual(layers({ hasText: true, label: '' }), ['lineBefore', 'lineAfter'], 'an empty text has no layer; the lines stay');
});

test('switching to vertical removes the text and its lines, leaves one vertical line, and hides the text props (they resolve to their defaults)', () => {
    const before = inst({ hasText: true, placement: 'start', label: 'Heading', plain: true });
    const ops = planFor(before, { hasText: true, placement: 'start', label: 'Heading', plain: true, orientation: 'vertical' });
    assert.deepEqual(ops.filter(op => op.op === 'remove').map(op => before.find(n => n.id === op.id).name).sort(), ['label', 'lineAfter', 'lineBeforeShort']);
    assert.deepEqual(ops.filter(op => op.op === 'insert').map(op => op.slot), ['lineVertical']);
    assert.deepEqual(layers({ hasText: true, placement: 'start', label: 'Heading', plain: true, orientation: 'vertical' }), ['lineVertical']);
    const resolved = resolveProps(divider, { hasText: true, placement: 'start', plain: true, orientation: 'vertical' });
    for (const prop of ['hasText', 'label', 'placement', 'plain']) assert.equal(isPropVisible(divider, prop, resolved), false, `${prop} is hidden for a vertical divider`);
    assert.equal(resolved.hasText, false);
    assert.equal(resolved.placement, 'center');
    assert.equal(resolved.plain, false);
    // And back: the vertical line goes, the horizontal one comes.
    const vertical = inst({ orientation: 'vertical' });
    const back = planFor(vertical, {});
    assert.deepEqual(back.filter(op => op.op === 'remove').map(op => vertical.find(n => n.id === op.id).name), ['lineVertical']);
    assert.deepEqual(back.filter(op => op.op === 'insert').map(op => op.slot), ['lineBefore']);
});

test('placement sets the line lengths: the short side is its token, the other fills the rest; at the centre both fill equally', () => {
    const SHORT = valueOf(nodeOf({ hasText: true, placement: 'start' }, 'lineBeforeShort').vars.w);
    assert.equal(SHORT, 24, 'the short side is the Divider short token');
    const fills = node => node.layoutSizingH === 'fill';
    const fixed = node => node.layoutSizingH === 'fixed' && node.vars?.w !== undefined;
    // start: short first, then the text, then the rest of the row
    const start = inst({ hasText: true, placement: 'start' }).slice(1);
    assert.ok(fixed(start[0]) && fills(start[2]));
    // end: the rest of the row, then the text, then the short side
    const end = inst({ hasText: true, placement: 'end' }).slice(1);
    assert.ok(fills(end[0]) && fixed(end[2]));
    // centre: both fill, no width of their own, so they share the row equally
    const centre = inst({ hasText: true, placement: 'center' }).slice(1);
    assert.ok(fills(centre[0]) && fills(centre[2]));
    assert.equal(centre[0].vars?.w, undefined);
    assert.equal(centre[2].vars?.w, undefined);
    // The lengths a row of any width gives them (the root padding is none across, the gap between a line and the text is its token): the fixed side never grows or shrinks.
    const gap = valueOf(model.variables.items.find(i => i.name === 'textGap').id), textW = 60;
    const lengths = (rootW, placement) => {
        const free = rootW - 2 * gap - textW;
        return placement === 'start' ? [SHORT, free - SHORT] : placement === 'end' ? [free - SHORT, SHORT] : [free / 2, free / 2];
    };
    for (const rootW of [200, 343, 800]) {
        const [a, b] = lengths(rootW, 'center');
        assert.equal(a, b, `centre at ${rootW}: equal`);
        assert.deepEqual(lengths(rootW, 'start')[0], SHORT, `start at ${rootW}: the short side keeps its token`);
        assert.ok(lengths(rootW, 'start')[1] > SHORT, `start at ${rootW}: the other side is longer`);
        assert.deepEqual(lengths(rootW, 'end')[1], SHORT, `end at ${rootW}: the short side keeps its token`);
    }
});

test('no hidden layer: the master holds none, and no instance layer is hidden, transparent or a zero-size fixed one', () => {
    assert.deepEqual(model.created, [], 'every layer of a Divider is managed: the master is the empty frame');
    for (const props of [{}, { hasText: true }, { hasText: true, placement: 'start' }, { hasText: true, placement: 'end', plain: true }, { orientation: 'vertical' }, { orientation: 'vertical', hasText: true }]) {
        for (const n of inst(props).slice(1)) {
            assert.notEqual(n.visible, false, `${n.name} is shown (${JSON.stringify(props)})`);
            assert.notEqual(n.opacity, 0, `${n.name} is opaque`);
            const dead = n.w === 0 && n.h === 0 && n.layoutSizingH === 'fixed' && n.layoutSizingV === 'fixed' && !n.vars?.w && !n.vars?.h;
            assert.equal(dead, false, `${n.name} has a size`);
            assert.deepEqual(n.fills ?? [], n.type === 'line' ? [] : n.fills ?? [], 'a line has no fill: its stroke is the line');
        }
    }
});

test('a line takes its colour, its width and its length from tokens: the border colour, the line width, the short length', () => {
    const line = nodeOf({}, 'lineBefore');
    assert.equal(item(line.vars.stroke).name, 'lineColor');
    assert.equal(item(line.vars.strokeWidth).name, 'lineWidth');
    const border = model.variables.items.find(i => i.name === 'colorBorder');
    assert.ok(border, 'the base has the border colour');
    assert.equal(valueOf(line.vars.stroke), variableValue(model.variables, border, modeNamed('Base')), 'the line colour is the border colour');
    assert.equal(valueOf(line.vars.strokeWidth), 1);
    assert.equal(strokeIsOn({ ...line, stroke: valueOf(line.vars.stroke), strokeWidth: valueOf(line.vars.strokeWidth) }), true);
    const vertical = nodeOf({ orientation: 'vertical' }, 'lineVertical');
    assert.equal(vertical.layoutSizingV, 'fill', 'a vertical line fills the root height');
    assert.equal(vertical.vars?.h, undefined, 'no length token binds it');
    assert.equal(nodeOf({}, 'lineBefore').layoutSizingH, 'fill', 'a horizontal line fills the row');
    assert.equal(nodeOf({ orientation: 'vertical' }, 'lineVertical').w, 0, 'a vertical line is a line along y');
    assert.equal(nodeOf({}, 'lineBefore').h, 0, 'a horizontal line is a line along x');
});

test('the text takes the text colour and the heading typography; plain swaps the typography on the layer; the root has no padding', () => {
    const typographyOf = props => item(nodeOf({ hasText: true, ...props }, 'label').vars.typography).name;
    assert.equal(typographyOf({}), 'labelTypography');
    assert.equal(typographyOf({ plain: true }), 'plainTypography');
    assert.equal(typographyOf({ plain: false }), 'labelTypography', 'plain off: back to the heading');
    const styleOf = name => { const it = model.variables.items.find(i => i.name === name); const target = item(Object.values(it.values)[0].alias); return target.name; };
    assert.equal(styleOf('labelTypography'), 'textLgStrong');
    assert.equal(styleOf('plainTypography'), 'textBase');
    assert.equal(item(nodeOf({ hasText: true }, 'label').vars['fills.0']).name, 'labelColor');
    assert.equal(model.variables.items.some(i => i.name === 'spaceY'), false, 'no padding variable');
    assert.equal(model.frame.vars?.padV, undefined, 'the root is not padded above and below');
});

test('the Style mode sets the dash of every line: solid has none, dashed is dash 4, dotted is dots', () => {
    const modeOfName = name => ({ id: `id-${name}`, name });
    const dashOf = (mode, node = nodeOf({ hasText: true }, 'lineBefore')) => {
        const line = { ...node };
        const patch = variantStrokePatch(line, borderStyleOf(divider, { lineStyle: modeOfName(mode) }));
        return strokeDashArray(patch ? { ...line, ...patch } : line);
    };
    assert.deepEqual(dashOf('solid'), []);
    assert.deepEqual(dashOf('dashed'), [4, 4]);
    assert.deepEqual(dashOf('dotted'), [0, 3]);
    for (const name of ['lineBefore', 'lineAfter', 'lineVertical']) assert.equal(inst({ hasText: true, orientation: name === 'lineVertical' ? 'vertical' : 'horizontal' }).find(n => n.name === name).type, 'line', `${name} can take the dash`);
});

const generated = () => generateComponent(model.template, model.binding, model.variables, 'Divider', model.frame, id => model.created.filter(n => n.parentId === id));

test('the export draws every line slot: no unsupported-slot, a rule per slot by its border, the Style modes as border styles', () => {
    const out = generated();
    assert.deepEqual(out.problems, []);
    const css = out.files['Divider.css'], jsx = out.files['Divider.jsx'];
    for (const slot of ['lineBefore', 'lineBeforeShort', 'lineAfter', 'lineAfterShort', 'lineVertical']) assert.match(jsx, new RegExp(`<span className="antd-divider-${slot}" />`), slot);
    assert.match(css, /\.antd-divider-lineBefore \{[^}]*border-top: var\([^)]*\) solid var\([^)]*\);[^}]*height: 0;[^}]*flex: 1 1 0;/);
    assert.match(css, /\.antd-divider-lineBeforeShort \{[^}]*width: var\(/);
    assert.match(css, /\.antd-divider-lineVertical \{[^}]*border-left: [^}]*width: 0;[^}]*align-self: stretch;/);
    const styleModes = model.variables.collections.find(c => c.id === model.binding.variables.lineStyle).modes;
    for (const [name, style] of [['dashed', 'dashed'], ['dotted', 'dotted']]) {
        const id = styleModes.find(m => m.name === name).id;
        const rule = css.split('\n\n').find(block => block.includes(`[data-lineStyle="${id}"] .antd-divider-lineBefore`));
        assert.ok(rule && rule.includes(`border-style: ${style};`), `${name}: the line takes the ${style} border`);
    }
});

/** Play's tree for an instance under these props with a Style applied to its lines, as the studio writes it. */
function play(props, style = 'solid') {
    const nodes = inst(props);
    for (const n of nodes.slice(1)) if (n.type === 'line') Object.assign(n, variantStrokePatch(n, style));
    nodes[0].w = 343;
    const { root, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.deepEqual(problems, []);
    return { root, nodes };
}
const dashOf = el => (/stroke-dasharray="([^"]*)"/.exec(el.html ?? '') ?? [])[1];

test('Play draws the Divider from the same nodes as the canvas: each layer in order, each line with the dash of its node', () => {
    for (const [style, dash] of [['solid', undefined], ['dashed', '4 4'], ['dotted', '0 3']]) {
        for (const placement of ['start', 'center', 'end']) {
            const { root, nodes } = play({ hasText: true, placement }, style);
            assert.equal(root.children.length, 3, `${style} ${placement}`);
            assert.deepEqual(root.children.map(c => c.nodeId), nodes.slice(1).map(n => n.id), 'same layers, same order');
            const lines = root.children.filter(c => c.html);
            assert.equal(lines.length, 2);
            for (const line of lines) assert.equal(dashOf(line), dash, `${style}: the dash of the node`);
            assert.equal(root.children[1].text, 'Text');
        }
    }
});

test('Play: a filling line spans its row (flex, svg 100%), a short side keeps its token, a vertical divider is one line', () => {
    const start = play({ hasText: true, placement: 'start' }).root.children;
    assert.equal(start[0].style.flex, undefined, 'the short side does not flex');
    assert.equal(start[2].style.flex, '1 1 auto');
    assert.match(start[2].html, /<svg width="100%" height="1"[^>]*><line x1="0" y1="0.5" x2="100%" y2="0.5"/);
    const end = play({ hasText: true, placement: 'end' }).root.children;
    assert.equal(end[0].style.flex, '1 1 auto');
    assert.equal(end[2].style.flex, undefined);
    const centre = play({ hasText: true, placement: 'center' }).root.children;
    assert.equal(centre[0].style.flex, centre[2].style.flex, 'centre: both share the row equally');
    const vertical = play({ orientation: 'vertical' }, 'dashed').root.children;
    assert.equal(vertical.length, 1);
    assert.equal(dashOf(vertical[0]), '4 4');
    assert.equal(play({}).root.children.length, 1, 'no text: one line');
});

test('a line slot must name its axis, be managed and optional, and be a layer of the root', () => {
    const problems = mutate => { const copy = structuredClone(divider); mutate(copy); return validateTemplateSchema(copy).join('\n'); };
    assert.equal(validateTemplateSchema(divider).length, 0);
    assert.match(problems(t => { delete t.anatomy[0].axis; }), /line slot "lineBefore" axis must be horizontal or vertical/);
    assert.match(problems(t => { delete t.anatomy[0].managed; }), /line slot "lineBefore" must be managed and optional/);
    assert.match(problems(t => { t.anatomy[0].parent = 'label'; }), /line slot "lineBefore" is a layer of the root/);
});

test('a vertical line fills the root height but is never shorter than its token, so a hugging root does not collapse it (canvas, Play and export)', () => {
    const vertical = nodeOf({ orientation: 'vertical' }, 'lineVertical');
    assert.equal(valueOf(vertical.vars.minH), 12);
    assert.equal(vertical.h, 0, 'it starts with no length of its own: the token is the floor');
    assert.match(generated().files['Divider.css'], /\.antd-divider-lineVertical \{[^}]*min-height: var\(--antd-divider-vertical-length\);/);
});
