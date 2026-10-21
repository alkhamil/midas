// Model konfigurasi Code Builder yang dipakai bersama Studio (inspector, renderer) dan generator kode:
// layout aplikasi (sidebar/topbar), path route, entity → kolom tabel / contoh data, dan binding field form.
import { camelCase, FORM_FIELD_COMPONENTS, kebabCase } from './screen.js';

export const titleCase = s => String(s).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase());
export const pascalCase = s => { const c = camelCase(s); return c[0].toUpperCase() + c.slice(1); };

export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'datetime', 'enum', 'relation', 'password'];
export const ROW_ACTIONS = ['view', 'edit', 'delete', 'restore'];
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

/** Menu sidebar: modul teratas berurutan sesuai `layout.items`, sisanya menyusul. Path = screen list, atau screen pertama.
 *  Modul anak (parentId) menjadi `children` dari induknya: Master Data → Region = path `/master-data/region`. Induk tanpa
 *  screen hanya mengelompokkan anak-anaknya (tanpa path); induk dengan screen sendiri ikut muncul sebagai anak pertama. */
export function resolveLayout(config) {
    const modules = config.modules || [];
    const layout = config.layout || {};
    const overrides = new Map((layout.items || []).map((it, i) => [it.moduleId, { ...it, order: i }]));
    const sorted = list => [...list].sort((a, b) => (overrides.get(a.id)?.order ?? 1e6 + list.indexOf(a)) - (overrides.get(b.id)?.order ?? 1e6 + list.indexOf(b)));
    const target = m => m.screens.find(s => s.role === 'list') || m.screens.find(s => s.role === 'custom') || m.screens[0];
    const pathOf = m => { const t = target(m); return t ? screenPath(modules, m, t) : undefined; };
    const entry = (m, icon) => {
        const o = overrides.get(m.id) || {};
        return { moduleId: m.id, label: o.label || m.label, icon: o.icon || icon, hidden: !!o.hidden, path: pathOf(m), permissionKey: m.permissionKey || m.name };
    };
    const descendants = m => sorted(modules.filter(c => c.parentId === m.id)).flatMap(c => [c, ...descendants(c)]);
    const items = sorted(modules.filter(m => !m.parentId)).map((m, i) => {
        const item = entry(m, DEFAULT_ICONS[i % DEFAULT_ICONS.length]);
        const kids = descendants(m).map(c => entry(c, 'widget')).filter(c => c.path);
        if (!kids.length) return { ...item, path: item.path ?? modulePath(modules, m) };
        const own = item.path ? [{ ...item, icon: undefined }] : [];
        return { ...item, path: undefined, children: [...own, ...kids] };
    });
    return { appName: layout.appName || 'Midas App', userName: layout.userName || 'Administrator', userRole: layout.userRole || 'admin', items };
}

/**
 * Screens a frame is probably meant to be, guessed from its name (a leading "Page ·" and the module name are ignored):
 * `Region — List` → list, `… — Form` → create + edit, `… — Detail` → view, `Confirm · Delete region` → dialog (delete),
 * `Drawer · Filters` → nothing (the generated list page builds its own filter drawer), anything else → custom.
 * Returns [{ role, purpose? }]; the caller decides which of them are still free in the module.
 */
export function suggestScreens(frameName) {
    const n = String(frameName || '').replace(/^page\s*[·:-]\s*/i, '').toLowerCase();
    if (/drawer|filter/.test(n)) return [];
    if (/confirm|dialog|modal|popup/.test(n)) {
        const purpose = /restore/.test(n) ? 'restore' : /discard|unsaved|leave|cancel/.test(n) ? 'discard' : 'delete';
        return [{ role: 'dialog', purpose }];
    }
    if (/\b(detail|details|view|show|info)\b/.test(n)) return [{ role: 'view' }];
    if (/\b(list|table|index|daftar|browse)\b/.test(n)) return [{ role: 'list' }];
    if (/\b(edit|update|ubah)\b/.test(n) && !/\b(add|create|new|form)\b/.test(n)) return [{ role: 'edit' }];
    if (/\b(add|create|new|tambah)\b/.test(n) && !/\b(edit|form)\b/.test(n)) return [{ role: 'create' }];
    if (/\bform\b|\b(add|create|new|edit)\b/.test(n)) return [{ role: 'create' }, { role: 'edit' }];
    return [{ role: 'custom' }];
}

/** Path menu sidebar yang aktif untuk sebuah module: entri menu milik module itu, atau milik induk terdekatnya. */
export function activeNavPath(layout, modules, module) {
    const byId = new Map(modules.map(m => [m.id, m]));
    const flat = layout.items.flatMap(i => [i, ...(i.children || [])]).filter(i => i.path);
    for (let c = module, n = 0; c && n < 20; c = c.parentId ? byId.get(c.parentId) : null, n++) {
        const hit = flat.find(i => i.moduleId === c.id);
        if (hit) return hit.path;
    }
    return undefined;
}

const PERSON_MODULE = /user|member|customer|employee|staff|person|people/i;
const PEOPLE = ['John Smith', 'Anna Johnson', 'Carlos Rivera', 'Mei Tanaka', 'Omar Hassan'];
const SAMPLE = {
    // Nama orang hanya untuk module yang memang berisi orang; module lain (role, produk, …) memakai "<Module> N".
    string: (f, i, mod) => (/email/i.test(f.name) ? `user${i + 1}@example.com` : /name|title/i.test(f.name) ? (!mod || PERSON_MODULE.test(mod) ? PEOPLE[i % 5] : `${titleCase(mod)} ${i + 1}`) : `${titleCase(f.name)} ${i + 1}`),
    text: (f, i) => `Sample ${titleCase(f.name).toLowerCase()} ${i + 1}`,
    number: (_f, i) => (i + 1) * 10,
    boolean: (_f, i) => i % 3 !== 2,
    date: (_f, i) => `2026-0${(i % 9) + 1}-15`,
    datetime: (_f, i) => `2026-0${(i % 9) + 1}-15T09:00:00`,
    password: () => '',
    relation: (_f, i) => String((i % 3) + 1), // id baris contoh module tujuan
};
export const sampleValue = (f, i, mod) => (f.type === 'enum' ? (f.options?.[i % f.options.length] ?? '') : (SAMPLE[f.type] || SAMPLE.string)(f, i, mod));
export const sampleRows = (fields, n = 5, mod) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), ...Object.fromEntries(fields.map(f => [f.name, sampleValue(f, i, mod)])) }));

const fieldLabel = f => f.label || titleCase(f.name);

/** List table model from the entity + the Table node config. */
export function tableModel(entity, cfg = {}) {
    const fields = entity?.fields || [];
    const t = cfg.table || {};
    const names = t.columns || fields.filter(f => f.type !== 'password' && f.type !== 'text').slice(0, 5).map(f => f.name);
    const columns = names.map(n => fields.find(f => f.name === n)).filter(Boolean).map(f => ({
        key: f.name, header: t.headers?.[f.name] || fieldLabel(f), type: f.type, options: f.options, ...(t.widths?.[f.name] ? { width: t.widths[f.name] } : {}),
    }));
    const softDelete = !!entity?.softDelete;
    return {
        columns, softDelete, pageSize: t.pageSize || 10,
        rowActions: t.rowActions || ['view', 'edit', 'delete', ...(softDelete ? ['restore'] : [])],
        emptyText: t.emptyText || 'No data yet.', actionHeader: t.actionHeader || 'Actions',
        confirm: !t.skipConfirm,
    };
}

/** Detail rows on view screens: a frame of [label text, value text | Badge] whose label matches an entity field → that field. */
export function detailField(node, fields) {
    if (node.kind !== 'box' || node.children.length !== 2) return null;
    const [a, b] = node.children;
    if (a.kind !== 'text' || !(b.kind === 'text' || (b.kind === 'component' && b.exportName === 'Badge'))) return null;
    const label = a.text.trim().toLowerCase();
    return fields.find(f => fieldLabel(f).toLowerCase() === label || f.name.toLowerCase() === label) || null;
}

/** Fields offered in the list filter dialog: `cfg.filter.fields`, else the entity fields marked filterable. */
export function filterFields(entity, cfg = {}) {
    const fields = entity?.fields || [];
    const names = cfg.filter?.fields;
    const list = names ? names.map(n => fields.find(f => f.name === n)).filter(Boolean) : fields.filter(f => f.filterable);
    return list.filter(f => f.type !== 'password');
}

/** FormItem settings of a form field node (12-column grid span, label layout) — same defaults as the base project's FormItem. */
export function formItemOf(node) {
    const f = node.cfg?.form || {};
    return { span: f.span || null, layout: f.layout || 'vertical', labelWidth: f.labelWidth || 256, align: f.align || 'start', tooltip: f.tooltip || '' };
}

/** Field entity yang dibinding ke komponen form: eksplisit (`cfg.field`) atau otomatis dari kecocokan label. */
export function fieldBinding(entity, node) {
    const fields = entity?.fields || [];
    if (node.cfg?.field) return fields.find(f => f.name === node.cfg.field) || null;
    const label = String(node.props?.label ?? '').trim().toLowerCase();
    if (!label) return null;
    return fields.find(f => fieldLabel(f).toLowerCase() === label || f.name.toLowerCase() === label) || null;
}

export const FORM_COMPONENTS = FORM_FIELD_COMPONENTS;

/** Komponen yang bisa dikonfigurasi khusus di inspector (selain props visual dari mapping). */
export function behaviorOf(exportName) {
    if (exportName === 'Table') return 'table';
    if (exportName === 'Button' || exportName === 'IconButton' || exportName === 'SectionHeader') return 'action';
    if (FORM_COMPONENTS.includes(exportName)) return 'field';
    if (exportName === 'FilterToolbar') return 'filter';
    return null;
}

/** Props data untuk Live DOM Renderer (kolom & baris contoh dari entity) — sama semantik dengan kode hasil generate. */
export function previewDataProps(node, entity, rolePreview = {}, modules = []) {
    if (node.exportName === 'Table') {
        const t = tableModel(entity, node.cfg);
        if (!t.columns.length) return {};
        const rows = sampleRows(entity.fields, 5, entity.moduleName);
        return {
            columns: t.columns.map(c => {
                const rel = c.type === 'relation' ? relationSampleOptions(entity.fields.find(f => f.name === c.key), modules) : null;
                return { key: c.key, header: c.header, ...(c.width ? { width: c.width } : {}), ...(c.type === 'boolean' ? { render: r => (r[c.key] ? 'Active' : 'Inactive') } : rel ? { render: r => rel.find(o => o.value === r[c.key])?.label ?? r[c.key] } : {}) };
            }),
            data: rows, totalRecords: rows.length, pageSize: t.pageSize, emptyText: t.emptyText, actionHeader: t.actionHeader,
            renderAction: t.rowActions.length ? rolePreview.renderAction : undefined,
        };
    }
    const f = FORM_COMPONENTS.includes(node.exportName) ? fieldBinding(entity, node) : null;
    if (f?.type === 'enum') return { options: (f.options || []).map(o => ({ label: titleCase(o), value: o })) };
    if (f?.type === 'relation') return { options: relationSampleOptions(f, modules) };
    return {};
}

/** Button behavior when not configured: guessed from the text (Save → submit, Cancel → back, Add → create screen). */
export function autoAction(mod, screen, label) {
    const l = String(label ?? '').toLowerCase();
    if ((screen.role === 'create' || screen.role === 'edit') && /save|submit|send/.test(l)) return { type: 'submit' };
    if (/cancel|back|close/.test(l)) return { type: 'back' };
    if (/add|create|new/.test(l)) {
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

// ------------------------------------------------------------------ validasi (format rules sama dengan base code: `min:3`, `email`, …)

const NUMERIC = new Set(['number']);
export const isNumericField = f => NUMERIC.has(f.type);

/** Aturan validasi sebuah field: `required` + `rules` (`min:N`, `max:N`, `email`, `pattern:REGEX`, `withoutemoticon`). */
export function parseRules(field) {
    const out = { required: !!field.required, min: '', max: '', email: false, pattern: '', noEmoticon: false };
    for (const r of field.rules || []) {
        const i = r.indexOf(':');
        const name = i < 0 ? r : r.slice(0, i), arg = i < 0 ? '' : r.slice(i + 1);
        if (name === 'min' || name === 'max') out[name] = arg;
        else if (name === 'pattern') out.pattern = arg;
        else if (name === 'email') out.email = true;
        else if (name === 'withoutemoticon') out.noEmoticon = true;
    }
    return out;
}

/** Field baru dengan aturan `key` diubah (`value` kosong/false = hapus aturan). */
export function withRule(field, key, value) {
    const cur = parseRules(field);
    cur[key] = value;
    const { required, ...rest } = cur;
    const rules = [];
    if (rest.min !== '' && rest.min != null) rules.push(`min:${rest.min}`);
    if (rest.max !== '' && rest.max != null) rules.push(`max:${rest.max}`);
    if (rest.email) rules.push('email');
    if (rest.pattern) rules.push(`pattern:${rest.pattern}`);
    if (rest.noEmoticon) rules.push('withoutemoticon');
    const next = { ...field, required };
    if (rules.length) next.rules = rules;
    else delete next.rules;
    return next;
}

/** Aturan yang valid untuk format string; mengembalikan pesan error atau null. */
export function ruleError(rule) {
    if (/^(required|email|withoutemoticon)$/.test(rule)) return null;
    if (/^(min|max):-?\d+(\.\d+)?$/.test(rule)) return null;
    if (rule.startsWith('pattern:') && rule.length > 8) {
        try { new RegExp(rule.slice(8)); return null; } catch { return `Invalid regex pattern: ${rule.slice(8)}`; }
    }
    return `Unknown validation rule: ${rule}`;
}

// ------------------------------------------------------------------ relasi antar module

/**
 * Relasi sebuah field `relation`: `{ module, labelField, valueField }`. `field.relation` boleh objek
 * `{ moduleId, labelField }` atau string nama module (format lama); label default = field `name`/pertama.
 */
export function relationOf(field, modules) {
    if (field.type !== 'relation' || !field.relation) return null;
    const r = field.relation;
    const module = typeof r === 'string' ? modules.find(m => m.name === r) : modules.find(m => m.id === r.moduleId);
    if (!module) return null;
    const fields = module.entity?.fields || [];
    const labelField = (typeof r === 'object' && r.labelField) || (fields.find(f => f.name === 'name') || fields.find(f => f.type === 'string') || fields[0])?.name;
    return labelField ? { module, labelField, valueField: 'id' } : null;
}

/** Opsi select dari baris contoh module tujuan (pratinjau di Studio). */
export function relationSampleOptions(field, modules) {
    const rel = relationOf(field, modules);
    if (!rel) return [];
    const target = rel.module.entity?.fields || [];
    return sampleRows(target, 5, rel.module.name).map(r => ({ label: String(r[rel.labelField]), value: r.id }));
}

// ------------------------------------------------------------------ judul halaman & breadcrumb (topbar)

const ROLE_PREFIX = { create: 'Add', edit: 'Edit', view: 'Detail' };

/** Judul di topbar: `screen.title` bila diisi, selain itu dari role (Add/Edit/Detail + module label). */
export function pageTitle(mod, screen) {
    if (screen.title) return screen.title;
    if (ROLE_PREFIX[screen.role]) return `${ROLE_PREFIX[screen.role]} ${mod.label}`;
    if (screen.role === 'custom' && screen.name.toLowerCase() !== mod.label.toLowerCase()) return screen.name;
    return mod.label;
}

/** Breadcrumb: Beranda / (parent module) / module / aksi. Beranda sendiri (module `dashboard`) hanya satu crumb. */
export function breadcrumbsOf(modules, mod, screen) {
    const byId = new Map(modules.map(m => [m.id, m]));
    const chain = [];
    for (let c = mod, n = 0; c && n < 20; c = c.parentId ? byId.get(c.parentId) : null, n++) chain.unshift(c);
    if (mod.name === 'dashboard' && !mod.parentId && screenPath(modules, mod, screen) === '/') return [{ label: mod.label }];
    const crumbs = [{ label: 'Home', path: '/' }];
    const listOf = m => m.screens.find(s => s.role === 'list');
    chain.forEach(m => {
        const list = listOf(m);
        crumbs.push({ label: m.label, ...(list ? { path: screenPath(modules, m, list) } : {}) });
    });
    const last = ROLE_PREFIX[screen.role] || (screen.role === 'custom' && pageTitle(mod, screen) !== mod.label ? pageTitle(mod, screen) : null);
    if (last) crumbs.push({ label: last });
    else delete crumbs[crumbs.length - 1].path;
    return crumbs;
}
