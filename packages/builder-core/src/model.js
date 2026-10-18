// Model konfigurasi Code Builder yang dipakai bersama Studio (inspector, renderer) dan generator kode:
// layout aplikasi (sidebar/topbar), path route, entity → kolom tabel / contoh data, dan binding field form.
import { camelCase, kebabCase } from './screen.js';

export const titleCase = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
export const pascalCase = s => { const c = camelCase(s); return c[0].toUpperCase() + c.slice(1); };

export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'datetime', 'enum', 'relation', 'password'];
export const ROW_ACTIONS = ['view', 'edit', 'delete'];
export const BUTTON_ACTIONS = ['none', 'navigate', 'submit', 'back'];
export const DEFAULT_ICONS = ['widget', 'user', 'shield-check', 'chart', 'settings', 'eye', 'filter'];

/** Path URL module, mis. `/master/user`. Module `dashboard` di level atas adalah halaman beranda (`/`). */
export function modulePath(modules, m) {
    if (m.name === 'dashboard' && !m.parentId) return '/';
    const byId = new Map(modules.map(x => [x.id, x]));
    const parts = [];
    for (let c = m, seen = 0; c && seen < 20; c = c.parentId ? byId.get(c.parentId) : null, seen++) parts.unshift(c.name);
    return `/${parts.join('/')}`;
}

/** Path route sebuah screen; `:id` untuk edit/view. */
export function screenPath(modules, m, s) {
    const base = modulePath(modules, m);
    const sub = p => (base === '/' ? p : `${base}${p}`);
    if (s.role === 'list') return base;
    if (s.role === 'create') return sub('/create');
    if (s.role === 'edit') return sub('/:id/edit');
    if (s.role === 'view') return sub('/:id');
    // Screen custom pertama di module tanpa list menjadi halaman utama module.
    const firstCustom = m.screens.find(x => x.role === 'custom');
    if (!m.screens.some(x => x.role === 'list') && firstCustom?.id === s.id) return base;
    return sub(`/${kebabCase(s.name)}`);
}

/** Menu sidebar: modul teratas berurutan sesuai `layout.items`, sisanya menyusul. Path = screen list, atau screen pertama. */
export function resolveLayout(config) {
    const modules = config.modules || [];
    const layout = config.layout || {};
    const overrides = new Map((layout.items || []).map((it, i) => [it.moduleId, { ...it, order: i }]));
    const top = modules.filter(m => !m.parentId);
    const ordered = [...top].sort((a, b) => (overrides.get(a.id)?.order ?? 1e6 + top.indexOf(a)) - (overrides.get(b.id)?.order ?? 1e6 + top.indexOf(b)));
    const items = ordered.map((m, i) => {
        const o = overrides.get(m.id) || {};
        const target = m.screens.find(s => s.role === 'list') || m.screens.find(s => s.role === 'custom') || m.screens[0];
        return {
            moduleId: m.id, label: o.label || m.label, icon: o.icon || DEFAULT_ICONS[i % DEFAULT_ICONS.length], hidden: !!o.hidden,
            path: target ? screenPath(modules, m, target) : modulePath(modules, m), permissionKey: m.permissionKey || m.name,
        };
    });
    return { appName: layout.appName || 'Midas App', userName: layout.userName || 'Administrator', userRole: layout.userRole || 'admin', items };
}

const SAMPLE = {
    string: (f, i) => (/email/i.test(f.name) ? `user${i + 1}@contoh.id` : /name|nama|title|judul/i.test(f.name) ? ['Budi Santoso', 'Ani Wijaya', 'Citra Lestari', 'Dewi Anggraini', 'Eko Prasetyo'][i % 5] : `${titleCase(f.name)} ${i + 1}`),
    text: (f, i) => `Keterangan ${titleCase(f.name).toLowerCase()} ${i + 1}`,
    number: (_f, i) => (i + 1) * 10,
    boolean: (_f, i) => i % 3 !== 2,
    date: (_f, i) => `2026-0${(i % 9) + 1}-15`,
    datetime: (_f, i) => `2026-0${(i % 9) + 1}-15T09:00:00`,
    password: () => '',
    relation: (f, i) => `${titleCase(f.relation || f.name)} ${(i % 3) + 1}`,
};
export const sampleValue = (f, i) => (f.type === 'enum' ? (f.options?.[i % f.options.length] ?? '') : (SAMPLE[f.type] || SAMPLE.string)(f, i));
export const sampleRows = (fields, n = 5) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), ...Object.fromEntries(fields.map(f => [f.name, sampleValue(f, i)])) }));

const fieldLabel = f => f.label || titleCase(f.name);

/** Model tabel list dari entity + konfigurasi node Table. */
export function tableModel(entity, cfg = {}) {
    const fields = entity?.fields || [];
    const t = cfg.table || {};
    const names = t.columns || fields.filter(f => f.type !== 'password' && f.type !== 'text').slice(0, 5).map(f => f.name);
    const columns = names.map(n => fields.find(f => f.name === n)).filter(Boolean).map(f => ({ key: f.name, header: fieldLabel(f), type: f.type, options: f.options }));
    return { columns, rowActions: t.rowActions || ROW_ACTIONS, pageSize: t.pageSize || 10 };
}

/** Field entity yang dibinding ke komponen form: eksplisit (`cfg.field`) atau otomatis dari kecocokan label. */
export function fieldBinding(entity, node) {
    const fields = entity?.fields || [];
    if (node.cfg?.field) return fields.find(f => f.name === node.cfg.field) || null;
    const label = String(node.props?.label ?? '').trim().toLowerCase();
    if (!label) return null;
    return fields.find(f => fieldLabel(f).toLowerCase() === label || f.name.toLowerCase() === label) || null;
}

export const FORM_COMPONENTS = ['TextField', 'TextAreaField', 'PasswordField', 'SelectField', 'SwitchField'];

/** Komponen yang bisa dikonfigurasi khusus di inspector (selain props visual dari mapping). */
export function behaviorOf(exportName) {
    if (exportName === 'Table') return 'table';
    if (exportName === 'Button' || exportName === 'IconButton') return 'action';
    if (FORM_COMPONENTS.includes(exportName)) return 'field';
    if (exportName === 'FilterToolbar') return 'filter';
    return null;
}

/** Props data untuk Live DOM Renderer (kolom & baris contoh dari entity) — sama semantik dengan kode hasil generate. */
export function previewDataProps(node, entity, rolePreview = {}) {
    if (node.exportName === 'Table') {
        const t = tableModel(entity, node.cfg);
        if (!t.columns.length) return {};
        const rows = sampleRows(entity.fields, 5);
        return {
            columns: t.columns.map(c => ({ key: c.key, header: c.header, ...(c.type === 'boolean' ? { render: r => (r[c.key] ? 'Aktif' : 'Nonaktif') } : {}) })),
            data: rows, totalRecords: rows.length, pageSize: t.pageSize,
            renderAction: t.rowActions.length ? rolePreview.renderAction : undefined,
        };
    }
    const f = FORM_COMPONENTS.includes(node.exportName) ? fieldBinding(entity, node) : null;
    if (f?.type === 'enum') return { options: (f.options || []).map(o => ({ label: titleCase(o), value: o })) };
    return {};
}

/** Perilaku tombol bila belum diatur: ditebak dari teks (Simpan → submit, Batal → kembali, Tambah → screen create). */
export function autoAction(mod, screen, label) {
    const l = String(label ?? '').toLowerCase();
    if ((screen.role === 'create' || screen.role === 'edit') && /simpan|save|submit|kirim/.test(l)) return { type: 'submit' };
    if (/batal|cancel|kembali|back/.test(l)) return { type: 'back' };
    if (/tambah|add|baru|create|new/.test(l)) {
        const target = mod.screens.find(s => s.role === 'create');
        if (target) return { type: 'navigate', screenId: target.id };
    }
    return { type: 'none' };
}

/** Buang nilai kosong dari konfigurasi node supaya config tersimpan ringkas. */
export function cleanNodeCfg(cfg) {
    const out = {};
    for (const [k, v] of Object.entries(cfg || {})) {
        if (v === undefined || v === null || v === false || v === '') continue;
        if (Array.isArray(v) ? false : typeof v === 'object') {
            const inner = cleanNodeCfg(v);
            if (Object.keys(inner).length) out[k] = inner;
        }
        else out[k] = v;
    }
    return out;
}

/** Cari node di pohon screen. */
export function findTreeNode(tree, id) {
    if (!tree) return null;
    if (tree.nodeId === id) return tree;
    for (const c of tree.children || []) {
        const hit = findTreeNode(c, id);
        if (hit) return hit;
    }
    return null;
}
