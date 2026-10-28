import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { strokeDashArray } from '../src/geometry/shapes.js';

// The dashes and caps the canvas strokes with (paintStroke: setLineDash from strokeDashArray, lineCap, lineJoin, miterLimit), and the
// SVG outline Play draws them with. Dash lengths are in the layer's own units, as the canvas's path coordinates are.
const frame = { id: 'A', name: 'A', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 200, fills: [] };
const path = (extra = {}) => ({ id: 'p', name: 'p', type: 'path', parentId: 'A', x: 10, y: 10, w: 100, h: 60, pathW: 10, pathH: 6, closed: false, points: [{ x: 0, y: 0 }, { x: 10, y: 6 }], fills: [], stroke: '#112233', strokeWidth: 2, ...extra });
const svgOf = node => toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [frame, node] }] }, 'A').root.children[0].html;

test('a dash is the dash and gap lengths, and a dot is a zero dash with the gap: the same as the canvas', () => {
    assert.deepEqual(strokeDashArray({ strokeWidth: 2, strokeStyle: 'dash', strokeDash: 3, strokeGap: 2 }), [3, 2]);
    assert.deepEqual(strokeDashArray({ strokeWidth: 2, strokeStyle: 'dash', strokeDash: 0, strokeGap: 6 }), [0, 6]);
    assert.deepEqual(strokeDashArray({ strokeWidth: 2 }), []);
});

test('a dashed closed path draws its dashes with the layer\'s cap and join, and its stroke centred', () => {
    const svg = svgOf(path({ closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }], strokeStyle: 'dash', strokeDash: 3, strokeGap: 2, strokeCap: 'butt', strokeJoin: 'miter' }));
    assert.match(svg, /stroke-dasharray="3 2"/);
    assert.match(svg, /stroke-linecap="butt"/);
    assert.match(svg, /stroke-linejoin="miter"/);
});

test('a dashed open path is stroked without a fill, with its dashes and round caps', () => {
    const svg = svgOf(path({ strokeStyle: 'dash', strokeDash: 3, strokeGap: 1.5, strokeCap: 'round', strokeJoin: 'round' }));
    assert.match(svg, /stroke-dasharray="3 1.5"/);
    assert.match(svg, /stroke-linecap="round"/);
    assert.match(svg, /fill="none"/);
});

test('a dotted line is a zero dash with round caps, so each gap becomes a dot', () => {
    const svg = svgOf(path({ strokeWidth: 4, strokeStyle: 'dash', strokeDash: 0, strokeGap: 6, strokeCap: 'round', strokeJoin: 'round' }));
    assert.match(svg, /stroke-dasharray="0 6"/);
    assert.match(svg, /stroke-linecap="round"/);
});

test('the dash lengths are in the layer\'s units: resizing the path changes its geometry, not its dashes', () => {
    const dashes = w => svgOf(path({ w, strokeStyle: 'dash', strokeDash: 3, strokeGap: 2 })).match(/stroke-dasharray="([^"]+)"/)[1];
    assert.equal(dashes(100), '3 2');
    assert.equal(dashes(300), '3 2');
});

test('a vector layer in a flow is a positioned box, so its SVG outline is placed at its own corner', () => {
    const inFlow = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [{ ...frame, layout: 'horizontal' }, path({ parentId: 'A', x: 0, y: 0 })] }] }, 'A').root.children[0];
    assert.equal(inFlow.style.position, 'relative');
    const placed = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [frame, path({ parentId: 'A', x: 30, y: 40 })] }] }, 'A').root.children[0];
    assert.equal(placed.style.position, 'absolute');
    assert.equal(placed.style.left, '30px');
});
