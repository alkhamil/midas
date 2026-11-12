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
export const IMAGE_PENDING = 'rgba(140,140,150,.18)';
/** What the canvas paints for a video with no source. */
export const VIDEO_PENDING = 'rgba(140,140,150,.18)';
/** The image modes the picker offers, in order. */
export const IMAGE_MODES = ['fill', 'fit', 'crop', 'tile'];
/** The gradient types the picker offers, in order. */
export const GRADIENT_TYPES = ['linear', 'radial', 'angular', 'diamond'];
/** The pattern tile types the picker offers. */
/**
 * WCAG 2.x contrast ratio of two colours (1 to 21), from their relative luminance. Colours are #rgb or #rrggbb; the alpha is ignored.
 * @param {string} a
 * @param {string} b
 */
export function contrastRatio(a, b) {
    const lum = c => {
        const [r, g, bl] = hexToRgb(hex6Of(String(c))).map(v => { const s = clampByte(v) / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The WCAG levels a contrast ratio reaches: AA needs 4.5 (3 for large text), AAA needs 7 (4.5 for large text).
 * @param {number} ratio
 */
export function wcagLevels(ratio) {
    return { aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, aaaLarge: ratio >= 4.5 };
}

/** A fill's blend mode: the CSS mix-blend-mode names, which the canvas composite operations share (Normal is source-over there). */
export const BLEND_MODES = ['normal', 'darken', 'multiply', 'color-burn', 'lighten', 'screen', 'color-dodge', 'overlay', 'soft-light', 'hard-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
export const PATTERN_TILE_TYPES = ['RECTANGULAR', 'HORIZONTAL_HEXAGONAL', 'VERTICAL_HEXAGONAL'];
/** The video modes the picker offers, in order. */
export const VIDEO_MODES = ['fill', 'fit', 'crop', 'tile'];

/**
 * The paints a layer shows. An image layer shows its asset as a cover fill, the same as the canvas; any other layer shows its fills.
 * @param {{ type?: string, assetId?: string, fills?: any[] }} n
 * @returns {any[]}
 */
export function displayFills(n) {
    return n.type === 'image' ? [{ type: 'image', image: n.assetId, mode: 'fill' }] : getFills(n);
}

// ---------- Colour formats (pure, shared by the picker preview and every surface) ----------

const clampByte = v => Math.max(0, Math.min(255, Math.round(v)));
const clamp01 = v => Math.max(0, Math.min(1, v));

/** A hex colour as [r, g, b]. Accepts #rgb and #rrggbb; anything else is mid grey. */
export function hexToRgb(hex) {
    const h = String(hex || '').trim();
    const m3 = /^#([\da-f]{3})$/i.exec(h);
    if (m3) return [0, 1, 2].map(i => parseInt(m3[1][i] + m3[1][i], 16));
    const m6 = /^#([\da-f]{6})/i.exec(h);
    if (m6) return [0, 2, 4].map(i => parseInt(m6[1].slice(i, i + 2), 16));
    return [217, 217, 217];
}

/** [r, g, b] as a lowercase #rrggbb. */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(clampByte).map(x => x.toString(16).padStart(2, '0')).join('');
}

/** [r, g, b] (0-255) as { h: 0-360, s: 0-1, v: 0-1 }. */
export function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h, s: max ? d / max : 0, v: max };
}

/** { h, s, v } as [r, g, b] (0-255). */
export function hsvToRgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** [r, g, b] (0-255) as { h: 0-360, s: 0-1, l: 0-1 }. */
export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2, d = max - min;
    let h = 0, s = 0;
    if (d) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        else if (max === g) h = ((b - r) / d + 2) * 60;
        else h = ((r - g) / d + 4) * 60;
    }
    return { h, s, l };
}

/** { h, s, l } as [r, g, b] (0-255). */
export function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const hex6Of = c => /^#[\da-f]{6}/i.test(c) ? c.slice(0, 7).toLowerCase() : /^#[\da-f]{3}$/i.test(c) ? '#' + c.slice(1).split('').map(x => x + x).join('').toLowerCase() : '#d9d9d9';

/**
 * A css colour text as { r, g, b } (0-255 each): #rgb, #rrggbb and #rrggbbaa (alpha ignored: opacity lives on the fill),
 * rgb() and rgba() in comma or space notation (an alpha slash ignored). Null when it does not parse.
 * @param {string} text
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function parseCssColor(text) {
    const t = String(text || '').trim();
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(t);
    if (hex) {
        const [r, g, b] = hexToRgb('#' + hex[1]);
        return { r, g, b };
    }
    const fn = /^rgba?\(\s*([^)]+)\)$/i.exec(t);
    if (!fn) return null;
    const parts = fn[1].split(/[\s,\/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const nums = parts.slice(0, 3).map(v => (v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v)));
    if (nums.some(v => !Number.isFinite(v))) return null;
    return { r: clampByte(nums[0]), g: clampByte(nums[1]), b: clampByte(nums[2]) };
}

/**
 * A colour in one picker format, without changing the colour: Hex, RGB, CSS, HSL or HSB. Alpha stays separate (the fill opacity).
 * Pure: the same input gives the same fields on every surface.
 * @param {string} color any #rgb / #rrggbb / #rrggbbaa the file holds
 * @param {'hex' | 'rgb' | 'css' | 'hsl' | 'hsb'} format
 * @returns {{ hex: string, rgb: { r: number, g: number, b: number }, hsl: { h: number, s: number, l: number }, hsb: { h: number, s: number, v: number } }}
 */
export function colorFormats(color) {
    const hex = hex6Of(String(color || '#d9d9d9'));
    const [r, g, b] = hexToRgb(hex);
    return { hex, rgb: { r: clampByte(r), g: clampByte(g), b: clampByte(b) }, hsl: rgbToHsl(r, g, b), hsb: rgbToHsv(r, g, b) };
}

/**
 * A colour from picker fields in one format, without changing the colour. Returns a lowercase #rrggbb.
 * @param {'hex' | 'rgb' | 'css' | 'hsl' | 'hsb'} format
 * @param {any} fields the picker's inputs for that format
 */
export function colorFromFormat(format, fields) {
    if (format === 'css' && typeof fields?.text === 'string') {
        const parsed = parseCssColor(fields.text);
        return parsed ? rgbToHex(parsed.r, parsed.g, parsed.b) : null;
    }
    if (format === 'rgb' || format === 'css') {
        const { r = 0, g = 0, b = 0 } = fields || {};
        return rgbToHex(+r || 0, +g || 0, +b || 0);
    }
    if (format === 'hsl') {
        const { h = 0, s = 0, l = 0 } = fields || {};
        const [r, g, b] = hslToRgb(+h || 0, clamp01(+s ?? 0), clamp01(+l ?? 0));
        return rgbToHex(r, g, b);
    }
    if (format === 'hsb') {
        const { h = 0, s = 0, v = 0, b: bb } = fields || {};
        const [r, g, b] = hsvToRgb(+h || 0, clamp01(+s ?? 0), clamp01(+(v ?? bb ?? 0)));
        return rgbToHex(r, g, b);
    }
    return hex6Of('#' + String(fields?.hex ?? fields ?? 'd9d9d9').replace(/^#/, ''));
}

/**
 * The distinct solid colours the page uses, in first-seen order: the document colours list (On this page).
 * Reads canvas fills only, never the variables.
 * @param {{ fills?: any[] }[]} nodes
 * @returns {string[]}
 */
export function documentColors(nodes) {
    const out = [], seen = new Set();
    for (const n of nodes || []) {
        for (const f of getFills(n)) {
            const colours = f.type === 'solid' ? [f.color] : isGradientFill(f) ? gradientStops(f).map(s => s.color) : [];
            for (const c of colours) {
                const hex = typeof c === 'string' ? hex6Of(c.slice(0, 7)) : null;
                if (hex && !seen.has(hex)) { seen.add(hex); out.push(hex); }
            }
        }
    }
    return out;
}

// ---------- Gradients ----------

/** The fill types that are gradients. */
export const isGradientFill = f => f.type === 'linear' || f.type === 'radial' || f.type === 'angular' || f.type === 'diamond';
/** A pattern fill. */
export const isPatternFill = f => f?.type === 'pattern';
/** An image fill. */
export const isImageFill = f => f?.type === 'image';
/** A video fill. */
export const isVideoFill = f => f?.type === 'video';

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

/**
 * The colour a gradient has at `pos` (0 to 1): its stops blended linearly between the two around it, as #rrggbb.
 * @param {any} f
 * @param {number} pos
 */
export function gradientColorAt(f, pos) {
    const stops = gradientStops(f);
    const next = stops.findIndex(s => s.pos >= pos);
    if (next <= 0) return hex6Of((next < 0 ? stops[stops.length - 1] : stops[0]).color);
    const a = stops[next - 1], b = stops[next], t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
    const [r1, g1, b1] = hexToRgb(hex6Of(a.color)), [r2, g2, b2] = hexToRgb(hex6Of(b.color));
    return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * A gradient fill with one stop added at `pos` (the colour between its neighbours, else white). Pure: the same fill in gives the same fill out.
 * @param {any} f
 * @param {number} [pos]
 */
export function gradientAddStop(f, pos = 0.5) {
    const stops = gradientStops(f);
    const p = Math.max(0, Math.min(1, +pos || 0));
    const next = [...stops, { pos: p, color: '#ffffff' }].sort((a, b) => a.pos - b.pos);
    return { ...f, stops: next };
}

/**
 * A gradient fill with its stop at `index` (in sorted order) removed. Two stops is the floor: fewer stays as is.
 * @param {any} f
 * @param {number} index
 */
export function gradientRemoveStop(f, index) {
    const stops = gradientStops(f);
    if (stops.length <= 2) return { ...f, stops };
    return { ...f, stops: stops.filter((_, i) => i !== index) };
}

/**
 * A gradient fill with its stop at `index` moved to `pos` and/or recoloured. Pure.
 * @param {any} f
 * @param {number} index sorted stop index
 * @param {{ pos?: number, color?: string }} patch
 */
export function gradientSetStop(f, index, patch) {
    const stops = gradientStops(f).map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, pos: patch.pos ?? s.pos, color: patch.color ?? s.color };
        if (patch.alpha !== undefined) {
            if (patch.alpha >= 1) delete next.alpha;
            else next.alpha = Math.max(0, Math.min(1, +patch.alpha || 0));
        }
        return next;
    });
    const out = { ...f, stops };
    if (index === 0 && patch.color) out.color = patch.color;
    if (index === stops.length - 1 && patch.color) out.color2 = patch.color;
    return out;
}

/**
 * A gradient fill reversed: its stops run the other way (positions mirrored, colours in reverse), so Reverse in the picker
 * swaps the two ends and Swap mirrors every stop. The canvas, Play and the export read the same stops.
 * @param {any} f
 */
export function gradientReverse(f) {
    const stops = gradientStops(f).map(s => ({ pos: 1 - s.pos, color: s.color, ...(s.alpha !== undefined ? { alpha: s.alpha } : {}) })).sort((a, b) => a.pos - b.pos);
    return { ...f, stops, color: stops[0].color, color2: stops[stops.length - 1].color };
}

/**
 * The handle points of a gradient in unit space (the canvas, Play and the export read the same ones): a linear one runs a to b
 * (the box diagonal when the fill holds no handles), a radial, angular or diamond one centres on a with b ending its x axis
 * and c its y axis. The canvas handles drag these points; the picker angle only seeds a plain linear one.
 * @param {any} f a gradient fill
 * @param {{ w: number, h: number }} [box] the layer's size: a plain linear gradient (no handles) puts its handles on its angle line across it
 * @returns {{ a: { x: number, y: number }, b: { x: number, y: number }, c?: { x: number, y: number } }}
 */
export function gradientHandlePoints(f, box) {
    const H = f.handles || {};
    if (f.type === 'linear' && !f.handles && box && box.w > 0 && box.h > 0) {
        // A plain linear gradient runs along its angle across the box (the canvas and CSS length), so its handles sit on that line.
        const r = (f.angle ?? 90) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), len = Math.abs(box.w * c) + Math.abs(box.h * s);
        const dx = c * len / 2 / box.w, dy = s * len / 2 / box.h;
        return { a: { x: 0.5 - dx, y: 0.5 - dy }, b: { x: 0.5 + dx, y: 0.5 + dy } };
    }
    if (f.type === 'linear') return { a: H.a ?? { x: 0, y: 0.5 }, b: H.b ?? { x: 1, y: 0.5 } };
    return { a: H.a ?? { x: 0.5, y: 0.5 }, b: H.b ?? { x: 1, y: 0.5 }, c: H.c ?? { x: 0.5, y: 1 } };
}

/**
 * A gradient fill with one handle point moved (a canvas drag writes the same object Play and the export read). Pure: the same
 * fill and point in give the same fill out. Coordinates clamp to [-1, 2] so a handle can overshoot the box but never run away.
 * A point the type has no use for (c on a linear gradient) leaves the fill as it is.
 * @param {any} f a gradient fill
 * @param {'a' | 'b' | 'c'} name
 * @param {{ x: number, y: number }} pt unit-space point
 */
export function gradientHandleMove(f, name, pt) {
    const ok = f.type === 'linear' ? name === 'a' || name === 'b' : name === 'a' || name === 'b' || name === 'c';
    if (!ok) return f;
    const cl = v => Math.max(-1, Math.min(2, Math.round(v * 1000) / 1000));
    return { ...f, handles: { ...(f.handles || {}), [name]: { x: cl(pt.x), y: cl(pt.y) } } };
}

/**
 * The crop zoom a corner drag gives: the start scale times the start distance over the current one (dragging out shows more,
 * so the zoom falls). Clamped to the picker's 0.2..8 range. Pure: shared by the canvas gesture and its tests.
 */
export const cropZoomFor = (startScale, startDist, curDist) => Math.max(0.2, Math.min(8, (startScale * startDist) / Math.max(curDist, 1e-6)));

/**
 * The rotation a crop rotate drag gives: the start rotation plus the pointer's travel around the centre, normalised to
 * -180..180. Snaps to 15 degrees while shift is held, like the layer rotate. Pure and shared.
 */
export function cropRotateFor(startRot, startAngle, curAngle, snap) {
    let r = startRot + (curAngle - startAngle);
    if (snap) r = Math.round(r / 15) * 15;
    return Math.round((((r + 540) % 360) - 180) * 10) / 10;
}

/** A plain linear gradient: two stops along the angle, no handles (the canvas draws it with the box's diagonal, as CSS does). */
const plainLinear = (f, stops) => f.type === 'linear' && stops.length <= 2 && !f.handles && !stops.some(x => (x.alpha ?? 1) < 1);

/**
 * A gradient fill as one CSS background layer, from the fill's own props (the canvas paints the same ones): a plain linear gradient is a CSS linear gradient; an angular one a CSS
 * conic gradient (centre and start angle from its handles); a linear one with handles or many stops, a radial and a diamond one an SVG gradient in the layer's own unit space, which
 * stretches with the box exactly as the canvas's does (a diamond reaches 1.2 of its radius, as on the canvas). `opacity` is the fill's.
 * @param {any} f a gradient fill
 * @returns {{ layer: string } | null}
 */
export function gradientCss(f) {
    const stops = gradientStops(f), opacity = f.opacity ?? 1;
    const eff = sub => opacity * (sub.alpha ?? 1);
    const css = stops.map(s => `${colorWithAlpha(s.color, eff(s))} ${Math.round(s.pos * 10000) / 100}%`).join(', ');
    if (plainLinear(f, stops)) return { layer: `linear-gradient(${(f.angle ?? 90) + 90}deg, ${stops.map(s => colorWithAlpha(s.color, eff(s))).join(', ')})` };
    const H = f.handles, a = H?.a, b = H?.b, c = H?.c;
    if (f.type === 'angular') {
        const centre = a ?? { x: 0.5, y: 0.5 }, axis = b ?? { x: 1, y: 0.5 };
        const from = Math.round((Math.atan2(axis.y - centre.y, axis.x - centre.x) * 180 / Math.PI + 90) * 100) / 100;
        return { layer: `conic-gradient(from ${from}deg at ${Math.round(centre.x * 10000) / 100}% ${Math.round(centre.y * 10000) / 100}%, ${css})` };
    }
    const svgStops = stops.map(s => `<stop offset="${s.pos}" stop-color="${s.color}"${(s.alpha ?? 1) < 1 ? ` stop-opacity="${s.alpha}"` : ''}/>`).join('');
    let gradient;
    if (f.type === 'linear') {
        const from = a ?? { x: 0, y: 0.5 }, to = b ?? { x: 1, y: 0.5 };
        gradient = `<linearGradient id="g" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}">${svgStops}</linearGradient>`;
    }
    else {
        const centre = a ?? { x: 0.5, y: 0.5 }, bx = b ?? { x: 1, y: 0.5 }, by = c ?? { x: 0.5, y: 1 };
        gradient = `<radialGradient id="g" cx="0" cy="0" r="${f.type === 'diamond' ? 1.2 : 1}" gradientTransform="matrix(${bx.x - centre.x} ${bx.y - centre.y} ${by.x - centre.x} ${by.y - centre.y} ${centre.x} ${centre.y})">${svgStops}</radialGradient>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none"><defs>${gradient}</defs><rect x="-1000" y="-1000" width="2001" height="2001" fill="url(#g)"${opacity < 1 ? ` opacity="${opacity}"` : ''}/></svg>`;
    return { layer: `url("data:image/svg+xml,${encodeURIComponent(svg)}") 0 0 / 100% 100% no-repeat` };
}

// ---------- Images: modes, crop, rotation and adjustments (one pure function per concern) ----------

/**
 * How an image fill sits in its box, from the fill's own props (the canvas renderer reads the same ones): `fill` scales to cover with the overflow cropped, `fit` scales to
 * contain with the whole picture visible, `tile` repeats it at its natural size times `scale` (`iw` and `ih` are the picture's natural size, stored when the fill is set;
 * without them a scale other than 1 cannot be drawn in CSS: null). `crop` covers the box from the fill's own crop window (offset and zoom); rotation is separate (see imageTransformOf).
 * @param {{ mode?: string, scale?: number, iw?: number, ih?: number, crop?: { x?: number, y?: number, scale?: number } }} f
 * @returns {{ size?: string, position?: string, repeat: string } | null}
 */
export function imageFillLayout(f) {
    if (f.mode === 'tile') {
        const scale = f.scale || 1;
        if (scale === 1) return { repeat: 'repeat' };
        return f.iw && f.ih ? { position: '0 0', size: `${f.iw * scale}px ${f.ih * scale}px`, repeat: 'repeat' } : null;
    }
    if (f.mode === 'crop') {
        const c = f.crop || {}, scale = c.scale || 1;
        const x = Math.max(0, Math.min(1, c.x ?? 0.5)) * 100, y = Math.max(0, Math.min(1, c.y ?? 0.5)) * 100;
        if (scale === 1) return { position: `${Math.round(x * 100) / 100}% ${Math.round(y * 100) / 100}%`, size: 'cover', repeat: 'no-repeat' };
        return { position: `${Math.round(x * 100) / 100}% ${Math.round(y * 100) / 100}%`, size: `${Math.round(scale * 10000) / 100}%`, repeat: 'no-repeat' };
    }
    return { position: 'center', size: f.mode === 'fit' ? 'contain' : 'cover', repeat: 'no-repeat' };
}

/**
 * The rotation an image, crop or video fill turns by, in degrees. One pure function: the canvas (ctx transform), Play (CSS rotate on the layer's own element for tile/fill, or the SVG layer for crop) and the export read it.
 * @param {{ rotation?: number, crop?: { rotation?: number } }} f
 * @returns {number} 0 when it does not turn
 */
/**
 * A crop window as CSS background position and size strings, from the normalized point and zoom the canvas reads: the
 * anchor as percentages (the export base draws the same strings), the zoom as a percentage of the box. The per-instance
 * export carries the same values in custom properties, so one instance's crop never leaks into another's.
 * @param {{ x?: number, y?: number, zoom?: number }} [crop]
 */
export function cropCssVars(crop) {
    const c = crop || {}, scale = c.zoom || 1, x = Math.max(0, Math.min(1, c.x ?? 0.5)) * 100, y = Math.max(0, Math.min(1, c.y ?? 0.5)) * 100;
    return { position: `${Math.round(x * 100) / 100}% ${Math.round(y * 100) / 100}%`, size: scale === 1 ? 'cover' : `${Math.round(scale * 10000) / 100}%` };
}
export function imageRotationOf(f) {
    return +((f.rotation ?? f.crop?.rotation) || 0) || 0;
}

/**
 * The CSS transform an image fill with a rotation draws with on its own element. Empty when it does not turn.
 * @param {any} f
 */
export function imageTransformOf(f) {
    const r = imageRotationOf(f);
    return r ? `rotate(${r}deg)` : '';
}

/**
 * The adjustments of an image fill as one CSS filter string, from the fill's own `adjust` props (the canvas sets the same string as ctx.filter, Play and the export as filter).
 * Exposure (-1..1) is brightness, Contrast and Saturation map to their CSS names, Temperature and Tint to a small sepia and hue shift (an approximation: CSS has no white-balance primitive), Highlights and Shadows to brightness lifts. Empty when the fill holds no adjustments.
 * @param {{ adjust?: { exposure?: number, contrast?: number, saturation?: number, temperature?: number, tint?: number, highlights?: number, shadows?: number } }} f
 * @returns {string}
 */
export function imageAdjustFilter(f) {
    const a = f.adjust || {};
    const parts = [];
    if (a.exposure) parts.push(`brightness(${Math.round((1 + clamp01(Math.abs(a.exposure)) * Math.sign(a.exposure)) * 1000) / 1000})`);
    if (a.contrast) parts.push(`contrast(${Math.round((1 + +a.contrast) * 1000) / 1000})`);
    if (a.saturation) parts.push(`saturate(${Math.round((1 + +a.saturation) * 1000) / 1000})`);
    if (a.temperature) parts.push(`sepia(${Math.round(Math.min(0.35, Math.abs(+a.temperature) * 0.35) * 1000) / 1000}) hue-rotate(${Math.round(+a.temperature * 15 * 100) / 100}deg)`);
    else if (a.tint) parts.push(`hue-rotate(${Math.round(+a.tint * 20 * 100) / 100}deg)`);
    if (a.highlights) parts.push(`brightness(${Math.round((1 + +a.highlights * 0.3) * 1000) / 1000})`);
    if (a.shadows) parts.push(`brightness(${Math.round((1 + +a.shadows * 0.2) * 1000) / 1000})`);
    return parts.join(' ');
}

/**
 * An image fill with crop, rotation or adjustments as one SVG background layer: the picture drawn with its crop window, rotation and filter inside the layer's own unit space, so canvas, Play and the export agree pixel for pixel where CSS background properties cannot express the transform.
 * Null when a plain background layer draws it (fill, fit, or tile with no rotation or adjustments).
 * @param {any} f an image fill
 * @param {Record<string, string>} assets
 */
/**
 * A crop, rotation or adjustment image fill as an SVG data URL in the layer's own unit space, so Play and the export draw the
 * same transform the canvas paints (cover from the crop window, rotation about the centre, the shared adjustment filter).
 * Null for a plain background layer (fill, fit, or tile with no rotation or adjustments) and when the asset is missing.
 * @param {any} f an image fill
 * @param {Record<string, string>} assets
 * @returns {string | null} the data URL
 */
export function imageSvgUrl(f, assets) {
    const src = assets[f.image];
    if (!src) return null;
    const needs = f.mode === 'crop' || imageRotationOf(f) || imageAdjustFilter(f);
    if (!needs) return null;
    const c = f.crop || {}, scale = c.scale || 1, x = c.x ?? 0.5, y = c.y ?? 0.5, r = imageRotationOf(f);
    const filter = imageAdjustFilter(f);
    const img = `<image href="${src.replace(/"/g, '%22')}" x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"${filter ? ` filter="filter"` : ''}/>`;
    const defs = filter ? `<defs><filter id="filter">${filterToSvg(filter)}</filter></defs>` : '<defs></defs>';
    const inner = r ? `<g transform="rotate(${r} 0.5 0.5)">${img}</g>` : img;
    const scaled = scale !== 1 ? `<g transform="translate(${0.5 - x * scale} ${0.5 - y * scale}) scale(${scale})">${inner}</g>` : inner;
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">${defs}${scaled}</svg>`)}`;
}

/**
 * The longhands an SVG image layer draws with: the picture with its crop window, rotation and filter baked in, at the
 * layer's own size and position. The same shape as its pattern sibling, so Play draws them from the same fields.
 */
export function imageSvgLayer(f, assets) {
    const url = imageSvgUrl(f, assets);
    if (!url) return null;
    return { layer: `url("${url}") 0 0 / 100% 100% no-repeat`, image: `url("${url}")`, size: '100% 100%', position: '0 0', repeat: 'no-repeat' };
}

/** A CSS filter string as SVG filter primitives (brightness, contrast, saturate, sepia, hue-rotate in order). Approximation, shared by every surface. */
function filterToSvg(filter) {
    const out = [];
    for (const m of filter.matchAll(/(brightness|contrast|saturate|sepia|hue-rotate)\(([^)]+)\)/g)) {
        const [, name, raw] = m, v = parseFloat(raw);
        if (name === 'brightness') out.push(`<feComponentTransfer><feFuncR type="linear" slope="${v}"/><feFuncG type="linear" slope="${v}"/><feFuncB type="linear" slope="${v}"/></feComponentTransfer>`);
        else if (name === 'contrast') out.push(`<feComponentTransfer><feFuncR type="linear" slope="${v}" intercept="${(1 - v) / 2}"/><feFuncG type="linear" slope="${v}" intercept="${(1 - v) / 2}"/><feFuncB type="linear" slope="${v}" intercept="${(1 - v) / 2}"/></feComponentTransfer>`);
        else if (name === 'saturate') out.push(`<feColorMatrix type="saturate" values="${v}"/>`);
        else if (name === 'sepia') out.push(`<feColorMatrix type="matrix" values="0.393 0.769 0.189 0 0 0.349 0.686 0.168 0 0 0.272 0.534 0.131 0 0 0 0 0 1 0"/>`);
        else if (name === 'hue-rotate') out.push(`<feColorMatrix type="hueRotate" values="${v}"/>`);
    }
    return out.join('') || '<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"/>';
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

// ---------- Patterns: a live-linked source layer resolved at render time ----------

/**
 * Whether a pattern fill resolves: it names a source layer id that exists at render time. The fill stores the id only, never a snapshot, so editing the source updates every use.
 * @param {any} f
 * @param {(id: string) => any} [lookup] nodes by id
 */
export function patternSourceOf(f, lookup) {
    if (!isPatternFill(f) || !f.source) return null;
    if (typeof lookup !== 'function') return { id: f.source };
    return lookup(f.source) || null;
}

/**
 * How a pattern fill tiles its box, from the fill's own props (the canvas, Play and the export read the same ones): rectangular repeats on the grid, offset shifts every other row by half a tile; scale sizes the tile, spacingX/Y gaps it, and the 9-point alignment pins it.
 * @param {{ tileType?: string, scale?: number, spacingX?: number, spacingY?: number, align?: string }} f
 * @returns {{ repeat: string, size?: string, position?: string }}
 */
export function patternLayout(f) {
    const scale = f.scale || 1;
    const align = {
        'top-left': '0% 0%', top: '50% 0%', 'top-right': '100% 0%',
        left: '0% 50%', center: '50% 50%', right: '100% 50%',
        'bottom-left': '0% 100%', bottom: '50% 100%', 'bottom-right': '100% 100%',
    }[f.align] || '0 0';
    return { repeat: 'repeat', ...(scale !== 1 ? { size: `${Math.round(scale * 10000) / 100}%` } : {}), position: align };
}

/**
 * The tile a pattern fill repeats, in device pixels: the recorded natural size times the scale, stepped by the spacing.
 * Null until the natural size is recorded (the studio measures it from the asset whenever the source changes).
 * @param {any} f a pattern fill
 * @returns {{ tileW: number, tileH: number, stepX: number, stepY: number } | null}
 */
export function patternTileOf(f) {
    if (!isPatternFill(f) || !(f.iw && f.ih)) return null;
    const s = f.scale || 1, tileW = f.iw * s, tileH = f.ih * s;
    return { tileW, tileH, ...patternStepOf(tileW, tileH, f) };
}

/**
 * The step between tiles: the tile size grown by the X and Y spacing, which are percentages of the tile (Figma's X spacing and Y spacing).
 * @param {number} tileW
 * @param {number} tileH
 * @param {{ spacingX?: number, spacingY?: number }} f
 */
export function patternStepOf(tileW, tileH, f) {
    const round = v => Math.round(v * 100) / 100;
    return { stepX: round(tileW * (1 + (f.spacingX || 0) / 100)), stepY: round(tileH * (1 + (f.spacingY || 0) / 100)) };
}

/**
 * The repeating cell of a tile type: RECTANGULAR is one tile, HORIZONTAL_HEXAGONAL shifts every other row by half a step, VERTICAL_HEXAGONAL shifts
 * every other column by half a step. The one place the canvas, Play, the export and the SVG export read the cell from.
 * @param {string | undefined} type
 * @param {number} stepX
 * @param {number} stepY
 * @returns {{ W: number, H: number, at: [number, number][] }}
 */
export function patternCellOf(type, stepX, stepY) {
    if (type === 'HORIZONTAL_HEXAGONAL') return { W: stepX, H: stepY * 2, at: [[0, 0], [stepX / 2, stepY]] };
    if (type === 'VERTICAL_HEXAGONAL') return { W: stepX * 2, H: stepY, at: [[0, 0], [stepX, stepY / 2]] };
    return { W: stepX, H: stepY, at: [[0, 0]] };
}

/**
 * Where the tile grid starts in a box, from the fill's 9-point alignment: the leftover of the box over whole steps, shared by
 * the canvas (its manual tile loop), Play and the export (their background position) and the picker preview.
 * @param {any} f a pattern fill
 * @param {number} w box width
 * @param {number} h box height
 * @returns {{ x: number, y: number }} pixel offsets
 */
export function patternPhaseOf(f, w, h) {
    const tile = patternTileOf(f);
    if (!tile) return { x: 0, y: 0 };
    const words = String(f.align || 'top-left').split('-');
    const hx = words.includes('left') ? 0 : words.includes('right') ? 1 : 0.5;
    const hy = words.includes('top') ? 0 : words.includes('bottom') ? 1 : 0.5;
    const left = Math.max(0, w - Math.floor(w / tile.stepX) * tile.stepX);
    const top = Math.max(0, h - Math.floor(h / tile.stepY) * tile.stepY);
    return { x: Math.round(left * hx * 100) / 100, y: Math.round(top * hy * 100) / 100 };
}

/**
 * The asset id a pattern fill resolves to at render time: its own image asset, or the picture of its live-linked source
 * layer. The fill stores the source layer id only, never a snapshot; this resolves it where the asset is measured (the
 * studio records the natural size from it) and where it is drawn (canvas, Play, export).
 * @param {any} f a pattern fill
 * @param {(id: string) => any} [lookup] nodes by id
 * @returns {string | null}
 */
export function patternTileId(f, lookup) {
    if (!isPatternFill(f)) return null;
    if (f.image) return f.image;
    if (!f.source || typeof lookup !== 'function') return null;
    const node = lookup(f.source);
    return node ? node.assetId || node.fills?.find(x => x.type === 'image')?.image || null : null;
}
/** The source asset id a pattern fill resolves to at render time (an asset id directly, or a layer id whose picture is its asset). */
function patternSrcOf(f, assets, lookup) {
    const id = patternTileId(f, lookup);
    return (id && assets[id]) || null;
}

/**
 * A pattern fill as an SVG data URL of exactly one tile (two rows for the offset type), so Play and the export repeat the same
 * tile the canvas draws: the recorded natural size times the scale, spaced by the spacing. Null until the tile is known or the
 * asset is missing.
 */
export function patternSvgUrl(f, assets, lookup) {
    const tile = patternTileOf(f);
    if (!tile) return null;
    const src = patternSrcOf(f, assets, lookup);
    if (!src) return null;
    const { W, H, at } = patternCellOf(f.tileType, tile.stepX, tile.stepY);
    const img = (x, y) => `<image href="${src.replace(/"/g, '%22')}" x="${x}" y="${y}" width="${tile.tileW}" height="${tile.tileH}"/>`;
    const body = at.map(([x, y]) => img(x, y)).join('');
    return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`)}`;
}

/**
 * A pattern fill as one CSS background layer: one SVG tile repeated at its tile size, positioned by the 9-point alignment
 * (pixel phase within the box when the box is known, the keyword otherwise). Shares its numbers with the canvas tile loop
 * and the export pattern. Falls back to the keyword layer only through patternFillCss when the tile is not known yet.
 */
/**
 * A pattern fill as longhands for a layer's own element (Play's template layers keep the class's flat colour under it): the SVG tile when its
 * natural size is known, else the raw tile at the 9-point alignment. The same fields as its image sibling, so Play draws them from the same place.
 */
export function patternLonghands(f, assets, lookup, box) {
    const svg = patternSvgLayer(f, assets, lookup, box);
    if (svg) return { image: svg.image, size: svg.size, position: svg.position, repeat: svg.repeat };
    const id = patternTileId(f, lookup), src = id && assets[id];
    if (!src) return null;
    const layout = patternLayout(f);
    return { image: `url("${src}")`, ...(layout.size ? { size: layout.size } : {}), position: layout.position, repeat: layout.repeat };
}
export function patternSvgLayer(f, assets, lookup, box) {
    const tile = patternTileOf(f);
    if (!tile) return null;
    const url = patternSvgUrl(f, assets, lookup);
    if (!url) return null;
    const cell = patternCellOf(f.tileType, tile.stepX, tile.stepY);
    const size = `${Math.round(cell.W * 100) / 100}px ${Math.round(cell.H * 100) / 100}px`;
    const position = box ? (() => { const ph = patternPhaseOf(f, box.w, box.h); return `${ph.x}px ${ph.y}px`; })() : patternLayout(f).position;
    const layer = `url("${url}") ${position} / ${size} repeat`;
    return { layer, image: `url("${url}")`, size, position, repeat: 'repeat' };
}

/**
 * A pattern fill as one CSS background layer: the source tile repeated with its scale, spacing and alignment. The source resolves at render time (an asset id directly, or a layer id whose picture is its asset); a tile whose picture is not in the file is the pending colour. Null when it cannot be drawn.
 * @param {any} f a pattern fill
 * @param {Record<string, string>} assets
 * @param {(id: string) => any} [lookup] nodes by id for a layer source
 */
export function patternFillCss(f, assets, lookup) {
    const direct = f.image ? assets[f.image] : null;
    const node = !direct && f.source && typeof lookup === 'function' ? lookup(f.source) : null;
    const src = direct || (node ? assets[node.assetId || node.fills?.find(x => x.type === 'image')?.image] : null);
    if (!src) return null;
    const layout = patternLayout(f);
    const size = layout.size ? ` ${layout.position} / ${layout.size}` : ` ${layout.position}`;
    void size;
    return { layer: `url("${src}") ${layout.position}${layout.size ? ` / ${layout.size}` : ''} ${layout.repeat}` };
}

// ---------- Videos: static on canvas, a video element in Play and the export ----------

/**
 * The object-fit a video mode draws with on its own element: Fill covers and crops, Fit contains, Crop covers from its crop window, Tile contains once (a video element cannot repeat; the tile size still scales it).
 * @param {string | undefined} mode
 */
export function videoObjectFit(mode) {
    return mode === 'fit' || mode === 'tile' ? 'contain' : 'cover';
}

/**
 * The object-position a video crop draws with: its crop window as percentages. Center otherwise.
 * @param {any} f
 */
export function videoObjectPosition(f) {
    if (f.mode !== 'crop') return 'center';
    const x = Math.max(0, Math.min(1, f.crop?.x ?? 0.5)) * 100, y = Math.max(0, Math.min(1, f.crop?.y ?? 0.5)) * 100;
    return `${Math.round(x * 100) / 100}% ${Math.round(y * 100) / 100}%`;
}

/**
 * The poster a video fill shows on the canvas (static: the canvas never plays): its poster asset when the file holds one, else null (the canvas paints the pending checker).
 * Play and the export use a video element, never the poster, except as the poster attribute.
 * @param {any} f
 * @param {Record<string, string>} assets
 */
export function videoPosterOf(f, assets) {
    return (f.poster && assets[f.poster]) || (f.image && assets[f.image]) || null;
}

/**
 * Whether a layer carries a visible video: Play and the export render a video element for it, layers that are hidden or not rendered do not play.
 * @param {{ fills?: any[], visible?: boolean }} n
 */
export function hasVideoFill(n) {
    return n.visible !== false && getFills(n).some(f => f.type === 'video' && f.visible !== false);
}

// ---------- Fill lists (order, visibility, binding) ----------

/**
 * A fill list with the entry at `from` moved to `to` (Figma order: index 0 is the top). Pure: the canvas, the picker and every surface read the same order.
 * @param {any[]} fills
 * @param {number} from
 * @param {number} to
 */
export function moveFill(fills, from, to) {
    if (from < 0 || to < 0 || from >= fills.length || to >= fills.length || from === to) return fills;
    const next = [...fills], [f] = next.splice(from, 1);
    next.splice(to, 0, f);
    return next;
}

/**
 * The colours a layer shows under its fills: the variable-bound fallback colour first (never a Fill-list entry), then every visible fill.
 * Hidden fills are user-made only (the eye toggle): no engine path adds a hidden fill.
 * @param {any} n
 */
export function visibleFillsOf(n) {
    return getFills(n).filter(f => f.visible !== false);
}

/**
 * The variable key of a gradient stop colour: the fill index and the stop's sorted index. Stop colours bind to variables
 * like whole fills do; the canvas, Play and the export all resolve them through the bound value.
 * @param {number} i fill index
 * @param {number} k sorted stop index
 */
export const stopBindingKey = (i, k) => `fills.${i}.stop.${k}`;

/** Fill param keys a variable can bind, by value type: a pattern or video source, kind or mode is a string, its sizes numbers. */
const FILL_STRING_PARAMS = new Set(['source', 'tileType', 'align', 'mode', 'video', 'image', 'poster']);
const FILL_NUMBER_PARAMS = new Set(['scale', 'spacingX', 'spacingY']);

/**
 * The variable type a fill param key binds: `fills.N.<param>` is a string for a source, kind or mode and a number for a
 * size; anything else is not a param key. The Libraries tab offers variables of that type, and the bound value lands where
 * the fill reads it (a pattern resolves its source at render time, a video its source and mode like an image). Null when the
 * key binds no param. Pure: the picker, the binder and their tests read the same mapping.
 * @param {string} prop a variable key
 * @returns {'string' | 'number' | null}
 */
export function fillParamType(prop) {
    const m = /^fills\.(\d+)\.([A-Za-z]+)$/.exec(String(prop || ''));
    if (!m) return null;
    if (FILL_STRING_PARAMS.has(m[2])) return 'string';
    if (FILL_NUMBER_PARAMS.has(m[2])) return 'number';
    return null;
}

/**
 * A variable key parsed as a stop binding, or null when it binds a whole fill or something else.
 * @param {string} prop
 * @returns {{ i: number, k: number } | null}
 */
export function parseStopKey(prop) {
    const m = /^fills\.(\d+)\.stop\.(\d+)$/.exec(String(prop || ''));
    return m ? { i: +m[1], k: +m[2] } : null;
}

/**
 * Variable keys remapped across a fill add (delta +1 at from) or removal (delta -1, removed set): fills.N shifts like the
 * list does, and each fills.N.stop.K rides with its fill (a removed fill drops its stop keys too). Other keys pass through.
 * @param {Record<string, string>} vars
 */
export function remapFillKeys(vars, from, delta, removed = -1) {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
        const sk = parseStopKey(k);
        if (sk) {
            if (sk.i === removed) continue;
            out[sk.i >= from ? stopBindingKey(sk.i + delta, sk.k) : k] = v;
            continue;
        }
        const m = /^fills\.(\d+)$/.exec(k);
        if (!m) { out[k] = v; continue; }
        const i = +m[1];
        if (i === removed) continue;
        out[`fills.${i >= from ? i + delta : i}`] = v;
    }
    return out;
}

/**
 * Variable keys remapped across a fill reorder (the entry at from moves to to): fills.N and its stop keys move together.
 * @param {Record<string, string>} vars
 */
export function moveFillKeys(vars, from, to) {
    const moveIdx = i => (i === from ? to : from < to && i > from && i <= to ? i - 1 : from > to && i >= to && i < from ? i + 1 : i);
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
        const sk = parseStopKey(k);
        if (sk) { out[stopBindingKey(moveIdx(sk.i), sk.k)] = v; continue; }
        const m = /^fills\.(\d+)$/.exec(k);
        if (!m) { out[k] = v; continue; }
        out[`fills.${moveIdx(+m[1])}`] = v;
    }
    return out;
}

/**
 * Stop keys of one fill remapped across a stop add (delta +1 at pos) or removal (delta -1, removedPos set): siblings shift,
 * the removed one drops. Pure: the picker calls it before it mutates the stops, so bindings track their stop.
 */
export function shiftStopKeys(vars, i, pos, delta, removedPos = -1) {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
        const sk = parseStopKey(k);
        if (!sk || sk.i !== i) { out[k] = v; continue; }
        if (sk.k === removedPos) continue;
        out[stopBindingKey(i, sk.k >= pos ? sk.k + delta : sk.k)] = v;
    }
    return out;
}

/**
 * Stop variable keys after a stop moved from sorted index `from` to `to` (it crossed its neighbours): its binding follows it, the ones it crossed shift by one.
 * @param {Record<string, any>} vars
 * @param {number} i the fill index
 * @param {number} from
 * @param {number} to
 */
export function moveStopKeys(vars, i, from, to) {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
        const sk = parseStopKey(k);
        if (!sk || sk.i !== i) { out[k] = v; continue; }
        let at = sk.k;
        if (sk.k === from) at = to;
        else if (from < to && sk.k > from && sk.k <= to) at = sk.k - 1;
        else if (from > to && sk.k >= to && sk.k < from) at = sk.k + 1;
        out[stopBindingKey(i, at)] = v;
    }
    return out;
}

/**
 * One fill as a CSS background layer. A linear fill's angle is measured from the x axis on the canvas, and from the top in CSS: CSS is
 * the canvas angle plus 90 degrees. An image is its asset, covering the box, contained for fit, or repeated for tile. Null for a fill
 * CSS cannot draw (a tiled image at a scale: the natural size is not known here); undefined for a fill that draws nothing.
 * @param {any} f
 * @param {Record<string, string>} assets
 * @param {(id: string) => any} [lookup] nodes by id for a pattern source
 * @returns {{ css: string, solid: boolean } | null | undefined}
 */
function cssFillLayer(f, assets, lookup, box) {
    const o = f.opacity;
    if (f.type === 'image') {
        const svg = imageSvgLayer(f, assets);
        if (svg) return { css: svg.layer, solid: false };
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
    if (f.type === 'pattern') {
        const svg = patternTileOf(f) ? patternSvgLayer(f, assets, lookup, box) : null;
        if (svg) return { css: svg.layer, solid: false };
        const css = patternFillCss(f, assets, lookup);
        if (!css) return null;
        return { css: css.layer, solid: false };
    }
    if (f.type === 'video') return undefined;
    return null;
}

/**
 * The CSS background of a fill list: every visible fill, the top one first, as one layer each. `background` is '' when nothing paints;
 * `unsupported` names the fill types CSS cannot draw. A video draws no background layer (Play and the export render a video element instead).
 * @param {any[]} fills
 * @param {Record<string, string>} [assets] the document's asset sources, by id
 * @param {(id: string) => any} [lookup] nodes by id for a pattern source
 * @param {{ w: number, h: number }} [box] the layer's box: a known tile aligns by pixel phase in it
 * @returns {{ background: string, unsupported: string[], filter?: string, blend?: string }} `blend` is the background-blend-mode list, one per layer, only when a fill is not Normal
 */
export function cssBackgroundOf(fills, assets = {}, lookup, box) {
    const layers = [], unsupported = [], blends = [];
    let filter = '';
    for (const f of fills.filter(x => x.visible !== false)) {
        const layer = cssFillLayer(f, assets, lookup, box);
        if (layer === null) unsupported.push(f.type);
        else if (layer) {
            layers.push(layer);
            blends.push(BLEND_MODES.includes(f.blend) ? f.blend : 'normal');
            if (layer.filter && !filter) filter = layer.filter;
            if (layer.missing) unsupported.push('image with no asset');
        }
    }
    if (!layers.length) return { background: '', unsupported };
    const blend = blends.some(b => b !== 'normal') ? blends.join(', ') : '';
    if (layers.length === 1 && layers[0].solid) return { background: layers[0].css, unsupported, ...(blend ? { blend } : {}) };
    const out = { background: layers.map(l => (l.solid ? `linear-gradient(${l.css}, ${l.css})` : l.css)).join(', '), unsupported };
    if (blend) out.blend = blend;
    if (filter) out.filter = filter;
    return out;
}
