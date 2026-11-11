// A value the designer sets on an instance's layers reaches Play, for every template: bound to a variable (any collection) Play resolves it, unbound Play draws the raw
// value, and a layer that follows its template token adds nothing inline. Sizing, position and alignment are the node's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const play = (id, edit, props = {}) => {
    const template = TEMPLATES.get(id);
    const model = modelFor(template);
    const nodes = instanceFor(model, props);
    edit?.(nodes[0], nodes, model);
    return toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id).root;
};
const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];

for (const id of ['button', 'checkbox', 'antd-tag', 'antd-text']) {
    test(`${id}: an instance that follows its tokens draws nothing inline for fill, radius, padding or gap`, () => {
        const { style } = play(id);
        for (const key of ['backgroundColor', 'borderRadius', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom', 'gap']) assert.equal(style[key], undefined, key);
    });
}

test('button: an unbound raw fill, radius, padding and gap are drawn as set', () => {
    const { style } = play('button', root => {
        delete root.vars['fills.0']; root.fills = solid('#ff0000');
        delete root.vars.radius; root.radius = 3;
        delete root.vars.padH; Object.assign(root, { padL: 31, padR: 31 });
        delete root.vars.gap; root.gap = 13;
    });
    assert.equal(style.backgroundColor, '#ff0000');
    assert.equal(style.borderRadius, '3px');
    assert.equal(style.paddingLeft, '31px');
    assert.equal(style.paddingRight, '31px');
    assert.equal(style.gap, '13px');
});

test('button: a fill bound to another variable resolves that variable, in any collection', () => {
    const { style } = play('button', (root, nodes, model) => {
        const mode = { id: 'other-mode', name: 'Mode 1' };
        model.variables.collections.push({ id: 'other', name: 'Brand', modes: [mode] });
        model.variables.items.push({ id: 'brand-red', collectionId: 'other', name: 'red', type: 'color', values: { [mode.id]: '#aa0011' } });
        root.vars['fills.0'] = 'brand-red';
    });
    assert.equal(style.backgroundColor, '#aa0011');
});

test('button: a stroke bound to another variable, and a raw stroke, are the border colour in Play', () => {
    const raw = play('button', root => { delete root.vars.stroke; root.stroke = '#00ff00'; root.strokeWidth = 1; });
    assert.equal(raw.style.borderColor, '#00ff00');
    const bound = play('button', (root, nodes, model) => {
        const mode = { id: 'o-mode', name: 'Mode 1' };
        model.variables.collections.push({ id: 'o', name: 'Brand', modes: [mode] });
        model.variables.items.push({ id: 'brand-blue', collectionId: 'o', name: 'blue', type: 'color', values: { [mode.id]: '#0000bb' } });
        root.vars.stroke = 'brand-blue';
    });
    assert.equal(bound.style.borderColor, '#0000bb');
});

test('button: the label colour and size set on the canvas layer reach Play', () => {
    const root = play('button', (_, nodes) => {
        const label = nodes.find(n => n.type === 'text');
        delete label.vars['fills.0']; label.fills = solid('#00aa00');
        delete label.vars.typography; Object.assign(label, { fontSize: 31, fontWeight: 700, lineHeight: 40, letterSpacing: 0 });
    });
    const label = root.children.find(c => c.attrs?.class === 'button-label');
    assert.equal(label.style.color, '#00aa00');
    assert.equal(label.style.fontSize, '31px');
});

test('sizing, position and alignment are the node\'s: fixed, fill and hug; alignment of the instance', () => {
    const fixed = play('button', root => Object.assign(root, { layoutSizingH: 'fixed', w: 222 }));
    assert.equal(fixed.style.width, '222px');
    const aligned = play('button', root => Object.assign(root, { primaryAlign: 'end', counterAlign: 'start' }));
    assert.equal(aligned.style.justifyContent, 'flex-end');
    assert.equal(aligned.style.alignItems, 'flex-start');
});

test('an instance in a plain frame is placed at its x and y, in an auto layout frame it takes the flow sizing', () => {
    const template = TEMPLATES.get('button');
    const model = modelFor(template);
    const nodes = instanceFor(model, {});
    const inst = nodes[0];
    for (const [layout, expect] of [[undefined, { position: 'absolute', left: '40px', top: '12px' }], ['vertical', { alignSelf: 'stretch' }]]) {
        Object.assign(inst, { parentId: 'host', x: 40, y: 12, ...(layout ? { layoutSizingH: 'fill' } : {}) });
        const host = { id: 'host', name: 'Host', type: 'frame', parentId: null, x: 0, y: 0, w: 400, h: 300, fills: [], ...(layout ? { layout } : {}) };
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, host, ...nodes] }], variables: model.variables }, 'host');
        const el = root.children[0];
        for (const [k, v] of Object.entries(expect)) assert.equal(el.style[k], v, `${layout ?? 'plain'} ${k}`);
    }
});
