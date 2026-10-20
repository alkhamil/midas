// Deterministic React code from a component in a design file (visual layer).
//
// A component (or component set with its variants) becomes: a props contract, a TSX component and a CSS file.
//   - auto layout → flexbox, sizing (fixed / hug / fill) → width / flex rules, fills / strokes / radius / effects → CSS
//   - variables bound to a property → `var(--theme-…, fallback)` (same names as the Library Kit tokens)
//   - variants → props (data attributes on the root); the default variant is the base style, the others only add what differs
//   - component properties: text → string prop, boolean → show / hide, instance swap → node prop, slot → children
//   - states (Hover, Pressed, Focus, Disabled …) → CSS pseudo-classes / data attributes instead of props
//   - nested instances → the component's own element; icons and vectors → inline SVG
// The design is read through `ctx` (see midas.js, codegenContext) so this file knows nothing about the editor.

const words = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
export const pascalCase = s => { const o = words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''); return /^[A-Z]/.test(o) ? o : `Component${o}`; };
export const camelCase = s => { const p = words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''); const o = p ? p[0].toLowerCase() + p.slice(1) : ''; return /^[a-z]/.test(o) ? o : `prop${p}`; };
export const kebabCase = s => words(s).map(w => w.toLowerCase()).join('-') || 'default';
/** The CSS variable of a design variable, named like the Library Kit tokens ("color/primary" → --theme-primary). */
export function tokenVar(name, type) {
    const parts = String(name).split('/').map(s => s.trim()).filter(Boolean);
    if (type === 'color' && parts.length > 1 && /^colou?rs?$/i.test(parts[0]))
        parts.shift();
    return `--theme-${words(parts.join(' ')).map(w => w.toLowerCase()).join('-')}`;
}

const SEP = '\u0001';
const STATE_SELECTOR = { hover: ':hover', hovered: ':hover', pressed: ':active', active: ':active', focus: ':focus-visible', focused: ':focus-visible' };
const STATE_REST = new Set(['default', 'rest', 'enabled', 'normal', 'idle']);
const VOID_TAGS = new Set(['img', 'input', 'hr', 'br']);
const px = v => `${+(+v).toFixed(2)}px`;
const hex6 = c => /^#[\da-f]{6}$/i.test(c) ? c : /^#[\da-f]{3}$/i.test(c) ? '#' + c.slice(1).split('').map(x => x + x).join('') : /^#[\da-f]{8}$/i.test(c) ? c.slice(0, 7) : '#000000';
const alphaOf = c => /^#[\da-f]{8}$/i.test(c) ? parseInt(c.slice(7), 16) / 255 : 1;

function color(hex, opacity = 1, token = null) {
    const h = hex6(hex || '#000000'), a = opacity * alphaOf(hex || '');
    const rgb = `${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}`;
    if (token)
        return a >= .999 ? `var(${token}, ${h})` : `color-mix(in srgb, var(${token}, ${h}) ${+(a * 100).toFixed(1)}%, transparent)`;
    return a >= .999 ? h : `rgba(${rgb}, ${+a.toFixed(3)})`;
}

/**
 * Generate the code of one component.
 * @param ctx   design access (see codegenContext in midas.js)
 * @param holder  a component set, or a component that is not part of a set
 */
export function generateComponent(ctx, holder, opts = {}) {
    const code = holder.code || {};
    const warnings = [];
    const isSet = !!holder.componentSet;
    const variants = isSet ? ctx.variants(holder) : [holder];
    if (!variants.length)
        return { exportName: pascalCase(holder.name), props: [], tsx: '', css: '', ir: null, warnings: ['This component set has no variants.'], deps: [] };
    const base = variants[0];
    const exportName = code.exportName || pascalCase(holder.name); // the whole name, like the publish form: "Pro/Mini" → ProMini
    const block = kebabCase(exportName);
    const rootTag = code.element || 'div';
    const deps = new Map(); // nested components this one uses: export name → holder

    // ---------------- props ----------------
    const props = [], taken = new Set(['className', 'style', 'children']);
    const uniq = name => { let n = name, i = 2; while (taken.has(n)) n = `${name}${i++}`; taken.add(n); return n; };
    const override = key => code.props?.[key] || {};
    const variantKeys = isSet ? [...new Set(variants.flatMap(v => Object.keys(v.variant || {})))] : [];
    const roles = {}, stateOf = {}; // role per variant property; state value → how it is expressed
    for (const k of variantKeys) {
        const vals = [...new Set(variants.map(v => v.variant?.[k]).filter(x => x !== undefined))];
        const guess = /^(state|status|interaction)$/i.test(k) && vals.some(v => STATE_SELECTOR[String(v).toLowerCase()] || STATE_REST.has(String(v).toLowerCase())) ? 'state' : 'prop';
        roles[k] = code.variantRoles?.[k] || guess;
        const def = base.variant?.[k];
        if (roles[k] === 'state') {
            for (const v of vals) {
                const lv = String(v).toLowerCase();
                if (STATE_REST.has(lv) || v === def)
                    stateOf[`${k}=${v}`] = { rest: true };
                else if (STATE_SELECTOR[lv])
                    stateOf[`${k}=${v}`] = { pseudo: STATE_SELECTOR[lv] };
                else {
                    const p = { key: `s:${k}:${v}`, source: 'state', type: 'boolean', label: String(v), def: false };
                    p.name = uniq(override(p.key).name || camelCase(v));
                    p.attr = `data-${kebabCase(v)}`;
                    props.push(p);
                    stateOf[`${k}=${v}`] = { attr: p.attr };
                }
            }
        }
        else {
            const boolLike = vals.length === 2 && vals.every(x => /^(true|false|yes|no|on|off)$/i.test(x));
            const p = { key: `v:${k}`, source: 'variant', label: k, vkey: k };
            p.name = uniq(override(p.key).name || camelCase(k));
            if (boolLike || roles[k] === 'boolean') {
                p.type = 'boolean';
                p.trueValue = vals.find(x => /^(true|yes|on)$/i.test(x)) ?? vals[0];
                p.def = String(def) === String(p.trueValue);
                p.attr = `data-${kebabCase(k)}`;
            }
            else {
                p.type = 'enum';
                p.values = Object.fromEntries(vals.map(x => [x, kebabCase(x)]));
                p.def = p.values[def] ?? Object.values(p.values)[0];
                p.attr = `data-${kebabCase(k)}`;
            }
            props.push(p);
        }
    }
    const cprops = holder.cprops || [];
    const cpropBy = new Map();
    for (const c of cprops) {
        const t = { text: 'string', boolean: 'boolean', instance: 'node', slot: 'node' }[c.type];
        if (!t)
            continue;
        const p = { key: `c:${c.id}`, source: c.type, type: t, label: c.name, cid: c.id };
        p.name = c.type === 'slot' && !props.some(x => x.name === 'children') && !taken.has('children__') ? 'children' : uniq(override(p.key).name || camelCase(c.name));
        if (p.name === 'children')
            taken.add('children__');
        p.def = c.def;
        props.push(p);
        cpropBy.set(c.id, p);
    }
    // events
    for (const ev of code.events || []) {
        if (!ev?.name)
            continue;
        props.push({ key: `e:${ev.name}`, source: 'event', type: 'function', name: ev.name, label: ev.name, part: ev.part || '', sig: ev.sig || '(event: React.SyntheticEvent) => void' });
        taken.add(ev.name);
    }

    // ---------------- styles of a node ----------------
    const sizing = (n, axis) => ctx.sizing(n, axis);
    function styleOf(n, parent, isRoot) {
        const d = {};
        if (n.visible === false)
            d.display = 'none';
        const pAuto = !!parent && ctx.isAuto(parent) && n.layoutPositioning !== 'absolute', horiz = pAuto && parent.layout === 'horizontal';
        const sh = sizing(n, 'h'), sv = sizing(n, 'v'), isText = n.type === 'text';
        // size and position
        if (isRoot) {
            if (sh === 'fill')
                d.width = '100%';
            else if (sh === 'fixed')
                d.width = px(n.w);
            if (sv === 'fixed')
                d.height = px(n.h);
            else if (sv === 'fill')
                d.height = '100%';
        }
        else if (pAuto) {
            if (sh === 'fill') {
                if (horiz) { d.flex = '1 1 0'; d['min-width'] = '0'; }
                else d['align-self'] = 'stretch';
            }
            else if (sh === 'fixed') {
                d.width = px(n.w);
                if (horiz) d['flex-shrink'] = '0';
            }
            if (sv === 'fill') {
                if (!horiz) { d.flex = '1 1 0'; d['min-height'] = '0'; }
                else d['align-self'] = 'stretch';
            }
            else if (sv === 'fixed' && !isText) {
                d.height = px(n.h);
                if (!horiz) d['flex-shrink'] = '0';
            }
        }
        else if (parent) {
            d.position = 'absolute';
            d.left = px(n.x);
            d.top = px(n.y);
            if (sh !== 'hug' || !isText)
                d.width = px(n.w);
            if (!isText)
                d.height = px(n.h);
        }
        if (n.minW != null) d['min-width'] = px(n.minW);
        if (n.maxW != null) d['max-width'] = px(n.maxW);
        if (n.minH != null) d['min-height'] = px(n.minH);
        if (n.maxH != null) d['max-height'] = px(n.maxH);
        if (n.rotation)
            d.transform = `rotate(${+(+n.rotation).toFixed(2)}deg)`;
        if (n.opacity != null && n.opacity < 1)
            d.opacity = String(+(+n.opacity).toFixed(3));
        // containers
        const container = ['frame', 'group'].includes(n.type) || n.booleanOp;
        if (container) {
            if (ctx.isAuto(n)) {
                const pads = ctx.pads(n);
                d.display = d.display || 'flex';
                d['flex-direction'] = n.layout === 'horizontal' ? 'row' : 'column';
                const g = n.gap ?? 16;
                if (n.gapAuto)
                    d['justify-content'] = { evenly: 'space-evenly', around: 'space-around' }[n.gapMode] || 'space-between';
                else {
                    if (g) d.gap = px(g);
                    const pa = n.primaryAlign || 'start';
                    if (pa !== 'start') d['justify-content'] = pa === 'center' ? 'center' : 'flex-end';
                }
                const ca = n.counterAlign || n.layoutAlign || 'start';
                d['align-items'] = ca === 'center' ? 'center' : ca === 'end' ? 'flex-end' : ca === 'baseline' ? 'baseline' : 'flex-start';
                if (n.layoutWrap) {
                    d['flex-wrap'] = 'wrap';
                    const gc = n.gapCross ?? g;
                    if (gc !== g) d['row-gap'] = px(gc);
                }
                if (pads.t || pads.r || pads.b || pads.l)
                    d.padding = pads.t === pads.b && pads.l === pads.r ? (pads.t === pads.l ? px(pads.t) : `${px(pads.t)} ${px(pads.l)}`) : `${px(pads.t)} ${px(pads.r)} ${px(pads.b)} ${px(pads.l)}`;
                if (n.layout === 'grid')
                    warnings.push(`"${n.name}": grid auto layout is exported as a flex row.`);
            }
            else
                d.position = d.position || 'relative';
            if (ctx.isAuto(n) && ctx.kids(n.id).some(c => c.layoutPositioning === 'absolute'))
                d.position = d.position || 'relative';
            if (n.type === 'frame' && n.clip)
                d.overflow = 'hidden';
        }
        // fills
        const fills = ctx.fills(n).filter(f => f.visible !== false);
        if (isText) {
            const f = fills[0];
            if (f && f.type === 'solid')
                d.color = color(f.color, f.opacity ?? 1, ctx.token(n, 'fills.0') || ctx.token(n, 'fill'));
        }
        else if (fills.length && n.type !== 'group') {
            const layers = [];
            let flat = null;
            fills.forEach((f, i) => {
                if (f.type === 'solid') {
                    const c = color(f.color, f.opacity ?? 1, ctx.token(n, `fills.${i}`) || (i === 0 ? ctx.token(n, 'fill') : null));
                    if (fills.length === 1) flat = c; else layers.push(`linear-gradient(${c}, ${c})`);
                }
                else if (f.type === 'linear') {
                    const stops = f.stops?.length ? f.stops.map(s => `${color(s.color, (s.opacity ?? 1) * (f.opacity ?? 1))} ${+(s.position * 100).toFixed(1)}%`) : [color(f.color, f.opacity ?? 1), color(f.color2 || '#ffffff', f.opacity ?? 1)];
                    layers.push(`linear-gradient(${+(((f.angle ?? 90) + 90) % 360).toFixed(1)}deg, ${stops.join(', ')})`);
                }
                else if (f.type === 'image' && f.image) {
                    layers.push(`url("assets/${f.image}")`);
                    d['background-size'] = f.mode === 'fit' ? 'contain' : f.mode === 'tile' ? 'auto' : 'cover';
                    d['background-position'] = 'center';
                    d['background-repeat'] = f.mode === 'tile' ? 'repeat' : 'no-repeat';
                    warnings.push(`"${n.name}": an image fill points to assets/${f.image}; copy the image file next to the CSS.`);
                }
                else
                    warnings.push(`"${n.name}": a ${f.type} gradient is not exported.`);
            });
            if (flat) d['background-color'] = flat;
            else if (layers.length) d['background-image'] = layers.join(', ');
        }
        // radius
        if (n.type === 'ellipse')
            d['border-radius'] = '50%';
        else if (container || n.type === 'rect') {
            const r = ctx.radii(n), tok = ctx.token(n, 'radius');
            if (r.some(v => v)) {
                const same = r.every(v => v === r[0]);
                d['border-radius'] = same ? (tok ? `var(${tok}, ${px(r[0])})` : px(r[0])) : r.map(px).join(' ');
            }
        }
        // effects
        const shadows = [];
        for (const e of ctx.effects(n).filter(e => e.visible !== false)) {
            if (e.type === 'drop' || e.type === 'inner')
                shadows.push(`${e.type === 'inner' ? 'inset ' : ''}${px(e.x || 0)} ${px(e.y || 0)} ${px(e.blur || 0)} ${px(e.spread || 0)} ${color(e.color, e.opacity ?? .25)}`);
            else if (e.type === 'layerBlur')
                d.filter = `blur(${px((e.radius || 0) / 2)})`;
            else if (e.type === 'bgBlur')
                d['backdrop-filter'] = `blur(${px((e.radius || 0) / 2)})`;
        }
        if (shadows.length)
            d['box-shadow'] = shadows.join(', ');
        // text
        if (isText) {
            d['font-family'] = ctx.token(n, 'fontFamily') ? `var(${ctx.token(n, 'fontFamily')}, ${JSON.stringify(n.fontFamily)}), sans-serif` : `${/\s/.test(n.fontFamily || '') ? JSON.stringify(n.fontFamily) : n.fontFamily || 'inherit'}, sans-serif`;
            d['font-size'] = px(n.fontSize || 16);
            if ((n.fontWeight || 400) !== 400) d['font-weight'] = String(n.fontWeight);
            if (n.fontStyle === 'italic') d['font-style'] = 'italic';
            d['line-height'] = String(+(n.lineHeight || 1.35).toFixed(3));
            if (n.letterSpacing) d['letter-spacing'] = px(n.letterSpacing);
            if (n.textAlign && n.textAlign !== 'left') d['text-align'] = n.textAlign;
            if (n.textDecoration && n.textDecoration !== 'none') d['text-decoration'] = n.textDecoration === 'strike' ? 'line-through' : n.textDecoration;
            if (n.textCase && n.textCase !== 'none') d['text-transform'] = { upper: 'uppercase', lower: 'lowercase', title: 'capitalize' }[n.textCase] || 'none';
            if (n.autoW || sh === 'hug') d['white-space'] = 'nowrap';
            if (n.textTruncate) { d.overflow = 'hidden'; d['text-overflow'] = 'ellipsis'; d['white-space'] = 'nowrap'; }
            d['min-width'] = d['min-width'] || '0';
        }
        // an auto layout child of a column keeps its own width unless it fills
        return d;
    }
    // stroke is painted above the children (like the canvas) by an ::after layer, which does not change the layout
    function strokeRule(n) {
        if (!ctx.strokeOn(n)) return null;
        const s = ctx.sides(n), tok = ctx.token(n, 'stroke'), c = color(n.stroke, n.strokeOpacity ?? 1, tok);
        const align = n.strokeAlign || 'center', max = Math.max(s.t, s.r, s.b, s.l);
        if (n.type === 'text') return null;
        const inset = align === 'inside' ? 0 : align === 'outside' ? -max : -max / 2;
        const style = n.strokeStyle === 'dash' ? 'dashed' : 'solid';
        const side = v => v ? `${px(v)} ${style} ${c}` : '0';
        const d = { content: '""', position: 'absolute', inset: px(inset), 'pointer-events': 'none', 'border-radius': 'inherit', 'box-sizing': 'border-box' };
        if (s.t === s.r && s.r === s.b && s.b === s.l) d.border = side(s.t);
        else { d['border-top'] = side(s.t); d['border-right'] = side(s.r); d['border-bottom'] = side(s.b); d['border-left'] = side(s.l); }
        return d;
    }

    // ---------------- the layer tree ----------------
    const partTaken = new Set();
    const partName = (n, isRoot) => {
        if (isRoot) return '';
        let name = kebabCase(code.parts?.[n.id]?.part || n.name || n.type);
        const base0 = name;
        for (let i = 2; partTaken.has(name); i++) name = `${base0}-${i}`;
        partTaken.add(name);
        return name;
    };
    const keyOf = (n, counts) => { const k = `${n.name}#${counts.get(n.name) || 0}`; counts.set(n.name, (counts.get(n.name) || 0) + 1); return k; };
    const orderedKids = n => { const k = ctx.kids(n.id); return n.layout && n.layout !== 'none' && n.layoutFlip ? [...k].reverse() : k; };

    // Artwork (many vector layers, no text) is one SVG, not hundreds of elements.
    const artMemo = new Map();
    const artInfo = n => {
        if (artMemo.has(n.id)) return artMemo.get(n.id);
        let r;
        if (n.type === 'text' || n.type === 'image') r = { vec: 0, other: 1 };
        else if (['path', 'line', 'ellipse', 'rect'].includes(n.type) || n.booleanOp) r = { vec: 1, other: 0 };
        else if (n.isInstance) r = { vec: 1, other: 0 };
        else {
            r = { vec: 0, other: 0 };
            for (const c of ctx.kids(n.id)) { const k = artInfo(c); r.vec += k.vec; r.other += k.other; }
        }
        artMemo.set(n.id, r);
        return r;
    };
    const isArt = n => ['frame', 'group'].includes(n.type) && !n.isInstance && artInfo(n).vec >= 8 && artInfo(n).other === 0 && !ctx.fills(n).some(f => f.visible !== false);
    const LAYOUT_KEYS = new Set(['width', 'height', 'position', 'left', 'top', 'flex', 'flex-shrink', 'align-self', 'min-width', 'max-width', 'min-height', 'max-height', 'transform', 'opacity', 'display']);
    function build(n, parent, isRoot, seen = new Set()) {
        const ir = { id: n.id, key: null, name: n.name, part: partName(n, isRoot), kind: 'box', tag: null, style: {}, stroke: null, rules: [], children: [], attrs: {}, node: n };
        const ov = code.parts?.[n.id] || {};
        ir.style = styleOf(n, parent, isRoot);
        ir.stroke = strokeRule(n);
        const bind = n.propBind || {};
        if (bind.visible && cpropBy.get(bind.visible)) ir.visProp = cpropBy.get(bind.visible);
        if (n.type === 'text') {
            ir.kind = 'text';
            ir.tag = ov.tag || (isRoot ? rootTag : 'span');
            ir.text = n.text ?? '';
            if (bind.text && cpropBy.get(bind.text)) ir.textProp = cpropBy.get(bind.text);
            return ir;
        }
        if (n.isInstance && !isRoot) {
            const main = ctx.chain(n), mh = main && (ctx.parentSet(main) || main);
            if (main && ctx.isIcon(mh)) {
                const svg = ctx.svg(main);
                if (svg) { ir.kind = 'svg'; ir.svg = svg; ir.tag = 'svg'; return ir; }
            }
            if (main && mh && !seen.has(mh.id) && mh !== holder) {
                const name = ctx.exportName(mh);
                deps.set(name, mh);
                ir.kind = 'instance';
                ir.instance = { name, holder: mh, main, node: n };
                if (bind.swap && cpropBy.get(bind.swap)) ir.swapProp = cpropBy.get(bind.swap);
                return ir;
            }
            warnings.push(`"${n.name}": nested instance of itself or a missing component is skipped.`);
            ir.style.display = 'none';
            return ir;
        }
        if (isArt(n)) {
            const svg = ctx.svg(n);
            if (svg) {
                const lay = Object.fromEntries(Object.entries(ir.style).filter(([k]) => LAYOUT_KEYS.has(k)));
                if (isRoot) {
                    ir.tag = ov.tag || rootTag;
                    ir.children = [{ id: n.id + '-art', key: 'art', name: 'Art', part: 'art', kind: 'svg', tag: 'svg', style: { display: 'block', width: '100%', height: '100%' }, stroke: null, rules: [], children: [], attrs: {}, node: n, svg }];
                    ir.style = { ...lay, display: 'block' };
                    ir.stroke = null;
                    return ir;
                }
                ir.kind = 'svg'; ir.svg = svg; ir.tag = 'svg'; ir.style = lay; ir.stroke = null;
                return ir;
            }
        }
        if (n.type === 'image') {
            ir.kind = 'img'; ir.tag = 'img';
            ir.attrs.src = `assets/${n.assetId}`;
            ir.attrs.alt = '';
            warnings.push(`"${n.name}": image points to assets/${n.assetId}; copy the image file next to the CSS.`);
            return ir;
        }
        if (['path', 'line'].includes(n.type) || n.booleanOp || (n.type === 'ellipse' && ((n.arcSweep ?? 100) < 100 || (n.arcRatio || 0) > 0))) {
            const svg = ctx.svg(n);
            if (svg) { ir.kind = 'svg'; ir.svg = svg; ir.tag = 'svg'; return ir; }
        }
        ir.tag = ov.tag || (isRoot ? rootTag : 'div');
        if (bind.slot && cpropBy.get(bind.slot)) ir.slotProp = cpropBy.get(bind.slot);
        if (['frame', 'group'].includes(n.type))
            ir.children = orderedKids(n).map(c => build(c, n, false, seen));
        const counts = new Map();
        ir.children.forEach(c => { c.key = keyOf(c.node, counts); });
        return ir;
    }
    const root = build(base, null, true);
    root.key = '';
    const index = new Map(); // key path → IR node
    (function reg(ir, path) { index.set(path, ir); ir.children.forEach(c => reg(c, `${path}${SEP}${c.key}`)); })(root, '');

    // ---------------- variants: what differs from the base ----------------
    const variantTag = v => Object.entries(v.variant || {}).map(([k, x]) => `${k}=${x}`).join(', ');
    const whenOf = v => {
        const attrs = [], pseudos = [];
        for (const [k, val] of Object.entries(v.variant || {})) {
            if (roles[k] === 'state') {
                const st = stateOf[`${k}=${val}`];
                if (st?.pseudo) pseudos.push(st.pseudo);
                else if (st?.attr) attrs.push(`[${st.attr}]`);
            }
            else {
                const p = props.find(x => x.key === `v:${k}`);
                if (!p) continue;
                if (p.type === 'boolean') attrs.push(String(val) === String(p.trueValue) ? `[${p.attr}]` : `:not([${p.attr}])`);
                else attrs.push(`[${p.attr}="${p.values[val]}"]`);
            }
        }
        return { attrs: attrs.join(''), pseudo: pseudos.join('') };
    };
    const isRest = v => Object.entries(v.variant || {}).every(([k, val]) => roles[k] !== 'state' || stateOf[`${k}=${val}`]?.rest);
    const restOf = v => variants.find(o => o !== v && Object.keys(v.variant || {}).every(k => roles[k] === 'state' || o.variant?.[k] === v.variant[k]) && isRest(o));
    const styleDiff = (a, b) => { const out = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out[k] = a[k] === undefined ? 'initial' : a[k]; return out; };
    const styleCache = new Map();
    const treeStyles = v => { // key path → { style, stroke }
        if (styleCache.has(v.id)) return styleCache.get(v.id);
        const m = new Map();
        (function walk(n, parent, path, isRoot) {
            m.set(path, { style: styleOf(n, parent, isRoot), stroke: strokeRule(n), text: n.text, node: n });
            const counts = new Map();
            if (['frame', 'group'].includes(n.type) && !(n.isInstance && !isRoot))
                for (const c of orderedKids(n)) walk(c, n, `${path}${SEP}${keyOf(c, counts)}`, false);
        })(v, null, '', true);
        styleCache.set(v.id, m);
        return m;
    };
    if (isSet) {
        for (const v of variants.slice(1)) {
            const w = whenOf(v);
            if (!w.attrs && !w.pseudo) continue;
            const against = treeStyles(isRest(v) ? base : (restOf(v) || base)), mine = treeStyles(v);
            for (const [path, m] of mine) {
                let ir = index.get(path);
                if (!ir) {
                    // A layer that the default variant does not have: hidden by default, shown by this variant.
                    const cut = path.lastIndexOf(SEP), pir = index.get(path.slice(0, cut)), pnode = mine.get(path.slice(0, cut))?.node;
                    if (!pir || !pnode) continue;
                    const extra = build(m.node, pnode, false);
                    extra.key = path.slice(cut + 1);
                    const full = { ...extra.style };
                    extra.style = { ...extra.style, display: 'none' };
                    pir.children.push(extra);
                    (function reg(x, p) { index.set(p, x); x.children.forEach((c, i) => { c.key = c.key || `${c.name}#${i}`; reg(c, `${p}${SEP}${c.key}`); }); })(extra, path);
                    extra.rules.push({ w, diff: { ...full, display: full.display || 'block' }, stroke: extra.stroke, label: variantTag(v) });
                    continue;
                }
                const other = against.get(path);
                const diff = styleDiff(m.style, other?.style || ir.style);
                const sDiff = JSON.stringify(m.stroke) !== JSON.stringify(other ? other.stroke : ir.stroke);
                if (Object.keys(diff).length || sDiff) ir.rules.push({ w, diff, stroke: sDiff ? (m.stroke || { content: 'none' }) : null, label: variantTag(v) });
                if (ir.kind === 'text' && !ir.textProp && m.text !== (other?.text ?? ir.text)) warnings.push(`Variant "${variantTag(v)}": the text of "${m.node.name}" differs between variants and is not a text property; the default text is used.`);
            }
            // Layers of the default variant that this one does not have are hidden.
            for (const [path, ir] of index)
                if (path !== '' && !mine.has(path) && ir.style.display !== 'none' && !ir.rules.some(r => r.w === w))
                    ir.rules.push({ w, diff: { display: 'none' }, label: variantTag(v) });
        }
    }
    return finish({ ctx, holder, exportName, block, rootTag, props, root, warnings, deps, code, isSet, base, variants, roles });
}

// ---------------- emitters ----------------
function finish(g) {
    const { exportName, block, props, root, code } = g;
    const clsOf = ir => ir.part ? `${block}__${ir.part}` : block;
    const cssBlocks = [];
    const decl = (d, ind = '  ') => Object.entries(d).map(([k, v]) => `${ind}${k}: ${v};`).join('\n');
    const rule = (sel, d) => Object.keys(d).length ? `${sel} {\n${decl(d)}\n}` : '';
    (function css(ir) {
        const sel = '.' + clsOf(ir);
        const st = { ...ir.style };
        if (ir.stroke || ir.rules.some(r => r.stroke)) st.position = st.position || 'relative';
        cssBlocks.push(rule(sel, st));
        if (ir.stroke) cssBlocks.push(rule(`${sel}::after`, ir.stroke));
        for (const r of ir.rules) {
            const host = r.w.attrs || r.w.pseudo ? `.${block}${r.w.attrs}${r.w.pseudo}` : `.${block}`;
            const s2 = ir.part ? `${host} .${clsOf(ir)}` : host;
            if (Object.keys(r.diff).length) cssBlocks.push(`/* ${r.label} */\n${rule(s2, r.diff)}`);
            if (r.stroke) cssBlocks.push(rule(`${s2}::after`, r.stroke));
        }
        ir.children.forEach(css);
    })(root);
    const css = `*, *::before, *::after { box-sizing: border-box; }\n\n${cssBlocks.filter(Boolean).join('\n\n')}\n`;

    // ----- TSX -----
    const lit = s => JSON.stringify(String(s));
    const tsType = p => p.type === 'enum' ? Object.values(p.values).map(lit).join(' | ') : p.type === 'boolean' ? 'boolean' : p.type === 'string' ? 'string' : p.type === 'node' ? 'ReactNode' : p.sig;
    const attrProps = props.filter(p => p.attr);
    const events = props.filter(p => p.source === 'event');
    const iface = props.map(p => `  ${p.name}${p.source === 'event' || p.type !== 'node' || true ? '?' : ''}: ${tsType(p)};`).join('\n');
    const defaults = props.filter(p => p.source !== 'event' && p.def !== undefined && p.def !== null && p.def !== '' && p.type !== 'node').map(p => `${p.name} = ${p.type === 'boolean' ? !!p.def : lit(p.def)}`);
    const destruct = props.map(p => defaults.find(d => d.startsWith(p.name + ' =')) || p.name);
    const esc = s => String(s).replace(/[{}<>]/g, c => `{${JSON.stringify(c)}}`).replace(/\n/g, '\n');
    const attrsOf = (ir, isRoot) => {
        const a = [];
        a.push(isRoot ? `className={cx(${lit(block)}, className)}` : `className="${clsOf(ir)}"`);
        if (isRoot) {
            for (const p of attrProps) a.push(p.type === 'boolean' ? `${p.attr}={${p.name} ? '' : undefined}` : `${p.attr}={${p.name}}`);
            const stateBools = props.filter(p => p.source === 'state').map(p => p.name);
            if (stateBools.includes('disabled') && g.rootTag === 'button') a.push('disabled={disabled}');
            a.push('style={style}');
        }
        for (const ev of events) if ((ev.part || '') === (ir.part || '') || (!ev.part && isRoot)) a.push(`${ev.name}={${ev.name}}`);
        for (const [k, v] of Object.entries(ir.attrs)) a.push(`${k}=${lit(v)}`);
        const tag = code.parts?.[ir.id]?.tag || ir.tag;
        if (tag === 'a' && ir.part === '') { /* href comes through ...rest */ }
        if (isRoot) a.push('{...rest}');
        return a.join(' ');
    };
    const jsx = (ir, depth, isRoot = false) => {
        const ind = '  '.repeat(depth);
        let out;
        if (ir.kind === 'text') {
            const hasDef = ir.textProp && ir.textProp.def !== undefined && ir.textProp.def !== null && ir.textProp.def !== '';
            const content = ir.textProp ? `{${ir.textProp.name}${ir.text && !hasDef ? ` ?? ${lit(ir.text)}` : ''}}` : esc(ir.text);
            out = `${ind}<${ir.tag} ${attrsOf(ir, isRoot)}>${content}</${ir.tag}>`;
        }
        else if (ir.kind === 'svg')
            out = `${ind}<span className="${clsOf(ir)}" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ${lit(ir.svg)} }} />`;
        else if (ir.kind === 'img')
            out = `${ind}<img ${attrsOf(ir, false)} />`;
        else if (ir.kind === 'instance') {
            const ip = instanceProps(g, ir);
            const el = `<${ir.instance.name} className="${clsOf(ir)}"${ip ? ' ' + ip : ''} />`;
            out = ir.swapProp ? `${ind}{${ir.swapProp.name} ?? ${el}}` : `${ind}${el}`;
        }
        else {
            const kids = ir.slotProp
                ? [`${ind}  {${ir.slotProp.name === 'children' ? 'children' : ir.slotProp.name}}`]
                : ir.children.map(c => jsx(c, depth + 1));
            const tag = ir.tag;
            out = VOID_TAGS.has(tag) || !kids.length ? `${ind}<${tag} ${attrsOf(ir, isRoot)} />` : `${ind}<${tag} ${attrsOf(ir, isRoot)}>\n${kids.join('\n')}\n${ind}</${tag}>`;
        }
        if (ir.visProp) out = `${ind}{${ir.visProp.name} !== false && (\n${out.replace(/^/gm, '  ')}\n${ind})}`;
        return out;
    };
    const htmlAttr = g.rootTag === 'div' ? 'HTMLAttributes<HTMLDivElement>' : g.rootTag === 'button' ? 'ButtonHTMLAttributes<HTMLButtonElement>' : g.rootTag === 'a' ? 'AnchorHTMLAttributes<HTMLAnchorElement>' : g.rootTag === 'input' ? 'InputHTMLAttributes<HTMLInputElement>' : 'HTMLAttributes<HTMLElement>';
    const own = props.map(p => p.name);
    const imports = [...new Set(g.deps.keys())];
    const tsx = `import type { ReactNode, ${htmlAttr.split('<')[0]} } from 'react';
${imports.map(n => `import { ${n} } from './${n}';`).join('\n')}
import './${exportName}.css';

const cx = (...c: (string | undefined | false)[]) => c.filter(Boolean).join(' ');

export interface ${exportName}Props extends Omit<${htmlAttr}, ${[...own, 'className', 'style'].filter((x, i, a) => a.indexOf(x) === i).map(lit).join(' | ')}> {
${iface ? iface + '\n' : ''}  className?: string;
  style?: React.CSSProperties;
}

export function ${exportName}({ ${[...destruct, 'className', 'style', '...rest'].join(', ')} }: ${exportName}Props) {
  return (
${jsx(root, 2, true)}
  );
}
`.replace(/\n\n\n+/g, '\n\n');
    return { exportName, props, tsx, css, ir: root, warnings: [...new Set(g.warnings)], deps: [...g.deps.entries()], block, clsOf, holder: g.holder, base: g.base, variants: g.variants, roles: g.roles };
}

function instanceProps(g, ir) {
    const { holder, main, node } = ir.instance, ctx = g.ctx, out = [];
    const set = ctx.parentSet(main);
    const sub = ctx.codeProps(set || holder, main, node);
    for (const p of sub) out.push(p);
    return out.join(' ');
}

/** The JSX of an instance in a design: `<Button variant="primary">Save</Button>`. */
export function usageSnippet(ctx, instanceNode, nameOf) {
    const main = ctx.chain(instanceNode);
    if (!main) return '';
    const set = ctx.parentSet(main), holder = set || main, name = nameOf ? nameOf(holder) : ctx.exportName(holder);
    const attrs = ctx.codeProps(holder, main, instanceNode);
    return `<${name}${attrs.length ? ' ' + attrs.join(' ') : ''} />`;
}

// ---------------- HTML preview ----------------
/**
 * Static HTML of a generated component for one variant selection, with the CSS of everything it uses.
 * `resolver(instance)` gives the generated code and selection of a nested component, so it is drawn instead of a placeholder.
 */
export function previewHtml(gen, select = {}, themeCss = '', resolver = null) {
    const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const css = new Set([gen.css]);
    const renderGen = (g, select2, extraCls, texts, depth) => {
        const sel = {};
        for (const p of g.props)
            if (p.source === 'variant' || p.source === 'state' || p.source === 'boolean') sel[p.key] = select2[p.key] ?? p.def;
        const rootAttrs = g.props.filter(p => p.attr).map(p => {
            const v = sel[p.key];
            return p.type === 'boolean' ? (v ? ` ${p.attr}=""` : '') : ` ${p.attr}="${esc(v)}"`;
        }).join('');
        const render = (n, isRoot) => {
            if (n.visProp && (sel[n.visProp.key] ?? n.visProp.def) === false) return '';
            const cls = g.clsOf(n) + (isRoot && extraCls ? ' ' + extraCls : '');
            if (n.kind === 'text') {
                const t = n.textProp && texts && texts[n.textProp.key] !== undefined ? texts[n.textProp.key] : n.text;
                return `<${n.tag} class="${cls}"${isRoot ? rootAttrs : ''}>${esc(t)}</${n.tag}>`;
            }
            if (n.kind === 'svg') return `<span class="${cls}" aria-hidden="true">${n.svg}</span>`;
            if (n.kind === 'img') return `<span class="${cls}"></span>`;
            if (n.kind === 'instance') {
                const r = depth < 4 && resolver ? resolver(n.instance) : null;
                if (r) {
                    css.add(r.gen.css);
                    return renderGen(r.gen, r.select || {}, g.clsOf(n), r.texts, depth + 1);
                }
                return `<span class="${cls}" data-instance="${esc(n.instance.name)}" style="display:inline-flex;align-items:center;justify-content:center;border:1px dashed #9aa;min-width:24px;min-height:20px;font:10px sans-serif;color:#667">${esc(n.instance.name)}</span>`;
            }
            const kids = n.children.map(ch => render(ch, false)).join('');
            return `<${n.tag} class="${cls}"${isRoot ? rootAttrs : ''}>${kids}</${n.tag}>`;
        };
        return render(g.ir, true);
    };
    const body = renderGen(gen, select, '', null, 0);
    return `<!doctype html><html><head><meta charset="utf-8"><style>${themeCss}\nbody{margin:0;padding:16px;background:#f4f4f6;font-family:sans-serif}\n${[...css].join('\n')}</style></head><body>${body}</body></html>`;
}
