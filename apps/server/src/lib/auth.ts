import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { sessions, users, workspaceMembers } from '../db/schema.js';

export const SESSION_COOKIE = 'midas_session';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    workspaceId: string;
}

declare module 'fastify' {
    interface FastifyRequest {
        user?: AuthUser;
    }
}

export async function createSession(reply: FastifyReply, userId: string): Promise<void> {
    const id = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + config.sessionDays * 864e5);
    await db.insert(sessions).values({ id, userId, expiresAt });
    reply.setCookie(SESSION_COOKIE, id, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires: expiresAt });
}

/** Token akses untuk CLI/CI: sesi berumur panjang yang dikirim lewat `Authorization: Bearer <token>`. */
export async function createToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
    const token = `mdt_${randomBytes(32).toString('base64url')}`;
    const expiresAt = new Date(Date.now() + config.tokenDays * 864e5);
    await db.insert(sessions).values({ id: token, userId, expiresAt });
    return { token, expiresAt };
}

export async function destroySession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const id = req.cookies[SESSION_COOKIE];
    if (id)
        await db.delete(sessions).where(eq(sessions.id, id));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Isi `req.user` dari cookie sesi atau token Bearer; tidak menolak request. */
export async function loadUser(req: FastifyRequest): Promise<void> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const id = bearer ?? req.cookies[SESSION_COOKIE];
    if (!id)
        return;
    const [row] = await db
        .select({ id: users.id, email: users.email, name: users.name, workspaceId: workspaceMembers.workspaceId })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
        .limit(1);
    if (row)
        req.user = row;
}

/** preHandler untuk route yang wajib login. */
export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user)
        return reply.code(401).send({ error: 'unauthorized', message: 'Login required' });
}
