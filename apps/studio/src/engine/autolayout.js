// Auto layout engine and text measurement, shared by the editor (midas.js) and the layout conformance test.
// Pure apart from the canvas used to measure text. Nothing here reads the document: the caller says how a node
// with children is treated (clampToLimits' hasKids, used for the empty-slot minimum of an instance).
import { layoutOrder, strokeInset, strokeOutset, strokeSideWidths, strokeIsOn } from '../preview/flexStyle.js';
import { splitOverlayParts } from './behavior.js';

// ===== autolayout engine =====
export function isAutoLayout(n) { return !!n && n.type === 'frame' && !!n.layout && n.layout !== 'none'; }
export function lyPads(n) { const p = n.padding ?? 16; return { t: n.padT ?? p, r: n.padR ?? p, b: n.padB ?? p, l: n.padL ?? p }; }
const lyPadsBase = lyPads;
function lyGap(n) { return n.gap ?? 16; }
// Gap between wrapped rows; a missing or non-numeric value (imported wrap layouts) follows the main gap instead of turning every size into NaN.
function lyGapCross(n, gap) { return Number.isFinite(n.gapCross) ? n.gapCross : gap; }
export function sizingOf(n, axis) {
    const v = axis === 'h' ? n.layoutSizingH : n.layoutSizingV;
    if (v)
        return v;
    if (n.type === 'text')
        return axis === 'h' ? (n.autoW ? 'hug' : 'fixed') : 'hug';
    return 'fixed';
}
export function runLayout(d, { hasKids = () => true } = {}) {
    const clampMM = (n, dim, v) => clampToLimits(n, dim, v, hasKids);
    // Overlay roots live outside the main hierarchy: each lays out in its own context (spec).
    if (!d.isOverlayPart) {
        const parts = splitOverlayParts(d.nodes);
        if (parts) {
            const self = d, get = self.get.bind(self), touch = (...a) => self.touch(...a);
            for (const sub of parts.subs) runLayout({ nodes: sub, get, touch, isOverlayPart: true }, { hasKids });
            if (!parts.main.length) return;
            d = { nodes: parts.main, get, touch };
        }
    }
    const nodes = d.nodes;
    if (!nodes.some(n => n.minW != null || n.maxW != null || n.minH != null || n.maxH != null || isAutoLayout(n) || n.layoutSizingH === 'fill' || n.layoutSizingV === 'fill' || (n.type === 'frame' && (n.layoutSizingH === 'hug' || n.layoutSizingV === 'hug'))))
        return;
    const kids = new Map();
    for (const n of nodes) {
        const k = n.parentId && d.get(n.parentId) ? n.parentId : null;
        if (!kids.has(k))
            kids.set(k, []);
        kids.get(k).push(n);
    }
    for (const [k, list] of kids) {
        // the order of the flow comes from the same function Preview uses
        kids.set(k, layoutOrder(k && d.get(k), list));
    }
    const before = new Map(nodes.map(n => [n, [n.x, n.y, n.w, n.h, n.autoW]]));
    const parentOf = n => d.get(n.parentId);
    // "Strokes: Included" (auto layout settings): children's outer stroke takes up room in the flow, and the
    // frame's own inner stroke pushes its content in, like Figma.
    const strokeOut = strokeOutset;
    // Per side: a frame with a stroke on its left edge only takes room on that side only.
    const strokeIn = strokeInset;
    const ext = c => parentOf(c)?.strokesIncluded ? strokeOut(c) : 0;
    // Figma: a Fill child of an auto layout frame that hugs on that axis has no space to share; it keeps its natural size (Hug).
    const resolvesHugC = (n, axis) => {
        const s = sizingOf(n, axis);
        if (s === 'hug') return true;
        const p = parentOf(n);
        return s === 'fill' && !!p && isAutoLayout(p) && n.layoutPositioning !== 'absolute' && resolvesHugC(p, axis);
    };
    const hugParentOn = (c, axis) => { const p = parentOf(c); return !!p && isAutoLayout(p) && c.layoutPositioning !== 'absolute' && resolvesHugC(p, axis); };
    const fillOn = (c, axis) => sizingOf(c, axis) === 'fill' && !hugParentOn(c, axis);
    const lyPads = n => {
        const P = lyPadsBase(n);
        if (!n.strokesIncluded)
            return P;
        const s = strokeIn(n);
        return { t: P.t + s.t, r: P.r + s.r, b: P.b + s.b, l: P.l + s.l };
    };
    // First-line baseline of a layer, measured from its top (non-text layers sit on their bottom edge).
    const baselineOf = c => c.type === 'text' ? ((c.fontSize || 16) * (c.lineHeight || 1.2) - (c.fontSize || 16)) / 2 + (c.fontSize || 16) * .8 : c.h;
    const inFlow = c => c.visible !== false && c.layoutPositioning !== 'absolute';
    const eff = (n, axis) => {
        let v = sizingOf(n, axis);
        const p = parentOf(n), inFrame = !!p && p.type === 'frame' && n.layoutPositioning !== 'absolute';
        if (v === 'fill' && !inFrame)
            v = 'fixed';
        if (v === 'fill' && hugParentOn(n, axis))
            v = 'hug';
        if (v === 'fill')
            v = (axis === 'h' ? n._fw : n._fh) ? 'fixed' : 'hug';
        if (v === 'hug' && !(n.type === 'text' || n.type === 'frame'))
            v = 'fixed';
        if (v === 'hug' && isAutoLayout(n) && n.layoutWrap && n.layout !== 'grid' && ((n.layout === 'horizontal') === (axis === 'h')))
            v = 'fixed';
        return v;
    };
    const breakLines = (fl, inner, gap, horiz = true) => {
        const lines = [];
        let line = [], run = 0;
        for (const c of fl) {
            const cs = sizeOn(c, horiz ? 'h' : 'v');
            if (line.length && run + gap + cs > inner + .001) {
                lines.push(line);
                line = [];
                run = 0;
            }
            run += (line.length ? gap : 0) + cs;
            line.push(c);
        }
        if (line.length)
            lines.push(line);
        return lines;
    };
    const sizeOn = (c, axis) => (axis === 'h' ? c.w : c.h) + 2 * ext(c);
    // Grid tracks: column width / row height = largest child in that column / row.
    const gridCols = n => Math.max(1, Math.round(n.gridCols || 2));
    const gridTracks = (n, fl) => {
        const cols = gridCols(n), colW = Array(cols).fill(0), rowH = [];
        fl.forEach((c, i) => {
            const ci = i % cols, ri = Math.floor(i / cols);
            colW[ci] = Math.max(colW[ci], c.w);
            rowH[ri] = Math.max(rowH[ri] || 0, c.h);
        });
        return { cols, colW, rowH };
    };
    // Phase "up": resolve hug sizes bottom-up on one axis (fill children count as their natural size).
    const up0 = (n, axis) => {
        const ch = kids.get(n.id) || [];
        for (const c of ch)
            up(c, axis);
        if (n.type === 'text') {
            const tp = parentOf(n);
            if (!tp || tp.type !== 'frame' || n.layoutPositioning === 'absolute' || (!isAutoLayout(tp) && !n.layoutSizingH && !n.layoutSizingV))
                return;
            if (axis === 'h') {
                if (eff(n, 'h') === 'hug') {
                    const h0 = n.h;
                    n.autoW = true;
                    hugText(n);
                    n.h = h0;
                }
                else
                    n.autoW = false;
            }
            else if (eff(n, 'v') === 'hug')
                n.h = Math.ceil(Math.max(n.fontSize * n.lineHeight, layoutText(n).height));
            return;
        }
        if (n.type === 'frame' && !isAutoLayout(n)) {
            if (eff(n, axis) === 'hug') {
                const extent = Math.max(1, ...ch.filter(inFlow).map(c => axis === 'h' ? c.x + c.w : c.y + c.h));
                if (axis === 'h')
                    n.w = extent;
                else
                    n.h = extent;
            }
            return;
        }
        if (!isAutoLayout(n) || eff(n, axis) !== 'hug')
            return;
        if (n.layout === 'grid') {
            const P = lyPads(n), gap = lyGap(n), gapC = lyGapCross(n, gap), fl = ch.filter(inFlow), T = gridTracks(n, fl);
            const total = axis === 'h'
                ? T.colW.reduce((s, v) => s + v, 0) + gap * Math.max(0, Math.min(T.cols, fl.length) - 1) + P.l + P.r
                : T.rowH.reduce((s, v) => s + v, 0) + gapC * Math.max(0, T.rowH.length - 1) + P.t + P.b;
            if (axis === 'h')
                n.w = Math.max(1, total);
            else
                n.h = Math.max(1, total);
            return;
        }
        const horiz = n.layout === 'horizontal', wrap = !!n.layoutWrap, P = lyPads(n), gap = lyGap(n), fl = ch.filter(inFlow);
        const prim = (axis === 'h') === horiz, pad = axis === 'h' ? P.l + P.r : P.t + P.b;
        let total;
        if (prim)
            total = fl.reduce((s, c) => s + sizeOn(c, axis), 0) + gap * Math.max(0, fl.length - 1);
        else if (wrap) {
            const lines = breakLines(fl, Math.max(0, horiz ? n.w - P.l - P.r : n.h - P.t - P.b), gap, horiz);
            total = lines.reduce((s, l) => s + Math.max(0, ...l.map(c => sizeOn(c, axis))), 0) + (lyGapCross(n, gap)) * Math.max(0, lines.length - 1);
        }
        else
            total = Math.max(0, ...fl.map(c => sizeOn(c, axis)));
        total += pad;
        if (axis === 'h')
            n.w = total;
        else
            n.h = total;
    };
    const up = (n, axis) => {
        up0(n, axis);
        const d = axis === 'h' ? 'w' : 'h', v = clampMM(n, d, n[d]);
        if (v !== n[d])
            n[d] = v;
    };
    // Phase "down": hand out Fill sizes top-down on one axis.
    const assign = (c, axis, v) => {
        v = clampMM(c, axis === 'h' ? 'w' : 'h', v);
        // Locked proportions: a Fill side hands the other (fixed) side its matching size straight away.
        if (c.lockRatio && !(c.aspect > 0) && c.w > 0 && c.h > 0)
            c.aspect = c.w / c.h;
        const ratio = c.lockRatio && c.aspect > 0 ? c.aspect : 0;
        if (axis === 'h') {
            c.w = v;
            c._fw = true;
            if (c.type === 'text')
                c.autoW = false;
            if (ratio && sizingOf(c, 'v') === 'fixed')
                c.h = Math.max(.1, clampMM(c, 'h', +(v / ratio).toFixed(3)));
        }
        else {
            c.h = v;
            c._fh = true;
            if (ratio && sizingOf(c, 'h') === 'fixed')
                c.w = Math.max(.1, clampMM(c, 'w', +(v * ratio).toFixed(3)));
        }
    };
    const down = (n, axis) => {
        const ch = kids.get(n.id) || [];
        if (isAutoLayout(n) && n.layout === 'grid') {
            const P = lyPads(n), gap = lyGap(n), gapC = lyGapCross(n, gap), fl = ch.filter(inFlow), cols = gridCols(n);
            if (axis === 'h') {
                const share = Math.max(0, (Math.max(0, n.w - P.l - P.r) - gap * (cols - 1)) / cols);
                for (const c of fl)
                    if (fillOn(c, 'h'))
                        assign(c, 'h', share);
            }
            else {
                const rows = [];
                fl.forEach((c, i) => { (rows[Math.floor(i / cols)] ||= []).push(c); });
                const nat = rows.map(r => Math.max(0, ...r.map(c => fillOn(c, 'v') ? 0 : c.h)));
                const natTot = nat.reduce((s, v) => s + v, 0), extra = rows.length ? Math.max(0, (Math.max(0, n.h - P.t - P.b) - natTot - gapC * (rows.length - 1)) / rows.length) : 0;
                rows.forEach((r, ri) => { for (const c of r)
                    if (fillOn(c, 'v'))
                        assign(c, 'v', Math.max(nat[ri], extra)); });
            }
        }
        else if (isAutoLayout(n)) {
            const horiz = n.layout === 'horizontal', wrap = !!n.layoutWrap, P = lyPads(n), gap = lyGap(n), fl = ch.filter(inFlow);
            const prim = (axis === 'h') === horiz, inner = axis === 'h' ? Math.max(0, n.w - P.l - P.r) : Math.max(0, n.h - P.t - P.b);
            if (prim && !wrap) {
                const fills = fl.filter(c => fillOn(c, axis));
                if (fills.length) {
                    const gapUse = n.gapAuto ? 0 : gap, fixedTot = fl.reduce((s, c) => s + (fillOn(c, axis) ? 0 : sizeOn(c, axis)), 0);
                    // Equal shares, but a Fill child clamped by its min / max takes what it cannot use out of the pool, and the
                    // rest is shared again among the others until nothing is clamped (Figma / flexbox behavior).
                    const dim = axis === 'h' ? 'w' : 'h';
                    let pool = fills, room = inner - fixedTot - gapUse * Math.max(0, fl.length - 1);
                    for (;;) {
                        const share = Math.max(0, room / pool.length);
                        const clamped = pool.filter(c => clampMM(c, dim, Math.max(0, share - 2 * ext(c))) !== Math.max(0, share - 2 * ext(c)));
                        if (!clamped.length) {
                            for (const c of pool)
                                assign(c, axis, Math.max(0, share - 2 * ext(c)));
                            break;
                        }
                        for (const c of clamped) {
                            const v = clampMM(c, dim, Math.max(0, share - 2 * ext(c)));
                            assign(c, axis, v);
                            room -= v + 2 * ext(c);
                        }
                        pool = pool.filter(c => !clamped.includes(c));
                        if (!pool.length)
                            break;
                    }
                }
            }
            else if (!prim) {
                const lines = wrap ? breakLines(fl, Math.max(0, horiz ? n.w - P.l - P.r : n.h - P.t - P.b), gap, horiz) : [fl];
                for (const line of lines) {
                    const lineCross = wrap ? Math.max(0, ...line.map(c => sizeOn(c, axis))) : inner;
                    for (const c of line)
                        if (fillOn(c, axis))
                            assign(c, axis, Math.max(0, lineCross - 2 * ext(c)));
                }
            }
        }
        else if (n.type === 'frame') {
            for (const c of ch.filter(inFlow))
                if (fillOn(c, axis)) {
                    assign(c, axis, axis === 'h' ? n.w : n.h);
                    if (axis === 'h')
                        c.x = 0;
                    else
                        c.y = 0;
                }
        }
        for (const c of ch)
            down(c, axis);
    };
    const place = (n, ch) => {
        if (n.layout === 'grid') {
            const P = lyPads(n), gap = lyGap(n), gapC = lyGapCross(n, gap), fl = ch.filter(inFlow), T = gridTracks(n, fl);
            const colX = [], rowY = [];
            let ax = 0, ay = 0;
            T.colW.forEach((w, i) => { colX[i] = ax; ax += w + gap; });
            T.rowH.forEach((h, i) => { rowY[i] = ay; ay += h + gapC; });
            const hA = n.primaryAlign || 'start', vA = n.counterAlign || n.layoutAlign || 'start';
            fl.forEach((c, i) => {
                const ci = i % T.cols, ri = Math.floor(i / T.cols);
                const ox = hA === 'center' ? (T.colW[ci] - c.w) / 2 : hA === 'end' ? T.colW[ci] - c.w : 0;
                const oy = vA === 'center' ? (T.rowH[ri] - c.h) / 2 : vA === 'end' ? T.rowH[ri] - c.h : 0;
                if (!c._drag) {
                    c.x = P.l + colX[ci] + ox;
                    c.y = P.t + rowY[ri] + oy;
                }
            });
            return;
        }
        const horiz = n.layout === 'horizontal', wrap = !!n.layoutWrap, P = lyPads(n), gap = lyGap(n), gapC = lyGapCross(n, gap), fl = ch.filter(inFlow);
        const innerW = Math.max(0, n.w - P.l - P.r), innerH = Math.max(0, n.h - P.t - P.b), innerP = horiz ? innerW : innerH, innerC = horiz ? innerH : innerW;
        const prim = c => (horiz ? c.w : c.h) + 2 * ext(c), crossOf = c => (horiz ? c.h : c.w) + 2 * ext(c);
        const lines = wrap ? breakLines(fl, innerP, gap, horiz) : [fl];
        const pAlign = n.primaryAlign || 'start', cAlign = n.counterAlign || n.layoutAlign || 'start', between = !!n.gapAuto;
        let crossAt = 0;
        for (const line of lines) {
            const k = line.length, gapUse = between ? 0 : gap, lineCross = wrap ? Math.max(0, ...line.map(crossOf)) : innerC;
            const used = line.reduce((s, c) => s + prim(c), 0);
            let g = gapUse, off = 0;
            // Auto gap: Between (edges flush), Evenly (equal space everywhere), Around (half space at the edges).
            const mode = n.gapMode || 'between', free = Math.max(0, innerP - used);
            if (between && mode === 'evenly' && k)
                off = g = free / (k + 1);
            else if (between && mode === 'around' && k) {
                g = free / k;
                off = g / 2;
            }
            else if (between && k > 1)
                g = Math.max(0, free / (k - 1));
            else {
                const total = used + gapUse * Math.max(0, k - 1);
                off = pAlign === 'center' ? (innerP - total) / 2 : pAlign === 'end' ? innerP - total : 0;
            }
            let at = off;
            // Align text baseline (horizontal only): every layer's first baseline lines up with the lowest one.
            const baseline = horiz && n.alignBaseline ? Math.max(0, ...line.map(c => baselineOf(c) + ext(c))) : null;
            for (const c of line) {
                const cs = crossOf(c), e = ext(c);
                const co = baseline !== null ? baseline - baselineOf(c) - e : cAlign === 'center' ? (lineCross - cs) / 2 : cAlign === 'end' ? lineCross - cs : 0;
                if (!c._drag) {
                    if (horiz) { c.x = P.l + at + e; c.y = P.t + crossAt + co + e; }
                    else { c.x = P.l + crossAt + co + e; c.y = P.t + at + e; }
                }
                at += prim(c) + g;
            }
            crossAt += lineCross + gapC;
        }
    };
    const arrange = n => {
        const ch = kids.get(n.id) || [];
        if (isAutoLayout(n))
            place(n, ch);
        for (const c of ch)
            arrange(c);
    };
    const roots = kids.get(null) || [];
    for (const axis of ['h', 'v']) {
        for (const r of roots)
            up(r, axis);
        for (const r of roots)
            down(r, axis);
    }
    for (const r of roots)
        arrange(r);
    for (const n of nodes) {
        delete n._fw;
        delete n._fh;
    }
    for (const [n, b] of before) {
        const a = [n.x, n.y, n.w, n.h, n.autoW];
        if (a.some((v, i) => v !== b[i] && !(typeof v === 'number' && Math.abs(v - b[i]) < 1e-7)))
            d.touch(n);
    }
}

export function clampToLimits(n, dim, v, hasKids = () => true) {
    let lo = dim === 'w' ? n.minW : n.minH;
    const hi = dim === 'w' ? n.maxW : n.maxH;
    // A frame with auto layout is never smaller than its padding (border-box, as in the browser), plus its inner stroke when included.
    if (isAutoLayout(n)) {
        const P = lyPads(n), I = n.strokesIncluded ? strokeInset(n) : { t: 0, r: 0, b: 0, l: 0 };
        lo = Math.max(lo ?? 0, dim === 'w' ? P.l + P.r + I.l + I.r : P.t + P.b + I.t + I.b);
    }
    // An empty slot of an instance stays big enough to see and click (its "+" placeholder).
    if (n.propBind?.slot && n.sourceId && sizingOf(n, dim === 'w' ? 'h' : 'v') === 'hug' && !hasKids(n.id))
        lo = Math.max(lo ?? 0, dim === 'w' ? 120 : 56);
    const imp = dim === 'w' ? n.implicitW : n.implicitH;
    if (imp && sizingOf(n, dim === 'w' ? 'h' : 'v') === 'hug')
        lo = Math.max(lo ?? 0, imp);
    if (lo != null)
        v = Math.max(v, lo);
    if (hi != null)
        v = Math.min(v, hi);
    return v;
}

export const FONT_STACK = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
export function fontSpec(n) { return `${n.fontStyle || 'normal'} ${n.fontWeight || 400} ${n.fontSize || 16}px ${n.fontFamily === 'Inter' ? FONT_STACK : `"${String(n.fontFamily).replace(/["\\]/g, '')}", sans-serif`}`; }
export function displayText(n) {
    let t = n.text || '';
    if (n.textCase === 'upper')
        t = t.toLocaleUpperCase();
    if (n.textCase === 'lower')
        t = t.toLocaleLowerCase();
    if (n.textCase === 'title')
        t = t.replace(/\p{L}[\p{L}\p{M}]*/gu, s => s[0].toLocaleUpperCase() + s.slice(1).toLocaleLowerCase());
    // Bulleted / numbered lists mark every non-empty paragraph.
    if (n.textList === 'bullet' || n.textList === 'number') {
        let k = 0;
        t = t.split('\n').map(line => line.trim() ? (n.textList === 'bullet' ? '•  ' : `${++k}.  `) + line : line).join('\n');
    }
    return t;
}
export const measureCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function layoutText(n, ctx = measureCanvas.getContext('2d')) {
    ctx.font = fontSpec(n);
    ctx.letterSpacing = `${n.letterSpacing || 0}px`;
    const max = n.autoW ? 1e9 : Math.max(1, n.w), lines = [];
    const segmenter = globalThis.Intl?.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const wrapPara = (paragraph, width) => {
        const out = [], words = paragraph.match(/\s+|\S+/gu) || [];
        let line = '';
        for (let word of words) {
            if (ctx.measureText(line + word).width <= width) {
                line += word;
                continue;
            }
            if (line.trim()) {
                out.push(line.trimEnd());
                line = '';
            }
            word = word.trimStart();
            if (ctx.measureText(word).width <= width) {
                line = word;
                continue;
            }
            const segments = segmenter ? [...segmenter.segment(word)].map(s => s.segment) : Array.from(word);
            for (const ch of segments) {
                if (line && ctx.measureText(line + ch).width > width) {
                    out.push(line);
                    line = '';
                }
                line += ch;
            }
        }
        out.push(line.trimEnd());
        return out;
    };
    // Wrap models: "balance" evens out the line lengths, "pretty" avoids a lone word on the last line.
    const wrapModel = n.autoW ? 'default' : n.textWrap || 'default';
    for (const paragraph of displayText(n).split('\n')) {
        if (!paragraph) {
            lines.push('');
            continue;
        }
        let res = wrapPara(paragraph, max);
        if (wrapModel !== 'default' && res.length > 1) {
            if (wrapModel === 'balance') {
                let lo = max * .3, hi = max, best = res;
                for (let k = 0; k < 10; k++) {
                    const mid = (lo + hi) / 2, t = wrapPara(paragraph, mid);
                    if (t.length === res.length) {
                        best = t;
                        hi = mid;
                    }
                    else
                        lo = mid;
                }
                res = best;
            }
            else if (!/\s/.test(res.at(-1).trim())) {
                for (let w = max - 4; w > max * .6; w -= 4) {
                    const t = wrapPara(paragraph, w);
                    if (t.length > res.length)
                        break;
                    res = t;
                    if (/\s/.test(t.at(-1).trim()))
                        break;
                }
            }
        }
        lines.push(...res);
    }
    const lh = (n.fontSize || 16) * (n.lineHeight || 1.35), ascent = (n.fontSize || 16) * .82;
    // Truncate (with Max lines, default 1) cuts the text and end the
    // last visible line with an ellipsis, even when only a single character did not fit.
    const limit = n.textTruncate ? Math.max(1, Math.floor(+n.maxLines) || 1) : Infinity;
    if (lines.length > limit) {
        lines.length = limit;
        let last = lines[limit - 1].trimEnd();
        while (last && ctx.measureText(last + '…').width > max)
            last = Array.from(last).slice(0, -1).join('').trimEnd();
        lines[limit - 1] = last + '…';
    }
    const contentH = Math.max(lh, lines.length * lh);
    // Vertical alignment only matters when the box is taller than its text.
    const free = Math.max(0, (n.h || 0) - contentH), dy = n.textAlignV === 'center' ? free / 2 : n.textAlignV === 'bottom' ? free : 0;
    return { lines, lineHeight: lh, height: contentH, baseline: (lh - (n.fontSize || 16)) / 2 + ascent + dy };
}


export function hugText(n) {
    const l = layoutText(n), ctx = measureCanvas.getContext('2d');
    ctx.font = fontSpec(n);
    ctx.letterSpacing = `${n.letterSpacing || 0}px`;
    // The exact measured width: Preview sets the same text to nowrap, so the browser lays it out in this width.
    n.w = Math.max(1, Math.max(0, ...l.lines.map(t => ctx.measureText(t).width)));
    n.h = Math.ceil(Math.max(n.fontSize * n.lineHeight, l.height));
}
