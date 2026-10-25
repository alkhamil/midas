// defineComponent: the variable collections, the component set and the showcase of one component, built the WDS way.
//
//   <Component> <axis>     modes = looks of the component (type / variant / status …); variables per property × state
//   <Component> states     modes = default / hover / pressed / disabled / focused …; each variable aliases the axis variable
//   Size                   small / middle / large rows named <component>/<key>
//   layers bind to "<Component> states" (colours) and "Size" (metrics); the instance picks modes (varModes)
import { addColl, addVar, b, collOf, frame, layout, lookup, modeId, ref, store, text, uid } from './lib.mjs';
import { sizeVars } from './system.mjs';

const SUFFIX = {};
const ALL = [];
export const registry = ALL;

const tokenValue = v => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === 'number') return v;
    if (v.startsWith('#')) return v;
    const [c, n] = v.split(':');
    return ref(c, n);
};
const stateName = (prop, suffix, state) => `${prop}${suffix}${state === 'default' ? '' : '-' + state}`;

/**
 * def = {
 *   key: 'button', name: 'Button', category: 'General', description,
 *   axis: { coll: 'Button type', modes: ['default', 'primary', …] },          // looks (one mode when the component has one look)
 *   states: { coll: 'Button states', modes: ['default', 'hover', …] },
 *   props: { bg: 'color/background', text: 'color/text', stroke: 'color/stroke' },   // colour properties: name → variable name
 *   tokens: { primary: { bg: { default: 'Semantic:bg/brand', hover: … }, sw: 1 } },   // per look; a plain string = every state
 *   variants: { Danger: { No: '', Yes: '-danger' } },                           // variant properties of the set → variable suffix
 *   suffixTokens: { '-danger': { primary: {…} } },                              // tokens of the suffixed series
 *   sizes: { height: [24, 32, 40] },                                            // Size/<key>/…
 *   tree: ({ st, sz, v, props }) => spec,                                       // st('bg') → state binding, sz('height') → Size binding
 *   text: { prop: 'Label', def: 'Button' }                                      // component text property bound to the layer using cprop
 * }
 */
export function defineComponent(def) {
    const axis = def.axis || { coll: `${def.name} styles`, modes: ['default'] };
    const states = def.states || null;
    const collsUsed = new Set();
    const axisColl = axis.use ? collOf(axis.coll) : addColl(axis.coll, axis.modes);
    collsUsed.add(axis.coll);
    const stCollName = states?.coll;
    if (states) { if (!states.use) addColl(stCollName, states.modes); collsUsed.add(stCollName); }
    const stateModes = states ? states.modes : ['default'];
    const series = axis.use ? [] : [['', def.tokens], ...Object.entries(def.suffixTokens || {})];
    // ---- axis variables: one per property × state (× suffix); the value differs per look
    for (const [suffix, table] of series) {
        for (const [prop, vname] of Object.entries(def.props || {})) {
            const defined = new Set(['default']);
            for (const m of axis.modes) { const t = table?.[m]?.[prop]; if (t && typeof t === 'object') Object.keys(t).forEach(s => defined.add(s)); }
            for (const s of stateModes) {
                if (!defined.has(s)) continue;
                const per = axis.modes.map(m => {
                    const t = table?.[m]?.[prop] ?? table?.[axis.modes[0]]?.[prop];
                    const v = typeof t === 'object' ? (t[s] ?? t.default) : t;
                    return tokenValue(v) ?? '#00000000';
                });
                addVar(axis.coll, stateName(vname, suffix, s), 'color', per);
            }
            // states variable: the same name, per state mode an alias of the matching axis variable
            if (states && !states.use) addVar(stCollName, `${vname}${suffix}`, 'color', stateModes.map(s => ref(axis.coll, stateName(vname, suffix, defined.has(s) ? s : 'default'))));
        }
        // numeric look properties (border width …)
        for (const k of Object.keys(def.numeric || {})) {
            const per = axis.modes.map(m => tokenValue(table?.[m]?.[k] ?? def.numeric[k]));
            if (suffix === '') addVar(axis.coll, k, 'number', per);
        }
    }
    // boolean state variables (focus ring visible …): true in the listed states
    for (const [name, on] of Object.entries(def.stateBools || {})) if (states && !states.use) addVar(stCollName, name, 'boolean', stateModes.map(s => on.includes(s)));
    // effect (shadow) variables per state: name → { state → 'Semantic:elevation/…' }
    for (const [name, map] of Object.entries(def.stateEffects || {})) if (states && !states.use) addVar(stCollName, name, 'effect', stateModes.map(s => tokenValue(map[s] ?? map.default)));
    // extra collections with their own modes (e.g. "Button icon": none / start / end / only)
    for (const c of def.colls || []) { addColl(c.name, c.modes); collsUsed.add(c.name); for (const v of c.vars) addVar(c.name, v.name, v.type, v.values); }
    if (def.sizes) sizeVars(def.key, def.sizes);
    // ---- modes in force when a layer is baked: first look, default state, middle size, light theme
    const baseModes = { [axis.coll]: axis.modes[0], Size: 'middle', Semantic: 'Light' };
    if (states) baseModes[stCollName] = states.modes[0];
    for (const c of def.colls || []) baseModes[c.name] = c.modes[0];
    const ctx = suffix => ({
        st: prop => b(stCollName || axis.coll, `${def.props[prop]}${suffix}`),
        ax: k => b(axis.coll, k),
        sz: k => b('Size', `${def.sizeKey || def.key}/${k}`),
        gs: k => b('Size', k),
        x: (coll, k) => b(coll, k),
        sf: k => b(stCollName, k),
        sem: k => b('Semantic', k),
    });
    const entry = { def, axis, states, collsUsed, baseModes, nodes: null, variantNodes: new Map(), set: null };
    /** A fresh spec tree for a variant (props = { Danger: 'Yes', … }) read in the given modes. */
    entry.make = (props = {}, modes = {}, extra = {}) => {
        const suffix = Object.entries(def.variants || {}).map(([k, vals]) => vals[props[k] ?? Object.keys(vals)[0]] ?? '').join('');
        const spec = def.tree({ ...ctx(suffix), v: props, props, label: extra.label ?? def.text?.def, ...extra });
        spec.modes = { ...baseModes, ...modes, ...(spec.modes || {}) };
        return spec;
    };
    ALL.push(entry);
    return entry;
}

/** Every combination of the variant properties: [{ Danger: 'No' }, { Danger: 'Yes' }, …] (one empty object without any). */
export const combos = def => Object.entries(def.variants || {}).reduce((acc, [k, vals]) => acc.flatMap(a => Object.keys(vals).map(v => ({ ...a, [k]: v }))), [{}]);

const varModesOf = (entry, modes) => {
    const out = {};
    for (const name of [...entry.collsUsed, 'Size']) out[name] = modes[name] || entry.baseModes[name];
    return out;
};

/** The component set: one main component per combination of the variant properties (mode defaults stored on each). */
export function buildSet(entry, x, y) {
    const { def } = entry;
    const list = combos(def);
    const specs = list.map(props => entry.make(props, {}));
    specs.forEach(s => { s.varModes = varModesOf(entry, s.modes); });
    const built = specs.map(s => { const out = layout(s, 0, 0, null); return out; });
    const gap = 24, cols = Math.min(4, list.length);
    const cw = Math.max(...built.map(n => n[0].w)), ch = Math.max(...built.map(n => n[0].h));
    const rows = Math.ceil(list.length / cols);
    const setId = uid('set');
    const cprops = def.text ? [{ id: uid('cp'), def: def.text.def, name: def.text.prop, type: 'text' }] : [];
    const setNode = { id: setId, type: 'frame', name: def.name, parentId: null, x, y, w: cols * (cw + gap) + gap, h: rows * (ch + gap) + gap, rotation: 0, fill: 'none', fill2: '#cfe1fa', fillType: 'solid', gradientAngle: 90, fillOpacity: 1, stroke: '#9747FF', strokeWidth: 1, radius: 8, opacity: 1, visible: true, locked: false, clip: false, shadow: false, shadowColor: '#000000', shadowOpacity: 0.16, shadowBlur: 20, shadowX: 0, shadowY: 6, version: 0, componentSet: true, ...(cprops.length ? { cprops } : {}), strokeGap: 4, strokeDash: 6, strokeAlign: 'center', strokeStyle: 'dash' };
    const nodes = [setNode];
    built.forEach((out, i) => {
        const dx = gap + (i % cols) * (cw + gap), dy = gap + Math.floor(i / cols) * (ch + gap);
        const root = out[0];
        root.x = dx; root.y = dy; root.parentId = setId;
        root.name = Object.entries(list[i]).map(([k, v]) => `${k}=${v}`).join(', ') || def.name;
        if (Object.keys(list[i]).length) root.variant = { ...list[i] };
        root.component = true;
        root.varModes = Object.fromEntries(Object.entries(specs[i].varModes).map(([c, m]) => [collOf(c).id, modeId(c, m)]));
        if (cprops.length) for (const n of out) if (n.type === 'text' && n.propBind?.text === def.text.prop) n.propBind.text = cprops[0].id;
        nodes.push(...out);
        entry.variantNodes.set(JSON.stringify(list[i]), out);
    });
    entry.set = setNode;
    entry.cprops = cprops;
    return { nodes, w: setNode.w, h: setNode.h };
}

/**
 * A slot spec for layouts: an instance of one variant, read in the given modes (varModes on the instance), with its
 * text property set to `label`. Size is measured first so the parent can lay it out.
 */
export function instanceSpec(entry, props = {}, modes = {}, label = null, extra = {}) {
    const { def } = entry;
    const key = JSON.stringify(combos(def).find(c => Object.entries(props).every(([k, v]) => c[k] === v)) || combos(def)[0]);
    const main = entry.variantNodes.get(key);
    if (!main) throw new Error(`${def.name}: variant ${key} not built (build the set first)`);
    const spec = entry.make(JSON.parse(key), modes, { ...extra, ...(label !== null ? { label } : {}) });
    spec.varModes = varModesOf(entry, spec.modes);
    const probe = layout(structuredClone(spec), 0, 0, null);
    const w = probe[0].w, h = probe[0].h;
    return {
        t: 'frame', name: def.name, w, h, kids: [], noBake: true,
        inst: ({ x, y, parentId }) => {
            const out = layout(entry.make(JSON.parse(key), modes, { ...extra, ...(label !== null ? { label } : {}) }), x, y, parentId);
            out.forEach((n, i) => {
                const m = main[i];
                if (!m) return;
                n.sourceId = m.id; n.component = false; n.overrides = {}; n.isInstance = i === 0;
                delete n.variant;
            });
            const root = out[0];
            root.varModes = Object.fromEntries(Object.entries(varModesOf(entry, spec.modes)).map(([c, mm]) => [collOf(c).id, modeId(c, mm)]));
            root.name = def.name;
            if (entry.cprops?.length) {
                const pid = entry.cprops[0].id;
                const lab = label ?? def.text.def;
                root.propValues = { [pid]: lab };
                for (const n of out) if (n.type === 'text' && n.propBind?.text === def.text.prop) { n.propBind.text = pid; n.text = lab; }
            }
            return out;
        },
    };
}
export { lookup, store, text, frame };
