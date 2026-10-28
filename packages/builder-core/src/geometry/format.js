// Output and numeric helpers (pure): one number format, one attribute escape and one clamp, shared by the SVG export, the DOM preview and the editor.

/** A number for SVG output, rounded to four decimals. */
export const svgNumber = n => Math.round(n * 10000) / 10000;

/** Escapes text for an SVG or HTML attribute or text node. */
export const escapeAttr = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Clamps a number into [min, max]. */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
