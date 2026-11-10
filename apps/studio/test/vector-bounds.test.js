// Vector boxes are the tight bounds of the path geometry (all contours, bezier extrema), not the
// viewBox the points were authored in. normalizeVectorGeometry is the pure core the canvas creation
// and edit paths share; it is cut out of midas.js by name (as studioReplay.js does): a missing helper
// fails here, so the test can never pass over a re-implementation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function sliceFunction(name) {
    const head = src.indexOf(`\nfunction ${name}(`) >= 0 ? src.indexOf(`\nfunction ${name}(`) + 1 : src.indexOf(`function ${name}(`);
    if (head < 0) throw new Error(`midas.js has no function ${name}`);
    const lineEnd = src.indexOf('\n', head);
    const firstLine = src.slice(head, lineEnd);
    if (/\}\s*$/.test(firstLine) && (firstLine.match(/\{/g) || []).length === (firstLine.match(/\}/g) || []).length) return firstLine;
    return src.slice(head, src.indexOf('\n}\n', head) + 2);
}

const fns = ['pathCurveBounds', 'pathContours', 'normalizeVectorGeometry'];
const body = `${fns.map(sliceFunction).join('\n')}\nreturn { ${fns.join(', ')} };`;
const { pathCurveBounds, pathContours, normalizeVectorGeometry } = new Function(body)();

const pt = (x, y, out, inn) => ({ x, y, ...(out ? { out } : {}), ...(inn ? { in: inn } : {}) });
const approx = (v, e = 1e-9) => Math.abs(v) < e ? 0 : v;

test('a single contour of straight segments boxes its anchors', () => {
    const b = pathCurveBounds([pt(4, 4), pt(20, 4), pt(20, 12), pt(4, 12)], true);
    assert.deepEqual(b, { minX: 4, minY: 4, maxX: 20, maxY: 12 });
});

test('every contour counts: a hole outside the main outline stretches the box', () => {
    const n = { points: [pt(5, 5), pt(10, 5), pt(10, 10), pt(5, 10)], closed: true, contours: [{ points: [pt(20, 20), pt(24, 20), pt(24, 24), pt(20, 24)], closed: true }] };
    const subs = pathContours(n);
    assert.equal(subs.length, 2);
    const box = subs.map(c => pathCurveBounds(c.points, c.closed)).reduce((a, b) => ({ minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }));
    assert.deepEqual(box, { minX: 5, minY: 5, maxX: 24, maxY: 24 });
});

test('a curve bulging past its anchors boxes the extrema, not the handles', () => {
    // A symmetric hump: anchors at y=0, control points pull it up to y=-7.5 at the middle.
    const b = pathCurveBounds([pt(0, 0, { x: 10, y: -10 }), pt(20, 0, null, { x: 10, y: -10 })], false);
    assert.equal(b.minX, 0);
    assert.equal(b.maxX, 20);
    assert.ok(b.minY < -7 && b.minY > -8, `extremum ${b.minY}, not the handle at -10`);
    assert.equal(b.maxY, 0);
});

test('normalizing wraps the tight box and moves the points into it', () => {
    const out = normalizeVectorGeometry({ points: [pt(10, 10), pt(30, 10), pt(30, 20), pt(10, 20)], contours: [], closed: true }, 1, 1);
    assert.deepEqual([out.w, out.h], [20, 10]);
    assert.deepEqual([out.dx, out.dy], [10, 10]);
    assert.deepEqual(out.points.map(p => [p.x, p.y]), [[0, 0], [20, 0], [20, 10], [0, 10]]);
});

test('normalizing an edited vector recomputes from the moved points', () => {
    // Dragging one anchor out: the box follows the new geometry, old box ignored.
    const out = normalizeVectorGeometry({ points: [pt(0, 0), pt(40, 0), pt(40, 40), pt(0, 40)], contours: [], closed: true }, 1, 1);
    assert.deepEqual([out.w, out.h, out.dx, out.dy], [40, 40, 0, 0]);
    const moved = normalizeVectorGeometry({ points: [pt(-10, -5), pt(40, 0), pt(40, 40), pt(0, 40)], contours: [], closed: true }, 1, 1);
    assert.deepEqual([approx(moved.w), approx(moved.h), approx(moved.dx), approx(moved.dy)], [50, 45, -10, -5]);
    assert.deepEqual(moved.points[0], { x: 0, y: 0 });
});

test('handles travel with their anchor, in the same space', () => {
    const out = normalizeVectorGeometry({ points: [pt(14, 14, { x: 4, y: 4 }, { x: 24, y: 24 })], contours: [], closed: false }, 1, 1);
    assert.deepEqual(out.points[0], { x: 0, y: 0, out: { x: -10, y: -10 }, in: { x: 10, y: 10 } });
});
