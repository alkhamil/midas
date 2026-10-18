// Pemetaan node canvas → kode untuk Code Builder (spec §4.6). Fungsi murni (tanpa DOM/React) supaya bisa
// dipakai Live DOM Renderer, Issues panel, dan nanti generator kode.
//
// Hasil `screenTree`:
//   { kind: 'component', exportName, props, children?, nodeId, name, box }   — instance komponen library
//   { kind: 'box', style, children, nodeId, name }                           — frame (auto layout → flex)
//   { kind: 'text', text, style, nodeId, name }
//   { kind: 'unsupported', nodeId, name, box, reason }                       — tidak di-generate (→ Issue)

export const CRUD_ROLES = ['list', 'create', 'edit', 'view'];
export const ROLE_LABEL = { list: 'List', create: 'Create', edit: 'Edit', view: 'View', custom: 'Custom' };

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
    if (!main) return { reason: 'Main component tidak ditemukan di file ini' };
    const parent = main.variant ? ctx.byId.get(main.parentId) : null;
    const holder = parent?.componentSet ? parent : main;
    let key = null;
    if (holder.libRef) {
        const prefix = `${ctx.libraryId}:`;
        if (!ctx.libraryId || !holder.libRef.startsWith(prefix)) return { reason: `Komponen ${holder.name} dari library lain, bukan library project`, name: holder.name };
        key = holder.libRef.slice(prefix.length);
    }
    else if (ctx.libraryId && ctx.fileId === ctx.libraryId) key = holder.id; // file sumber library itu sendiri
    else return { reason: `Komponen lokal ${holder.name} — bukan dari library project`, name: holder.name };
    const mapping = ctx.mappings.get(key);
    if (!mapping) {
        const internal = /^[_.]/.test(holder.name);
        return { reason: internal ? `${holder.name} adalah bagian internal library; pakai komponen induknya` : `Komponen ${holder.name} tidak ada di versi library project`, name: holder.name };
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
        if (fill.raw) issues.push(issue(n, 'warning', `Warna fill ${n.fill} tidak memakai Variable (token tema)`));
    }
    if (n.strokeWidth > 0 && n.stroke && n.stroke !== 'none' && n.strokeVisible !== false) {
        const stroke = paint(ctx, n, 'stroke');
        const m = n.strokeSides || 'all', w = n.strokeWidth;
        const sides = m === 'custom' || m === true ? [n.strokeT ?? w, n.strokeR ?? w, n.strokeB ?? w, n.strokeL ?? w]
            : m === 'all' ? [w, w, w, w] : ['top', 'right', 'bottom', 'left'].map(k => (m === k ? w : 0));
        s.borderStyle = 'solid';
        s.borderColor = stroke.css;
        s.borderWidth = sides.map(x => `${x}px`).join(' ');
        if (stroke.raw) issues.push(issue(n, 'warning', `Warna stroke ${n.stroke} tidak memakai Variable (token tema)`));
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
        if (fill.raw) issues.push(issue(n, 'warning', `Warna teks ${n.fill} tidak memakai Variable (token tema)`));
    }
    if (n.letterSpacing) s.letterSpacing = `${n.letterSpacing}px`;
    if (n.opacity != null && n.opacity < 1) s.opacity = n.opacity;
    return s;
}

const issue = (n, severity, message) => ({ nodeId: n.id, nodeName: n.name || n.type, severity, message });

/** Pohon render + daftar issue untuk satu frame (screen). */
export function screenTree(ctx, frameId, nodeCfg = {}) {
    const issues = [];
    const root = ctx.byId.get(frameId);
    if (!root) return { tree: null, issues: [{ nodeId: frameId, nodeName: 'Frame', severity: 'error', message: 'Frame screen tidak ditemukan — mungkin sudah dihapus' }] };
    const walk = (n, parent) => {
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
            const kids = childrenOf(ctx, n.id);
            if (kids.length > 1 && !isAutoLayout(n))
                issues.push(issue(n, 'warning', `${n.type === 'group' ? 'Group' : 'Frame'} tanpa auto layout — ubah ke auto layout supaya bisa di-generate`));
            return { kind: 'box', style: { ...frameStyle(ctx, n, issues), ...box }, children: kids.map(k => walk(k, n)).filter(Boolean), cfg, nodeId: n.id, name: n.name };
        }
        const what = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', path: 'Vector', image: 'Gambar', boolean: 'Boolean' }[n.type] || n.type;
        const reason = `${what} bebas tidak di-generate — jadikan komponen library atau aset`;
        issues.push(issue(n, 'warning', reason));
        return { kind: 'unsupported', nodeId: n.id, name: n.name, box: { ...box, width: `${round(n.w)}px`, height: `${round(n.h)}px` }, reason };
    };
    const tree = walk(root, null);
    tree.cfg = nodeCfg[root.id] || {};
    tree.style = { ...tree.style, width: `${round(root.w)}px`, minHeight: `${round(root.h)}px`, height: undefined };
    return { tree, issues };
}

/**
 * Issue konfigurasi project (spec §4.3 Issues panel): library belum dipilih / bundle belum ada, module tanpa
 * screen, CRUD tanpa field entity, frame screen hilang atau pindah page.
 */
export function projectIssues(project, { byId, pages }) {
    const out = [];
    const add = (severity, message, ref = {}) => out.push({ severity, message, ...ref });
    const lib = project.library;
    if (!lib) add('error', 'Pilih library + versi untuk project ini');
    else if (lib.missing) add('error', `Versi ${lib.version} library ${lib.packageName} tidak ditemukan`);
    else {
        if (!lib.bundleUrl) add('warning', `Bundle ${lib.packageName}@${lib.version} belum diunggah — jalankan \`npm run bundle\` (midas bundle) di repo paket`);
        if (lib.codeStatus && lib.codeStatus !== 'ready') add('warning', `Kode ${lib.packageName}@${lib.version} belum lengkap (status ${lib.codeStatus})`);
    }
    const pageIds = new Set(pages.map(p => p.id));
    for (const m of project.config.modules) {
        const ref = { moduleId: m.id };
        if (!pageIds.has(m.pageId)) add('error', `Page sumber module ${m.name} sudah dihapus`, ref);
        if (!m.screens.length) add('warning', `Module ${m.name} belum punya screen`, ref);
        const crud = m.screens.some(s => CRUD_ROLES.includes(s.role));
        if (crud && !m.entity?.fields?.length) add('warning', `Module ${m.name} (CRUD) belum punya field entity`, ref);
        if (m.screens.some(s => s.role === 'edit' || s.role === 'create') && !m.screens.some(s => s.role === 'list'))
            add('warning', `Module ${m.name} punya form tanpa screen list`, ref);
        for (const s of m.screens) {
            const f = byId.get(s.frameId);
            if (!f) add('error', `Frame screen ${s.name} (${s.role}) sudah dihapus`, { ...ref, screenId: s.id });
            else if (f.parentId && byId.get(f.parentId)?.type !== 'frame') add('warning', `Screen ${s.name} harus frame teratas di page atau berada di dalam frame (mis. layout halaman)`, { ...ref, screenId: s.id });
        }
    }
    return out;
}
