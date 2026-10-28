import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathCommands, svgPathD, arcPoly, roundRectD, svgShapeEl, svgStrokeAttrs, svgStrokeExtra, strokeDashArray, strokeSideWidths, strokeSidesUniform } from '../src/geometry/shapes.js';

const f = v => +(+v).toFixed(2);
const e = s => String(s);
const shape = extra => ({ id: 's', type: 'rect', x: 0, y: 0, w: 100, h: 100, fill: '#000000', ...extra });

test('a rectangle is one rounded-rectangle command with its four corner radii, clamped to half the short side', () => {
    assert.deepEqual(pathCommands(shape({ w: 100, h: 40, radius: 30 })), [{ op: 'R', w: 100, h: 40, radii: [20, 20, 20, 20] }]);
    assert.deepEqual(pathCommands(shape({ radii: [1, 2, 3, 4] })), [{ op: 'R', w: 100, h: 100, radii: [1, 2, 3, 4] }]);
});

test('an ellipse is one full ellipse command centred in its box', () => {
    assert.deepEqual(pathCommands(shape({ type: 'ellipse', w: 80, h: 40 })), [{ op: 'E', cx: 40, cy: 20, rx: 40, ry: 20, start: 0, end: Math.PI * 2, ccw: false }]);
});

test('a line runs from its top-left to its bottom-right corner', () => {
    assert.deepEqual(pathCommands(shape({ type: 'line', w: 30, h: 10 })), [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: 30, y: 10 }]);
});

test('a vector path scales its points from its own size to the layer size, with curves and closed contours', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0, out: { x: 12, y: 2 } }, { x: 10, y: 10 }];
    const cmds = pathCommands(shape({ type: 'path', w: 200, h: 200, pathW: 10, pathH: 10, points: pts, closed: true }));
    assert.deepEqual(cmds[0], { op: 'M', x: 0, y: 0 });
    assert.deepEqual(cmds[1], { op: 'L', x: 200, y: 0 });
    assert.deepEqual(cmds[2], { op: 'C', x1: 240, y1: 40, x2: 200, y2: 200, x: 200, y: 200 });
    assert.deepEqual(cmds.at(-1), { op: 'Z' });
});

test('a donut arc is two closed sub-paths: the outer sweep and the inner ring, reversed', () => {
    const cmds = pathCommands(shape({ type: 'ellipse', w: 100, h: 100, arcSweep: 100, arcRatio: 50 }));
    assert.equal(cmds.filter(c => c.op === 'Z').length, 2);
    assert.deepEqual(cmds.find(c => c.op === 'E' && c.ccw), { op: 'E', cx: 50, cy: 50, rx: 25, ry: 25, start: 0, end: -Math.PI * 2, ccw: true });
});

test('an arc segment with no ratio closes through the centre', () => {
    const cmds = pathCommands(shape({ type: 'ellipse', w: 100, h: 100, arcStart: 0, arcSweep: 25, arcRatio: 0 }));
    assert.deepEqual(cmds.map(c => c.op), ['M', 'E', 'L', 'Z']);
    assert.deepEqual([cmds[2].x, cmds[2].y], [50, 50]);
});

test('the svg path of a quarter arc uses one small clockwise arc', () => {
    const d = svgPathD(pathCommands(shape({ type: 'ellipse', w: 100, h: 100, arcSweep: 25, arcRatio: 0 })), f);
    assert.match(d, /^M100 50A50 50 0 0 1 \d+(\.\d+)? \d+(\.\d+)?L50 50Z$/);
});

test('a full ellipse in svg is two half arcs, so it is not a degenerate arc', () => {
    const d = svgPathD(pathCommands(shape({ type: 'ellipse', w: 100, h: 100 })), f);
    assert.equal(d.match(/A/g).length, 2);
});

test('a counter-clockwise arc sweeps with the negative flag', () => {
    const d = svgPathD([{ op: 'M', x: 0, y: 0 }, { op: 'E', cx: 0, cy: 0, rx: 10, ry: 10, start: 0, end: Math.PI / 2, ccw: true }], f);
    assert.match(d, /A10 10 0 0 0 /);
});

test('the arc polygon used by boolean operations keeps the donut ring as its own ring', () => {
    const [outer, ring] = arcPoly(shape({ type: 'ellipse', w: 100, h: 100, arcSweep: 100, arcRatio: 50 }));
    assert.ok(outer.length > 90 && ring.length > 90);
});

test('the rounded rectangle path string is the same one the export always wrote', () => {
    assert.equal(roundRectD(10, 4, [2, 2, 2, 2], v => v), 'M2 0H8A2 2 0 0 1 10 2V2A2 2 0 0 1 8 4H2A2 2 0 0 1 0 2V2A2 2 0 0 1 2 0Z');
});

test('dash and side widths follow the stroke style and the side setting', () => {
    assert.deepEqual(strokeDashArray(shape({ strokeStyle: 'dash', strokeDash: 6, strokeGap: 4 })), [6, 4]);
    assert.deepEqual(strokeSideWidths(shape({ strokeWidth: 2, strokeSides: 'top' })), { t: 2, r: 0, b: 0, l: 0 });
    assert.equal(strokeSidesUniform(shape({ strokeWidth: 2, strokeSides: 'top' })), false);
});

test('an inside stroke is drawn as a clip of the shape, with twice the width', () => {
    const n = shape({ strokeWidth: 2, stroke: '#ff0000', strokeAlign: 'inside' });
    const { defs, el } = svgStrokeExtra(n, f, e, 'p');
    assert.match(defs, /<clipPath id="pk">/);
    assert.match(el, /stroke-width="4"/);
});

test('an outside stroke is drawn through a mask that cuts out the shape', () => {
    const n = shape({ strokeWidth: 2, stroke: '#ff0000', strokeAlign: 'outside' });
    assert.match(svgStrokeExtra(n, f, e, 'p').defs, /<mask id="pk"/);
});

test('a centred solid stroke is an attribute set on the shape, with caps, joins and dash', () => {
    const attrs = svgStrokeAttrs(shape({ strokeWidth: 3, stroke: '#00ff00', strokeCap: 'butt', strokeJoin: 'bevel', strokeStyle: 'dash' }), f, e);
    assert.match(attrs, /stroke-width="3"/);
    assert.match(attrs, /stroke-linecap="butt"/);
    assert.match(attrs, /stroke-linejoin="bevel"/);
    assert.match(attrs, /stroke-dasharray="10 10"/);
});

test('svgShapeEl draws a plain rectangle as a rect element and an arc as an evenodd path', () => {
    assert.match(svgShapeEl(shape({ radius: 4 }), f, 'fill="red"'), /^<rect width="100" height="100" rx="4" fill="red"\/>$/);
    assert.match(svgShapeEl(shape({ type: 'ellipse', arcRatio: 40 }), f, ''), /fill-rule="evenodd"/);
});
