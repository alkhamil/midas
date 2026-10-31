import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const solid = [{ type: 'solid', color: '#4338ca', opacity: 1, visible: true }];
const model = buttonModel({ colors: ['primary'], variantModes: ['outlined'], sizeModes: [{ id: 'sm', name: 'Small' }] });
const variables = () => ({ collections: model.collections, items: model.items });

/** A Button master and one instance with the given stroke, drawn in Play. */
function drawnWith(stroke) {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: solid, radius: 8, x: 0, y: 0, w: 120, h: 40, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: null, x: 0, y: 0, w: 120, h: 40, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': 'outlined', 'c-color': 'primary', 'c-size': 'sm' }, fills: solid, ...stroke };
    return toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [master, instance] }], variables: variables() }, 'i1').root;
}

const overlayOf = root => root.children.at(-1);

test('a Button draws no CSS border in Play: its stroke is the node stroke, drawn as an overlay', () => {
    const root = drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign: 'center' });
    assert.equal(root.style.borderWidth, '0px');
    const overlay = overlayOf(root);
    assert.equal(overlay.style.border, '2px solid #18181b');
    assert.equal(overlay.style.inset, '-1px');
});

test('an inside stroke sits inside the box, an outside stroke grows it by its full width', () => {
    assert.equal(overlayOf(drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign: 'inside' })).style.inset, '0px');
    assert.equal(overlayOf(drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign: 'outside' })).style.inset, '-2px');
});

test('a Button stroke never uses a CSS outline, so the keyboard-focus ring keeps working', () => {
    for (const strokeAlign of ['inside', 'center', 'outside']) {
        const root = drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign });
        assert.equal(root.style.outline, undefined);
        assert.equal(overlayOf(root).style.border, '2px solid #18181b');
    }
});

test('the overlay corners match the box corners grown by the stroke, in every mode', () => {
    const overlay = overlayOf(drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeAlign: 'center' }));
    assert.equal(overlay.style.borderRadius, '9px');
    assert.doesNotMatch(overlay.style.borderRadius ?? '', /var\(--button-radius\)/);
});

test('a per-side stroke draws CSS borders per side it names, and no SVG overlay', () => {
    const overlay = overlayOf(drawnWith({ stroke: '#18181b', strokeWidth: 4, strokeSides: 'custom', strokeT: 4, strokeR: 0, strokeB: 0, strokeL: 0 }));
    assert.equal(overlay.html, undefined);
    assert.equal(overlay.style.borderTopWidth, '4px');
    assert.equal(overlay.style.borderTopStyle, 'solid');
    assert.equal(overlay.style.borderTopColor, '#18181b');
    assert.equal(overlay.style.borderRightStyle, 'none');
    assert.equal(overlay.style.borderBottomStyle, 'none');
    assert.equal(overlay.style.borderLeftStyle, 'none');
});

test('a dashed stroke draws its dash array instead of a solid border', () => {
    const html = overlayOf(drawnWith({ stroke: '#18181b', strokeWidth: 2, strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 })).html;
    assert.match(html, /stroke-dasharray="6 4"/);
});

test('a Button with no stroke draws no overlay', () => {
    const root = drawnWith({ stroke: '#00000000', strokeWidth: 0 });
    assert.equal(root.children.some(c => c.style?.border || c.style?.pointerEvents === 'none'), false);
});
