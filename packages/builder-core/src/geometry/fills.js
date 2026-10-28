// Fills (pure). A layer's paint is its `fills` list. The first visible entry is the top one, and an empty list is no paint. The canvas,
// the DOM preview, the SVG export and the editor all read paint from here; nothing else holds a colour for a layer.

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
 * The colour a layer shows as one colour: its top visible fill's colour, or 'none'. Text colour and the one-colour swatches use it.
 * @param {{ fills?: any[] }} n
 * @returns {string}
 */
export function topColorOf(n) {
    const top = getFills(n).find(f => f.visible !== false);
    return top?.color && top.color !== 'none' ? top.color : 'none';
}

/**
 * The opacity of a layer's top visible fill, 1 when it has none.
 * @param {{ fills?: any[] }} n
 * @returns {number}
 */
export function topOpacityOf(n) {
    const top = getFills(n).find(f => f.visible !== false);
    return top?.opacity ?? 1;
}

/**
 * The fills of one solid colour: none for no colour or 'none'.
 * @param {string | undefined} color
 * @param {number} [opacity]
 * @returns {any[]}
 */
export const paintOf = (color, opacity = 1) => (!color || color === 'none' ? [] : [solidFill(color, opacity)]);
