import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';

const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 200, fill: '#ffffff', ...extra });
const layer = (extra = {}) => ({ id: 'L', name: 'L', type: 'rect', parentId: 'A', x: 10, y: 10, w: 80, h: 60, fill: '#112233', ...extra });
const docOf = nodes => ({ pages: [{ id: 'p', name: 'Screens', nodes }] });
/** The descriptor of the one layer drawn inside frame A. */
const drawn = extra => toDomTree(docOf([frame('A'), layer(extra)]), 'A').root.children[0];

test('per-corner radius draws the four corners in order: top-left, top-right, bottom-right, bottom-left', () => {
    assert.equal(drawn({ radii: [1, 2, 3, 4] }).style.borderRadius, '1px 2px 3px 4px');
});

test('a flipped layer mirrors about its centre, and then turns with its rotation', () => {
    assert.equal(drawn({ rotation: 30, flipX: true }).style.transform, 'rotate(30deg) scaleX(-1)');
    assert.equal(drawn({ flipY: true }).style.transform, 'scaleY(-1)');
});

test('a six digit hex fill takes its opacity as an alpha byte; a short hex or a named colour takes it as color-mix', () => {
    assert.equal(drawn({ fill: '#112233', fillOpacity: 0.5 }).style.background, '#11223380');
    assert.equal(drawn({ fill: '#abc', fillOpacity: 0.5 }).style.background, 'color-mix(in srgb, #abc 50%, transparent)');
    assert.equal(drawn({ fill: 'rgb(1, 2, 3)', fillOpacity: 0.5 }).style.background, 'color-mix(in srgb, rgb(1, 2, 3) 50%, transparent)');
});

test('a linear gradient runs in the canvas direction: its CSS angle is the canvas angle plus 90', () => {
    const style = drawn({ fillType: 'linear', fill: '#000000', fill2: '#ffffff', gradientAngle: 0 }).style;
    assert.equal(style.background, 'linear-gradient(90deg, #000000, #ffffff)');
});

test('a radial and an angular fill draw as radial and conic gradients', () => {
    const radial = drawn({ fills: [{ type: 'radial', color: '#000000', color2: '#ffffff', opacity: 1, visible: true }] }).style.background;
    const angular = drawn({ fills: [{ type: 'angular', color: '#000000', color2: '#ffffff', opacity: 1, visible: true }] }).style.background;
    assert.match(radial, /^radial-gradient\(circle, #000000, #ffffff\)$/);
    assert.match(angular, /^conic-gradient\(from 0deg, #000000, #ffffff\)$/);
});

test('multiple fills stack in the order stored: the first is the top layer, and a hidden fill draws nothing', () => {
    const stacked = drawn({ fills: [{ type: 'solid', color: '#ff0000', opacity: 1, visible: true }, { type: 'solid', color: '#00ff00', opacity: 1, visible: true }] }).style.background;
    assert.match(stacked, /#ff0000.*#00ff00/);
    assert.equal(drawn({ fills: [{ type: 'solid', color: '#ff0000', opacity: 1, visible: false }] }).style.background, undefined);
});

test('an inside stroke is an SVG stroke clipped to the shape, not a centred CSS border', () => {
    const d = drawn({ strokeWidth: 2, stroke: '#000000', strokeAlign: 'inside' });
    assert.equal(d.style.border, undefined);
    assert.match(d.html, /<clipPath id="[^"]*k">/);
    assert.match(d.html, /stroke-width="4"/);
});

test('an outside stroke is an SVG stroke cut out of a mask of the shape', () => {
    assert.match(drawn({ strokeWidth: 2, stroke: '#000000', strokeAlign: 'outside' }).html, /<mask id="[^"]*k"/);
});

test('a dashed stroke is an SVG stroke with its dash array', () => {
    const d = drawn({ strokeWidth: 2, stroke: '#000000', strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 });
    assert.match(d.html, /stroke-dasharray="6 4"/);
    assert.equal(d.style.border, undefined);
});

test('a donut is an SVG path with the even-odd rule, so its ring is a hole', () => {
    const d = drawn({ type: 'ellipse', arcRatio: 50 });
    assert.equal(d.tag, 'div');
    assert.match(d.html, /<path d="[^"]+" fill-rule="evenodd"/);
    assert.equal(d.style.background, undefined);
});

test('a line is an SVG path drawn as a stroke only', () => {
    const d = drawn({ type: 'line', w: 60, h: 30, stroke: '#ff0000', strokeWidth: 2 });
    assert.match(d.html, /<path d="M0 0L60 30"/);
    assert.match(d.html, /fill="none"/);
});

test('a vector path is an SVG path of its points', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const d = drawn({ type: 'path', points, closed: true, pathW: 10, pathH: 10, w: 20, h: 20, stroke: '#000000', strokeWidth: 1 });
    assert.match(d.html, /<path d="M0 0L20 0L20 20L0 0Z"/);
});

test('a legacy shadow flag draws no shadow: only the effects list is read', () => {
    assert.equal(drawn({ shadow: true, shadowX: 0, shadowY: 4 }).style.boxShadow, undefined);
});

test('a drop shadow is a box shadow with its offset, blur, spread and colour; its opacity is the colour alpha', () => {
    const effects = [{ type: 'drop', visible: true, x: 2, y: 4, blur: 10, spread: 1, color: '#000000', opacity: 0.5 }];
    assert.equal(drawn({ effects }).style.boxShadow, '2px 4px 10px 1px #00000080');
});

test('an inner shadow is an inset box shadow', () => {
    const effects = [{ type: 'inner', visible: true, x: 0, y: 2, blur: 6, spread: 0, color: '#000000', opacity: 0.25 }];
    assert.match(drawn({ effects }).style.boxShadow, /^inset 0px 2px 6px 0px #00000040$/);
});

test('a hidden effect draws nothing', () => {
    assert.equal(drawn({ effects: [{ type: 'drop', visible: false, x: 2, y: 4, blur: 10, color: '#000000', opacity: 1 }] }).style.boxShadow, undefined);
});

test('layer blur blurs the layer by half its radius, as the canvas does', () => {
    assert.equal(drawn({ effects: [{ type: 'layerBlur', visible: true, radius: 8 }] }).style.filter, 'blur(4px)');
});

test('background blur blurs what is behind the layer, by half its radius', () => {
    assert.equal(drawn({ effects: [{ type: 'bgBlur', visible: true, radius: 8 }] }).style.backdropFilter, 'blur(4px)');
});

test('glass has no DOM form yet: it is reported as not drawn', () => {
    const { unsupported } = toDomTree(docOf([frame('A'), layer({ effects: [{ type: 'glass', visible: true }] })]), 'A');
    assert.deepEqual(unsupported, [{ nodeId: 'L', type: 'glass' }]);
});

test('a group that clips its content hides what is outside it', () => {
    const group = { id: 'G', name: 'G', type: 'group', parentId: 'A', x: 0, y: 0, w: 100, h: 100, clip: true };
    const { root } = toDomTree(docOf([frame('A'), group, layer({ parentId: 'G' })]), 'A');
    assert.equal(root.children[0].style.overflow, 'hidden');
});

test('a text layer with a stroke draws a text stroke of its width and colour, not a box border', () => {
    const style = drawn({ type: 'text', text: 'Hi', fill: '#000000', stroke: '#ff0000', strokeWidth: 2, strokeOpacity: 1 }).style;
    assert.equal(style.WebkitTextStroke, '2px #ff0000');
    assert.equal(style.border, undefined);
});

test('a text glyph shadow is a drop-shadow filter on the glyphs, not a box shadow', () => {
    const style = drawn({ type: 'text', text: 'Hi', fill: '#000000', effects: [{ type: 'drop', visible: true, x: 2, y: 4, blur: 10, color: '#000000', opacity: 0.5 }] }).style;
    assert.equal(style.filter, 'drop-shadow(2px 4px 10px #00000080)');
    assert.equal(style.boxShadow, undefined);
});

test('a truncated text layer clamps to its max lines with an ellipsis', () => {
    const style = drawn({ type: 'text', text: 'Hi', fill: '#000000', textTruncate: true, maxLines: 2 }).style;
    assert.deepEqual([style.display, style.WebkitLineClamp, style.WebkitBoxOrient, style.overflow], ['-webkit-box', '2', 'vertical', 'hidden']);
});

test('a text layer that is not truncated has no line clamp, even with a max lines value', () => {
    assert.equal(drawn({ type: 'text', text: 'Hi', fill: '#000000', maxLines: 2 }).style.WebkitLineClamp, undefined);
});

test('text wrap balance and pretty map to the text-wrap property; the default wraps as it always did', () => {
    assert.equal(drawn({ type: 'text', text: 'Hi', fill: '#000000', textWrap: 'balance' }).style.textWrap, 'balance');
    assert.equal(drawn({ type: 'text', text: 'Hi', fill: '#000000', textWrap: 'pretty' }).style.textWrap, 'pretty');
    assert.equal(drawn({ type: 'text', text: 'Hi', fill: '#000000', textWrap: 'default' }).style.textWrap, undefined);
});

test('a line draws no fill, however its fill is set', () => {
    assert.equal(drawn({ type: 'line', fill: '#ff0000', stroke: '#000000', strokeWidth: 1 }).style.background, undefined);
});
