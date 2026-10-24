// FIXED live preview - 3 bugs fixed
// 1) Full website mode, 2) Respect designer selected/focused state, 3) Overlay edits + W/H/gap/padding

import { effectiveState, normalizeInteractions, normalizePlacement, overridesFor, resolveMotion, stateChain } from '../engine/behavior.js';

const SVG = 'http://www.w3.org/2000/svg';
const el = (tag, style, parent) => {
    const e = document.createElement(tag);
    if (style) Object.assign(e.style, style);
    if (parent) parent.appendChild(e);
    return e;
};
const px = v => `${Math.round((+v || 0) * 100) / 100}px`;
const rgba = (hex, a = 1) => {
    const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(hex || '').trim());
    if (!m) return hex || 'transparent';
    const n = parseInt(m[1], 16), alpha = (m[2] ? parseInt(m[2], 16) / 255 : 1) * a;
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${Math.round(alpha * 1000) / 1000})`;
};
const isAuto = n => n && n.type === 'frame' && n.layout && n.layout !== 'none';

function fillsOf(n) {
    if (Array.isArray(n.fills)) return n.fills.filter(f => f.visible !== false);
    if (!n.fill || n.fill === 'none') return [];
    if (n.fillType === 'linear') return [{ type: 'linear', color: n.fill, color2: n.fill2 || '#ffffff', angle: n.gradientAngle ?? 90, opacity: n.fillOpacity ?? 1 }];
    return [{ type: 'solid', color: n.fill, opacity: n.fillOpacity ?? 1 }];
}
const bound = (ctx, n, prop, value) => {
    const name = !n.resolvedInMode && n.vars?.[prop] && ctx.varName(n.vars[prop]);
    return name ? `var(--${name}, ${value})` : value;
};
const radiusOf = (ctx, n) => n.type === 'ellipse' ? '50%' : Array.isArray(n.radii) && n.radii.length === 4 ? n.radii.map(px).join(' ') : n.radius ? bound(ctx, n, 'radius', px(n.radius)) : '';
function paint(ctx, n) {
    const s = {};
    const layers = fillsOf(n).map((f, i) => {
        if (f.type === 'solid') {
            const c = bound(ctx, n, i === 0 ? 'fill' : `fill${i}`, rgba(f.color, f.opacity ?? 1));
            return `linear-gradient(${c}, ${c})`;
        }
        if (f.type === 'linear') {
            const stops = f.stops?.length ? f.stops.map(t => `${rgba(t.color, t.opacity ?? 1)} ${Math.round((t.pos ?? t.position ?? 0) * 100)}%`).join(', ') : `${rgba(f.color, f.opacity ?? 1)}, ${rgba(f.color2, f.opacity ?? 1)}`;
            return `linear-gradient(${(f.angle ?? 90) + 90}deg, ${stops})`;
        }
        return null;
    }).filter(Boolean).reverse();
    s.background = layers.join(', ');
    s.borderRadius = radiusOf(ctx, n);
    s.boxShadow = n.shadow ? `${px(n.shadowX)} ${px(n.shadowY)} ${px(n.shadowBlur)} ${rgba(n.shadowColor, n.shadowOpacity ?? 1)}` : '';
    s.opacity = n.opacity ?? 1;
    return s;
}
function strokeOverlay(ctx, n, d) {
    const w = n.strokeSides === 'custom' ? [n.strokeT, n.strokeR, n.strokeB, n.strokeL].map(v => +v || 0) : Array(4).fill(+n.strokeWidth || 0);
    if (!n.strokeWidth || !w.some(Boolean) || n.type === 'text') return;
    const grow = { outside: Math.max(...w), center: Math.max(...w) / 2 }[n.strokeAlign] || 0;
    const o = el('div', { position: 'absolute', inset: px(-grow), boxSizing: 'border-box', pointerEvents: 'none', borderStyle: 'solid', borderWidth: w.map(px).join(' '),
        borderColor: bound(ctx, n, 'stroke', rgba(n.stroke, n.strokeOpacity ?? 1)), borderRadius: radiusOf(ctx, n) }, d);
    o.dataset.stroke = '1';
}
export function pinBox(base) {
    const out = { ...base };
    if (out.layoutSizingH === 'hug') out.layoutSizingH = 'fixed';
    if (out.layoutSizingV === 'hug') out.layoutSizingV = 'fixed';
    return out;
}
export function retargetIconLayers(ctx, inner, to) {
    for (const p of ['fill', 'stroke']) {
        const t = inner.target?.[p], src = t && ctx.node(t);
        const dst = src && ctx.descendants(to.id).find(d => d.name === src.name);
        if (dst) inner.target[p] = dst.id;
    }
}
export function pathData(points, closed, contours) {
    if (!points?.length) return '';
    const f = v => Math.round(v * 1000) / 1000;
    let s = `M${f(points[0].x)} ${f(points[0].y)}`;
    const seg = (a, b) => (a.out || b.in) ? ` C${f(a.out?.x ?? a.x)} ${f(a.out?.y ?? a.y)} ${f(b.in?.x ?? b.x)} ${f(b.in?.y ?? b.y)} ${f(b.x)} ${f(b.y)}` : ` L${f(b.x)} ${f(b.y)}`;
    for (let i = 1; i < points.length; i++) s += seg(points[i - 1], points[i]);
    if (closed) s += seg(points.at(-1), points[0]) + 'Z';
    for (const c of contours || []) {
        const cp = c.points || [];
        if (!cp.length) continue;
        s += `M${f(cp[0].x)} ${f(cp[0].y)}`;
        for (let i = 1; i < cp.length; i++) s += seg(cp[i - 1], cp[i]);
        if (c.closed !== false) s += seg(cp.at(-1), cp[0]) + 'Z';
    }
    return s;
}
const dashOf = n => n.strokeStyle === 'dash' ? [n.strokeDash ?? 10, n.strokeGap ?? 10] : n.strokeStyle === 'dot' ? [.01, Math.max(2, (n.strokeWidth || 1) * 2)] : null;
function lineOfPath(n, parent, off) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${Math.max(.001, n.w || 0)} ${Math.max(.001, n.h || 0)}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    Object.assign(svg.style, { ...placed(n, off), overflow: 'visible', opacity: n.opacity ?? 1 });
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', `M0 0L${Math.round((n.w || 0) * 1000) / 1000} ${Math.round((n.h || 0) * 1000) / 1000}`);
    p.setAttribute('fill', 'none');
    if (n.strokeWidth && n.strokeVisible !== false) {
        p.setAttribute('stroke', rgba(n.stroke, n.strokeOpacity ?? 1));
        p.setAttribute('stroke-width', n.strokeWidth);
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        p.setAttribute('stroke-linecap', n.strokeCap || 'round');
        const dash = dashOf(n);
        if (dash) p.setAttribute('stroke-dasharray', dash.join(' '));
    }
    svg.appendChild(p);
    parent.appendChild(svg);
    return svg;
}
function svgOfPath(n, parent, style) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${n.pathW || n.w || 1} ${n.pathH || n.h || 1}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    Object.assign(svg.style, style, { overflow: 'visible' });
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', pathData(n.points, n.closed, n.contours));
    const f = fillsOf(n).find(x => x.type === 'solid');
    p.setAttribute('fill', f ? rgba(f.color, f.opacity ?? 1) : 'none');
    if (n.fillRule) p.setAttribute('fill-rule', n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
    strokeExtras(p, n);
    if (n.strokeWidth && n.strokeVisible !== false) {
        p.setAttribute('stroke', rgba(n.stroke, n.strokeOpacity ?? 1));
        p.setAttribute('stroke-width', n.strokeWidth);
        p.setAttribute('vector-effect', 'non-scaling-stroke');
    }
    svg.appendChild(p);
    parent.appendChild(svg);
    return svg;
}
function maskSvg(kidsOf, m) {
    const shape = n => {
        const at = `translate(${n.x} ${n.y})`;
        if (n.type === 'path') return `<path transform="${at} scale(${(n.w || 1) / (n.pathW || n.w || 1)} ${(n.h || 1) / (n.pathH || n.h || 1)})" d="${pathData(n.points, n.closed, n.contours)}" fill="#000" fill-rule="${n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}"/>`;
        if (n.type === 'ellipse') return `<ellipse transform="${at}" cx="${n.w / 2}" cy="${n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" fill="#000"/>`;
        if (n.type === 'rect') return `<rect transform="${at}" width="${n.w}" height="${n.h}" rx="${n.radius || 0}" fill="#000"/>`;
        return `<g transform="${at}">${(kidsOf.get(n.id) || []).map(shape).join('')}</g>`;
    };
    const body = m.type === 'frame' ? (kidsOf.get(m.id) || []).map(shape).join('') : shape({ ...m, x: 0, y: 0 });
    return `<svg xmlns="${SVG}" viewBox="0 0 ${m.w} ${m.h}" width="${m.w}" height="${m.h}">${body}</svg>`;
}
function strokeExtras(p, n) {
    if (!n.strokeWidth || n.strokeVisible === false) return;
    p.setAttribute('stroke-linecap', n.strokeCap || 'round');
    p.setAttribute('stroke-linejoin', n.strokeJoin || 'round');
    const dash = dashOf(n);
    if (dash) p.setAttribute('stroke-dasharray', dash.join(' '));
}
function textStyle(ctx, n) {
    const color = fillsOf(n).find(f => f.type === 'solid')?.color || n.fill || '#000';
    return {
        color: bound(ctx, n, 'fill', rgba(color, n.fillOpacity ?? 1)), fontFamily: `${n.fontFamily || 'Inter'}, sans-serif`, fontSize: px(n.fontSize),
        fontWeight: n.fontWeight, fontStyle: n.fontStyle === 'italic' ? 'italic' : 'normal', lineHeight: n.lineHeight, letterSpacing: px(n.letterSpacing),
        textAlign: n.textAlign || 'left', textDecoration: n.textDecoration && n.textDecoration !== 'none' ? n.textDecoration : '',
        textTransform: { upper: 'uppercase', lower: 'lowercase', title: 'capitalize' }[n.textCase] || '',
    };
}
const placed = (n, off) => {
    const s = { position: 'absolute', left: px(n.x + (off?.x || 0)), top: px(n.y + (off?.y || 0)), width: px(n.w), height: px(n.h), boxSizing: 'border-box' };
    if (n.rotation) s.transform = `rotate(${n.rotation}deg)`;
    return s;
};
const pick = (map, state) => {
    for (const s of stateChain(state))
        if (map?.[s] !== undefined) return map[s];
    return undefined;
};
export function resolveOpenTarget(ctx, action) {
    const placed = action?.overlayInstanceId ? ctx.node(action.overlayInstanceId) : null;
    if (placed && !placed.softDeleted) return placed;
    if (action?.targetComponentId) return ctx.componentTarget(action.targetComponentId, action.targetVariantId && ctx.node(action.targetVariantId));
    return (action && ctx.node(action.targetFrameId)) || null;
}

export function openLivePreview(ctx, host, { onExit } = {}) {
    // === FIX 1: full website mode ===
    const root = el('div', { position: 'fixed', inset: '0', zIndex: 350, background: '#ffffff', overflow: 'auto', display: 'block' }, host);
    root.className = 'live-preview';
    const stage = el('div', { position: 'relative', width: '100%', minHeight: '100%', transformOrigin: 'top center' }, root);
    const css = el('style', null, root);
    css.textContent = `.live-preview{${ctx.vars.map(v => `--${v.name}:${v.value}`).join(';')}} .live-preview input{font:inherit;border:0;border-radius:0;box-shadow:none;outline:0;background:transparent;appearance:none;-webkit-appearance:none} .live-preview input:hover,.live-preview input:focus,.live-preview input:focus-visible{border:0;outline:0;box-shadow:none} .live-preview input:-webkit-autofill{box-shadow:0 0 0 1000px transparent inset;-webkit-text-fill-color:currentColor;transition:background-color 9999s}`;
    css.textContent += `@keyframes mvt-pop{from{opacity:0;transform:scale(.96) translateY(6px)}}@keyframes mvt-fade{from{opacity:0}}::view-transition-old(root),::view-transition-new(root){animation-duration:var(--mvt-dur,180ms);animation-timing-function:var(--mvt-ease,cubic-bezier(0.2,0,0,1))}::view-transition-old(midas-stage),::view-transition-new(midas-stage){animation-duration:var(--mvt-dur,220ms);animation-timing-function:var(--mvt-ease,cubic-bezier(0.2,0,0,1))}html[data-mvt='slide-left']::view-transition-old(midas-stage){animation-name:mvt-old-left}html[data-mvt='slide-left']::view-transition-new(midas-stage){animation-name:mvt-new-left}html[data-mvt='slide-right']::view-transition-old(midas-stage){animation-name:mvt-old-right}html[data-mvt='slide-right']::view-transition-new(midas-stage){animation-name:mvt-new-right}html[data-mvt='slide-up']::view-transition-old(midas-stage){animation-name:mvt-old-up}html[data-mvt='slide-up']::view-transition-new(midas-stage){animation-name:mvt-new-up}html[data-mvt='slide-down']::view-transition-old(midas-stage){animation-name:mvt-old-down}html[data-mvt='slide-down']::view-transition-new(midas-stage){animation-name:mvt-new-down}html[data-mvt='fade-scale']::view-transition-old(midas-stage){animation-name:mvt-old-scale}html[data-mvt='fade-scale']::view-transition-new(midas-stage){animation-name:mvt-new-scale}@keyframes mvt-old-left{to{transform:translateX(-60px);opacity:0}}@keyframes mvt-new-left{from{transform:translateX(60px);opacity:0}}@keyframes mvt-old-right{to{transform:translateX(60px);opacity:0}}@keyframes mvt-new-right{from{transform:translateX(-60px);opacity:0}}@keyframes mvt-old-up{to{transform:translateY(-60px);opacity:0}}@keyframes mvt-new-up{from{transform:translateY(60px);opacity:0}}@keyframes mvt-old-down{to{transform:translateY(60px);opacity:0}}@keyframes mvt-new-down{from{transform:translateY(-60px);opacity:0}}@keyframes mvt-old-scale{to{transform:scale(.98);opacity:0}}@keyframes mvt-new-scale{from{transform:scale(.96);opacity:0}}`;
    const runtime = new Map();
    const varOver = new Map();
    const modeOver = new Map();
    const layers = [];
    let frameId = ctx.start, rendering = false;
    let lastFrame = null, navMotion = null;
    let byPointer = false, caretAtEnd = false;
    root.addEventListener('pointerdown', () => { byPointer = true; }, true);
    root.addEventListener('keydown', () => { byPointer = false; }, true);

    // === FIX 2: respect designer intended state ===
    const baseStateOf = n => ctx.canvasState?.(n) || n.state || (n.disabled ? 'disabled' : 'default');
    const stateOf = n => {
        const rt = runtime.get(n.id);
        if (rt?.state) return rt.state;
        return baseStateOf(n);
    };
    const effStateOf = n => {
        const r = runtime.get(n.id) || {};
        const st = stateOf(n);
        // empty hanya dihitung kalau runtime sudah ada value tracking
        const hasValue = r.hasOwnProperty('value');
        return effectiveState(st, { selected: r.selected, indeterminate: r.indeterminate, empty: hasValue ? !r.value : false });
    };
    const clickableOf = n => !!target(n) || normalizeInteractions(ctx.interactionsFor?.(n)).some(it => it.trigger === 'onClick');
    const target = n => {
        for (let c = n; c; c = ctx.node(c.parentId))
            if (c.prototypeTarget && ctx.node(c.prototypeTarget)) return c.prototypeTarget;
        return null;
    };
    const styleValue = sv => {
        if (!sv) return null;
        if (sv.variableId) {
            const raw = ctx.varValueOf?.(sv.variableId);
            const fallback = raw === undefined || raw === null ? '' : String(raw);
            const name = ctx.varName(sv.variableId);
            return { text: name ? `var(--${name}, ${fallback})` : fallback, raw: fallback, variableId: sv.variableId };
        }
        if (sv.value === undefined || sv.value === null || sv.value === '') return null;
        return { text: String(sv.value), raw: String(sv.value) };
    };
    const setFill = (c, value) => {
        if (Array.isArray(c.fills)) c.fills = c.fills.map((f, i) => (i === 0 ? { ...f, type: 'solid', color: value } : f));
        c.fill = value;
    };
    function applyMapping(c, mapping, st, props) {
        if (!mapping) return c;
        const over = overridesFor(mapping, st);
        const vars = { ...(c.vars || {}) };
        let touched = false;
        for (const [prop, sv] of Object.entries(over)) {
            if (props && !props.includes(prop)) continue;
            const v = styleValue(sv);
            if (!v) continue;
            touched = true;
            if (prop === 'fill') { setFill(c, v.text); delete vars.fill; }
            else if (prop === 'stroke') { c.stroke = v.text; delete vars.stroke; }
            else if (prop === 'radius') {
                if (v.variableId) { vars.radius = v.variableId; c.radius = Number(v.raw) || c.radius; }
                else { c.radius = Number(v.raw) || 0; delete vars.radius; }
            }
            else if (prop === 'opacity') c.opacity = Number(v.raw);
        }
        if (touched) c.vars = vars;
        return c;
    }
    const visualTarget = (inst, kind) => {
        for (const d of ctx.descendants(inst.id)) {
            if (d.visible === false) continue;
            if (kind === 'fill' && d.type !== 'text' && d.fill && d.fill !== 'none') return d.id;
            if (kind === 'stroke' && d.strokeWidth > 0 && d.stroke && d.stroke !== 'none') return d.id;
        }
        return null;
    };
    const fieldOf = (inst, ib) => {
        const id = ib?.typeable?.frameId;
        if (id) {
            const layer = ctx.node(id);
            if (layer) return { id, name: layer.name, width: layer.w };
        }
        return ctx.field(inst);
    };

    function buildScene(frame) {
        const nodes = [];
        let seq = 0;
        const emit = (n, parentId, o) => {
            const roles = o?.roles, err = !!o?.err;
            const forced = err && roles?.showHint && n.propBind?.visible === roles.showHint;
            if (n.visible === false && !forced) return;
            let base = o?.ov ? ctx.resolved(n, o.inst, o.ov) : n, kidsOf = n.id, inner = o, wire = null, toggle = null;
            if (n.isInstance) {
                const variants = ctx.variants(n), modes = ctx.modes(n), ib2 = ctx.inputFor?.(n), field = ctx.typeable(n) && (n.typeable === true || ib2?.typeable?.frameId || !clickableOf(n)) ? fieldOf(n, ib2) : null, st = effStateOf(n);
                // === FIX 2 continued: jangan swap kalau belum ada interaksi ===
                const rt = runtime.get(n.id);
                const designerState = baseStateOf(n);
                // kalau belum ada runtime, pakai varian designer apa adanya
                const src = rt ? pick(variants?.byState, st) : null;
                const swap = src && src !== variants.current;
                const texts = new Map(ctx.descendants(n.id).filter(x => x.type === 'text' && x.sourceId).map(x => [x.sourceId, x.text]));
                inner = { inst: n, swapped: !!swap, ov: pick(modes?.byState, st) || null, texts, field, roles: ctx.roles(n), err: !!runtime.get(n.id)?.error, input: ib2, state: st, mapping: ctx.mappingFor?.(n), target: {} };
                const ownFill = n.fill && n.fill !== 'none' && !Array.isArray(n.fills);
                const ownStroke = n.strokeWidth > 0 && n.stroke && n.stroke !== 'none';
                inner.target = { fill: ownFill ? null : visualTarget(n, 'fill'), stroke: ownStroke ? null : visualTarget(n, 'stroke') };
                inner.form = field ? inner : o?.form;
                if (swap) {
                    const v = ctx.node(src);
                    // === FIX 3: preserve auto-layout correctly ===
                    // jangan paksa w/h kalau parent adalah auto-layout dan child adalah hug/fill
                    const isFillH = n.layoutSizingH === 'fill';
                    const isFillV = n.layoutSizingV === 'fill';
                    const isHugH = n.layoutSizingH === 'hug';
                    const isHugV = n.layoutSizingV === 'hug';
                    base = { 
                        ...v, 
                        x: n.x, y: n.y, 
                        w: (isFillH || isHugH) ? v.w : n.w, 
                        h: (isFillV || isHugV) ? v.h : n.w,
                        layoutSizingH: n.layoutSizingH, 
                        layoutSizingV: n.layoutSizingV, 
                        layoutPositioning: n.layoutPositioning, 
                        name: n.name 
                    };
                    // keep important layout props from variant (edited in hidden canvas)
                    base.paddingTop = v.paddingTop ?? base.paddingTop;
                    base.paddingRight = v.paddingRight ?? base.paddingRight;
                    base.paddingBottom = v.paddingBottom ?? base.paddingBottom;
                    base.paddingLeft = v.paddingLeft ?? base.paddingLeft;
                    base.gap = v.gap ?? base.gap;
                    base.gapCross = v.gapCross ?? base.gapCross;
                    base.layout = v.layout ?? base.layout;
                    base.layoutMode = v.layoutMode ?? base.layoutMode;
                    kidsOf = src;
                }
                else if (inner.ov) base = ctx.resolved(n, n, inner.ov);
                wire = { inst: n, variants, modes, field };
                const form = o?.form, tg = form?.input?.typeable, ids = tg ? ctx.componentIdsOf(n) : [];
                if (tg && ids.some(id => id === tg.showIconId || id === tg.hideIconId)) {
                    toggle = form;
                    const want = runtime.get(form.inst.id)?.reveal ? tg.hideIconId : tg.showIconId;
                    const to = want && !ids.includes(want) ? ctx.componentTarget(want, ctx.node(ids[0])) : null;
                    if (to) {
                        base = pinBox(base);
                        retargetIconLayers(ctx, inner, to);
                        kidsOf = to.id;
                    }
                }
            }
            else if (n.prototypeTarget) wire = { inst: n };
            if (varOver.size || modeOver.size) base = ctx.overridden(base, varOver, modeOver);
            const c = { ...base, id: `s${seq++}`, parentId, visible: true, _wire: wire };
            if (toggle) c._toggle = toggle;
            if (c.vars) c.vars = { ...c.vars };
            if (n.isInstance && inner?.mapping) {
                const own = ['fill', 'stroke', 'radius', 'opacity'].filter(p => !inner.target?.[p]);
                applyMapping(c, inner.mapping, inner.state || 'default', own);
            }
            if (inner?.mapping) {
                for (const p of ['fill', 'stroke']) if (inner.target?.[p] === n.id) applyMapping(c, inner.mapping, inner.state || 'default', [p]);
                if (n.type === 'text') applyMapping(c, inner.mapping, inner.state || 'default', ['text']);
            }
            if (n.type === 'text') {
                if (o?.field && (n.id === o.field.id || (o.swapped && n.name === o.field.name))) c._field = o;
                c.text = (err && roles?.hintText && n.propBind?.text === roles.hintText ? (o?.inst?.errorMessage || 'This field is required') : null) ?? (o?.texts?.get(n.id) ?? n.text ?? '');
            }
            nodes.push(c);
            for (const k of ctx.kids(kidsOf)) emit(k, c.id, inner);
        };
        emit({ ...frame, x: 0, y: 0 }, null, null);
        ctx.layout(nodes);
        return nodes;
    }

    // ... rest of file unchanged, copy from your original live.js from here down ...
    // Untuk ringkas, fungsi renderScene, openLayer, etc pakai yang lama, tapi dengan buildScene baru di atas
    // dan root/stage baru di atas.
    // IMPORTANT: di openLayer, ganti jadi:
    // const target = resolveOpenTarget(ctx, action);
    // if (!target) return;
    // const scene = buildScene(target); // <-- re-layout biar edit di hidden canvas kelihatan
    // renderScene(scene, layerContainer);
    
    // stub to avoid breaking - kamu perlu merge sisa file lama kamu setelah baris ini
    return { close: () => root.remove() };
}
