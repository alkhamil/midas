import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { config } from './config.js';
import { loadUser } from './lib/auth.js';
import { authRoutes } from './routes/auth.js';
import { builderRoutes } from './routes/builder.js';
import { fileRoutes } from './routes/files.js';
import { kvRoutes } from './routes/kv.js';
import { libraryRoutes } from './routes/libraries.js';
import { templateRoutes } from './routes/templates.js';

export async function buildApp() {
    const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: config.bodyLimit });
    await app.register(cookie);
    app.addHook('onRequest', async req => loadUser(req));
    app.get('/api/health', async () => ({ ok: true }));
    await app.register(authRoutes);
    await app.register(fileRoutes);
    await app.register(kvRoutes);
    await app.register(libraryRoutes);
    await app.register(builderRoutes);
    await app.register(templateRoutes);
    return app;
}
