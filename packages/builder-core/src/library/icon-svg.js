// Icon components from the design: the vector layers of an icon component → SVG parts. Pure (no DOM), so Studio and the server share it.
//
// A vector layer carries its outline as bezier points (`points`, or several `contours`); handles (`in` / `out`) are absolute
// positions in the layer's own coordinate space (`pathW` × `pathH`), which the layer box (`w` × `h`) maps onto the icon.

const fx = v => +Number(v).toFixed(3);

function contourPath(points, closed, t) {
    if (!points?.length) return '';
    const P = (x, y) => `${fx(t.ox + x * t.sx)} ${fx(t.oy + y * t.sy)}`;
    const H = (handle, pt) => (handle ? P(handle.x, handle.y) : P(pt.x, pt.y));
    const seg = (a, b) => (a.out || b.in ? ` C${H(a.out, a)} ${H(b.in, b)} ${P(b.x, b.y)}` : ` L${P(b.x, b.y)}`);
    let d = `M${P(points[0].x, points[0].y)}`;
    for (let i = 1; i < points.length; i++) d += seg(points[i - 1], points[i]);
    if (closed) d += `${seg(points[points.length - 1], points[0])} Z`;
    return d;
}

/** Fill / stroke attributes of a layer: a plain fill follows `currentColor`; a stroke-only layer keeps its stroke width. */
function paintAttrs(n) {
    const attrs = {};
    const filled = n.fill && n.fill !== 'none' && (!Array.isArray(n.fills) || n.fills.some(f => f.visible !== false));
    const stroked = n.stroke && n.stroke !== 'none' && n.strokeWidth > 0;
    if (!filled) attrs.fill = 'none';
    if (stroked) Object.assign(attrs, { stroke: 'currentColor', strokeWidth: fx(n.strokeWidth), strokeLinecap: n.strokeCap === 'butt' ? 'butt' : 'round', strokeLinejoin: n.strokeJoin === 'miter' ? 'miter' : 'round' });
    const op = n.opacity ?? n.fills?.[0]?.opacity;
    if (op != null && op < 1) attrs.opacity = fx(op);
    return { attrs, visible: filled || stroked };
}

/**
 * The SVG of an icon component.
 * @param {object[]} nodes  every node of the icon (the root and its layers, parent links by `parentId`)
 * @param {string} rootId   the icon component's root layer
 * @returns {{ width: number, height: number, parts: { tag: 'path' | 'rect' | 'ellipse', attrs: Record<string, string | number> }[], warnings: string[] }}
 */
export function iconSvg(nodes, rootId) {
    const kids = new Map();
    for (const n of nodes) if (n.parentId) (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const root = nodes.find(n => n.id === rootId);
    const parts = [], warnings = [];
    const walk = (n, ox, oy) => {
        for (const c of kids.get(n.id) || []) {
            if (c.visible === false) continue;
            const x = ox + (c.x || 0), y = oy + (c.y || 0);
            const { attrs, visible } = paintAttrs(c);
            if (c.type === 'path' && visible) {
                const t = { ox: x, oy: y, sx: c.pathW ? (c.w || c.pathW) / c.pathW : 1, sy: c.pathH ? (c.h || c.pathH) / c.pathH : 1 };
                // `points` is the main outline, `contours` are extra sub-paths (a hole, a stroke-like line): the studio draws both
                const list = [{ points: c.points || [], closed: c.closed }, ...(c.contours || []).map(k => ({ points: k.points || [], closed: k.closed !== false }))].filter(k => k.points.length);
                const d = list.map(k => contourPath(k.points, k.closed ?? c.closed ?? true, t)).join(' ');
                if (d) parts.push({ tag: 'path', attrs: { d, ...(c.fillRule === 'evenodd' ? { fillRule: 'evenodd' } : {}), ...attrs } });
            }
            else if (c.type === 'rect' && visible) parts.push({ tag: 'rect', attrs: { x: fx(x), y: fx(y), width: fx(c.w), height: fx(c.h), ...(c.radius ? { rx: fx(c.radius) } : {}), ...attrs } });
            else if (c.type === 'ellipse' && visible) parts.push({ tag: 'ellipse', attrs: { cx: fx(x + c.w / 2), cy: fx(y + c.h / 2), rx: fx(c.w / 2), ry: fx(c.h / 2), ...attrs } });
            else if (!['frame', 'group', 'path', 'rect', 'ellipse'].includes(c.type)) warnings.push(`${c.name || c.type}: a ${c.type} layer is not drawn in the icon`);
            walk(c, x, y);
        }
    };
    if (root) walk(root, 0, 0);
    return { width: root?.w || 24, height: root?.h || 24, parts, warnings };
}

/** Whether a component is only vector layers of icon size (no text, no instances): it becomes an icon component, not a UI component. */
export function isIconComponent(component) {
    if (component.set) return false;
    const root = component.nodes.find(n => n.id === component.id);
    if (!root || root.w > 64 || root.h > 64) return false;
    const layers = component.nodes.filter(n => n.id !== root.id);
    return layers.length > 0 && layers.every(n => ['path', 'rect', 'ellipse', 'frame', 'group'].includes(n.type) && !n.isInstance) && layers.some(n => ['path', 'rect', 'ellipse'].includes(n.type));
}
