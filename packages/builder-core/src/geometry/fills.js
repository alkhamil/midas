// Fills (pure). A layer's paint is its `fills` list. The first visible entry is the top one, and an empty list is no paint. The canvas,
// the DOM preview, the SVG export and the editor all read paint from here; nothing else holds a colour for a layer.

import { colorWithAlpha } from './format.js';

/**
 * A solid fill.
 * @param {string} color
 * @param {number} [opacity]
 */
const solidFill = (color, opacity = 1) => ({ type: 'solid', color, opacity, visible: true });

/**
 * The fills a layer paints, in the order stored: the first is the top.
 * @param {{ fills?: any[] }} n
 * @returns {any[]}
 */
export function getFills(n) {
    return Array.isArray(n.fills) ? n.fills : [];
}

/**
 * The top fill: the first visible entry, or undefined when every fill is hidden or there are none.
 * @param {any[]} fills
 * @returns {any}
 */
export const topFillOf = fills => fills.find(f => f.visible !== false);

/**
 * The colour a layer shows as one colour: its top visible fill's colour, or 'none'. Text colour and the one-colour swatches use it.
 * @param {{ fills?: any[] }} n
 * @returns {string}
 */
export function topColorOf(n) {
    const top = topFillOf(getFills(n));
    return top?.color && top.color !== 'none' ? top.color : 'none';
}

/**
 * The opacity of a layer's top visible fill, 1 when it has none.
 * @param {{ fills?: any[] }} n
 * @returns {number}
 */
export function topOpacityOf(n) {
    return topFillOf(getFills(n))?.opacity ?? 1;
}

/**
 * The fills with their top colour set. The top visible fill keeps its type and takes the colour; 'none' hides it. A list with no
 * visible fill gets a solid one on top for a colour, and is left as it is for 'none'.
 * @param {any[]} fills
 * @param {string} color
 * @returns {any[]}
 */
export function withTopColor(fills, color) {
    const top = topFillOf(fills);
    if (color === 'none')
        return top ? fills.map(f => (f === top ? { ...f, visible: false } : f)) : fills;
    if (!top)
        return [solidFill(color), ...fills];
    return fills.map(f => (f === top ? { ...f, color } : f));
}

/**
 * The fills of one solid colour: none for no colour or 'none'.
 * @param {string | undefined} color
 * @param {number} [opacity]
 * @returns {any[]}
 */
export const paintOf = (color, opacity = 1) => (!color || color === 'none' ? [] : [solidFill(color, opacity)]);

/** What the canvas paints for an image whose asset is not loaded (or not in the file). */
const IMAGE_PENDING = 'rgba(140,140,150,.18)';

/**
 * The paints a layer shows. An image layer shows its asset as a cover fill, the same as the canvas; any other layer shows its fills.
 * @param {{ type?: string, assetId?: string, fills?: any[] }} n
 * @returns {any[]}
 */
export function displayFills(n) {
    return n.type === 'image' ? [{ type: 'image', image: n.assetId, mode: 'fill' }] : getFills(n);
}

/**
 * How an image fill sits in its box, from the fill's own props (the canvas renderer reads the same ones): `fill` scales to cover with the overflow cropped, `fit` scales to
 * contain with the whole picture visible, `tile` repeats it at its natural size times `scale` (`iw` and `ih` are the picture's natural size, stored when the fill is set;
 * without them a scale other than 1 cannot be drawn in CSS: null).
 * @param {{ mode?: string, scale?: number, iw?: number, ih?: number }} f
 * @returns {{ size?: string, position?: string, repeat: string } | null}
 */
export function imageFillLayout(f) {
    if (f.mode === 'tile') {
        const scale = f.scale || 1;
        if (scale === 1) return { repeat: 'repeat' };
        return f.iw && f.ih ? { position: '0 0', size: `${f.iw * scale}px ${f.ih * scale}px`, repeat: 'repeat' } : null;
    }
    return { position: 'center', size: f.mode === 'fit' ? 'contain' : 'cover', repeat: 'no-repeat' };
}

/**
 * The CSS properties that draw an image fill on an element's own box: the picture, its size and position, its repeat. The box and its corner radii clip it. Null when the
 * asset is not in the file (the element keeps its flat colour, the fallback) or the fill cannot be drawn in CSS.
 * @param {any} f an image fill
 * @param {Record<string, string>} assets the document's asset sources, by id
 * @returns {{ backgroundImage: string, backgroundSize?: string, backgroundPosition?: string, backgroundRepeat: string } | null}
 */
export function imageFillCss(f, assets) {
    const src = assets[f.image];
    const layout = src ? imageFillLayout(f) : null;
    if (!src || !layout) return null;
    return { backgroundImage: `url("${src}")`, ...(layout.size ? { backgroundSize: layout.size } : {}), ...(layout.position ? { backgroundPosition: layout.position } : {}), backgroundRepeat: layout.repeat };
}

/**
 * The image fill an element draws as its own background: the top visible image fill of its fills, as CSS properties; null when it has none or cannot draw it.
 * @param {any[] | undefined} fills
 * @param {Record<string, string>} assets
 */
export function imageFillStyleOf(fills, assets) {
    const top = [...(fills ?? [])].reverse().find(f => f.type === 'image' && f.visible !== false);
    return top ? imageFillCss(top, assets) : null;
}

/** The fill types that are gradients. */
export const isGradientFill = f => f.type === 'linear' || f.type === 'radial' || f.type === 'angular' || f.type === 'diamond';

/**
 * The stops of a gradient fill, sorted: the stops it holds, else its two colours; the first and last stop follow `color` and `color2` (the canvas reads the same).
 * @param {{ stops?: { pos: number, color: string }[], color?: string, color2?: string }} f
 * @returns {{ pos: number, color: string }[]}
 */
export function gradientStops(f) {
    const stops = Array.isArray(f.stops) && f.stops.length >= 2 ? f.stops.map(s => ({ ...s })) : [{ pos: 0, color: f.color || '#d9d9d9' }, { pos: 1, color: f.color2 || '#ffffff' }];
    stops.sort((a, b) => a.pos - b.pos);
    if (f.color) stops[0].color = f.color;
    if (f.color2) stops[stops.length - 1].color = f.color2;
    return stops;
}

/** A plain linear gradient: two stops along the angle, no handles (the canvas draws it with the box's diagonal, as CSS does). */
const plainLinear = (f, stops) => f.type === 'linear' && stops.length <= 2 && !f.handles;

/**
 * A gradient fill as one CSS background layer, from the fill's own props (the canvas paints the same ones): a plain linear gradient is a CSS linear gradient; an angular one a CSS
 * conic gradient (centre and start angle from its handles); a linear one with handles or many stops, a radial and a diamond one an SVG gradient in the layer's own unit space, which
 * stretches with the box exactly as the canvas's does (a diamond reaches 1.2 of its radius, as on the canvas). `opacity` is the fill's.
 * @param {any} f a gradient fill
 * @returns {{ layer: string } | null}
 */
export function gradientCss(f) {
    const stops = gradientStops(f), opacity = f.opacity ?? 1;
    const css = stops.map(s => `${colorWithAlpha(s.color, opacity)} ${Math.round(s.pos * 10000) / 100}%`).join(', ');
    if (plainLinear(f, stops)) return { layer: `linear-gradient(${(f.angle ?? 90) + 90}deg, ${stops.map(s => colorWithAlpha(s.color, opacity)).join(', ')})` };
    const H = f.handles, a = H?.a, b = H?.b, c = H?.c;
    if (f.type === 'angular') {
        const centre = a ?? { x: 0.5, y: 0.5 }, axis = b ?? { x: 1, y: 0.5 };
        const from = Math.round((Math.atan2(axis.y - centre.y, axis.x - centre.x) * 180 / Math.PI + 90) * 100) / 100;
        return { layer: `conic-gradient(from ${from}deg at ${Math.round(centre.x * 10000) / 100}% ${Math.round(centre.y * 10000) / 100}%, ${css})` };
    }
    const svgStops = stops.map(s => `<stop offset="${s.pos}" stop-color="${s.color}"/>`).join('');
    let gradient;
    if (f.type === 'linear') {
        const from = a ?? { x: 0, y: 0.5 }, to = b ?? { x: 1, y: 0.5 };
        gradient = `<linearGradient id="g" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}">${svgStops}</linearGradient>`;
    }
    else {
        const centre = a ?? { x: 0.5, y: 0.5 }, bx = b ?? { x: 1, y: 0.5 }, by = c ?? { x: 0.5, y: 1 };
        // The unit circle is mapped onto the gradient's ellipse by the handles (its axes can be rotated and skewed), as the canvas does.
        gradient = `<radialGradient id="g" cx="0" cy="0" r="${f.type === 'diamond' ? 1.2 : 1}" gradientTransform="matrix(${bx.x - centre.x} ${bx.y - centre.y} ${by.x - centre.x} ${by.y - centre.y} ${centre.x} ${centre.y})">${svgStops}</radialGradient>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs>${gradient}</defs><rect x="-1000" y="-1000" width="2001" height="2001" fill="url(#g)"${opacity < 1 ? ` opacity="${opacity}"` : ''}/></svg>`;
    return { layer: `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / 100% 100% no-repeat` };
}

/**
 * One fill as a CSS background layer. A linear fill's angle is measured from the x axis on the canvas, and from the top in CSS: CSS is
 * the canvas angle plus 90 degrees. An image is its asset, covering the box, contained for fit, or repeated for tile. Null for a fill
 * CSS cannot draw (a tiled image at a scale: the natural size is not known here); undefined for a fill that draws nothing.
 * @param {any} f
 * @param {Record<string, string>} assets
 * @returns {{ css: string, solid: boolean } | null | undefined}
 */
function cssFillLayer(f, assets) {
    const o = f.opacity;
    if (f.type === 'image') {
        if (!assets[f.image]) return { css: IMAGE_PENDING, solid: true, missing: true };
        const css = imageFillCss(f, assets);
        if (!css) return null;
        const placed = css.backgroundSize ? ` ${css.backgroundPosition} / ${css.backgroundSize}` : '';
        return { css: `${css.backgroundImage}${placed} ${css.backgroundRepeat}`, solid: false };
    }
    if (f.type === 'solid') return f.color && f.color !== 'none' ? { css: colorWithAlpha(f.color, o), solid: true } : undefined;
    if (isGradientFill(f)) {
        const css = gradientCss(f);
        return css ? { css: css.layer, solid: false } : null;
    }
    return null;
}

/**
 * The CSS background of a fill list: every visible fill, the top one first, as one layer each. `background` is '' when nothing paints;
 * `unsupported` names the fill types CSS cannot draw.
 * @param {any[]} fills
 * @param {Record<string, string>} [assets] the document's asset sources, by id
 * @returns {{ background: string, unsupported: string[] }}
 */
export function cssBackgroundOf(fills, assets = {}) {
    const layers = [], unsupported = [];
    for (const f of fills.filter(x => x.visible !== false)) {
        const layer = cssFillLayer(f, assets);
        if (layer === null) unsupported.push(f.type);
        else if (layer) {
            layers.push(layer);
            // The canvas draws a placeholder for a missing asset; the DOM draws it too, and reports it.
            if (layer.missing) unsupported.push('image with no asset');
        }
    }
    if (!layers.length) return { background: '', unsupported };
    if (layers.length === 1 && layers[0].solid) return { background: layers[0].css, unsupported };
    return { background: layers.map(l => (l.solid ? `linear-gradient(${l.css}, ${l.css})` : l.css)).join(', '), unsupported };
}
