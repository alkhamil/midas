import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { ensureBucket } from '../src/lib/s3.js';

let app: FastifyInstance;
let cookie = '';
const email = `test-${Date.now()}@midas.local`;
const fileId = `test-file-${Date.now()}`;

async function call(method: string, url: string, payload?: unknown, headers: Record<string, string> = {}) {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as string, headers: { cookie, ...headers } });
    return { status: res.statusCode, body: res.body ? (() => { try { return res.json(); } catch { return res.body; } })() : null, raw: res };
}

before(async () => {
    process.env.LOG_LEVEL = 'silent';
    await ensureBucket();
    app = await buildApp();
});
after(async () => {
    await sql`delete from workspaces where id in (select m.workspace_id from workspace_members m join users u on u.id = m.user_id where u.email = ${email})`;
    await sql`delete from users where email = ${email}`;
    await app.close();
    await sql.end();
});

test('register + me', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, name: 'Tester', password: 'rahasia123' } });
    assert.equal(res.statusCode, 200);
    cookie = String(res.headers['set-cookie']).split(';')[0];
    const me = await call('GET', '/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);
});

test('unauthenticated requests are rejected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/files' });
    assert.equal(res.statusCode, 401);
});

test('file meta create, update, conflict', async () => {
    const create = await call('PUT', `/api/files/${fileId}`, { name: 'Doc', meta: { name: 'Doc', pageMeta: [{ id: 'p1', name: 'Page 1' }] }, baseVersion: null });
    assert.equal(create.status, 200);
    assert.equal(create.body.version, 1);
    const upd = await call('PUT', `/api/files/${fileId}`, { name: 'Doc 2', meta: { name: 'Doc 2', pageMeta: [{ id: 'p1', name: 'Page 1' }] }, baseVersion: 1 });
    assert.equal(upd.body.version, 2);
    const stale = await call('PUT', `/api/files/${fileId}`, { name: 'Old', meta: {}, baseVersion: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.version, 2);
});

test('page save + conflict', async () => {
    const page = { id: 'p1', name: 'Page 1', nodes: [{ id: 'n1', type: 'rect' }] };
    const first = await call('PUT', `/api/files/${fileId}/pages/p1`, { data: page, baseVersion: null });
    assert.equal(first.body.version, 1);
    const dupNew = await call('PUT', `/api/files/${fileId}/pages/p1`, { data: page, baseVersion: null });
    assert.equal(dupNew.status, 409);
    const second = await call('PUT', `/api/files/${fileId}/pages/p1`, { data: page, baseVersion: 1 });
    assert.equal(second.body.version, 2);
    const pages = await call('GET', `/api/files/${fileId}/pages`);
    assert.deepEqual(pages.body.pages[0].data.nodes, page.nodes);
});

test('assets upload, read, export embeds data url', async () => {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    const up = await call('PUT', `/api/files/${fileId}/assets/a1`, png, { 'content-type': 'image/png' });
    assert.equal(up.status, 200);
    const get = await call('GET', up.body.url);
    assert.equal(get.status, 200);
    assert.equal(get.raw.headers['content-type'], 'image/png');
    assert.deepEqual(get.raw.rawPayload, png);
    const exp = await call('GET', `/api/files/${fileId}/export`);
    assert.equal(exp.body.assets.a1, `data:image/png;base64,${png.toString('base64')}`);
    assert.equal(exp.body.pages.length, 1);
});

test('index fields + list + delete', async () => {
    await call('PATCH', `/api/files/${fileId}`, { thumb: 'data:image/jpeg;base64,AA', trashed: 123 });
    const list = await call('GET', '/api/files');
    const f = list.body.files.find((x: { id: string }) => x.id === fileId);
    assert.equal(f.thumb, 'data:image/jpeg;base64,AA');
    assert.equal(f.trashed, 123);
    await call('DELETE', `/api/files/${fileId}`);
    const gone = await call('GET', `/api/files/${fileId}`);
    assert.equal(gone.status, 404);
});

test('import full document', async () => {
    const data = { name: 'Imported', pageId: 'x1', pages: [{ id: 'x1', name: 'One', nodes: [] }, { id: 'x2', name: 'Two', nodes: [] }], assets: { img: 'data:image/png;base64,iVBORw0KGgo=' }, tokens: {}, variables: { collections: [], items: [] } };
    const res = await call('POST', '/api/files/import', { data });
    assert.equal(res.status, 200);
    const exp = await call('GET', `/api/files/${res.body.id}/export`);
    assert.deepEqual(exp.body.pages.map((p: { id: string }) => p.id), ['x1', 'x2']);
    assert.equal(exp.body.assets.img, 'data:image/png;base64,iVBORw0KGgo=');
});

test('kv store', async () => {
    await call('PUT', '/api/kv/last', { value: 'abc' });
    assert.equal((await call('GET', '/api/kv/last')).body.value, 'abc');
    assert.deepEqual((await call('GET', '/api/kv?prefix=la')).body.keys, ['last']);
    assert.equal((await call('GET', '/api/kv/missing')).status, 404);
});

