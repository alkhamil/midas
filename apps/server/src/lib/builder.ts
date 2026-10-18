// Code Builder project configuration (spec §4.1–4.2): modules (folders in src/modules/), entities (for CRUD),
// dan screen = frame di file desain yang didaftarkan dengan role tertentu.
import { z } from 'zod';

export const SCREEN_ROLES = ['list', 'create', 'edit', 'view', 'custom', 'dialog'] as const;
/** What a `dialog` screen is used for (its Dialog component supplies the title, message and button labels). */
export const DIALOG_PURPOSES = ['delete', 'restore', 'discard'] as const;
export const CRUD_ROLES = ['list', 'create', 'edit', 'view'] as const;
export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'datetime', 'enum', 'relation', 'password'] as const;

const MODULE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FIELD_NAME_RE = /^[a-z][A-Za-z0-9]*$/;
const PERMISSION_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

const fieldShape = z.object({
    name: z.string().regex(FIELD_NAME_RE, 'Field name must be camelCase, e.g. `fullName`'),
    label: z.string().max(120).optional(),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(false),
    sortable: z.boolean().default(false),
    filterable: z.boolean().default(false),
    /** Nilai untuk tipe enum. */
    options: z.array(z.string().min(1)).optional(),
    /** Aturan validasi tambahan (selain `required`): `min:N`, `max:N`, `email`, `pattern:REGEX`, `withoutemoticon`. */
    rules: z.array(z.string().max(300)).optional(),
    /** Relasi (tipe relation): module tujuan + field label opsi. String = nama module (format lama). */
    relation: z.union([z.string(), z.object({ moduleId: z.string().min(1), labelField: z.string().optional() })]).optional(),
});

/** Konfigurasi satu node di screen (diatur lewat Properties Inspector): override properti, perilaku, binding data. */
const nodeConfigShape = z.object({
    /** Override props kode komponen (nama prop → nilai). */
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    /** Override isi teks (node teks). */
    text: z.string().optional(),
    hidden: z.boolean().optional(),
    /** Field entity yang dibinding ke komponen form. */
    field: z.string().optional(),
    /** Perilaku tombol. */
    action: z.object({ type: z.enum(['none', 'navigate', 'submit', 'back']), screenId: z.string().optional() }).optional(),
    /** Table configuration (list screens). */
    table: z.object({
        columns: z.array(z.string()).optional(),
        rowActions: z.array(z.enum(['view', 'edit', 'delete', 'restore'])).optional(),
        pageSize: z.number().int().min(1).max(200).optional(),
        headers: z.record(z.string(), z.string().max(80)).optional(),
        widths: z.record(z.string(), z.number().int().min(40).max(800)).optional(),
        emptyText: z.string().max(120).optional(),
        actionHeader: z.string().max(60).optional(),
        /** Skip the confirmation dialog for delete / restore. */
        skipConfirm: z.boolean().optional(),
    }).optional(),
    /** Filter dialog of a FilterToolbar: which entity fields can be filtered. */
    filter: z.object({ fields: z.array(z.string()).optional() }).optional(),
    /** FormItem settings of a form field (12-column grid + label layout). */
    form: z.object({
        span: z.number().int().min(1).max(12).optional(),
        layout: z.enum(['vertical', 'horizontal']).optional(),
        labelWidth: z.number().int().min(80).max(480).optional(),
        align: z.enum(['start', 'center']).optional(),
        tooltip: z.string().max(200).optional(),
    }).optional(),
});

const screenShape = z.object({
    id: z.string().min(1),
    /** id frame (layer root) di file desain project. */
    frameId: z.string().min(1),
    /** Page tempat frame berada — dipakai Studio untuk membuka frame. */
    pageId: z.string().min(1),
    name: z.string().min(1).max(120),
    /** Judul di topbar; kosong = otomatis dari role + label module. */
    title: z.string().max(120).optional(),
    role: z.enum(SCREEN_ROLES),
    /** Only for role `dialog`. */
    purpose: z.enum(DIALOG_PURPOSES).optional(),
    /** Konfigurasi per node (kunci = id node di desain). */
    nodes: z.record(z.string(), nodeConfigShape).default({}),
});

/** Layout aplikasi: sidebar (urutan, label, ikon, sembunyi per module) dan identitas aplikasi/pengguna topbar. */
const layoutShape = z.object({
    appName: z.string().max(60).optional(),
    userName: z.string().max(60).optional(),
    userRole: z.string().max(60).optional(),
    items: z.array(z.object({
        moduleId: z.string().min(1),
        label: z.string().max(60).optional(),
        icon: z.string().max(40).optional(),
        hidden: z.boolean().optional(),
    })).default([]),
});

const moduleShape = z.object({
    id: z.string().min(1),
    name: z.string().regex(MODULE_NAME_RE, 'Module name must be kebab-case, e.g. `user-management`'),
    label: z.string().min(1).max(120),
    parentId: z.string().nullable().default(null),
    permissionKey: z.string().regex(PERMISSION_RE, 'Permission key: lowercase, dot-separated, e.g. `user` or `master.user`').optional(),
    /** Page sumber module (spec §4.1: satu Module bersumber dari satu Page). */
    pageId: z.string().min(1),
    entity: z.object({ fields: z.array(fieldShape).default([]), softDelete: z.boolean().optional() }).optional(),
    screens: z.array(screenShape).default([]),
});

export const configShape = z.object({ modules: z.array(moduleShape).default([]), layout: layoutShape.optional() });
export type BuilderConfig = z.infer<typeof configShape>;
export type BuilderModule = BuilderConfig['modules'][number];

/** Format aturan validasi yang dikenal; mengembalikan pesan error atau null. */
function ruleError(rule: string): string | null {
    if (/^(required|email|withoutemoticon)$/.test(rule)) return null;
    if (/^(min|max):-?\d+(\.\d+)?$/.test(rule)) return null;
    if (rule.startsWith('pattern:') && rule.length > 8) {
        try {
            new RegExp(rule.slice(8));
            return null;
        }
        catch {
            return `invalid regex pattern: ${rule.slice(8)}`;
        }
    }
    return `unknown validation rule: ${rule}`;
}

export const emptyConfig = (): BuilderConfig => ({ modules: [] });

/** `crud` bila ada screen list/create/edit/view, `custom` bila hanya custom, `empty` bila belum ada screen. */
export function moduleType(m: Pick<BuilderModule, 'screens'>): 'crud' | 'custom' | 'empty' {
    if (!m.screens.length) return 'empty';
    return m.screens.some(s => (CRUD_ROLES as readonly string[]).includes(s.role)) ? 'crud' : 'custom';
}

/**
 * Aturan yang tidak bisa diungkapkan schema. Konfigurasi yang belum lengkap (mis. CRUD tanpa field entity)
 * tetap boleh disimpan — itu tampil sebagai Issue di Studio, bukan error simpan.
 */
export function validateConfig(config: BuilderConfig): string[] {
    const errors: string[] = [];
    const byId = new Map(config.modules.map(m => [m.id, m]));
    const seenId = new Set<string>(), seenName = new Map<string, string>();
    for (const m of config.modules) {
        if (seenId.has(m.id)) errors.push(`Module id ${m.id} is used twice`);
        seenId.add(m.id);
        // Nama module = nama folder; harus unik di parent yang sama.
        const scope = `${m.parentId ?? ''}/${m.name}`;
        if (seenName.has(scope)) errors.push(`Module name ${m.name} is already used at the same level`);
        seenName.set(scope, m.id);
        if (m.parentId) {
            if (!byId.has(m.parentId)) errors.push(`Parent of module ${m.name} not found`);
            const seen = new Set([m.id]);
            for (let p = byId.get(m.parentId); p; p = p.parentId ? byId.get(p.parentId) : undefined) {
                if (seen.has(p.id)) {
                    errors.push(`Module ${m.name} forms a parent cycle`);
                    break;
                }
                seen.add(p.id);
            }
        }
        for (const role of CRUD_ROLES)
            if (m.screens.filter(s => s.role === role).length > 1) errors.push(`Module ${m.name} has more than one ${role} screen`);
        const screenIds = new Set<string>();
        const purposes = new Set<string>();
        for (const s of m.screens) {
            if (s.role === 'dialog') {
                if (!s.purpose) errors.push(`Dialog screen ${s.name} in module ${m.name} needs a purpose`);
                else if (purposes.has(s.purpose)) errors.push(`Module ${m.name} has more than one ${s.purpose} dialog`);
                else purposes.add(s.purpose);
            }
            if (screenIds.has(s.id)) errors.push(`Screen id ${s.id} is used twice in module ${m.name}`);
            screenIds.add(s.id);
        }
        const fieldNames = new Set<string>();
        for (const f of m.entity?.fields ?? []) {
            if (fieldNames.has(f.name)) errors.push(`Field ${f.name} is used twice in module ${m.name}`);
            fieldNames.add(f.name);
            if (f.type === 'enum' && !f.options?.length) errors.push(`Field ${f.name} (enum) has no options yet`);
            for (const r of f.rules ?? []) {
                const bad = ruleError(r);
                if (bad) errors.push(`Field ${f.name} in module ${m.name}: ${bad}`);
            }
            if (f.type === 'relation' && f.relation && typeof f.relation === 'object') {
                const rel = f.relation;
                const target = byId.get(rel.moduleId);
                if (!target) errors.push(`Field ${f.name} in module ${m.name}: relation target module not found`);
                else if (rel.labelField && !(target.entity?.fields ?? []).some(x => x.name === rel.labelField))
                    errors.push(`Field ${f.name} in module ${m.name}: label field ${rel.labelField} does not exist in module ${target.name}`);
            }
        }
    }
    return errors;
}

/** Ringkasan untuk daftar project. */
export function configSummary(config: BuilderConfig) {
    return { modules: config.modules.length, screens: config.modules.reduce((t, m) => t + m.screens.length, 0) };
}
