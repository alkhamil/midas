// Boolean operations (pure). The operands of a boolean group become polygons, the polygon clipping combines them, and the result is stored
// as one path. Nothing is drawn here: the canvas and Play both draw the stored path. The operands are the layers inside the group.
import polygonClipping from 'polygon-clipping';
import { arcActive, arcPoly } from './shapes.js';

/** The polygon-clipping operation of each boolean operation. */
const OPERATION = { union: 'union', intersect: 'intersection', subtract: 'difference', exclude: 'xor' };

/**
 * A point through a 2D affine matrix [a, b, c, d, e, f].
 * @param {number[]} m
 * @param {number} x
 * @param {number} y
 */
const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

/**
 * A path's points as a polyline in the layer's own size: a curve segment becomes 24 steps.
 * @param {any} n the path
 * @param {{ x: number, y: number, in?: { x: number, y: number }, out?: { x: number, y: number } }[]} [pts] the points (the layer's own by default)
 * @param {boolean} [closed] whether the points close (the layer's own flag by default)
 * @returns {{ x: number, y: number }[]}
 */
export function flattenPath(n, pts = n.points || [], closed = n.closed) {
    const sx = n.w / (n.pathW || n.w || 1), sy = n.h / (n.pathH || n.h || 1), out = [];
    const seg = (a, b) => {
        if (a.out || b.in) {
            const p0 = { x: a.x * sx, y: a.y * sy }, p1 = { x: (a.out?.x ?? a.x) * sx, y: (a.out?.y ?? a.y) * sy }, p2 = { x: (b.in?.x ?? b.x) * sx, y: (b.in?.y ?? b.y) * sy }, p3 = { x: b.x * sx, y: b.y * sy };
            for (let i = 1; i <= 24; i++) {
                const t = i / 24, u = 1 - t;
                out.push({ x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y });
            }
        }
        else
            out.push({ x: b.x * sx, y: b.y * sy });
    };
    if (!pts.length)
        return out;
    out.push({ x: pts[0].x * sx, y: pts[0].y * sy });
    for (let i = 1; i < pts.length; i++)
        seg(pts[i - 1], pts[i]);
    if (closed && pts.length > 1)
        seg(pts.at(-1), pts[0]);
    return out;
}

/**
 * The polygons one operand contributes, in the scene's coordinates. A frame or group contributes the shapes inside it, not its own box.
 * Null for a layer with no closed outline (an open path, text, a line).
 * @param {any} n
 * @param {{ children: (id: string) => any[], world: (id: string) => number[] }} scene the children and the matrix of a node
 * @returns {number[][][][] | null} polygons, each a list of rings of [x, y] points
 */
export function operandPolygons(n, scene) {
    if ((n.type === 'frame' || n.type === 'group') && scene.children(n.id).length) {
        const out = [];
        for (const c of scene.children(n.id))
            if (c.visible !== false)
                out.push(...(operandPolygons(c, scene) || []));
        return out.length ? out : null;
    }
    const m = scene.world(n.id), tp = (x, y) => { const q = apply(m, x, y); return [q.x, q.y]; };
    let ring = null;
    if (n.type === 'ellipse' && arcActive(n)) {
        const polys = arcPoly(n).map(r => r.map(([x, y]) => tp(x, y)));
        return [polys];
    }
    if (n.type === 'ellipse') {
        ring = [];
        for (let i = 0; i < 128; i++) {
            const a = i / 128 * Math.PI * 2;
            ring.push(tp(n.w / 2 + Math.cos(a) * n.w / 2, n.h / 2 + Math.sin(a) * n.h / 2));
        }
    }
    else if (n.type === 'path') {
        if (!n.closed)
            return null;
        // Every closed sub-path counts: rings inside other rings become holes (even-odd), so icons keep their counters.
        const rings = [flattenPath(n).map(p => tp(p.x, p.y))];
        for (const c of n.contours || [])
            if (c.closed !== false && (c.points || []).length > 2)
                rings.push(flattenPath(n, c.points, true).map(p => tp(p.x, p.y)));
        if (rings.length > 1) {
            const area = r => Math.abs(r.reduce((s, p, i) => { const q = r[(i + 1) % r.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
            const inside = (pt, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > pt[1]) !== (r[j][1] > pt[1]) && pt[0] < (r[j][0] - r[i][0]) * (pt[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
            const info = rings.map((r, i) => ({ r, a: area(r), cont: rings.map((o, j) => j !== i && inside(r[0], o) ? j : -1).filter(j => j >= 0) }));
            const polys = [];
            const owner = new Map();
            for (const x of info.filter(x => x.cont.length % 2 === 0)) { const p = [x.r]; polys.push(p); owner.set(x, p); }
            for (const x of info.filter(x => x.cont.length % 2 === 1)) {
                const parent = info.filter(o => o.cont.length === x.cont.length - 1 && x.cont.includes(info.indexOf(o))).sort((a, b) => a.a - b.a)[0];
                if (parent && owner.get(parent))
                    owner.get(parent).push(x.r);
            }
            return polys.filter(p => p[0].length >= 3);
        }
        ring = rings[0];
    }
    else if (['rect', 'frame', 'image'].includes(n.type))
        ring = [tp(0, 0), tp(n.w, 0), tp(n.w, n.h), tp(0, n.h)];
    else
        return null;
    return ring.length >= 3 ? [[ring]] : null;
}

/**
 * The operands combined by one boolean operation (union, intersect, subtract or exclude). With one operand it is its union. Throws when
 * the clipping fails.
 * @param {string} op
 * @param {number[][][][]} polys the operands' polygons, in stacking order (the first is the base for subtract)
 * @returns {number[][][][]} the result polygons
 */
export function combine(op, polys) {
    const [a, ...rest] = polys;
    if (!rest.length)
        return polygonClipping.union(a);
    return polygonClipping[OPERATION[op] ?? 'xor'](a, ...rest);
}

/**
 * The stored form of a boolean result: a path whose points are relative to its box, and the box in the parent's coordinates. More than one
 * ring makes a path with holes, drawn even-odd.
 * @param {number[][][][]} res the result polygons
 * @param {(x: number, y: number) => { x: number, y: number }} toLocal a scene point in the parent's coordinates
 */
export function resultPathOf(res, toLocal) {
    const rings = res.flatMap(poly => poly).map(r => {
        const q = r.map(([x, y]) => toLocal(x, y));
        if (q.length > 1 && q[0].x === q.at(-1).x && q[0].y === q.at(-1).y)
            q.pop();
        return q;
    });
    const xs = rings.flat().map(p => p.x), ys = rings.flat().map(p => p.y), minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(1, Math.max(...xs) - minX), h = Math.max(1, Math.max(...ys) - minY);
    const rel = r => r.map(p => ({ x: p.x - minX, y: p.y - minY }));
    const props = { x: minX, y: minY, w, h, pathW: w, pathH: h, points: rel(rings[0]), closed: true };
    if (rings.length > 1) {
        props.contours = rings.slice(1).map(r => ({ points: rel(r), closed: true }));
        props.fillRule = 'evenodd';
    }
    return props;
}
