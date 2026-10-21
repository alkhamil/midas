import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sessions, users, workspaceMembers } from '../db/schema.js';
import { createSession, destroySession, requireUser } from '../lib/auth.js';

const credentials = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});

/** Akun dibuat oleh administrator (menu Users) atau seeder; tidak ada pendaftaran sendiri. */
export async function authRoutes(app: FastifyInstance) {
    app.get('/api/auth/status', async () => {
        const [{ n }] = await db.select({ n: count() }).from(users);
        return { hasUsers: n > 0 };
    });

    app.post('/api/auth/login', async (req, reply) => {
        const body = credentials.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: 'Invalid email or password' });
        const [u] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
        if (!u || !(await bcrypt.compare(body.data.password, u.passwordHash)))
            return reply.code(401).send({ error: 'invalid_credentials', message: 'Wrong email or password' });
        if (!u.active)
            return reply.code(403).send({ error: 'inactive', message: 'This account is turned off. Ask an administrator.' });
        await createSession(reply, u.id);
        const [m] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, u.id)).limit(1);
        return { user: { id: u.id, email: u.email, name: u.name, workspaceId: m.workspaceId, role: u.role, accessMode: u.accessMode } };
    });

    app.post('/api/auth/logout', async (req, reply) => {
        await destroySession(req, reply);
        return { ok: true };
    });

    app.get('/api/auth/me', { preHandler: requireUser }, async req => {
        const { grants: _g, ...user } = req.user!;
        return { user };
    });

    // Ganti password sendiri; sesi lain milik user ini berakhir.
    app.post('/api/auth/password', { preHandler: requireUser }, async (req, reply) => {
        const body = z.object({ current: z.string().min(1), next: z.string().min(8, 'Password must be at least 8 characters') }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const [u] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
        if (!(await bcrypt.compare(body.data.current, u.passwordHash)))
            return reply.code(400).send({ error: 'invalid', message: 'Current password is wrong' });
        await db.update(users).set({ passwordHash: await bcrypt.hash(body.data.next, 10) }).where(eq(users.id, u.id));
        const keep = req.cookies.midas_session;
        for (const s of await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, u.id)))
            if (s.id !== keep)
                await db.delete(sessions).where(eq(sessions.id, s.id));
        return { ok: true };
    });
}
