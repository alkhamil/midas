// The area a layer's stroke paints, from the Rust core: one function for every surface that needs the stroke as geometry (the canvas raster
// route, the Play overlay, the SVG export). The node's stroke fields are read here, once, and nowhere else.
import { strokeArea } from '../core/index.js';
import { RECT_LIKE, arcActive, pathCommands, strokeClosed, strokeDashArray, strokeMiterLimit, strokeSideWidths, strokeSidesUniform, strokeSvgAdvanced } from './shapes.js';

/**
 * The stroke geometry of a layer, as the core takes it.
 * @param {any} n
 * @returns {import('../core/index.js').StrokeGeometry}
 */
export function strokeGeometryOf(n) {
    const rl = RECT_LIKE.includes(n.type), closed = strokeClosed(n), s = strokeSideWidths(n);
    return {
        weight: n.strokeWidth || 0,
        align: closed ? n.strokeAlign || 'center' : 'center',
        join: n.strokeJoin || 'round',
        cap: n.strokeCap || 'round',
        miterLimit: strokeMiterLimit(n),
        dashes: strokeDashArray(n),
        sides: rl && !strokeSidesUniform(n) ? [s.t, s.r, s.b, s.l] : null,
        closed,
        evenOdd: arcActive(n) || n.fillRule === 'evenodd',
    };
}

/**
 * The area a layer's stroke paints: a path in the layer's own space and the rule that fills it. Inside, centre and outside, per-side
 * weights, dashes, joins and caps are all in the path, so whatever fills it (a colour, a gradient, a picture) fills the stroke.
 * @param {any} n
 * @returns {import('../core/index.js').StrokeArea}
 */
export function strokeAreaOf(n) {
    return strokeArea(pathCommands(n), strokeGeometryOf(n));
}

/** The layer fields the outline and the stroke geometry read (shapes.js `pathCommands` and `strokeGeometryOf`). */
const AREA_FIELDS = ['type', 'w', 'h', 'radius', 'radii', 'arcStart', 'arcSweep', 'arcRatio', 'points', 'contours', 'closed', 'pathW', 'pathH', 'fillRule',
    'strokeWidth', 'strokeAlign', 'strokeJoin', 'strokeCap', 'strokeStyle', 'strokeDash', 'strokeGap', 'strokeMiter', 'strokeSides', 'strokeT', 'strokeR', 'strokeB', 'strokeL'];

/**
 * What Play keeps on a stroke overlay to redraw its area when the box is laid out at another size than the design: the layer fields the outline and the
 * stroke read, and nothing else.
 * @param {any} n
 * @returns {Record<string, any>}
 */
export function strokeAreaSourceOf(n) {
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of AREA_FIELDS) if (n[k] !== undefined) out[k] = n[k];
    return out;
}

/**
 * The stroke area of a layer (see `strokeAreaSourceOf`) drawn at `w` by `h`. A radius or a width the box has outgrown is clamped against the new size by
 * the outline, as on the canvas. The size is rounded to a hundredth, and the core caches by outline and stroke, so a size seen before is a lookup.
 * @param {Record<string, any>} source
 * @param {number} w
 * @param {number} h
 * @returns {import('../core/index.js').StrokeArea}
 */
export function strokeAreaAtSize(source, w, h) {
    const hundredth = (/** @type {number} */ v) => Math.round(v * 100) / 100;
    return strokeAreaOf({ ...source, w: hundredth(w), h: hundredth(h) });
}

/**
 * The stroke of a shape that SVG attributes cannot draw (inside or outside a closed shape, per-side widths, a paint that is not a colour) as its area. A colour fills the
 * area path. A paint (`strokeLayer`, see paint-layer.js) is a group clipped by the area path, so only the stroke shows it. Empty for a stroke the attributes draw (see `svgStrokeAttrs`).
 * @param {any} n
 * @param {(v: number) => string | number} f
 * @param {(s: string) => string} e
 * @param {boolean} [resizable] marks the area path (`data-area`) so Play can redraw it when the box is laid out at another size
 * @returns {string}
 */
export function svgStrokeExtra(n, f, e, resizable = false) {
    if (!strokeSvgAdvanced(n))
        return '';
    const { d, rule } = strokeAreaOf(n), mark = resizable ? ' data-area' : '', layer = n.strokeLayer;
    if (!layer)
        return `<path${mark} d="${d}" fill-rule="${rule}" fill="${e(n.stroke)}" fill-opacity="${f(n.strokeOpacity ?? 1)}"/>`;
    const clip = `${layer.id}k`;
    return `<g opacity="${f(n.strokeOpacity ?? 1)}"><defs data-paint-defs>${layer.defs}</defs><clipPath id="${clip}"><path${mark} d="${d}" clip-rule="${rule}"/></clipPath><g clip-path="url(#${clip})" data-paint-content>${layer.content}</g></g>`;
}
