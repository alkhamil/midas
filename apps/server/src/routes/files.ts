import { and, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { assets, designFilePages, designFiles, designFolders } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import { assetKey, getObject, putObject } from '../lib/s3.js';

type FileRow = typeof designFiles.$inferSelect;

const ms = (d: Date | null) => (d ? d.getTime() : null);
const assetUrl = (fileId: string, assetId: string) => `/api/files/${encodeURIComponent(fileId)}/assets/${encodeURIComponent(assetId)}`;

/** Ringkasan file untuk halaman Home — bentuknya sama dengan entri `lib.index` di Studio. */
function summary(f: FileRow) {
    return {
        id: f.id,
        name: f.name,
        created: ms(f.createdAt),
        updated: ms(f.updatedAt),
        opened: ms(f.openedAt) ?? 0,
        thumb: f.thumbnail,
        trashed: ms(f.trashedAt) ?? undefined,
        folder: f.folderId ?? null,
        starred: f.starred,
        hiddenRecent: f.hiddenRecent,
        version: f.version,
    };
}

async function findFile(req: FastifyRequest, id: string): Promise<FileRow | null> {
    const [f] = await db.select().from(designFiles)
        .where(and(eq(designFiles.id, id), eq(designFiles.workspaceId, req.user!.workspaceId), isNull(designFiles.deletedAt)))
        .limit(1);
    return f ?? null;
}

async function fileOr404(req: FastifyRequest, reply: FastifyReply, id: string): Promise<FileRow | null> {
    const f = await findFile(req, id);
    if (!f)
        reply.code(404).send({ error: 'not_found', message: 'File not found' });
    return f;
}

/** `data:<mime>;base64,<...>` → buffer + mime; null bila bukan data URL base64. */
function decodeDataUrl(url: string): { mime: string; buf: Buffer } | null {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
    if (!m)
        return null;
    const mime = m[1] || 'application/octet-stream';
    const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
    return { mime, buf };
}

async function storeAsset(fileId: string, assetId: string, mime: string, buf: Buffer) {
    const key = assetKey(fileId, assetId);
    await putObject(key, buf, mime);
    await db.insert(assets).values({ fileId, assetId, storageKey: key, mime, size: buf.length })
        .onConflictDoUpdate({ target: [assets.fileId, assets.assetId], set: { storageKey: key, mime, size: buf.length } });
}

const pageShape = z.object({ id: z.string().min(1), name: z.string().default('Page'), parentId: z.string().nullish() }).passthrough();
const docShape = z.object({
    name: z.string().default('Untitled'),
    pageId: z.string().nullish(),
    pages: z.array(pageShape).default([]),
    tokens: z.unknown().optional(),
    variables: z.unknown().optional(),
    thumbnailId: z.string().nullish(),
    guideStyles: z.unknown().optional(),
    assets: z.record(z.string(), z.string()).optional(),
    created: z.number().optional(),
}).passthrough();

/** Metadata dokumen yang disimpan di `design_files.meta` (tanpa isi page dan aset). */
function metaOf(data: z.infer<typeof docShape>) {
    const { pages, assets: _assets, ...rest } = data;
    return { ...rest, format: 'midas', version: 1, pageMeta: pages.map(p => ({ id: p.id, name: p.name, parentId: p.parentId ?? null })) };
}

export async function fileRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    // Body biner untuk upload aset.
    app.addContentTypeParser(/^(image\/|application\/octet-stream|font\/|video\/)/, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

    app.get('/api/files', async req => {
        const rows = await db.select().from(designFiles)
            .where(and(eq(designFiles.workspaceId, req.user!.workspaceId), isNull(designFiles.deletedAt)));
        return { files: rows.map(summary) };
    });

    app.get<{ Params: { id: string } }>('/api/files/:id', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        return { file: { ...summary(f), meta: f.meta } };
    });

    // Buat atau perbarui metadata dokumen. `baseVersion` = versi yang diketahui Studio;
    // bila berbeda dengan server → 409 (optimistic concurrency).
    app.put<{ Params: { id: string } }>('/api/files/:id', async (req, reply) => {
        const body = z.object({
            name: z.string().min(1),
            meta: z.record(z.string(), z.unknown()),
            baseVersion: z.number().int().nullish(),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const { name, meta, baseVersion } = body.data;
        const id = req.params.id;
        const [any] = await db.select({ ws: designFiles.workspaceId, deletedAt: designFiles.deletedAt }).from(designFiles).where(eq(designFiles.id, id)).limit(1);
        if (any && any.ws !== req.user!.workspaceId)
            return reply.code(403).send({ error: 'forbidden' });
        if (!any) {
            const created = typeof meta.created === 'number' ? new Date(meta.created) : new Date();
            await db.insert(designFiles).values({ id, workspaceId: req.user!.workspaceId, name, meta, createdBy: req.user!.id, createdAt: created, openedAt: new Date() });
            return { version: 1 };
        }
        if (any.deletedAt)
            return reply.code(410).send({ error: 'gone', message: 'File has been deleted' });
        const cond = baseVersion == null ? eq(designFiles.id, id) : and(eq(designFiles.id, id), eq(designFiles.version, baseVersion));
        const [row] = await db.update(designFiles)
            .set({ name, meta, version: sql`${designFiles.version} + 1`, updatedAt: new Date() })
            .where(cond)
            .returning({ version: designFiles.version });
        if (!row) {
            const f = await findFile(req, id);
            return reply.code(409).send({ error: 'conflict', message: 'File changed elsewhere', version: f?.version });
        }
        return { version: row.version };
    });

    // Field ringan untuk Home (nama, dibuka terakhir, thumbnail, trash) — tanpa cek versi.
    app.patch<{ Params: { id: string } }>('/api/files/:id', async (req, reply) => {
        const body = z.object({
            name: z.string().min(1).optional(),
            opened: z.number().nullish(),
            thumb: z.string().nullish(),
            trashed: z.number().nullish(),
            folder: z.string().nullish(),
            starred: z.boolean().optional(),
            hiddenRecent: z.boolean().optional(),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid' });
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const b = body.data;
        const set: Partial<typeof designFiles.$inferInsert> = {};
        if (b.name !== undefined) {
            set.name = b.name;
            set.meta = { ...(f.meta as object), name: b.name };
        }
        if (b.opened !== undefined)
            set.openedAt = b.opened ? new Date(b.opened) : null;
        if (b.thumb !== undefined)
            set.thumbnail = b.thumb;
        if (b.trashed !== undefined)
            set.trashedAt = b.trashed ? new Date(b.trashed) : null;
        if (b.folder !== undefined) {
            if (b.folder) {
                const [fo] = await db.select({ id: designFolders.id }).from(designFolders)
                    .where(and(eq(designFolders.id, b.folder), eq(designFolders.workspaceId, req.user!.workspaceId))).limit(1);
                if (!fo)
                    return reply.code(404).send({ error: 'not_found', message: 'Folder not found' });
            }
            set.folderId = b.folder || null;
        }
        if (b.starred !== undefined)
            set.starred = b.starred;
        if (b.hiddenRecent !== undefined)
            set.hiddenRecent = b.hiddenRecent;
        if (Object.keys(set).length)
            await db.update(designFiles).set(set).where(eq(designFiles.id, f.id));
        return { ok: true };
    });

    // ----- Folder di Home -----
    const folderOf = async (req: FastifyRequest, id: string) => (await db.select().from(designFolders)
        .where(and(eq(designFolders.id, id), eq(designFolders.workspaceId, req.user!.workspaceId))).limit(1))[0] ?? null;

    app.get('/api/folders', async req => {
        const rows = await db.select().from(designFolders).where(eq(designFolders.workspaceId, req.user!.workspaceId));
        return { folders: rows.map(f => ({ id: f.id, name: f.name, parent: f.parentId ?? null, created: ms(f.createdAt) })) };
    });

    app.post('/api/folders', async (req, reply) => {
        const body = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(120), parent: z.string().nullish() }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid' });
        const b = body.data;
        if (b.parent && !(await folderOf(req, b.parent)))
            return reply.code(404).send({ error: 'not_found', message: 'Parent folder not found' });
        await db.insert(designFolders).values({ id: b.id, workspaceId: req.user!.workspaceId, name: b.name, parentId: b.parent || null })
            .onConflictDoNothing();
        return { ok: true };
    });

    app.patch<{ Params: { id: string } }>('/api/folders/:id', async (req, reply) => {
        const body = z.object({ name: z.string().trim().min(1).max(120).optional(), parent: z.string().nullish() }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid' });
        const f = await folderOf(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found', message: 'Folder not found' });
        const set: Partial<typeof designFolders.$inferInsert> = {};
        if (body.data.name !== undefined)
            set.name = body.data.name;
        if (body.data.parent !== undefined) {
            // A folder cannot move into itself or one of its own subfolders.
            const all = await db.select().from(designFolders).where(eq(designFolders.workspaceId, req.user!.workspaceId));
            const byId = new Map(all.map(x => [x.id, x]));
            for (let cur = body.data.parent ? byId.get(body.data.parent) : undefined, i = 0; cur && i < 100; cur = cur.parentId ? byId.get(cur.parentId) : undefined, i++)
                if (cur.id === f.id)
                    return reply.code(400).send({ error: 'invalid', message: 'A folder cannot be moved into itself' });
            if (body.data.parent && !byId.has(body.data.parent))
                return reply.code(404).send({ error: 'not_found', message: 'Parent folder not found' });
            set.parentId = body.data.parent || null;
        }
        if (Object.keys(set).length)
            await db.update(designFolders).set(set).where(eq(designFolders.id, f.id));
        return { ok: true };
    });

    // Deleting a folder keeps its contents: files and subfolders move up to its parent.
    app.delete<{ Params: { id: string } }>('/api/folders/:id', async (req, reply) => {
        const f = await folderOf(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found', message: 'Folder not found' });
        await db.update(designFiles).set({ folderId: f.parentId ?? null }).where(and(eq(designFiles.folderId, f.id), eq(designFiles.workspaceId, req.user!.workspaceId)));
        await db.update(designFolders).set({ parentId: f.parentId ?? null }).where(and(eq(designFolders.parentId, f.id), eq(designFolders.workspaceId, req.user!.workspaceId)));
        await db.delete(designFolders).where(eq(designFolders.id, f.id));
        return { ok: true };
    });

    app.delete<{ Params: { id: string } }>('/api/files/:id', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        await db.update(designFiles).set({ deletedAt: new Date() }).where(eq(designFiles.id, f.id));
        return { ok: true };
    });

    app.get<{ Params: { id: string } }>('/api/files/:id/pages', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const rows = await db.select({ pageId: designFilePages.pageId, data: designFilePages.data, version: designFilePages.version })
            .from(designFilePages).where(eq(designFilePages.fileId, f.id));
        return { pages: rows };
    });

    app.get<{ Params: { id: string; pageId: string } }>('/api/files/:id/pages/:pageId', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const [p] = await db.select().from(designFilePages)
            .where(and(eq(designFilePages.fileId, f.id), eq(designFilePages.pageId, req.params.pageId))).limit(1);
        if (!p)
            return reply.code(404).send({ error: 'not_found' });
        return { page: { pageId: p.pageId, data: p.data, version: p.version } };
    });

    // Simpan satu page. `baseVersion` null = page baru; angka = versi yang diketahui Studio.
    app.put<{ Params: { id: string; pageId: string } }>('/api/files/:id/pages/:pageId', async (req, reply) => {
        const body = z.object({ data: pageShape, baseVersion: z.number().int().nullish() }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const { data, baseVersion } = body.data;
        const pageId = req.params.pageId;
        const values = { name: data.name, parentId: data.parentId ?? null, data, updatedBy: req.user!.id, updatedAt: new Date() };
        let version: number | undefined;
        if (baseVersion == null) {
            const [row] = await db.insert(designFilePages).values({ fileId: f.id, pageId, ...values })
                .onConflictDoNothing().returning({ version: designFilePages.version });
            version = row?.version;
        }
        else {
            const [row] = await db.update(designFilePages)
                .set({ ...values, version: sql`${designFilePages.version} + 1` })
                .where(and(eq(designFilePages.fileId, f.id), eq(designFilePages.pageId, pageId), eq(designFilePages.version, baseVersion)))
                .returning({ version: designFilePages.version });
            version = row?.version;
        }
        if (version === undefined) {
            const [cur] = await db.select({ version: designFilePages.version }).from(designFilePages)
                .where(and(eq(designFilePages.fileId, f.id), eq(designFilePages.pageId, pageId))).limit(1);
            return reply.code(409).send({ error: 'conflict', message: 'Page changed elsewhere', version: cur?.version ?? null });
        }
        await db.update(designFiles).set({ updatedAt: new Date() }).where(eq(designFiles.id, f.id));
        return { version };
    });

    app.delete<{ Params: { id: string; pageId: string } }>('/api/files/:id/pages/:pageId', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        await db.delete(designFilePages).where(and(eq(designFilePages.fileId, f.id), eq(designFilePages.pageId, req.params.pageId)));
        return { ok: true };
    });

    app.get<{ Params: { id: string } }>('/api/files/:id/assets', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const rows = await db.select({ assetId: assets.assetId }).from(assets).where(eq(assets.fileId, f.id));
        return { assets: rows.map(r => r.assetId) };
    });

    app.put<{ Params: { id: string; assetId: string } }>('/api/files/:id/assets/:assetId', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        if (!Buffer.isBuffer(req.body) || !req.body.length)
            return reply.code(400).send({ error: 'invalid', message: 'Asset body is empty' });
        await storeAsset(f.id, req.params.assetId, req.headers['content-type'] ?? 'application/octet-stream', req.body);
        return { url: assetUrl(f.id, req.params.assetId) };
    });

    app.get<{ Params: { id: string; assetId: string } }>('/api/files/:id/assets/:assetId', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const [a] = await db.select().from(assets).where(and(eq(assets.fileId, f.id), eq(assets.assetId, req.params.assetId))).limit(1);
        if (!a)
            return reply.code(404).send({ error: 'not_found' });
        const buf = await getObject(a.storageKey);
        return reply.header('content-type', a.mime).header('cache-control', 'private, max-age=31536000, immutable').send(buf);
    });

    // Dokumen lengkap dalam format `.midas` (aset di-embed sebagai data URL).
    app.get<{ Params: { id: string } }>('/api/files/:id/export', async (req, reply) => {
        const f = await fileOr404(req, reply, req.params.id);
        if (!f)
            return;
        const meta = f.meta as Record<string, unknown> & { pageMeta?: { id: string; name: string; parentId: string | null }[]; assetUrls?: Record<string, string> };
        const pageRows = await db.select().from(designFilePages).where(eq(designFilePages.fileId, f.id));
        const byId = new Map(pageRows.map(p => [p.pageId, p.data as object]));
        const pages = (meta.pageMeta ?? []).map(pm => byId.get(pm.id) ?? { id: pm.id, name: pm.name, parentId: pm.parentId, nodes: [] });
        const assetMap: Record<string, string> = { ...(meta.assetUrls ?? {}) };
        for (const a of await db.select().from(assets).where(eq(assets.fileId, f.id)))
            assetMap[a.assetId] = `data:${a.mime};base64,${(await getObject(a.storageKey)).toString('base64')}`;
        const { pageMeta: _pm, assetUrls: _au, ...rest } = meta;
        return { ...rest, format: 'midas', version: 1, name: f.name, pages, assets: assetMap };
    });

    // Buat file baru dari dokumen `.midas` lengkap (import, duplikat, migrasi dari IndexedDB).
    app.post('/api/files/import', async (req, reply) => {
        const body = z.object({ id: z.string().min(1).optional(), data: docShape }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const id = body.data.id ?? crypto.randomUUID();
        const data = body.data.data;
        const [exists] = await db.select({ id: designFiles.id }).from(designFiles).where(eq(designFiles.id, id)).limit(1);
        if (exists)
            return reply.code(409).send({ error: 'exists', message: 'A file with this id already exists' });
        const meta: Record<string, unknown> = metaOf(data);
        const assetUrls: Record<string, string> = {};
        const binary: [string, { mime: string; buf: Buffer }][] = [];
        for (const [assetId, url] of Object.entries(data.assets ?? {})) {
            const dec = decodeDataUrl(url);
            if (dec)
                binary.push([assetId, dec]);
            else
                assetUrls[assetId] = url;
        }
        if (Object.keys(assetUrls).length)
            meta.assetUrls = assetUrls;
        const pageVersions: Record<string, number> = {};
        await db.transaction(async tx => {
            await tx.insert(designFiles).values({
                id, workspaceId: req.user!.workspaceId, name: data.name, meta, createdBy: req.user!.id,
                createdAt: data.created ? new Date(data.created) : new Date(), openedAt: new Date(),
            });
            for (const p of data.pages) {
                await tx.insert(designFilePages).values({ fileId: id, pageId: p.id, name: p.name, parentId: p.parentId ?? null, data: p, updatedBy: req.user!.id });
                pageVersions[p.id] = 1;
            }
        });
        for (const [assetId, { mime, buf }] of binary)
            await storeAsset(id, assetId, mime, buf);
        return { id, version: 1, pageVersions };
    });
}
