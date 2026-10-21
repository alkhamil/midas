import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { seedAdmin } from '../src/db/seed.js';
import { ensureBucket } from '../src/lib/s3.js';
import { createUser, dropUsers, login, PASSWORD } from './helpers.js';

let app: FastifyInstance;
const stamp = Date.now();
const adminEmail = `admin-${stamp}@midas.local`, editorEmail = `editor-${stamp}@midas.local`, viewerEmail = `viewer-${stamp}@midas.local`, scopedEmail = `scoped-${stamp}@midas.local`;
let admin: { id: string; workspaceId: string; cookie: string };
const as = (cookie: string) => async (method: string, url: string, payload?: unknown) => {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as string, headers: { cookie } });
    return { status: res.statusCode, body: res.body ? res.json() : null };
};
let a: ReturnType<typeof as>;

before(async () => {
    process.env.LOG_LEVEL = 'silent';
    await ensureBucket();
    app = await buildApp();
    admin = await createUser(app, adminEmail);
    a = as(admin.cookie);
});
after(async () => {
    await dropUsers([adminEmail, editorEmail, viewerEmail, scopedEmail]);
    await sql`delete from users where email = ${`seed-${stamp}@midas.local`}`;
    await app.close();
    await sql.end();
});

test('the seeder creates the administrator once and never overwrites its password', async () => {
    const seedEmail = `seed-${stamp}@midas.local`;
    process.env.SEED_ADMIN_EMAIL = seedEmail;
    process.env.SEED_ADMIN_PASSWORD = 'seeded-pass-1';
    await seedAdmin();
    assert.ok(await login(app, seedEmail, 'seeded-pass-1'));
    process.env.SEED_ADMIN_PASSWORD = 'changed-pass-2';
    await seedAdmin();
    assert.ok(await login(app, seedEmail, 'seeded-pass-1'));
    assert.equal(await login(app, seedEmail, 'changed-pass-2'), '');
    delete process.env.SEED_ADMIN_EMAIL;
    delete process.env.SEED_ADMIN_PASSWORD;
});

test('only administrators manage users', async () => {
    const created = await a('POST', '/api/users', { email: editorEmail, name: 'Editor', password: PASSWORD, role: 'editor' });
    assert.equal(created.status, 200, JSON.stringify(created.body));
    const editor = as(await login(app, editorEmail));
    assert.equal((await editor('GET', '/api/users')).status, 403);
    assert.equal((await editor('POST', '/api/users', { email: 'x@y.test', name: 'X', password: PASSWORD })).status, 403);
    assert.equal((await a('GET', '/api/users')).body.users.some((u: { email: string }) => u.email === editorEmail), true);
    assert.equal((await a('POST', '/api/users', { email: editorEmail, name: 'Again', password: PASSWORD })).status, 409);
});

test('a turned-off account cannot sign in, and its session ends', async () => {
    const editor = (await a('GET', '/api/users')).body.users.find((u: { email: string }) => u.email === editorEmail);
    const cookie = await login(app, editorEmail);
    assert.equal((await as(cookie)('GET', '/api/auth/me')).status, 200);
    assert.equal((await a('PATCH', `/api/users/${editor.id}`, { active: false })).status, 200);
    assert.equal((await as(cookie)('GET', '/api/auth/me')).status, 401);
    assert.equal(await login(app, editorEmail), '');
    await a('PATCH', `/api/users/${editor.id}`, { active: true });
    assert.ok(await login(app, editorEmail));
});

test('view-only accounts can read but not change', async () => {
    await a('POST', '/api/users', { email: viewerEmail, name: 'Viewer', password: PASSWORD, role: 'viewer' });
    await a('PUT', `/api/files/f-view-${stamp}`, { name: 'Shared', meta: { name: 'Shared', pageMeta: [] }, baseVersion: null });
    const v = as(await login(app, viewerEmail));
    assert.equal((await v('GET', '/api/files')).body.files.some((f: { id: string }) => f.id === `f-view-${stamp}`), true);
    const write = await v('PUT', `/api/files/f-view-${stamp}`, { name: 'Hacked', meta: { name: 'Hacked', pageMeta: [] }, baseVersion: 1 });
    assert.equal(write.status, 403);
    assert.equal(write.body.error, 'view_only');
    assert.equal((await v('POST', '/api/folders', { id: `fo-${stamp}`, name: 'No' })).status, 403);
});

test('selected access: own files plus the folders and files that were granted', async () => {
    await a('POST', '/api/folders', { id: `fo-a-${stamp}`, name: 'Team A' });
    await a('POST', '/api/folders', { id: `fo-a1-${stamp}`, name: 'Inside A', parent: `fo-a-${stamp}` });
    for (const [id, folder] of [[`f-open-${stamp}`, `fo-a1-${stamp}`], [`f-direct-${stamp}`, null], [`f-closed-${stamp}`, null]] as const) {
        await a('PUT', `/api/files/${id}`, { name: id, meta: { name: id, pageMeta: [] }, baseVersion: null });
        if (folder)
            await a('PATCH', `/api/files/${id}`, { folder });
    }
    const made = await a('POST', '/api/users', {
        email: scopedEmail, name: 'Scoped', password: PASSWORD, role: 'editor', accessMode: 'selected',
        access: [{ kind: 'folder', id: `fo-a-${stamp}` }, { kind: 'file', id: `f-direct-${stamp}` }],
    });
    assert.equal(made.status, 200, JSON.stringify(made.body));
    const s = as(await login(app, scopedEmail));
    const ids = (await s('GET', '/api/files')).body.files.map((f: { id: string }) => f.id);
    assert.ok(ids.includes(`f-open-${stamp}`) && ids.includes(`f-direct-${stamp}`));
    assert.ok(!ids.includes(`f-closed-${stamp}`));
    assert.equal((await s('GET', `/api/files/f-closed-${stamp}`)).status, 404);
    assert.equal((await s('PUT', `/api/files/f-closed-${stamp}`, { name: 'x', meta: { name: 'x', pageMeta: [] }, baseVersion: 1 })).status, 403);
    assert.equal((await s('GET', `/api/files/f-open-${stamp}`)).status, 200);
    // Files created by the scoped user stay visible to them.
    await s('PUT', `/api/files/f-mine-${stamp}`, { name: 'Mine', meta: { name: 'Mine', pageMeta: [] }, baseVersion: null });
    assert.equal((await s('GET', `/api/files/f-mine-${stamp}`)).status, 200);
    const folders = (await s('GET', '/api/folders')).body.folders.map((f: { id: string }) => f.id);
    assert.deepEqual(folders.sort(), [`fo-a-${stamp}`, `fo-a1-${stamp}`].sort());
    // Widening the scope applies at once.
    const user = made.body.user;
    await a('PATCH', `/api/users/${user.id}`, { accessMode: 'all' });
    const wide = as(await login(app, scopedEmail));
    assert.ok((await wide('GET', '/api/files')).body.files.some((f: { id: string }) => f.id === `f-closed-${stamp}`));
});

test('guards: not yourself, and not the last administrator', async () => {
    assert.equal((await a('PATCH', `/api/users/${admin.id}`, { active: false })).status, 400);
    assert.equal((await a('PATCH', `/api/users/${admin.id}`, { role: 'viewer' })).status, 400);
    assert.equal((await a('DELETE', `/api/users/${admin.id}`)).status, 400);
    const list = (await a('GET', '/api/users')).body.users;
    const scoped = list.find((u: { email: string }) => u.email === scopedEmail);
    assert.equal((await a('DELETE', `/api/users/${scoped.id}`)).status, 200);
    assert.equal(await login(app, scopedEmail), '');
});

test('changing your own password needs the current one and ends your other sessions', async () => {
    const first = admin.cookie, second = await login(app, adminEmail);
    const me = as(first);
    assert.equal((await me('POST', '/api/auth/password', { current: 'wrong-wrong', next: 'new-password-1' })).status, 400);
    assert.equal((await me('POST', '/api/auth/password', { current: PASSWORD, next: 'new-password-1' })).status, 200);
    assert.equal((await as(second)('GET', '/api/auth/me')).status, 401);
    assert.equal((await me('GET', '/api/auth/me')).status, 200);
    assert.ok(await login(app, adminEmail, 'new-password-1'));
});
