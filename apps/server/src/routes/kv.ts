import { and, eq, like } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { userKv } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';

export async function kvRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    app.get<{ Querystring: { prefix?: string } }>('/api/kv', async req => {
        const prefix = (req.query.prefix ?? '').replace(/[%_\\]/g, m => '\\' + m);
        const rows = await db.select({ key: userKv.key }).from(userKv)
            .where(and(eq(userKv.userId, req.user!.id), like(userKv.key, prefix + '%')));
        return { keys: rows.map(r => r.key) };
    });

    app.get<{ Params: { key: string } }>('/api/kv/:key', async (req, reply) => {
        const [row] = await db.select().from(userKv)
            .where(and(eq(userKv.userId, req.user!.id), eq(userKv.key, req.params.key))).limit(1);
        if (!row)
            return reply.code(404).send({ error: 'not_found' });
        return { value: row.value };
    });

    app.put<{ Params: { key: string } }>('/api/kv/:key', async (req, reply) => {
        const body = z.object({ value: z.string() }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid' });
        await db.insert(userKv).values({ userId: req.user!.id, key: req.params.key, value: body.data.value })
            .onConflictDoUpdate({ target: [userKv.userId, userKv.key], set: { value: body.data.value, updatedAt: new Date() } });
        return { ok: true };
    });

    app.delete<{ Params: { key: string } }>('/api/kv/:key', async req => {
        await db.delete(userKv).where(and(eq(userKv.userId, req.user!.id), eq(userKv.key, req.params.key)));
        return { ok: true };
    });
}
