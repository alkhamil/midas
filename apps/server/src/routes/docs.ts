import { desc, eq } from 'drizzle-orm';
import { build, type Plugin } from 'esbuild';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { libraries, libraryVersions } from '../db/schema.js';
import { userFromToken } from '../lib/auth.js';
import { componentPage, homePage, iconsPage, notFoundPage, versionsPage, type DocsContext } from '../lib/docs-site.js';
import { GENERATOR_VERSION, packageNameOf, untarFile } from '../lib/package.js';
import { getObject, putObject } from '../lib/s3.js';
import { packageOf } from './libraries.js';

/**
 * The documentation site of a published library: /docs/<name>. Members of the workspace can always open it; anyone with the link can
 * when the library's documentation is made public (the switch in the package dialog). The packages stay behind an API token either way.
 */
export async function docsRoutes(app: FastifyInstance) {
    const origin = (req: FastifyRequest) => `${req.protocol}://${req.host}`;
    const slugOf = (name: string) => packageNameOf(name).slice('@midas/'.length);
    const html = (reply: FastifyReply, code: number, body: string) => reply.code(code).header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-cache').send(body);

    /** The library of a slug the caller may read, with the version asked for. Null after the reply was sent. */
    async function open(req: FastifyRequest<{ Params: { slug: string }; Querystring: { v?: string } }>, reply: FastifyReply) {
        const user = req.user ?? await userFromToken(req.headers.authorization);
        const all = (await db.select().from(libraries)).filter(l => slugOf(l.name) === req.params.slug);
        const mine = user ? all.find(l => l.workspaceId === user.workspaceId) : undefined;
        const l = mine ?? all.find(x => x.docsPublic);
        if (!l) {
            await html(reply, all.length ? 401 : 404, notFoundPage(all.length ? 'This documentation is private. Sign in to Midas with an account of the workspace to read it.' : 'There is no published library with this name.'));
            return null;
        }
        const versions = await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, l.id)).orderBy(desc(libraryVersions.seq));
        const v = (req.query.v ? versions.find(x => x.seq === Number(req.query.v)) : undefined) ?? versions[0];
        if (!v) {
            await html(reply, 404, notFoundPage('This library has no published version yet.'));
            return null;
        }
        try {
            const { info, tgz } = await packageOf(l, v);
            const ctx: DocsContext = {
                slug: req.params.slug, libraryName: l.name, origin: origin(req), info, seq: v.seq, latest: v.seq === versions[0].seq, docsPublic: l.docsPublic,
                versions: versions.map(x => ({ seq: x.seq, releaseNotes: x.releaseNotes, publishedAt: x.publishedAt.getTime() })),
            };
            return { ctx, tgz, l, v };
        }
        catch (e) {
            req.log.error(e, 'docs: package build failed');
            await html(reply, 500, notFoundPage(`The package of this version could not be built: ${(e as Error).message}`));
            return null;
        }
    }

    type Req = FastifyRequest<{ Params: { slug: string }; Querystring: { v?: string } }>;

    app.get('/docs/:slug', async (req: Req, reply) => {
        const r = await open(req, reply);
        if (r) return html(reply, 200, homePage(r.ctx));
    });
    app.get('/docs/:slug/versions', async (req: Req, reply) => {
        const r = await open(req, reply);
        if (r) return html(reply, 200, versionsPage(r.ctx));
    });
    app.get('/docs/:slug/icons', async (req: Req, reply) => {
        const r = await open(req, reply);
        if (r) return html(reply, 200, iconsPage(r.ctx));
    });
    app.get<{ Params: { slug: string; name: string }; Querystring: { v?: string } }>('/docs/:slug/components/:name', async (req, reply) => {
        const r = await open(req as Req, reply);
        if (!r) return;
        const comp = r.ctx.info.components.find(k => !k.internal && k.exportName.toLowerCase() === req.params.name.replace(/-/g, '').toLowerCase());
        return comp ? html(reply, 200, componentPage(r.ctx, comp)) : html(reply, 404, notFoundPage(`There is no component "${req.params.name}" in this version.`));
    });

    // The package's own files, so the pages (and the preview) run exactly what a project would install.
    app.get<{ Params: { slug: string; file: string }; Querystring: { v?: string } }>('/docs/:slug/_/:file', async (req, reply) => {
        const r = await open(req as Req, reply);
        if (!r) return;
        const file = req.params.file;
        const type = file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
        let body: Buffer | null = null;
        if (file === 'styles.css' || file === 'tokens.css') body = untarFile(r.tgz, `dist/${file}`);
        else if (file === 'preview.js') body = await previewBundle(r.l.id, r.v.seq, r.tgz);
        if (!body) return reply.code(404).send('not found');
        return reply.code(200).header('content-type', type).header('cache-control', 'public, max-age=3600').send(body);
    });

    // Anyone in the workspace can read the switch; changing it takes the same rights as publishing (a member who may open the library).
    app.get<{ Params: { id: string } }>('/api/libraries/:id/docs', async (req, reply) => {
        const user = req.user;
        const [l] = await db.select().from(libraries).where(eq(libraries.id, req.params.id)).limit(1);
        if (!user || !l || l.workspaceId !== user.workspaceId) return reply.code(404).send({ error: 'not_found' });
        return { slug: slugOf(l.name), public: l.docsPublic, path: `/docs/${slugOf(l.name)}` };
    });
    app.put<{ Params: { id: string }; Body: { public?: boolean } }>('/api/libraries/:id/docs', async (req, reply) => {
        const user = req.user;
        const [l] = await db.select().from(libraries).where(eq(libraries.id, req.params.id)).limit(1);
        if (!user || !l || l.workspaceId !== user.workspaceId) return reply.code(404).send({ error: 'not_found' });
        if (user.role === 'viewer') return reply.code(403).send({ error: 'forbidden', message: 'Viewers cannot change who can read the documentation.' });
        if (typeof req.body?.public !== 'boolean') return reply.code(400).send({ error: 'invalid', message: '"public" must be true or false.' });
        await db.update(libraries).set({ docsPublic: req.body.public }).where(eq(libraries.id, l.id));
        return { slug: slugOf(l.name), public: req.body.public, path: `/docs/${slugOf(l.name)}` };
    });
}

/** React, React DOM and the package's `dist/index.js` in one browser script that puts `window.__midas = { lib, createElement, createRoot }` there. Built once per version. */
async function previewBundle(libraryId: string, seq: number, tgz: Buffer): Promise<Buffer | null> {
    const key = `libraries/${libraryId}/${seq}.docs${GENERATOR_VERSION}.js`;
    try { return await getObject(key); }
    catch { /* not built yet */ }
    const lib = untarFile(tgz, 'dist/index.js');
    if (!lib) return null;
    const virtual: Plugin = {
        name: 'midas-preview',
        setup(b) {
            b.onResolve({ filter: /^midas-package$/ }, () => ({ path: 'midas-package', namespace: 'pkg' }));
            b.onResolve({ filter: /^midas-entry$/ }, () => ({ path: 'midas-entry', namespace: 'pkg' }));
            b.onLoad({ filter: /.*/, namespace: 'pkg' }, args => ({
                contents: args.path === 'midas-package' ? lib.toString('utf8') : "import { createElement } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport * as lib from 'midas-package';\nwindow.__midas = { lib, createElement, createRoot };\n",
                loader: 'js', resolveDir: import.meta.dirname,
            }));
        },
    };
    const out = await build({ entryPoints: ['midas-entry'], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2020', minify: true, jsx: 'automatic', plugins: [virtual], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
    const body = Buffer.from(out.outputFiles[0].text);
    await putObject(key, body, 'text/javascript').catch(() => { });
    return body;
}
