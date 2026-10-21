import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { designFiles, fileLibraries, libraries, libraryVersions } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import type { LibrarySnapshot } from '../lib/library.js';
import { deletePrefix, getObject, putObject } from '../lib/s3.js';

type VersionRow = typeof libraryVersions.$inferSelect;

const snapshotKey = (libraryId: string, seq: number) => `libraries/${libraryId}/${seq}.json`;

const snapshotShape = z.object({
    components: z.array(z.object({ id: z.string().min(1), name: z.string(), set: z.boolean().optional(), nodes: z.array(z.object({ id: z.string() }).passthrough()) }).passthrough()),
    variables: z.object({ collections: z.array(z.unknown()).default([]), items: z.array(z.unknown()).default([]) }).passthrough().default({ collections: [], items: [] }),
    assets: z.record(z.string(), z.string()).default({}),
});

async function sourceFile(req: FastifyRequest, id: string) {
    const [f] = await db.select().from(designFiles)
        .where(and(eq(designFiles.id, id), eq(designFiles.workspaceId, req.user!.workspaceId), isNull(designFiles.deletedAt))).limit(1);
    return f ?? null;
}

async function libraryOf(req: FastifyRequest, id: string) {
    const [l] = await db.select().from(libraries)
        .where(and(eq(libraries.id, id), eq(libraries.workspaceId, req.user!.workspaceId))).limit(1);
    return l ?? null;
}

async function latestVersion(libraryId: string): Promise<VersionRow | null> {
    const [v] = await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, libraryId)).orderBy(desc(libraryVersions.seq)).limit(1);
    return v ?? null;
}

/** Ringkasan library untuk daftar di Studio (bentuk sama dengan `LIBS.published` di engine). */
function summary(l: typeof libraries.$inferSelect, v: VersionRow) {
    return { id: l.id, name: l.name, version: v.seq, updated: v.publishedAt.getTime(), components: v.componentsCount, variables: v.variablesCount };
}

/** Simpan satu versi baru (snapshot ke object storage + baris versi). */
async function storeVersion(opts: {
    libraryId: string; workspaceId: string; userId: string; name: string; isNew: boolean;
    seq: number; releaseNotes?: string | null; snapshot: LibrarySnapshot; components: number;
}) {
    const published = Date.now();
    const snap = { id: opts.libraryId, name: opts.name, version: opts.seq, updated: published, components: opts.snapshot.components, variables: opts.snapshot.variables, assets: opts.snapshot.assets ?? {} };
    const key = snapshotKey(opts.libraryId, opts.seq);
    await putObject(key, Buffer.from(JSON.stringify(snap)), 'application/json');
    await db.transaction(async tx => {
        if (opts.isNew)
            await tx.insert(libraries).values({ id: opts.libraryId, workspaceId: opts.workspaceId, name: opts.name, createdBy: opts.userId });
        else
            await tx.update(libraries).set({ name: opts.name }).where(eq(libraries.id, opts.libraryId));
        await tx.insert(libraryVersions).values({
            libraryId: opts.libraryId, seq: opts.seq, releaseNotes: opts.releaseNotes ?? null, snapshotKey: key,
            componentsCount: opts.components, variablesCount: opts.snapshot.variables?.items?.length ?? 0,
            publishedBy: opts.userId, publishedAt: new Date(published),
        });
    });
    return snap;
}

export async function libraryRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    // A library lives as long as its source file: files in the trash or deleted take their library away with them.
    app.get('/api/libraries', async req => {
        const libs = await db.select({ l: libraries, thumbnail: designFiles.thumbnail, fileName: designFiles.name })
            .from(libraries).innerJoin(designFiles, eq(designFiles.id, libraries.id))
            .where(and(eq(libraries.workspaceId, req.user!.workspaceId), isNull(designFiles.deletedAt), isNull(designFiles.trashedAt)));
        const out = [];
        for (const { l, thumbnail, fileName } of libs) {
            const v = await latestVersion(l.id);
            if (v)
                out.push({ ...summary(l, v), fileId: l.id, fileName, thumbnail });
        }
        return { libraries: out };
    });

    // Unpublish: the library (all versions, snapshots) is removed; the design file stays as an ordinary file.
    app.delete<{ Params: { id: string } }>('/api/libraries/:id', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        if (!l)
            return reply.code(404).send({ error: 'not_found' });
        await db.delete(libraries).where(eq(libraries.id, l.id));
        await deletePrefix(`libraries/${l.id}/`).catch(() => { });
        return { ok: true };
    });

    app.get<{ Params: { id: string } }>('/api/libraries/:id', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        if (!l)
            return reply.code(404).send({ error: 'not_found' });
        const versions = await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, l.id)).orderBy(desc(libraryVersions.seq));
        return {
            library: { id: l.id, name: l.name, createdAt: l.createdAt.getTime() },
            versions: versions.map(v => ({ seq: v.seq, releaseNotes: v.releaseNotes, components: v.componentsCount, variables: v.variablesCount, designStatus: v.designStatus, publishedAt: v.publishedAt.getTime() })),
        };
    });

    // Snapshot satu versi (default terbaru) — dipakai Studio untuk menyalin komponen & variables.
    app.get<{ Params: { id: string }; Querystring: { seq?: string } }>('/api/libraries/:id/snapshot', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        if (!l)
            return reply.code(404).send({ error: 'not_found' });
        const v = req.query.seq
            ? (await db.select().from(libraryVersions).where(and(eq(libraryVersions.libraryId, l.id), eq(libraryVersions.seq, Number(req.query.seq)))).limit(1))[0]
            : await latestVersion(l.id);
        if (!v)
            return reply.code(404).send({ error: 'not_found' });
        return reply.header('content-type', 'application/json').send(await getObject(v.snapshotKey));
    });

    // Publish Library: versi baru dari file design system.
    app.post<{ Params: { id: string } }>('/api/libraries/:id/versions', async (req, reply) => {
        const body = z.object({
            name: z.string().trim().min(1).max(120),
            releaseNotes: z.string().max(5000).nullish(),
            snapshot: snapshotShape,
            /** Komponen yang dipilih desainer (komponen pendukungnya ikut di snapshot). */
            componentKeys: z.array(z.string()).default([]),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const b = body.data;
        const f = await sourceFile(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found', message: 'Source file not found' });
        const l = await libraryOf(req, f.id);
        const ids = new Set(b.snapshot.components.map(c => c.id));
        const errors: string[] = [];
        if (!b.componentKeys.length && !(b.snapshot.variables.items?.length))
            errors.push('Select at least one component, or create Variables first');
        for (const k of b.componentKeys)
            if (!ids.has(k))
                errors.push(`Component ${k} is not in the snapshot`);
        if (errors.length)
            return reply.code(400).send({ error: 'invalid', message: errors[0], errors });
        const latest = l ? await latestVersion(l.id) : null;
        const snap = await storeVersion({
            libraryId: f.id, workspaceId: req.user!.workspaceId, userId: req.user!.id, name: b.name, isNew: !l,
            seq: (latest?.seq ?? 0) + 1, releaseNotes: b.releaseNotes, snapshot: b.snapshot as LibrarySnapshot, components: b.componentKeys.length,
        });
        return { library: { id: f.id, name: b.name, version: snap.version, updated: snap.updated, components: b.componentKeys.length, variables: b.snapshot.variables.items?.length ?? 0 } };
    });

    // Library yang dipakai sebuah file (bentuk sama dengan `LIBS.use` di engine).
    app.get<{ Params: { id: string } }>('/api/files/:id/libraries', async (req, reply) => {
        const f = await sourceFile(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found' });
        const rows = await db.select({ id: fileLibraries.libraryId, version: fileLibraries.seq, name: libraries.name })
            .from(fileLibraries).innerJoin(libraries, eq(libraries.id, fileLibraries.libraryId)).where(eq(fileLibraries.fileId, f.id));
        return { libraries: rows };
    });

    app.put<{ Params: { id: string } }>('/api/files/:id/libraries', async (req, reply) => {
        const body = z.object({ libraries: z.array(z.object({ id: z.string(), version: z.number().int().positive() })) }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid' });
        const f = await sourceFile(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found' });
        const ids = body.data.libraries.map(x => x.id);
        const known = ids.length ? await db.select({ id: libraries.id }).from(libraries).where(and(inArray(libraries.id, ids), eq(libraries.workspaceId, req.user!.workspaceId))) : [];
        const ok = new Set(known.map(k => k.id));
        await db.transaction(async tx => {
            await tx.delete(fileLibraries).where(eq(fileLibraries.fileId, f.id));
            const rows = body.data.libraries.filter(x => ok.has(x.id)).map(x => ({ fileId: f.id, libraryId: x.id, seq: x.version }));
            if (rows.length)
                await tx.insert(fileLibraries).values(rows);
        });
        return { ok: true };
    });

    // Pindahkan library dari penyimpanan lama (user_kv / IndexedDB) ke tabel library.
    app.post('/api/libraries/import-legacy', async (req, reply) => {
        const body = z.object({
            snapshots: z.array(snapshotShape.extend({ id: z.string(), name: z.string().default('Library'), version: z.number().int().positive().default(1) }).passthrough()).default([]),
            uses: z.record(z.string(), z.array(z.object({ id: z.string(), version: z.number().int().positive().default(1) }))).default({}),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        // imported = baru dibuat, skipped = sudah ada, missing = file sumber belum ada di server.
        const imported: string[] = [], skipped: string[] = [], missing: string[] = [];
        for (const s of body.data.snapshots) {
            const f = await sourceFile(req, s.id);
            if (!f) {
                missing.push(s.id);
                continue;
            }
            if ((await db.select({ id: libraries.id }).from(libraries).where(eq(libraries.id, s.id)).limit(1)).length) {
                skipped.push(s.id);
                continue;
            }
            const snapshot = { components: s.components, variables: s.variables } as LibrarySnapshot;
            await storeVersion({
                libraryId: s.id, workspaceId: req.user!.workspaceId, userId: req.user!.id, name: s.name || f.name, isNew: true,
                seq: s.version, releaseNotes: 'Migrated from legacy storage', snapshot, components: s.components.length,
            });
            imported.push(s.id);
        }
        for (const [fileId, uses] of Object.entries(body.data.uses)) {
            const f = await sourceFile(req, fileId);
            if (!f)
                continue;
            for (const u of uses)
                if (await libraryOf(req, u.id))
                    await db.insert(fileLibraries).values({ fileId, libraryId: u.id, seq: u.version }).onConflictDoNothing();
        }
        return { imported, skipped, missing };
    });
}
