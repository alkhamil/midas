import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combine, operandPolygons, resultPathOf, flattenPath } from '../src/geometry/boolean.js';
import { toDomTree } from '../src/prototype/dom-tree.js';

const square = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** Area of a result: the outer ring of each polygon, less its holes. */
const areaOf = polys => polys.reduce((sum, poly) => {
    const ring = r => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
    return sum + ring(poly[0]) - poly.slice(1).reduce((h, r) => h + ring(r), 0);
}, 0);
const scene = nodes => ({ children: id => nodes.filter(n => n.parentId === id), world: id => { const n = nodes.find(x => x.id === id); return [1, 0, 0, 1, n?.x ?? 0, n?.y ?? 0]; } });
const rect = (id, x, y, w, h, parentId = null) => ({ id, type: 'rect', parentId, x, y, w, h });

test('union, intersection, difference and exclusion of two squares have the areas their operations give', () => {
    const a = [square(0, 0, 4, 4)], b = [square(2, 2, 4, 4)];
    assert.equal(areaOf(combine('union', [a, b])), 28);
    assert.equal(areaOf(combine('intersect', [a, b])), 4);
    assert.equal(areaOf(combine('subtract', [a, b])), 12);
    assert.equal(areaOf(combine('exclude', [a, b])), 24);
});

test('a single operand is its own union', () => {
    assert.equal(areaOf(combine('union', [[square(0, 0, 3, 3)]])), 9);
});

test('a rectangle and an ellipse give their polygons in the scene, and an open path has no outline', () => {
    const r = rect('r', 10, 20, 30, 40);
    const [[ring]] = operandPolygons(r, scene([r]));
    assert.deepEqual(ring.map(([x, y]) => [x, y]), [[10, 20], [40, 20], [40, 60], [10, 60]]);
    const ellipse = operandPolygons({ id: 'e', type: 'ellipse', x: 0, y: 0, w: 20, h: 20 }, scene([{ id: 'e', x: 0, y: 0 }]));
    assert.equal(ellipse[0][0].length, 128);
    assert.equal(operandPolygons({ id: 'p', type: 'path', closed: false, x: 0, y: 0, w: 10, h: 10, points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }, scene([])), null);
});

test('a frame operand contributes the shapes inside it, not its own box', () => {
    const nodes = [rect('inner', 0, 0, 5, 5, 'f')];
    const frame = { id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 100 };
    const polys = operandPolygons(frame, scene(nodes));
    assert.equal(polys.length, 1);
    assert.equal(areaOf(polys), 25);
});

test('a path with holes: the rings inside another ring are holes, and the result is even-odd', () => {
    const outer = { id: 'p', type: 'path', closed: true, x: 0, y: 0, w: 10, h: 10, pathW: 10, pathH: 10, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], contours: [{ points: [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 7, y: 7 }, { x: 3, y: 7 }], closed: true }] };
    const polys = operandPolygons(outer, scene([]));
    assert.equal(polys.length, 1);
    assert.equal(polys[0].length, 2, 'the inner ring is a hole of the outer one');
    assert.equal(areaOf(polys), 100 - 16);
});

test('flattening a curve segment gives 24 steps, and a point list without a closing segment stays open', () => {
    const curve = { w: 10, h: 10, pathW: 10, pathH: 10, closed: false, points: [{ x: 0, y: 0, out: { x: 5, y: 0 } }, { x: 10, y: 0 }] };
    assert.equal(flattenPath(curve).length, 25);
});

test('the stored result is a path in the parent\'s coordinates, with holes as contours drawn even-odd', () => {
    const res = [[square(10, 10, 20, 20), square(14, 14, 4, 4)]];
    const props = resultPathOf(res, (x, y) => ({ x: x - 5, y: y - 5 }));
    assert.deepEqual([props.x, props.y, props.w, props.h], [5, 5, 20, 20]);
    assert.equal(props.points.length, 4);
    assert.equal(props.contours.length, 1);
    assert.equal(props.fillRule, 'evenodd');
});

const pathWith = (extra = {}) => ({ id: 'bool', name: 'Eye', type: 'path', parentId: null, x: 0, y: 0, w: 10, h: 10, pathW: 10, pathH: 10, closed: true, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], fills: [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }], ...extra });

test('a boolean group with a stored result draws that path, and its operands are not drawn', () => {
    const operand = { id: 'op', name: 'op', type: 'rect', parentId: 'bool', x: 0, y: 0, w: 10, h: 10, fills: [{ type: 'solid', color: '#000000', opacity: 1, visible: true }] };
    const { root, unsupported } = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [{ id: 'A', name: 'A', type: 'frame', parentId: null, x: 0, y: 0, w: 100, h: 100, fills: [] }, pathWith({ parentId: 'A', booleanOp: 'subtract' }), operand] }] }, 'A');
    assert.deepEqual(unsupported, []);
    assert.equal(root.children.length, 1);
    assert.match(root.children[0].html, /<path d="M0 0L10 0L10 10L0 0Z"/);
    assert.equal(root.children[0].children.length, 0);
});

test('a boolean group with no stored result is reported, not drawn', () => {
    const { root, unsupported } = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [{ id: 'A', name: 'A', type: 'frame', parentId: null, x: 0, y: 0, w: 100, h: 100, fills: [] }, pathWith({ id: 'g', parentId: 'A', type: 'group', booleanOp: 'union', points: undefined })] }] }, 'A');
    assert.deepEqual(unsupported, [{ nodeId: 'g', type: 'boolean' }]);
    assert.equal(root.children.length, 0);
});

test('a path with the even-odd rule is drawn even-odd; the default is nonzero', () => {
    const evenodd = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [{ id: 'A', name: 'A', type: 'frame', parentId: null, x: 0, y: 0, w: 100, h: 100, fills: [] }, pathWith({ id: 'e', parentId: 'A', fillRule: 'evenodd', closed: true })] }] }, 'A').root.children[0].html;
    assert.match(evenodd, /fill-rule="evenodd"/);
    const nonzero = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [{ id: 'A', name: 'A', type: 'frame', parentId: null, x: 0, y: 0, w: 100, h: 100, fills: [] }, pathWith({ id: 'n', parentId: 'A' })] }] }, 'A').root.children[0].html;
    assert.doesNotMatch(nonzero, /fill-rule/);
});
