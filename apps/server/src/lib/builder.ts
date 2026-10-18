// Konfigurasi Code Builder project (spec §4.1–4.2): module (folder di src/modules/), entity (untuk CRUD),
// dan screen = frame di file desain yang didaftarkan dengan role tertentu.
import { z } from 'zod';

export const SCREEN_ROLES = ['list', 'create', 'edit', 'view', 'custom'] as const;
export const CRUD_ROLES = ['list', 'create', 'edit', 'view'] as const;
export const FIELD_TYPES = ['string', 'text', 'number', 'boolean', 'date', 'datetime', 'enum', 'relation'] as const;

const MODULE_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FIELD_NAME_RE = /^[a-z][A-Za-z0-9]*$/;
const PERMISSION_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;

const fieldShape = z.object({
    name: z.string().regex(FIELD_NAME_RE, 'Nama field harus camelCase, mis. `fullName`'),
    label: z.string().max(120).optional(),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(false),
    sortable: z.boolean().default(false),
    filterable: z.boolean().default(false),
    /** Nilai untuk tipe enum. */
    options: z.array(z.string().min(1)).optional(),
    /** Module tujuan untuk tipe relation. */
    relation: z.string().optional(),
});

const screenShape = z.object({
    id: z.string().min(1),
    /** id frame (layer root) di file desain project. */
    frameId: z.string().min(1),
    /** Page tempat frame berada — dipakai Studio untuk membuka frame. */
    pageId: z.string().min(1),
    name: z.string().min(1).max(120),
    role: z.enum(SCREEN_ROLES),
});

const moduleShape = z.object({
    id: z.string().min(1),
    name: z.string().regex(MODULE_NAME_RE, 'Nama module harus kebab-case, mis. `user-management`'),
    label: z.string().min(1).max(120),
    parentId: z.string().nullable().default(null),
    permissionKey: z.string().regex(PERMISSION_RE, 'Permission key: huruf kecil, dipisah titik, mis. `user` atau `master.user`').optional(),
    /** Page sumber module (spec §4.1: satu Module bersumber dari satu Page). */
    pageId: z.string().min(1),
    entity: z.object({ fields: z.array(fieldShape).default([]) }).optional(),
    screens: z.array(screenShape).default([]),
});

export const configShape = z.object({ modules: z.array(moduleShape).default([]) });
export type BuilderConfig = z.infer<typeof configShape>;
export type BuilderModule = BuilderConfig['modules'][number];

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
        if (seenId.has(m.id)) errors.push(`Id module ${m.id} dipakai dua kali`);
        seenId.add(m.id);
        // Nama module = nama folder; harus unik di parent yang sama.
        const scope = `${m.parentId ?? ''}/${m.name}`;
        if (seenName.has(scope)) errors.push(`Nama module ${m.name} sudah dipakai di level yang sama`);
        seenName.set(scope, m.id);
        if (m.parentId) {
            if (!byId.has(m.parentId)) errors.push(`Parent module ${m.name} tidak ditemukan`);
            const seen = new Set([m.id]);
            for (let p = byId.get(m.parentId); p; p = p.parentId ? byId.get(p.parentId) : undefined) {
                if (seen.has(p.id)) {
                    errors.push(`Module ${m.name} membentuk siklus parent`);
                    break;
                }
                seen.add(p.id);
            }
        }
        for (const role of CRUD_ROLES)
            if (m.screens.filter(s => s.role === role).length > 1) errors.push(`Module ${m.name} punya lebih dari satu screen ${role}`);
        const screenIds = new Set<string>();
        for (const s of m.screens) {
            if (screenIds.has(s.id)) errors.push(`Id screen ${s.id} dipakai dua kali di module ${m.name}`);
            screenIds.add(s.id);
        }
        const fieldNames = new Set<string>();
        for (const f of m.entity?.fields ?? []) {
            if (fieldNames.has(f.name)) errors.push(`Field ${f.name} dipakai dua kali di module ${m.name}`);
            fieldNames.add(f.name);
            if (f.type === 'enum' && !f.options?.length) errors.push(`Field ${f.name} (enum) belum punya pilihan`);
        }
    }
    return errors;
}

/** Ringkasan untuk daftar project. */
export function configSummary(config: BuilderConfig) {
    return { modules: config.modules.length, screens: config.modules.reduce((t, m) => t + m.screens.length, 0) };
}
