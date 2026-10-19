import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { loadUser } from './lib/auth.js';
import { authRoutes } from './routes/auth.js';
import { builderRoutes } from './routes/builder.js';
import { fileRoutes } from './routes/files.js';
import { kvRoutes } from './routes/kv.js';
import { libraryRoutes } from './routes/libraries.js';
import { templateRoutes } from './routes/templates.js';

export async function buildApp() {
    // trustProxy: behind a hosting proxy the request arrives over http; honour X-Forwarded-* so Secure cookies and URLs are right.
    const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: config.bodyLimit, trustProxy: true });
    await app.register(cookie);
    app.addHook('onRequest', async req => loadUser(req));
    app.get('/api/health', async () => ({ ok: true }));
    await app.register(authRoutes);
    await app.register(fileRoutes);
    await app.register(kvRoutes);
    await app.register(libraryRoutes);
    await app.register(builderRoutes);
    await app.register(templateRoutes);
    // Studio (static build) on the same origin as the API: one service to host, and the session cookie just works.
    const studio = config.studioDist || fileURLToPath(new URL('../../studio/dist', import.meta.url));
    if (existsSync(studio)) {
        await app.register(fastifyStatic, { root: studio, wildcard: false });
        // Deep links such as /file/<id>?page=… are client routes: answer with the app shell (never for /api).
        app.setNotFoundHandler((req, reply) => {
            if (req.method === 'GET' && !req.url.startsWith('/api/')) return reply.sendFile('index.html');
            return reply.code(404).send({ error: 'Not found' });
        });
    }
    return app;
}
