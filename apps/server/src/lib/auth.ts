import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { designFolders, sessions, userFileAccess, users, workspaceMembers } from '../db/schema.js';

export const SESSION_COOKIE = 'midas_session';

export type Role = 'admin' | 'editor' | 'viewer';
export const ROLES: Role[] = ['admin', 'editor', 'viewer'];

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    workspaceId: string;
    role: Role;
    /** all = seluruh file workspace; selected = hanya `grants` + file buatan sendiri. */
    accessMode: 'all' | 'selected';
    /** Untuk mode selected: id folder (sudah termasuk subfoldernya) dan id file yang diberikan. */
    grants: { folders: Set<string>; files: Set<string> };
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

export async function destroySession(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    const id = req.cookies[SESSION_COOKIE];
    if (id)
        await db.delete(sessions).where(eq(sessions.id, id));
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

/** Folder `roots` beserta semua subfoldernya. */
async function withDescendants(workspaceId: string, roots: string[]): Promise<Set<string>> {
    const out = new Set(roots);
    if (!roots.length)
        return out;
    const all = await db.select({ id: designFolders.id, parentId: designFolders.parentId }).from(designFolders).where(eq(designFolders.workspaceId, workspaceId));
    for (let grew = true; grew;) {
        grew = false;
        for (const f of all)
            if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
                out.add(f.id);
                grew = true;
            }
    }
    return out;
}

/** Isi `req.user` dari cookie sesi; user nonaktif dianggap tidak login. Tidak menolak request. */
export async function loadUser(req: FastifyRequest): Promise<void> {
    const id = req.cookies[SESSION_COOKIE];
    if (!id)
        return;
    const [row] = await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role, accessMode: users.accessMode, workspaceId: workspaceMembers.workspaceId })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
        .limit(1);
    if (!row)
        return;
    const grants = { folders: new Set<string>(), files: new Set<string>() };
    if (row.accessMode === 'selected' && row.role !== 'admin') {
        const rows = await db.select().from(userFileAccess).where(eq(userFileAccess.userId, row.id));
        grants.folders = await withDescendants(row.workspaceId, rows.filter(r => r.kind === 'folder').map(r => r.targetId));
        grants.files = new Set(rows.filter(r => r.kind === 'file').map(r => r.targetId));
    }
    req.user = { ...row, role: row.role as Role, accessMode: row.accessMode as 'all' | 'selected', grants };
}

/** preHandler untuk route yang wajib login. */
export async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user)
        return reply.code(401).send({ error: 'unauthorized', message: 'Login required' });
}

/** preHandler untuk route khusus administrator. */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user)
        return reply.code(401).send({ error: 'unauthorized', message: 'Login required' });
    if (req.user.role !== 'admin')
        return reply.code(403).send({ error: 'forbidden', message: 'Administrator only' });
}

/** Boleh melihat file ini? Admin dan mode `all`: ya. Mode `selected`: file buatan sendiri, file yang diberikan, atau isi folder yang diberikan. */
export function canSeeFile(user: AuthUser, f: { id: string; createdBy: string | null; folderId: string | null }): boolean {
    if (user.role === 'admin' || user.accessMode === 'all')
        return true;
    return f.createdBy === user.id || user.grants.files.has(f.id) || (!!f.folderId && user.grants.folders.has(f.folderId));
}
