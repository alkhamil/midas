import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { sql } from '../src/db/index.js';
import { ensureBucket } from '../src/lib/s3.js';
import { createUser, dropUsers, PASSWORD } from './helpers.js';

let app: FastifyInstance;
const stamp = Date.now();
const adminEmail = `mcp-admin-${stamp}@midas.local`, scopedEmail = `mcp-scoped-${stamp}@midas.local`;
let adminCookie = '', adminId = '', workspaceId = '', adminToken = '', scopedToken = '';

const api = (cookie: string) => async (method: string, url: string, payload?: unknown) => {
    const res = await app.inject({ method: method as 'GET', url, payload: payload as string, headers: { cookie } });
    return { status: res.statusCode, body: res.body ? res.json() : null };
};
let admin: ReturnType<typeof api>;
const rpc = async (token: string | null, method: string, params?: unknown, id: number | null = 1) => {
    const res = await app.inject({ method: 'POST', url: '/mcp', payload: { jsonrpc: '2.0', ...(id === null ? {} : { id }), method, params } as never, headers: token ? { authorization: `Bearer ${token}` } : {} });
    return { status: res.statusCode, body: res.body ? res.json() : null };
};
const call = async (token: string, name: string, args: unknown = {}) => {
    const r = await rpc(token, 'tools/call', { name, arguments: args });
    const result = r.body.result;
    return { isError: !!result.isError, data: result.isError ? result.content[0].text : JSON.parse(result.content[0].text) };
};

const node = (id: string, name: string, parentId: string | null, extra: object = {}) => ({ id, name, parentId, type: 'frame', x: 0, y: 0, w: 100, h: 50, fill: 'none', visible: true, ...extra });
const page = { id: 'p1', name: 'Login', nodes: [
    node('f1', 'Login', null, { w: 480, h: 360, fill: '#F2F4F7', layout: 'vertical', gap: 8, padT: 4, padR: 4, padB: 4, padL: 4 }),
    node('t1', 'Title', 'f1', { type: 'text', text: 'Welcome back', fontSize: 24, fontFamily: 'Inter', fontWeight: 600, fill: '#101828' }),
    node('b1', 'Sign in', 'f1', { fill: '#0B5CAD', radius: 8 }),
    node('t2', 'Label', 'b1', { type: 'text', text: 'Sign in', fontSize: 16, fill: '#fff' }),
    node('set', 'Button', null, { componentSet: true, cprops: [{ id: 'c1', name: 'Label', type: 'text' }] }),
    node('v1', 'Type=Primary', 'set', { component: true, variant: { Type: 'Primary' } }),
    node('v2', 'Type=Secondary', 'set', { component: true, variant: { Type: 'Secondary' } }),
] };
const vars = { collections: [{ id: 'c', name: 'Color', modes: [{ id: 'm1', name: 'Light' }, { id: 'm2', name: 'Dark' }] }], items: [{ id: 'i1', collectionId: 'c', name: 'bg/primary', type: 'color', values: { m1: '#ffffff', m2: '#000000' } }] };

before(async () => {
    process.env.LOG_LEVEL = 'silent';
    await ensureBucket();
    app = await buildApp();
    const u = await createUser(app, adminEmail);
    adminCookie = u.cookie; adminId = u.id; workspaceId = u.workspaceId;
    admin = api(adminCookie);
    await admin('POST', '/api/files/import', { id: `mcp-open-${stamp}`, data: { name: 'Open design', pageId: 'p1', pages: [page], variables: vars, assets: {}, tokens: {} } });
    await admin('POST', '/api/files/import', { id: `mcp-closed-${stamp}`, data: { name: 'Closed design', pageId: 'p1', pages: [page], variables: vars, assets: {}, tokens: {} } });
    const made = await admin('POST', '/api/users', { email: scopedEmail, name: 'Scoped', password: PASSWORD, role: 'editor', accessMode: 'selected', access: [{ kind: 'file', id: `mcp-open-${stamp}` }] });
    assert.equal(made.status, 200);
    adminToken = (await admin('POST', '/api/tokens', { name: 'Claude' })).body.token;
    const scoped = api(await (await import('./helpers.js')).login(app, scopedEmail));
    scopedToken = (await scoped('POST', '/api/tokens', { name: 'Scoped agent' })).body.token;
});
after(async () => {
    await dropUsers([adminEmail, scopedEmail]);
    await app.close();
    await sql.end();
});

test('tokens: shown once, listed by prefix, never in the clear', async () => {
    assert.match(adminToken, /^mdt_/);
    const list = (await admin('GET', '/api/tokens')).body.tokens;
    assert.equal(list.length, 1);
    assert.equal(list[0].prefix, adminToken.slice(0, 8));
    assert.equal(JSON.stringify(list).includes(adminToken), false);
    const [row] = await sql`select token_hash from api_tokens where user_id = ${adminId}`;
    assert.notEqual(row.token_hash, adminToken);
});

test('/mcp needs a valid token and speaks JSON-RPC', async () => {
    assert.equal((await rpc(null, 'ping')).status, 401);
    assert.equal((await rpc('mdt_wrong', 'ping')).status, 401);
    const init = await rpc(adminToken, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } });
    assert.equal(init.body.result.serverInfo.name, 'midas');
    assert.equal(init.body.result.protocolVersion, '2025-03-26');
    assert.equal((await rpc(adminToken, 'notifications/initialized', undefined, null)).status, 202);
    const list = (await rpc(adminToken, 'tools/list')).body.result.tools.map((t: { name: string }) => t.name);
    assert.deepEqual(list.sort(), ['find_layers', 'get_file', 'get_layer', 'get_page', 'get_variables', 'list_components', 'list_files', 'list_folders']);
    assert.equal((await rpc(adminToken, 'nope')).body.error.code, -32601);
    assert.equal((await app.inject({ method: 'GET', url: '/mcp' })).statusCode, 405);
});

test('read tools describe the design', async () => {
    const fid = `mcp-open-${stamp}`;
    assert.equal((await call(adminToken, 'list_files', { query: 'open' })).data.files.length, 1);
    const file = (await call(adminToken, 'get_file', { file_id: fid })).data;
    assert.equal(file.pages[0].frames[0].name, 'Login');
    assert.equal(file.variables.count, 1);
    const pg = (await call(adminToken, 'get_page', { file_id: fid, page_id: 'p1', depth: 3 })).data;
    const login = pg.tree.find((n: { id: string }) => n.id === 'f1');
    assert.equal(login.children.length, 2);
    assert.equal(login.children[0].text, 'Welcome back');
    const cut = (await call(adminToken, 'get_page', { file_id: fid, page_id: 'p1', depth: 0 })).data;
    assert.equal(cut.truncated, true);
    assert.equal(cut.tree.find((n: { id: string }) => n.id === 'f1').childCount, 2);
    const layer = (await call(adminToken, 'get_layer', { file_id: fid, layer_id: 't2' })).data;
    assert.deepEqual(layer.path, ['Login', 'Sign in']);
    assert.equal(layer.layer.text, 'Sign in');
    const found = (await call(adminToken, 'find_layers', { file_id: fid, query: 'welcome' })).data;
    assert.equal(found.count, 1);
    assert.equal(found.layers[0].path, 'Login');
    const comps = (await call(adminToken, 'list_components', { file_id: fid })).data.components;
    assert.deepEqual(comps[0].variantProperties, { Type: ['Primary', 'Secondary'] });
    const v = (await call(adminToken, 'get_variables', { file_id: fid })).data;
    assert.deepEqual(v.variables[0].values, { Light: '#ffffff', Dark: '#000000' });
});

test('an agent only sees what its owner can open', async () => {
    const files = (await call(scopedToken, 'list_files')).data.files.map((f: { id: string }) => f.id);
    assert.deepEqual(files, [`mcp-open-${stamp}`]);
    const denied = await call(scopedToken, 'get_file', { file_id: `mcp-closed-${stamp}` });
    assert.equal(denied.isError, true);
    assert.match(denied.data, /cannot open it/);
});

test('revoking a token or turning the user off stops the agent', async () => {
    const [t] = (await admin('GET', '/api/tokens')).body.tokens;
    assert.equal((await rpc(adminToken, 'ping')).status, 200);
    assert.equal((await admin('DELETE', `/api/tokens/${t.id}`)).status, 200);
    assert.equal((await rpc(adminToken, 'ping')).status, 401);
    const scopedUser = (await admin('GET', '/api/users')).body.users.find((u: { email: string }) => u.email === scopedEmail);
    assert.equal((await rpc(scopedToken, 'ping')).status, 200);
    await admin('PATCH', `/api/users/${scopedUser.id}`, { active: false });
    assert.equal((await rpc(scopedToken, 'ping')).status, 401);
    void workspaceId;
});
