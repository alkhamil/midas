// Live preview: a design frame as real DOM, so inputs can be typed in, buttons react to the pointer and the
// interactions of the Behavior tab work ("Go to page", dropdown, overlay, popover/tooltip).
// Positions come from the editor's own auto layout engine (ctx.layout), run on a copy of the frame with the current state
// applied (a hint that appears, a variant that swaps), so the preview lays out exactly like the canvas: order, flip, hug,
// fill, wrap, strokes. The DOM only draws what the layout produced.
// The editor supplies everything it knows through `ctx` (see liveContext in midas.js):
//   node kids descendants layout variants modes resolved typeable field roles varName vars frames start
//   mappingFor interactionsFor inputFor varValueOf
//
// State mapping (tab Behavior) dibaca di sini: setiap state nilai diambil dari variable collection, jadi tidak ada
// state hardcoded dari kit ui-standard.
import { normalizeInteractions, overridesFor } from '../engine/behavior.js';

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

function pathData(points, closed) {
    if (!points?.length) return '';
    const f = v => Math.round(v * 1000) / 1000;
    let s = `M${f(points[0].x)} ${f(points[0].y)}`;
    const seg = (a, b) => ` C${f((a.out || a).x)} ${f((a.out || a).y)} ${f((b.in || b).x)} ${f((b.in || b).y)} ${f(b.x)} ${f(b.y)}`;
    for (let i = 1; i < points.length; i++) s += seg(points[i - 1], points[i]);
    if (closed) s += seg(points.at(-1), points[0]) + 'Z';
    return s;
}

function svgOfPath(n, parent, style) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${n.pathW || n.w || 1} ${n.pathH || n.h || 1}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    Object.assign(svg.style, style, { overflow: 'visible' });
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', pathData(n.points, n.closed));
    const f = fillsOf(n).find(x => x.type === 'solid');
    p.setAttribute('fill', f ? rgba(f.color, f.opacity ?? 1) : 'none');
    if (n.fillRule) p.setAttribute('fill-rule', n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
    if (n.strokeWidth) {
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
        if (n.type === 'path') return `<path transform="${at} scale(${(n.w || 1) / (n.pathW || n.w || 1)} ${(n.h || 1) / (n.pathH || n.h || 1)})" d="${pathData(n.points, n.closed)}" fill="#000" fill-rule="${n.fillRule === 'evenodd' ? 'evenodd' : 'nonzero'}"/>`;
        if (n.type === 'ellipse') return `<ellipse transform="${at}" cx="${n.w / 2}" cy="${n.h / 2}" rx="${n.w / 2}" ry="${n.h / 2}" fill="#000"/>`;
        if (n.type === 'rect') return `<rect transform="${at}" width="${n.w}" height="${n.h}" rx="${n.radius || 0}" fill="#000"/>`;
        return `<g transform="${at}">${(kidsOf.get(n.id) || []).map(shape).join('')}</g>`;
    };
    const body = m.type === 'frame' ? (kidsOf.get(m.id) || []).map(shape).join('') : shape({ ...m, x: 0, y: 0 });
    return `<svg xmlns="${SVG}" viewBox="0 0 ${m.w} ${m.h}" width="${m.w}" height="${m.h}">${body}</svg>`;
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

// What a state falls back to when the component has no look for it (typing → focused → default, …).
const FALLBACK = { typing: ['typing', 'focused', 'default'], filled: ['filled', 'default'], focused: ['focused', 'default'], error: ['error', 'default'], hover: ['hover', 'default'], pressed: ['pressed', 'hover', 'default'], disabled: ['disabled', 'default'] };
const pick = (map, state) => {
    for (const s of FALLBACK[state] || [state, 'default'])
        if (map?.[s] !== undefined) return map[s];
    return undefined;
};

export function openLivePreview(ctx, host) {
    const root = el('div', { position: 'absolute', inset: '0', zIndex: 50, background: '#e3e3e3', overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }, host);
    root.className = 'live-preview';
    const stage = el('div', { position: 'relative', flex: 'none', transformOrigin: 'center center' }, root);
    const css = el('style', null, root);
    css.textContent = `.live-preview{${ctx.vars.map(v => `--${v.name}:${v.value}`).join(';')}} .live-preview input{font:inherit}`;
    const runtime = new Map();            // instance id -> { state, value, error }
    const layers = [];                   // dropdown / overlay / popover yang sedang terbuka
    let frameId = ctx.start, rendering = false;

    const stateOf = n => runtime.get(n.id)?.state || (n.disabled ? 'disabled' : 'default');
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
    /** Pesan error: dari variable, dari teks manual, atau dari pesan bawaan instance. */
    const errorTextOf = (ib, inst) => {
        if (ib?.error?.hint?.variableId) {
            const v = ctx.varValueOf?.(ib.error.hint.variableId);
            if (v !== undefined && v !== null && v !== '') return String(v);
        }
        if (ib?.error?.hint?.value) return String(ib.error.hint.value);
        if (ib?.error?.hintText) return String(ib.error.hintText);
        return inst?.errorMessage || 'This field is required';
    };
    const requiredOf = (inst, ib) => !!(ib?.validation?.required || inst?.required);

    /** A copy of the frame with the current state applied, laid out by the editor's engine. */
    function buildScene(frame) {
        const nodes = [];
        let seq = 0;
        // o: the instance being copied, with the variant to borrow looks from, the variable modes to read in and the texts to carry over.
        const emit = (n, parentId, o) => {
            const roles = o?.roles, err = !!o?.err, ib = o?.input;
            const forced = (err && roles?.showHint && n.propBind?.visible === roles.showHint) || (err && ib?.error?.frameId === n.id);
            if (n.visible === false && !forced) return;
            let base = o?.ov ? ctx.resolved(n, o.inst, o.ov) : n, kidsOf = n.id, inner = o, wire = null;
            if (n.isInstance) {
                const variants = ctx.variants(n), modes = ctx.modes(n), ib2 = ctx.inputFor?.(n), field = ctx.typeable(n) ? fieldOf(n, ib2) : null, st = stateOf(n);
                const src = pick(variants?.byState, st), swap = src && src !== variants.current;
                const texts = new Map(ctx.descendants(n.id).filter(x => x.type === 'text' && x.sourceId).map(x => [x.sourceId, x.text]));
                inner = { inst: n, swapped: !!swap, ov: pick(modes?.byState, st) || null, texts, field, roles: ctx.roles(n), err: !!runtime.get(n.id)?.error, input: ib2, state: st, mapping: ctx.mappingFor?.(n), target: {} };
                // Warna state dipakai lapisan yang benar-benar membawa tampilan komponen.
                const ownFill = n.fill && n.fill !== 'none' && !Array.isArray(n.fills);
                const ownStroke = n.strokeWidth > 0 && n.stroke && n.stroke !== 'none';
                inner.target = { fill: ownFill ? null : visualTarget(n, 'fill'), stroke: ownStroke ? null : visualTarget(n, 'stroke') };
                if (swap) {
                    const v = ctx.node(src);
                    base = { ...v, x: n.x, y: n.y, w: n.w, h: n.h, layoutSizingH: n.layoutSizingH, layoutSizingV: n.layoutSizingV, layoutPositioning: n.layoutPositioning, name: n.name };
                    kidsOf = src;
                }
                else if (inner.ov) base = ctx.resolved(n, n, inner.ov);
                wire = { inst: n, variants, modes, field };
            }
            else if (n.prototypeTarget) wire = { inst: n };
            const c = { ...base, id: `s${seq++}`, parentId, visible: true, _wire: wire };
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
            if (n.type === 'text') {
                if (o?.field && (n.id === o.field.id || (o.swapped && n.name === o.field.name))) c._field = o;
                const errText = err && (ib?.error?.frameId === n.id || o?.errFrame) ? errorTextOf(ib, o?.inst) : null;
                c.text = errText ?? (err && roles?.hintText && n.propBind?.text === roles.hintText ? (o?.inst?.errorMessage || 'This field is required') : null) ?? (o?.texts?.get(n.id) ?? n.text ?? '');
            }
            nodes.push(c);
            // Lapisan di dalam error frame ikut membawa pesan error (mis. teks bantuan di bawah input).
            const childInner = (ib?.error?.frameId === n.id) ? { ...inner, errFrame: true } : inner;
            for (const k of ctx.kids(kidsOf)) emit(k, c.id, childInner);
        };
        emit({ ...frame, x: 0, y: 0 }, null, null);
        ctx.layout(nodes);
        return nodes;
    }

    function renderScene(nodes, container = stage) {
        const kidsOf = new Map();
        for (const c of nodes) {
            if (!kidsOf.has(c.parentId)) kidsOf.set(c.parentId, []);
            kidsOf.get(c.parentId).push(c);
        }
        const draw = (c, parent, off) => {
            if (c.type === 'text') return c._field ? renderField(c, parent, off) : textBox(c, parent, off);
            if (c.type === 'path') return svgOfPath(c, parent, { ...placed(c, off), opacity: c.opacity ?? 1 });
            if (c.type === 'line') return el('div', { ...placed(c, off), height: px(c.strokeWidth || 1), background: rgba(c.stroke, c.strokeOpacity ?? 1) }, parent);
            const d = el('div', { ...placed(c, off), ...(c.type === 'group' ? {} : paint(ctx, c)) }, parent);
            d.dataset.node = c._wire?.inst.id || c.id;
            if (c.type === 'frame' && c.clip) d.style.overflow = 'hidden';
            if (c._wire) attach(c._wire, d);
            const stored = kidsOf.get(c.id) || [], paintOrder = c.layoutReverseZ && isAuto(c) ? [...stored].reverse() : stored;
            // A visible mask clips the siblings after it (in layout order); they are drawn inside one wrapper that carries the mask.
            const maskOf = new Map();
            let active = null;
            for (const k of c.layoutFlip ? [...stored].reverse() : stored) {
                if (k.isMask) active = k;
                else maskOf.set(k.id, active);
            }
            const wrappers = new Map();
            for (const k of paintOrder) {
                if (k.isMask) continue;
                const m = maskOf.get(k.id);
                if (!m) { draw(k, d, null); continue; }
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

    function textBox(c, parent, off) {
        const t = el('div', { ...placed(c, off), ...textStyle(ctx, c), display: 'flex', flexDirection: 'column', whiteSpace: c.autoW ? 'pre' : 'pre-wrap', justifyContent: { middle: 'center', bottom: 'flex-end' }[c.textAlignV] || 'flex-start' }, parent);
        t.textContent = c.text ?? '';
        return t;
    }

    /** The field's text is the placeholder: an input takes its place, wide enough for what is typed. */
    function renderField(c, parent, off) {
        const o = c._field, inst = o.inst, cur = runtime.get(inst.id) || {};
        const input = el('input', { ...placed(c, off), ...textStyle(ctx, c), width: px(Math.max(c.w, o.field.width)), border: '0', outline: '0', background: 'transparent', padding: '0', margin: '0', minWidth: '0' }, parent);
        for (let p = parent, i = 0; p && i < 3 && p !== stage; p = p.parentElement, i++) p.style.overflow = 'visible';
        input.dataset.field = inst.id;
        input.placeholder = o.input?.typeable?.placeholder?.value ?? c.text ?? '';
        input.value = cur.value || '';
        input.disabled = !!inst.disabled;
        input.type = /password/i.test(`${inst.name} ${input.placeholder}`) ? 'password' : 'text';
        const ph = `.live-preview [data-field="${inst.id}"]::placeholder{color:${rgba(fillsOf(c)[0]?.color || c.fill, .6)}}`;
        if (!css.textContent.includes(ph)) css.textContent += ph;
        const required = requiredOf(inst, o.input);
        input.addEventListener('focus', () => { if (!rendering && !runtime.get(inst.id)?.state?.match(/^(focused|typing)$/)) update(inst, { state: input.value ? 'typing' : 'focused', error: false }); });
        input.addEventListener('input', () => {
            const was = runtime.get(inst.id) || {};
            runtime.set(inst.id, { ...was, value: input.value, error: false });
            if (was.state !== 'typing') update(inst, { state: 'typing' });
        });
        input.addEventListener('blur', () => {
            if (rendering) return;
            const bad = required && !input.value.trim();
            update(inst, { state: bad ? 'error' : input.value ? 'filled' : 'default', error: bad, value: input.value });
            runTriggers(inst, 'onBlur', input);
        });
        input.addEventListener('change', () => runTriggers(inst, 'onChange', input));
        return input;
    }

    /** Jalankan action dari tab Behavior untuk sebuah instance. */
    function runTriggers(inst, trigger, anchor, rect) {
        const list = normalizeInteractions(ctx.interactionsFor?.(inst));
        for (const it of list) {
            if (it.trigger !== trigger) continue;
            runAction(it.action, inst, anchor, rect);
        }
    }
    function runAction(action, inst, anchor, rect) {
        if (!action) return;
        if (action.type === 'navigate') {
            if (action.targetFrameId && ctx.node(action.targetFrameId)) show(action.targetFrameId);
            return;
        }
        if (action.type === 'close-overlay') {
            closeLayers(action.close === 'all' ? 'all' : 'current');
            return;
        }
        if (action.type === 'open-dropdown' || action.type === 'open-overlay' || action.type === 'open-popover') openLayer(action, anchor, rect);
    }

    /** Buka sebuah frame sebagai dropdown / overlay / popover / tooltip. */
    function openLayer(action, anchor, rect) {
        const frame = ctx.node(action.targetFrameId);
        if (!frame) return;
        const kind = action.type === 'open-dropdown' ? 'dropdown' : action.type === 'open-overlay' ? 'overlay' : 'popover';
        const holder = el('div', { position: 'absolute', zIndex: 70 }, root);
        let backdrop = null;
        const content = renderScene(buildScene(frame), holder);
        content.style.position = 'relative';
        content.style.left = '0';
        content.style.top = '0';
        const w = content.offsetWidth, h = content.offsetHeight;
        const r = root.getBoundingClientRect();
        // Posisi jangkar diambil sebelum scene digambar ulang (elemen lama sudah lepas dari DOM).
        const a = rect || anchor?.getBoundingClientRect?.();
        const pos = action.position || (kind === 'overlay' ? 'center' : kind === 'dropdown' ? 'bottom-left' : 'top');
        const place = (left, top) => { holder.style.left = px(Math.max(4, left)); holder.style.top = px(Math.max(4, top)); };
        if (kind === 'overlay' || pos === 'center') {
            if (action.backdrop !== false) {
                backdrop = el('div', { position: 'absolute', inset: '0', zIndex: 69, background: 'rgba(15,23,42,.45)' }, root);
                if (action.closeOnBackdrop) backdrop.addEventListener('click', () => closeLayers('all'));
            }
            place((r.width - w) / 2, (r.height - h) / 2);
        }
        else if (a) {
            const x = a.left - r.left, y = a.top - r.top;
            if (pos === 'top' || pos === 'top-left' || pos === 'top-right') place(pos === 'top' ? x + (a.width - w) / 2 : pos === 'top-left' ? x : x + a.width - w, y - h);
            else if (pos === 'bottom' || pos === 'bottom-left' || pos === 'bottom-right') place(pos === 'bottom' ? x + (a.width - w) / 2 : pos === 'bottom-left' ? x : x + a.width - w, y + a.height);
            else if (pos === 'left') place(x - w, y + (a.height - h) / 2);
            else if (pos === 'right') place(x + a.width, y + (a.height - h) / 2);
            else place(x, y + a.height);
        }
        layers.push({ holder, backdrop, kind });
    }
    function closeLayers(scope) {
        const kill = layer => { layer.holder.remove(); layer.backdrop?.remove(); };
        if (scope === 'all') { layers.splice(0).forEach(kill); return; }
        if (scope === 'current') { const last = layers.pop(); if (last) kill(last); return; }
        for (let i = layers.length - 1; i >= 0; i--) if (layers[i].kind === scope) { kill(layers[i]); layers.splice(i, 1); }
    }

    function attach({ inst: n, variants, modes, field }, d) {
        if (n.disabled) { d.style.cursor = 'not-allowed'; return; }
        const go = target(n), has = s => !!(variants?.byState[s] || modes?.byState[s]);
        const mapping = ctx.mappingFor?.(n);
        const hasState = s => has(s) || !!mapping?.[s];
        if (go) d.style.cursor = 'pointer';
        if (field) return;
        d.addEventListener('pointerenter', () => {
            const rect = d.getBoundingClientRect();
            hasState('hover') && update(n, { state: 'hover' });
            runTriggers(n, 'onHover', d, rect);
            runTriggers(n, 'onMouseEnter', d, rect);
        });
        d.addEventListener('pointerleave', () => update(n, { state: 'default' }));
        d.addEventListener('pointerdown', () => hasState('pressed') && update(n, { state: 'pressed' }));
        // The press redraws the button, so the click is taken from the pointer-up on the redrawn one.
        d.addEventListener('pointerup', () => {
            // Jangkar posisi diambil sebelum gambar ulang: elemen yang lama sudah lepas dari DOM.
            const rect = d.getBoundingClientRect();
            const pressed = stateOf(n) === 'pressed';
            update(n, { state: hasState('hover') ? 'hover' : 'default' });
            if (go && (pressed || !hasState('pressed'))) show(go);
            runTriggers(n, 'onClick', d, rect);
        });
    }

    function update(n, patch) {
        const cur = runtime.get(n.id) || {}, next = { ...cur, ...patch };
        if (['state', 'error', 'value'].every(k => next[k] === cur[k])) return;
        runtime.set(n.id, next);
        draw();
    }

    function draw() {
        const f = ctx.node(frameId);
        if (!f) return;
        const a = document.activeElement, keep = a?.dataset?.field, caret = a?.selectionStart;
        rendering = true;
        stage.replaceChildren();
        const nodes = buildScene(f), rootNode = nodes[0];
        const sc = Math.min(1, (root.clientWidth - 48) / rootNode.w, (root.clientHeight - 48) / rootNode.h);
        Object.assign(stage.style, { width: px(rootNode.w), height: px(rootNode.h), transform: `scale(${sc})` });
        renderScene(nodes).style.position = 'relative';
        const again = keep && stage.querySelector(`[data-field="${keep}"]`);
        if (again && !again.disabled) { again.focus({ preventScroll: true }); try { again.setSelectionRange(caret, caret); } catch { /* caret is not available on every input type */ } }
        rendering = false;
        pick_.value = frameId;
    }

    function show(id) { frameId = id; runtime.clear(); closeLayers('all'); draw(); }

    const bar = el('div', { position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', zIndex: 60, display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 10px', borderRadius: '10px', background: 'rgba(30,30,30,.9)', color: '#fff', font: '12px Inter, sans-serif' }, root);
    el('span', null, bar).textContent = 'Preview';
    const pick_ = el('select', { background: '#222', color: 'inherit', border: '1px solid rgba(255,255,255,.25)', borderRadius: '6px', font: 'inherit', padding: '2px 4px' }, bar);
    for (const f of ctx.frames) el('option', null, pick_).textContent = f.label, pick_.lastChild.value = f.id;
    pick_.onchange = () => show(pick_.value);
    const onKey = e => { if (e.key === 'Escape' && layers.length) { closeLayers('current'); e.stopPropagation(); } };
    const resize = () => draw();
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', resize);
    draw();
    return { close() { document.removeEventListener('keydown', onKey); window.removeEventListener('resize', resize); root.remove(); } };
}
