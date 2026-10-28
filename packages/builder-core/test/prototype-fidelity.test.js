import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);

const frame = (id, extra = {}) => ({ id, name: id, type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 200, fills: solid('#ffffff'), ...extra });
const layer = (extra = {}) => ({ id: 'L', name: 'L', type: 'rect', parentId: 'A', x: 10, y: 10, w: 80, h: 60, fills: solid('#112233'), ...extra });
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
    assert.equal(drawn({ fills: solid('#112233', 0.5) }).style.background, '#11223380');
    assert.equal(drawn({ fills: solid('#abc', 0.5) }).style.background, 'color-mix(in srgb, #abc 50%, transparent)');
    assert.equal(drawn({ fills: solid('rgb(1, 2, 3)', 0.5) }).style.background, 'color-mix(in srgb, rgb(1, 2, 3) 50%, transparent)');
});

test('a linear gradient runs in the canvas direction: its CSS angle is the canvas angle plus 90', () => {
    const style = drawn({ fills: [{ type: 'linear', color: '#000000', color2: '#ffffff', angle: 0, opacity: 1, visible: true }] }).style;
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
    const style = drawn({ type: 'text', text: 'Hi', fills: solid('#000000'), stroke: '#ff0000', strokeWidth: 2, strokeOpacity: 1 }).style;
    assert.equal(style.WebkitTextStroke, '2px #ff0000');
    assert.equal(style.border, undefined);
});

test('a text glyph shadow is a drop-shadow filter on the glyphs, not a box shadow', () => {
    const style = drawn({ type: 'text', text: 'Hi', fills: solid('#000000'), effects: [{ type: 'drop', visible: true, x: 2, y: 4, blur: 10, color: '#000000', opacity: 0.5 }] }).style;
    assert.equal(style.filter, 'drop-shadow(2px 4px 10px #00000080)');
    assert.equal(style.boxShadow, undefined);
});

test('a truncated text layer clamps to its max lines with an ellipsis', () => {
    const style = drawn({ type: 'text', text: 'Hi', fills: solid('#000000'), textTruncate: true, maxLines: 2 }).style;
    assert.deepEqual([style.display, style.WebkitLineClamp, style.WebkitBoxOrient, style.overflow], ['-webkit-box', '2', 'vertical', 'hidden']);
});

test('a text layer that is not truncated has no line clamp, even with a max lines value', () => {
    assert.equal(drawn({ type: 'text', text: 'Hi', fills: solid('#000000'), maxLines: 2 }).style.WebkitLineClamp, undefined);
});

test('text wrap balance maps to the text-wrap property; the default wraps as it always did', () => {
    assert.equal(drawn({ type: 'text', text: 'Hi', fills: solid('#000000'), textWrap: 'balance' }).style.textWrap, 'balance');
    assert.equal(drawn({ type: 'text', text: 'Hi', fills: solid('#000000'), textWrap: 'default' }).style.textWrap, undefined);
});

test('a line draws no fill, however its fill is set', () => {
    assert.equal(drawn({ type: 'line', fills: solid('#ff0000'), stroke: '#000000', strokeWidth: 1 }).style.background, undefined);
});

test('a boolean result is reported and its operands are not drawn', () => {
    const { root, unsupported } = toDomTree(docOf([frame('A'), layer({ id: 'G', type: 'group', booleanOp: 'union', fills: solid('none') }), layer({ id: 'K', parentId: 'G', type: 'rect' })]), 'A');
    assert.deepEqual(unsupported, [{ nodeId: 'G', type: 'boolean' }]);
    assert.deepEqual(root.children, []);
});

test('a mask is reported and not drawn', () => {
    const { root, unsupported } = toDomTree(docOf([frame('A'), layer({ type: 'ellipse', isMask: true })]), 'A');
    assert.deepEqual(unsupported, [{ nodeId: 'L', type: 'mask' }]);
    assert.deepEqual(root.children, []);
});

test('a frame stroke is an SVG layer under its content, centred on the frame edge, not a CSS border', () => {
    const root = toDomTree(docOf([frame('A', { strokeWidth: 4, stroke: '#112233' }), layer()]), 'A').root;
    assert.equal(root.style.border, undefined);
    assert.equal(root.children[0].style.zIndex, '-1');
    assert.match(root.children[0].html, /stroke-width="4"/);
    assert.equal(root.style.isolation, 'isolate');
    assert.equal(root.children[1].nodeId, 'L');
});

test('a per-side frame stroke draws only the sides it names', () => {
    const root = toDomTree(docOf([frame('A', { strokeWidth: 4, stroke: '#112233', strokeSides: 'top' }), layer()]), 'A').root;
    assert.equal((root.children[0].html.match(/<rect x=/g) || []).length, 1);
});

test('an inside frame stroke is clipped to the frame, and a frame with no stroke has no stroke layer', () => {
    const inside = toDomTree(docOf([frame('A', { strokeWidth: 4, stroke: '#112233', strokeAlign: 'inside' })]), 'A').root;
    assert.match(inside.children[0].html, /<clipPath/);
    const plain = toDomTree(docOf([frame('A'), layer()]), 'A').root;
    assert.equal(plain.children.length, 1);
});

test('an outside frame stroke is the frame outline, which the frame clip does not cut; no overlay is drawn', () => {
    const root = toDomTree(docOf([frame('A', { strokeWidth: 6, stroke: '#c0392b', strokeAlign: 'outside' }), layer()]), 'A').root;
    assert.equal(root.style.outline, '6px solid #c0392b');
    assert.equal(root.style.outlineOffset, '0px');
    assert.equal(root.children.length, 1);
});

test('a centred frame stroke is the inner half as an overlay and the outer half as an outline', () => {
    const root = toDomTree(docOf([frame('A', { strokeWidth: 6, stroke: '#c0392b' }), layer()]), 'A').root;
    assert.equal(root.style.outline, '3px solid #c0392b');
    assert.match(root.children[0].html, /stroke-width="6"/);
});

test('an outside frame stroke on some sides only is reported: an outline cannot be per side', () => {
    const { root, unsupported } = toDomTree(docOf([frame('A', { strokeWidth: 6, stroke: '#c0392b', strokeAlign: 'outside', strokeSides: 'top' }), layer()]), 'A');
    assert.equal(root.style.outline, undefined);
    assert.deepEqual(unsupported, [{ nodeId: 'A', type: 'frame outside stroke on some sides' }]);
});
