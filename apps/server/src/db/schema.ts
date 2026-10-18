import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
    id: text('id').primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable('workspaces', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable('workspace_members', {
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** owner | editor | viewer */
    role: text('role').notNull().default('owner'),
}, t => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

/**
 * File desain. `id` dibuat oleh Studio (uuid), sehingga file bisa dibuat dan disimpan
 * tanpa round-trip tambahan. `meta` = metadata dokumen (pageMeta, tokens, variables, …),
 * isi page ada di `design_file_pages`.
 */
export const designFiles = pgTable('design_files', {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    meta: jsonb('meta').notNull(),
    version: integer('version').notNull().default(1),
    /** Thumbnail kecil (data URL JPEG) untuk halaman Home. */
    thumbnail: text('thumbnail'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    trashedAt: timestamp('trashed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    /** Folder di Home (`design_folders.id`); null = di root "All files". */
    folderId: text('folder_id'),
    /** Muncul di sidebar Home (Starred). */
    starred: boolean('starred').notNull().default(false),
    /** Disembunyikan dari Recents ("Remove from recent"); kembali bila file dibuka lagi. */
    hiddenRecent: boolean('hidden_recent').notNull().default(false),
}, t => [index('design_files_workspace_idx').on(t.workspaceId)]);

/** Folder untuk menata file desain di Home; bisa bersarang lewat `parentId`. */
export const designFolders = pgTable('design_folders', {
    id: text('id').primaryKey(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('design_folders_workspace_idx').on(t.workspaceId)]);

/** Satu baris per page: `data` = objek page lengkap (termasuk `nodes`). */
export const designFilePages = pgTable('design_file_pages', {
    fileId: text('file_id').notNull().references(() => designFiles.id, { onDelete: 'cascade' }),
    pageId: text('page_id').notNull(),
    name: text('name').notNull(),
    parentId: text('parent_id'),
    data: jsonb('data').notNull(),
    version: integer('version').notNull().default(1),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.fileId, t.pageId] })]);

/** Aset biner (gambar) di object storage; Postgres hanya menyimpan metadata. */
export const assets = pgTable('assets', {
    fileId: text('file_id').notNull().references(() => designFiles.id, { onDelete: 'cascade' }),
    assetId: text('asset_id').notNull(),
    storageKey: text('storage_key').notNull(),
    mime: text('mime').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.fileId, t.assetId] })]);

/**
 * Key-value per user untuk preferensi dan state editor yang belum punya tabel sendiri
 * (file terakhir dibuka, daftar library lama, dst.).
 */
export const userKv = pgTable('user_kv', {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.key] })]);

/**
 * Design system library. Satu library = satu file desain sumber, sehingga `id` = id file sumber
 * (dipakai Studio sebagai `libRef` pada layer hasil salinan komponen library).
 */
export const libraries = pgTable('libraries', {
    id: text('id').primaryKey().references(() => designFiles.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Nama paket frontend, mis. `@midas/ui-cms`. Unik dan tidak bisa diubah setelah publish pertama. */
    packageName: text('package_name').notNull().unique(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Satu versi library (immutable). `seq` naik 1 setiap publish dan dipakai Studio untuk mendeteksi
 * update; `version` = semver yang sama dengan versi paket kode.
 */
export const libraryVersions = pgTable('library_versions', {
    id: uuid('id').primaryKey().defaultRandom(),
    libraryId: text('library_id').notNull().references(() => libraries.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    version: text('version').notNull(),
    releaseNotes: text('release_notes'),
    snapshotKey: text('snapshot_key').notNull(),
    componentsCount: integer('components_count').notNull().default(0),
    variablesCount: integer('variables_count').notNull().default(0),
    /** Library Kit (theme, tipe props, manifest) — diisi oleh generator Library Kit. */
    manifest: jsonb('manifest'),
    /** published | deprecated */
    designStatus: text('design_status').notNull().default('published'),
    /** pending | ready | partial — dari laporan CI paket kode. */
    codeStatus: text('code_status').notNull().default('pending'),
    bundleUrl: text('bundle_url'),
    codeReportedAt: timestamp('code_reported_at', { withTimezone: true }),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('library_versions_seq_idx').on(t.libraryId, t.seq), uniqueIndex('library_versions_version_idx').on(t.libraryId, t.version)]);

/** Pemetaan komponen desain → export kode untuk satu versi library. */
export const componentMappings = pgTable('component_mappings', {
    libraryVersionId: uuid('library_version_id').notNull().references(() => libraryVersions.id, { onDelete: 'cascade' }),
    /** id root komponen (component set / main component) di file sumber. */
    componentKey: text('component_key').notNull(),
    componentName: text('component_name').notNull(),
    exportName: text('export_name').notNull(),
    /** { props: [{ source, key, label, name, type, values? }] } */
    propsMap: jsonb('props_map').notNull(),
    /** ready | not_implemented | mismatch */
    codeStatus: text('code_status').notNull().default('not_implemented'),
    /** Keterangan dari `midas report`, mis. "props tidak sesuai desain: size". */
    codeDetail: text('code_detail'),
}, t => [primaryKey({ columns: [t.libraryVersionId, t.componentKey] })]);

/** Library yang dipakai sebuah file desain, beserta `seq` versi yang sedang dipakai. */
export const fileLibraries = pgTable('file_libraries', {
    fileId: text('file_id').notNull().references(() => designFiles.id, { onDelete: 'cascade' }),
    libraryId: text('library_id').notNull().references(() => libraries.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.fileId, t.libraryId] })]);

/**
 * Code Builder project (spec §4): satu aplikasi hasil generate. Screen-nya adalah frame di file desain `fileId`,
 * komponennya dari library `libraryId` versi `libraryVersion` (semver). `config` = { modules: [...] } — module,
 * entity, dan screen terdaftar (lihat lib/builder.ts). `version` naik setiap simpan (deteksi konflik).
 */
export const builderProjects = pgTable('builder_projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    fileId: text('file_id').notNull().references(() => designFiles.id, { onDelete: 'cascade' }),
    libraryId: text('library_id').references(() => libraries.id, { onDelete: 'set null' }),
    libraryVersion: text('library_version'),
    config: jsonb('config').notNull(),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('builder_projects_workspace_idx').on(t.workspaceId), index('builder_projects_file_idx').on(t.fileId)]);
