// Real Play geometry from the generated CSS + DOM descriptors (no browser): resolves
// the full cascade (rule order, var(), calc()), expands box-model shorthands and computes
// flex-centred offsets, so a test asserts pixel positions instead of declared rules.
import { computed } from './play-compute.js';

const px = v => {
    const m = /^(-?[\d.]+)px$/.exec(String(v ?? '').trim());
    return m ? parseFloat(m[1]) : null;
};

/** Resolve a calc()/var()-free length the test stylesheets emit (px number or plain px). */
export function length(v) {
    return px(v);
}

/** Expand `padding: T R B L` / `T R` / `T` and padding-inline/block into {t,r,b,l} px. */
export function paddingOf(style) {
    const out = { t: 0, r: 0, b: 0, l: 0 };
    const inline = px(style['padding-inline']);
    const block = px(style['padding-block']);
    if (inline !== null) out.l = out.r = inline;
    if (block !== null) out.t = out.b = block;
    const parts = String(style.padding ?? '').trim().split(/\s+/).filter(Boolean).map(px);
    if (parts.length && parts.every(n => n !== null)) {
        const [t, r = t, b = t, l = r] = parts;
        out.t = t; out.r = r; out.b = b; out.l = l;
    }
    for (const [k, side] of [['padding-top', 't'], ['padding-right', 'r'], ['padding-bottom', 'b'], ['padding-left', 'l']]) {
        const n = px(style[k]);
        if (n !== null) out[side] = n;
    }
    return out;
}

/** Border widths from `border-width` (1-4 values) or per-side properties, in px. */
export function borderOf(style) {
    const out = { t: 0, r: 0, b: 0, l: 0 };
    const parts = String(style['border-width'] ?? '').trim().split(/\s+/).filter(Boolean).map(px);
    if (parts.length && parts.every(n => n !== null)) {
        const [t, r = t, b = t, l = r] = parts;
        out.t = t; out.r = r; out.b = b; out.l = l;
    }
    for (const [k, side] of [['border-top-width', 't'], ['border-right-width', 'r'], ['border-bottom-width', 'b'], ['border-left-width', 'l']]) {
        const n = px(style[k]);
        if (n !== null) out[side] = n;
    }
    return out;
}

/**
 * The border-box and content-box of an element whose computed style is known, plus the
 * static flex offset a centred row/column gives a child of the given outer size.
 * All boxes here are border-box (the codegen always emits it).
 */
export function flexChildOffset(containerStyle, childW, childH) {
    const cw = px(containerStyle.width), ch = px(containerStyle.height);
    if (cw === null || ch === null) return null;
    const b = borderOf(containerStyle), p = paddingOf(containerStyle);
    const contentX = b.l + p.l, contentY = b.t + p.t;
    const contentW = cw - b.l - b.r - p.l - p.r, contentH = ch - b.t - p.b - p.t - p.b;
    const dir = (containerStyle['flex-direction'] ?? 'row').trim();
    const justify = (containerStyle['justify-content'] ?? 'flex-start').trim();
    const align = (containerStyle['align-items'] ?? 'stretch').trim();
    const main = v => (v === 'center' ? (n, m) => (m - n) / 2 : (v === 'flex-end' || v === 'end') ? (n, m) => m - n : () => 0);
    const [ox, oy] = dir === 'row' ? [main(justify)(childW, contentW), main(align)(childH, contentH)] : [main(align)(childW, contentW), main(justify)(childH, contentH)];
    return { x: contentX + ox, y: contentY + oy, boxW: cw, boxH: ch };
}

export function centreOf(x, y, w, h) {
    return { x: x + w / 2, y: y + h / 2 };
}

/** Arithmetic for the calc() the stylesheets emit (px numbers, + - * /, parentheses). */
export function calcPx(expr) {
    const tokens = String(expr).replace(/px/g, '').match(/\(|\)|\+|-|\*|\/|[\d.]+/g) ?? [];
    let at = 0;
    const peek = () => tokens[at];
    function expr_() {
        let v = term();
        while (peek() === '+' || peek() === '-') v = peek() === '+' ? (at++, v + term()) : (at++, v - term());
        return v;
    }
    function term() {
        let v = factor();
        while (peek() === '*' || peek() === '/') v = peek() === '*' ? (at++, v * factor()) : (at++, v / factor());
        return v;
    }
    function factor() {
        if (peek() === '(') { at++; const v = expr_(); at++; return v; }
        if (peek() === '-') { at++; return -factor(); }
        const v = parseFloat(peek() ?? 'NaN');
        at++;
        return v;
    }
    const v = expr_();
    if (at !== tokens.length || !Number.isFinite(v)) throw new Error(`cannot evaluate calc(${expr})`);
    return v;
}

/** The px of a translateX()/translate() transform value (after var() resolution). */
export function translateXOf(transform) {
    const m = /translateX\((.*)\)/.exec(String(transform ?? ''));
    if (!m) return 0;
    return calcPx(m[1].replace(/^calc\((.*)\)$/, '$1'));
}

/** Computed style of the last element of a chain (var()/calc() resolved where possible). */
export function styleOf(styles, chain) {
    return computed(styles, chain);
}
