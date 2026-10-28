// Fills (pure). A layer's paint is its `fills` list. The first visible entry is the top one, and an empty list is no paint. The canvas,
// the DOM preview, the SVG export and the editor all read paint from here; nothing else holds a colour for a layer.

import { colorWithAlpha } from './format.js';

/**
 * A solid fill.
 * @param {string} color
 * @param {number} [opacity]
 */
export const solidFill = (color, opacity = 1) => ({ type: 'solid', color, opacity, visible: true });

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

/**
 * One fill as a CSS background layer. A linear fill's angle is measured from the x axis on the canvas, and from the top in CSS: CSS is
 * the canvas angle plus 90 degrees. Null for a fill CSS cannot draw (an image); undefined for a fill that draws nothing.
 * @param {any} f
 * @returns {{ css: string, solid: boolean } | null | undefined}
 */
function cssFillLayer(f) {
    const o = f.opacity;
    if (f.type === 'solid') return f.color && f.color !== 'none' ? { css: colorWithAlpha(f.color, o), solid: true } : undefined;
    if (f.type === 'linear') return { css: `linear-gradient(${(f.angle ?? 90) + 90}deg, ${colorWithAlpha(f.color || '#d9d9d9', o)}, ${colorWithAlpha(f.color2 || '#ffffff', o)})`, solid: false };
    if (f.type === 'radial') return { css: `radial-gradient(circle, ${colorWithAlpha(f.color || '#d9d9d9', o)}, ${colorWithAlpha(f.color2 || '#ffffff', o)})`, solid: false };
    if (f.type === 'angular') return { css: `conic-gradient(from 0deg, ${colorWithAlpha(f.color || '#d9d9d9', o)}, ${colorWithAlpha(f.color2 || '#ffffff', o)})`, solid: false };
    return null;
}

/**
 * The CSS background of a fill list: every visible fill, the top one first, as one layer each. `background` is '' when nothing paints;
 * `unsupported` names the fill types CSS cannot draw.
 * @param {any[]} fills
 * @returns {{ background: string, unsupported: string[] }}
 */
export function cssBackgroundOf(fills) {
    const layers = [], unsupported = [];
    for (const f of fills.filter(x => x.visible !== false)) {
        const layer = cssFillLayer(f);
        if (layer === null) unsupported.push(f.type);
        else if (layer) layers.push(layer);
    }
    if (!layers.length) return { background: '', unsupported };
    if (layers.length === 1 && layers[0].solid) return { background: layers[0].css, unsupported };
    return { background: layers.map(l => (l.solid ? `linear-gradient(${l.css}, ${l.css})` : l.css)).join(', '), unsupported };
}
