// Live preview: a design frame as real DOM, so inputs can be typed in, buttons react to the pointer and the
// interactions of the Behavior tab work ("Go to page", dropdown, overlay, popover/tooltip).
// Layout is CSS: nodeToStyle (flexStyle.js) maps auto layout to flexbox (direction, gap, padding, alignment, wrap, Hug / Fill / Fixed)
// and the browser lays it out, on a copy of the frame with the current state applied (a hint that appears, a variant that swaps).
// Only layers that are not in an auto layout flow are placed by x / y.
// The editor supplies everything it knows through `ctx` (see liveContext in midas.js):
//   node kids descendants layout variants modes resolved typeable field roles varName vars frames start
//   mappingFor interactionsFor inputFor varValueOf
//
// State mapping (tab Behavior) dibaca di sini: setiap state nilai diambil dari variable collection, jadi tidak ada
// state hardcoded dari kit ui-standard.
import { nodeToStyle, layoutOrder, zIndexMap } from './flexStyle.js';
import { rowRuntimeKey } from '../engine/behavior.js';
import { filterOptions, hasValue, itemStates, pickOption, removeValue, slotIssues, activeAfterClick, toValue, valueText, validateSelection, createEvalCtx, formatValue, truthy, runActions, runInteraction, STATE_ACTION_IDS, requestDelay, resolveOutcome, scenariosOf, testCondition, validateInput, effectiveState, normalizeInteractions, normalizePlacement, overridesFor, placeOverlayPos, resolveMotion, stateChain, tableBehaviors, tableRoles, tableView, sortWrites, pageWrites, searchWrites, toggleRowWrites, selectPageWrites, rowCtxOf, cellBinds } from '../engine/behavior.js';

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

/** `var(--name, value)` when the property is bound to a variable, so the preview follows the variable. */
const bound = (ctx, n, prop, value) => {
    const name = !n.resolvedInMode && n.vars?.[prop] && ctx.varName(n.vars[prop]);
    return name ? `var(--${name}, ${value})` : value;
};

const radiusOf = (ctx, n) => n.type === 'ellipse' ? '50%' : Array.isArray(n.radii) && n.radii.length === 4 ? n.radii.map(px).join(' ') : n.radius ? bound(ctx, n, 'radius', px(n.radius)) : '';

/** Background, corner radius, shadow and opacity of a node as CSS (the stroke is drawn on top, see strokeOverlay). */
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

/** The stroke is drawn above the children (as on the canvas) by an overlay that never moves the content. */
function strokeOverlay(ctx, n, d) {
    const w = n.strokeSides === 'custom' ? [n.strokeT, n.strokeR, n.strokeB, n.strokeL].map(v => +v || 0) : Array(4).fill(+n.strokeWidth || 0);
    if (!n.strokeWidth || !w.some(Boolean) || n.type === 'text') return;
    const grow = { outside: Math.max(...w), center: Math.max(...w) / 2 }[n.strokeAlign] || 0;
    const o = el('div', { position: 'absolute', inset: px(-grow), boxSizing: 'border-box', pointerEvents: 'none', borderStyle: 'solid', borderWidth: w.map(px).join(' '),
        borderColor: bound(ctx, n, 'stroke', rgba(n.stroke, n.strokeOpacity ?? 1)), borderRadius: radiusOf(ctx, n) }, d);
    o.dataset.stroke = '1';
}

/** Slot ikon yang isinya ditukar tidak boleh ikut mengecil/membesar: sumbu yang hug dipatok fixed. */
export function pinBox(base) {
    const out = { ...base };
    if (out.layoutSizingH === 'hug') out.layoutSizingH = 'fixed';
    if (out.layoutSizingV === 'hug') out.layoutSizingV = 'fixed';
    return out;
}

/** State mapping yang menunjuk ke lapisan dalam ikon lama diarahkan ke lapisan senama di ikon baru. */
/**
 * Canvas parity for swapped icons (mis. eye password): vektor ikon mengikuti ukuran wrapper-nya.
 * Cermin constrainInstanceLayers kanvas: isi group selalu di-scale; di luar itu hanya sumbu
 * ber-constraint `scale` (position constraint lain digeser pakai delta); isi flow auto-layout
 * dibiarkan untuk layout engine.
 */
export function scaleIconChild(c, n, parentCopy, scale) {
    const { fx, fy, dx, dy } = scale || {};
    if (!parentCopy || !Number.isFinite(fx) || !Number.isFinite(fy)) return c;
    if (parentCopy.type === 'frame' && isAuto(parentCopy) && c.layoutPositioning !== 'absolute') return c;
    if (parentCopy.type === 'group' || parentCopy.booleanOp) { c.x *= fx; c.y *= fy; c.w *= fx; c.h *= fy; return c; }
    if (n.constraintH === 'scale') { c.x *= fx; c.w *= fx; }
    else if (n.constraintH === 'right') c.x += dx;
    else if (n.constraintH === 'center') c.x += dx / 2;
    else if (n.constraintH === 'stretch') c.w = Math.max(1, c.w + dx);
    if (n.constraintV === 'scale') { c.y *= fy; c.h *= fy; }
    else if (n.constraintV === 'bottom') c.y += dy;
    else if (n.constraintV === 'center') c.y += dy / 2;
    else if (n.constraintV === 'stretch') c.h = Math.max(1, c.h + dy);
    return c;
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

/** Dash array kanvas untuk sebuah node: pola `dash` / titik `dot`, selain itu garis utuh. */
const dashOf = n => n.strokeStyle === 'dash' ? [n.strokeDash ?? 10, n.strokeGap ?? 10] : n.strokeStyle === 'dot' ? [.01, Math.max(2, (n.strokeWidth || 1) * 2)] : null;

/** Garis (bisa diagonal, (0,0)-(w,h)) sebagai SVG seperti yang dilukis kanvas. */
function lineOfPath(n, parent, off, extra) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${Math.max(.001, n.w || 0)} ${Math.max(.001, n.h || 0)}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    Object.assign(svg.style, { ...nodeToStyle(n, n._pn, off), overflow: 'visible', opacity: n.opacity ?? 1, ...(extra || {}) });
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

/** A mask layer as an SVG string (its shapes in black), used as the CSS mask of the layers it clips. */
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

/** Ujung, sambungan, dan pola garis kanvas pada sebuah path SVG. */
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

/**
 * Posisi kumulatif tiap node relatif ke root scene (untuk Fixed: koordinat viewport).
 * Emit depth-first: parent selalu sebelum child, jadi satu pass cukup.
 */
export function sceneOrigins(nodes) {
    const out = new Map();
    for (const n of nodes || []) {
        const p = n.parentId ? out.get(n.parentId) : null;
        out.set(n.id, { x: (p?.x || 0) + (n.x || 0), y: (p?.y || 0) + (n.y || 0) });
    }
    return out;
}
/**
 * Gaya Scroll Behavior di preview: fixed = diam di viewport; sticky = menempel di tepi atas;
 * selebihnya null (scroll with parent). `scaled` (mode fit/actual): fixed di dalam stage
 * bertransformasi berperilaku seperti absolute.
 */
export function scrollPosStyle(c, origin, scaled, inFlow = false) {
    if (c?.scroll === 'fixed') {
        if (scaled) return { position: 'fixed' };
        const p = origin || { x: c.x || 0, y: c.y || 0 };
        return { position: 'fixed', left: px(p.x), top: px(p.y) };
    }
    if (c?.scroll === 'sticky' && inFlow) return { position: 'sticky', top: '0' };
    if (c?.scroll === 'sticky') return { position: 'sticky', top: '0', left: px(c.x || 0), marginTop: px(c.y || 0) };
    return null;
}
// What a state falls back to when the component has no look for it (typing → focused → default, …).
const pick = (map, state) => {
    for (const s of stateChain(state))
        if (map?.[s] !== undefined) return map[s];
    return undefined;
};


/**
 * Root preview sebagai full website (spec Phase 1): putih, block, selebar viewport.
 * Dikunci di satu helper supaya spec-nya ikut ketest.
 */
export function previewChrome(overflow) {
    const o = previewOverflow(overflow);
    return { position: 'fixed', inset: '0', zIndex: 350, background: '#fff', overflowX: o.x, overflowY: o.y, display: 'flex', width: '100%', minHeight: '100%' };
}

/**
 * Figma-style preview scaling: fill width / actual size (100%) / fit to screen.
 */
/**
 * Sumbu scroll viewport preview dari setting Overflow frame: horizontal / vertical / both / none.
 */
export function previewOverflow(overflow) {
    if (overflow === 'horizontal') return { x: 'auto', y: 'hidden' };
    if (overflow === 'vertical') return { x: 'hidden', y: 'auto' };
    if (overflow === 'both') return { x: 'auto', y: 'auto' };
    return { x: 'hidden', y: 'hidden' };
}
export function previewScale(mode, vw, vh, w, h) {
    if (mode === 'actual') return 1;
    if (mode === 'fit') return Math.min(vw / w, vh / h);
    return vw / w;
}

/** Preview tab di route sendiri: /preview/<file>?page=&preview=<frame>&scale=. Reload tetap di preview. */
export function previewUrl(fileId, pageId, frameId, scale) {
    const q = new URLSearchParams();
    if (pageId) q.set('page', pageId);
    if (frameId) q.set('preview', frameId);
    if (scale && scale !== 'fill') q.set('scale', scale);
    const s = q.toString();
    return `/preview/${encodeURIComponent(fileId)}${s ? `?${s}` : ''}`;
}

/**
 * What a variant swap draws on: the variant's own box and layout, except what the designer set
 * on the instance. Size is kept from the host only when that axis is not hug/fill; a hug/fill child
 * of an auto layout is re-measured by the layout engine, otherwise gaps and padding break.
 * An undefined host sizing/positioning never clobbers the variant's own value.
 */
/**
 * Root overlay (dropdown/overlay/popover) mengikuti persis ukuran kanvas: hug/fill dipatok
 * jadi fixed agar layout engine tidak menghitung ulang dari konten yang berbeda.
 * Frame utama dibiarkan apa adanya (di-hug/diisi seperti kanvas).
 */
/**
 * Mode Fill tanpa transform scale: root dilayout ulang seukuran viewport (wrapper mengikuti
 * device), sehingga frame mengisi container dan child fill melebar 100% lewat layout engine.
 */
export function fillRootBox(base, fillBox) {
    if (!fillBox || !(fillBox.w > 0) || !(fillBox.h > 0)) return base;
    return { ...base, w: fillBox.w, h: fillBox.h, layoutSizingH: 'fixed', layoutSizingV: 'fixed' };
}
export function overlayRootBase(frame, force, matchBox) {
    const base = { ...frame, x: 0, y: 0 };
    const out = (force || frame.isOverlay) ? pinBox(base) : base;
    if (matchBox?.w > 0) { out.w = matchBox.w; out.layoutSizingH = 'fixed'; }
    if (matchBox?.h > 0) { out.h = matchBox.h; out.layoutSizingV = 'fixed'; }
    return out;
}
export function swapBase(n, v) {
    const out = { ...v, x: n.x, y: n.y, name: n.name };
    if (n.layoutSizingH !== undefined) out.layoutSizingH = n.layoutSizingH;
    if (n.layoutSizingV !== undefined) out.layoutSizingV = n.layoutSizingV;
    if (n.layoutPositioning !== undefined) out.layoutPositioning = n.layoutPositioning;
    if (n.layoutSizingH !== 'hug' && n.layoutSizingH !== 'fill') out.w = n.w;
    if (n.layoutSizingV !== 'hug' && n.layoutSizingV !== 'fill') out.h = n.h;
    return out;
}

/**
 * What an open action (dropdown / overlay / popover) draws. The overlay instance the editor
 * placed on the canvas for it wins: that copy is edited directly, so it is what the designer
 * sees. Else the picked component / variant, else the legacy frame target. A placed copy that
 * was deleted falls back instead of drawing nothing.
 */
export function resolveOpenTarget(ctx, action) {
    const placed = action?.overlayInstanceId ? ctx.node(action.overlayInstanceId) : null;
    if (placed && !placed.softDeleted) return placed;
    if (action?.targetComponentId) return ctx.componentTarget(action.targetComponentId, action.targetVariantId && ctx.node(action.targetVariantId));
    return (action && ctx.node(action.targetFrameId)) || null;
}

export function openLivePreview(ctx, host, { onExit, onRefresh, surface = 'overlay', scale = 'fill' } = {}) {
    // The whole window: the editor's panels are covered; a small button opens the side menu (frames, exit).
    const root = el('div', previewChrome(ctx.node(ctx.start)?.overflow), host);
    root.className = 'live-preview';
    // Overlay portal (spec): layers live in a body-level container with pointer events off,
    // so clicks outside them fall through to the preview root that closes them.
    const portal = el('div', { position: 'fixed', inset: '0', zIndex: 360, pointerEvents: 'none' }, document.body);
    const stage = el('div', { position: 'relative', flex: 'none', transformOrigin: 'center center' }, root);
    const css = el('style', null, root);
    css.textContent = `.live-preview{${ctx.vars.map(v => `--${v.name}:${v.value}`).join(';')}} .live-preview input{font:inherit;border:0;border-radius:0;box-shadow:none;outline:0;background:transparent;appearance:none;-webkit-appearance:none} .live-preview input:hover,.live-preview input:focus,.live-preview input:focus-visible{border:0;outline:0;box-shadow:none} .live-preview input:-webkit-autofill{box-shadow:0 0 0 1000px transparent inset;-webkit-text-fill-color:currentColor;transition:background-color 9999s}`;
    css.textContent += `@keyframes mvt-pop{from{opacity:0;transform:scale(.96) translateY(6px)}}@keyframes mvt-fade{from{opacity:0}}::view-transition-old(root),::view-transition-new(root){animation-duration:var(--mvt-dur,180ms);animation-timing-function:var(--mvt-ease,cubic-bezier(0.2,0,0,1))}::view-transition-old(midas-stage),::view-transition-new(midas-stage){animation-duration:var(--mvt-dur,220ms);animation-timing-function:var(--mvt-ease,cubic-bezier(0.2,0,0,1))}html[data-mvt='slide-left']::view-transition-old(midas-stage){animation-name:mvt-old-left}html[data-mvt='slide-left']::view-transition-new(midas-stage){animation-name:mvt-new-left}html[data-mvt='slide-right']::view-transition-old(midas-stage){animation-name:mvt-old-right}html[data-mvt='slide-right']::view-transition-new(midas-stage){animation-name:mvt-new-right}html[data-mvt='slide-up']::view-transition-old(midas-stage){animation-name:mvt-old-up}html[data-mvt='slide-up']::view-transition-new(midas-stage){animation-name:mvt-new-up}html[data-mvt='slide-down']::view-transition-old(midas-stage){animation-name:mvt-old-down}html[data-mvt='slide-down']::view-transition-new(midas-stage){animation-name:mvt-new-down}html[data-mvt='fade-scale']::view-transition-old(midas-stage){animation-name:mvt-old-scale}html[data-mvt='fade-scale']::view-transition-new(midas-stage){animation-name:mvt-new-scale}@keyframes mvt-old-left{to{transform:translateX(-60px);opacity:0}}@keyframes mvt-new-left{from{transform:translateX(60px);opacity:0}}@keyframes mvt-old-right{to{transform:translateX(60px);opacity:0}}@keyframes mvt-new-right{from{transform:translateX(-60px);opacity:0}}@keyframes mvt-old-up{to{transform:translateY(-60px);opacity:0}}@keyframes mvt-new-up{from{transform:translateY(60px);opacity:0}}@keyframes mvt-old-down{to{transform:translateY(60px);opacity:0}}@keyframes mvt-new-down{from{transform:translateY(-60px);opacity:0}}@keyframes mvt-old-scale{to{transform:scale(.98);opacity:0}}@keyframes mvt-new-scale{from{transform:scale(.96);opacity:0}}`;
    css.textContent += '@keyframes mvt-load{from{transform:translateX(-100%)}to{transform:translateX(250%)}}';
    const runtime = new Map();            // instance id -> { state, value, error, selected, indeterminate, reveal, touched }
    let stateReady = false;               // the State panel exists (built after the menu)
    let controlsReady = false;            // the variables panel exists (it is built after the menu)
    const varOver = new Map();            // variable id -> the value Set variable gave it (older files; kept while the preview is open)
    // State (Variables → State): the values bindings read. Fresh on every open; Reset, Restart and leaving a page put them back.
    let evalCtx = createEvalCtx(ctx.state);
    const modeOver = new Map();           // collection id -> the mode Set variable switched it to (kept while the preview is open)
    const layers = [];                   // dropdown / overlay / popover yang sedang terbuka
    let frameId = ctx.start, rendering = false;
    let scaleMode = scale;
    let lastFrame = null, navMotion = null;
    // Set by a Change variant action just before it redraws: how the next drawing should animate from the one on screen.
    let pendingSmart = null;
    // How the last focus arrived: a click on a field means "selected, ready to type"; Tab means "focused".
    let byPointer = false, caretAtEnd = false;
    // Pressing another field blurs the current one, which redraws the scene and replaces the pressed input before the browser
    // can focus it. Remember it so the redrawn copy takes focus at once, like a real page (no second click needed).
    let pendingField = null;
    root.addEventListener('pointerdown', ev => {
        byPointer = true;
        const f = ev.target?.dataset?.field;
        pendingField = f && ev.target !== document.activeElement ? f : null;
    }, true);
    root.addEventListener('pointerup', () => { setTimeout(() => { pendingField = null; }, 0); }, true);
    root.addEventListener('keydown', () => { byPointer = false; }, true);

    // What the canvas shows for the layer: the state its variable mode points at (Design), else default.
    // An Option state bound to a layer's look (Behavior → Bind to State) decides its state; else what the canvas shows.
    const boundModeOf = n => { const id = ctx.stateBindFor?.(n)?.self?.mode, v = id && evalCtx.get(id); return typeof v === 'string' && v ? v.toLowerCase() : null; };
    const baseStateOf = n => boundModeOf(n) || ctx.canvasState?.(n) || (n.disabled ? 'disabled' : 'default');
    // A look bound to an Option state wins over the plain "default" a pointer leaves behind, and a bound "disabled" ignores hover / press.
    const stateOf = n => {
        const rs = runtime.get(rowRuntimeKey(n.id, n.__row))?.state, bound = boundModeOf(n);
        if (bound && (!rs || rs === 'default' || bound === 'disabled')) return bound;
        return rs || baseStateOf(n);
    };
    // What is drawn is the base state plus what stays with the layer: checked / current, indeterminate, an empty value.
    const effStateOf = n => {
        const r = runtime.get(rowRuntimeKey(n.id, n.__row)) || {};
        const st = stateOf(n);
        // empty hanya dihitung kalau runtime sudah ada value tracking (sudah diketik / di-blur)
        const hasValue = Object.hasOwn(r, 'value');
        return effectiveState(st, { selected: r.selected, indeterminate: r.indeterminate, empty: hasValue ? !r.value : false });
    };
    /** A layer that does something when clicked (a page to go to, or a click interaction) shows the pointer, not the text cursor. */
    const clickableOf = n => !!target(n) || normalizeInteractions(ctx.interactionsFor?.(n)).some(it => it.trigger === 'onClick');
    const target = n => {
        for (let c = n; c; c = ctx.node(c.parentId))
            if (c.prototypeTarget && ctx.node(c.prototypeTarget)) return c.prototypeTarget;
        return null;
    };

    /** Nilai gaya dari state mapping: variable → var(--name) bila bisa, selain itu nilainya sendiri. */
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
    /** Isi fill pada sebuah salinan layer (array fills ikut di-copy, jangan mengubah dokumen). */
    const setFill = (c, value) => {
        if (Array.isArray(c.fills)) c.fills = c.fills.map((f, i) => (i === 0 ? { ...f, type: 'solid', color: value } : f));
        c.fill = value;
    };
    /** State mapping (variable driven) pada salinan layer: isi, garis, radius, opasitas, warna teks. */
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
    /**
     * Lapisan yang membawa tampilan sebuah komponen: kalau instance-nya sendiri tidak punya isi / garis,
     * warna state dipakai pada lapisan pertama di dalamnya yang punya (mis. kotak input pada TextField).
     */
    const visualTarget = (inst, kind) => {
        for (const d of ctx.descendants(inst.id)) {
            if (d.visible === false) continue;
            if (kind === 'fill' && d.type !== 'text' && d.fill && d.fill !== 'none') return d.id;
            if (kind === 'stroke' && d.strokeWidth > 0 && d.stroke && d.stroke !== 'none') return d.id;
        }
        return null;
    };
    /** Layer yang menerima ketikan: dari input behavior, atau tebakan lama. */
    const fieldOf = (inst, ib) => {
        const id = ib?.typeable?.frameId;
        if (id) {
            const layer = ctx.node(id);
            if (layer) return { id, name: layer.name, width: layer.w };
        }
        return ctx.field(inst);
    };
    const requiredOf = (inst, ib) => !ib?.validation?.off && !!(ib?.validation?.required || ib?.validation?.rules?.required || inst?.required);
    /** The Ant style rules of Has validation (none while it is turned off). */
    const rulesOf = ib => (ib?.validation?.off ? {} : { ...(ib?.validation?.rules || {}) });

    /** A copy of the frame with the current state applied, laid out by the editor's engine. */
    function buildScene(frame, pinRoot, fillBox, matchBox, extra) {
        const nodes = [];
        tablesNow.clear();
        let seq = 0;
        const copies = new Map(), keyUse = new Map();
        // o: the instance being copied, with the variant to borrow looks from, the variable modes to read in and the texts to carry over.
        const emit = (n, parentId, o) => {
            // A layer inside a repeated row carries its row key: its runtime state (hover, selected…) is kept per row.
            if (o?.rowKey !== undefined && n.isInstance) n = { ...n, __row: o.rowKey };
            const roles = o?.roles, err = !!o?.err;
            const forced = err && roles?.showHint && n.propBind?.visible === roles.showHint;
            // A boolean property a variable changed in Preview shows or hides its layer.
            // A layer bound to a List field (Behavior → Repeat) reads its value from the row being drawn.
            const rb = o?.row && o.rowBind ? (o.rowBind[n.id] || (n.sourceId && o.rowBind[n.sourceId])) : null;
            // State bindings: this layer's own "visible when", and the ones its container set for it.
            // Slots: the layers of a Select (value, placeholder, chip, remove…), of the popup it opens (item, empty, search) and of a feedback component.
            const sel = o?.sel, pop = o?.pop, fbx = o?.fb;
            const tbRole = o?.tbl && (o.tbl.roles.get(n.id) || (n.sourceId && o.tbl.roles.get(n.sourceId)) || null);
            const selRole = o?.slotMap && (o.slotMap[n.id] || (n.sourceId && o.slotMap[n.sourceId]));
            const popRole = pop?.roles?.[n.id], fbRole = fbx?.roles?.[n.id];
            const slotShown = selRole === 'value' ? hasValue(sel?.value) : selRole === 'placeholder' ? !hasValue(sel?.value) : selRole === 'spinner' ? !!o.loading : popRole === 'empty' ? pop.rows.length === 0 : tbRole === 'empty' ? tblEmptyShown(o.tbl, false) : tbRole === 'emptySearch' ? tblEmptyShown(o.tbl, true) : tbRole === 'loading' ? !!o.tbl.m.loading : (fbx?.hide?.has(n.id) ? false : null);
            const sbOwn = ctx.stateBindFor?.(n)?.self, sbLayer = o?.stateLayers && (o.stateLayers[n.id] || (n.sourceId && o.stateLayers[n.sourceId]));
            const stVis = [sbOwn?.visible, sbLayer?.visible].filter(Boolean).map(id => truthy(evalCtx.get(id)))
                .concat([sbOwn?.when, sbLayer?.when].filter(Boolean).map(w => { const r = testCondition(w, evalCtx.env({ fieldValid: fieldValidity })); return r.ok && r.value; }));
            const shown = stVis.length ? stVis.every(Boolean) : rb?.visible && o.row[rb.visible] !== undefined ? !!o.row[rb.visible] : o?.cOver && n.propBind?.visible && o.cOver.has(n.propBind.visible) ? o.cOver.get(n.propBind.visible) : null;
            const vis = slotShown ?? shown;
            if (vis === false || (vis === null && n.visible === false && !forced)) return;
            let base = o?.ov ? ctx.resolved(n, o.inst, o.ov) : n, kidsOf = n.id, inner = o?.tabItem ? { ...o, tabItem: undefined } : o, wire = null, toggle = null;
            if (n.isInstance) {
                // The variant a Change variant action picked wins; else the one a variable Preview changed.
                const picked = runtime.get(rowRuntimeKey(n.id, n.__row))?.variant;
                const vv = (picked && ctx.variantByProps?.(n, picked)) || ((varOver.size || modeOver.size) ? ctx.variantFor?.(n, varOver, modeOver) : null);
                const variants = ctx.variants(n, vv), modes = ctx.modes(n), ib2 = ctx.inputFor?.(n), field = ctx.typeable(n) && (n.typeable === true || ib2?.typeable?.frameId || !clickableOf(n)) ? fieldOf(n, ib2) : null, forced = tabForced(o) ?? tblForced(tbRole, o), st = forced ?? (o?.rowRoot === n.id && o.row?.__state ? o.row.__state : effStateOf(n));
                // Kanvas menggambar varian pilihan desainer apa adanya; preview hanya menukar varian kalau ada
                // interaksi yang mengubah state (hover, tekan, pilih…). Tanpa sentuhan, varian yang sekarang dipertahankan:
                // instance yang didesain sebagai Disabled tidak dibalikkan ke Default.
                const rt = runtime.get(rowRuntimeKey(n.id, n.__row)) || (forced ? {} : null);
                const freshSt = effectiveState(baseStateOf(n), { empty: false });
                const src = (!rt || st === freshSt ? null : pick(variants?.byState, st)) || vv;
                const swap = src && (vv || src !== variants.current);
                const texts = new Map(ctx.descendants(n.id).filter(x => x.type === 'text' && x.sourceId).map(x => [x.sourceId, x.text]));
                inner = { inst: n, rowKey: o?.rowKey, swapped: !!swap, ov: pick(modes?.byState, st) || null, texts, field, roles: ctx.roles(n), err: !!runtime.get(rowRuntimeKey(n.id, n.__row))?.error, input: ib2, state: st, mapping: ctx.mappingFor?.(n), target: {}, row: o?.row, rowBind: o?.rowBind, rowBindNames: o?.rowBindNames, rowRoot: o?.rowRoot, rowIndex: o?.rowIndex, stateLayers: o?.stateLayers, pop: o?.pop, sel: o?.sel, slotMap: o?.slotMap, fb: o?.fb, loading: o?.loading, tbl: o?.tbl, tabs: o?.tabs, rowCtx: o?.rowCtx, rowKind: o?.rowKind, cOver: (varOver.size || modeOver.size) ? ctx.cpropOverrides?.(n, varOver, modeOver) : null };
                // Warna state dipakai lapisan yang benar-benar membawa tampilan komponen.
                const ownFill = n.fill && n.fill !== 'none' && !Array.isArray(n.fills);
                const ownStroke = n.strokeWidth > 0 && n.stroke && n.stroke !== 'none';
                inner.target = { fill: ownFill ? null : visualTarget(n, 'fill'), stroke: ownStroke ? null : visualTarget(n, 'stroke') };
                inner.form = field ? inner : o?.form;      // the typeable field this instance sits in, however deep
                // Behaviors with slots: a Select hands its value to the layers mapped to it; Has loading shows its icon while it loads.
                const bsl = ctx.behaviorsFor?.(n) || [], hb = bsl.find(b => b.kind === 'has-options' && b.enabled), lb = bsl.find(b => b.kind === 'has-loading' && b.enabled && b.slots.icon);
                const tby = tableBehaviors(bsl);
                if (tby) inner.tbl = tableInfo(n, tby);
                const tabB = bsl.find(b => b.kind === 'has-tabs' && b.enabled);
                if (tabB) inner.tabs = tabsInfo(n, tabB);
                if (hb) { inner.sel = selectInfo(n, hb); inner.slotMap = { ...(inner.slotMap || {}), ...slotMapOf(hb) }; }
                if (lb) { inner.slotMap = { ...(inner.slotMap || {}), ...slotMapOf({ slots: { spinner: lb.slots.icon } }) }; inner.loading = runtime.get(rowRuntimeKey(n.id, n.__row))?.state === 'loading'; }
                if (swap) {
                    const v = ctx.node(src);
                    base = swapBase(n, v);
                    kidsOf = src;
                }
                else if (inner.ov) base = ctx.resolved(n, n, inner.ov);
                wire = o?.rowRoot === n.id ? null : { inst: n, variants, modes, field, rowCtx: o?.rowCtx };        // a row of a popup is not an instance that reacts on its own
                // The icon of a password field is an instance of one of the two icon components picked in the Behavior tab:
                // it is drawn as the one that matches whether the text is shown, and clicking it flips that.
                // Hanya isi ikon yang ditukar: wrapper keeps its own box, colors and layout, lalu dipatok
                // agar sumbu hug tidak ikut mengecil/membesar mengikuti isi baru.
                const form = o?.form, tg = form?.input?.typeable, ids = tg ? ctx.componentIdsOf(n) : [];
                if (tg && ids.some(id => id === tg.showIconId || id === tg.hideIconId)) {
                    toggle = form;
                    const want = runtime.get(rowRuntimeKey(form.inst.id, form.inst.__row))?.reveal ? tg.hideIconId : tg.showIconId;
                    const to = want && !ids.includes(want) ? ctx.componentTarget(want, ctx.node(ids[0])) : null;
                    if (to) {
                        base = pinBox(base);
                        retargetIconLayers(ctx, inner, to);
                        kidsOf = to.id;
                        // Ikon mengikuti wrapper-nya: scale dari rasio wrapper vs master (paritas kanvas).
                        const isx = base.w / (to.w || 1), isy = base.h / (to.h || 1);
                        if (isx !== 1 || isy !== 1) inner.iconScale = { fx: isx, fy: isy, dx: base.w - (to.w || 0), dy: base.h - (to.h || 0) };
                    }
                }
            }
            else if (n.prototypeTarget) wire = { inst: n };
            if (varOver.size || modeOver.size) base = ctx.overridden(base, varOver, modeOver);
            const c = { ...base, id: `s${seq++}`, parentId, visible: true, _wire: wire };
            // Smart animate matches layers across two drawings by their name path ("Button/Label"), repeated names by their order.
            const up = copies.get(parentId)?._key || '', nm = `${up}/${n.name || n.type}`, used = keyUse.get(nm) || 0;
            keyUse.set(nm, used + 1);
            c._key = used ? `${nm}#${used}` : nm;
            c._pn = copies.get(parentId) || null;
            c._src = n.id;
            if (o?.rowRoot === n.id && o.rowIndex !== undefined) c._row = o.rowIndex;
            if (o?.rowRoot === n.id && o.rowKind === 'row' && o.tbl) c._rowHover = { t: o.tbl.inst.id, i: o.rowIndex };
            if (popRole === 'search') c._search = true;
            if (selRole === 'remove' && o.row && sel) { const v = o.row.value; c._click = () => removePick(sel, v); }
            if (fbRole === 'close' || fbRole === 'cancel') c._click = () => fbx.close();
            if (fbRole === 'confirm') c._click = () => fbx.confirm();
            if (tbRole && o.tbl.m.ok) tblWire(c, tbRole, o);
            if (o?.tabItem && !o.tabItem.disabled) c._click = () => tabPick(o.tabItem);       // nodeToStyle needs the parent: Fill and positioning depend on it
            if (n.scroll) c.scroll = n.scroll;
            if (n.overflow) c.overflow = n.overflow;
            if (toggle) c._toggle = toggle;
            if (c.vars) c.vars = { ...c.vars };
            // State mapping: nilai state (hover / pressed / error …) dari variable collection.
            if (n.isInstance && inner?.mapping) {
                const own = ['fill', 'stroke', 'radius', 'opacity'].filter(p => !inner.target?.[p]);
                applyMapping(c, inner.mapping, inner.state || 'default', own);
            }
            if (inner?.mapping) {
                for (const p of ['fill', 'stroke']) if (inner.target?.[p] === n.id) applyMapping(c, inner.mapping, inner.state || 'default', [p]);
                if (n.type === 'text') applyMapping(c, inner.mapping, inner.state || 'default', ['text']);
            }
            if (rb?.fill && typeof o.row[rb.fill] === 'string' && n.type !== 'text') { setFill(c, o.row[rb.fill]); if (c.vars) { delete c.vars.fill; delete c.vars['fills.0']; } }
            if (n.type === 'text') {
                if (o?.field && (n.id === o.field.id || (o.swapped && n.name === o.field.name))) c._field = o;
                c.text = (err && roles?.hintText && n.propBind?.text === roles.hintText ? (o?.inst?.errorMessage || 'This field is required') : null) ?? (o?.cOver?.get(n.propBind?.text) ?? o?.texts?.get(n.id) ?? n.text ?? '');
            }
            if (o?.iconScale && parentId !== null) scaleIconChild(c, n, copies.get(parentId), o.iconScale);
            if (rb?.text && n.type === 'text' && o.row[rb.text] !== undefined) c.text = String(o.row[rb.text]);
            else if (n.type === 'text' && o?.row && !rb && o.rowBindNames?.[n.name] && o.row[o.rowBindNames[n.name]] !== undefined) c.text = String(o.row[o.rowBindNames[n.name]]);
            if ((selRole === 'value' || (selRole === 'both' && sel && hasValue(sel.value))) && n.type === 'text' && sel) c.text = valueText(sel.options, sel.value);
            if (n.type === 'text' && fbx?.texts && fbx.texts[n.id] !== undefined) c.text = fbx.texts[n.id];
            // Inside a table: {total}, {row.name}, {rowIndex} in a text are filled in; the page label and the sorted header say so.
            if (n.type === 'text' && o?.tbl) {
                const m = o.tbl.m;
                if (tbRole === 'pageLabel' && m.ok) c.text = c.text.includes('{') ? evalCtx.interpolate(c.text, o.rowCtx) : `Page ${m.page} of ${m.pages}`;
                else if (c.text.includes('{')) c.text = evalCtx.interpolate(c.text, o.rowCtx);
                const hk = tbRole && /^head(text)?:(.+)$/.exec(tbRole);
                if (hk && m.ok && m.sort.startsWith(hk[2] + ':')) c.text += m.sort.endsWith(':desc') ? ' ↓' : ' ↑';
            }
            // A text bound to State: the value itself, or (Text with {placeholders}) its own text with the names filled in.
            if (sbLayer?.text && n.type === 'text') {
                if (sbLayer.text === 'template') c.text = evalCtx.interpolate(c.text);
                else if (evalCtx.has(sbLayer.text)) c.text = formatValue(evalCtx.get(sbLayer.text));
            }
            nodes.push(c);
            copies.set(c.id, c);
            // A frame bound to a List repeats its first child once per row; the other children are drawn once after them.
            const sbSet = ctx.stateBindFor?.(n)?.layers;
            if (sbSet) inner = { ...(inner || {}), stateLayers: { ...(inner?.stateLayers || {}), ...sbSet } };
            const rep = ctx.repeatOf?.(n, evalCtx), kids = ctx.kids(kidsOf);
            if (rep && kids.length) {
                rep.rows.forEach((row, i) => emit(kids[0], c.id, { ...(inner || {}), row: { ...row, '#': i + 1 }, rowBind: rep.bind }));
                for (const k of kids.slice(1)) emit(k, c.id, inner);
            }
            else for (const k of kids) {
                const tRole = inner?.tbl && (inner.tbl.roles.get(k.id) || (k.sourceId && inner.tbl.roles.get(k.sourceId)));
                if (tRole === 'row' || tRole === 'pageItem') {
                    const T = inner.tbl, m = T.m;
                    if (!m.ok) continue;
                    if (tRole === 'row') {
                        if (m.loading) continue;                                    // the loading slot stands in for the rows
                        m.rows.forEach((row, i) => emit(k, c.id, { ...inner, row: { ...row, '#': m.rowOffset + i + 1, __state: tblRowState(T, row, i) }, rowBind: T.binds, rowCtx: rowCtxOf(m, row, i), rowRoot: k.id, rowIndex: i, rowKind: 'row', rowKey: String(row[m.idField]) }));
                    }
                    else if (m.flags.pagination) {
                        for (let p = 1; p <= Math.min(m.pages, 9); p++) emit(k, c.id, { ...inner, row: { label: String(p), '#': p, __page: p, __state: p === m.page ? 'selected' : undefined }, rowBind: { [T.textOf(k.id)]: { text: 'label' } }, rowRoot: k.id, rowIndex: p - 1, rowKind: 'page' });
                    }
                    continue;
                }
                // Has tabs: a layer of the tab bar is a tab (keyed by its name); a panel shows only while its tab is the active one.
                const tabRole = inner?.tabs?.roleOf(n);
                if (tabRole === 'tabBar') { emit(k, c.id, { ...inner, tabItem: { key: k.name.trim(), tabs: inner.tabs, keys: kids.map(x => x.name.trim()), disabledKeys: kids.filter(isTabDisabled).map(x => x.name.trim()), disabled: isTabDisabled(k) } }); continue; }
                if (tabRole === 'panelBox' && k.name.trim() !== inner.tabs.active) continue;
                const kRole = inner?.pop?.roles?.[k.id], sRole = inner?.slotMap && (inner.slotMap[k.id] || (k.sourceId && inner.slotMap[k.sourceId]));
                if (kRole === 'item') {
                    // The popup repeats its item once per option, each in the look of its state (default, hover, selected, disabled).
                    const p = inner.pop;
                    p.rows.forEach((row, i) => emit(k, c.id, { ...inner, row: { ...row, '#': i + 1, __state: p.states[i] }, rowBind: p.labelId ? { [p.labelId]: { text: 'label' } } : {}, rowBindNames: p.labelName ? { [p.labelName]: 'label' } : undefined, rowRoot: k.id, rowIndex: i }));
                }
                else if (sRole === 'chip' && inner.sel) {
                    // A multiple Select draws one chip per pick (none when nothing is picked).
                    const s = inner.sel, txt = ctx.descendants(k.id).find(x => x.type === 'text');
                    if (s.mode === 'multiple') (Array.isArray(s.value) ? s.value : []).forEach((v, i) => emit(k, c.id, { ...inner, row: { label: s.options.find(x => x.value === String(v))?.label ?? String(v), value: String(v), '#': i + 1 }, rowBind: txt ? { [txt.id]: { text: 'label' } } : {}, rowBindNames: txt ? { [txt.name]: 'label' } : undefined, rowRoot: k.id, rowIndex: i }));
                }
                else emit(k, c.id, inner);
            }
        };
        emit(fillRootBox(overlayRootBase(frame, pinRoot, matchBox), fillBox), null, extra || null);
        return nodes;
    }

    function renderScene(nodes, container = stage) {
        const kidsOf = new Map();
        for (const c of nodes) {
            if (!kidsOf.has(c.parentId)) kidsOf.set(c.parentId, []);
            kidsOf.get(c.parentId).push(c);
        }
        const origins = sceneOrigins(nodes), scaled = !!stage.style.transform;
        // A layer that sits in an auto layout flow is placed by the browser, not by x / y.
        const inFlow = c => isAuto(c._pn) && c.layoutPositioning !== 'absolute';
        const toggleIn = k => k._toggle || (kidsOf.get(k.id) || []).map(toggleIn).find(Boolean);
        const draw = (c, parent, off) => {
            const e = drawNode(c, parent, off);
            if (e && c._key) e.dataset.sk = c._key;
            if (e && c._row !== undefined) e.dataset.row = c._row;
            if (e && c._search) e.dataset.search = '1';
            if (e && c._rowHover) { const h = c._rowHover; e.addEventListener('pointerenter', () => { const r = tableRun.get(h.t) || {}; if (r.hover !== h.i) { tableRun.set(h.t, { ...r, hover: h.i }); stateChanged(); } }); e.addEventListener('pointerleave', () => { const r = tableRun.get(h.t); if (r && r.hover === h.i) { tableRun.set(h.t, { ...r, hover: -1 }); stateChanged(); } }); }
            if (e && c._click) { e.style.cursor = 'pointer'; e.addEventListener('pointerup', ev => { ev.stopPropagation(); c._click(); }); }
            if (e && c._toggle) wireToggle(e, c._toggle.inst);
            return e;
        };
        const drawNode = (c, parent, off) => {
            if (c.type === 'text') return c._field ? renderField(c, parent, off, scrollPosStyle(c, origins.get(c.id), scaled, inFlow(c))) : textBox(c, parent, off, scrollPosStyle(c, origins.get(c.id), scaled, inFlow(c)));
            if (c.type === 'path') return svgOfPath(c, parent, { ...nodeToStyle(c, c._pn, off), opacity: c.opacity ?? 1, ...scrollPosStyle(c, origins.get(c.id), scaled, inFlow(c)) });
            if (c.type === 'line') return lineOfPath(c, parent, off, scrollPosStyle(c, origins.get(c.id), scaled, inFlow(c)));
            const d = el('div', { ...nodeToStyle(c, c._pn, off), ...(c.type === 'group' ? {} : paint(ctx, c)), ...scrollPosStyle(c, origins.get(c.id), scaled, inFlow(c)) }, parent);
            d.dataset.node = c._wire?.inst.id || c.id;
            if (c.type === 'frame' && (c.clip || c.overflow === 'none')) d.style.overflow = 'hidden';
            if (c._wire) attach(c._wire, d);
            // The DOM follows the flow (layoutOrder, same as the canvas); what covers what (paintOrder) is a z-index, so stacking never moves a child.
            const stored = kidsOf.get(c.id) || [], flow = layoutOrder(c, stored), zOf = zIndexMap(c, stored);
            // A visible mask clips the siblings after it (in layout order); they are drawn inside one wrapper that carries the mask.
            const maskOf = new Map();
            let active = null;
            for (const k of flow) {
                if (k.isMask) {
                    active = k;
                    // An icon drawn as a mask (or inside one) has no element of its own: the mask's parent takes the click.
                    const t = toggleIn(k);
                    if (t) wireToggle(d, t.inst);
                }
                else maskOf.set(k.id, active);
            }
            const wrappers = new Map();
            for (const k of flow) {
                if (k.isMask) continue;
                const m = maskOf.get(k.id);
                if (!m) { const e = draw(k, d, null); if (zOf.has(k.id) && e?.style) e.style.zIndex = String(zOf.get(k.id)); continue; }
                let w = wrappers.get(m.id);
                if (!w) {
                    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(maskSvg(kidsOf, m))}")`;
                    w = el('div', { position: 'absolute', left: px(m.x), top: px(m.y), width: px(m.w), height: px(m.h), overflow: 'hidden', maskImage: url, webkitMaskImage: url, maskSize: '100% 100%', webkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', webkitMaskRepeat: 'no-repeat' }, d);
                    wrappers.set(m.id, w);
                }
                draw(k, w, { x: -m.x, y: -m.y });
            }
            strokeOverlay(ctx, c, d);
            return d;
        };
        return draw(nodes[0], container, null);
    }

    /**
     * Clicking the icon flips the field between hidden and shown text without taking focus away from it. It listens to the
     * pointer-up: the press redraws the icon, so a plain click would be lost with the old element.
     */
    function wireToggle(e, inst) {
        e.style.cursor = 'pointer';
        e.addEventListener('mousedown', ev => ev.preventDefault());
        e.addEventListener('pointerup', () => update(inst, { reveal: !runtime.get(rowRuntimeKey(inst.id, inst.__row))?.reveal }));
    }

    function textBox(c, parent, off, extra) {
        const t = el('div', { ...nodeToStyle(c, c._pn, off), ...textStyle(ctx, c), display: 'flex', flexDirection: 'column', ...(extra || {}), justifyContent: { middle: 'center', bottom: 'flex-end' }[c.textAlignV] || 'flex-start' }, parent);
        t.textContent = c.text ?? '';
        return t;
    }

    /** The field's text is the placeholder: an input takes its place, wide enough for what is typed. */
    function renderField(c, parent, off, extra) {
        const o = c._field, inst = o.inst, cur = runtime.get(rowRuntimeKey(inst.id, inst.__row)) || {};
        const input = el('input', { ...nodeToStyle(c, c._pn, off), ...textStyle(ctx, c), width: px(Math.max(c.w, o.field.width)), ...(extra || {}), border: '0', borderRadius: '0', outline: '0', boxShadow: 'none', background: 'transparent', padding: '0', margin: '0', minWidth: '0', flexShrink: '1' }, parent);
        for (let p = parent, i = 0; p && i < 3 && p !== stage; p = p.parentElement, i++) p.style.overflow = 'visible';
        input.dataset.field = inst.id;
        input.placeholder = c.text ?? '';
        // A field bound to a State shows that State's value (an Edit prefills it that way); otherwise what was typed.
        const boundTo = o.input?.typeable?.bindTo;
        input.value = boundTo && evalCtx.has(boundTo) ? formatValue(evalCtx.get(boundTo)) : (cur.value || '');
        input.disabled = !!inst.disabled;
        // The type is the designer's choice (Behavior tab). Only a password hides its text, until its eye layer is clicked.
        const kind = o.input?.typeable?.inputType || 'text';
        input.type = kind === 'password' && !cur.reveal ? 'password' : 'text';
        if (kind === 'email') { input.inputMode = 'email'; input.autocomplete = 'email'; }
        if (kind === 'number') input.inputMode = 'decimal';
        if (clickableOf(inst)) input.style.cursor = 'pointer';
        const ph = `.live-preview [data-field="${inst.id}"]::placeholder{color:${rgba(fillsOf(c)[0]?.color || c.fill, .6)}}`;
        if (!css.textContent.includes(ph)) css.textContent += ph;
        const required = requiredOf(inst, o.input), when = o.input?.validation?.trigger || 'blur';
        // Wrong: required but emptied after it had text (or, strictly, empty at all), or text that does not fit the type.
        const wrong = (v, strict) => !validateInput({ inputType: kind, required, rules: rulesOf(o.input), label: inst.name }, v, { touched: !!runtime.get(rowRuntimeKey(inst.id, inst.__row))?.touched, strict }).valid;
        input.addEventListener('focus', () => {
            if (rendering || runtime.get(rowRuntimeKey(inst.id, inst.__row))?.state?.match(/^(focused|selected|typing)$/)) return;
            // Coming back to a field that has text: typing resumes after the last character.
            if (input.value) caretAtEnd = true;
            update(inst, { state: input.value ? 'typing' : byPointer ? 'selected' : 'focused', error: false });
        });
        input.addEventListener('input', () => {
            // A number field takes digits, a sign and one decimal point.
            if (kind === 'number') input.value = input.value.replace(/[^0-9.\-]/g, '').replace(/(\..*?)\./g, '$1');
            const was = runtime.get(rowRuntimeKey(inst.id, inst.__row)) || {};
            const bad = when === 'change' && wrong(input.value);
            runtime.set(rowRuntimeKey(inst.id, inst.__row), { ...was, value: input.value, error: bad, touched: was.touched || !!input.value });
            // What is typed goes to the bound State (a Number State takes a number).
            if (boundTo && evalCtx.has(boundTo)) { const v = evalCtx.kind(boundTo) === 'state' ? evalCtx.state.variables.find(x => x.id === boundTo) : null; if (v) evalCtx.set(boundTo, v.type === 'number' ? (Number.isFinite(+input.value) && input.value !== '' ? +input.value : 0) : input.value); }
            tblSearch(inst, input.value);
            const state = bad ? 'error' : 'typing';
            if (was.state !== state) update(inst, { state, error: bad });
            else if (bad && !!was.value !== !!input.value) draw();      // still an error, but now empty (or no longer): the look changes
        });
        input.addEventListener('blur', () => {
            if (rendering) return;
            // Leaving a required field that was never filled is not an error: it goes back to default. Emptying one that had text is.
            const bad = when === 'submit' ? !!runtime.get(rowRuntimeKey(inst.id, inst.__row))?.error && wrong(input.value, true) : wrong(input.value);
            update(inst, { state: bad ? 'error' : input.value ? 'filled' : 'default', error: bad, value: input.value });
            runTriggers(inst, 'onBlur', input);
        });
        // Enter submits: a field validated on submit is checked now, whatever else it has been through.
        input.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            const bad = when === 'submit' && wrong(input.value, true);
            update(inst, bad ? { state: 'error', error: true } : { error: false });
            // A search field searches on Enter; any other field submits.
            runTriggers(inst, kind === 'search' ? 'onSearch' : 'onSubmit', input);
            // Ant events: the field is finished valid, or not.
            if (kind !== 'search') runTriggers(inst, wrong(input.value, true) ? 'onFinishFailed' : 'onFinish', input);
        });
        input.addEventListener('change', () => runTriggers(inst, 'onChange', input));
        return input;
    }

    /** Jalankan action dari tab Behavior untuk sebuah instance. */
    function runTriggers(inst, trigger, anchor, rect, rowCtx) {
        for (const it of normalizeInteractions(ctx.interactionsFor?.(inst)))
            if (it.trigger === trigger) playInteraction(it, inst, anchor, rect, trigger, rowCtx);
    }
    /**
     * One interaction. Interactions made of the actions that existed before (no condition, no rules, no State actions) run at once,
     * in order, exactly as they always did; the others go through the shared runner (if → actions → rules, request waits).
     */
    function playInteraction(it, inst, anchor, rect, trigger, rowCtx) {
        const plain = !it.if && !it.rules && it.actions.every(a => !STATE_ACTION_IDS.has(a.type));
        if (plain) { for (const action of it.actions) runAction(action, inst, anchor, rect, trigger); return; }
        // A request in progress blocks a second click on the same thing, like a button that is loading.
        if (evalCtx.extra('loading') && it.actions.some(a => a.type === 'request')) return;
        runInteraction(it, hostFor(inst, anchor, rect, trigger, rowCtx)).catch(e => flash(e.message || 'Something went wrong in this interaction.'));
    }
    // ---- Tables (Has rows …): the rows of the page, headers that sort, page buttons, checkboxes, a search box ----
    const tableRun = new Map();          // table instance id → { hover, forceEmpty }
    const tablesNow = new Map();         // the tables of the scene being drawn: instance id → info
    /** What a table shows right now, and which layer plays which role (also under the layer a slot was made from). */
    function tableInfo(n, by) {
        const run = tableRun.get(n.id) || {};
        const m = tableView(by, evalCtx, { loading: !!evalCtx.extra('loading') && !!by['has-data-states']?.slots.loading, forceEmpty: !!run.forceEmpty });
        if (!m.ok) m.issues.forEach(msg => warnOnce(`tbl:${n.id}:${msg}`, `${n.name}: ${msg}`));
        const textOf = id => { const l = ctx.node(id); return !l || l.type === 'text' ? id : (ctx.descendants(id).find(x => x.type === 'text')?.id || id); };
        const roles = new Map();
        for (const [id, role] of tableRoles(by)) {
            roles.set(id, role);
            const src = ctx.node(id)?.sourceId;
            if (src) roles.set(src, role);
            if (role.startsWith('head:') && textOf(id) !== id) roles.set(textOf(id), 'headtext:' + role.slice(5));
        }
        const binds = {};
        if (m.ok) for (const [id, b] of Object.entries(cellBinds(m, textOf))) { binds[id] = b; const src = ctx.node(id)?.sourceId; if (src) binds[src] = b; }
        const T = { inst: n, m, by, roles, binds, textOf, hover: run.hover ?? -1 };
        tablesNow.set(n.id, T);
        return T;
    }
    /** Empty shows with no rows at all; No results with a search that finds nothing (Empty stands for both when No results is not mapped). */
    const tblEmptyShown = (T, search) => T.m.ok && !T.m.loading && (search ? T.m.empty === 'search' : T.m.empty === 'data' || (T.m.empty === 'search' && !T.by['has-data-states']?.slots.emptySearch));
    /** The state a checkbox or a page number is drawn in, whatever its own runtime says. */
    function tblForced(role, o) {
        if (!role || !o?.tbl?.m.ok) return null;
        if (role === 'selectRow') return o.rowCtx?.isSelected ? 'selected' : 'default';
        if (role === 'selectAll') return { all: 'selected', some: 'indeterminate', none: 'default' }[o.tbl.m.pageState];
        return null;
    }
    // ---- Tabs (Has tabs): a tab bar and the panels; the active tab is a State, and a click on a tab makes it the active one ----
    /** The tabs of an instance: the layers mapped to Tab and Panel, and the State that holds the active tab. Null (and says why) while not set up. */
    function tabsInfo(n, b) {
        const why = slotIssues(b, id => !!ctx.node(id))[0];
        if (why || !evalCtx.has(b.config.state)) { warnOnce('tabs:' + n.id, n.name + ': ' + (why ? why.why : 'The tab State is gone.') + ' The tabs do not run until it is set up.'); return null; }
        const roles = new Map([[b.slots.tab, 'tabBar'], [b.slots.panel, 'panelBox']]);
        return { inst: n, b, active: String(evalCtx.get(b.config.state) ?? ''), roleOf: node => roles.get(node.id) || (node.sourceId && roles.get(node.sourceId)) || null };
    }
    /** A tab is disabled when its layer is (the disabled flag, or a disabled look): it ignores clicks. */
    const isTabDisabled = x => !!x.disabled || baseStateOf(x) === 'disabled';
    /** The look of a tab: selected while it is the active one (its own look otherwise). */
    const tabForced = o => (o?.tabItem && o.tabItem.key === o.tabItem.tabs.active ? 'selected' : null);
    /** A click on a tab: it becomes the active one (not when it is disabled); On change runs when the tab changed. */
    function tabPick(item) {
        const T = item.tabs;
        const next = activeAfterClick(item.keys, T.active, item.key, item.disabledKeys);
        if (next === T.active) return;
        const r = evalCtx.set(T.b.config.state, next);
        if (!r.ok) { flash(T.inst.name + ': ' + r.error); return; }
        stateChanged();
        runTriggers(T.inst, 'onChange');
    }
    const tblRowState = (T, row, i) => (rowCtxOf(T.m, row, i).isSelected ? 'selected' : T.hover === i ? 'hover' : undefined);
    function tblApply(writes) {
        for (const w of writes) { const r = evalCtx.set(w.id, w.value); if (!r.ok) flash(r.error); }
        stateChanged();
    }
    function tblWire(c, role, o) {
        const m = o.tbl.m;
        if (/^head:/.test(role) && m.flags.sort) c._click = () => tblApply(sortWrites(m, role.slice(5)));
        else if (role === 'prev') c._click = () => tblApply(pageWrites(m, -1));
        else if (role === 'next') c._click = () => tblApply(pageWrites(m, 1));
        else if (role === 'selectAll') c._click = () => tblApply(selectPageWrites(m));
        else if (role === 'selectRow' && o.row) c._click = () => tblApply(toggleRowWrites(m, o.row));
        else if (role === 'pageItem' && o.row?.__page) c._click = () => tblApply(pageWrites(m, o.row.__page, false));
    }
    /** Typing in the search box of a table: the text goes to its State, back to page 1. */
    function tblSearch(inst, text) {
        for (const T of tablesNow.values()) {
            if (!T.m.ok || !T.m.flags.search) continue;
            for (let a = inst; a; a = ctx.node(a.parentId)) {
                if (T.roles.get(a.id) === 'search' || (a.sourceId && T.roles.get(a.sourceId) === 'search')) { tblApply(searchWrites(T.m, text)); return; }
            }
        }
    }
    // ---- Select (Has options + Opens popup): the value, the popup, picking, search, chips ----
    const selectInfo = (inst, hb) => ({ inst, b: hb, mode: hb.config.mode, options: hb.config.options, value: getSel(inst, hb) });
    /** { layer id: role } for the layers a behavior maps (the layer, and the layer it was made from, so a swapped look still finds it). */
    function slotMapOf(b) {
        const out = {};
        for (const [role, id] of Object.entries(b.slots || {})) {
            if (!id) continue;
            // value and placeholder on one layer: it shows the value when there is one, its own text (the placeholder) when there is not
            const role2 = out[id] && out[id] !== role && [out[id], role].sort().join() === 'placeholder,value' ? 'both' : role;
            out[id] = role2;
            const src = ctx.node(id)?.sourceId;
            if (src) out[src] = role2;
        }
        return out;
    }
    function getSel(inst, hb) { const bt = hb.config.bindTo; return toValue(hb.config.mode, bt && evalCtx.has(bt) ? evalCtx.get(bt) : runtime.get(rowRuntimeKey(inst.id, inst.__row))?.selection); }
    function setSel(inst, hb, v) {
        const bt = hb.config.bindTo;
        if (bt && evalCtx.has(bt)) { const r = evalCtx.set(bt, v); if (!r.ok) flash(`${inst.name}: ${r.error}`); }
        else runtime.set(rowRuntimeKey(inst.id, inst.__row), { ...(runtime.get(rowRuntimeKey(inst.id, inst.__row)) || {}), selection: v });
    }
    function selectValidity(inst, hb, strict) {
        const ib = ctx.inputFor?.(inst);
        return validateSelection({ ...rulesOf(ib), ...(requiredOf(inst, ib) ? { required: true } : {}) }, getSel(inst, hb), inst.name, { touched: true, strict });
    }
    /** Select validation: on a pick (Check on change) or when the popup closes (Check on blur). The result drives its error state. */
    function checkSelect(inst, hb, when) {
        const trig = ctx.inputFor?.(inst)?.validation?.trigger || 'blur';
        if (trig !== when) return;
        const r = selectValidity(inst, hb, false);
        update(inst, r.valid ? { error: false, ...(runtime.get(rowRuntimeKey(inst.id, inst.__row))?.state === 'error' ? { state: baseStateOf(inst) } : {}) } : { state: 'error', error: true });
    }
    function removePick(sel, value) {
        setSel(sel.inst, sel.b, removeValue(sel.mode, sel.value, value));
        checkSelect(sel.inst, sel.b, 'change');
        draw();
        runTriggers(sel.inst, 'onChange');
    }
    const selectBehaviors = inst => { const bs = ctx.behaviorsFor?.(inst) || []; return { hb: bs.find(b => b.kind === 'has-options' && b.enabled), ob: bs.find(b => b.kind === 'opens-popup' && b.enabled) }; };
    const warnedSlots = new Set();
    const warnOnce = (key, msg) => { if (warnedSlots.has(key)) return; warnedSlots.add(key); flash(msg); };
    /** Click on a Select: open its popup (a Dropdown Menu component), unless a slot it needs is missing: then it says which. */
    function openSelect(inst, anchor, rect) {
        const { hb, ob } = selectBehaviors(inst);
        if (!hb || !ob) return false;
        const missing = [...slotIssues(hb), ...slotIssues(ob)];
        if (missing.length) { flash(`${inst.name}: ${missing[0].why} The popup does not open until it is mapped.`); return true; }
        const frame = ctx.componentTarget?.(ob.slots.popup);
        if (!frame) { flash(`${inst.name}: the popup component is gone. Pick another one in Opens popup.`); return true; }
        const si = (ctx.behaviorsFor?.(frame) || []).find(b => b.kind === 'shows-items' && b.enabled);
        const sMissing = si ? slotIssues(si) : [{ why: 'It has no “Shows items” behavior.' }];
        if (sMissing.length) { flash(`“${frame.name}” cannot be a popup: ${sMissing[0].why} Add and map Shows items on that component.`); return true; }
        let query = '', hover = -1;
        const rowsNow = () => (hb.config.showSearch || si.slots.search ? filterOptions(hb.config.options, query) : hb.config.options);
        const popCtx = () => {
            const rows = rowsNow(), roles = {};
            roles[si.slots.item] = 'item';
            if (si.slots.search) roles[si.slots.search] = 'search';
            if (si.slots.empty) roles[si.slots.empty] = 'empty';
            return { roles, rows, states: itemStates(rows, getSel(inst, hb), hover), labelId: si.slots.label, labelName: ctx.node(si.slots.label)?.name, query };
        };
        const action = { type: 'open-dropdown', targetComponentId: ob.slots.popup, position: ob.config.placement, width: ob.config.matchWidth ? 'parent' : 'self' };
        const pickRow = (layer, i) => {
            const row = rowsNow()[i];
            if (!row) return;
            const r = pickOption(hb.config.mode, getSel(inst, hb), row);
            if (r.changed) { setSel(inst, hb, r.value); checkSelect(inst, hb, 'change'); draw(); runTriggers(inst, 'onChange'); }
            if (r.closes) closeLayer(layer); else if (r.changed) layer.refresh();
        };
        openLayer(action, anchor, rect, { inst, trigger: 'onClick' }, {
            pop: popCtx,
            onClose: () => checkSelect(inst, hb, 'blur'),
            after(layer, holder, again) {
                holder.querySelectorAll('[data-row]').forEach(e => {
                    const i = Number(e.dataset.row), row = rowsNow()[i];
                    if (!row) return;
                    e.style.cursor = row.disabled ? 'not-allowed' : 'pointer';
                    e.addEventListener('pointerenter', () => { if (hover !== i) { hover = i; layer.refresh(); } });
                    e.addEventListener('pointerup', () => pickRow(layer, i));
                });
                // The search slot: an input over it filters the options by label.
                let box = holder.querySelector('[data-search]');
                if (box && box.offsetWidth < 90 && box.parentElement && box.parentElement !== holder) box = box.parentElement;
                if (box) {
                    box.style.position = box.style.position || 'relative';
                    const input = el('input', { position: 'absolute', inset: '0', width: '100%', height: '100%', boxSizing: 'border-box', padding: '0 10px', border: '0', outline: '0', background: 'transparent', font: 'inherit', color: 'inherit', zIndex: 2 }, box);
                    input.value = query; input.placeholder = ''; input.setAttribute('aria-label', 'Search options');
                    input.addEventListener('input', () => { query = input.value; hover = -1; const at = input.selectionStart; layer.refresh(); const next = holder.querySelector('[data-search] input, input[aria-label="Search options"]'); next?.focus(); try { next?.setSelectionRange(at, at); } catch { /* not every input has a caret */ } });
                    if (again && query) queueMicrotask(() => { input.focus(); try { input.setSelectionRange(input.value.length, input.value.length); } catch { } });
                    else if (!again) queueMicrotask(() => input.focus());
                }
            },
        });
        return true;
    }
    // Inside a table row, $row.<field>, $rowIndex and $isSelected can be read, and {row.name} is filled in feedback texts.
    const hostFor = (inst, anchor, rect, trigger, rowCtx) => ({
        ev: rowCtx ? { ...evalCtx, interpolate: t => evalCtx.interpolate(t, rowCtx) } : evalCtx,
        env: () => evalCtx.env({ fieldValid: fieldValidity, row: rowCtx }),
        perform: a => runAction(a, inst, anchor, rect, trigger),
        feedback: f => showFeedback(f, inst, anchor, rect, trigger, rowCtx),
        validateField: id => checkField(id),
        request: a => simulateRequest(a, inst),
        changed: () => stateChanged(),
        warn: m => flash(m),
    });
    /** State or a loading flag changed: draw again, keep the State panel and the loading shield in step. */
    function stateChanged() { draw(); if (stateReady) { renderStateIfOpen(); } syncLoading(); }

    // ---- fields: validity as a condition, and "Check field" ----
    const typeableIn = () => [ctx.node(frameId), ...ctx.descendants(frameId)].filter(n => n && n.isInstance && (ctx.typeable(n) || selectBehaviors(n).hb));
    function fieldValidity(id) {
        const n = id && ctx.node(id);
        if (!n) return undefined;
        const { hb } = selectBehaviors(n);
        if (hb) return selectValidity(n, hb, true).valid;
        const ib = ctx.inputFor?.(n), r = runtime.get(id) || {};
        return validateInput({ inputType: ib?.typeable?.inputType || 'text', required: requiredOf(n, ib), rules: rulesOf(ib), label: n.name }, r.value ?? '', { touched: !!r.touched || !!r.value, strict: true }).valid;
    }
    /** Check one field (or every field of the screen) like a submit: an invalid one shows its error state. → all valid */
    function checkField(id) {
        let all = true;
        for (const n of id ? [ctx.node(id)].filter(Boolean) : typeableIn()) {
            const ok = fieldValidity(n.id), r = runtime.get(rowRuntimeKey(n.id, n.__row)) || {};
            if (!ok) all = false;
            update(n, ok ? { error: false, ...(r.state === 'error' ? { state: r.value ? 'filled' : 'default' } : {}) } : { state: 'error', error: true });
        }
        return all;
    }

    // ---- Simulated request: loading, then the active scenario ----
    let activeScenario = null, slow = false;
    function simulateRequest(a, inst) {
        const ms = requestDelay(a, slow);
        // A component with a loading mode (a Button with a loading state) switches to it while it waits; without one, clicks are just ignored.
        const loads = inst && ctx.modes?.(inst)?.byState?.loading && (ctx.behaviorsFor?.(inst) || []).every(b => b.kind !== 'has-loading' || b.enabled);
        if (loads) update(inst, { state: 'loading' });
        return new Promise(resolve => setTimeout(() => {
            if (loads) update(inst, { state: baseStateOf(inst) });
            resolve(resolveOutcome(ctx.state, activeScenario));
        }, ms));
    }
    const shield = el('div', { position: 'absolute', inset: '0', zIndex: 75, display: 'none', pointerEvents: 'auto', cursor: 'progress' }, root);
    const loadBar = el('div', { position: 'absolute', top: '0', left: '0', width: '40%', height: '3px', background: 'linear-gradient(90deg,#4f8cff,#8fb6ff)', zIndex: 76, display: 'none', animation: 'mvt-load 1s ease-in-out infinite' }, root);
    function syncLoading() { const on = !!evalCtx.extra('loading'); shield.style.display = on ? 'block' : 'none'; loadBar.style.display = on ? 'block' : 'none'; }

    // ---- Feedback: alert / message (toasts), modal, drawer, popconfirm ----
    const LEVEL_COLOR = { success: '#30A46C', error: '#E5484D', warning: '#F5A524', info: '#0091FF' };
    const LEVEL_MARK = { success: '\u2713', error: '\u00d7', warning: '!', info: 'i' };
    const feedbacks = [], stacks = {};
    const POS = { top: { top: '16px', left: '50%', transform: 'translateX(-50%)' }, 'top-right': { top: '16px', right: '16px' }, bottom: { bottom: '16px', left: '50%', transform: 'translateX(-50%)' }, center: { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }, right: { top: '16px', right: '16px' } };
    const stackFor = pos => stacks[pos] || (stacks[pos] = el('div', { position: 'absolute', zIndex: 82, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none', width: 'min(360px, calc(100% - 32px))', ...(POS[pos] || POS['top-right']) }, root));
    const cardStyle = lv => ({ ...chrome, position: 'relative', background: '#fff', color: '#16161a', borderRadius: '10px', boxShadow: '0 12px 36px rgba(0,0,0,.22)', borderLeft: `4px solid ${LEVEL_COLOR[lv] || LEVEL_COLOR.info}`, padding: '12px 14px', pointerEvents: 'auto', fontSize: '14px', lineHeight: '1.4' });
    const btnStyle = primary => ({ ...chrome, padding: '6px 14px', borderRadius: '8px', border: primary ? '0' : '1px solid #d5d5dc', background: primary ? '#16161a' : '#fff', color: primary ? '#fff' : '#16161a', cursor: 'pointer', fontSize: '13px' });
    function closeFeedback(fb) { const i = feedbacks.indexOf(fb); if (i < 0) return; feedbacks.splice(i, 1); fb.nodes.forEach(n => n.remove()); clearTimeout(fb.timer); fb.cleanup?.(); }
    function clearFeedback() { [...feedbacks].forEach(closeFeedback); }
    /** The small "built-in" mark on feedback Preview drew itself because no component of the file is set for it. */
    const builtinBadge = parent => { const b = el('span', { position: 'absolute', top: '3px', right: '6px', fontSize: '9px', lineHeight: '1', padding: '2px 5px', borderRadius: '999px', background: '#eceef2', color: '#6b7280', letterSpacing: '.02em', pointerEvents: 'none' }, parent); b.textContent = 'built-in'; b.dataset.builtin = '1'; };
    /** Feedback drawn by the file's own component (Convention → Feedback components): its message / title layers get the text, its type comes from a variant or a mode. */
    function showComponentFeedback(f, id, inst, anchor, rect, trigger, rowCtx) {
        const first = ctx.componentTarget?.(id);
        if (!first) { flash('The component for ' + f.kind + ' is gone: the built-in one is used.'); return null; }
        const b = (ctx.behaviorsFor?.(first) || []).find(x => x.kind === 'show-feedback' && x.enabled);
        const problem = b ? slotIssues(b)[0]?.why : 'It has no “Show feedback” behavior.';
        if (problem) { flash(`“${first.name}” cannot draw ${f.kind}: ${problem} The built-in one is used.`); return null; }
        const style = ctx.feedbackStyle?.(id, f.level, b.config.types) || { node: first, modes: {} };
        const fb = { nodes: [], timer: 0, blocking: !!f.blocking };
        const roles = {};
        for (const r of ['close', 'confirm', 'cancel']) if (b.slots[r]) roles[b.slots[r]] = r;
        const texts = { [b.slots.message]: f.message };
        const hide = new Set();
        if (b.slots.title) { texts[b.slots.title] = f.title || ''; if (!f.title) hide.add(b.slots.title); }
        const ctrl = { roles, texts, hide, close: () => closeFeedback(fb), confirm: () => { closeFeedback(fb); if (f.onConfirm?.length) runActions(f.onConfirm, hostFor(inst, anchor, rect, trigger, rowCtx)).catch(e => flash(e.message)); } };
        // The type (success / error…) is a mode of a collection: read in that mode while this scene is built.
        const kept = new Map();
        for (const [cid, mid] of Object.entries(style.modes || {})) { kept.set(cid, modeOver.get(cid)); modeOver.set(cid, mid); }
        let nodes;
        try { nodes = buildScene(style.node, false, null, null, { fb: ctrl }); }
        finally { for (const [cid, v] of kept) v === undefined ? modeOver.delete(cid) : modeOver.set(cid, v); }
        const backdrop = closable => { const x = el('div', { position: 'absolute', inset: '0', zIndex: 81, background: 'rgba(15,23,42,.45)', pointerEvents: 'auto' }, root); fb.nodes.push(x); if (closable) x.onclick = () => closeFeedback(fb); };
        const box = f.kind === 'alert' || f.kind === 'message' || f.kind === 'notification';
        if (!box || f.blocking) backdrop(!f.blocking && f.kind === 'modal');
        const holder = el('div', { pointerEvents: 'auto', position: box ? 'relative' : 'absolute', zIndex: 82 }, box ? stackFor(f.position) : root);
        const content = renderScene(nodes, holder);
        content.style.position = 'relative'; content.style.left = '0'; content.style.top = '0';
        if (f.kind === 'drawer') Object.assign(holder.style, { top: '0', right: '0' });
        else if (f.kind === 'modal') Object.assign(holder.style, { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' });
        else if (f.kind === 'popconfirm') { if (rect) Object.assign(holder.style, { left: px(Math.max(8, rect.left)), top: px(Math.max(8, rect.top - content.offsetHeight - 8)) }); else Object.assign(holder.style, { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }); }
        fb.nodes.push(holder);
        feedbacks.push(fb);
        if (f.duration > 0) fb.timer = setTimeout(() => closeFeedback(fb), f.duration);
        return fb;
    }
    function showFeedback(f, inst, anchor, rect, trigger, rowCtx) {
        const own = ctx.feedbackComponent?.(f.kind, f.componentId);
        if (own) { const done = showComponentFeedback(f, own, inst, anchor, rect, trigger, rowCtx); if (done) return done; }
        const fb = { nodes: [], timer: 0, blocking: !!f.blocking };
        const mark = (parent, lv) => { const m = el('span', { display: 'inline-grid', placeItems: 'center', width: '18px', height: '18px', borderRadius: '50%', background: LEVEL_COLOR[lv] || LEVEL_COLOR.info, color: '#fff', fontSize: '11px', fontWeight: 700, flex: 'none' }, parent); m.textContent = LEVEL_MARK[lv] || 'i'; return m; };
        const body = (card, lv) => {
            const head = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }, card);
            mark(head, lv);
            el('span', { flex: '1' }, head).textContent = f.title || (f.message && f.kind !== 'alert' && f.kind !== 'message' ? '' : f.message);
            if (f.title || !(f.kind === 'alert' || f.kind === 'message')) { if (f.message) el('div', { marginTop: '6px', opacity: f.title ? 0.8 : 1 }, card).textContent = f.message; }
            return head;
        };
        const backdrop = (closable) => { const b = el('div', { position: 'absolute', inset: '0', zIndex: 81, background: 'rgba(15,23,42,.45)', pointerEvents: 'auto' }, root); fb.nodes.push(b); if (closable) b.onclick = () => closeFeedback(fb); return b; };
        const confirmRun = () => { closeFeedback(fb); if (f.onConfirm?.length) runActions(f.onConfirm, hostFor(inst, anchor, rect, trigger, rowCtx)).catch(e => flash(e.message)); };
        if (f.kind === 'alert' || f.kind === 'message') {
            if (f.blocking) backdrop(false);
            const card = el('div', cardStyle(f.level), stackFor(f.position));
            if (f.kind === 'message') Object.assign(card.style, { borderLeft: '0', borderRadius: '999px', padding: '8px 16px' });
            const head = body(card, f.level);
            const x = el('button', { ...chrome, border: '0', background: 'transparent', cursor: 'pointer', fontSize: '16px', lineHeight: '1', color: '#666' }, head);
            x.textContent = '\u00d7'; x.setAttribute('aria-label', 'Close'); x.onclick = () => closeFeedback(fb);
            card.setAttribute('role', 'alert');
            builtinBadge(card);
            fb.nodes.push(card);
        }
        else if (f.kind === 'drawer') {
            backdrop(!f.blocking);
            const card = el('div', { ...cardStyle(f.level), position: 'absolute', zIndex: 82, top: '0', right: '0', bottom: '0', width: 'min(380px, 90%)', borderRadius: '0', borderLeft: '0', display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px' }, root);
            body(card, f.level);
            const foot = el('div', { marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '8px' }, card);
            const ok = el('button', btnStyle(true), foot); ok.textContent = f.confirmLabel || 'Close'; ok.onclick = () => closeFeedback(fb);
            card.setAttribute('role', 'dialog'); builtinBadge(card); fb.nodes.push(card);
        }
        else {
            // modal and popconfirm: a card the person has to answer
            backdrop(!f.blocking && f.kind === 'modal');
            const card = el('div', { ...cardStyle(f.level), position: 'absolute', zIndex: 82, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: f.kind === 'popconfirm' ? 'min(300px, 90%)' : 'min(420px, 90%)', borderLeft: '0', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }, root);
            if (f.kind === 'popconfirm' && rect) Object.assign(card.style, { left: px(Math.max(8, rect.left)), top: px(Math.max(8, rect.top - 120)), transform: 'none' });
            body(card, f.level);
            const foot = el('div', { display: 'flex', justifyContent: 'flex-end', gap: '8px' }, card);
            if (f.onConfirm?.length || f.kind === 'popconfirm') { const no = el('button', btnStyle(false), foot); no.textContent = 'Cancel'; no.onclick = () => closeFeedback(fb); }
            // A Popconfirm is answered in place: Esc and a click outside it are Cancel (nothing runs, the row stays).
            if (f.kind === 'popconfirm') {
                const away = e => { if (!card.contains(e.target)) closeFeedback(fb); };
                const esc = e => { if (e.key === 'Escape') closeFeedback(fb); };
                // attached on the next turn, so the click that opened it is not the one that closes it
                const t = setTimeout(() => { document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', esc, true); }, 0);
                fb.cleanup = () => { clearTimeout(t); document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', esc, true); };
            }
            const ok = el('button', btnStyle(true), foot); ok.textContent = f.confirmLabel || 'OK'; ok.onclick = confirmRun;
            card.setAttribute('role', f.kind === 'modal' ? 'dialog' : 'alertdialog'); card.setAttribute('aria-modal', 'true'); builtinBadge(card);
            fb.nodes.push(card);
        }
        feedbacks.push(fb);
        if (f.duration > 0) fb.timer = setTimeout(() => closeFeedback(fb), f.duration);
        return fb;
    }
    /** Something is misconfigured (a condition that cannot be read, a State action with no variable): say so, never skip silently. */
    function flash(msg) {
        const t = el('div', { ...chrome, position: 'absolute', zIndex: 90, left: '50%', bottom: '16px', transform: 'translateX(-50%)', background: 'rgba(24,24,24,.96)', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', maxWidth: '80%', pointerEvents: 'none' }, root);
        t.textContent = '\u26A0 ' + msg;
        setTimeout(() => t.remove(), 4200);
    }
    /** On page load: the interactions of the screen (and of what is on it) that wait for it. */
    function runLoadEvents(id) {
        const top = ctx.node(id);
        if (!top) return;
        for (const n of [top, ...ctx.descendants(id)])
            for (const it of normalizeInteractions(ctx.interactionsFor?.(n)))
                if (it.trigger === 'onLoad') playInteraction(it, n, null, null, 'onLoad');
    }
    /** Set variable: switch a collection to one of its modes (all its variables follow), or set one variable in older files. */
    function setVariable(action) {
        if (action.collectionId && action.modeId) {
            modeOver.set(action.collectionId, action.modeId);
            draw();
            return;
        }
        if (!action.variableId) return;
        const type = ctx.varType?.(action.variableId);
        let value = action.value;
        if (type === 'number') value = Number(value);
        else if (type === 'boolean') value = value === true || value === 'true';
        if (type === 'number' && !Number.isFinite(value)) return;
        varOver.set(action.variableId, value);
        draw();
    }
    /**
     * Change variant: the layer switches to the variant its picks name (Figma's "Change to"). What a hover or focus changed goes
     * back when the pointer leaves or focus is lost; a click stays until something else changes it. Smart animate tweens the layers
     * the two variants share.
     */
    function changeVariant(inst, action, trigger) {
        if (!action.variants || !Object.keys(action.variants).length) return;
        const cur = runtime.get(rowRuntimeKey(inst.id, inst.__row)) || {};
        const hold = /^(onHover|onMouseEnter|onFocus)$/.test(trigger) ? trigger : null;
        const next = { ...(cur.variant || {}), ...action.variants };
        // The redraw puts a new element under the pointer, which enters again: the same pick must not redraw forever.
        if (Object.entries(next).every(([k, v]) => cur.variant?.[k] === v)) return;
        runtime.set(rowRuntimeKey(inst.id, inst.__row), { ...cur, variant: next, variantBy: hold || null, variantMotion: resolveMotion(action, 'change-variant') });
        pendingSmart = runtime.get(rowRuntimeKey(inst.id, inst.__row)).variantMotion;
        draw();
    }
    /** Undo what a hover (pointer leaves) or a focus (focus is lost) changed with Change variant. */
    function revertVariant(inst, triggers) {
        const cur = runtime.get(rowRuntimeKey(inst.id, inst.__row));
        if (!cur?.variant || !triggers.includes(cur.variantBy)) return;
        const { variant, variantBy, ...rest } = cur;
        runtime.set(rowRuntimeKey(inst.id, inst.__row), rest);
        pendingSmart = cur.variantMotion || null;
        draw();
    }
    /** Set active / selected: the layer is checked / current; "only this one" switches the others of its kind off. */
    function setSelected(inst, mode) {
        const has = r => !!runtime.get(r.id)?.selected;
        runtime.set(rowRuntimeKey(inst.id, inst.__row), { ...(runtime.get(rowRuntimeKey(inst.id, inst.__row)) || {}), selected: mode === 'toggle' ? !has(inst) : true });
        if (mode === 'exclusive') {
            const mine = new Set(ctx.componentIdsOf(inst));
            for (const sib of ctx.kids(inst.parentId))
                if (sib.id !== inst.id && sib.isInstance && ctx.componentIdsOf(sib).some(id => mine.has(id)))
                    runtime.set(rowRuntimeKey(sib.id, sib.__row), { ...(runtime.get(rowRuntimeKey(sib.id, sib.__row)) || {}), selected: false });
        }
        draw();
    }
    function runAction(action, inst, anchor, rect, trigger) {
        if (!action) return;
        if (action.type === 'navigate') {
            if (action.targetFrameId && ctx.node(action.targetFrameId)) show(action.targetFrameId, resolveMotion(action, 'navigate'));
            return;
        }
        if (action.type === 'close-overlay') {
            // A modal / drawer of the file is closed by its own button: this action closes the newest feedback first (all of them with “All overlays”).
            if (action.close === 'all') clearFeedback();
            else if (feedbacks.length && !layers.length) { closeFeedback(feedbacks.at(-1)); return; }
            closeLayers(action.close === 'all' ? 'all' : 'current', resolveMotion(action, 'close-overlay'));
            return;
        }
        if (action.type === 'set-variable') return setVariable(action);
        if (action.type === 'set-selected') return setSelected(inst, action.mode);
        if (action.type === 'change-variant') return changeVariant(inst, action, trigger);
        if (action.type === 'open-dropdown' || action.type === 'open-overlay' || action.type === 'open-popover') openLayer(action, anchor, rect, { inst, trigger });
    }

    /** Buka sebuah frame sebagai dropdown / overlay / popover / tooltip. */
    function openLayer(action, anchor, rect, from, extra) {
        // The placed overlay instance wins (it is the edited copy on the canvas); else the picked component, else a legacy frame.
        const frame = resolveOpenTarget(ctx, action);
        if (!frame) return;
        const kind = action.type === 'open-dropdown' ? 'dropdown' : action.type === 'open-overlay' ? 'overlay' : 'popover';
        // The same trigger on the same layer: a hover that redraws its anchor must not stack copies; a click toggles it.
        const key = `${from?.inst?.id}|${action.type}|${action.targetComponentId || action.targetFrameId}`;
        const already = layers.findIndex(l => l.key === key);
        if (already >= 0) {
            if (!/^(onHover|onMouseEnter)$/.test(from?.trigger)) closeLayer(layers[already]);
            return;
        }
        // Overlay portal: layers render in a body-level portal with viewport coordinates (spec),
        // positioned from the trigger's live DOM rect via the canonical placer.
        const holder = el('div', { position: 'fixed', zIndex: 70, pointerEvents: 'auto' }, portal);
        let backdrop = null;
        // Posisi jangkar diambil sebelum scene digambar ulang (elemen lama sudah lepas dari DOM).
        const a = rect || anchor?.getBoundingClientRect?.();
        const matchBox = (kind === 'dropdown' && a) ? {
            w: action.width === 'parent' ? a.width : null,
            h: action.height === 'parent' ? a.height : null,
        } : null;
        const content = renderScene(buildScene(frame, !extra, null, matchBox, extra ? { pop: extra.pop() } : null), holder);
        content.style.position = 'relative';
        content.style.left = '0';
        content.style.top = '0';
        const w = content.offsetWidth, h = content.offsetHeight;
        const r = root.getBoundingClientRect();
        const place = (left, top) => { holder.style.left = px(Math.max(4, left)); holder.style.top = px(Math.max(4, top)); };
        if (kind === 'overlay') {
            if (action.backdrop !== false) {
                backdrop = el('div', { position: 'fixed', inset: '0', zIndex: 69, pointerEvents: 'auto', background: 'rgba(15,23,42,.45)' }, portal);
                if (action.closeOnBackdrop) backdrop.addEventListener('click', () => closeLayers('all'));
            }
            const vp = { x: 0, y: 0, w: r.width, h: r.height };
            const op = action.position ? placeOverlayPos(vp, w, h, action.position, action.offset) : { x: (vp.w - w) / 2, y: (vp.h - h) / 2 };
            place(op.x, op.y);
        }
        else if (a) {
            // Live DOM rect of the trigger; the canonical placer applies the {x, y} offset (spec).
            const dp = placeOverlayPos({ x: a.left, y: a.top, w: a.width, h: a.height }, w, h, normalizePlacement(action.position, kind === 'dropdown' ? 'bottom-start' : 'top'), action.offset);
            place(dp.x, dp.y);
        }
        const layer = { holder, backdrop, kind, key, anchor: a, motion: resolveMotion(action, action.type) };
        if (layer.motion.transition !== 'instant' && layer.motion.duration > 0 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            content.style.animation = `${layer.motion.transition === 'fade' ? 'mvt-fade' : 'mvt-pop'} ${layer.motion.duration}ms ${layer.motion.easingCss}`;
            if (backdrop) backdrop.style.animation = `mvt-fade ${layer.motion.duration}ms ${layer.motion.easingCss}`;
        }
        // A layer that opened on hover goes away when the pointer is no longer over what opened it or over the layer itself.
        if (/^(onHover|onMouseEnter)$/.test(from?.trigger) && a) {
            const near = (b, ev) => ev.clientX >= b.left - 4 && ev.clientX <= b.right + 4 && ev.clientY >= b.top - 4 && ev.clientY <= b.bottom + 4;
            const move = ev => {
                const h = holder.getBoundingClientRect();
                const bridge = { left: Math.min(a.left, h.left), right: Math.max(a.right, h.right), top: Math.min(a.top, h.top), bottom: Math.max(a.bottom, h.bottom) };
                if (!near(a, ev) && !near(h, ev) && !near(bridge, ev)) closeLayer(layer);
            };
            document.addEventListener('pointermove', move);
            document.addEventListener('pointerleave', () => closeLayer(layer), { once: true });
            layer.off = () => document.removeEventListener('pointermove', move);
        }
        if (extra) {
            // A Select popup draws again when a pick, a hover or the search changes: the same scene, a new drawing.
            layer.refresh = () => {
                holder.replaceChildren();
                const c2 = renderScene(buildScene(frame, false, null, matchBox, { pop: extra.pop() }), holder);
                c2.style.position = 'relative'; c2.style.left = '0'; c2.style.top = '0';
                extra.after?.(layer, holder, true);
            };
            layer.onClose = extra.onClose;
        }
        layers.push(layer);
        extra?.after?.(layer, holder, false);
        // On open / close: the layer that opened it hears about it.
        layer.owner = from?.inst || null;
        if (layer.owner) setTimeout(() => runTriggers(layer.owner, 'onOpenChange', anchor, rect), 0);
        return layer;
    }
    function closeLayer(layer, motion) {
        const i = layers.indexOf(layer);
        if (i < 0) return;
        layers.splice(i, 1);
        layer.off?.();
        layer.onClose?.();
        if (layer.owner && motion !== true) setTimeout(() => runTriggers(layer.owner, 'onOpenChange'), 0);
        const m = motion === true ? null : (motion || layer.motion || resolveMotion(null, 'close-overlay'));
        if (m && m.transition !== 'instant' && m.duration > 0 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
            for (const n of [layer.holder, layer.backdrop]) if (n) { n.style.transition = `opacity ${m.duration}ms ${m.easingCss}`; n.style.opacity = '0'; }
            setTimeout(() => { layer.holder.remove(); layer.backdrop?.remove(); }, m.duration + 40);
            return;
        }
        layer.holder.remove();
        layer.backdrop?.remove();
    }
    function closeLayers(scope, motion) {
        const kill = layer => closeLayer(layer, motion);
        if (scope === 'all') { [...layers].forEach(kill); return; }
        if (scope === 'current') { const last = layers[layers.length - 1]; if (last) kill(last); return; }
        for (let i = layers.length - 1; i >= 0; i--) if (layers[i].kind === scope) kill(layers[i]);
    }

    function attach({ inst: n, variants, modes, field, rowCtx: rc }, d) {
        const runTriggersIn = (inst, trig, a, r) => runTriggers(inst, trig, a, r, rc);
        if (n.disabled) { d.style.cursor = 'not-allowed'; return; }
        const go = target(n), has = s => !!(variants?.byState[s] || modes?.byState[s]);
        const clickable = clickableOf(n);
        const mapping = ctx.mappingFor?.(n);
        const hasState = s => has(s) || !!mapping?.[s];
        if (clickable) d.style.cursor = 'pointer';
        if (field) return;
        d.addEventListener('pointerenter', () => {
            const rect = d.getBoundingClientRect();
            hasState('hover') && update(n, { state: 'hover' });
            runTriggersIn(n, 'onHover', d, rect);
            runTriggersIn(n, 'onMouseEnter', d, rect);
        });
        d.addEventListener('pointerleave', () => { revertVariant(n, ['onHover', 'onMouseEnter']); update(n, { state: baseStateOf(n) }); });
        d.addEventListener('pointerdown', () => hasState('pressed') && update(n, { state: 'pressed' }));
        // Fokus: focusin / focusout membubarkan event, focus tidak.
        d.addEventListener('focusin', () => {
            const rect = d.getBoundingClientRect();
            hasState('focused') && update(n, { state: 'focused' });
            runTriggersIn(n, 'onFocus', d, rect);
        });
        d.addEventListener('focusout', () => {
            const rect = d.getBoundingClientRect();
            revertVariant(n, ['onFocus']);
            update(n, { state: stateOf(n) === 'focused' ? baseStateOf(n) : stateOf(n) });
            runTriggersIn(n, 'onBlur', d, rect);
        });
        // The press redraws the button, so the click is taken from the pointer-up on the redrawn one.
        d.addEventListener('pointerup', ev => {
            // Jangkar posisi diambil sebelum gambar ulang: elemen yang lama sudah lepas dari DOM.
            const rect = d.getBoundingClientRect();
            const pressed = stateOf(n) === 'pressed';
            update(n, { state: hasState('hover') ? 'hover' : baseStateOf(n) });
            // The click belongs to the innermost layer that does something with it; the layers around it only get their state back.
            if (ev.bhHandled) return;
            const own = normalizeInteractions(ctx.interactionsFor?.(n)).some(it => it.trigger === 'onClick');
            if (own || go) ev.bhHandled = true;
            if (go && (pressed || !hasState('pressed'))) show(go);
            runTriggersIn(n, 'onClick', d, rect);
            openSelect(n, d, rect);
        });
    }

    function update(n, patch) {
        const cur = runtime.get(rowRuntimeKey(n.id, n.__row)) || {}, next = { ...cur, ...patch };
        if (['state', 'error', 'value', 'reveal'].every(k => next[k] === cur[k])) return;
        runtime.set(rowRuntimeKey(n.id, n.__row), next);
        draw();
    }

    /** Where every layer is and how it looks, by its Smart animate key, so the next drawing can grow out of this one. */
    const SMART_PROPS = ['backgroundColor', 'color', 'borderTopColor', 'borderRadius', 'opacity'];
    function snapshotSmart() {
        const snap = new Map();
        for (const e of stage.querySelectorAll('[data-sk]')) {
            const cs = getComputedStyle(e), look = {};
            for (const p of SMART_PROPS) look[p] = cs[p];
            snap.set(e.dataset.sk, { left: e.offsetLeft, top: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight, look });
        }
        return snap;
    }
    /** Smart animate: layers present before and after tween from where they were; new ones fade in. */
    function playSmart(snap, motion) {
        for (const e of stage.querySelectorAll('[data-sk]')) {
            const old = snap.get(e.dataset.sk);
            if (!old) { e.animate([{ opacity: 0 }, {}], { duration: motion.duration, easing: motion.easingCss }); continue; }
            const cs = getComputedStyle(e), from = {};
            const now = { left: e.offsetLeft, top: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight };
            for (const k of Object.keys(now)) if (now[k] !== old[k]) from[k] = `${old[k]}px`;
            for (const p of SMART_PROPS) if (cs[p] !== old.look[p]) from[p] = old.look[p];
            if (Object.keys(from).length) e.animate([from, {}], { duration: motion.duration, easing: motion.easingCss });
        }
    }

    function draw(animate = true) {
        const f = ctx.node(frameId);
        if (!f) return;
        const smart = pendingSmart;
        pendingSmart = null;
        const smartOn = smart && smart.transition === 'smart-animate' && smart.duration > 0 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const a = document.activeElement, keep = a?.dataset?.field, toEnd = caretAtEnd, caret = a?.selectionStart;
        caretAtEnd = false;
        rendering = true;
        const navigated = lastFrame !== frameId;
        const motion = navigated ? (navMotion || resolveMotion(null, 'navigate')) : resolveMotion(null, 'state');
        navMotion = null;
        lastFrame = frameId;
        // Viewport preview mengikuti setting Overflow frame yang sedang tampil.
        if (navigated) { const o = previewOverflow(f.overflow); root.style.overflowX = o.x; root.style.overflowY = o.y; }
        const typingNow = !!document.activeElement?.dataset?.field;
        // View Transitions hanya untuk navigasi (sekali per klik). State hover/pressed/selected digambar
        // instant seperti semula: transisi di tiap gerakan mouse menumpuk dan bikin flicker + input terasa telat.
        const useVT = animate && navigated && !typingNow && motion.duration > 0 && motion.transition !== 'instant' && typeof document.startViewTransition === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        const docEl = document.documentElement;
        if (useVT) {
            docEl.dataset.mvt = motion.transition;
            docEl.style.setProperty('--mvt-dur', `${motion.duration}ms`);
            docEl.style.setProperty('--mvt-ease', motion.easingCss);
            stage.style.viewTransitionName = navigated && motion.transition !== 'dissolve' && motion.transition !== 'fade' ? 'midas-stage' : '';
        } else {
            delete docEl.dataset.mvt;
            stage.style.viewTransitionName = '';
        }
        const swap = () => {
        const before = smartOn ? snapshotSmart() : null;
        stage.replaceChildren();
        const vw = root.clientWidth || 0, vh = root.clientHeight || 0;
        const fillBox = scaleMode === 'fill' && vw > 0 && vh > 0 ? { w: vw, h: vh } : null;
        const nodes = buildScene(f, false, fillBox), rootNode = nodes[0];
        const sc = previewScale(scaleMode, root.clientWidth, root.clientHeight, rootNode.w, rootNode.h);
        // Figma-style scaling: fill width / actual size (100%) / fit to screen.
        if (fillBox) Object.assign(stage.style, { width: '100%', height: '100%', transform: '', transformOrigin: 'top left', margin: '0' });
        else Object.assign(stage.style, { width: px(rootNode.w * sc), height: px(rootNode.h * sc), transform: sc === 1 ? '' : `scale(${sc})`, transformOrigin: 'top left', margin: 'auto' });
        
        
        renderScene(nodes).style.position = 'relative';
        if (before && before.size) playSmart(before, smart);
        const again = keep && stage.querySelector(`[data-field="${keep}"]`);
        if (again && !again.disabled) {
            again.focus({ preventScroll: true });
            const at = toEnd ? again.value.length : caret;
            try { again.setSelectionRange(at, at); } catch { /* caret is not available on every input type */ }
        }
        if (pendingField) {
            const next = stage.querySelector(`[data-field="${pendingField}"]`);
            pendingField = null;
            if (next && !next.disabled) queueMicrotask(() => next.isConnected && next.focus({ preventScroll: true }));
        }
        }; // end swap
        if (useVT) { try { document.startViewTransition(() => { swap(); }); } catch { swap(); } }
        else swap();
        rendering = false;
        markCurrent();
    }

    function show(id, motion) { if (id !== frameId) evalCtx.reset(['page']); frameId = id; navMotion = motion || null; runtime.clear(); closeLayers('all', true); clearFeedback(); syncTabFrame(id); draw(); runLoadEvents(id); if (controlsReady) renderControls(); }
    /** Restart (R): reset semua state interaksi ke awal tanpa reload — langsung pakai pengaturan kanvas + behavior yang sudah ada. */
    async function restartPreview() {
        // A preview tab holds a copy of the file from when it loaded: restart first re-reads the saved file (no page reload),
        // so edits made in the design tab (after autosave) show up, then resets every interaction state.
        if (surface === 'tab' && onRefresh) {
            try {
                const fresh = await onRefresh();
                if (fresh && fresh.frames?.length) {
                    ctx = fresh;
                    evalCtx = createEvalCtx(ctx.state);
                    css.textContent = css.textContent
                        .replace(/^\.live-preview\{[^}]*\}/, `.live-preview{${ctx.vars.map(v => `--${v.name}:${v.value}`).join(';')}}`)
                        .replace(/\.live-preview \[data-field="[^"]*"\]::placeholder\{[^}]*\}/g, '');
                    if (!ctx.frames.some(f => f.id === frameId)) frameId = ctx.start;
                    renderFrameList();
                }
            } catch (e) { console.warn('Preview refresh failed:', e); }
        }
        modeOver.clear();
        varOver.clear();
        evalCtx = createEvalCtx(ctx.state);
        syncLoading();
        navMotion = null;
        show(ctx.start);
        renderControls();
        if (stateReady) renderState();
    }

    // A dropdown or popover closes when the pointer goes down outside it (pressing what opened it does not count). An overlay
    // closes that way only when it was set to close with its backdrop.
    root.addEventListener('pointerdown', ev => {
        if (!layers.length || layers.some(l => l.holder.contains(ev.target))) return;
        const top = layers[layers.length - 1], a = top.anchor;
        if (top.kind === 'overlay') return;
        if (a && ev.clientX >= a.left && ev.clientX <= a.right && ev.clientY >= a.top && ev.clientY <= a.bottom) return;
        closeLayer(top);
    }, true);
    // Side menu, folded away until the menu button is clicked: the frames to move between, and the way out.
    const chrome = { font: '12px Inter, system-ui, sans-serif', color: '#fff' };
    const menuBtn = el('button', { ...chrome, position: 'absolute', top: '12px', left: '12px', zIndex: 60, width: '32px', height: '32px', display: 'grid', placeItems: 'center', border: '0', borderRadius: '8px', background: 'rgba(30,30,30,.82)', cursor: 'pointer', opacity: '.75' }, root);
    menuBtn.title = 'Menu';
    menuBtn.setAttribute('aria-label', 'Preview menu');
    menuBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    menuBtn.onmouseenter = () => { menuBtn.style.opacity = '1'; };
    menuBtn.onmouseleave = () => { menuBtn.style.opacity = '.75'; };
    const drawer = el('aside', { ...chrome, position: 'absolute', top: '0', left: '0', bottom: '0', width: '248px', zIndex: 65, display: 'flex', flexDirection: 'column', background: 'rgba(24,24,24,.97)', boxShadow: '8px 0 28px rgba(0,0,0,.28)', transform: 'translateX(-100%)', transition: 'transform .16s ease', visibility: 'hidden' }, root);
    drawer.setAttribute('aria-label', 'Preview menu');
    const head = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 12px 10px 16px', fontWeight: 600 }, drawer);
    el('span', null, head).textContent = 'Preview';
    const shut = el('button', { ...chrome, width: '24px', height: '24px', border: '0', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '16px', lineHeight: '1' }, head);
    shut.textContent = '\u00d7';
    shut.title = 'Close menu';
    const frameList = el('div', { flex: '1', minHeight: '0', overflowY: 'auto', padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }, drawer);
    const collapsed = new Set();
    const frameBtns = new Map();
    const groupKey = f => f.pageId || f.page || '__all__';
    function frameButton(f, indent) {
        const b = el('button', { ...chrome, display: 'block', width: '100%', padding: '7px 8px', paddingLeft: indent, border: '0', borderRadius: '6px', background: 'transparent', textAlign: 'left', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: '0 0 auto', lineHeight: '18px' }, frameList);
        const fname = f.name || f.label;
        b.textContent = fname;
        b.title = f.page ? `${f.page} / ${fname}` : fname;
        b.dataset.frame = f.id;
        frameBtns.set(f.id, b);
        b.onclick = () => show(f.id);
    }
    function renderFrameList() {
        frameList.replaceChildren();
        frameBtns.clear();
        if (!ctx.frames.length) {
            const empty = el('div', { ...chrome, padding: '8px', opacity: '.7' }, frameList);
            empty.textContent = 'No frames to preview.';
            return;
        }
        if (!ctx.frames.some(f => f.page || f.pageId)) {
            for (const f of ctx.frames) frameButton(f, '8px');
            return;
        }
        const order = [], byKey = new Map();
        for (const f of ctx.frames) {
            const k = groupKey(f);
            if (!byKey.has(k)) { const g = { key: k, items: [] }; byKey.set(k, g); order.push(g); }
            byKey.get(k).items.push(f);
        }
        const titleOf = g => g.items[0]?.page || 'Pages';
        for (const g of order) {
            const open = !collapsed.has(g.key);
            const head = el('button', { ...chrome, display: 'flex', width: '100%', alignItems: 'center', gap: '6px', padding: '7px 8px', border: '0', borderRadius: '6px', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontWeight: 600, flex: '0 0 auto', lineHeight: '18px' }, frameList);
            head.title = (open ? 'Collapse ' : 'Expand ') + titleOf(g);
            const chev = el('span', { width: '12px', flex: '0 0 auto', opacity: '.8' }, head);
            chev.textContent = open ? '▾' : '▸';
            const nm = el('span', { flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, head);
            nm.textContent = titleOf(g);
            const count = el('span', { opacity: '.55', fontWeight: 400 }, head);
            count.textContent = String(g.items.length);
            head.onclick = () => { if (collapsed.has(g.key)) collapsed.delete(g.key); else collapsed.add(g.key); renderFrameList(); markCurrent(); };
            if (!open) continue;
            for (const f of g.items) frameButton(f, '28px');
        }
    }
    { // initial grouped render (Page = folder, Frame = item)
        renderFrameList();
    }
    const exit = el('button', { ...chrome, margin: '8px', padding: '8px 10px', border: '1px solid rgba(255,255,255,.22)', borderRadius: '8px', background: 'transparent', cursor: 'pointer' }, drawer);
    exit.textContent = 'Exit preview';
    function markCurrent() {
        const cur = ctx.frames.find(f => f.id === frameId);
        if (cur && collapsed.has(groupKey(cur))) { collapsed.delete(groupKey(cur)); renderFrameList(); }
        for (const entry of frameBtns) entry[1].style.background = entry[0] === frameId ? 'rgba(255,255,255,.14)' : 'transparent';
    }
    const setMenu = on => {
        drawer.style.visibility = 'visible';
        drawer.style.transform = on ? 'translateX(0)' : 'translateX(-100%)';
        drawer.dataset.open = on ? '1' : '';
        if (!on) setTimeout(() => { if (!drawer.dataset.open) drawer.style.visibility = 'hidden'; }, 180);
    };
    menuBtn.onclick = () => setMenu(!drawer.dataset.open);
    shut.onclick = () => setMenu(false);
    exit.onclick = () => onExit?.();
    if (surface === 'tab') {
        exit.remove();   // the menu stays in a tab (Page folders → frames); only "Exit preview" has nowhere to go
        // (drawer kept)
        const bar = el('div', { ...chrome, position: 'absolute', top: '12px', right: '12px', zIndex: 60, display: 'flex', gap: '2px', padding: '3px', borderRadius: '10px', background: 'rgba(30,30,30,.82)' }, root);
        bar.setAttribute('aria-label', 'Preview scale');
        const sbtns = {};
        for (const [m, label] of [['fill', 'Fill'], ['actual', '100%'], ['fit', 'Fit']]) {
            const b = el('button', { ...chrome, padding: '5px 10px', border: '0', borderRadius: '7px', background: 'transparent', cursor: 'pointer' }, bar);
            b.textContent = label;
            b.title = m === 'fill' ? 'Scale to fill width' : m === 'actual' ? 'Actual size (100%)' : 'Fit to screen';
            b.onclick = () => { scaleMode = m; syncTabScale(); paintBar(); draw(false); };
            sbtns[m] = b;
        }
        const rb = el('button', { ...chrome, padding: '5px 10px', border: '0', borderRadius: '7px', background: 'transparent', cursor: 'pointer' }, bar);
        rb.textContent = 'Restart';
        rb.title = 'Restart preview (R)';
        rb.onclick = () => restartPreview();
        paintBar();
    }
    if (ctx.hasRequests) {
        const sc = el('div', { ...chrome, position: 'absolute', top: '12px', right: surface === 'tab' ? '300px' : '12px', zIndex: 60, display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(30,30,30,.82)' }, root);
        sc.setAttribute('aria-label', 'Preview scenario');
        el('span', { opacity: '.7', fontSize: '12px' }, sc).textContent = 'Scenario';
        const pick = el('select', { ...chrome, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '6px', padding: '3px 6px', colorScheme: 'dark' }, sc);
        pick.setAttribute('aria-label', 'Active scenario');
        for (const o of scenariosOf(ctx.state)) { const op = el('option', null, pick); op.value = o.id; op.textContent = o.name; }
        activeScenario = pick.value;
        // Switching the outcome never resets State: the next request just ends differently.
        pick.onchange = () => { activeScenario = pick.value; };
        const slowBtn = el('button', { ...chrome, padding: '3px 10px', border: '1px solid rgba(255,255,255,.2)', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '12px' }, sc);
        slowBtn.textContent = 'Slow';
        slowBtn.title = 'Make requests take three times as long';
        slowBtn.setAttribute('aria-pressed', 'false');
        slowBtn.onclick = () => { slow = !slow; slowBtn.setAttribute('aria-pressed', String(slow)); slowBtn.style.background = slow ? 'rgba(255,255,255,.22)' : 'transparent'; };
    }
    function paintBar() {
        const bar = root.querySelector('[aria-label="Preview scale"]');
        if (!bar) return;
        for (const b of bar.querySelectorAll('button')) b.style.background = b.textContent === ({ fill: 'Fill', actual: '100%', fit: 'Fit' })[scaleMode] ? 'rgba(255,255,255,.22)' : 'transparent';
    }
    function syncTabUrl(key, val) {
        if (surface !== 'tab') return;
        try { const q = new URLSearchParams(location.search); q.set(key, val); history.replaceState(null, '', location.pathname + '?' + q); } catch { }
    }
    function syncTabFrame(id) { syncTabUrl('preview', id); }
    function syncTabScale() { syncTabUrl('scale', scaleMode); }
    // Variables panel: every variable the design uses, with a control to change it while previewing (enum = list, boolean = switch, number = slider, color = picker).
    const varsBtn = el('button', { ...chrome, position: 'absolute', top: '12px', left: '52px', zIndex: 60, width: '32px', height: '32px', display: 'none', placeItems: 'center', border: '0', borderRadius: '8px', background: 'rgba(30,30,30,.82)', cursor: 'pointer', opacity: '.75' }, root);
    varsBtn.title = 'Variables';
    varsBtn.setAttribute('aria-label', 'Preview variables');
    varsBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>';
    varsBtn.onmouseenter = () => { varsBtn.style.opacity = '1'; };
    varsBtn.onmouseleave = () => { varsBtn.style.opacity = '.75'; };
    const varsPanel = el('aside', { ...chrome, position: 'absolute', top: surface === 'tab' ? '56px' : '12px', right: '12px', bottom: '12px', width: '300px', zIndex: 66, display: 'none', flexDirection: 'column', borderRadius: '12px', background: 'rgba(24,24,24,.97)', boxShadow: '0 12px 36px rgba(0,0,0,.34)', overflow: 'hidden' }, root);
    varsPanel.setAttribute('aria-label', 'Preview variables');
    const vHead = el('div', { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 12px 8px 14px', fontWeight: 600 }, varsPanel);
    el('span', { flex: '1' }, vHead).textContent = 'Variables';
    const vReset = el('button', { ...chrome, padding: '4px 8px', border: '1px solid rgba(255,255,255,.22)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }, vHead);
    vReset.textContent = 'Reset';
    const vShut = el('button', { ...chrome, width: '24px', height: '24px', border: '0', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '16px', lineHeight: '1' }, vHead);
    vShut.textContent = '\u00d7';
    const vSearch = el('input', { ...chrome, margin: '0 12px 8px', padding: '6px 8px', border: '1px solid rgba(255,255,255,.18)', borderRadius: '6px', background: 'rgba(255,255,255,.06)', outline: '0' }, varsPanel);
    vSearch.placeholder = 'Search variables';
    const vBody = el('div', { flex: '1', minHeight: '0', overflowY: 'auto', padding: '0 12px 12px' }, varsPanel);
    const fieldStyle = { ...chrome, boxSizing: 'border-box', padding: '4px 6px', border: '1px solid rgba(255,255,255,.18)', borderRadius: '6px', background: 'rgba(255,255,255,.06)', outline: '0', colorScheme: 'dark' };
    function renderControls() {
        const groups = ctx.controls?.(frameId) || [];
        varsBtn.style.display = groups.length ? 'grid' : 'none';
        if (!groups.length) varsPanel.style.display = 'none';
        vBody.replaceChildren();
        const q = vSearch.value.trim().toLowerCase();
        for (const g of groups) {
            const rows = g.items.filter(i => !q || i.name.toLowerCase().includes(q) || g.name.toLowerCase().includes(q));
            if (!rows.length && !(g.modes.length && (!q || g.name.toLowerCase().includes(q)))) continue;
            const title = el('div', { margin: '10px 0 4px', fontSize: '11px', letterSpacing: '.04em', textTransform: 'uppercase', opacity: '.6' }, vBody);
            title.textContent = g.name;
            if (g.modes.length) {
                const row = el('label', { display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }, vBody);
                el('span', { flex: '1', opacity: '.85' }, row).textContent = 'Mode';
                const sel = el('select', { ...fieldStyle, width: '150px' }, row);
                for (const m of g.modes) { const o = el('option', null, sel); o.value = m.id; o.textContent = m.name; }
                sel.value = modeOver.get(g.id) || g.modes[0].id;
                sel.onchange = () => { modeOver.set(g.id, sel.value); draw(); };
            }
            for (const it of rows) {
                const cur = varOver.has(it.id) ? varOver.get(it.id) : it.value;
                const row = el('label', { display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }, vBody);
                const nm = el('span', { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: '.85' }, row);
                nm.textContent = it.name;
                nm.title = it.unused ? `${it.name} (no layer follows this variable yet)` : it.name;
                if (it.unused) nm.style.opacity = '.45';
                const set = value => setVariable({ variableId: it.id, value });
                if (it.type === 'boolean') {
                    const c = el('input', { width: '16px', height: '16px', margin: '0', accentColor: '#4f8cff' }, row);
                    c.type = 'checkbox';
                    c.checked = !!cur;
                    c.onchange = () => set(c.checked);
                } else if (it.type === 'color') {
                    const hex = String(cur || '#000000');
                    const c = el('input', { width: '36px', height: '24px', padding: '0', border: '0', background: 'transparent' }, row);
                    c.type = 'color';
                    c.value = /^#[0-9a-f]{6}/i.test(hex) ? hex.slice(0, 7) : '#000000';
                    c.oninput = () => set(c.value + (/^#[0-9a-f]{8}$/i.test(hex) ? hex.slice(7) : ''));
                } else if (it.type === 'number') {
                    const wrap = el('span', { display: 'flex', alignItems: 'center', gap: '6px' }, row);
                    const num = el('input', { ...fieldStyle, width: '64px' }, wrap);
                    num.type = 'number';
                    num.value = cur;
                    let rng = null;
                    num.oninput = () => { if (num.value !== '') { set(Number(num.value)); if (rng) rng.value = num.value; } };
                    if (it.range) {
                        rng = el('input', { width: '90px', accentColor: '#4f8cff' }, wrap);
                        rng.type = 'range';
                        rng.min = it.range.min; rng.max = it.range.max; rng.step = it.range.step || 1;
                        rng.value = cur;
                        rng.oninput = () => { num.value = rng.value; set(Number(rng.value)); };
                    }
                } else if (it.options) {
                    const c = el('select', { ...fieldStyle, width: '150px' }, row);
                    for (const v of it.options) { const o = el('option', null, c); o.value = v; o.textContent = v; }
                    c.value = String(cur);
                    c.onchange = () => set(c.value);
                } else {
                    const c = el('input', { ...fieldStyle, width: '150px' }, row);
                    c.type = 'text';
                    c.value = String(cur ?? '');
                    c.oninput = () => set(c.value);
                }
            }
        }
        if (!vBody.children.length) el('div', { padding: '12px 0', opacity: '.6' }, vBody).textContent = q ? 'No variables match.' : 'No variables used in this design.';
    }
    const setVars = on => { varsPanel.style.display = on ? 'flex' : 'none'; varsPanel.dataset.open = on ? '1' : ''; if (on) renderControls(); };
    varsBtn.onclick = () => setVars(!varsPanel.dataset.open);
    vShut.onclick = () => setVars(false);
    vReset.onclick = () => { varOver.clear(); modeOver.clear(); draw(); renderControls(); };
    vSearch.oninput = () => renderControls();
    controlsReady = true;
    renderControls();
    // State panel: the current value of every state variable, editable by hand (actions come later), derived values read-only.
    const stBtn = el('button', { ...chrome, position: 'absolute', top: '12px', left: '92px', zIndex: 60, width: '32px', height: '32px', display: 'none', placeItems: 'center', border: '0', borderRadius: '8px', background: 'rgba(30,30,30,.82)', cursor: 'pointer', opacity: '.75' }, root);
    stBtn.title = 'State';
    stBtn.setAttribute('aria-label', 'Preview state');
    stBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>';
    stBtn.onmouseenter = () => { stBtn.style.opacity = '1'; };
    stBtn.onmouseleave = () => { stBtn.style.opacity = '.75'; };
    const stPanel = el('aside', { ...chrome, position: 'absolute', top: surface === 'tab' ? '56px' : '12px', right: '12px', bottom: '12px', width: '320px', zIndex: 66, display: 'none', flexDirection: 'column', borderRadius: '12px', background: 'rgba(24,24,24,.97)', boxShadow: '0 12px 36px rgba(0,0,0,.34)', overflow: 'hidden' }, root);
    stPanel.setAttribute('aria-label', 'Preview state');
    const sHead = el('div', { display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 12px 8px 14px', fontWeight: 600 }, stPanel);
    el('span', { flex: '1' }, sHead).textContent = 'State';
    const sReset = el('button', { ...chrome, padding: '4px 8px', border: '1px solid rgba(255,255,255,.22)', borderRadius: '6px', background: 'transparent', cursor: 'pointer' }, sHead);
    sReset.textContent = 'Reset';
    const sShut = el('button', { ...chrome, width: '24px', height: '24px', border: '0', borderRadius: '6px', background: 'transparent', cursor: 'pointer', fontSize: '16px', lineHeight: '1' }, sHead);
    sShut.textContent = '\u00d7';
    const sBody = el('div', { flex: '1', minHeight: '0', overflowY: 'auto', padding: '0 12px 12px' }, stPanel);
    const sDerived = el('div', null, null);
    const valueLine = v => Array.isArray(v) ? `${v.length} ${v.length === 1 ? 'row' : 'rows'}` : v && typeof v === 'object' ? JSON.stringify(v) : formatValue(v);
    function renderDerived() {
        sDerived.replaceChildren();
        for (const d of ctx.state.derived || []) {
            const row = el('div', { display: 'flex', gap: '8px', padding: '3px 0' }, sDerived), err = evalCtx.error(d.id);
            el('span', { flex: '1', opacity: '.85', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' }, row).textContent = d.name;
            const val = el('span', { maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: err ? '#ff6b6b' : 'inherit' }, row);
            val.textContent = err || valueLine(evalCtx.get(d.id));
            val.title = val.textContent;
        }
    }
    function renderState() {
        const st = ctx.state, any = st.variables.length || (st.derived || []).length;
        stBtn.style.display = any ? 'grid' : 'none';
        if (!any) stPanel.style.display = 'none';
        sBody.replaceChildren();
        const apply = (id, value, input) => {
            const r = evalCtx.set(id, value);
            if (input) input.style.borderColor = r.ok ? 'rgba(255,255,255,.18)' : '#ff6b6b';
            if (input) input.title = r.ok ? '' : r.error;
            if (r.ok) { draw(); renderDerived(); }
            return r.ok;
        };
        for (const v of st.variables) {
            const wide = v.type === 'list' || v.type === 'object';
            const row = el('label', { display: 'flex', flexDirection: wide ? 'column' : 'row', alignItems: wide ? 'stretch' : 'center', gap: '6px', padding: '4px 0' }, sBody);
            const nm = el('span', { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: '.85' }, row);
            nm.textContent = v.scope === 'app' ? `${v.name} · app` : v.name;
            const cur = evalCtx.get(v.id);
            if (v.type === 'boolean') {
                const c = el('input', { width: '16px', height: '16px', margin: '0', accentColor: '#4f8cff' }, row);
                c.type = 'checkbox'; c.checked = !!cur; c.onchange = () => apply(v.id, c.checked);
            } else if (v.type === 'option') {
                const c = el('select', { ...fieldStyle, width: '150px' }, row);
                for (const o of v.options || []) { const op = el('option', null, c); op.value = o; op.textContent = o; }
                c.value = cur; c.onchange = () => apply(v.id, c.value);
            } else if (wide) {
                const t = el('textarea', { ...fieldStyle, width: '100%', minHeight: '84px', fontFamily: 'ui-monospace, monospace', fontSize: '11px', resize: 'vertical' }, row);
                t.value = JSON.stringify(cur, null, 1); t.spellcheck = false;
                t.onchange = () => { try { apply(v.id, JSON.parse(t.value), t); } catch { t.style.borderColor = '#ff6b6b'; t.title = 'This is not valid JSON.'; } };
            } else if (v.type === 'file') {
                const c = el('input', { ...fieldStyle, width: '150px' }, row);
                c.type = 'file';
                c.onchange = () => { const f = c.files?.[0]; apply(v.id, f ? { name: f.name, size: f.size, type: f.type } : null, c); };
            } else {
                const c = el('input', { ...fieldStyle, width: '150px' }, row);
                c.type = v.type === 'number' ? 'number' : v.type === 'date' ? 'date' : 'text';
                c.value = cur ?? '';
                c.oninput = () => { if (v.type === 'number') { if (c.value !== '') apply(v.id, Number(c.value), c); } else apply(v.id, c.value, c); };
            }
        }
        if ((st.derived || []).length) {
            const title = el('div', { margin: '12px 0 4px', fontSize: '11px', letterSpacing: '.04em', textTransform: 'uppercase', opacity: '.6' }, sBody);
            title.textContent = 'Derived';
            sBody.appendChild(sDerived);
            renderDerived();
        }
    }
    function renderStateIfOpen() { if (stPanel.dataset.open) renderState(); }
    const setStateOpen = on => { stPanel.style.display = on ? 'flex' : 'none'; stPanel.dataset.open = on ? '1' : ''; if (on) renderState(); };
    stBtn.onclick = () => setStateOpen(!stPanel.dataset.open);
    sShut.onclick = () => setStateOpen(false);
    sReset.onclick = () => { evalCtx.reset(); draw(); renderState(); };
    stateReady = true;
    renderState();
    // Clicking the design itself folds the menu away again.
    root.addEventListener('pointerdown', ev => { if (drawer.dataset.open && !drawer.contains(ev.target) && !menuBtn.contains(ev.target)) setMenu(false); }, true);
    // Escape closes the top layer, then the menu, then leaves the preview (a field being typed in just loses focus).
    const onKey = e => {
        if (e.key === 'r' || e.key === 'R') {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                const ae = document.activeElement;
                if (!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable))) {
                    e.stopPropagation();
                    restartPreview();
                    return;
                }
            }
        }
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        if (feedbacks.length) { if (!feedbacks.at(-1).blocking) closeFeedback(feedbacks.at(-1)); }
        else if (layers.length) closeLayers('current');
        else if (drawer.dataset.open) setMenu(false);
        else if (varsPanel.dataset.open && !document.activeElement?.dataset?.field) setVars(false);
        else if (stPanel.dataset.open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) setStateOpen(false);
        else if (document.activeElement?.dataset?.field) document.activeElement.blur();
        else onExit?.();
    };
    const resize = () => draw(false);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', resize);
    draw();
    runLoadEvents(frameId);
    return { close() { document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', resize); delete document.documentElement.dataset.mvt; document.documentElement.style.removeProperty('--mvt-dur'); document.documentElement.style.removeProperty('--mvt-ease'); root.remove(); portal.remove(); }, setScale(m) { scaleMode = m; draw(false); } };
}
