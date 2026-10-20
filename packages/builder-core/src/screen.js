// Pemetaan node canvas → kode untuk Code Builder (spec §4.6). Fungsi murni (tanpa DOM/React) supaya bisa
// dipakai Live DOM Renderer, Issues panel, dan nanti generator kode.
//
// Hasil `screenTree`:
//   { kind: 'component', exportName, props, children?, nodeId, name, box }   — instance komponen library
//   { kind: 'box', style, children, nodeId, name }                           — frame (auto layout → flex)
//   { kind: 'text', text, style, nodeId, name }
//   { kind: 'unsupported', nodeId, name, box, reason }                       — tidak di-generate (→ Issue)

export const CRUD_ROLES = ['list', 'create', 'edit', 'view'];
export const ROLE_LABEL = { list: 'List', create: 'Create', edit: 'Edit', view: 'View', custom: 'Custom', dialog: 'Dialog' };
export const FORM_FIELD_COMPONENTS = ['TextField', 'TextAreaField', 'PasswordField', 'SelectField', 'SwitchField'];

const words = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);
export function camelCase(s) {
    const p = words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
    const out = p ? p[0].toLowerCase() + p.slice(1) : '';
    return /^[a-z]/.test(out) ? out : `prop${p}`;
}
export const kebabCase = s => words(s).map(w => w.toLowerCase()).join('-');

/** CSS variable token tema untuk sebuah Variable — sama dengan Library Kit (`color/primary` → `--theme-primary`). */
export function cssVarOf(item) {
    const parts = String(item.name).split('/').map(s => s.trim()).filter(Boolean);
    if (item.type === 'color' && parts.length > 1 && /^colou?rs?$/i.test(parts[0])) parts.shift();
    return `--theme-${camelCase(parts.join(' ')).replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;
}

/**
 * Konteks dari dokumen: semua node file (lintas page), Variables, dan mapping komponen versi library project.
 * `libraryId` = id file sumber library; komponen hasil salinan library punya `libRef = "<libraryId>:<key>"`.
 */
export function makeContext({ nodes, variables, mappings = [], libraryId = null, fileId = null }) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const kids = new Map();
    for (const n of nodes) if (n.parentId) (kids.get(n.parentId) || kids.set(n.parentId, []).get(n.parentId)).push(n);
    const vars = new Map((variables?.items || []).map(i => [i.id, i]));
    return { byId, kids, vars, mappings: new Map(mappings.map(m => [m.componentKey, m])), libraryId, fileId };
}

const childrenOf = (ctx, id) => (ctx.kids.get(id) || []).filter(n => n.visible !== false);
const isAutoLayout = n => n.type === 'frame' && !!n.layout && n.layout !== 'none';
const round = v => Math.round(v * 100) / 100;

/** Warna node: Variable → `var(--theme-…)`; hex lepas → warna apa adanya + `raw: true` (Issue). */
function paint(ctx, n, prop) {
    const value = n[prop];
    if (!value || value === 'none') return null;
    const v = n.vars?.[prop] && ctx.vars.get(n.vars[prop]);
    if (v) return { css: `var(${cssVarOf(v)}, ${value})`, raw: false };
    return { css: value, raw: true };
}

/** Komponen library dari instance: { key, mapping, variant, holder } atau { reason }. */
export function componentOf(ctx, inst) {
    const main = ctx.byId.get(inst.sourceId);
    if (!main) return { reason: 'Main component not found in this file' };
    const parent = main.variant ? ctx.byId.get(main.parentId) : null;
    const holder = parent?.componentSet ? parent : main;
    let key = null;
    if (holder.libRef) {
        const prefix = `${ctx.libraryId}:`;
        if (!ctx.libraryId || !holder.libRef.startsWith(prefix)) return { reason: `Component ${holder.name} is from another library, not the project's library`, name: holder.name };
        key = holder.libRef.slice(prefix.length);
    }
    else if (ctx.libraryId && ctx.fileId === ctx.libraryId) key = holder.id; // file sumber library itu sendiri
    else return { reason: `Local component ${holder.name} — not from the project's library`, name: holder.name };
    const mapping = ctx.mappings.get(key);
    if (!mapping) {
        const internal = /^[_.]/.test(holder.name);
        return { reason: internal ? `${holder.name} is an internal library part; use its parent component` : `Component ${holder.name} is not in the project's library version`, name: holder.name };
    }
    return { key, mapping, variant: main.variant || {}, holder };
}

/** Props kode dari variant + component property instance (lewat mapping versi library). */
export function propsOf(inst, comp) {
    const props = {};
    for (const p of comp.mapping.propsMap?.props || []) {
        if (p.source === 'variant') {
            const raw = comp.variant[p.key];
            if (raw === undefined) continue;
            const v = p.values?.[raw] ?? raw;
            props[p.name] = p.type === 'boolean' ? v === true || v === 'true' : v;
        }
        else if (p.source === 'text' || p.source === 'boolean') {
            const def = comp.holder.cprops?.find(c => c.id === p.key);
            const v = Object.hasOwn(inst.propValues || {}, p.key) ? inst.propValues[p.key] : def?.def ?? def?.default;
            if (v === undefined || v === null || (p.source === 'text' && v === '')) continue;
            props[p.name] = p.source === 'boolean' ? !!v : String(v);
        }
    }
    return props;
}

/** Ukuran di dalam parent auto layout (fixed → px, fill → flex/stretch, hug → auto). */
function sizing(n, parent) {
    const s = {};
    const horiz = parent && isAutoLayout(parent) && parent.layout === 'horizontal';
    const inFlow = parent && isAutoLayout(parent) && n.layoutPositioning !== 'absolute';
    const h = n.layoutSizingH || (n.type === 'text' ? (n.autoW ? 'hug' : 'fixed') : 'fixed');
    const v = n.layoutSizingV || (n.type === 'text' ? 'hug' : 'fixed');
    if (h === 'fixed') s.width = `${round(n.w)}px`;
    if (v === 'fixed') s.height = `${round(n.h)}px`;
    if (inFlow) {
        if (h === 'fill') Object.assign(s, horiz ? { flex: '1 1 0', minWidth: 0 } : { alignSelf: 'stretch' });
        if (v === 'fill') Object.assign(s, horiz ? { alignSelf: 'stretch' } : { flex: '1 1 0', minHeight: 0 });
        s.flexShrink = s.flex ? undefined : 0;
    }
    else if (parent) Object.assign(s, { position: 'absolute', left: `${round(n.x)}px`, top: `${round(n.y)}px` });
    return s;
}

const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' };

function frameStyle(ctx, n, issues) {
    const s = { boxSizing: 'border-box' };
    if (isAutoLayout(n)) {
        Object.assign(s, {
            display: 'flex', flexDirection: n.layout === 'vertical' ? 'column' : 'row', flexWrap: n.layoutWrap ? 'wrap' : 'nowrap',
            gap: `${n.gap ?? 0}px`, padding: `${n.padT ?? n.padding ?? 0}px ${n.padR ?? n.padding ?? 0}px ${n.padB ?? n.padding ?? 0}px ${n.padL ?? n.padding ?? 0}px`,
            justifyContent: n.gapAuto ? 'space-between' : ALIGN[n.primaryAlign || 'start'], alignItems: ALIGN[n.counterAlign || 'start'],
        });
    }
    else s.position = 'relative';
    const fill = paint(ctx, n, 'fill');
    if (fill) {
        s.background = fill.css;
        if (n.fillOpacity != null && n.fillOpacity < 1) s.background = `color-mix(in srgb, ${fill.css} ${round(n.fillOpacity * 100)}%, transparent)`;
        if (fill.raw) issues.push(issue(n, 'warning', `Fill color ${n.fill} does not use a Variable (theme token)`));
    }
    if (n.strokeWidth > 0 && n.stroke && n.stroke !== 'none' && n.strokeVisible !== false) {
        const stroke = paint(ctx, n, 'stroke');
        const m = n.strokeSides || 'all', w = n.strokeWidth;
        const sides = m === 'custom' || m === true ? [n.strokeT ?? w, n.strokeR ?? w, n.strokeB ?? w, n.strokeL ?? w]
            : m === 'all' ? [w, w, w, w] : ['top', 'right', 'bottom', 'left'].map(k => (m === k ? w : 0));
        s.borderStyle = 'solid';
        s.borderColor = stroke.css;
        s.borderWidth = sides.map(x => `${x}px`).join(' ');
        if (stroke.raw) issues.push(issue(n, 'warning', `Stroke color ${n.stroke} does not use a Variable (theme token)`));
    }
    const r = n.radius;
    if (r) s.borderRadius = `${r >= 999 ? 9999 : r}px`;
    if (n.clip) s.overflow = 'hidden';
    if (n.opacity != null && n.opacity < 1) s.opacity = n.opacity;
    if (n.shadow) s.boxShadow = `${n.shadowX ?? 0}px ${n.shadowY ?? 4}px ${n.shadowBlur ?? 8}px rgba(15,23,42,${n.shadowOpacity ?? 0.15})`;
    return s;
}

function textStyle(ctx, n, issues) {
    const s = {
        fontSize: `${n.fontSize || 14}px`, fontWeight: n.fontWeight || 400, lineHeight: n.lineHeight ? `${round((n.fontSize || 14) * n.lineHeight)}px` : 'normal',
        textAlign: n.textAlign || 'left', whiteSpace: n.autoW ? 'nowrap' : 'pre-wrap', margin: 0,
    };
    const fill = paint(ctx, n, 'fill');
    if (fill) {
        s.color = fill.css;
        if (fill.raw) issues.push(issue(n, 'warning', `Text color ${n.fill} does not use a Variable (theme token)`));
    }
    if (n.letterSpacing) s.letterSpacing = `${n.letterSpacing}px`;
    if (n.opacity != null && n.opacity < 1) s.opacity = n.opacity;
    return s;
}

const issue = (n, severity, message) => ({ nodeId: n.id, nodeName: n.name || n.type, severity, message });

// The generated app already has a Sidebar and Topbar (app shell, set up under Layout). When a registered frame is a whole page
// mockup that also draws them, they are left out so the app does not end up with two sidebars.
const LAYOUT_COMPONENTS = new Set(['sidebar', 'topbar', 'appshell']);
const LAYOUT_FRAME_NAME = /^(side ?bar|nav ?bar|top ?bar|top ?navigation|app ?shell)$/i;
const LAYOUT_DEPTH = 2; // only the page wrapper levels (frame → shell → area), never deep inside the content

/**
 * Pohon render + daftar issue untuk satu frame (screen).
 * `options.component`: the frame is a component (variant) of a library, not a page: keep its own sizing (hug/fixed) and do
 * not leave out Sidebar/Topbar-like children.
 */
export function screenTree(ctx, frameId, nodeCfg = {}, options = {}) {
    const issues = [];
    const root = ctx.byId.get(frameId);
    if (!root) return { tree: null, issues: [{ nodeId: frameId, nodeName: 'Frame', severity: 'error', message: 'Screen frame not found — it may have been deleted' }] };
    let prunedLayout = false;
    const isLayoutPart = k => {
        if (k.isInstance) {
            const c = componentOf(ctx, k);
            return LAYOUT_COMPONENTS.has(String(c.mapping?.exportName ?? c.holder?.name ?? c.name ?? '').toLowerCase());
        }
        return (k.type === 'frame' || k.type === 'group') && LAYOUT_FRAME_NAME.test(String(k.name || '').trim());
    };
    const walk = (n, parent, depth = 0) => {
        const cfg = nodeCfg[n.id] || {};
        if (cfg.hidden && parent) return null;
        const box = sizing(n, parent);
        if (n.isInstance) {
            const comp = componentOf(ctx, n);
            if (!comp.mapping) {
                issues.push(issue(n, 'error', comp.reason));
                return { kind: 'unsupported', nodeId: n.id, name: n.name, box: { ...box, width: `${round(n.w)}px`, height: `${round(n.h)}px` }, reason: comp.reason };
            }
            const base = propsOf(n, comp);
            return {
                kind: 'component', exportName: comp.mapping.exportName, props: { ...base, ...cfg.props }, baseProps: base, propDefs: comp.mapping.propsMap?.props || [],
                cfg, nodeId: n.id, name: n.name, box,
            };
        }
        if (n.type === 'text') return { kind: 'text', text: cfg.text ?? n.text ?? '', designText: n.text ?? '', cfg, style: { ...textStyle(ctx, n, issues), ...box }, nodeId: n.id, name: n.name };
        if (n.type === 'frame' || n.type === 'group' || n.type === 'section') {
            let kids = childrenOf(ctx, n.id);
            if (depth < LAYOUT_DEPTH && !options.component) {
                const parts = kids.filter(isLayoutPart);
                if (parts.length) {
                    prunedLayout = true;
                    for (const k of parts) issues.push(issue(k, 'info', `${k.name || 'Layout part'} is ignored — the app shell already provides the sidebar and topbar (Layout settings)`));
                    kids = kids.filter(k => !parts.includes(k));
                }
            }
            if (kids.length > 1 && !isAutoLayout(n))
                issues.push(issue(n, 'warning', `${n.type === 'group' ? 'Group' : 'Frame'} without auto layout — switch to auto layout so it can be generated`));
            return { kind: 'box', style: { ...frameStyle(ctx, n, issues), ...box }, children: kids.map(k => walk(k, n, depth + 1)).filter(Boolean), cfg, nodeId: n.id, name: n.name };
        }
        const what = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', path: 'Vector', image: 'Image', boolean: 'Boolean' }[n.type] || n.type;
        const reason = `A free ${what} is not generated — make it a library component or an asset`;
        issues.push(issue(n, 'warning', reason));
        return { kind: 'unsupported', nodeId: n.id, name: n.name, box: { ...box, width: `${round(n.w)}px`, height: `${round(n.h)}px` }, reason };
    };
    let tree = walk(root, null);
    if (options.component) return { tree, issues };
    const rootCfg = nodeCfg[root.id] || {};
    let width = root.w, height = root.h;
    if (prunedLayout) {
        // What is left of a page mockup is usually one wrapper chain (page → main area → content): use the innermost box.
        let inner = tree;
        while (inner.kind === 'box' && inner.children.length === 1 && inner.children[0].kind === 'box') inner = inner.children[0];
        if (inner !== tree) {
            const src = ctx.byId.get(inner.nodeId);
            tree = { ...inner };
            if (src) { width = src.w; height = src.h; }
        }
    }
    tree.cfg = rootCfg;
    groupFormFields(tree, nodeCfg);
    tree.style = { ...tree.style, width: `${round(width)}px`, minHeight: `${round(height)}px`, height: undefined };
    return { tree, issues };
}

const FIELD_TYPE_OF = { TextField: 'string', TextAreaField: 'text', PasswordField: 'password', SelectField: 'enum', SwitchField: 'boolean' };

/**
 * First draft of a module's entity fields, read from the form frames of the design: every TextField / TextAreaField /
 * PasswordField / SelectField / SwitchField instance becomes a field (its label text gives the name). A select whose label
 * is another module (e.g. "Role") becomes a relation to it. Works on the raw design nodes, so it needs no library mapping.
 */
export function inferFields(ctx, frameIds, modules = []) {
    const fields = [], names = new Set();
    const holderName = inst => {
        const main = ctx.byId.get(inst.sourceId);
        const holder = main?.variant ? ctx.byId.get(main.parentId) : main;
        return holder?.name || '';
    };
    const labelOf = inst => {
        const queue = [...(ctx.kids.get(inst.id) || [])];
        for (let n = queue.shift(); n; n = queue.shift()) {
            if (n.type === 'text' && /^label$/i.test(String(n.name || '').trim()) && String(n.text || '').trim()) return String(n.text).trim();
            queue.push(...(ctx.kids.get(n.id) || []));
        }
        return '';
    };
    const visit = n => {
        if (n.visible === false) return;
        if (n.isInstance) {
            const type = FIELD_TYPE_OF[holderName(n)];
            const label = type ? labelOf(n) : '';
            if (!type || !label) return;
            let name = camelCase(label);
            if (!/^[a-z][a-zA-Z0-9]*$/.test(name)) name = `field${fields.length + 1}`;
            while (names.has(name)) name += '2';
            names.add(name);
            const target = type === 'enum' ? modules.find(m => [m.label, m.name].some(x => String(x).toLowerCase() === label.toLowerCase())) : null;
            fields.push({
                name, label, type: target ? 'relation' : type, required: false,
                sortable: type === 'string' || type === 'text', filterable: type !== 'password' && type !== 'text',
                ...(target ? { relation: { moduleId: target.id, labelField: 'name' } } : type === 'enum' ? { options: ['Option 1', 'Option 2', 'Option 3'] } : {}),
            });
            return;
        }
        for (const k of ctx.kids.get(n.id) || []) visit(k);
    };
    for (const id of frameIds) { const root = ctx.byId.get(id); if (root) visit(root); }
    return fields;
}

/**
 * Issue konfigurasi project (spec §4.3 Issues panel): library belum dipilih / bundle belum ada, module tanpa
 * screen, CRUD tanpa field entity, frame screen hilang atau pindah page.
 */
export function projectIssues(project, { byId, pages }) {
    const out = [];
    const add = (severity, message, ref = {}) => out.push({ severity, message, ...ref });
    const lib = project.library;
    if (!lib) add('error', 'Choose a library + version for this project');
    else if (lib.missing) add('error', `Version ${lib.version} of library ${lib.packageName} not found`);
    else {
        if (!lib.bundleUrl) add('warning', `Bundle ${lib.packageName}@${lib.version} has not been uploaded — run \`npm run bundle\` (midas bundle) in the package repo`);
        if (lib.codeStatus && lib.codeStatus !== 'ready') add('warning', `Code for ${lib.packageName}@${lib.version} is incomplete (status ${lib.codeStatus})`);
    }
    const pageIds = new Set(pages.map(p => p.id));
    for (const m of project.config.modules) {
        const ref = { moduleId: m.id };
        if (!pageIds.has(m.pageId)) add('error', `Source page of module ${m.name} was deleted`, ref);
        // A parent that only groups child modules (Master Data → Region) is a menu group, not an empty module.
        if (!m.screens.length && !project.config.modules.some(c => c.parentId === m.id)) add('warning', `Module ${m.name} has no screens yet`, ref);
        const crud = m.screens.some(s => CRUD_ROLES.includes(s.role));
        if (crud && !m.entity?.fields?.length) add('warning', `Module ${m.name} (CRUD) has no entity fields yet`, ref);
        if (m.screens.some(s => s.role === 'edit' || s.role === 'create') && !m.screens.some(s => s.role === 'list'))
            add('warning', `Module ${m.name} has a form without a list screen`, ref);
        for (const s of m.screens) {
            const f = byId.get(s.frameId);
            if (!f) add('error', `Screen frame ${s.name} (${s.role}) was deleted`, { ...ref, screenId: s.id });
            else if (f.parentId && byId.get(f.parentId)?.type !== 'frame') add('warning', `Screen ${s.name} must be a top-level frame on the page or sit inside a frame (e.g. a page layout)`, { ...ref, screenId: s.id });
        }
    }
    return out;
}

const isFieldNode = n => n.kind === 'component' && FORM_FIELD_COMPONENTS.includes(n.exportName);
const isFieldRow = n => n.kind === 'box' && n.children.length > 0 && n.children.every(isFieldNode);

/**
 * Form fields live on a 12-column grid (like the base project's form layout). Consecutive fields — directly in a frame, or in
 * a "row" frame that only contains fields — are merged into one `formgrid` node. Each field gets a column span: the node's
 * own `cfg.form.span`, else an equal share of its design row (2 fields → 6, 3 → 4, …), else 12 (full width).
 * `formgrid.children` are the field nodes (so tree traversal keeps working); `spans[nodeId]` holds the spans.
 */
function groupFormFields(node, nodeCfg) {
    if (node.kind !== 'box') return;
    const out = [];
    let run = null;
    const flush = () => { if (run) { out.push(run); run = null; } };
    const grid = (id, rowGap, colGap) => (run ??= { kind: 'formgrid', nodeId: `formgrid-${id}`, name: 'Fields', children: [], spans: {}, rowGap, colGap });
    for (const c of node.children) {
        if (isFieldNode(c)) {
            const g = grid(c.nodeId, parseFloat(node.style?.gap) || 16, 24);
            g.children.push(c);
            g.spans[c.nodeId] = c.cfg?.form?.span || 12;
        }
        else if (isFieldRow(c)) {
            const share = Math.max(1, Math.floor(12 / c.children.length));
            const g = grid(c.children[0].nodeId, parseFloat(node.style?.gap) || 16, parseFloat(c.style?.gap) || 24);
            for (const f of c.children) { g.children.push(f); g.spans[f.nodeId] = f.cfg?.form?.span || share; }
        }
        else {
            flush();
            groupFormFields(c, nodeCfg);
            out.push(c);
        }
    }
    flush();
    node.children = out;
}
