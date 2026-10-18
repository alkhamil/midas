import { and, desc, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { builderProjects, designFiles, libraries, libraryVersions } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import { configShape, configSummary, emptyConfig, validateConfig, type BuilderConfig } from '../lib/builder.js';

type ProjectRow = typeof builderProjects.$inferSelect;

const createBody = z.object({
    name: z.string().trim().min(1).max(120),
    fileId: z.string().min(1),
    libraryId: z.string().min(1).nullable().optional(),
    libraryVersion: z.string().min(1).nullable().optional(),
});
const updateBody = z.object({
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(120).optional(),
    libraryId: z.string().min(1).nullable().optional(),
    libraryVersion: z.string().min(1).nullable().optional(),
    config: configShape.optional(),
});

async function fileInWorkspace(req: FastifyRequest, id: string) {
    const [f] = await db.select({ id: designFiles.id, name: designFiles.name }).from(designFiles)
        .where(and(eq(designFiles.id, id), eq(designFiles.workspaceId, req.user!.workspaceId), isNull(designFiles.deletedAt))).limit(1);
    return f ?? null;
}

async function projectOf(req: FastifyRequest, id: string) {
    if (!z.uuid().safeParse(id).success) return null;
    const [p] = await db.select().from(builderProjects)
        .where(and(eq(builderProjects.id, id), eq(builderProjects.workspaceId, req.user!.workspaceId))).limit(1);
    return p ?? null;
}

/** Library + versi yang dipakai project: info yang dibutuhkan Studio (paket, status kode, bundle). */
async function libraryInfo(req: FastifyRequest, libraryId: string | null, version: string | null) {
    if (!libraryId) return null;
    const [l] = await db.select().from(libraries).where(and(eq(libraries.id, libraryId), eq(libraries.workspaceId, req.user!.workspaceId))).limit(1);
    if (!l) return null;
    const [v] = version
        ? await db.select().from(libraryVersions).where(and(eq(libraryVersions.libraryId, l.id), eq(libraryVersions.version, version))).limit(1)
        : await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, l.id)).orderBy(desc(libraryVersions.seq)).limit(1);
    return {
        id: l.id, name: l.name, packageName: l.packageName,
        version: v?.version ?? version, seq: v?.seq ?? null, missing: !v,
        codeStatus: v?.codeStatus ?? null, bundleUrl: v?.bundleUrl ?? null,
    };
}

/** Pastikan library milik workspace dan versinya sudah dipublish. */
async function checkLibrary(req: FastifyRequest, libraryId?: string | null, version?: string | null): Promise<string | null> {
    if (!libraryId) return version ? 'Choose a library before choosing a version' : null;
    const info = await libraryInfo(req, libraryId, version ?? null);
    if (!info) return 'Library not found in this workspace';
    if (info.missing) return version ? `Version ${version} has not been published` : 'The library has no versions yet';
    return null;
}

async function present(req: FastifyRequest, p: ProjectRow, file?: { name: string } | null) {
    const f = file ?? await fileInWorkspace(req, p.fileId);
    return {
        id: p.id, name: p.name, fileId: p.fileId, fileName: f?.name ?? null,
        library: await libraryInfo(req, p.libraryId, p.libraryVersion),
        config: p.config as BuilderConfig, version: p.version,
        createdAt: p.createdAt.getTime(), updatedAt: p.updatedAt.getTime(),
    };
}

export async function builderRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    // Daftar project di workspace (opsional per file desain).
    app.get<{ Querystring: { fileId?: string } }>('/api/builder-projects', async req => {
        const where = req.query.fileId
            ? and(eq(builderProjects.workspaceId, req.user!.workspaceId), eq(builderProjects.fileId, req.query.fileId))
            : eq(builderProjects.workspaceId, req.user!.workspaceId);
        const rows = await db.select({ p: builderProjects, fileName: designFiles.name }).from(builderProjects)
            .innerJoin(designFiles, eq(designFiles.id, builderProjects.fileId)).where(where).orderBy(desc(builderProjects.updatedAt));
        return {
            projects: await Promise.all(rows.map(async ({ p, fileName }) => ({
                id: p.id, name: p.name, fileId: p.fileId, fileName,
                library: await libraryInfo(req, p.libraryId, p.libraryVersion),
                ...configSummary(p.config as BuilderConfig), version: p.version, updatedAt: p.updatedAt.getTime(),
            }))),
        };
    });

    app.post('/api/builder-projects', async (req, reply) => {
        const body = createBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const f = await fileInWorkspace(req, body.data.fileId);
        if (!f) return reply.code(404).send({ error: 'not_found', message: 'Design file not found' });
        const libError = await checkLibrary(req, body.data.libraryId, body.data.libraryVersion);
        if (libError) return reply.code(400).send({ error: 'invalid', message: libError });
        const [p] = await db.insert(builderProjects).values({
            workspaceId: req.user!.workspaceId, name: body.data.name, fileId: f.id,
            libraryId: body.data.libraryId ?? null, libraryVersion: body.data.libraryVersion ?? null,
            config: emptyConfig(), createdBy: req.user!.id,
        }).returning();
        return reply.code(201).send({ project: await present(req, p, f) });
    });

    app.get<{ Params: { id: string } }>('/api/builder-projects/:id', async (req, reply) => {
        const p = await projectOf(req, req.params.id);
        if (!p) return reply.code(404).send({ error: 'not_found' });
        return { project: await present(req, p) };
    });

    // Simpan project. `version` wajib = versi yang terakhir dibaca; bila server lebih baru → 409.
    app.put<{ Params: { id: string } }>('/api/builder-projects/:id', async (req, reply) => {
        const body = updateBody.safeParse(req.body);
        if (!body.success) return reply.code(400).send({ error: 'invalid', message: `${body.error.issues[0].path.join('.')}: ${body.error.issues[0].message}`.replace(/^: /, '') });
        const p = await projectOf(req, req.params.id);
        if (!p) return reply.code(404).send({ error: 'not_found' });
        if (body.data.version !== p.version)
            return reply.code(409).send({ error: 'conflict', message: 'Project changed elsewhere', project: await present(req, p) });
        const errors = body.data.config ? validateConfig(body.data.config) : [];
        const libraryId = body.data.libraryId !== undefined ? body.data.libraryId : p.libraryId;
        const libraryVersion = body.data.libraryVersion !== undefined ? body.data.libraryVersion : p.libraryVersion;
        if (body.data.libraryId !== undefined || body.data.libraryVersion !== undefined) {
            const libError = await checkLibrary(req, libraryId, libraryVersion);
            if (libError) errors.push(libError);
        }
        if (errors.length) return reply.code(400).send({ error: 'invalid', message: errors[0], errors });
        const [next] = await db.update(builderProjects).set({
            name: body.data.name ?? p.name, libraryId, libraryVersion,
            config: body.data.config ?? p.config, version: p.version + 1, updatedAt: new Date(),
        }).where(and(eq(builderProjects.id, p.id), eq(builderProjects.version, p.version))).returning();
        if (!next) return reply.code(409).send({ error: 'conflict', message: 'Project changed elsewhere' });
        return { project: await present(req, next) };
    });

    app.delete<{ Params: { id: string } }>('/api/builder-projects/:id', async (req, reply) => {
        const p = await projectOf(req, req.params.id);
        if (!p) return reply.code(404).send({ error: 'not_found' });
        await db.delete(builderProjects).where(eq(builderProjects.id, p.id));
        return { ok: true };
    });
}
