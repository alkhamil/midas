// Shape geometry (pure). The canvas, the SVG export and the DOM preview draw a layer's outline from this module: `pathCommands` gives the
// outline as commands, the canvas builds a Path2D from them, and SVG takes the `d` string or the element. No canvas API here.
//
// Commands: { op: 'M' | 'L', x, y }, { op: 'C', x1, y1, x2, y2, x, y }, { op: 'Z' }, { op: 'E', cx, cy, rx, ry, start, end, ccw } (an arc of an
// ellipse from the current point), and { op: 'R', w, h, radii } (a rounded rectangle, a sub-path of its own).

import { clamp } from './format.js';

export const RECT_LIKE = ['rect', 'frame', 'image'];

/** @param {any} n */
export function hasRadii(n) { return RECT_LIKE.includes(n.type) && Array.isArray(n.radii) && n.radii.length === 4; }

/**
 * Corner radii in order top-left, top-right, bottom-right, bottom-left, each clamped to half the shorter side.
 * @param {any} n
 * @returns {number[]}
 */
export function cornerRadii(n) {
    const m = Math.max(0, Math.min(n.w, n.h) / 2), r = hasRadii(n) ? n.radii : [n.radius || 0, n.radius || 0, n.radius || 0, n.radius || 0];
    return r.map(v => Math.max(0, Math.min(+v || 0, m)));
}

/** A rounded rectangle as an SVG path string, starting at the top-left corner's end. */
export function roundRectD(w, h, r, f = v => +(+v).toFixed(3)) {
    const [a, b, c, d] = r;
    return `M${f(a)} 0H${f(w - b)}A${f(b)} ${f(b)} 0 0 1 ${f(w)} ${f(b)}V${f(h - c)}A${f(c)} ${f(c)} 0 0 1 ${f(w - c)} ${f(h)}H${f(d)}A${f(d)} ${f(d)} 0 0 1 0 ${f(h - d)}V${f(a)}A${f(a)} ${f(a)} 0 0 1 ${f(a)} 0Z`;
}

/** An ellipse with an arc: a start angle and a sweep (percent of a full turn), and an inner ratio (percent) for a donut. */
export function arcActive(n) { return n.type === 'ellipse' && ((n.arcSweep ?? 100) < 100 || (n.arcRatio || 0) > 0); }

/** @param {any} n */
export function arcParams(n) {
    const a0 = (n.arcStart || 0) * Math.PI / 180, sweep = clamp((n.arcSweep ?? 100), 0, 100) / 100 * Math.PI * 2, ratio = clamp((n.arcRatio || 0) / 100, 0, .99);
    return { a0, sweep, ratio, full: sweep >= Math.PI * 2 - 1e-6 };
}

/**
 * The outline of an arc as a polygon in local space, for boolean operations: the outer sweep, and the inner ring when there is one.
 * @param {any} n
 * @param {number} [steps]
 * @returns {number[][][]} rings of [x, y] points
 */
export function arcPoly(n, steps = 96) {
    const { a0, sweep, ratio, full } = arcParams(n), cx = n.w / 2, cy = n.h / 2, rx = n.w / 2, ry = n.h / 2, pt = (a, k) => [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
    const out = [];
    const nOuter = Math.max(2, Math.ceil(steps * sweep / (Math.PI * 2)));
    for (let i = 0; i <= nOuter; i++)
        out.push(pt(a0 + sweep * i / nOuter, 1));
    if (full && ratio > 0)
        return [out.slice(0, -1), Array.from({ length: steps }, (_, i) => pt(a0 - Math.PI * 2 * i / steps, ratio))];
    if (ratio > 0)
        for (let i = nOuter; i >= 0; i--)
            out.push(pt(a0 + sweep * i / nOuter, ratio));
    else if (!full)
        out.push([cx, cy]);
    return [out];
}

/**
 * The outline of a layer in its own space, as commands.
 * @param {any} n
 * @returns {any[]}
 */
export function pathCommands(n) {
    if (n.type === 'ellipse' && arcActive(n)) return arcCommands(n);
    if (n.type === 'ellipse') return [{ op: 'E', cx: n.w / 2, cy: n.h / 2, rx: Math.max(.001, n.w / 2), ry: Math.max(.001, n.h / 2), start: 0, end: Math.PI * 2, ccw: false }];
    if (n.type === 'line') return [{ op: 'M', x: 0, y: 0 }, { op: 'L', x: n.w, y: n.h }];
    if (n.type === 'path') return vectorCommands(n);
    return [{ op: 'R', w: Math.max(0, n.w), h: Math.max(0, n.h), radii: cornerRadii(n) }];
}

/** An arc shape: a pie or a donut, with its inner ring reversed so the ring is a hole. */
function arcCommands(n) {
    const { a0, sweep, ratio, full } = arcParams(n), cx = n.w / 2, cy = n.h / 2, rx = Math.max(.001, n.w / 2), ry = Math.max(.001, n.h / 2);
    if (sweep <= 0) return [];
    const at = (a, k) => ({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
    if (full) {
        const cmds = [{ op: 'M', ...at(a0, 1) }, { op: 'E', cx, cy, rx, ry, start: a0, end: a0 + Math.PI * 2, ccw: false }, { op: 'Z' }];
        if (ratio > 0)
            cmds.push({ op: 'M', ...at(a0, ratio) }, { op: 'E', cx, cy, rx: rx * ratio, ry: ry * ratio, start: a0, end: a0 - Math.PI * 2, ccw: true }, { op: 'Z' });
        return cmds;
    }
    const a1 = a0 + sweep;
    const cmds = [{ op: 'M', ...at(a0, 1) }, { op: 'E', cx, cy, rx, ry, start: a0, end: a1, ccw: false }];
    if (ratio > 0)
        cmds.push({ op: 'L', ...at(a1, ratio) }, { op: 'E', cx, cy, rx: rx * ratio, ry: ry * ratio, start: a1, end: a0, ccw: true });
    else
        cmds.push({ op: 'L', x: cx, y: cy });
    cmds.push({ op: 'Z' });
    return cmds;
}

/** A vector path: its points scaled from its own size to the layer size. Several sub-paths (contours) each keep their own state. */
function vectorCommands(n) {
    const pts = n.points || [];
    if (!pts.length) return [];
    const sx = n.w / (n.pathW || n.w || 1), sy = n.h / (n.pathH || n.h || 1), cmds = [];
    const trace = (list, closed) => {
        if (!list?.length) return;
        cmds.push({ op: 'M', x: list[0].x * sx, y: list[0].y * sy });
        const seg = (a, b) => {
            if (a.out || b.in)
                cmds.push({ op: 'C', x1: (a.out?.x ?? a.x) * sx, y1: (a.out?.y ?? a.y) * sy, x2: (b.in?.x ?? b.x) * sx, y2: (b.in?.y ?? b.y) * sy, x: b.x * sx, y: b.y * sy });
            else
                cmds.push({ op: 'L', x: b.x * sx, y: b.y * sy });
        };
        for (let i = 1; i < list.length; i++)
            seg(list[i - 1], list[i]);
        if (closed) {
            seg(list.at(-1), list[0]);
            cmds.push({ op: 'Z' });
        }
    };
    trace(pts, n.closed);
    for (const c of n.contours || [])
        trace(c.points, c.closed !== false);
    return cmds;
}

/**
 * Replays commands on a sink. The canvas Path2D and the SVG path both read the outline through this one definition of the command set.
 * @param {any[]} commands
 * @param {{ moveTo: (x: number, y: number) => void, lineTo: (x: number, y: number) => void, curveTo: (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => void, closePath: () => void, ellipse: (cx: number, cy: number, rx: number, ry: number, start: number, end: number, ccw: boolean) => void, roundRect: (w: number, h: number, radii: number[]) => void }} sink
 */
export function replayCommands(commands, sink) {
    for (const c of commands) {
        if (c.op === 'M') sink.moveTo(c.x, c.y);
        else if (c.op === 'L') sink.lineTo(c.x, c.y);
        else if (c.op === 'C') sink.curveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
        else if (c.op === 'Z') sink.closePath();
        else if (c.op === 'E') sink.ellipse(c.cx, c.cy, c.rx, c.ry, c.start, c.end, c.ccw);
        else if (c.op === 'R') sink.roundRect(c.w, c.h, c.radii);
    }
}

/**
 * The SVG `d` of commands. An ellipse arc runs from the current point; a full ellipse is two half arcs, so it is never a degenerate arc.
 * @param {any[]} commands
 * @param {(v: number) => string | number} f number formatter
 * @returns {string}
 */
export function svgPathD(commands, f) {
    let d = '';
    replayCommands(commands, {
        moveTo: (x, y) => { d += `M${f(x)} ${f(y)}`; },
        lineTo: (x, y) => { d += `L${f(x)} ${f(y)}`; },
        curveTo: (x1, y1, x2, y2, x, y) => { d += `C${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)} ${f(x)} ${f(y)}`; },
        closePath: () => { d += 'Z'; },
        ellipse: (cx, cy, rx, ry, start, end, ccw) => { d += ellipseArcD({ cx, cy, rx, ry, start, end, ccw }, f); },
        roundRect: (w, h, radii) => { d += roundRectD(w, h, radii, f); },
    });
    return d;
}

/** @param {any} c an E command */
function ellipseArcD(c, f) {
    const at = a => `${f(c.cx + Math.cos(a) * c.rx)} ${f(c.cy + Math.sin(a) * c.ry)}`;
    const span = Math.abs(c.end - c.start), flag = c.ccw ? 0 : 1;
    if (span >= Math.PI * 2 - 1e-6) {
        const mid = c.start + (c.end - c.start) / 2;
        return `A${f(c.rx)} ${f(c.ry)} 0 1 ${flag} ${at(mid)}A${f(c.rx)} ${f(c.ry)} 0 1 ${flag} ${at(c.end)}`;
    }
    return `A${f(c.rx)} ${f(c.ry)} 0 ${span > Math.PI ? 1 : 0} ${flag} ${at(c.end)}`;
}

/** @param {any} n */
export function strokeIsOn(n) { return !['group'].includes(n.type) && n.strokeWidth > 0 && n.strokeVisible !== false && !!n.stroke && n.stroke !== 'none'; }

/** A line and an open path have no inside or outside: their stroke is centred. */
export function strokeClosed(n) { return !(n.type === 'line' || (n.type === 'path' && !n.closed)); }

/**
 * The stroke width of each side. `all` is one width; `custom` has its own per side; a single side is that side only.
 * @param {any} n
 * @returns {{ t: number, r: number, b: number, l: number }}
 */
export function strokeSideWidths(n) {
    const w = n.strokeWidth || 0, m = n.strokeSides || 'all';
    if (m === 'custom')
        return { t: n.strokeT ?? w, r: n.strokeR ?? w, b: n.strokeB ?? w, l: n.strokeL ?? w };
    if (m === 'all')
        return { t: w, r: w, b: w, l: w };
    return { t: m === 'top' ? w : 0, r: m === 'right' ? w : 0, b: m === 'bottom' ? w : 0, l: m === 'left' ? w : 0 };
}

const SIDE_KEYS = /** @type {const} */ (['strokeT', 'strokeR', 'strokeB', 'strokeL']);

/** The widest of the four side widths. */
const widest = (/** @type {{ t: number, r: number, b: number, l: number }} */ s) => Math.max(s.t, s.r, s.b, s.l);

/**
 * The weight the Stroke panel shows: the uniform width, or in per-side mode the width every side shares. Null when the sides differ
 * ("Mixed"), so the weight field never shows a number the sides do not have.
 * @param {any} n
 * @returns {number | null}
 */
export function strokeWeightOf(n) {
    if (n.strokeSides !== 'custom') return n.strokeWidth || 0;
    const s = strokeSideWidths(n);
    return s.t === s.r && s.r === s.b && s.b === s.l ? s.t : null;
}

/**
 * Sets the uniform stroke weight. In per-side mode every side takes it, so the weight and the sides never disagree.
 * @param {any} n
 * @param {number} width
 */
export function setStrokeWeight(n, width) {
    n.strokeWidth = width;
    if (n.strokeSides === 'custom') for (const k of SIDE_KEYS) n[k] = width;
}

/**
 * Sets the width of one side (`strokeT`, `strokeR`, `strokeB`, `strokeL`) in per-side mode. The uniform width follows the widest
 * side, so the stroke stays on while any side has a width.
 * @param {any} n
 * @param {'strokeT' | 'strokeR' | 'strokeB' | 'strokeL'} key
 * @param {number} width
 */
export function setStrokeSide(n, key, width) {
    n[key] = width;
    n.strokeWidth = widest(strokeSideWidths(n));
}

/**
 * Switches the sides a stroke draws on. Per-side (`custom`) seeds all four sides from the current weight, never from 0 (a side
 * that is not drawn is not seeded). Leaving per-side collapses the sides back into the uniform weight: the shared width, or the
 * widest side (the chosen side's own width for a single side), and the side widths are removed.
 * @param {any} n
 * @param {'all' | 'top' | 'right' | 'bottom' | 'left' | 'custom'} mode
 */
export function setStrokeSides(n, mode) {
    const was = n.strokeSides || 'all', sides = strokeSideWidths(n);
    if (mode === was) return;
    if (mode === 'custom') {
        const width = n.strokeWidth || widest(sides);
        n.strokeSides = 'custom';
        n.strokeWidth = width;
        for (const k of SIDE_KEYS) n[k] = width;
        return;
    }
    if (was === 'custom') {
        const own = mode === 'all' ? 0 : sides[/** @type {'t' | 'r' | 'b' | 'l'} */ (mode[0])];
        n.strokeWidth = own > 0 ? own : widest(sides);
        for (const k of SIDE_KEYS) delete n[k];
    }
    if (mode === 'all') delete n.strokeSides;
    else n.strokeSides = mode;
}
/** @param {any} n */
export function strokeSidesUniform(n) {
    if (!RECT_LIKE.includes(n.type)) return true;
    const s = strokeSideWidths(n);
    return s.t === s.r && s.r === s.b && s.b === s.l;
}

/** @param {any} n */
export function strokeDashArray(n) {
    const w = n.strokeWidth || 1;
    if (n.strokeStyle === 'dash') return [n.strokeDash ?? 10, n.strokeGap ?? 10];
    if (n.strokeStyle === 'dot') return [.01, Math.max(2, w * 2)];
    return [];
}

/** @param {any} n */
export function strokeMiterLimit(n) { return Math.max(1, 1 / Math.max(Math.sin((n.strokeMiter ?? 28.96) * Math.PI / 360), .001)); }

/** A stroke SVG can draw as an attribute set on the shape: centred, uniform, not a per-side one. */
function strokeSvgAdvanced(n) {
    return strokeIsOn(n) && ((n.strokeAlign && n.strokeAlign !== 'center' && strokeClosed(n)) || !strokeSidesUniform(n));
}

/**
 * The SVG element of a layer's geometry with the given attributes. A plain rectangle is a rect; an arc, a line, a path and rounded corners
 * are paths.
 * @param {any} n
 * @param {(v: number) => string | number} f
 * @param {string} a attributes
 */
export function svgShapeEl(n, f, a) {
    if (arcActive(n) || n.type === 'path' || n.type === 'line')
        return `<path d="${svgPathD(pathCommands(n), f)}"${arcActive(n) || n.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : ''} ${a}/>`;
    if (n.type === 'ellipse')
        return `<ellipse cx="${f(n.w / 2)}" cy="${f(n.h / 2)}" rx="${f(n.w / 2)}" ry="${f(n.h / 2)}" ${a}/>`;
    if (hasRadii(n))
        return `<path d="${roundRectD(n.w, n.h, cornerRadii(n), f)}" ${a}/>`;
    return `<rect width="${f(n.w)}" height="${f(n.h)}" rx="${f(Math.min(n.radius || 0, n.w / 2, n.h / 2))}" ${a}/>`;
}

/**
 * The stroke attributes of a shape drawn as one element. A stroke that needs a clip or a mask is left to `svgStrokeExtra`.
 * @param {any} n
 * @param {(v: number) => string | number} f
 * @param {(s: string) => string} e attribute escaper
 * @param {boolean} [icon] true inside a managed icon slot: a bound stroke paints in the slot colour
 */
export function svgStrokeAttrs(n, f, e, icon = false) {
    if (!strokeIsOn(n) || strokeSvgAdvanced(n))
        return 'stroke="none" stroke-width="0"';
    const w = RECT_LIKE.includes(n.type) ? strokeSideWidths(n).t : n.strokeWidth, dash = strokeDashArray(n);
    return `stroke="${icon && n.vars?.stroke ? 'currentColor' : e(n.stroke)}" stroke-opacity="${f(n.strokeOpacity ?? 1)}" stroke-width="${f(w)}" stroke-linecap="${n.strokeCap || 'round'}" stroke-linejoin="${n.strokeJoin || 'round'}" stroke-miterlimit="${f(strokeMiterLimit(n))}"${dash.length ? ` stroke-dasharray="${dash.map(f).join(' ')}"` : ''}`;
}

/**
 * The stroke of a shape that the attributes cannot draw: an inside or outside stroke (a clip or a mask of the shape), or per-side widths.
 * `defs` holds the clip or mask, `el` the stroke element; both are empty when the stroke is a plain attribute set.
 * @param {any} n
 * @param {(v: number) => string | number} f
 * @param {(s: string) => string} e
 * @param {string} prefix id prefix for the clip or mask
 * @returns {{ defs: string, el: string }}
 */
export function svgStrokeExtra(n, f, e, prefix) {
    if (!strokeSvgAdvanced(n))
        return { defs: '', el: '' };
    const align = strokeClosed(n) ? (n.strokeAlign || 'center') : 'center', sides = RECT_LIKE.includes(n.type) ? strokeSideWidths(n) : null, uniform = strokeSidesUniform(n);
    let defs = '', wrap = '';
    if (align === 'inside') {
        defs = `<clipPath id="${prefix}k">${svgShapeEl(n, f, '')}</clipPath>`;
        wrap = ` clip-path="url(#${prefix}k)"`;
    }
    else if (align === 'outside') {
        defs = `<mask id="${prefix}k" maskUnits="userSpaceOnUse" x="-100000" y="-100000" width="200000" height="200000"><rect x="-100000" y="-100000" width="200000" height="200000" fill="#fff"/>${svgShapeEl(n, f, 'fill="#000"')}</mask>`;
        wrap = ` mask="url(#${prefix}k)"`;
    }
    const op = f(n.strokeOpacity ?? 1);
    let el;
    if (uniform) {
        const w = sides ? sides.t : n.strokeWidth, dash = strokeDashArray(n);
        el = `<g${wrap}>${svgShapeEl(n, f, `fill="none" stroke="${e(n.stroke)}" stroke-opacity="${op}" stroke-width="${f(align === 'center' ? w : w * 2)}" stroke-linejoin="${n.strokeJoin || 'round'}" stroke-miterlimit="${f(strokeMiterLimit(n))}"${dash.length ? ` stroke-dasharray="${dash.map(f).join(' ')}"` : ''}`)}</g>`;
    }
    else {
        const { t, r, b, l } = sides, W = n.w, H = n.h, off = v => align === 'inside' ? 0 : align === 'center' ? v / 2 : v, fl = `fill="${e(n.stroke)}" fill-opacity="${op}"`;
        const y0 = t > 0 ? -off(t) : 0, y1 = b > 0 ? H + off(b) : H, rect = (x, y, w, h) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${fl}/>`;
        el = `<g${wrap}>${t > 0 ? rect(-off(l), -off(t), W + off(l) + off(r), t) : ''}${b > 0 ? rect(-off(l), H - b + off(b), W + off(l) + off(r), b) : ''}${l > 0 ? rect(-off(l), y0, l, y1 - y0) : ''}${r > 0 ? rect(W - r + off(r), y0, r, y1 - y0) : ''}</g>`;
    }
    return { defs, el };
}

