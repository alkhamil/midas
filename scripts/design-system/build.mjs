// Pembangun node dokumen Midas dengan auto layout (dipakai generator design system).
// Node yang dihasilkan memakai field engine Midas: layout/gap/padL…, layoutSizingH/V, vars (binding Variable),
// cprops/propBind (component property), sourceId/isInstance (instance). Posisi dihitung di sini
// (mirip engine) supaya file langsung rapi saat dibuka, dan auto layout tetap bisa diedit desainer.
import { FONT_FAMILY } from './tokens.mjs';

const BASE = { rotation: 0, opacity: 1, visible: true, locked: false, shadow: false, version: 0, fillType: 'solid', fillOpacity: 1, stroke: '#000000', strokeWidth: 0, radius: 0, clip: false };

/** Registry id: pakai ulang id dari file yang sudah ada (berdasarkan kunci nama) supaya library tetap kompatibel. */
export class Ids {
    constructor(existing = new Map()) {
        this.existing = existing;
        this.n = 0;
        this.used = new Set();
    }
    get(key) {
        const id = key && this.existing.get(key);
        if (id && !this.used.has(id)) {
            this.used.add(id);
            return id;
        }
        return this.fresh();
    }
    fresh() {
        const id = `ds-${(++this.n).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        this.used.add(id);
        return id;
    }
}

/** Variable store: nama → { id, value per mode }. `bind(node, prop, name)` mengikat properti ke Variable. */
export class Vars {
    constructor(ids) {
        this.ids = ids;
        this.collections = [];
        this.items = [];
        this.byName = new Map();
    }
    collection(name, modes) {
        const c = { id: this.ids.get(`coll:${name}`), name, modes: modes.map(m => ({ id: this.ids.get(`mode:${name}/${m}`), name: m })) };
        this.collections.push(c);
        return c;
    }
    add(coll, name, type, values, description = '') {
        const item = { id: this.ids.get(`var:${name}`), collectionId: coll.id, name, type, values: Object.fromEntries(coll.modes.map((m, i) => [m.id, values[i] ?? values[0]])), description };
        this.items.push(item);
        this.byName.set(name, { item, first: values[0] });
        return item;
    }
    /** Nilai mode pertama (untuk field node) + id Variable. */
    ref(name) {
        const v = this.byName.get(name);
        if (!v) throw new Error(`Variable ${name} tidak ada`);
        return v;
    }
    toJSON() {
        return { collections: this.collections, items: this.items };
    }
}

// ---------------------------------------------------------------- spesifikasi node (deklaratif)
// Frame : { kind:'frame', name, layout:'h'|'v'|null, gap, pad:[t,r,b,l], align:'start'|'center'|'end', justify:'start'|'center'|'end'|'between',
//          w:number|'hug'|'fill', h:number|'hug'|'fill', fill, stroke, strokeWidth, radius, shadow, clip, children, props(extra) }
// Text  : { kind:'text', text, size, weight, line, color, w:'hug'|'fill'|number, align }
// Icon  : { kind:'icon', svg|assetId, size, name }
// Inst  : { kind:'instance', of: componentRootId, props: { [cpropName]: value }, w, h }
export const frame = (props, children = []) => ({ kind: 'frame', layout: null, gap: 0, pad: [0, 0, 0, 0], align: 'start', justify: 'start', w: 'hug', h: 'hug', fill: 'none', children, ...props });
export const row = (props, children) => frame({ layout: 'h', align: 'center', ...props }, children);
export const col = (props, children) => frame({ layout: 'v', ...props }, children);
export const text = (value, props = {}) => ({ kind: 'text', text: String(value), size: 14, weight: 400, color: 'color/foreground', w: 'hug', ...props });
export const icon = (assetId, props = {}) => ({ kind: 'icon', assetId, size: 16, ...props });
export const instance = (of, props = {}, extra = {}) => ({ kind: 'instance', of, props, ...extra });
export const spacer = (w = 'fill', h = 1) => frame({ name: 'Spacer', w, h });

const pad4 = p => (typeof p === 'number' ? [p, p, p, p] : p.length === 2 ? [p[0], p[1], p[0], p[1]] : p);

/** Perkiraan lebar teks Inter (px). */
export function textWidth(s, size, weight = 400) {
    let w = 0;
    for (const ch of String(s)) {
        const k = /[ilI.,:;'!|]/.test(ch) ? 0.28 : /[mwMW@]/.test(ch) ? 0.82 : /[A-Z0-9]/.test(ch) ? 0.64 : /\s/.test(ch) ? 0.28 : 0.53;
        w += k * size;
    }
    return Math.ceil(w * (weight >= 600 ? 1.06 : weight >= 500 ? 1.03 : 1));
}

/** Jumlah baris bila teks dibungkus per kata pada lebar `w`. */
export function wrapLines(s, size, weight, w) {
    let lines = 1, cur = 0;
    const space = textWidth(' ', size, weight);
    for (const word of String(s).split(/\s+/)) {
        const ww = textWidth(word, size, weight);
        if (cur > 0 && cur + space + ww > w) {
            lines++;
            cur = ww;
        }
        else cur += (cur > 0 ? space : 0) + ww;
    }
    return lines;
}

/**
 * Hitung ukuran (hug) bottom-up. `ctx.components` dipakai untuk ukuran instance.
 * Mengembalikan spesifikasi dengan `_w/_h` intrinsik.
 */
function measure(spec, ctx) {
    if (spec.kind === 'text') {
        const line = spec.line ?? Math.round(spec.size * 1.43);
        const natural = textWidth(spec.text, spec.size, spec.weight);
        spec._w = typeof spec.w === 'number' ? spec.w : natural;
        // Lebar tetap: teks dibungkus per kata → tinggi = jumlah baris × line-height.
        spec._h = typeof spec.h === 'number' ? spec.h : line * (typeof spec.w === 'number' ? wrapLines(spec.text, spec.size, spec.weight, spec.w) : 1);
        return spec;
    }
    if (spec.kind === 'icon') {
        spec._w = spec._h = spec.size;
        return spec;
    }
    if (spec.kind === 'instance') {
        const src = ctx.components.get(spec.of);
        if (!src) throw new Error(`Instance dari komponen yang belum dibangun: ${spec.of}`);
        spec._w = typeof spec.w === 'number' ? spec.w : src.w;
        spec._h = typeof spec.h === 'number' ? spec.h : src.h;
        return spec;
    }
    const kids = spec.children.filter(Boolean);
    kids.forEach(k => measure(k, ctx));
    const [pt, pr, pb, pl] = pad4(spec.pad);
    const flow = kids.filter(k => !k.absolute);
    if (spec.layout === 'h') {
        spec._w = pl + pr + flow.reduce((t, k) => t + (k.w === 'fill' ? 0 : k._w), 0) + spec.gap * Math.max(0, flow.length - 1);
        spec._h = pt + pb + Math.max(0, ...flow.map(k => (k.h === 'fill' ? 0 : k._h)));
    }
    else if (spec.layout === 'v') {
        spec._w = pl + pr + Math.max(0, ...flow.map(k => (k.w === 'fill' ? 0 : k._w)));
        spec._h = pt + pb + flow.reduce((t, k) => t + (k.h === 'fill' ? 0 : k._h), 0) + spec.gap * Math.max(0, flow.length - 1);
    }
    else {
        spec._w = Math.max(0, ...kids.map(k => (k.x ?? 0) + k._w));
        spec._h = Math.max(0, ...kids.map(k => (k.y ?? 0) + k._h));
    }
    if (typeof spec.w === 'number') spec._w = spec.w;
    if (typeof spec.h === 'number') spec._h = spec.h;
    return spec;
}

/** Tempatkan anak top-down (fill membagi sisa ruang). */
function place(spec, w, h) {
    spec._w = w;
    spec._h = h;
    if (spec.kind !== 'frame') return;
    const kids = spec.children.filter(Boolean), flow = kids.filter(k => !k.absolute);
    const [pt, pr, pb, pl] = pad4(spec.pad);
    const innerW = w - pl - pr, innerH = h - pt - pb;
    if (spec.layout === 'h' || spec.layout === 'v') {
        const H = spec.layout === 'h';
        const main = k => (H ? k._w : k._h), fillMain = k => (H ? k.w : k.h) === 'fill';
        const fixed = flow.filter(k => !fillMain(k)).reduce((t, k) => t + main(k), 0) + spec.gap * Math.max(0, flow.length - 1);
        const fills = flow.filter(fillMain), free = Math.max(0, (H ? innerW : innerH) - fixed);
        const each = fills.length ? free / fills.length : 0;
        let gap = spec.gap, cursor = H ? pl : pt;
        const used = fixed + each * fills.length;
        if (spec.justify === 'center') cursor += Math.max(0, ((H ? innerW : innerH) - used) / 2);
        if (spec.justify === 'end') cursor += Math.max(0, (H ? innerW : innerH) - used);
        if (spec.justify === 'between' && flow.length > 1 && !fills.length) gap += Math.max(0, ((H ? innerW : innerH) - used) / (flow.length - 1));
        for (const k of flow) {
            const kMain = fillMain(k) ? each : main(k);
            const crossFill = (H ? k.h : k.w) === 'fill';
            const kCross = crossFill ? (H ? innerH : innerW) : (H ? k._h : k._w);
            const crossSpace = (H ? innerH : innerW) - kCross;
            const off = spec.align === 'center' ? crossSpace / 2 : spec.align === 'end' ? crossSpace : 0;
            k._x = H ? cursor : pl + off;
            k._y = H ? pt + off : cursor;
            place(k, H ? kMain : kCross, H ? kCross : kMain);
            cursor += kMain + gap;
        }
    }
    for (const k of kids) {
        if (spec.layout && !k.absolute) continue;
        k._x = k.x ?? 0;
        k._y = k.y ?? 0;
        place(k, k.w === 'fill' ? innerW : k._w, k.h === 'fill' ? innerH : k._h);
    }
}

/** Bangun node engine dari spesifikasi. Mengembalikan daftar node (root dulu). */
/**
 * `key` = kunci stabil node root (mis. "variant:Button/Variant=Primary, Size=Sm"); anak mendapat kunci
 * turunan (`<key>/<index>`) yang disimpan di `dsKey`, sehingga id layer sama setiap generator dijalankan ulang.
 */
export function build(spec, ctx, { parentId = null, x = 0, y = 0, id, key } = {}) {
    measure(spec, ctx);
    place(spec, spec._w, spec._h);
    const out = [];
    emit(spec, ctx, out, parentId, x, y, id ?? ctx.ids.get(key && `node:${key}`), key);
    return out;
}

function color(ctx, value, node, prop) {
    if (!value || value === 'none') return 'none';
    if (/^(color|radius)\//.test(value) || ctx.vars.byName.has(value)) {
        const ref = ctx.vars.ref(value);
        (node.vars ||= {})[prop] = ref.item.id;
        return ref.first;
    }
    return value;
}

function emit(spec, ctx, out, parentId, x, y, id, key) {
    const r = v => Math.round(v * 100) / 100;
    const node = { ...BASE, id, name: spec.name || spec.kind, parentId, x: r(x), y: r(y), w: r(spec._w), h: r(spec._h), ...(key ? { dsKey: key } : {}) };
    if (spec.kind === 'text') {
        Object.assign(node, {
            type: 'text', name: spec.name || spec.text.slice(0, 40), text: spec.text, fontFamily: FONT_FAMILY, fontSize: spec.size, fontWeight: spec.weight, fontStyle: 'normal',
            lineHeight: (spec.line ?? Math.round(spec.size * 1.43)) / spec.size, letterSpacing: spec.letterSpacing ?? 0, textAlign: spec.align || 'left', textDecoration: 'none', textCase: 'none', direction: 'auto',
            autoW: spec.w === 'hug', fill: 'none', ...(spec.bind ? { propBind: { text: spec.bind } } : {}),
        });
        node.fill = color(ctx, spec.color, node, 'fill');
        if (spec.opacity != null) node.opacity = spec.opacity;
        out.push(node);
        return node;
    }
    if (spec.kind === 'icon') {
        Object.assign(node, { type: 'image', name: spec.name || 'Icon', assetId: spec.assetId, fill: 'none', lockRatio: true });
        if (spec.opacity != null) node.opacity = spec.opacity;
        out.push(node);
        return node;
    }
    if (spec.kind === 'instance') {
        instantiate(spec, ctx, out, parentId, node);
        return node;
    }
    Object.assign(node, { type: 'frame', fill: 'none', clip: !!spec.clip, ...(spec.props || {}) });
    node.fill = color(ctx, spec.fill, node, 'fill');
    if (spec.fillOpacity != null) node.fillOpacity = spec.fillOpacity;
    if (spec.stroke) {
        node.stroke = color(ctx, spec.stroke, node, 'stroke');
        node.strokeWidth = spec.strokeWidth ?? 1;
        node.strokeAlign = spec.strokeAlign || 'inside';
        if (spec.strokeSides) Object.assign(node, { strokeT: spec.strokeSides[0], strokeR: spec.strokeSides[1], strokeB: spec.strokeSides[2], strokeL: spec.strokeSides[3], strokeSides: true });
    }
    if (spec.radius != null) {
        if (typeof spec.radius === 'string') {
            const ref = ctx.vars.ref(spec.radius);
            (node.vars ||= {}).radius = ref.item.id;
            node.radius = ref.first;
        }
        else node.radius = spec.radius;
    }
    if (spec.shadow) Object.assign(node, { shadow: true, shadowColor: '#0F172A', shadowOpacity: spec.shadow.opacity, shadowBlur: spec.shadow.blur, shadowX: spec.shadow.x, shadowY: spec.shadow.y });
    if (spec.opacity != null) node.opacity = spec.opacity;
    if (spec.layout) {
        const [pt, pr, pb, pl] = pad4(spec.pad);
        Object.assign(node, {
            layout: spec.layout === 'h' ? 'horizontal' : 'vertical', gap: spec.gap, padding: pl, padL: pl, padT: pt, padR: pr, padB: pb,
            primaryAlign: spec.justify === 'between' ? 'start' : spec.justify, gapAuto: spec.justify === 'between', counterAlign: spec.align, layoutWrap: false,
            layoutSizingH: spec.w === 'hug' ? 'hug' : spec.w === 'fill' ? 'fill' : 'fixed', layoutSizingV: spec.h === 'hug' ? 'hug' : spec.h === 'fill' ? 'fill' : 'fixed',
        });
    }
    else {
        if (spec.w === 'fill') node.layoutSizingH = 'fill';
        if (spec.h === 'fill') node.layoutSizingV = 'fill';
    }
    out.push(node);
    spec.children.filter(Boolean).forEach((k, i) => {
        const childKey = key ? `${key}/${i}` : undefined;
        const child = emit(k, ctx, out, node.id, k._x, k._y, ctx.ids.get(childKey && `node:${childKey}`), childKey);
        if (spec.layout && k.w === 'fill') child.layoutSizingH = 'fill';
        if (spec.layout && k.h === 'fill') child.layoutSizingV = 'fill';
        if (k.absolute) child.layoutPositioning = 'absolute';
    });
    return node;
}

/** Instance = salinan subtree komponen (seperti instantiate() di engine), teks diisi dari component property. */
function instantiate(spec, ctx, out, parentId, node) {
    const src = ctx.components.get(spec.of);
    const subtree = ctx.subtree(src.id);
    const map = new Map(subtree.map(n => [n.id, n.id === src.id ? node.id : ctx.ids.fresh()]));
    const holder = ctx.propHolder(src);
    const propValues = {};
    for (const [name, value] of Object.entries(spec.props || {})) {
        const cp = holder?.cprops?.find(p => p.name === name);
        if (cp) propValues[cp.id] = value;
    }
    for (const s of subtree) {
        const n = structuredClone(s);
        n.id = map.get(s.id);
        n.sourceId = s.id;
        n.component = false;
        n.isInstance = s.id === src.id;
        n.overrides = {};
        delete n.cprops;
        delete n.variant;
        if (s.id === src.id) {
            Object.assign(n, { parentId, x: node.x, y: node.y, name: spec.name || ctx.componentName(src), propValues });
            if (spec.w === 'fill') n.layoutSizingH = 'fill';
            if (typeof spec.w === 'number' || spec.w === 'fill') {
                n.w = node.w;
                n.overrides.w = true;
            }
            if (typeof spec.h === 'number') {
                n.h = node.h;
                n.overrides.h = true;
            }
        }
        else n.parentId = map.get(s.parentId);
        const bound = s.propBind?.text && Object.hasOwn(propValues, s.propBind.text);
        if (bound) n.text = propValues[s.propBind.text];
        // Layer berukuran penuh lebar root ikut melebar bila instance dilebarkan.
        if (s.id !== src.id && n.w === src.w && node.w !== src.w && s.parentId === src.id) n.w = node.w - (s.x * 2);
        out.push(n);
    }
}
