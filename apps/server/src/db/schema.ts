import { bigint, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
}, t => [index('design_files_workspace_idx').on(t.workspaceId)]);

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
