import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { sql } from '../src/db/index.js';

export const PASSWORD = 'rahasia123';

/** Create an account straight in the database (there is no sign-up) and sign in; returns its session cookie. */
export async function createUser(app: FastifyInstance, email: string, opts: { role?: string; workspaceId?: string; name?: string } = {}) {
    const [u] = await sql`insert into users (email, name, password_hash, role) values (${email}, ${opts.name ?? 'Tester'}, ${await bcrypt.hash(PASSWORD, 4)}, ${opts.role ?? 'admin'}) returning id`;
    const [w] = opts.workspaceId ? [{ id: opts.workspaceId }] : await sql`insert into workspaces (name) values (${`${email} workspace`}) returning id`;
    await sql`insert into workspace_members (workspace_id, user_id, role) values (${w.id}, ${u.id}, 'owner')`;
    return { id: u.id as string, workspaceId: w.id as string, cookie: await login(app, email) };
}

export async function login(app: FastifyInstance, email: string, password = PASSWORD): Promise<string> {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } });
    return res.statusCode === 200 ? String(res.headers['set-cookie']).split(';')[0] : '';
}

/** Remove the accounts (and the workspaces they own) created by a test. */
export async function dropUsers(emails: string[]) {
    await sql`delete from workspaces where id in (select m.workspace_id from workspace_members m join users u on u.id = m.user_id where u.email in ${sql(emails)})`;
    await sql`delete from users where email in ${sql(emails)}`;
}
