import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { ensureBucket } from '../src/lib/s3.js';

let app: FastifyInstance;
let cookie = '';
const stamp = Date.now();
const email = `lib-${stamp}@midas.local`;
const dsFile = `ds-${stamp}`;
const appFile = `app-${stamp}`;

async function call(method: string, url: string, payload?: unknown) {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as string, headers: { cookie } });
    return { status: res.statusCode, body: res.json() };
}

// Button: component set dengan dua variant.
const button = (types = ['Primary', 'Secondary']) => ({
    id: 'btn', name: 'Button', set: true,
    nodes: [
        { id: 'btn', parentId: null, componentSet: true, name: 'Button' },
        ...types.map(t => ({ id: `btn-${t}`, parentId: 'btn', component: true, variant: { Type: t } })),
    ],
});
const snapshot = (types?: string[]) => ({ components: [button(types)], variables: { collections: [], items: [{ id: 'v1' }] } });

before(async () => {
    process.env.LOG_LEVEL = 'silent';
    await ensureBucket();
    app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, name: 'Lib Tester', password: 'rahasia123' } });
    cookie = String(res.headers['set-cookie']).split(';')[0];
    for (const id of [dsFile, appFile])
        await call('PUT', `/api/files/${id}`, { name: id, meta: { name: id, pageMeta: [] }, baseVersion: null });
});
after(async () => {
    await sql`delete from workspaces where id in (select m.workspace_id from workspace_members m join users u on u.id = m.user_id where u.email = ${email})`;
    await sql`delete from users where email = ${email}`;
    await app.close();
    await sql.end();
});

test('publishing needs at least one component or variable', async () => {
    const empty = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: { components: [button()], variables: { collections: [], items: [] } }, componentKeys: [] });
    assert.equal(empty.status, 400);
    const unknown = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: snapshot(), componentKeys: ['nope'] });
    assert.equal(unknown.status, 400);
});

test('each publish is a numbered version', async () => {
    const one = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: snapshot(), componentKeys: ['btn'] });
    assert.equal(one.status, 200, JSON.stringify(one.body));
    assert.equal(one.body.library.version, 1);
    const two = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: snapshot(['Primary']), componentKeys: ['btn'], releaseNotes: 'Smaller' });
    assert.equal(two.body.library.version, 2);
});

test('list, snapshot and history are visible in the workspace', async () => {
    const list = await call('GET', '/api/libraries');
    const lib = list.body.libraries.find((l: { id: string }) => l.id === dsFile);
    assert.equal(lib.version, 2);
    assert.equal(lib.components, 1);
    const snap = await call('GET', `/api/libraries/${dsFile}/snapshot`);
    assert.equal(snap.body.version, 2);
    assert.equal(snap.body.components[0].nodes.length, 2);
    const old = await call('GET', `/api/libraries/${dsFile}/snapshot?seq=1`);
    assert.equal(old.body.components[0].nodes.length, 3);
    const hist = await call('GET', `/api/libraries/${dsFile}`);
    assert.deepEqual(hist.body.versions.map((v: { seq: number }) => v.seq), [2, 1]);
});

test('files record which libraries they use', async () => {
    await call('PUT', `/api/files/${appFile}/libraries`, { libraries: [{ id: dsFile, version: 1 }, { id: 'unknown', version: 1 }] });
    const res = await call('GET', `/api/files/${appFile}/libraries`);
    assert.deepEqual(res.body.libraries, [{ id: dsFile, version: 1, name: 'Test DS' }]);
});

test('legacy libraries are imported once', async () => {
    const legacyFile = `legacy-${stamp}`;
    await call('PUT', `/api/files/${legacyFile}`, { name: 'Old DS', meta: { name: 'Old DS', pageMeta: [] }, baseVersion: null });
    const body = { snapshots: [{ id: legacyFile, name: 'Old DS', version: 3, ...snapshot() }], uses: { [appFile]: [{ id: legacyFile, version: 3 }] } };
    const first = await call('POST', '/api/libraries/import-legacy', body);
    assert.deepEqual(first.body.imported, [legacyFile]);
    const again = await call('POST', '/api/libraries/import-legacy', body);
    assert.deepEqual(again.body.skipped, [legacyFile]);
    const orphan = await call('POST', '/api/libraries/import-legacy', { snapshots: [{ id: 'nope', name: 'X', version: 1, ...snapshot() }] });
    assert.deepEqual(orphan.body.missing, ['nope']);
    const lib = (await call('GET', '/api/libraries')).body.libraries.find((l: { id: string }) => l.id === legacyFile);
    assert.equal(lib.version, 3);
});

test('unpublish removes the library but not the file', async () => {
    assert.equal((await call('DELETE', `/api/libraries/${dsFile}`)).status, 200);
    assert.equal((await call('GET', `/api/libraries/${dsFile}`)).status, 404);
    assert.equal((await call('GET', `/api/files/${dsFile}`)).status, 200);
});
