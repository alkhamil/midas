import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { ensureBucket } from '../src/lib/s3.js';
import { createUser, dropUsers } from './helpers.js';

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
    cookie = (await createUser(app, email, { name: 'Lib Tester' })).cookie;
    for (const id of [dsFile, appFile])
        await call('PUT', `/api/files/${id}`, { name: id, meta: { name: id, pageMeta: [] }, baseVersion: null });
});
after(async () => {
    await dropUsers([email]);
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

/** The files of a ustar tarball, by path. */
function untar(buf: Buffer): Record<string, string> {
    const out: Record<string, string> = {};
    for (let at = 0; at + 512 <= buf.length && buf[at] !== 0;) {
        const name = buf.toString('utf8', at, at + 100).replace(/\0.*$/s, ''), prefix = buf.toString('utf8', at + 345, at + 500).replace(/\0.*$/s, '');
        const size = parseInt(buf.toString('utf8', at + 124, at + 135), 8);
        out[prefix ? `${prefix}/${name}` : name] = buf.toString('utf8', at + 512, at + 512 + size);
        at += 512 + Math.ceil(size / 512) * 512;
    }
    return out;
}

test('a version has a React package: its info, and a tarball of generated and compiled files', async () => {
    const design = {
        components: [
            { id: 'pbtn', name: 'Button', set: true, nodes: [
                { id: 'pbtn', parentId: null, type: 'frame', componentSet: true, name: 'Button', cprops: [{ id: 'cp', name: 'Label', type: 'text', def: 'Button' }] },
                { id: 'pb1', parentId: 'pbtn', type: 'frame', component: true, name: 'Type=Primary', variant: { Type: 'Primary' }, layout: 'horizontal', gap: 8, w: 80, h: 32, fill: '#2563EB', vars: { 'fills.0': 'pv1' } },
                { id: 'pb1t', parentId: 'pb1', type: 'text', name: 'Label', text: 'Button', fontSize: 14, autoW: true, w: 40, h: 20, fill: '#FFFFFF', propBind: { text: 'cp' } },
                { id: 'pb2', parentId: 'pbtn', type: 'frame', component: true, name: 'Type=Secondary', variant: { Type: 'Secondary' }, layout: 'horizontal', gap: 8, w: 80, h: 32, fill: '#F3F4F6' },
                { id: 'pb2t', parentId: 'pb2', type: 'text', name: 'Label', text: 'Button', fontSize: 14, autoW: true, w: 40, h: 20, fill: '#111827', propBind: { text: 'cp' } },
            ] },
            { id: 'pplus', name: 'Outline / Essential / Plus', set: false, nodes: [
                { id: 'pplus', parentId: null, type: 'frame', component: true, name: 'Plus', w: 24, h: 24 },
                { id: 'pplus-v', parentId: 'pplus', type: 'path', name: 'Vector', x: 3, y: 3, w: 18, h: 18, pathW: 18, pathH: 18, closed: true, fill: '#1c274c', points: [{ x: 0, y: 8 }, { x: 18, y: 8 }, { x: 18, y: 10 }, { x: 0, y: 10 }] },
            ] },
        ],
        variables: {
            collections: [{ id: 'pc1', name: 'Semantic', modes: [{ id: 'pm1', name: 'Light' }, { id: 'pm2', name: 'Dark' }] }],
            items: [{ id: 'pv1', name: 'color/primary', type: 'color', collectionId: 'pc1', values: { pm1: '#2563EB', pm2: '#3B82F6' } }],
        },
    };
    const pub = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: design, componentKeys: ['pbtn'] });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const seq = pub.body.library.version;

    const info = await call('GET', `/api/libraries/${dsFile}/package?seq=${seq}`);
    assert.equal(info.status, 200, JSON.stringify(info.body));
    const p = info.body.package;
    assert.equal(p.packageName, '@midas/test-ds');
    assert.equal(p.version, `1.0.${seq}`);
    assert.deepEqual(p.components.map((c: { exportName: string }) => c.exportName), ['Button']);
    assert.deepEqual(p.icons.map((i: { exportName: string }) => i.exportName), ['PlusIcon']);
    assert.deepEqual(p.warnings, []);
    assert.deepEqual(p.components[0].props.map((x: { name: string }) => x.name).sort(), ['label', 'type']);

    const res = await app.inject({ method: 'GET', url: p.downloadUrl, headers: { cookie } });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /gzip/);
    assert.equal(res.headers['content-disposition'], `attachment; filename="midas-test-ds-1.0.${seq}.tgz"`);
    const files = untar(gunzipSync(res.rawPayload));
    assert.equal(JSON.parse(files['package/package.json']).name, '@midas/test-ds');
    for (const f of ['package/src/components/Button.tsx', 'package/src/icons/PlusIcon.ts', 'package/dist/index.js', 'package/dist/index.d.ts', 'package/dist/tokens.css', 'package/dist/styles.css', 'package/dist/tailwind.theme.css', 'package/README.md'])
        assert.ok(f in files, `${f} is in the tarball`);
    assert.match(files['package/dist/index.js'], /function Button\(/);               // compiled: no TSX left
    assert.ok(!/<div/.test(files['package/dist/index.js']), 'the bundle is plain JavaScript');
    assert.match(files['package/dist/index.js'], /PlusIcon/);
    // The stylesheet is compiled by Tailwind for the classes the components use, so a project that installs the package needs no Tailwind
    assert.match(files['package/dist/styles.css'], /@layer midas/);
    assert.match(files['package/dist/styles.css'], /\.mds\\:flex\{display:flex\}/);
    assert.ok(!/@tailwind|@import/.test(files['package/dist/styles.css']), 'compiled CSS, nothing left to compile');
    assert.equal(JSON.parse(files['package/package.json']).exports['./styles.css'], './dist/styles.css');
    assert.match(files['package/dist/tokens.css'], /\[data-theme="dark"\] \{\s*--theme-primary: #3B82F6;/);

    // The second request is served from the stored build, byte for byte.
    const again = await app.inject({ method: 'GET', url: p.downloadUrl, headers: { cookie } });
    assert.ok(again.rawPayload.equals(res.rawPayload));
    assert.equal((await call('GET', `/api/libraries/${dsFile}/package?seq=999`)).status, 404);
    assert.equal((await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/package.tgz` })).statusCode, 401);
});

/** The events of a streamed package build (one JSON object per line). */
const events = (body: string) => body.trim().split('\n').map(l => JSON.parse(l) as { type: string; id?: string; status?: string; step?: string; message?: string; fix?: string; issue?: { level: string; component: string; layer?: string; fix: string }; package?: { fileName: string; downloadUrl: string } });

test('a package build tells every step as it happens, and what to fix when the design has problems', async () => {
    const design = {
        components: [{ id: 'sb', name: 'Panel', set: false, nodes: [
            { id: 'sb', parentId: null, type: 'frame', component: true, name: 'Panel', layout: 'vertical', w: 100, h: 60, fill: '#FFFFFF' },
            { id: 'sb-r', parentId: 'sb', type: 'line', name: 'Decor', w: 10, h: 10, stroke: '#FF0000' },
        ] }],
        variables: { collections: [], items: [{ id: 'sv', name: 'color/x', type: 'color', collectionId: 'sc', values: { sm: '#000' } }] },
    };
    const pub = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: design, componentKeys: ['sb'] });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const res = await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/package/build?seq=${pub.body.library.version}`, headers: { cookie } });
    assert.equal(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /x-ndjson/);
    const ev = events(res.body);
    const steps = ev.filter(e => e.type === 'step' && e.status === 'done').map(e => e.id);
    assert.deepEqual(steps, ['load', 'read', 'components', 'tokens', 'bundle', 'styles', 'pack', 'save']);   // each step reports when it is done
    assert.ok(ev.some(e => e.type === 'step' && e.id === 'components' && e.status === 'running'));
    const loose = ev.find(e => e.type === 'issue' && /Decor/.test(e.issue?.layer ?? ''));
    assert.equal(loose?.issue?.component, 'Panel');                                                 // which component and which layer
    assert.match(loose?.issue?.fix ?? '', /component/);                                             // and what to do about it
    assert.equal(ev.at(-1)?.type, 'done');
    assert.match(ev.at(-1)?.package?.downloadUrl ?? '', /package\.tgz/);
    // Built once: a second run answers from the stored package, still with the issues.
    const again = events((await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/package/build?seq=${pub.body.library.version}`, headers: { cookie } })).body);
    assert.ok(again.some(e => e.type === 'step' && e.id === 'load' && e.detail === 'already built'));
    assert.ok(again.some(e => e.type === 'issue'));
    assert.equal(again.at(-1)?.type, 'done');
    assert.equal((await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/package/build?seq=999`, headers: { cookie } })).statusCode, 404);
});

test('a build that cannot finish ends with an error event: which step, what happened, what to do', async () => {
    // The component's root layer is missing from its nodes: the design cannot be read as a component.
    const broken = { components: [{ id: 'ghost', name: 'Ghost', set: false, nodes: [{ id: 'other', parentId: null, type: 'frame', name: 'Other' }] }], variables: { collections: [], items: [] } };
    const pub = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Test DS', snapshot: broken, componentKeys: ['ghost'] });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const ev = events((await app.inject({ method: 'GET', url: `/api/libraries/${dsFile}/package/build?seq=${pub.body.library.version}`, headers: { cookie } })).body);
    const last = ev.at(-1)!;
    assert.equal(last.type, 'error');
    assert.ok(last.step && last.message && last.fix, JSON.stringify(last));
    assert.match(last.message ?? '', /could not be turned into code/);
    assert.ok(!ev.some(e => e.type === 'done'));
});

test('the server is an npm registry for its packages: packument, tarball, and a token to read them', async () => {
    const design = { components: [button()], variables: { collections: [], items: [{ id: 'v1' }] } };
    const pub = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Registry DS', snapshot: design, componentKeys: ['btn'] });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const seq = pub.body.library.version;
    const token = (await call('POST', '/api/tokens', { name: 'npm' })).body.token as string;
    const get = (url: string, auth?: string) => app.inject({ method: 'GET', url, headers: auth ? { authorization: auth } : {}, });
    assert.equal((await get('/api/registry/@midas%2fregistry-ds')).statusCode, 401);                               // no token, no package
    assert.equal((await get('/api/registry/@midas%2fregistry-ds', 'Bearer mdt_wrong')).statusCode, 401);
    const doc = await get('/api/registry/@midas%2fregistry-ds', `Bearer ${token}`);                                // the way npm asks
    assert.equal(doc.statusCode, 200, doc.body);
    const packument = doc.json();
    assert.equal(packument.name, '@midas/registry-ds');
    assert.equal(packument['dist-tags'].latest, `1.0.${seq}`);
    const v = packument.versions[`1.0.${seq}`];
    assert.match(v.dist.tarball, new RegExp(`/api/registry/@midas/registry-ds/-/midas-registry-ds-1\\.0\\.${seq}\\.tgz$`));
    assert.match(v.dist.integrity, /^sha512-/);
    assert.deepEqual(v.peerDependencies, { react: '>=18', 'react-dom': '>=18' });                                  // so npm installs the peers right
    const tar = await get(new URL(v.dist.tarball).pathname, `Bearer ${token}`);                                   // and the tarball it points to
    assert.equal(tar.statusCode, 200);
    assert.equal(createHash('sha1').update(tar.rawPayload).digest('hex'), v.dist.shasum);
    assert.equal((await get('/api/registry/@midas/registry-ds', `Bearer ${token}`)).statusCode, 200);             // unencoded path works too
    assert.equal((await get('/api/registry/@midas%2fnope', `Bearer ${token}`)).statusCode, 404);
    assert.equal((await get(`/api/registry/@midas/registry-ds/-/midas-registry-ds-1.0.999.tgz`, `Bearer ${token}`)).statusCode, 404);
});

test('a published library has a documentation site: private to the workspace until it is made public', async () => {
    const withDoc = { ...button(), doc: { category: 'Action', status: 'Stable', description: 'A button for actions.', dos: ['Use one primary button.'], donts: ['Do not nest buttons.'], a11y: ['Use a real button element.'] } };
    const design = { components: [withDoc], variables: { collections: [], items: [{ id: 'v1' }] } };
    const pub = await call('POST', `/api/libraries/${dsFile}/versions`, { name: 'Docs DS', releaseNotes: 'Faster tables\n- New Stepper\n- <b>Fix</b>', snapshot: design, componentKeys: ['btn'] });
    assert.equal(pub.status, 200, JSON.stringify(pub.body));
    const seq = pub.body.library.version;
    const get = (url: string, cookieHeader?: string) => app.inject({ method: 'GET', url, headers: cookieHeader ? { cookie: cookieHeader } : {} });
    assert.equal((await get('/docs/docs-ds')).statusCode, 401);                                                   // private: an anonymous reader is turned away
    assert.equal((await get('/docs/nope')).statusCode, 404);
    const home = await get('/docs/docs-ds', cookie);
    assert.equal(home.statusCode, 200, home.body);
    assert.match(home.body, /npm install @midas\/docs-ds/);
    assert.match(home.body, /api\/registry\//);
    const comp = await get('/docs/docs-ds/components/button', cookie);
    assert.equal(comp.statusCode, 200);
    assert.match(comp.body, /A button for actions\./);                                                              // what the design's Documentation frame says
    assert.match(comp.body, /Use one primary button\./);
    assert.match(comp.body, /Do not nest buttons\./);
    assert.match(comp.body, /<code>type<\/code>/);                                                                 // the props table
    const versions = await get('/docs/docs-ds/versions', cookie);
    assert.match(versions.body, /Faster tables/);
    assert.match(versions.body, /<li>New Stepper<\/li>/);
    assert.ok(!versions.body.includes('<b>Fix</b>'), 'release notes are escaped');
    assert.equal((await get(`/docs/docs-ds?v=${seq}`, cookie)).statusCode, 200);
    const preview = await get('/docs/docs-ds/_/preview.js', cookie);                                                // React and the package, to run the live preview
    assert.equal(preview.statusCode, 200);
    assert.match(String(preview.headers['content-type']), /javascript/);
    assert.match(preview.body, /__midas/);
    assert.match((await get('/docs/docs-ds/_/styles.css', cookie)).body, /@layer midas/);

    const on = await call('PUT', `/api/libraries/${dsFile}/docs`, { public: true });
    assert.equal(on.status, 200, JSON.stringify(on.body));
    assert.equal((await get('/docs/docs-ds')).statusCode, 200);                                                   // public: no sign-in
    assert.equal((await get('/docs/docs-ds/_/preview.js')).statusCode, 200);
    assert.equal((await get('/api/registry/@midas%2fdocs-ds')).statusCode, 401);                                  // the package itself still needs a token
    assert.equal((await call('PUT', `/api/libraries/${dsFile}/docs`, { public: false })).status, 200);
    assert.equal((await get('/docs/docs-ds')).statusCode, 401);
    assert.equal((await call('PUT', `/api/libraries/${dsFile}/docs`, { public: 'yes' })).status, 400);
});

test('unpublish removes the library but not the file', async () => {
    assert.equal((await call('DELETE', `/api/libraries/${dsFile}`)).status, 200);
    assert.equal((await call('GET', `/api/libraries/${dsFile}`)).status, 404);
    assert.equal((await call('GET', `/api/files/${dsFile}`)).status, 200);
});
