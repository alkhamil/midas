// Small framework to write a Midas design system the way the WDS file is built:
//   Primitives → Semantic (Light / Dark) → Size (small / middle / large) → one collection per component axis
//   (e.g. "Button type", "Button states") where mode = variant / state, and layers only bind to variables.
// Nodes are described as specs, bound properties are resolved against the variable modes in force, laid out with a small
// auto layout, and written as plain Midas nodes (with `vars` and `varModes`).

// ---------- ids ----------
let seq = 0;
export const uid = (p = 'n') => `${p}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const r2 = v => Math.round(v * 100) / 100;

// ---------- variable store ----------
export const store = { collections: [], items: [] };
const byName = new Map(), byKey = new Map();
export function addColl(name, modes) {
    const c = { id: uid('col'), name, modes: modes.map(m => ({ id: uid('mode'), name: m })), groups: [] };
    store.collections.push(c);
    byName.set(name, c);
    return c;
}
export const collOf = name => byName.get(name) || (() => { throw new Error(`no collection "${name}"`); })();
export const modeId = (coll, name) => (typeof coll === 'string' ? collOf(coll) : coll).modes.find(m => m.name === name)?.id;
/** Reference to another variable (an alias): ref('Semantic', 'colorPrimary'). */
export const ref = (coll, name) => ({ ref: `${coll}/${name}` });
/** A binding in a node spec: b('Size', 'button/height'). */
export const b = (coll, name) => ({ bind: `${coll}/${name}` });
const isBind = v => v && typeof v === 'object' && v.bind;
/**
 * addVar(coll, name, type, values): `values` is one value for every mode or an array with one value per mode.
 * A value is a literal, or ref(...) (alias, resolved in finish()).
 */
export function addVar(coll, name, type, values, desc = '') {
    const c = typeof coll === 'string' ? collOf(coll) : coll;
    const item = { id: uid('var'), collectionId: c.id, name, type, values: {}, description: desc, hidden: false, _spec: c.modes.map((m, i) => (Array.isArray(values) ? values[i] : values)) };
    store.items.push(item);
    byKey.set(`${c.name}/${name}`, item);
    return item;
}
export const lookup = key => byKey.get(key) || (() => { throw new Error(`no variable "${key}"`); })();
export const has = key => byKey.has(key);
export function finish() {
    for (const item of store.items) {
        const c = store.collections.find(x => x.id === item.collectionId);
        c.modes.forEach((m, i) => {
            const v = item._spec[i];
            item.values[m.id] = v && typeof v === 'object' && v.ref ? { alias: lookup(v.ref).id } : v;
        });
        delete item._spec;
    }
    return store;
}
/** Concrete value of a variable for the given modes ({ collectionName: modeName }), following aliases. */
export function resolveVar(item, modes, depth = 0) {
    const c = store.collections.find(x => x.id === item.collectionId);
    const want = modes?.[c.name], mid = (want && c.modes.find(m => m.name === want)?.id) || c.modes[0].id;
    let v = item.values?.[mid];
    if (v === undefined && item._spec) { const s = item._spec[c.modes.findIndex(m => m.id === mid)]; v = s; }
    if (v && typeof v === 'object' && v.ref) return resolveVar(lookup(v.ref), modes, depth + 1);
    if (v && typeof v === 'object' && v.alias) return resolveVar(store.items.find(i => i.id === v.alias), modes, depth + 1);
    return v;
}

// ---------- node specs ----------
const BASE = { rotation: 0, fill: 'none', fill2: '#cfe1fa', fillType: 'solid', gradientAngle: 90, fillOpacity: 1, stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, shadow: false, shadowColor: '#000000', shadowOpacity: 0.16, shadowBlur: 20, shadowX: 0, shadowY: 6, version: 0 };
const TEXT = { fontFamily: 'Inter', fontStyle: 'normal', letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto' };
export const frame = (name, o = {}, kids = []) => ({ t: 'frame', name, kids, ...o });
export const text = (s, o = {}) => ({ t: 'text', text: s, ...o });
export const ellipse = (name, o = {}) => ({ t: 'ellipse', name, kids: [], ...o });

const PAD = ['padT', 'padR', 'padB', 'padL'];
/** Resolve every bound property of a spec tree in place; records node variable bindings in spec.vars. */
export function bake(spec, inherited = {}) {
    const modes = { ...inherited, ...(spec.modes || {}) };
    spec._modes = modes;
    spec.vars = spec.vars || {};
    const take = (prop, key, v) => {
        if (!isBind(v)) return v;
        const item = lookup(v.bind);
        spec.vars[key] = item.id;
        return resolveVar(item, modes);
    };
    for (const p of ['w', 'h', 'gap', 'radius', 'sw', 'opacity', 'fs', 'fw', 'lh', 'minW', 'minH']) if (isBind(spec[p])) spec[p] = take(p, { sw: 'strokeWidth', fs: 'fontSize', fw: 'fontWeight', lh: 'lineHeight' }[p] || p, spec[p]);
    if (isBind(spec.fill)) spec.fill = take('fill', spec.t === 'text' ? 'fill' : 'fills.0', spec.fill);
    if (isBind(spec.stroke)) spec.stroke = take('stroke', 'stroke', spec.stroke);
    if (isBind(spec.visible)) spec.visible = take('visible', 'visible', spec.visible);
    if (isBind(spec.effects)) spec.effects = take('effects', 'effects', spec.effects);
    if (spec.pad) spec.pad = spec.pad.map((v, i) => take('pad', PAD[i], v));
    (spec.kids || []).forEach(k => bake(k, modes));
    return spec;
}

// ---------- layout ----------
const isNum = v => typeof v === 'number';
const charW = s => (s.mono ? 0.62 : s.fw >= 600 ? 0.6 : 0.55);
const textW = s => Math.ceil(String(s.text ?? '').length * (s.fs || 14) * charW(s));
export function size(s) {
    if (s.t === 'text') {
        s.nw = isNum(s.w) ? s.w : textW(s);
        const lh = (s.fs || 14) * (s.lh || 1.4286);
        const lines = isNum(s.w) ? String(s.text ?? '').split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length * (s.fs || 14) * charW(s) / s.w)), 0) : 1;
        s.nh = isNum(s.h) ? s.h : Math.ceil(lh * lines);
        return;
    }
    s.kids = s.kids || [];
    s.kids.forEach(size);
    const [pt, pr, pb, pl] = s.pad || [0, 0, 0, 0], g = s.gap || 0;
    const k = s.kids.filter(x => x.pos !== 'abs' && x.visible !== false);
    const wOf = x => (x.w === 'fill' ? 0 : x.nw), hOf = x => (x.h === 'fill' ? 0 : x.nh);
    let w = 0, h = 0;
    if (s.dir === 'h') { w = pl + pr + k.reduce((a, x) => a + wOf(x), 0) + g * Math.max(0, k.length - 1); h = pt + pb + Math.max(0, ...k.map(hOf)); }
    else if (s.dir === 'v') { w = pl + pr + Math.max(0, ...k.map(wOf)); h = pt + pb + k.reduce((a, x) => a + hOf(x), 0) + g * Math.max(0, k.length - 1); }
    s.nw = isNum(s.w) ? s.w : w;
    s.nh = isNum(s.h) ? s.h : h;
    if (isNum(s.minW)) s.nw = Math.max(s.nw, s.minW);
    if (isNum(s.minH)) s.nh = Math.max(s.nh, s.minH);
}
const sizing = v => (v === 'fill' ? 'fill' : isNum(v) ? 'fixed' : 'hug');
function toNode(s, id, parentId, x, y, w, h) {
    if (s.t === 'text') {
        const n = { id, type: 'text', name: s.name || String(s.text ?? 'Text').slice(0, 30), parentId, x: r2(x), y: r2(y), w: r2(w), h: r2(h), ...BASE, ...TEXT, fill: s.fill || '#262626', text: String(s.text ?? ''), fontSize: s.fs || 14, fontWeight: s.fw || 400, lineHeight: s.lh || 1.4286, autoW: !isNum(s.w) && s.w !== 'fill', ...(s.style || {}) };
        if (s.w === 'fill') n.layoutSizingH = 'fill';
        if (isNum(s.lh)) n.lineHeight = s.lh;
        if (s.cprop) n.propBind = { ...(n.propBind || {}), text: s.cprop };
        if (s.vars && Object.keys(s.vars).length) n.vars = { ...s.vars };
        if (s.extra) Object.assign(n, s.extra);
        return n;
    }
    const [pt, pr, pb, pl] = s.pad || [0, 0, 0, 0];
    const n = { id, type: s.t === 'ellipse' ? 'ellipse' : 'frame', name: s.name || 'Frame', parentId, x: r2(x), y: r2(y), w: r2(w), h: r2(h), ...BASE };
    if (s.fill && s.fill !== 'none') { n.fill = s.fill; n.fills = [{ type: 'solid', color: s.fill, opacity: 1, visible: true }]; }
    else n.fills = [];
    if (s.stroke && s.sw > 0) { n.stroke = s.stroke; n.strokeWidth = s.sw; n.strokeAlign = s.strokeAlign || 'inside'; if (s.dash) Object.assign(n, { strokeStyle: 'dash', strokeDash: 4, strokeGap: 3 }); }
    else if (s.stroke) n.stroke = s.stroke;
    if (s.radius) n.radius = s.radius;
    if (s.opacity !== undefined) n.opacity = s.opacity;
    if (s.clip) n.clip = true;
    if (s.visible === false) n.visible = false;
    if (s.effects) n.effects = structuredClone(s.effects);
    if (s.dir) Object.assign(n, { layout: s.dir === 'h' ? 'horizontal' : 'vertical', gap: s.gap || 0, gapAuto: false, padT: pt, padR: pr, padB: pb, padL: pl, padding: pl, layoutWrap: !!s.wrap, counterAlign: s.alignC || 'start', primaryAlign: s.alignP || 'start' });
    if (s.dir || s.w === 'fill' || s.h === 'fill') Object.assign(n, { layoutSizingH: sizing(s.w), layoutSizingV: sizing(s.h) });
    if (s.minW) n.minW = s.minW;
    if (s.vars && Object.keys(s.vars).length) n.vars = { ...s.vars };
    if (s.varModes) n.varModes = Object.fromEntries(Object.entries(s.varModes).map(([c, m]) => [collOf(c).id, modeId(c, m)]));
    if (s.pos === 'abs') n.layoutPositioning = 'absolute';
    if (s.extra) Object.assign(n, s.extra);
    return n;
}
/** Place a baked + sized spec at (x, y) with final size (w, h); pushes nodes (parents first) into out. */
export function place(s, x, y, w, h, parentId, out) {
    if (s.inst) { const sub = s.inst({ x, y, parentId }); out.push(...sub); s.node = sub[0]; return sub[0]; }
    const id = s.id || uid('n');
    s.id = id;
    const node = toNode(s, id, parentId, x, y, w, h);
    out.push(node);
    s.node = node;
    if (s.t === 'text') return node;
    const [pt, pr, pb, pl] = s.pad || [0, 0, 0, 0], g = s.gap || 0;
    const all = s.kids, flow = all.filter(c => c.pos !== 'abs' && c.visible !== false);
    const iw = w - pl - pr, ih = h - pt - pb;
    if (s.dir) {
        const horiz = s.dir === 'h', mainSize = horiz ? iw : ih;
        const nat = c => (horiz ? c.nw : c.nh), fillMain = flow.filter(c => (horiz ? c.w : c.h) === 'fill');
        const used = flow.reduce((a, c) => a + ((horiz ? c.w : c.h) === 'fill' ? 0 : nat(c)), 0) + g * Math.max(0, flow.length - 1);
        const share = fillMain.length ? Math.max(0, (mainSize - used) / fillMain.length) : 0;
        const mains = flow.map(c => ((horiz ? c.w : c.h) === 'fill' ? share : nat(c)));
        const total = mains.reduce((a, c) => a + c, 0) + g * Math.max(0, flow.length - 1);
        let cur = (s.alignP === 'center' ? (mainSize - total) / 2 : s.alignP === 'end' ? mainSize - total : 0) + (horiz ? pl : pt);
        const between = s.alignP === 'between' && flow.length > 1 ? Math.max(0, (mainSize - mains.reduce((a, c) => a + c, 0)) / (flow.length - 1)) : null;
        if (between !== null) cur = horiz ? pl : pt;
        flow.forEach((c, i) => {
            const cw = horiz ? mains[i] : (c.w === 'fill' ? iw : c.nw), ch = horiz ? (c.h === 'fill' ? ih : c.nh) : mains[i];
            const cross = horiz ? ih : iw, cs = horiz ? ch : cw;
            const off = (s.alignC === 'center' ? (cross - cs) / 2 : s.alignC === 'end' ? cross - cs : 0) + (horiz ? pt : pl);
            place(c, horiz ? cur : off, horiz ? off : cur, cw, ch, id, out);
            cur += mains[i] + (between !== null ? between : g);
        });
    }
    else flow.forEach(c => place(c, c.x ?? 0, c.y ?? 0, c.w === 'fill' ? iw : c.nw, c.h === 'fill' ? ih : c.nh, id, out));
    all.filter(c => c.pos === 'abs' && c.visible !== false).forEach(c => place(c, c.x ?? 0, c.y ?? 0, c.w === 'fill' ? w : c.nw, c.h === 'fill' ? h : c.nh, id, out));
    // hidden layers stay in the file (a boolean variable shows them): place them without taking room
    all.filter(c => c.visible === false).forEach(c => place(c, c.x ?? 0, c.y ?? 0, c.w === 'fill' ? w : c.nw, c.h === 'fill' ? h : c.nh, id, out));
    return node;
}
/** bake + size + place a spec; returns the flat node list. */
export function layout(spec, x = 0, y = 0, parentId = null, inherited = {}) {
    bake(spec, inherited);
    size(spec);
    const out = [];
    place(spec, x, y, spec.nw, spec.nh, parentId, out);
    return out;
}
