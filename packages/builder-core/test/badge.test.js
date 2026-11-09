// Badge: a count pill (a managed frame holding the managed count text, which reads `<overflowCount>+` above the limit), a dot (a managed frame, the
// root hugs it), or a status row (a status dot and an optional label). The root hides in Play and the export while the count is zero and showZero is off
// (a hiding state; the canvas keeps the node). Colours are preset tokens, the status colours are the Status mode tokens, every size a token.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { COLOR_PRESETS } from '../src/templates/color-presets.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';

const badge = TEMPLATES.get('antd-badge');
const model = modelFor(badge);
/**
 * An instance under these props, with its managed layers bound the way the studio binds them after a clone (applyManagedTextBindings): text and
 * containers take their display tokens, so a dot made by an instance is sized like one made from a master.
 */
const inst = props => {
    const nodes = instanceFor(model, props);
    const layers = nodes.slice(1).filter(n => n.behavior?.slot !== undefined).map(node => ({ key: node.behavior.slot, node }));
    const { ops } = planManagedTextBindings({ template: badge, binding: model.binding, props: resolveProps(badge, props), layers, variables: model.variables });
    applyBindTokens(layers, ops);
    return nodes;
};
/** The layer names of an instance under these props (the root is not one of them). */
const layers = props => inst(props).slice(1).map(n => n.name);
const nodeOf = (props, name) => inst(props).find(n => n.name === name);
/**
 * A layer's size on one axis: the value of the variable it is bound to (a bound axis is fixed at that value, whatever the node says), else its
 * number. A hugging axis has no size of its own (layout measures it): undefined.
 */
const sizeOf = (node, axis) => {
    const item = model.variables.items.find(i => i.id === node.vars?.[axis]);
    if (item) return variableValue(model.variables, item, c => c.modes[0].id);
    const sizing = axis === 'w' ? node.layoutSizingH : node.layoutSizingV;
    return sizing === 'hug' ? undefined : node[axis];
};

test('Badge is registered: a non-control whose primary slot is the count text, with the props it declares', () => {
    assert.ok(badge, 'Badge is in the registry');
    assert.equal(badge.isControl, undefined);
    assert.equal(badge.primarySlot, 'countText');
    assert.deepEqual(Object.keys(badge.props).sort(), ['color', 'count', 'hasText', 'isZero', 'label', 'overflowCount', 'showZero', 'size', 'status', 'type', 'zeroHidden']);
    assert.deepEqual(badge.props.type.options, ['count', 'dot', 'status']);
    assert.deepEqual(badge.props.color.modes, COLOR_PRESETS);
    assert.equal(badge.props.overflowCount.default, 99);
});

test('a count shows the pill and its count; a dot shows only the dot; a status shows its dot and its label', () => {
    assert.deepEqual(layers({ type: 'count', count: 5 }), ['pill', 'countText']);
    assert.deepEqual(layers({ type: 'dot' }), ['dot']);
    assert.deepEqual(layers({ type: 'status', hasText: true, label: 'Done' }), ['statusDot', 'label']);
    assert.deepEqual(layers({ type: 'status', hasText: false }), ['statusDot']);
});

test('the status label is added and removed with hasText, and an empty label asks for no layer', () => {
    assert.equal(nodeOf({ type: 'status', hasText: true, label: 'Done' }, 'label').text, 'Done');
    assert.deepEqual(layers({ type: 'status', hasText: false, label: 'Done' }), ['statusDot'], 'off: removed, the text stays in its prop');
    assert.deepEqual(layers({ type: 'status', hasText: true, label: '' }), ['statusDot'], 'empty: no layer');
});

test('an overflow count reads <overflowCount>+ above the limit, else the count, and nothing is stored', () => {
    const text = props => nodeOf({ type: 'count', ...props }, 'countText').text;
    assert.equal(text({ count: 120 }), '99+');
    assert.equal(text({ count: 7 }), '7');
    assert.equal(text({ count: 10, overflowCount: 9 }), '9+');
    assert.equal(nodeOf({ type: 'count', count: 120 }, 'countText').text, '99+');
});

test('a zero count hides the root in Play unless showZero; the canvas keeps the node', () => {
    const hidden = props => resolveProps(badge, { type: 'count', ...props }).zeroHidden;
    assert.equal(hidden({ count: 0 }), true);
    assert.equal(hidden({ count: 0, showZero: true }), false);
    assert.equal(hidden({ count: 3 }), false);
    assert.equal(hidden({ count: 0, type: 'dot' }), false, 'only the count type hides on zero');
    assert.equal(nodeOf({ type: 'count', count: 0 }, 'countText').text, '0', 'the canvas shows the zero');
});

test('Play marks the root with the hiding attribute while a zero count is hidden, and the export hides it in its stylesheet', () => {
    const nodes = inst({ type: 'count', count: 0 });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.ok('data-zero-hidden' in root.attrs);
    const out = generateComponent(model.template, model.binding, model.variables, 'Badge', model.frame, id => model.created.filter(n => n.parentId === id));
    assert.deepEqual(out.problems, []);
    assert.match(out.files['Badge.css'], /\.antd-badge\[data-zero-hidden\] \{\s*display: none;\s*\}/);
    assert.match(out.files['Badge.jsx'], /Number\(count\) > Number\(overflowCount\) \? `\$\{overflowCount\}\+`/);
});

test('the dot is a circle of the dot token, the pill is the badge height and centres its count on both axes', () => {
    const dot = nodeOf({ type: 'dot' }, 'dot');
    assert.equal(sizeOf(dot, 'w'), 6);
    assert.equal(sizeOf(dot, 'h'), 6);
    const radius = model.variables.items.find(i => i.id === dot.vars?.radius);
    assert.ok(radius && variableValue(model.variables, radius, c => c.modes[0].id) >= sizeOf(dot, 'w') / 2, 'a circle: its radius is at least half its width');
    const pill = nodeOf({ type: 'count', count: 5 }, 'pill');
    assert.equal(sizeOf(pill, 'h'), 20);
    assert.equal(pill.primaryAlign, 'center');
    assert.equal(pill.counterAlign, 'center');
});

test('the guard: no zero-size or invisible node, no white literal, no part missing, no error in the document', () => {
    for (const props of [{ type: 'count', count: 5 }, { type: 'count', count: 0 }, { type: 'dot' }, { type: 'status', hasText: true, label: 'x' }]) {
        for (const n of inst(props).slice(1)) {
            for (const axis of ['w', 'h']) if (sizeOf(n, axis) !== undefined) assert.ok(sizeOf(n, axis) > 0, `${n.name} has a ${axis}`);
            assert.notEqual(n.visible, false, `${n.name} is shown on the canvas`);
            assert.doesNotMatch(JSON.stringify(n.fills ?? []), /#ffffff/i, `${n.name} has no white literal`);
        }
    }
    const doc = { variables: model.variables, pages: [{ name: 'p', nodes: [model.frame, ...model.created] }] };
    assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error' || f.code === 'part-missing'), []);
});
