import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { apiTokens } from '../db/schema.js';
import { hashToken, requireUser, TOKEN_PREFIX } from '../lib/auth.js';

/** Personal API tokens: a token acts as its owner (same role and file scope) but only reads, through /mcp. */
export async function tokenRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    app.get('/api/tokens', async req => {
        const rows = await db.select().from(apiTokens).where(eq(apiTokens.userId, req.user!.id)).orderBy(desc(apiTokens.createdAt));
        return { tokens: rows.map(t => ({ id: t.id, name: t.name, prefix: t.prefix, created: t.createdAt.getTime(), lastUsed: t.lastUsedAt?.getTime() ?? null })) };
    });

    app.post('/api/tokens', async (req, reply) => {
        const body = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: 'Give the token a name' });
        const token = `${TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`;
        const [row] = await db.insert(apiTokens).values({ userId: req.user!.id, name: body.data.name, tokenHash: hashToken(token), prefix: token.slice(0, 8) }).returning();
        // The only time the token itself is shown.
        return { token, item: { id: row.id, name: row.name, prefix: row.prefix, created: row.createdAt.getTime(), lastUsed: null } };
    });

    app.delete<{ Params: { id: string } }>('/api/tokens/:id', async (req, reply) => {
        const gone = await db.delete(apiTokens).where(and(eq(apiTokens.id, req.params.id), eq(apiTokens.userId, req.user!.id))).returning({ id: apiTokens.id });
        return gone.length ? { ok: true } : reply.code(404).send({ error: 'not_found' });
    });
}
