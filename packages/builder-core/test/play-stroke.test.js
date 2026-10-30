import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
const solid = [{ type: 'solid', color: '#ffffff', opacity: 1, visible: true }];

// A frame nested in an auto-layout card, as the login inputs are: its box is fluid, so a design-size overlay would be clipped.
const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: 'card', x: 0, y: 0, w: 327, h: 48, fills: solid, ...extra });
const docOf = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }] });
const card = extra => ({ id: 'card', name: 'card', type: 'frame', parentId: null, x: 0, y: 0, w: 375, h: 200, fills: solid, layout: 'vertical', ...extra });
const drawn = (stroke, parentExtra = {}) => {
    const { root, unsupported } = toDomTree(docOf([card(parentExtra), frame('A', stroke)]), 'card');
    const el = root.children.find(c => c.nodeId === 'A');
    return { el, overlay: el.children.find(c => c.style?.pointerEvents === 'none'), unsupported };
};

test('a nested centred stroke follows the box: the overlay is box-sized, not design-sized', () => {
    const { overlay, unsupported } = drawn({ strokeWidth: 1, stroke: '#c4c4cc', radius: 8 });
    assert.deepEqual(unsupported, []);
    assert.match(overlay.html, /<svg width="100%" height="100%"/);
    assert.doesNotMatch(overlay.html, /width="327"/);
    assert.match(overlay.html, /rx="8"/);
    assert.match(overlay.html, /stroke-width="1"/);
});

test('a nested inside stroke is clipped to the box with a doubled width', () => {
    const { overlay } = drawn({ strokeWidth: 1, stroke: '#c4c4cc', strokeAlign: 'inside', radius: 8 });
    assert.match(overlay.html, /<clipPath/);
    assert.match(overlay.html, /stroke-width="2"/);
});

test('a nested uniform outside stroke is the frame outline, and draws no overlay', () => {
    const { el, overlay, unsupported } = drawn({ strokeWidth: 2, stroke: '#c4c4cc', strokeAlign: 'outside', radius: 8 });
    assert.deepEqual(unsupported, []);
    assert.equal(el.style.outline, '2px solid #c4c4cc');
    assert.equal(overlay, undefined);
});

test('a centred per-side stroke draws one box-sized bar per side it names', () => {
    const { overlay } = drawn({ strokeWidth: 4, stroke: '#112233', strokeSides: 'custom', strokeT: 4, strokeR: 0, strokeB: 0, strokeL: 0 });
    assert.equal(overlay.html.match(/<rect x="0"/g).length, 1);
    assert.match(overlay.html, /height:4px/);
    assert.match(overlay.html, /top:-2px/);
});

test('an inside per-side stroke with a radius clips its bars to the box', () => {
    const { el, overlay } = drawn({ strokeWidth: 4, stroke: '#112233', strokeAlign: 'inside', strokeSides: 'custom', strokeT: 4, strokeR: 0, strokeB: 0, strokeL: 4, radius: 8 });
    assert.equal(el.style.overflowClipMargin, undefined);
    assert.equal(overlay.html.match(/<clipPath/g).length, 2);
    assert.match(overlay.html, /width:100%/);
});

test('an outside per-side stroke draws past the box with a clip margin of its widest side', () => {
    const { el, overlay, unsupported } = drawn({ strokeWidth: 4, stroke: '#112233', strokeAlign: 'outside', strokeSides: 'custom', strokeT: 2, strokeR: 4, strokeB: 6, strokeL: 8 });
    assert.deepEqual(unsupported, []);
    assert.equal(el.style.outline, undefined);
    assert.equal(el.style.overflowClipMargin, '8px');
    const bars = overlay.html.match(/<svg style="[^"]*"/g);
    assert.equal(bars.length, 4);
    assert.match(overlay.html, /height:2px/);
    assert.match(overlay.html, /width:8px/);
});

test('a per-side stroke in a plain frame follows the box too', () => {
    const { overlay } = drawn({ strokeWidth: 4, stroke: '#112233', strokeSides: 'left' }, { layout: 'none' });
    assert.match(overlay.html, /width:4px/);
    assert.match(overlay.html, /height:100%/);
});

test('clip-content still clips children: the stroke overlay does not open the frame', () => {
    const kid = { id: 'K', name: 'K', type: 'rect', parentId: 'A', x: -20, y: -20, w: 400, h: 200, fills: solid };
    const { root } = toDomTree(docOf([card(), frame('A', { strokeWidth: 2, stroke: '#112233' }), kid]), 'card');
    const el = root.children.find(c => c.nodeId === 'A');
    assert.equal(el.style.overflowX, 'clip');
    assert.equal(el.style.overflowY, 'clip');
    assert.ok(el.children.some(c => c.style?.pointerEvents === 'none'));
});
