import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { db } from '../db/index.js';
import { libraries, libraryVersions } from '../db/schema.js';
import { userFromToken } from '../lib/auth.js';
import { GENERATOR_VERSION, packageNameOf, type PackageInfo } from '../lib/package.js';
import { getObject } from '../lib/s3.js';
import { packageOf } from './libraries.js';

/**
 * A small npm registry, so a frontend project installs the design system straight from Midas:
 *
 *     @midas:registry=https://<midas>/api/registry/
 *     //<midas>/api/registry/:_authToken=<API token>
 *     npm install @midas/web-design-system
 *
 * It only reads: the packages are the React packages of published library versions (see lib/package.ts).
 */
export async function registryRoutes(app: FastifyInstance) {
    const origin = (req: FastifyRequest) => `${req.protocol}://${req.host}`;

    app.get<{ Params: { '*': string } }>('/api/registry/*', async (req, reply) => {
        const user = req.user ?? await userFromToken(req.headers.authorization);
        if (!user)
            return reply.code(401).header('www-authenticate', 'Bearer realm="midas"').send({ error: 'unauthorized', message: 'Use an API token: //<midas>/api/registry/:_authToken=mdt_…' });
        // npm asks for `@midas%2fname` (the package) or `@midas/name/-/file.tgz` (a version's tarball).
        const m = /^@midas\/([^/]+)(?:\/-\/(.+\.tgz))?$/.exec(decodeURIComponent(req.params['*']));
        if (!m)
            return reply.code(404).send({ error: 'not_found' });
        const [, name, file] = m;
        const name$ = `@midas/${name}`;
        const rows = await db.select().from(libraries).where(eq(libraries.workspaceId, user.workspaceId));
        const l = rows.find(x => packageNameOf(x.name) === name$);
        if (!l)
            return reply.code(404).send({ error: 'not_found', message: `No published library is named ${name$}.` });
        const versions = await db.select().from(libraryVersions).where(eq(libraryVersions.libraryId, l.id)).orderBy(desc(libraryVersions.seq));

        if (file) {
            const seq = Number(/-1\.0\.(\d+)\.tgz$/.exec(file)?.[1]);
            const v = versions.find(x => x.seq === seq);
            if (!v)
                return reply.code(404).send({ error: 'not_found', message: `${name$} has no version 1.0.${seq}.` });
            const { tgz } = await packageOf(l, v);
            return reply.header('content-type', 'application/gzip').send(tgz);
        }

        // Versions already built are listed as they are; the newest is built now if nobody did yet.
        const out: Record<string, unknown> = {};
        for (const [i, v] of versions.entries()) {
            let info: PackageInfo | null = null;
            try { info = JSON.parse((await getObject(`libraries/${l.id}/${v.seq}.pkg${GENERATOR_VERSION}.json`)).toString('utf8')); }
            catch { /* not built */ }
            if (!info && i === 0) {
                try { info = (await packageOf(l, v)).info; }
                catch (e) { req.log.error(e, 'registry: package build failed'); return reply.code(500).send({ error: 'package_failed', message: `The package could not be built: ${(e as Error).message}` }); }
            }
            if (info)
                out[info.version] = { ...info.manifest, _id: `${info.packageName}@${info.version}`, dist: { shasum: info.shasum, integrity: info.integrity, tarball: `${origin(req)}/api/registry/${info.packageName}/-/${info.fileName}` } };
        }
        const latest = Object.keys(out)[0];
        if (!latest)
            return reply.code(404).send({ error: 'not_found', message: `${name$} has no installable version yet.` });
        return { _id: name$, name: name$, 'dist-tags': { latest }, versions: out, time: Object.fromEntries(versions.map(v => [`1.0.${v.seq}`, v.publishedAt.toISOString()])) };
    });
}
