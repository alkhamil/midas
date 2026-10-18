import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { users, workspaceMembers, workspaces } from '../db/schema.js';
import { createSession, createToken, destroySession, requireUser } from '../lib/auth.js';

const credentials = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(8, 'Password minimal 8 karakter'),
});
const registerBody = credentials.extend({ name: z.string().trim().min(1).max(120) });

export async function authRoutes(app: FastifyInstance) {
    app.get('/api/auth/status', async () => {
        const [{ n }] = await db.select({ n: count() }).from(users);
        return { canRegister: config.allowRegister || n === 0, hasUsers: n > 0 };
    });

    app.post('/api/auth/register', async (req, reply) => {
        const body = registerBody.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const [{ n }] = await db.select({ n: count() }).from(users);
        if (!config.allowRegister && n > 0)
            return reply.code(403).send({ error: 'forbidden', message: 'Pendaftaran akun ditutup' });
        const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, body.data.email)).limit(1);
        if (exists.length)
            return reply.code(409).send({ error: 'exists', message: 'Email sudah terdaftar' });
        const passwordHash = await bcrypt.hash(body.data.password, 10);
        const user = await db.transaction(async tx => {
            const [u] = await tx.insert(users).values({ email: body.data.email, name: body.data.name, passwordHash }).returning();
            const [w] = await tx.insert(workspaces).values({ name: `${body.data.name}'s workspace` }).returning();
            await tx.insert(workspaceMembers).values({ workspaceId: w.id, userId: u.id, role: 'owner' });
            return { id: u.id, email: u.email, name: u.name, workspaceId: w.id };
        });
        await createSession(reply, user.id);
        return { user };
    });

    app.post('/api/auth/login', async (req, reply) => {
        const body = credentials.safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: 'Email atau password tidak valid' });
        const [u] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
        if (!u || !(await bcrypt.compare(body.data.password, u.passwordHash)))
            return reply.code(401).send({ error: 'invalid_credentials', message: 'Email atau password salah' });
        await createSession(reply, u.id);
        const [m] = await db.select().from(workspaceMembers).where(eq(workspaceMembers.userId, u.id)).limit(1);
        return { user: { id: u.id, email: u.email, name: u.name, workspaceId: m.workspaceId } };
    });

    app.post('/api/auth/logout', async (req, reply) => {
        await destroySession(req, reply);
        return { ok: true };
    });

    app.get('/api/auth/me', { preHandler: requireUser }, async req => ({ user: req.user }));

    // Token untuk CLI / CI (`midas login`). Bisa dibuat dengan sesi browser atau email + password.
    app.post('/api/auth/tokens', async (req, reply) => {
        let userId = req.user?.id;
        if (!userId) {
            const body = credentials.safeParse(req.body);
            // Tanpa sesi: body wajib email + password; isian kosong/pendek dilaporkan seperti kredensial salah.
            if (!body.success)
                return reply.code(401).send({ error: 'invalid_credentials', message: 'Email atau password salah' });
            const [u] = await db.select().from(users).where(eq(users.email, body.data.email)).limit(1);
            if (!u || !(await bcrypt.compare(body.data.password, u.passwordHash)))
                return reply.code(401).send({ error: 'invalid_credentials', message: 'Email atau password salah' });
            userId = u.id;
        }
        const { token, expiresAt } = await createToken(userId);
        return { token, expiresAt: expiresAt.getTime() };
    });
}
