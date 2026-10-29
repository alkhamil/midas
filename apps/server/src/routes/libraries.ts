import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { designFiles, fileLibraries, libraries, libraryVersions } from '../db/schema.js';
import { canSeeFile, requireUser } from '../lib/auth.js';
import { variablesJson, type LibrarySnapshot } from '../lib/library.js';
import { buildLibraryPackage, GENERATOR_VERSION, PackageBuildError, STEP_LABEL, type PackageEvent, type PackageInfo } from '../lib/package.js';
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
    return f && canSeeFile(req.user!, f) ? f : null;
}

export async function libraryOf(req: FastifyRequest, id: string) {
    const [l] = await db.select().from(libraries)
        .where(and(eq(libraries.id, id), eq(libraries.workspaceId, req.user!.workspaceId))).limit(1);
    return l ?? null;
}

export async function latestVersion(libraryId: string): Promise<VersionRow | null> {
    const [v] = await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, libraryId)).orderBy(desc(libraryVersions.seq)).limit(1);
    return v ?? null;
}

/** A library version: the one asked for with `?seq=`, else the latest. */
async function versionFor(libraryId: string, seq?: string): Promise<VersionRow | null> {
    if (!seq)
        return latestVersion(libraryId);
    const [v] = await db.select().from(libraryVersions).where(and(eq(libraryVersions.libraryId, libraryId), eq(libraryVersions.seq, Number(seq)))).limit(1);
    return v ?? null;
}

/** The React package of a library version: built from the snapshot on the first request, then kept next to it (per generator version). */
export async function packageOf(l: typeof libraries.$inferSelect, v: VersionRow, emit: (e: PackageEvent) => void = () => {}): Promise<{ tgz: Buffer; info: PackageInfo; cached: boolean }> {
    const key = `libraries/${l.id}/${v.seq}.pkg${GENERATOR_VERSION}`;
    emit({ type: 'step', id: 'load', label: STEP_LABEL.load, status: 'running' });
    try {
        const [meta, tgz] = await Promise.all([getObject(`${key}.json`), getObject(`${key}.tgz`)]);
        emit({ type: 'step', id: 'load', label: STEP_LABEL.load, status: 'done', detail: 'already built' });
        return { tgz, info: JSON.parse(meta.toString('utf8')) as PackageInfo, cached: true };
    }
    catch { /* not built yet */ }
    const snapshot = JSON.parse(String(await getObject(v.snapshotKey))) as LibrarySnapshot;
    emit({ type: 'step', id: 'load', label: STEP_LABEL.load, status: 'done', detail: `version ${v.seq} · ${snapshot.components.length} components` });
    const built = await buildLibraryPackage(snapshot, { libraryId: l.id, libraryName: l.name, seq: v.seq, publishedAt: v.publishedAt.getTime() }, emit);
    emit({ type: 'step', id: 'save', label: STEP_LABEL.save, status: 'running' });
    try {
        await Promise.all([putObject(`${key}.tgz`, built.tgz, 'application/gzip'), putObject(`${key}.json`, Buffer.from(JSON.stringify(built.info)), 'application/json')]);
    }
    catch (e) {
        throw new PackageBuildError('save', `The package was built but could not be stored: ${(e as Error).message}`, 'Check that the object storage (S3) is reachable and has free space, then try again.');
    }
    emit({ type: 'step', id: 'save', label: STEP_LABEL.save, status: 'done' });
    return { ...built, cached: false };
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
        if (!l || !(await sourceFile(req, l.id)))
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

    // variables.json of a version (default: latest): colours, radii and spacing by name. `?format=css` gives the `:root { --name: value }` block the live preview injects.
    app.get<{ Params: { id: string }; Querystring: { seq?: string; format?: string } }>('/api/libraries/:id/variables.json', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        if (!l)
            return reply.code(404).send({ error: 'not_found' });
        const v = req.query.seq
            ? (await db.select().from(libraryVersions).where(and(eq(libraryVersions.libraryId, l.id), eq(libraryVersions.seq, Number(req.query.seq)))).limit(1))[0]
            : await latestVersion(l.id);
        if (!v)
            return reply.code(404).send({ error: 'not_found' });
        const vars = variablesJson(JSON.parse(String(await getObject(v.snapshotKey))) as LibrarySnapshot);
        if (req.query.format === 'css')
            return reply.header('content-type', 'text/css').send(`:root { ${Object.entries(vars).map(([k, x]) => `--${k}: ${x};`).join(' ')} }`);
        return vars;
    });

    // The React package of a version (default: latest): what it contains and where to download it. Built on first use.
    app.get<{ Params: { id: string }; Querystring: { seq?: string } }>('/api/libraries/:id/package', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l && await versionFor(l.id, req.query.seq);
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found' });
        try {
            const { info } = await packageOf(l, v);
            return { package: { ...info, downloadUrl: `/api/libraries/${l.id}/package.tgz?seq=${v.seq}` } };
        }
        catch (e) {
            req.log.error(e, 'package build failed');
            return reply.code(500).send({ error: 'package_failed', message: `The package could not be built: ${(e as Error).message}` });
        }
    });

    // The same build, told step by step as it happens (NDJSON: one JSON event per line), for the progress dialog in Studio.
    app.get<{ Params: { id: string }; Querystring: { seq?: string } }>('/api/libraries/:id/package/build', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l && await versionFor(l.id, req.query.seq);
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found' });
        reply.hijack();
        const raw = reply.raw;
        raw.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
        const emit = (e: PackageEvent) => { raw.write(`${JSON.stringify(e)}\n`); };
        try {
            const { info, cached } = await packageOf(l, v, emit);
            if (cached)
                for (const issue of info.issues ?? [])
                    emit({ type: 'issue', issue });
            emit({ type: 'done', package: { ...info, downloadUrl: `/api/libraries/${l.id}/package.tgz?seq=${v.seq}` } });
        }
        catch (e) {
            req.log.error(e, 'package build failed');
            emit(e instanceof PackageBuildError
                ? { type: 'error', step: e.step, message: e.message, fix: e.fix, where: e.where }
                : { type: 'error', step: 'read', message: (e as Error).message, fix: 'Try again. If it keeps failing, report it with the library name and version.' });
        }
        raw.end();
    });

    // The package itself: a tarball `npm install ./file.tgz` accepts.
    app.get<{ Params: { id: string }; Querystring: { seq?: string } }>('/api/libraries/:id/package.tgz', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l && await versionFor(l.id, req.query.seq);
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found' });
        try {
            const { tgz, info } = await packageOf(l, v);
            return reply.header('content-type', 'application/gzip').header('content-disposition', `attachment; filename="${info.fileName}"`).send(tgz);
        }
        catch (e) {
            req.log.error(e, 'package build failed');
            return reply.code(500).send({ error: 'package_failed', message: `The package could not be built: ${(e as Error).message}` });
        }
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
