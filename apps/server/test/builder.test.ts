import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { ensureBucket } from '../src/lib/s3.js';
import { moduleType, validateConfig, type BuilderConfig } from '../src/lib/builder.js';

let app: FastifyInstance;
let cookie = '';
const stamp = Date.now();
const email = `builder-${stamp}@midas.local`;
const appFile = `builder-app-${stamp}`;
const dsFile = `builder-ds-${stamp}`;

async function call(method: string, url: string, payload?: unknown) {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as string, headers: { cookie } });
    return { status: res.statusCode, body: res.json() };
}

const userModule = (over: Partial<BuilderConfig['modules'][number]> = {}): BuilderConfig['modules'][number] => ({
    id: 'm-user', name: 'user', label: 'User', parentId: null, pageId: 'p-user',
    entity: { fields: [{ name: 'fullName', type: 'string', required: true, sortable: true, filterable: true }] },
    screens: [{ id: 's-list', frameId: 'f-list', pageId: 'p-user', name: 'User List', role: 'list' }],
    ...over,
});

before(async () => {
    process.env.LOG_LEVEL = 'silent';
    await ensureBucket();
    app = await buildApp();
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, name: 'Builder Tester', password: 'rahasia123' } });
    cookie = String(res.headers['set-cookie']).split(';')[0];
    for (const id of [appFile, dsFile])
        await call('PUT', `/api/files/${id}`, { name: id, meta: { name: id, pageMeta: [] }, baseVersion: null });
    const snapshot = { components: [{ id: 'btn', name: 'Button', nodes: [{ id: 'btn', parentId: null, component: true, cprops: [] }] }], variables: { collections: [], items: [] } };
    const draft = await call('POST', `/api/libraries/${dsFile}/draft`, { name: 'DS', snapshot });
    await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'DS', packageName: `@midas/ui-builder-${stamp}`, version: '1.0.0', snapshot, mappings: draft.body.mappings });
});
after(async () => {
    await sql`delete from workspaces where id in (select m.workspace_id from workspace_members m join users u on u.id = m.user_id where u.email = ${email})`;
    await sql`delete from users where email = ${email}`;
    await app.close();
    await sql.end();
});

test('validateConfig: duplicate names, parent cycles and duplicate CRUD roles', () => {
    assert.deepEqual(validateConfig({ modules: [userModule()] }), []);
    const dup = validateConfig({ modules: [userModule(), userModule({ id: 'm-2' })] });
    assert.match(dup.join('\n'), /Nama module user sudah dipakai/);
    const cycle = validateConfig({ modules: [userModule({ id: 'a', name: 'a', parentId: 'b' }), userModule({ id: 'b', name: 'b', parentId: 'a' })] });
    assert.match(cycle.join('\n'), /siklus/);
    const roles = validateConfig({ modules: [userModule({ screens: [
        { id: 's1', frameId: 'f1', pageId: 'p', name: 'A', role: 'list' },
        { id: 's2', frameId: 'f2', pageId: 'p', name: 'B', role: 'list' },
    ] })] });
    assert.match(roles.join('\n'), /lebih dari satu screen list/);
    // Frame yang sama boleh dipakai create + edit (spec §4.1).
    assert.deepEqual(validateConfig({ modules: [userModule({ screens: [
        { id: 's1', frameId: 'f1', pageId: 'p', name: 'Form', role: 'create' },
        { id: 's2', frameId: 'f1', pageId: 'p', name: 'Form', role: 'edit' },
    ] })] }), []);
});

test('moduleType: crud, custom, empty', () => {
    assert.equal(moduleType(userModule()), 'crud');
    assert.equal(moduleType({ screens: [{ id: 's', frameId: 'f', pageId: 'p', name: 'Dash', role: 'custom' }] }), 'custom');
    assert.equal(moduleType({ screens: [] }), 'empty');
});

test('create, read, update with version, conflict and delete', async () => {
    const created = await call('POST', '/api/builder-projects', { name: 'CMS', fileId: appFile, libraryId: dsFile, libraryVersion: '1.0.0' });
    assert.equal(created.status, 201);
    const p = created.body.project;
    assert.equal(p.library.packageName, `@midas/ui-builder-${stamp}`);
    assert.equal(p.library.version, '1.0.0');
    assert.deepEqual(p.config, { modules: [] });

    const saved = await call('PUT', `/api/builder-projects/${p.id}`, { version: p.version, config: { modules: [userModule()] } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.project.version, 2);
    assert.equal(saved.body.project.config.modules[0].screens[0].role, 'list');

    const stale = await call('PUT', `/api/builder-projects/${p.id}`, { version: 1, name: 'Old' });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.project.version, 2);

    const list = await call('GET', `/api/builder-projects?fileId=${appFile}`);
    assert.equal(list.body.projects.length, 1);
    assert.equal(list.body.projects[0].screens, 1);

    assert.equal((await call('DELETE', `/api/builder-projects/${p.id}`)).status, 200);
    assert.equal((await call('GET', `/api/builder-projects/${p.id}`)).status, 404);
});

test('node config, layout and password fields round-trip through the project config', async () => {
    const created = await call('POST', '/api/builder-projects', { name: 'Props', fileId: appFile, libraryId: dsFile, libraryVersion: '1.0.0' });
    const p = created.body.project;
    const mod = userModule({
        entity: { fields: [{ name: 'password', type: 'password' }, { name: 'name', type: 'string' }] },
        screens: [{ id: 's1', frameId: 'f1', pageId: 'p', name: 'List', role: 'list', nodes: { n1: { props: { children: 'Buat', size: 'lg', disabled: false }, action: { type: 'navigate', screenId: 's2' }, table: { columns: ['name'], rowActions: ['view'], pageSize: 25 }, hidden: true } } }],
    });
    const layout = { appName: 'Acme', userName: 'Admin', items: [{ moduleId: mod.id, label: 'Pengguna', icon: 'user', hidden: false }] };
    const saved = await call('PUT', `/api/builder-projects/${p.id}`, { version: p.version, config: { modules: [mod], layout } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const back = (await call('GET', `/api/builder-projects/${p.id}`)).body.project.config;
    assert.deepEqual(back.modules[0].screens[0].nodes.n1.table, { columns: ['name'], rowActions: ['view'], pageSize: 25 });
    assert.equal(back.modules[0].screens[0].nodes.n1.props.children, 'Buat');
    assert.equal(back.layout.appName, 'Acme');
    assert.equal(back.modules[0].entity.fields[0].type, 'password');
    const bad = await call('PUT', `/api/builder-projects/${p.id}`, { version: saved.body.project.version, config: { modules: [{ ...mod, screens: [{ ...mod.screens[0], nodes: { n1: { action: { type: 'explode' } } } }] }] } });
    assert.equal(bad.status, 400);
    // validasi: aturan tak dikenal / regex rusak / relasi ke module yang tidak ada ditolak
    const withField = (field: object) => ({ modules: [{ ...mod, entity: { fields: [field] } }] });
    const v = saved.body.project.version;
    assert.equal((await call('PUT', `/api/builder-projects/${p.id}`, { version: v, config: withField({ name: 'a', type: 'string', rules: ['min:3', 'email', 'pattern:^a'] }) })).status, 200);
    assert.equal((await call('PUT', `/api/builder-projects/${p.id}`, { version: v + 1, config: withField({ name: 'a', type: 'string', rules: ['bogus'] }) })).status, 400);
    assert.equal((await call('PUT', `/api/builder-projects/${p.id}`, { version: v + 1, config: withField({ name: 'a', type: 'string', rules: ['pattern:('] }) })).status, 400);
    assert.equal((await call('PUT', `/api/builder-projects/${p.id}`, { version: v + 1, config: withField({ name: 'r', type: 'relation', relation: { moduleId: 'nope' } }) })).status, 400);
    await call('DELETE', `/api/builder-projects/${p.id}`);
});

test('invalid config, unknown library version and unknown file are rejected', async () => {
    assert.equal((await call('POST', '/api/builder-projects', { name: 'X', fileId: 'nope' })).status, 404);
    const badVersion = await call('POST', '/api/builder-projects', { name: 'X', fileId: appFile, libraryId: dsFile, libraryVersion: '9.9.9' });
    assert.equal(badVersion.status, 400);
    assert.match(badVersion.body.message, /9\.9\.9 belum dipublish/);
    const p = (await call('POST', '/api/builder-projects', { name: 'X', fileId: appFile })).body.project;
    const badName = await call('PUT', `/api/builder-projects/${p.id}`, { version: p.version, config: { modules: [userModule({ name: 'User Management' })] } });
    assert.equal(badName.status, 400);
    assert.match(badName.body.message, /kebab-case/);
    const dup = await call('PUT', `/api/builder-projects/${p.id}`, { version: p.version, config: { modules: [userModule(), userModule({ id: 'x' })] } });
    assert.equal(dup.status, 400);
    assert.equal((await call('GET', '/api/builder-projects/not-a-uuid')).status, 404);
});

test('library bundle upload is served immutable and shown on the project', async () => {
    const missing = await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/versions/1.0.0/bundle/index.js`, headers: { cookie } });
    assert.equal(missing.statusCode, 404);
    const up = await call('PUT', `/api/libraries/${dsFile}/versions/1.0.0/bundle`, { js: 'export const Button = () => null;', css: '.btn{}' });
    assert.equal(up.status, 200);
    assert.match(up.body.bundleUrl, /\/bundle\/index\.js\?h=[0-9a-f]{12}$/);
    const js = await app.inject({ method: 'GET', url: up.body.bundleUrl, headers: { cookie } });
    assert.equal(js.statusCode, 200);
    assert.match(String(js.headers['content-type']), /javascript/);
    assert.match(String(js.headers['cache-control']), /immutable/);
    assert.equal(js.body, 'export const Button = () => null;');
    const css = await app.inject({ method: 'GET', url: up.body.cssUrl, headers: { cookie } });
    assert.equal(css.body, '.btn{}');
    assert.equal((await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/versions/1.0.0/bundle/secret.txt`, headers: { cookie } })).statusCode, 404);
    const p = (await call('POST', '/api/builder-projects', { name: 'With bundle', fileId: appFile, libraryId: dsFile, libraryVersion: '1.0.0' })).body.project;
    assert.equal(p.library.bundleUrl, up.body.bundleUrl);
});
