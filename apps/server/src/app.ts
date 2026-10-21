import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { loadUser } from './lib/auth.js';
import { authRoutes } from './routes/auth.js';
import { fileRoutes } from './routes/files.js';
import { kvRoutes } from './routes/kv.js';
import { libraryRoutes } from './routes/libraries.js';
import { userRoutes } from './routes/users.js';

export async function buildApp() {
    // trustProxy: behind a hosting proxy the request arrives over http; honour X-Forwarded-* so Secure cookies and URLs are right.
    const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: config.bodyLimit, trustProxy: true });
    await app.register(cookie);
    app.addHook('onRequest', async req => loadUser(req));
    // View-only accounts can read and keep their own editor state (kv) and sign out; every other write is refused.
    app.addHook('preHandler', async (req, reply) => {
        if (req.user?.role !== 'viewer' || ['GET', 'HEAD', 'OPTIONS'].includes(req.method))
            return;
        const path = req.url.split('?')[0];
        if (path === '/api/auth/logout' || path === '/api/auth/password' || path.startsWith('/api/kv') || (req.method === 'PATCH' && path.startsWith('/api/files/')))
            return;
        return reply.code(403).send({ error: 'view_only', message: 'Your account can view but not change files.' });
    });
    app.get('/api/health', async () => ({ ok: true }));
    await app.register(authRoutes);
    await app.register(fileRoutes);
    await app.register(kvRoutes);
    await app.register(libraryRoutes);
    await app.register(userRoutes);
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
