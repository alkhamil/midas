// A Button's fill in Play: on the host itself, behind its content and above the parent.
// No negative z-index and no stacking-context patch on the host; no fill layer, no stroke overlay:
// the host carries border, background and background-clip, so content never needs lifting.
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

test('a bound uniform solid inside stroke: the host carries border, background and clip; the content paints in place', () => {
    const el = drawn(boundStroke());
    assert.deepEqual(overlays(el), [], 'no overlay layers');
    assert.equal(el.style.borderWidth, '1px');
    assert.equal(el.style.borderStyle, 'solid');
    assert.equal(el.style.borderColor, undefined, 'the colour follows the host states via the class rule');
    assert.equal(el.style.backgroundClip, 'border-box');
    assert.equal(el.style.background, undefined, 'the host fill comes from the class rule');
    for (const child of laidOut(el)) assert.equal(child.style.zIndex, undefined, 'no child is lifted');
});

test('a stroke that draws no fill layer leaves the host its own fill', () => {
    for (const extra of [{ strokeStyle: 'dash' }, { strokeAlign: 'center' }, { strokeAlign: 'outside' }, { vars: {} }]) {
        const el = drawn(boundStroke(extra));
        assert.equal(overlays(el).length, extra.strokeDash !== undefined || extra.strokeGap !== undefined ? 1 : 0, `only a custom dash pattern keeps an overlay (${JSON.stringify(extra)})`);
        assert.equal(el.style.background, undefined, `the host keeps its class fill (${JSON.stringify(extra)})`);
        for (const child of laidOut(el)) assert.equal(child.style.zIndex, undefined);
    }
});

test('a solid Button whose border variable is transparent draws no visible stroke: the host keeps its fill', () => {
    const el = drawn({ stroke: '#00000000', strokeWidth: 1, strokeOpacity: 0, strokeVisible: false, strokeAlign: 'inside', vars: { stroke: border } }, { variant: 'solid' });
    assert.equal(overlays(el).length, 0);
    assert.equal(el.style.background, undefined);
});
