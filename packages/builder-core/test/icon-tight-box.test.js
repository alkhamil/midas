// Every icon glyph vector is the tight box of its path (all contours, Bezier extrema), placed at its offset inside the fixed icon frame, and it follows the frame
// by the Scale constraint (the frame keeps its token-bound size; the glyph scales with it). The oracle is independent of the engine: the curves are sampled.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ICON_SET, iconNodes } from '../src/behavior-engine/icon-set.js';

const sample = (a, b, t) => {
    const c1 = a.out ?? a, c2 = b.in ?? b, u = 1 - t;
    return { x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x, y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y };
};
/** Brute-force bounds of every contour of an icon entry: anchors plus 4000 samples per segment. */
function boundsOf(entry) {
    const contours = [{ points: entry.points, closed: entry.closed }, ...(entry.contours ?? []).map(c => ({ points: c.points, closed: c.closed !== false }))];
    const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    const add = p => { b.minX = Math.min(b.minX, p.x); b.minY = Math.min(b.minY, p.y); b.maxX = Math.max(b.maxX, p.x); b.maxY = Math.max(b.maxY, p.y); };
    for (const { points, closed } of contours) {
        for (const p of points) add(p);
        for (let i = 0; i < (closed ? points.length : points.length - 1); i++) {
            const a = points[i], c = points[(i + 1) % points.length];
            if (!a.out && !c.in) continue;
            for (let k = 1; k < 4000; k++) add(sample(a, c, k / 4000));
        }
    }
    return b;
}

for (const entry of ICON_SET) {
    test(`${entry.name}: the vector box is the tight bounds of its path, at its offset in the 24 frame`, () => {
        const [root, path] = iconNodes(entry, key => key);
        const b = boundsOf(entry);
        assert.deepEqual([root.w, root.h], [24, 24], 'the frame keeps its size');
        assert.ok(Math.abs(path.w - (b.maxX - b.minX)) < 1e-2, `width ${path.w} vs ${b.maxX - b.minX}`);
        assert.ok(Math.abs(path.h - (b.maxY - b.minY)) < 1e-2, `height ${path.h} vs ${b.maxY - b.minY}`);
        assert.ok(Math.abs(path.x - b.minX) < 1e-2 && Math.abs(path.y - b.minY) < 1e-2, `offset ${path.x},${path.y} vs ${b.minX},${b.minY}`);
        // The drawn points sit in the box: their own tight bounds start at the origin and end at the box.
        const own = boundsOf({ points: path.points, contours: path.contours, closed: path.closed });
        assert.ok(Math.abs(own.minX) < 1e-2 && Math.abs(own.minY) < 1e-2 && Math.abs(own.maxX - path.w) < 1e-2 && Math.abs(own.maxY - path.h) < 1e-2, 'the outline touches all four sides of its box');
        assert.deepEqual([path.pathW, path.pathH], [path.w, path.h], 'the outline is drawn in its own box');
    });
}

test('the glyph follows its frame by Scale, out of the flow, at its offset', () => {
    for (const entry of ICON_SET) {
        const [root, path] = iconNodes(entry, key => key);
        assert.deepEqual([path.layoutPositioning, path.constraintH, path.constraintV], ['absolute', 'scale', 'scale']);
        assert.deepEqual([path.layoutSizingH, path.layoutSizingV], ['fixed', 'fixed']);
        assert.deepEqual([root.layoutSizingH, root.layoutSizingV], ['fixed', 'fixed'], 'the frame stays fixed: the token owns its size');
    }
});
