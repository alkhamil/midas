import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { componentMappings, designFiles, fileLibraries, libraries, libraryVersions } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import {
    breakingChanges, bumpSemver, compareSemver, deriveMappings, isIconComponent, PACKAGE_NAME_RE, packageSlug, SEMVER_RE, validateMappings,
    type ComponentMapping, type LibrarySnapshot,
} from '../lib/library.js';
import { config } from '../config.js';
import { buildKit, buildManifest, kitBreakingChanges, type KitInput } from '../lib/kit.js';
import { buildScaffold } from '../lib/scaffold.js';
import { getObject, putObject } from '../lib/s3.js';
import { zipFiles } from '../lib/zip.js';

type VersionRow = typeof libraryVersions.$inferSelect;

const snapshotKey = (libraryId: string, seq: number) => `libraries/${libraryId}/${seq}.json`;

const snapshotShape = z.object({
    components: z.array(z.object({ id: z.string().min(1), name: z.string(), set: z.boolean().optional(), nodes: z.array(z.object({ id: z.string() }).passthrough()) }).passthrough()),
    variables: z.object({ collections: z.array(z.unknown()).default([]), items: z.array(z.unknown()).default([]) }).passthrough().default({ collections: [], items: [] }),
    assets: z.record(z.string(), z.string()).default({}),
});
const propShape = z.object({
    source: z.enum(['variant', 'text', 'boolean', 'instance', 'slot']),
    key: z.string(),
    label: z.string(),
    name: z.string(),
    type: z.enum(['enum', 'string', 'boolean', 'node']),
    values: z.record(z.string(), z.string()).optional(),
});
const mappingShape = z.object({
    componentKey: z.string().min(1),
    componentName: z.string(),
    exportName: z.string(),
    propsMap: z.object({ props: z.array(propShape) }),
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

async function mappingsOf(versionId: string): Promise<ComponentMapping[]> {
    const rows = await db.select().from(componentMappings).where(eq(componentMappings.libraryVersionId, versionId));
    return rows.map(r => ({ componentKey: r.componentKey, componentName: r.componentName, exportName: r.exportName, propsMap: r.propsMap as ComponentMapping['propsMap'] }));
}

async function packageTaken(name: string, exceptLibraryId?: string) {
    const [row] = await db.select({ id: libraries.id }).from(libraries).where(eq(libraries.packageName, name)).limit(1);
    return !!row && row.id !== exceptLibraryId;
}

async function uniquePackageName(base: string) {
    let name = base, i = 2;
    while (await packageTaken(name))
        name = `${base}-${i++}`;
    return name;
}

/** Ringkasan library untuk daftar di Studio (bentuk sama dengan `LIBS.published` di engine). */
function summary(l: typeof libraries.$inferSelect, v: VersionRow) {
    return {
        id: l.id,
        name: l.name,
        packageName: l.packageName,
        version: v.seq,
        semver: v.version,
        updated: v.publishedAt.getTime(),
        components: v.componentsCount,
        variables: v.variablesCount,
        codeStatus: v.codeStatus,
    };
}

/** Simpan satu versi baru (snapshot ke object storage + baris versi + mapping). */
async function storeVersion(opts: {
    libraryId: string; workspaceId: string; userId: string; name: string; packageName: string; isNew: boolean;
    seq: number; version: string; releaseNotes?: string | null; snapshot: LibrarySnapshot; mappings: ComponentMapping[];
}) {
    const published = Date.now();
    const snap = { id: opts.libraryId, name: opts.name, packageName: opts.packageName, version: opts.seq, semver: opts.version, updated: published, components: opts.snapshot.components, variables: opts.snapshot.variables, assets: opts.snapshot.assets ?? {} };
    const key = snapshotKey(opts.libraryId, opts.seq);
    await putObject(key, Buffer.from(JSON.stringify(snap)), 'application/json');
    await db.transaction(async tx => {
        if (opts.isNew)
            await tx.insert(libraries).values({ id: opts.libraryId, workspaceId: opts.workspaceId, name: opts.name, packageName: opts.packageName, createdBy: opts.userId });
        else
            await tx.update(libraries).set({ name: opts.name }).where(eq(libraries.id, opts.libraryId));
        const [v] = await tx.insert(libraryVersions).values({
            libraryId: opts.libraryId, seq: opts.seq, version: opts.version, releaseNotes: opts.releaseNotes ?? null, snapshotKey: key,
            componentsCount: opts.snapshot.components.filter(c => !isIconComponent(c)).length, variablesCount: opts.snapshot.variables?.items?.length ?? 0,
            manifest: buildManifest({ packageName: opts.packageName, version: opts.version, libraryName: opts.name, publishedAt: new Date(published), snapshot: opts.snapshot, mappings: opts.mappings }),
            publishedBy: opts.userId, publishedAt: new Date(published),
        }).returning({ id: libraryVersions.id });
        if (opts.mappings.length)
            await tx.insert(componentMappings).values(opts.mappings.map(m => ({ libraryVersionId: v.id, ...m })));
    });
    return snap;
}

/** Jumlah ikon & gaya di snapshot, untuk ringkasan di form publish. */
function iconSummary(snapshot: LibrarySnapshot) {
    const sets = snapshot.components.filter(isIconComponent);
    const styles = new Set<string>();
    for (const c of sets)
        for (const n of c.nodes)
            if (n.parentId === c.id && n.component)
                for (const v of Object.values(n.variant ?? {}))
                    styles.add(v);
    return { count: sets.length, styles: [...styles].sort() };
}

/** Versi berdasarkan semver (`version`) atau terbaru bila kosong. */
async function versionOf(libraryId: string, version?: string): Promise<VersionRow | null> {
    if (!version)
        return latestVersion(libraryId);
    const [v] = await db.select().from(libraryVersions).where(and(eq(libraryVersions.libraryId, libraryId), eq(libraryVersions.version, version))).limit(1);
    return v ?? null;
}

async function kitInput(l: typeof libraries.$inferSelect, v: VersionRow): Promise<KitInput> {
    const snap = JSON.parse((await getObject(v.snapshotKey)).toString('utf8')) as LibrarySnapshot & { name?: string };
    return { packageName: l.packageName, version: v.version, libraryName: snap.name ?? l.name, publishedAt: v.publishedAt, snapshot: snap, mappings: await mappingsOf(v.id) };
}

export async function libraryRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    app.get('/api/libraries', async req => {
        const libs = await db.select().from(libraries).where(eq(libraries.workspaceId, req.user!.workspaceId));
        const out = [];
        for (const l of libs) {
            const v = await latestVersion(l.id);
            if (v)
                out.push(summary(l, v));
        }
        return { libraries: out };
    });

    app.get<{ Params: { id: string } }>('/api/libraries/:id', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        if (!l)
            return reply.code(404).send({ error: 'not_found' });
        const versions = await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, l.id)).orderBy(desc(libraryVersions.seq));
        return {
            library: { id: l.id, name: l.name, packageName: l.packageName, createdAt: l.createdAt.getTime() },
            versions: versions.map(v => ({ seq: v.seq, version: v.version, releaseNotes: v.releaseNotes, components: v.componentsCount, variables: v.variablesCount, designStatus: v.designStatus, codeStatus: v.codeStatus, publishedAt: v.publishedAt.getTime() })),
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

    app.get<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/mappings', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        if (!l)
            return reply.code(404).send({ error: 'not_found' });
        const [v] = await db.select().from(libraryVersions).where(and(eq(libraryVersions.libraryId, l.id), eq(libraryVersions.version, req.params.version))).limit(1);
        if (!v)
            return reply.code(404).send({ error: 'not_found' });
        const rows = await db.select().from(componentMappings).where(eq(componentMappings.libraryVersionId, v.id));
        return { mappings: rows };
    });

    // Bahan form Publish Library: data library yang ada, mapping default, saran versi & nama paket.
    app.post<{ Params: { id: string } }>('/api/libraries/:id/draft', async (req, reply) => {
        const body = z.object({ name: z.string().default(''), snapshot: snapshotShape }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const f = await sourceFile(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found', message: 'File sumber tidak ditemukan' });
        const l = await libraryOf(req, f.id);
        const latest = l ? await latestVersion(l.id) : null;
        const previous = latest ? await mappingsOf(latest.id) : [];
        const mappings = deriveMappings(body.data.snapshot as LibrarySnapshot, previous);
        const breaking = [...breakingChanges(previous, mappings), ...(latest ? kitBreakingChanges(latest.manifest, body.data.snapshot as LibrarySnapshot) : [])];
        const name = l?.name ?? (body.data.name || f.name);
        return {
            library: l ? { id: l.id, name: l.name, packageName: l.packageName } : null,
            latest: latest ? { seq: latest.seq, version: latest.version, publishedAt: latest.publishedAt.getTime() } : null,
            packageName: l?.packageName ?? await uniquePackageName(`@midas/ui-${packageSlug(name)}`),
            suggestedVersion: latest ? bumpSemver(latest.version, breaking.length ? 'major' : 'minor') : '1.0.0',
            mappings,
            previousMappings: previous,
            breaking,
            icons: iconSummary(body.data.snapshot as LibrarySnapshot),
        };
    });

    app.get<{ Querystring: { name?: string; library?: string } }>('/api/libraries/package-available', async req => {
        const name = req.query.name ?? '';
        if (!PACKAGE_NAME_RE.test(name))
            return { available: false, reason: 'Format nama paket: @midas/nama-paket (huruf kecil, angka, tanda minus)' };
        return (await packageTaken(name, req.query.library)) ? { available: false, reason: 'Nama paket sudah dipakai library lain' } : { available: true };
    });

    // Publish Library: versi baru dari file design system.
    app.post<{ Params: { id: string } }>('/api/libraries/:id/versions', async (req, reply) => {
        const body = z.object({
            name: z.string().trim().min(1).max(120),
            packageName: z.string().trim(),
            version: z.string().trim(),
            releaseNotes: z.string().max(5000).nullish(),
            snapshot: snapshotShape,
            mappings: z.array(mappingShape),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const b = body.data;
        const f = await sourceFile(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found', message: 'File sumber tidak ditemukan' });
        const l = await libraryOf(req, f.id);
        const errors: string[] = [];
        if (l && b.packageName !== l.packageName)
            errors.push(`Nama paket sudah terkunci sebagai ${l.packageName}`);
        if (!l && !PACKAGE_NAME_RE.test(b.packageName))
            errors.push('Format nama paket: @midas/nama-paket (huruf kecil, angka, tanda minus)');
        if (!l && PACKAGE_NAME_RE.test(b.packageName) && await packageTaken(b.packageName))
            return reply.code(409).send({ error: 'package_taken', message: 'Nama paket sudah dipakai library lain', errors: ['Nama paket sudah dipakai library lain'] });
        if (!SEMVER_RE.test(b.version))
            errors.push('Versi harus berformat semver, mis. 1.2.0');
        const snapshotIds = new Set(b.snapshot.components.map(c => c.id));
        const mappings = b.mappings as ComponentMapping[];
        if (!mappings.length && !(b.snapshot.variables.items?.length) && !b.snapshot.components.some(isIconComponent))
            errors.push('Pilih minimal satu komponen, atau buat Variables / ikon dulu');
        for (const m of mappings)
            if (!snapshotIds.has(m.componentKey))
                errors.push(`Komponen ${m.componentName} tidak ada di snapshot`);
        errors.push(...validateMappings(mappings));
        const latest = l ? await latestVersion(l.id) : null;
        const previous = latest ? await mappingsOf(latest.id) : [];
        const breaking = [...breakingChanges(previous, mappings), ...(latest ? kitBreakingChanges(latest.manifest, b.snapshot as LibrarySnapshot) : [])];
        if (latest && SEMVER_RE.test(b.version)) {
            if (compareSemver(b.version, latest.version) <= 0)
                errors.push(`Versi harus lebih besar dari versi terakhir (${latest.version})`);
            else if (breaking.length && compareSemver(b.version, bumpSemver(latest.version, 'major')) < 0)
                errors.push(`Ada breaking change, versi minimal ${bumpSemver(latest.version, 'major')}`);
        }
        if (errors.length)
            return reply.code(400).send({ error: 'invalid', message: errors[0], errors, breaking });
        // Komponen yang dipilih (punya mapping) dan semua ikon masuk snapshot, beserta aset yang dipakainya.
        const chosen = new Set(mappings.map(m => m.componentKey));
        const components = b.snapshot.components.filter(c => chosen.has(c.id) || isIconComponent(c));
        const used = new Set(components.flatMap(c => c.nodes).flatMap(n => {
            const x = n as { assetId?: string; fills?: { type?: string; image?: string }[] };
            return [x.assetId, ...(Array.isArray(x.fills) ? x.fills.filter(f => f?.type === 'image').map(f => f.image) : [])].filter((v): v is string => !!v);
        }));
        const assets = Object.fromEntries(Object.entries(b.snapshot.assets).filter(([id]) => used.has(id)));
        const snapshot = { components, variables: b.snapshot.variables, assets } as LibrarySnapshot;
        const snap = await storeVersion({
            libraryId: f.id, workspaceId: req.user!.workspaceId, userId: req.user!.id, name: b.name, packageName: l?.packageName ?? b.packageName,
            isNew: !l, seq: (latest?.seq ?? 0) + 1, version: b.version, releaseNotes: b.releaseNotes, snapshot, mappings,
        });
        return { library: { id: f.id, name: b.name, packageName: snap.packageName, version: snap.version, semver: snap.semver, updated: snap.updated, components: snapshot.components.filter(c => !isIconComponent(c)).length, icons: snapshot.components.filter(isIconComponent).length, variables: snapshot.variables?.items?.length ?? 0, codeStatus: 'pending' }, breaking };
    });

    // Cari library dari nama paket (dipakai `midas sync` / `midas init`).
    app.get<{ Querystring: { package?: string } }>('/api/libraries/resolve', async (req, reply) => {
        const [l] = await db.select().from(libraries)
            .where(and(eq(libraries.packageName, req.query.package ?? ''), eq(libraries.workspaceId, req.user!.workspaceId))).limit(1);
        if (!l)
            return reply.code(404).send({ error: 'not_found', message: `Library ${req.query.package} tidak ditemukan di workspace ini` });
        const v = await latestVersion(l.id);
        return { id: l.id, name: l.name, packageName: l.packageName, latest: v?.version ?? null };
    });

    // Library Kit satu versi (spec §3.3) — file untuk `src/generated/`.
    app.get<{ Params: { id: string }; Querystring: { version?: string } }>('/api/libraries/:id/kit', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.query.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: req.query.version ? `Versi ${req.query.version} tidak ditemukan` : 'Library tidak ditemukan' });
        return { libraryId: l.id, package: l.packageName, version: v.version, files: buildKit(await kitInput(l, v)) };
    });

    // Kerangka repo paket (spec §3.4) + Library Kit. `?format=zip` untuk unduhan dari Studio.
    app.get<{ Params: { id: string }; Querystring: { version?: string; format?: string } }>('/api/libraries/:id/scaffold', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.query.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: 'Library tidak ditemukan' });
        const files = buildScaffold({ ...(await kitInput(l, v)), libraryId: l.id, serverUrl: config.publicUrl, registryUrl: config.registryUrl });
        if (req.query.format !== 'zip')
            return { libraryId: l.id, package: l.packageName, version: v.version, files };
        const dir = l.packageName.split('/')[1];
        return reply.header('content-type', 'application/zip')
            .header('content-disposition', `attachment; filename="${dir}-${v.version}.zip"`)
            .send(zipFiles(files, dir));
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
                libraryId: s.id, workspaceId: req.user!.workspaceId, userId: req.user!.id, name: s.name || f.name,
                packageName: await uniquePackageName(`@midas/ui-${packageSlug(s.name || f.name)}`), isNew: true,
                seq: s.version, version: '1.0.0', releaseNotes: 'Dipindahkan dari penyimpanan lama', snapshot, mappings: deriveMappings(snapshot),
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
