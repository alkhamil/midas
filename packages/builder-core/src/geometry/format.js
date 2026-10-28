// Output helpers for geometry written as SVG (pure): one number format and one attribute escape, shared by the SVG export and the DOM preview.

/** A number for SVG output, rounded to four decimals. */
export const svgNumber = n => Math.round(n * 10000) / 10000;

/** Escapes text for an SVG or HTML attribute or text node. */
export const escapeAttr = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
