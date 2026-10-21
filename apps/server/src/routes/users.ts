import bcrypt from 'bcryptjs';
import { and, eq, ne } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sessions, userFileAccess, users, workspaceMembers } from '../db/schema.js';
import { requireAdmin, ROLES } from '../lib/auth.js';

const accessItem = z.object({ kind: z.enum(['folder', 'file']), id: z.string().min(1) });
const fields = {
    name: z.string().trim().min(1).max(120),
    role: z.enum(ROLES as [string, ...string[]]),
    accessMode: z.enum(['all', 'selected']),
    access: z.array(accessItem).max(2000),
};
const password = z.string().min(8, 'Password must be at least 8 characters').max(200);

/** User management: administrators only. Everyone lives in the administrator's workspace. */
export async function userRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireAdmin);

    const members = (workspaceId: string) => db.select({ u: users }).from(users)
        .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.workspaceId, workspaceId));
    const accessOf = async (userId: string) => (await db.select().from(userFileAccess).where(eq(userFileAccess.userId, userId))).map(a => ({ kind: a.kind, id: a.targetId }));
    const shape = async (u: typeof users.$inferSelect) => ({
        id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, accessMode: u.accessMode,
        access: u.accessMode === 'selected' ? await accessOf(u.id) : [], created: u.createdAt.getTime(),
    });
    const setAccess = async (userId: string, items: z.infer<typeof accessItem>[]) => {
        await db.delete(userFileAccess).where(eq(userFileAccess.userId, userId));
        if (items.length)
            await db.insert(userFileAccess).values(items.map(i => ({ userId, kind: i.kind, targetId: i.id }))).onConflictDoNothing();
    };
    const adminsLeft = async (workspaceId: string, exceptId: string) =>
        (await members(workspaceId)).filter(m => m.u.id !== exceptId && m.u.role === 'admin' && m.u.active).length;

    app.get('/api/users', async req => {
        const rows = await members(req.user!.workspaceId);
        const list = await Promise.all(rows.map(r => shape(r.u)));
        return { users: list.sort((a, b) => a.created - b.created) };
    });

    app.post('/api/users', async (req, reply) => {
        const body = z.object({
            email: z.string().trim().toLowerCase().email(), password, name: fields.name,
            role: fields.role.default('editor'), accessMode: fields.accessMode.default('all'), access: fields.access.default([]),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const b = body.data;
        if ((await db.select({ id: users.id }).from(users).where(eq(users.email, b.email)).limit(1)).length)
            return reply.code(409).send({ error: 'exists', message: 'Email is already used' });
        const [u] = await db.transaction(async tx => {
            const [created] = await tx.insert(users).values({ email: b.email, name: b.name, passwordHash: await bcrypt.hash(b.password, 10), role: b.role, accessMode: b.accessMode }).returning();
            await tx.insert(workspaceMembers).values({ workspaceId: req.user!.workspaceId, userId: created.id, role: b.role === 'admin' ? 'owner' : b.role });
            return [created];
        });
        if (b.accessMode === 'selected')
            await setAccess(u.id, b.access);
        return { user: await shape(u) };
    });

    app.patch<{ Params: { id: string } }>('/api/users/:id', async (req, reply) => {
        const body = z.object({
            name: fields.name.optional(), role: fields.role.optional(), active: z.boolean().optional(),
            accessMode: fields.accessMode.optional(), access: fields.access.optional(), password: password.optional(),
        }).safeParse(req.body);
        if (!body.success)
            return reply.code(400).send({ error: 'invalid', message: body.error.issues[0].message });
        const b = body.data, ws = req.user!.workspaceId;
        const target = (await members(ws)).find(m => m.u.id === req.params.id)?.u;
        if (!target)
            return reply.code(404).send({ error: 'not_found', message: 'User not found' });
        const self = target.id === req.user!.id;
        if (self && (b.active === false || (b.role && b.role !== 'admin')))
            return reply.code(400).send({ error: 'invalid', message: 'You cannot turn off or demote your own account' });
        if ((b.active === false || (b.role && b.role !== 'admin')) && target.role === 'admin' && !(await adminsLeft(ws, target.id)))
            return reply.code(400).send({ error: 'invalid', message: 'At least one active administrator is needed' });
        const set: Partial<typeof users.$inferInsert> = {};
        if (b.name !== undefined) set.name = b.name;
        if (b.role !== undefined) set.role = b.role;
        if (b.active !== undefined) set.active = b.active;
        if (b.accessMode !== undefined) set.accessMode = b.accessMode;
        if (b.password !== undefined) set.passwordHash = await bcrypt.hash(b.password, 10);
        if (Object.keys(set).length)
            await db.update(users).set(set).where(eq(users.id, target.id));
        if (b.access !== undefined)
            await setAccess(target.id, b.access);
        // A turned-off account, a new password or a changed role takes effect now: other sessions end.
        if (b.active === false || b.password !== undefined || b.role !== undefined || b.accessMode !== undefined || b.access !== undefined) {
            const keep = self ? req.cookies.midas_session : null;
            for (const s of await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, target.id)))
                if (s.id !== keep)
                    await db.delete(sessions).where(eq(sessions.id, s.id));
        }
        const [fresh] = await db.select().from(users).where(eq(users.id, target.id)).limit(1);
        return { user: await shape(fresh) };
    });

    app.delete<{ Params: { id: string } }>('/api/users/:id', async (req, reply) => {
        const ws = req.user!.workspaceId, target = (await members(ws)).find(m => m.u.id === req.params.id)?.u;
        if (!target)
            return reply.code(404).send({ error: 'not_found', message: 'User not found' });
        if (target.id === req.user!.id)
            return reply.code(400).send({ error: 'invalid', message: 'You cannot delete your own account' });
        if (target.role === 'admin' && !(await adminsLeft(ws, target.id)))
            return reply.code(400).send({ error: 'invalid', message: 'At least one active administrator is needed' });
        await db.delete(users).where(and(eq(users.id, target.id), ne(users.id, req.user!.id)));
        return { ok: true };
    });
}
