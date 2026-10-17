import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { ensureBucket } from '../src/lib/s3.js';
import { breakingChanges, deriveMapping } from '../src/lib/library.js';

let app: FastifyInstance;
let cookie = '';
const stamp = Date.now();
const email = `lib-${stamp}@midas.local`;
const dsFile = `ds-${stamp}`;
const appFile = `app-${stamp}`;
const pkg = `@midas/ui-test-${stamp}`;

async function call(method: string, url: string, payload?: unknown) {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as string, headers: { cookie } });
    return { status: res.statusCode, body: res.json() };
}

// Button: component set dengan variant Type=Primary|Secondary + component property text "Label".
const button = (types = ['Primary', 'Secondary']) => ({
    id: 'btn', name: 'Button', set: true,
    nodes: [
        { id: 'btn', parentId: null, componentSet: true, name: 'Button', cprops: [{ id: 'cp-label', name: 'Label', type: 'text' }, { id: 'cp-icon', name: 'Show icon', type: 'boolean' }] },
        ...types.map(t => ({ id: `btn-${t}`, parentId: 'btn', component: true, variant: { Type: t, Size: 'md' } })),
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

test('deriveMapping turns variants and component properties into props', () => {
    const m = deriveMapping(button());
    assert.equal(m.exportName, 'Button');
    const byName = Object.fromEntries(m.propsMap.props.map(p => [p.name, p]));
    assert.deepEqual(byName.type.values, { Primary: 'primary', Secondary: 'secondary' });
    assert.equal(byName.size.type, 'enum');
    assert.equal(byName.label.type, 'string');
    assert.equal(byName.showIcon.type, 'boolean');
});

test('draft suggests package name, version 1.0.0 and default mappings', async () => {
    const d = await call('POST', `/api/libraries/${dsFile}/draft`, { name: 'Test DS', snapshot: snapshot() });
    assert.equal(d.status, 200);
    assert.equal(d.body.library, null);
    assert.equal(d.body.suggestedVersion, '1.0.0');
    assert.match(d.body.packageName, /^@midas\/ui-test-ds/);
    assert.equal(d.body.mappings[0].exportName, 'Button');
});

test('publish first version, then the package name is locked', async () => {
    const d = await call('POST', `/api/libraries/${dsFile}/draft`, { snapshot: snapshot() });
    const bad = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: 'Bad Name', version: '1.0.0', snapshot: snapshot(), mappings: d.body.mappings });
    assert.equal(bad.status, 400);
    const ok = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: pkg, version: '1.0.0', snapshot: snapshot(), mappings: d.body.mappings });
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.library.version, 1);
    const locked = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: '@midas/other', version: '1.1.0', snapshot: snapshot(), mappings: d.body.mappings });
    assert.equal(locked.status, 400);
    assert.match(locked.body.errors.join(), /terkunci/);
    const avail = await call('GET', `/api/libraries/package-available?name=${encodeURIComponent(pkg)}`);
    assert.equal(avail.body.available, false);
});

test('version must increase; removing a variant value requires a major bump', async () => {
    const d = await call('POST', `/api/libraries/${dsFile}/draft`, { snapshot: snapshot(['Primary']) });
    assert.equal(d.body.suggestedVersion, '2.0.0');
    assert.ok(d.body.breaking.some((b: string) => b.includes('secondary')));
    const same = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: pkg, version: '1.0.0', snapshot: snapshot(['Primary']), mappings: d.body.mappings });
    assert.equal(same.status, 400);
    const minor = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: pkg, version: '1.1.0', snapshot: snapshot(['Primary']), mappings: d.body.mappings });
    assert.equal(minor.status, 400);
    assert.match(minor.body.errors.join(), /minimal 2\.0\.0/);
    const major = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: pkg, version: '2.0.0', snapshot: snapshot(['Primary']), mappings: d.body.mappings });
    assert.equal(major.status, 200);
    assert.equal(major.body.library.version, 2);
});

test('invalid export names are rejected', async () => {
    const d = await call('POST', `/api/libraries/${dsFile}/draft`, { snapshot: snapshot(['Primary']) });
    d.body.mappings[0].exportName = 'button';
    const res = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', packageName: pkg, version: '2.1.0', snapshot: snapshot(['Primary']), mappings: d.body.mappings });
    assert.equal(res.status, 400);
    assert.match(res.body.errors.join(), /PascalCase/);
});

test('list, snapshot and history are visible in the workspace', async () => {
    const list = await call('GET', '/api/libraries');
    const lib = list.body.libraries.find((l: { id: string }) => l.id === dsFile);
    assert.equal(lib.semver, '2.0.0');
    assert.equal(lib.packageName, pkg);
    const snap = await call('GET', `/api/libraries/${dsFile}/snapshot`);
    assert.equal(snap.body.version, 2);
    assert.equal(snap.body.components[0].nodes.length, 2);
    const old = await call('GET', `/api/libraries/${dsFile}/snapshot?seq=1`);
    assert.equal(old.body.components[0].nodes.length, 3);
    const hist = await call('GET', `/api/libraries/${dsFile}`);
    assert.deepEqual(hist.body.versions.map((v: { version: string }) => v.version), ['2.0.0', '1.0.0']);
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
    const list = await call('GET', '/api/libraries');
    const lib = list.body.libraries.find((l: { id: string }) => l.id === legacyFile);
    assert.equal(lib.version, 3);
    assert.match(lib.packageName, /^@midas\/ui-old-ds/);
});

test('breakingChanges reports renamed exports', () => {
    const a = deriveMapping(button());
    assert.deepEqual(breakingChanges([a], [{ ...a, exportName: 'Btn' }]), ['Komponen Button diganti nama menjadi Btn']);
});
