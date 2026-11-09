// Badge geometry at every Size mode, for a master and for an instance: the canvas value of each bound size (its variable in that mode) and the Play box
// (computed CSS + DOM) agree, a count's text is centred on both axes inside its pill and fits it, a dot is a circle of the dot token, and no layer has
// a zero size or a hidden paint. The canvas renderer itself is not importable here; its inputs are the node values read below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { variableValue } from '../src/behavior-engine/variable-value.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { planManagedTextBindings, applyBindTokens } from '../src/behavior-engine/bind-tokens.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { elementsOf } from './helpers/play-compute.js';
import { styleOf, paddingOf, length } from './helpers/play-geometry.js';

const badge = TEMPLATES.get('antd-badge');
const model = modelFor(badge);

/** The mode of each variable prop for a Size mode: the Size mode itself, the defaults of the others. */
function modesFor(size) {
    return Object.fromEntries(Object.entries(model.binding.variables).map(([prop, cid]) => {
        const coll = model.variables.collections.find(c => c.id === cid);
        const want = prop === 'size' ? size : (badge.props[prop].defaultMode ?? coll.modes[0].name);
        return [prop, coll.modes.find(m => m.name === want).id];
    }));
}

/** The canvas value of a layer's bound axis (or property) in these modes: the variable's value, read the way the canvas reads it. */
function canvasValue(node, key, modes) {
    const item = model.variables.items.find(i => i.id === node.vars?.[key]);
    if (!item) return undefined;
    return variableValue(model.variables, item, c => {
        const dim = Object.keys(model.binding.variables).find(d => model.binding.variables[d] === c.id);
        return dim ? modes[dim] : c.modes[0].id;
    });
}

/**
 * An instance under these props with its managed layers bound as the studio binds them after a clone (applyManagedTextBindings): text and containers
 * take their display tokens.
 */
function boundInstance(props) {
    const nodes = instanceFor(model, props);
    const layers = nodes.slice(1).filter(n => n.behavior?.slot !== undefined).map(node => ({ key: node.behavior.slot, node }));
    const { ops } = planManagedTextBindings({ template: badge, binding: model.binding, props: resolveProps(badge, props), layers, variables: model.variables });
    applyBindTokens(layers, ops);
    return nodes;
}

/** The Play tree of an instance under these props, in a Size mode, and its generated stylesheet. */
function playOf(size, props) {
    const nodes = boundInstance(props);
    nodes[0].varModes = Object.fromEntries(Object.entries(modesFor(size)).map(([prop, mode]) => [model.binding.variables[prop], mode]));
    const top = { id: 'top', name: 'Top', type: 'frame', parentId: null, layout: 'vertical', x: 0, y: 0, w: 400, h: 400, fills: [], layoutSizingH: 'hug', layoutSizingV: 'hug' };
    nodes[0].parentId = 'top';
    const { root, styles, problems } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [top, model.frame, ...model.created, ...nodes] }], variables: model.variables }, 'top');
    assert.deepEqual(problems, []);
    const found = elementsOf(root);
    const byClass = name => found.find(({ el }) => el.attrs?.class === `antd-badge-${name}`);
    return { root, styles, nodes, byClass, found };
}

const px = v => length(v);

/** A text line in px: a unitless line-height is a ratio of the font size (the stylesheet writes the typography token so). */
const lineHeightOf = style => { const v = String(style['line-height']).trim(); return v.endsWith('px') ? px(v) : px(style['font-size']) * Number(v); };

for (const size of SIZE_MODES) {
    test(`count at size ${size}: the pill is the badge height on the canvas and in Play, its text is centred on both axes and fits`, () => {
        const { styles, byClass, nodes, found } = playOf(size, { type: 'count', count: 5 });
        const pillNode = nodes.find(n => n.name === 'pill');
        const pillCanvas = canvasValue(pillNode, 'h', modesFor(size));
        assert.equal(pillCanvas, 20, `the canvas pill is 20 at ${size}`);
        const pill = byClass('pill');
        const pillStyle = styleOf(styles, pill.chain);
        assert.equal(px(pillStyle.height), pillCanvas, `Play pill height matches the canvas at ${size}`);
        assert.equal(pillStyle['align-items'], 'center', 'the text is centred on the cross axis');
        assert.equal(pillStyle['justify-content'], 'center', 'the text is centred on the main axis');
        // Play gives a text no class: the count is the text under the pill.
        const text = found.find(({ el, chain }) => chain.includes(pill.el) && el !== pill.el);
        const textStyle = styleOf(styles, text.chain);
        const lineHeight = lineHeightOf(textStyle);
        assert.ok(lineHeight > 0 && lineHeight <= pillCanvas, `the text line (${lineHeight}) fits the pill (${pillCanvas}) at ${size}`);
        const pad = paddingOf(pillStyle);
        assert.equal(pad.t + pad.b + lineHeight <= pillCanvas + 0.5, true, 'no overflow vertically');
        // Centred: with align-items and justify-content at the centre, the text line sits half the free height above and below (the pill hugs its width).
        const top = (pillCanvas - lineHeight) / 2;
        assert.ok(top >= 0 && Math.abs(top + lineHeight + top - pillCanvas) < 0.5, `vertical centre at ${size}`);
    });

    test(`dot at size ${size}: a circle of the dot token, canvas and Play agree`, () => {
        const { styles, byClass, nodes } = playOf(size, { type: 'dot' });
        const dotNode = nodes.find(n => n.name === 'dot');
        const w = canvasValue(dotNode, 'w', modesFor(size)), h = canvasValue(dotNode, 'h', modesFor(size));
        assert.equal(w, 6, 'the canvas dot is 6');
        assert.equal(h, 6, 'the canvas dot is 6 high');
        const dot = styleOf(styles, byClass('dot').chain);
        assert.equal(px(dot.width), w, `Play dot width at ${size}`);
        assert.equal(px(dot.height), h, `Play dot height at ${size}`);
        const radius = canvasValue(dotNode, 'radius', modesFor(size));
        assert.ok(radius >= w / 2, `a circle: radius ${radius} at least half of ${w}`);
    });
}

test('status at every size: the status dot is the dot token and the label fits the row', () => {
    for (const size of SIZE_MODES) {
        const { styles, byClass, nodes, found } = playOf(size, { type: 'status', hasText: true, label: 'Done' });
        const dotNode = nodes.find(n => n.name === 'statusDot');
        const dot = styleOf(styles, byClass('statusDot').chain);
        assert.equal(px(dot.width), canvasValue(dotNode, 'w', modesFor(size)), `status dot width at ${size}`);
        assert.equal(px(dot.height), canvasValue(dotNode, 'h', modesFor(size)), `status dot height at ${size}`);
        const label = styleOf(styles, found.find(({ el }) => el.text === 'Done').chain);
        assert.ok(lineHeightOf(label) > 0, `label line height at ${size}`);
    }
});

test('the guard in Play: no layer of any type has a zero size or an opacity of 0, at every size', () => {
    const cases = [{ type: 'count', count: 5 }, { type: 'dot' }, { type: 'status', hasText: true, label: 'x' }];
    for (const size of SIZE_MODES) for (const props of cases) {
        const { found, styles } = playOf(size, props);
        for (const { el, chain } of found.slice(1)) {
            if (!el.attrs?.class) continue;
            const s = styleOf(styles, chain);
            assert.notEqual(s.opacity, '0', `${el.attrs.class} is not transparent`);
            for (const axis of ['width', 'height']) if (s[axis] !== undefined && px(s[axis]) !== null) assert.ok(px(s[axis]) > 0, `${el.attrs.class} ${axis} at ${size}`);
        }
    }
});
