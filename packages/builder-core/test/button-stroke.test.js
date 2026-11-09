import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const solid = [{ type: 'solid', color: '#4338ca', opacity: 1, visible: true }];
const model = buttonModel({ colors: ['primary'], variantModes: ['outlined'] });
const variables = () => ({ collections: model.collections, items: model.items });

/** A Button master and one instance with the given stroke, drawn in Play. */
function drawnWith(stroke) {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'outlined', 'c-color': 'primary', 'c-size': 'sm' }, fills: solid, ...stroke };
    return toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables: variables() }, 'i1').root;
}

const bordersOf = root => {
    const found = [];
    const walk = n => {
        const s = n.style || {};
        if (s.border && !/^0px/.test(s.border)) found.push(n);
        if (s.borderWidth && s.borderWidth !== '0px' && s.borderWidth !== '0') found.push(n);
        for (const k of ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']) {
            if (s[k] && s[k] !== '0px' && s[k] !== '0') found.push(n);
        }
        for (const c of n.children || []) walk(c);
    };
    walk(root);
    return found;
};

test('a Button draws its border on the host in Play, with an explicit width', () => {
    const root = drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign: 'center' });
    assert.equal(root.style.borderWidth, '2px');
    assert.equal(root.style.borderStyle, 'solid');
    assert.equal(root.style.borderColor, '#18181b');
    assert.deepEqual(bordersOf(root), [root]);
});

test('inside, center and outside strokes all draw on the host inside the box', () => {
    for (const strokeAlign of ['inside', 'center', 'outside']) {
        const root = drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign });
        assert.equal(root.style.borderWidth, '2px', strokeAlign);
        assert.deepEqual(bordersOf(root), [root], strokeAlign);
    }
});

test('a Button stroke never uses a CSS outline, so the keyboard-focus ring keeps working', () => {
    for (const strokeAlign of ['inside', 'center', 'outside']) {
        const root = drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign });
        assert.equal(root.style.outline, undefined);
    }
});

test('a per-side stroke draws CSS borders per side on the host, and no SVG overlay', () => {
    const root = drawnWith({ stroke: '#18181b', strokeWidth: 4, strokeSides: 'custom', strokeT: 4, strokeR: 0, strokeB: 0, strokeL: 0 });
    assert.equal(root.children.some(c => c.html), false);
    assert.equal(root.style.borderTopWidth, '4px');
    assert.equal(root.style.borderTopStyle, 'solid');
    assert.equal(root.style.borderTopColor, '#18181b');
    assert.equal(root.style.borderRightStyle, 'none');
    assert.equal(root.style.borderBottomStyle, 'none');
    assert.equal(root.style.borderLeftStyle, 'none');
});

test('an unbound stroke with its own dash pattern is still drawn exactly, as SVG', () => {
    const root = drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 });
    assert.equal(root.style.borderWidth, '0px');
    assert.equal(root.style.borderStyle, 'none');
    const svg = root.children.find(c => c.html);
    assert.ok(svg, 'the SVG overlay draws the custom pattern');
    assert.match(svg.html, /stroke-dasharray="6 4"/);
});

test('a Button with no stroke draws no border', () => {
    const root = drawnWith({ stroke: '#00000000', strokeWidth: 0 });
    assert.deepEqual(bordersOf(root), []);
});

test('a bound uniform inside stroke draws on the host with no inline colour, so states can recolour it', () => {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'outlined', 'c-color': 'primary', 'c-size': 'sm' }, fills: solid, vars: { stroke: 'v-border' }, stroke: '#18181b', strokeWidth: 2, strokeAlign: 'inside' };
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables: variables() }, 'i1');
    assert.equal(root.style.borderWidth, '2px');
    assert.equal(root.style.borderStyle, 'solid');
    assert.equal(root.style.borderColor, undefined);
    assert.equal(root.style.backgroundClip, 'border-box');
});

test('the Dashed Variant still carries border-style: dashed in the class rule', () => {
    const dashed = buttonModel({ colors: ['primary'], variantModes: ['dashed'] });
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: dashed.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'dashed', 'c-color': 'primary', 'c-size': 'sm' }, fills: solid, vars: { stroke: 'v-border' }, stroke: '#18181b', strokeWidth: 2, strokeAlign: 'inside' };
    const { root, styles } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables: { collections: dashed.collections, items: dashed.items } }, 'i1');
    assert.equal(root.attrs['data-variant'], 'dashed');
    assert.equal(root.style.borderWidth, '2px');
    assert.match(styles, /\.button\[data-variant="dashed"\] \{\n  border-style: dashed;\n\}/);
});
