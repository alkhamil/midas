// The tight box of vector geometry: every contour, Bézier extrema (not handles). One definition for the studio's creation and edit paths
// and for the icon generator, so a vector's box is the same wherever it is made.

// Tight bounds of the drawn curve (Bézier extrema), not of the handles that shape it.
export function pathCurveBounds(points, closed) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const addPt = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    const roots = (a, b, c) => {
        // t where the derivative of one axis is zero: a t² + b t + c = 0, within (0, 1)
        if (Math.abs(a) < 1e-12)
            return Math.abs(b) < 1e-12 ? [] : [-c / b];
        const d = b * b - 4 * a * c;
        if (d < 0)
            return [];
        const s = Math.sqrt(d);
        return [(-b + s) / (2 * a), (-b - s) / (2 * a)];
    };
    const at = (p0, p1, p2, p3, t) => { const u = 1 - t; return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3; };
    const n = points.length;
    for (const p of points)
        addPt(p.x, p.y);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
        const a = points[i], b = points[(i + 1) % n], c1 = a.out || a, c2 = b.in || b;
        if (!a.out && !b.in)
            continue;
        for (const axis of ['x', 'y']) {
            const p0 = a[axis], p1 = c1[axis], p2 = c2[axis], p3 = b[axis];
            for (const t of roots(3 * (-p0 + 3 * p1 - 3 * p2 + p3), 6 * (p0 - 2 * p1 + p2), 3 * (p1 - p0)))
                if (t > 0 && t < 1)
                    addPt(at(a.x, c1.x, c2.x, b.x, t), at(a.y, c1.y, c2.y, b.y, t));
        }
    }
    return { minX, minY, maxX, maxY };
}
// All sub-paths of a vector layer: the main points plus any extra contours (imported Figma vectors, boolean results).
export function pathContours(n) {
    return [{ points: n.points || [], closed: n.closed }, ...(n.contours || []).map(c => ({ points: c.points || [], closed: c.closed !== false }))];
}
// The tight box of vector geometry in its own path space, with the points moved into it: the pure core
// of normalizePath, so creation and edit paths share one tested computation. sx/sy map path units onto the
// node's current box (1 for a fresh path). Pure in, new arrays out; the node write stays with the caller.
export function normalizeVectorGeometry(shape, sx, sy) {
    const subs = [{ points: shape.points || [], closed: shape.closed }, ...((shape.contours || []).map(c => ({ points: c.points || [], closed: c.closed !== false })))];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of subs) {
        if (!c.points?.length)
            continue;
        const b = pathCurveBounds(c.points, c.closed);
        minX = Math.min(minX, b.minX);
        minY = Math.min(minY, b.minY);
        maxX = Math.max(maxX, b.maxX);
        maxY = Math.max(maxY, b.maxY);
    }
    const shift = pts => (pts || []).map(p => {
        const q = { ...p, x: (p.x - minX) * sx, y: (p.y - minY) * sy };
        for (const key of ['in', 'out'])
            if (p[key]) q[key] = { ...p[key], x: (p[key].x - minX) * sx, y: (p[key].y - minY) * sy };
        return q;
    });
    return {
        points: shift(shape.points),
        ...(shape.contours ? { contours: shape.contours.map(c => ({ ...c, points: shift(c.points) })) } : {}),
        w: Math.max(.1, (maxX - minX) * sx),
        h: Math.max(.1, (maxY - minY) * sy),
        dx: minX * sx,
        dy: minY * sy,
    };
}
