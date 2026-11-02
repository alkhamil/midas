// A Button's fill in Play: on any stage, behind its content and above the parent. No negative z-index and no stacking-context patch
// on the host; the fill moves off the host only into a fill layer that is actually drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const white = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];
const dark = [{ type: 'solid', color: '#1e1e20', opacity: 1, visible: true }];
const model = buttonModel({ colors: ['primary'], variantModes: ['solid', 'filled', 'outlined', 'dashed'] });
const variables = { collections: model.collections, items: model.items };
const border = model.items.find(i => i.name === 'border').id;

/** A Button instance inside a stage frame of the given fill, drawn in Play. Returns the instance element. */
function drawn(instanceExtra, { stage = white, variant = 'outlined' } = {}) {
    const master = { id: 'btn', name: 'Button', type: 'frame', parentId: null, component: true, layout: 'horizontal', gap: 6, padding: 12, fills: white, radius: 6, x: 400, y: 0, w: 120, h: 32, behavior: { version: 2, templateId: 'button', variables: model.binding.variables } };
    const frame = { id: 'stage', name: 'Stage', type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: stage };
    const instance = { id: 'i1', name: 'Add', type: 'frame', parentId: 'stage', x: 20, y: 20, w: 120, h: 32, isInstance: true, sourceId: 'btn', behavior: { version: 2, props: { label: 'Add' } }, varModes: { 'c-variant': variant, 'c-color': 'primary', 'c-size': 'md' }, fills: white, radius: 6, ...instanceExtra };
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'Screens', nodes: [frame, master, instance] }], variables }, 'stage');
    return root.children.find(c => c.nodeId === 'i1');
}
const boundStroke = extra => ({ stroke: '#d9d9d9', strokeWidth: 1, strokeAlign: 'inside', vars: { stroke: border }, ...extra });
const overlays = el => el.children.filter(c => c.style?.position === 'absolute');
const laidOut = el => el.children.filter(c => c.style?.position !== 'absolute');
const walk = (el, out = []) => { out.push(el); for (const c of el.children ?? []) walk(c, out); return out; };

for (const stage of [white, dark]) {
    for (const variant of ['solid', 'filled', 'outlined']) {
        test(`a ${variant} Button with a bound inside stroke on a ${stage === white ? 'white' : 'dark'} stage: no layer goes behind the parent, and the host is no stacking-context patch`, () => {
            const el = drawn(boundStroke(), { stage, variant });
            for (const node of walk(el)) assert.ok(!(Number.parseFloat(node.style?.zIndex) < 0), `no negative z-index (${JSON.stringify(node.style)})`);
            assert.equal(el.style.isolation, undefined);
        });
    }
}

test('a bound uniform solid inside stroke: the fill is its own first layer, clipped inside the stroke; the content paints above it, the stroke above all', () => {
    const el = drawn(boundStroke());
    const [fill, stroke] = overlays(el);
    assert.equal(el.children[0], fill, 'the fill layer is the first child');
    assert.equal(el.children.at(-1), stroke, 'the stroke layer is the last child');
    assert.equal(fill.style.background, 'var(--button-bg)');
    assert.equal(fill.style.backgroundClip, 'padding-box');
    assert.equal(fill.style.borderColor, 'transparent');
    assert.equal(fill.style.borderWidth, '1px');
    assert.equal(fill.style.borderRadius, '6px');
    assert.equal(stroke.style.background, 'transparent');
    assert.equal(el.style.background, 'transparent', 'the host fill moves to the fill layer');
    for (const child of laidOut(el)) assert.equal(child.style.zIndex, '0', 'a laid-out child paints above the fill layer');
});

test('a stroke that draws no fill layer leaves the host its own fill', () => {
    for (const extra of [{ strokeStyle: 'dash' }, { strokeStyle: 'dot' }, { strokeAlign: 'center' }, { strokeAlign: 'outside' }, { vars: {} }]) {
        const el = drawn(boundStroke(extra));
        assert.equal(overlays(el).length, 1, `one overlay, the stroke (${JSON.stringify(extra)})`);
        assert.equal(el.style.background, undefined, `the host keeps its class fill (${JSON.stringify(extra)})`);
        for (const child of laidOut(el)) assert.equal(child.style.zIndex, undefined);
    }
});

test('a solid Button whose border variable is transparent draws no stroke: the host keeps its fill', () => {
    const el = drawn({ stroke: '#00000000', strokeWidth: 1, strokeOpacity: 0, strokeVisible: false, strokeAlign: 'inside', vars: { stroke: border } }, { variant: 'solid' });
    assert.equal(overlays(el).length, 0);
    assert.equal(el.style.background, undefined);
});
