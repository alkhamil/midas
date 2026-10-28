// Output and numeric helpers (pure): one number format, one attribute escape and one clamp, shared by the SVG export, the DOM preview and the editor.

/** A number for SVG output, rounded to four decimals. */
export const svgNumber = n => Math.round(n * 10000) / 10000;

/** Escapes text for an SVG or HTML attribute or text node. */
export const escapeAttr = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * A colour with an opacity applied. A six digit hex takes the alpha as a byte; any other colour is mixed with transparent.
 * @param {string} color
 * @param {number | undefined} opacity
 */
export function colorWithAlpha(color, opacity) {
    if (opacity === undefined || opacity >= 1) return color;
    const o = Math.max(0, opacity);
    if (/^#[0-9a-f]{6}$/i.test(color)) return `${color}${Math.round(o * 255).toString(16).padStart(2, '0')}`;
    return `color-mix(in srgb, ${color} ${Math.round(o * 100)}%, transparent)`;
}

/** Clamps a number into [min, max]. */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
