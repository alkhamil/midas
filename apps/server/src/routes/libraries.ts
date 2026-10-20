import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { componentMappings, designFiles, fileLibraries, libraries, libraryVersions } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import {
    breakingChanges, bumpSemver, compareSemver, deriveMappings, iconKeysOf, PACKAGE_NAME_RE, packageSlug, SEMVER_RE, validateMappings,
    type ComponentMapping, type LibrarySnapshot,
} from '../lib/library.js';
import { config } from '../config.js';
import { buildKit, buildManifest, kitBreakingChanges, tokenBreakingChanges, type KitInput } from '../lib/kit.js';
import { buildLibraryPackage } from '../lib/library-builder.js';
import { buildScaffold } from '../lib/scaffold.js';
import { deletePrefix, getObject, putObject } from '../lib/s3.js';
import { zipFiles } from '../lib/zip.js';

type VersionRow = typeof libraryVersions.$inferSelect;

const snapshotKey = (libraryId: string, seq: number) => `libraries/${libraryId}/${seq}.json`;
const bundleKey = (libraryId: string, version: string, file: string) => `libraries/${libraryId}/bundles/${version}/${file}`;
const packageKey = (libraryId: string, version: string) => `libraries/${libraryId}/packages/${version}/package.tgz`;

const snapshotShape = z.object({
    components: z.array(z.object({ id: z.string().min(1), name: z.string(), set: z.boolean().optional(), nodes: z.array(z.object({ id: z.string() }).passthrough()) }).passthrough()),
    variables: z.object({ collections: z.array(z.unknown()).default([]), items: z.array(z.unknown()).default([]) }).passthrough().default({ collections: [], items: [] }),
    assets: z.record(z.string(), z.string()).default({}),
    icons: z.array(z.object({
        componentKey: z.string().min(1),
        name: z.string().min(1),
        category: z.string().default('general'),
        styles: z.record(z.string(), z.string()),
    })).optional(),
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
    const snap = { id: opts.libraryId, name: opts.name, packageName: opts.packageName, version: opts.seq, semver: opts.version, updated: published, components: opts.snapshot.components, variables: opts.snapshot.variables, assets: opts.snapshot.assets ?? {}, icons: opts.snapshot.icons ?? [] };
    const key = snapshotKey(opts.libraryId, opts.seq);
    await putObject(key, Buffer.from(JSON.stringify(snap)), 'application/json');
    await db.transaction(async tx => {
        if (opts.isNew)
            await tx.insert(libraries).values({ id: opts.libraryId, workspaceId: opts.workspaceId, name: opts.name, packageName: opts.packageName, createdBy: opts.userId });
        else
            await tx.update(libraries).set({ name: opts.name }).where(eq(libraries.id, opts.libraryId));
        const [v] = await tx.insert(libraryVersions).values({
            libraryId: opts.libraryId, seq: opts.seq, version: opts.version, releaseNotes: opts.releaseNotes ?? null, snapshotKey: key,
            componentsCount: opts.mappings.length, variablesCount: opts.snapshot.variables?.items?.length ?? 0,
            manifest: buildManifest({ packageName: opts.packageName, version: opts.version, libraryName: opts.name, publishedAt: new Date(published), snapshot: opts.snapshot, mappings: opts.mappings }),
            publishedBy: opts.userId, publishedAt: new Date(published),
        }).returning({ id: libraryVersions.id });
        if (opts.mappings.length)
            await tx.insert(componentMappings).values(opts.mappings.map(m => ({ libraryVersionId: v.id, ...m })));
    });
    return snap;
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

type CodeReport = { exportName: string; status: 'ready' | 'not_implemented' | 'mismatch'; detail?: string }[];

/** Store the code status of one version: per component, and `ready` / `partial` for the version. */
async function applyCodeReport(v: VersionRow, components: CodeReport, bundleUrl?: string) {
    const reported = new Map(components.map(c => [c.exportName, c]));
    const mappings = await db.select().from(componentMappings).where(eq(componentMappings.libraryVersionId, v.id));
    // Komponen di desain yang tidak ada di laporan dianggap belum diimplementasikan.
    const statuses = mappings.map(m => reported.get(m.exportName) ?? { exportName: m.exportName, status: 'not_implemented' as const, detail: 'not in the report' });
    const codeStatus = !statuses.length || statuses.every(c => c.status === 'ready') ? 'ready' : 'partial';
    await db.transaction(async tx => {
        for (const m of mappings) {
            const r = statuses.find(c => c.exportName === m.exportName)!;
            await tx.update(componentMappings).set({ codeStatus: r.status, codeDetail: r.detail ?? null })
                .where(and(eq(componentMappings.libraryVersionId, v.id), eq(componentMappings.componentKey, m.componentKey)));
        }
        await tx.update(libraryVersions).set({ codeStatus, codeReportedAt: new Date(), ...(bundleUrl ? { bundleUrl } : {}) })
            .where(eq(libraryVersions.id, v.id));
    });
    const count = (st: string) => statuses.filter(c => c.status === st).length;
    return { codeStatus, ready: count('ready'), notImplemented: count('not_implemented'), mismatch: count('mismatch') };
}

/** Store the Studio preview bundle (JS + CSS) of one version and point the version at it. */
async function storeBundle(l: typeof libraries.$inferSelect, v: VersionRow, js: string, css: string) {
    await putObject(bundleKey(l.id, v.version, 'index.js'), Buffer.from(js), 'text/javascript');
    await putObject(bundleKey(l.id, v.version, 'style.css'), Buffer.from(css), 'text/css');
    // Hash isi di URL: unggah ulang versi yang sama (mis. perbaikan bundle) tidak terhalang cache immutable browser.
    const hash = createHash('sha1').update(js).update(css).digest('hex').slice(0, 12);
    const base = `/api/libraries/${encodeURIComponent(l.id)}/versions/${encodeURIComponent(v.version)}/bundle`;
    const bundleUrl = `${base}/index.js?h=${hash}`;
    await db.update(libraryVersions).set({ bundleUrl }).where(eq(libraryVersions.id, v.id));
    return { bundleUrl, cssUrl: `${base}/style.css?h=${hash}`, size: js.length + css.length };
}

/**
 * Build the code package of a version from Midas' standard component kit and the library's own generated layer: preview bundle,
 * npm tarball and per-component code status. Runs on publish; the code status is `ready` as soon as it finishes.
 */
export async function buildCodePackage(l: typeof libraries.$inferSelect, v: VersionRow) {
    const input = await kitInput(l, v);
    const kit = buildKit(input);
    const manifest = JSON.parse(kit['src/generated/manifest.json']) as { components: { exportName: string; props: { name: string }[] }[] };
    const built = await buildLibraryPackage({
        packageName: l.packageName, version: v.version, libraryName: input.libraryName, kit,
        components: manifest.components.map(c => ({ exportName: c.exportName, props: c.props.map(p => p.name) })),
    });
    await storeBundle(l, v, built.bundleJs, built.bundleCss);
    await putObject(packageKey(l.id, v.version), built.tarball, 'application/gzip');
    const fresh = await versionOf(l.id, v.version);
    const report = await applyCodeReport(fresh ?? v, built.statuses);
    return { ...report, warnings: built.warnings, size: built.tarball.length };
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

    // Unpublish: the library (all versions, mappings, snapshots) is removed; the design file stays as an ordinary file.
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
        // iconKeys = komponen yang ditebak Studio sebagai ikon (page "Icons" / nama "Icon/…").
        const body = z.object({ name: z.string().default(''), snapshot: snapshotShape, iconKeys: z.array(z.string()).default([]) }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const f = await sourceFile(req, req.params.id);
        if (!f)
            return reply.code(404).send({ error: 'not_found', message: 'Source file not found' });
        const l = await libraryOf(req, f.id);
        const latest = l ? await latestVersion(l.id) : null;
        const previous = latest ? await mappingsOf(latest.id) : [];
        const snapshot = body.data.snapshot as LibrarySnapshot, iconKeys = new Set(body.data.iconKeys);
        // Mapping untuk semua komponen (termasuk tebakan ikon) supaya desainer bisa memindahkan komponen ↔ ikon di form.
        const mappings = deriveMappings(snapshot, previous, new Set());
        // Ikon dicek saat publish (SVG baru diekspor di sana); token bisa dicek sekarang.
        const breaking = [...breakingChanges(previous, mappings.filter(m => !iconKeys.has(m.componentKey))), ...(latest ? tokenBreakingChanges(latest.manifest, snapshot) : [])];
        const name = l?.name ?? (body.data.name || f.name);
        return {
            library: l ? { id: l.id, name: l.name, packageName: l.packageName } : null,
            latest: latest ? { seq: latest.seq, version: latest.version, publishedAt: latest.publishedAt.getTime() } : null,
            packageName: l?.packageName ?? await uniquePackageName(`@midas/ui-${packageSlug(name)}`),
            suggestedVersion: latest ? bumpSemver(latest.version, breaking.length ? 'major' : 'minor') : '1.0.0',
            mappings,
            previousMappings: previous,
            breaking,
            iconKeys: [...iconKeys],
        };
    });

    app.get<{ Querystring: { name?: string; library?: string } }>('/api/libraries/package-available', async req => {
        const name = req.query.name ?? '';
        if (!PACKAGE_NAME_RE.test(name))
            return { available: false, reason: 'Package name format: @midas/package-name (lowercase letters, digits, hyphens)' };
        return (await packageTaken(name, req.query.library)) ? { available: false, reason: 'Package name is already used by another library' } : { available: true };
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
            return reply.code(404).send({ error: 'not_found', message: 'Source file not found' });
        const l = await libraryOf(req, f.id);
        const errors: string[] = [];
        if (l && b.packageName !== l.packageName)
            errors.push(`Package name is locked to ${l.packageName}`);
        if (!l && !PACKAGE_NAME_RE.test(b.packageName))
            errors.push('Package name format: @midas/package-name (lowercase letters, digits, hyphens)');
        if (!l && PACKAGE_NAME_RE.test(b.packageName) && await packageTaken(b.packageName))
            return reply.code(409).send({ error: 'package_taken', message: 'Package name is already used by another library', errors: ['Package name is already used by another library'] });
        if (!SEMVER_RE.test(b.version))
            errors.push('Version must be semver, e.g. 1.2.0');
        const snapshotIds = new Set(b.snapshot.components.map(c => c.id));
        const mappings = b.mappings as ComponentMapping[];
        const iconKeys = iconKeysOf(b.snapshot as LibrarySnapshot);
        if (!mappings.length && !(b.snapshot.variables.items?.length) && !iconKeys.size)
            errors.push('Select at least one component, or create Variables / icons first');
        for (const m of mappings) {
            if (!snapshotIds.has(m.componentKey))
                errors.push(`Component ${m.componentName} is not in the snapshot`);
            if (iconKeys.has(m.componentKey))
                errors.push(`${m.componentName} cannot be both an icon and a component`);
        }
        for (const i of b.snapshot.icons ?? [])
            if (!snapshotIds.has(i.componentKey))
                errors.push(`Icon ${i.name} is not in the snapshot`);
        errors.push(...validateMappings(mappings));
        const latest = l ? await latestVersion(l.id) : null;
        const previous = latest ? await mappingsOf(latest.id) : [];
        const breaking = [...breakingChanges(previous, mappings), ...(latest ? kitBreakingChanges(latest.manifest, b.snapshot as LibrarySnapshot) : [])];
        if (latest && SEMVER_RE.test(b.version)) {
            if (compareSemver(b.version, latest.version) <= 0)
                errors.push(`Version must be greater than the latest version (${latest.version})`);
            else if (breaking.length && compareSemver(b.version, bumpSemver(latest.version, 'major')) < 0)
                errors.push(`There are breaking changes; the minimum version is ${bumpSemver(latest.version, 'major')}`);
        }
        if (errors.length)
            return reply.code(400).send({ error: 'invalid', message: errors[0], errors, breaking });
        // Komponen yang dipilih (punya mapping) dan semua ikon masuk snapshot, beserta aset yang dipakainya.
        const chosen = new Set(mappings.map(m => m.componentKey));
        // The chosen components and icons, plus the components they are built from (nested instances, swap defaults), so copies keep those parts.
        const keep = new Set([...chosen, ...iconKeys]), owner = new Map<string, string>(), byId = new Map(b.snapshot.components.map(c => [c.id, c]));
        for (const c of b.snapshot.components)
            for (const n of c.nodes)
                owner.set(n.id, c.id);
        for (const queue = [...keep]; queue.length;)
            for (const n of byId.get(queue.pop()!)?.nodes ?? [])
                for (const k of ['sourceId', 'swapOf'] as const) {
                    const o = (n as Record<string, unknown>)[k];
                    const dep = typeof o === 'string' ? owner.get(o) : undefined;
                    if (dep && !keep.has(dep)) {
                        keep.add(dep);
                        queue.push(dep);
                    }
                }
        const components = b.snapshot.components.filter(c => keep.has(c.id));
        const used = new Set(components.flatMap(c => c.nodes).flatMap(n => {
            const x = n as { assetId?: string; fills?: { type?: string; image?: string }[] };
            return [x.assetId, ...(Array.isArray(x.fills) ? x.fills.filter(f => f?.type === 'image').map(f => f.image) : [])].filter((v): v is string => !!v);
        }));
        const assets = Object.fromEntries(Object.entries(b.snapshot.assets).filter(([id]) => used.has(id)));
        const snapshot = { components, variables: b.snapshot.variables, assets, icons: b.snapshot.icons } as LibrarySnapshot;
        const snap = await storeVersion({
            libraryId: f.id, workspaceId: req.user!.workspaceId, userId: req.user!.id, name: b.name, packageName: l?.packageName ?? b.packageName,
            isNew: !l, seq: (latest?.seq ?? 0) + 1, version: b.version, releaseNotes: b.releaseNotes, snapshot, mappings,
        });
        // The code package is built right away from the standard component kit: the library is usable as soon as it is published.
        let code: Awaited<ReturnType<typeof buildCodePackage>> | null = null, codeError: string | null = null;
        const lib = await libraryOf(req, f.id), ver = await versionOf(f.id, b.version);
        if (lib && ver) {
            try {
                code = await buildCodePackage(lib, ver);
            }
            catch (e) {
                req.log.error(e);
                codeError = (e as Error).message;
            }
        }
        return { library: { id: f.id, name: b.name, packageName: snap.packageName, version: snap.version, semver: snap.semver, updated: snap.updated, components: mappings.length, icons: iconKeys.size, variables: snapshot.variables?.items?.length ?? 0, codeStatus: code?.codeStatus ?? 'pending' }, breaking, code, codeError };
    });

    // Laporan status kode dari repo paket (`midas report`, biasanya di CI setelah build/publish).
    app.post<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/code', async (req, reply) => {
        const body = z.object({
            components: z.array(z.object({
                exportName: z.string().min(1),
                status: z.enum(['ready', 'not_implemented', 'mismatch']),
                detail: z.string().max(2000).optional(),
            })),
            bundleUrl: z.string().url().optional(),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: `Version ${req.params.version} has not been published in Midas` });
        return applyCodeReport(v, body.data.components, body.data.bundleUrl);
    });

    // Bundle ESM + CSS satu versi untuk Live DOM Renderer Studio (spec §7.5), diunggah oleh `midas bundle`.
    // React tidak ikut dibundel: Studio menyuplai React miliknya saat memuat bundle.
    app.put<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/bundle', async (req, reply) => {
        const body = z.object({ js: z.string().min(1), css: z.string().default(''), preview: z.array(z.string()).optional() }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: `Version ${req.params.version} has not been published in Midas` });
        return storeBundle(l, v, body.data.js, body.data.css);
    });

    app.get<{ Params: { id: string; version: string; file: string } }>('/api/libraries/:id/versions/:version/bundle/:file', async (req, reply) => {
        const type = { 'index.js': 'text/javascript; charset=utf-8', 'style.css': 'text/css; charset=utf-8' }[req.params.file];
        const l = type ? await libraryOf(req, req.params.id) : null;
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v?.bundleUrl)
            return reply.code(404).send({ error: 'not_found', message: 'Bundle not uploaded yet (run `midas bundle` in the package repo)' });
        try {
            const data = await getObject(bundleKey(l.id, v.version, req.params.file));
            // Versi library immutable → bundle boleh di-cache selamanya oleh browser.
            return reply.header('content-type', type).header('cache-control', 'private, max-age=31536000, immutable').send(data);
        }
        catch {
            return reply.code(404).send({ error: 'not_found' });
        }
    });

    // The built npm package (`npm pack` tarball) of one version, uploaded by `midas bundle`. "Download project" in Studio embeds it
    // as a local `file:` dependency, so a downloaded app installs with plain `npm install` (no registry login).
    app.addContentTypeParser('application/gzip', { parseAs: 'buffer', bodyLimit: 64 * 1024 * 1024 }, (_req, body, done) => done(null, body));
    app.put<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/package', { bodyLimit: 64 * 1024 * 1024 }, async (req, reply) => {
        if (!Buffer.isBuffer(req.body) || req.body.length < 100)
            return reply.code(400).send({ error: 'invalid', message: 'Package tarball is empty' });
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: `Version ${req.params.version} has not been published in Midas` });
        await putObject(packageKey(l.id, v.version), req.body, 'application/gzip');
        return { size: req.body.length };
    });

    app.get<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/package', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: 'Library version not found' });
        try {
            const data = await getObject(packageKey(l.id, v.version));
            const file = `${(l.packageName ?? l.id).replace(/^@/, '').replace('/', '-')}-${v.version}.tgz`;
            return reply.header('content-type', 'application/gzip').header('content-disposition', `attachment; filename="${file}"`).header('x-package-file', file).send(data);
        }
        catch {
            return reply.code(404).send({ error: 'not_found', message: 'Package not uploaded yet (run `midas bundle` in the package repo)' });
        }
    });

    // Build (or rebuild) the code package of a version, e.g. one published before code was built automatically.
    app.post<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/build', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: `Version ${req.params.version} has not been published in Midas` });
        try {
            return await buildCodePackage(l, v);
        }
        catch (e) {
            req.log.error(e);
            return reply.code(500).send({ error: 'build_failed', message: (e as Error).message });
        }
    });

    // Status kode per komponen untuk satu versi (panel Library / Developer kit di Studio).
    app.get<{ Params: { id: string; version: string } }>('/api/libraries/:id/versions/:version/code', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.params.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found' });
        const rows = await db.select().from(componentMappings).where(eq(componentMappings.libraryVersionId, v.id));
        return {
            version: v.version,
            codeStatus: v.codeStatus,
            reportedAt: v.codeReportedAt?.getTime() ?? null,
            components: rows.map(r => ({ exportName: r.exportName, componentName: r.componentName, status: v.codeReportedAt ? r.codeStatus : 'pending', detail: r.codeDetail })),
        };
    });

    // Cari library dari nama paket (dipakai `midas sync` / `midas init`).
    app.get<{ Querystring: { package?: string } }>('/api/libraries/resolve', async (req, reply) => {
        const [l] = await db.select().from(libraries)
            .where(and(eq(libraries.packageName, req.query.package ?? ''), eq(libraries.workspaceId, req.user!.workspaceId))).limit(1);
        if (!l)
            return reply.code(404).send({ error: 'not_found', message: `Library ${req.query.package} not found in this workspace` });
        const v = await latestVersion(l.id);
        return { id: l.id, name: l.name, packageName: l.packageName, latest: v?.version ?? null };
    });

    // Library Kit satu versi (spec §3.3) — file untuk `src/generated/`.
    // `?format=zip`: the same files as a download, for developers who do not want the CLI (replace src/generated with them).
    app.get<{ Params: { id: string }; Querystring: { version?: string; format?: string } }>('/api/libraries/:id/kit', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.query.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: req.query.version ? `Version ${req.query.version} not found` : 'Library not found' });
        const files = buildKit(await kitInput(l, v));
        if (req.query.format !== 'zip')
            return { libraryId: l.id, package: l.packageName, version: v.version, files };
        const dir = l.packageName.split('/')[1];
        const readme = `Library Kit ${l.packageName}@${v.version}\n\n1. Replace the src/generated folder of the package repository with the one in this zip.\n2. Set "version" in package.json to ${v.version}.\n3. npm run build (it also reports the code status to Midas when you are signed in).\n`;
        return reply.header('content-type', 'application/zip')
            .header('content-disposition', `attachment; filename="${dir}-kit-${v.version}.zip"`)
            .send(zipFiles({ ...files, 'KIT-README.txt': readme }));
    });

    // Kerangka repo paket (spec §3.4) + Library Kit. `?format=zip` untuk unduhan dari Studio.
    app.get<{ Params: { id: string }; Querystring: { version?: string; format?: string } }>('/api/libraries/:id/scaffold', async (req, reply) => {
        const l = await libraryOf(req, req.params.id);
        const v = l ? await versionOf(l.id, req.query.version) : null;
        if (!l || !v)
            return reply.code(404).send({ error: 'not_found', message: 'Library not found' });
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
                seq: s.version, version: '1.0.0', releaseNotes: 'Migrated from legacy storage', snapshot, mappings: deriveMappings(snapshot),
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
