import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** admin | editor | viewer */
    role: text('role').notNull().default('editor'),
    /** Nonaktif = tidak bisa login. */
    active: boolean('active').notNull().default(true),
    /** all = semua file di workspace; selected = hanya yang dibuat sendiri dan yang diberikan di `user_file_access`. */
    accessMode: text('access_mode').notNull().default('all'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Cakupan akses user bermode `selected`: folder (termasuk isinya) atau file tertentu. */
export const userFileAccess = pgTable('user_file_access', {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    /** folder | file */
    kind: text('kind').notNull(),
    targetId: text('target_id').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.kind, t.targetId] })]);

/** Token API pribadi (untuk MCP): hanya hash-nya yang disimpan; teks tokennya tampil sekali saat dibuat. */
export const apiTokens = pgTable('api_tokens', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** Beberapa karakter awal, untuk dikenali di daftar. */
    prefix: text('prefix').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
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
    /** The documentation site of the library (/docs/<name>) can be opened by anyone with the link, not only by the workspace. */
    docsPublic: boolean('docs_public').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Satu versi library (immutable). `seq` naik 1 setiap publish dan dipakai Studio untuk mendeteksi update. */
export const libraryVersions = pgTable('library_versions', {
    id: uuid('id').primaryKey().defaultRandom(),
    libraryId: text('library_id').notNull().references(() => libraries.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    releaseNotes: text('release_notes'),
    snapshotKey: text('snapshot_key').notNull(),
    componentsCount: integer('components_count').notNull().default(0),
    variablesCount: integer('variables_count').notNull().default(0),
    /** published | deprecated */
    designStatus: text('design_status').notNull().default('published'),
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [uniqueIndex('library_versions_seq_idx').on(t.libraryId, t.seq)]);

/** Library yang dipakai sebuah file desain, beserta `seq` versi yang sedang dipakai. */
export const fileLibraries = pgTable('file_libraries', {
    fileId: text('file_id').notNull().references(() => designFiles.id, { onDelete: 'cascade' }),
    libraryId: text('library_id').notNull().references(() => libraries.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.fileId, t.libraryId] })]);
