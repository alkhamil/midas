// Midas as an MCP server (Model Context Protocol, Streamable HTTP, stateless): AI agents read designs through tools.
// Auth: a personal API token (Authorization: Bearer mdt_…). The agent acts as the token's owner and only reads:
// it sees exactly the files that user can open (role and file scope apply).
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { designFilePages, designFiles, designFolders } from '../db/schema.js';
import { canSeeFile, userFromToken, type AuthUser } from '../lib/auth.js';

type Json = Record<string, unknown>;
type Node = Json & { id: string; name: string; type: string; parentId?: string | null; text?: string };

const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_TEXT = 90_000;

class ToolError extends Error { }

async function openFile(user: AuthUser, id: unknown) {
    if (typeof id !== 'string' || !id)
        throw new ToolError('file_id is required (see list_files)');
    const [f] = await db.select().from(designFiles).where(and(eq(designFiles.id, id), eq(designFiles.workspaceId, user.workspaceId), isNull(designFiles.deletedAt))).limit(1);
    if (!f || !canSeeFile(user, f))
        throw new ToolError(`File ${id} was not found, or this account cannot open it`);
    return f;
}
const pagesOf = (fileId: string) => db.select().from(designFilePages).where(eq(designFilePages.fileId, fileId));

/** A layer reduced to what an agent needs to understand the design. */
function brief(n: Node): Json {
    const out: Json = { id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, w: n.w, h: n.h };
    if (n.visible === false) out.hidden = true;
    if (n.type === 'text') Object.assign(out, { text: n.text, fontSize: n.fontSize, fontFamily: n.fontFamily, fontWeight: n.fontWeight, color: n.fill });
    else if (n.fill && n.fill !== 'none') out.fill = n.fill;
    if (n.strokeWidth && n.stroke) Object.assign(out, { stroke: n.stroke, strokeWidth: n.strokeWidth });
    if (n.radius) out.radius = n.radius;
    if (n.layout) Object.assign(out, { layout: n.layout, gap: n.gap, padding: [n.padT, n.padR, n.padB, n.padL] });
    if (n.componentSet) out.componentSet = true;
    else if (n.component) out.component = true;
    if (n.isInstance) out.instanceOf = n.sourceId;
    if (n.variant) out.variant = n.variant;
    return out;
}

function tree(nodes: Node[], rootIds: string[], depth: number, budget: { left: number; cut: boolean }): Json[] {
    const kids = new Map<string, Node[]>();
    for (const n of nodes)
        if (n.parentId)
            (kids.get(n.parentId) ?? kids.set(n.parentId, []).get(n.parentId)!).push(n);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const walk = (n: Node, d: number): Json => {
        budget.left--;
        const out = brief(n), list = kids.get(n.id) ?? [];
        if (!list.length)
            return out;
        if (d >= depth || budget.left <= 0) {
            out.childCount = list.length;
            budget.cut = true;
            return out;
        }
        out.children = list.filter(() => budget.left > 0).map(c => walk(c, d + 1));
        if ((out.children as Json[]).length < list.length) { out.childCount = list.length; budget.cut = true; }
        return out;
    };
    return rootIds.map(id => byId.get(id)).filter((n): n is Node => !!n).map(n => walk(n, 0));
}

const asNum = (v: unknown, d: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : d);

interface Tool { name: string; description: string; inputSchema: Json; run: (user: AuthUser, args: Json) => Promise<unknown> }
const idProp = { file_id: { type: 'string', description: 'File id from list_files' } };

const TOOLS: Tool[] = [
    {
        name: 'list_files',
        description: 'List the design files this account can open (newest first). Optionally filter by name.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Part of the file name' }, limit: { type: 'number', description: 'Default 50, max 200' } } },
        async run(user, a) {
            const q = typeof a.query === 'string' ? a.query.trim().toLowerCase() : '';
            const rows = (await db.select().from(designFiles).where(and(eq(designFiles.workspaceId, user.workspaceId), isNull(designFiles.deletedAt), isNull(designFiles.trashedAt))))
                .filter(f => canSeeFile(user, f) && (!q || f.name.toLowerCase().includes(q)))
                .sort((x, y) => y.updatedAt.getTime() - x.updatedAt.getTime()).slice(0, asNum(a.limit, 50, 1, 200));
            return { files: rows.map(f => ({ id: f.id, name: f.name, folderId: f.folderId, updated: f.updatedAt.toISOString() })) };
        },
    },
    {
        name: 'list_folders',
        description: 'List the folders this account can open, as a flat list with parent ids.',
        inputSchema: { type: 'object', properties: {} },
        async run(user) {
            const all = await db.select().from(designFolders).where(eq(designFolders.workspaceId, user.workspaceId));
            const rows = user.role === 'admin' || user.accessMode === 'all' ? all : all.filter(f => user.grants.folders.has(f.id));
            return { folders: rows.map(f => ({ id: f.id, name: f.name, parentId: f.parentId })) };
        },
    },
    {
        name: 'get_file',
        description: 'Overview of one design file: its pages (with the top-level frames of each) and a summary of its variables.',
        inputSchema: { type: 'object', properties: idProp, required: ['file_id'] },
        async run(user, a) {
            const f = await openFile(user, a.file_id);
            const pages = await pagesOf(f.id), meta = f.meta as { pageMeta?: { id: string; name: string; parentId?: string | null }[]; variables?: { collections?: { name: string; modes: unknown[] }[]; items?: unknown[] } };
            const order = new Map((meta.pageMeta ?? []).map((p, i) => [p.id, i]));
            return {
                id: f.id, name: f.name, updated: f.updatedAt.toISOString(),
                pages: pages.sort((x, y) => (order.get(x.pageId) ?? 0) - (order.get(y.pageId) ?? 0)).map(p => {
                    const nodes = (p.data as { nodes?: Node[] }).nodes ?? [];
                    return { id: p.pageId, name: p.name, parentId: p.parentId, layers: nodes.length, frames: nodes.filter(n => n.type === 'frame' && !n.parentId).map(n => ({ id: n.id, name: n.name, w: n.w, h: n.h })) };
                }),
                variables: { collections: (meta.variables?.collections ?? []).map(c => ({ name: c.name, modes: c.modes.length })), count: meta.variables?.items?.length ?? 0 },
            };
        },
    },
    {
        name: 'get_page',
        description: 'The layer tree of one page (or of one layer inside it). Large trees are cut: raise depth or ask for a sub-tree with layer_id.',
        inputSchema: { type: 'object', properties: { ...idProp, page_id: { type: 'string' }, layer_id: { type: 'string', description: 'Start from this layer instead of the page roots' }, depth: { type: 'number', description: 'Default 3, max 12' }, max_layers: { type: 'number', description: 'Default 400, max 3000' } }, required: ['file_id', 'page_id'] },
        async run(user, a) {
            const f = await openFile(user, a.file_id);
            const page = (await pagesOf(f.id)).find(p => p.pageId === a.page_id);
            if (!page)
                throw new ToolError(`Page ${String(a.page_id)} not found (see get_file)`);
            const nodes = (page.data as { nodes?: Node[] }).nodes ?? [];
            const roots = typeof a.layer_id === 'string' ? [a.layer_id] : nodes.filter(n => !n.parentId).map(n => n.id);
            if (typeof a.layer_id === 'string' && !nodes.some(n => n.id === a.layer_id))
                throw new ToolError(`Layer ${a.layer_id} is not on this page`);
            const budget = { left: asNum(a.max_layers, 400, 1, 3000), cut: false };
            const layers = tree(nodes, roots, asNum(a.depth, 3, 0, 12), budget);
            return { page: { id: page.pageId, name: page.name, layers: nodes.length }, tree: layers, ...(budget.cut ? { truncated: true, hint: 'Some branches were cut (childCount shows how many layers they hold). Use layer_id or depth.' } : {}) };
        },
    },
    {
        name: 'get_layer',
        description: 'Every property of one layer (as stored), its path from the page root and its direct children.',
        inputSchema: { type: 'object', properties: { ...idProp, layer_id: { type: 'string' } }, required: ['file_id', 'layer_id'] },
        async run(user, a) {
            const f = await openFile(user, a.file_id);
            for (const p of await pagesOf(f.id)) {
                const nodes = (p.data as { nodes?: Node[] }).nodes ?? [], n = nodes.find(x => x.id === a.layer_id);
                if (!n)
                    continue;
                const by = new Map(nodes.map(x => [x.id, x])), path: string[] = [];
                for (let c = by.get(n.parentId ?? ''); c; c = by.get(c.parentId ?? ''))
                    path.unshift(c.name);
                const { overrides: _o, ...props } = n as Json;
                return { page: { id: p.pageId, name: p.name }, path, layer: props, children: nodes.filter(x => x.parentId === n.id).map(brief) };
            }
            throw new ToolError(`Layer ${String(a.layer_id)} was not found in this file`);
        },
    },
    {
        name: 'find_layers',
        description: 'Search layers by name or text content, in one page or the whole file.',
        inputSchema: { type: 'object', properties: { ...idProp, query: { type: 'string' }, type: { type: 'string', description: 'frame, text, rect, ellipse, image, path, line, group …' }, page_id: { type: 'string' }, limit: { type: 'number', description: 'Default 50, max 200' } }, required: ['file_id', 'query'] },
        async run(user, a) {
            const f = await openFile(user, a.file_id), q = String(a.query ?? '').toLowerCase(), max = asNum(a.limit, 50, 1, 200), hits: Json[] = [];
            for (const p of await pagesOf(f.id)) {
                if (typeof a.page_id === 'string' && p.pageId !== a.page_id)
                    continue;
                const nodes = (p.data as { nodes?: Node[] }).nodes ?? [], by = new Map(nodes.map(x => [x.id, x]));
                for (const n of nodes) {
                    if (hits.length >= max)
                        break;
                    if ((typeof a.type === 'string' && n.type !== a.type) || !`${n.name}\n${n.text ?? ''}`.toLowerCase().includes(q))
                        continue;
                    const path: string[] = [];
                    for (let c = by.get(n.parentId ?? ''); c; c = by.get(c.parentId ?? ''))
                        path.unshift(c.name);
                    hits.push({ ...brief(n), page: { id: p.pageId, name: p.name }, path: path.join(' / ') });
                }
            }
            return { count: hits.length, layers: hits };
        },
    },
    {
        name: 'list_components',
        description: 'Components defined in the file: component sets (with their variant properties) and single components.',
        inputSchema: { type: 'object', properties: idProp, required: ['file_id'] },
        async run(user, a) {
            const f = await openFile(user, a.file_id), out: Json[] = [];
            for (const p of await pagesOf(f.id)) {
                const nodes = (p.data as { nodes?: Node[] }).nodes ?? [];
                for (const n of nodes) {
                    if (n.componentSet) {
                        const variants = nodes.filter(v => v.parentId === n.id && v.component);
                        const props: Record<string, Set<string>> = {};
                        for (const v of variants)
                            for (const [k, val] of Object.entries((v.variant ?? {}) as Record<string, string>))
                                (props[k] ??= new Set()).add(val);
                        out.push({ id: n.id, name: n.name, kind: 'set', page: p.name, variants: variants.length, variantProperties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, [...v]])), properties: ((n.cprops as { name: string; type: string }[] | undefined) ?? []).map(c => `${c.name} (${c.type})`) });
                    }
                    else if (n.component && !nodes.find(s => s.id === n.parentId)?.componentSet)
                        out.push({ id: n.id, name: n.name, kind: 'component', page: p.name, properties: ((n.cprops as { name: string; type: string }[] | undefined) ?? []).map(c => `${c.name} (${c.type})`) });
                }
            }
            return { count: out.length, components: out };
        },
    },
    {
        name: 'get_variables',
        description: 'Design variables (tokens): collections with their modes, and variables with their value in each mode.',
        inputSchema: { type: 'object', properties: { ...idProp, collection: { type: 'string', description: 'Only this collection (name)' }, query: { type: 'string', description: 'Part of a variable name' }, limit: { type: 'number', description: 'Default 200, max 1000' } }, required: ['file_id'] },
        async run(user, a) {
            const f = await openFile(user, a.file_id);
            const v = ((f.meta as Json).variables ?? { collections: [], items: [] }) as { collections: { id: string; name: string; modes: { id: string; name: string }[] }[]; items: { collectionId: string; name: string; type: string; values: Record<string, unknown> }[] };
            const cols = v.collections.filter(c => typeof a.collection !== 'string' || c.name === a.collection), ids = new Set(cols.map(c => c.id)), q = typeof a.query === 'string' ? a.query.toLowerCase() : '';
            const items = v.items.filter(i => ids.has(i.collectionId) && (!q || i.name.toLowerCase().includes(q))).slice(0, asNum(a.limit, 200, 1, 1000));
            const col = new Map(cols.map(c => [c.id, c]));
            return {
                collections: cols.map(c => ({ name: c.name, modes: c.modes.map(m => m.name) })),
                variables: items.map(i => { const c = col.get(i.collectionId)!; return { collection: c.name, name: i.name, type: i.type, values: Object.fromEntries(c.modes.map(m => [m.name, i.values[m.id]])) }; }),
            };
        },
    },
];

const INSTRUCTIONS = 'Midas design files, read-only. Start with list_files, then get_file for the pages, get_page for the layer tree, get_layer for one layer\'s details, find_layers to search, list_components and get_variables for the design system. Sizes are in pixels; colors are hex.';

async function handle(user: AuthUser, msg: Json): Promise<Json | null> {
    const id = msg.id as string | number | undefined, method = String(msg.method ?? '');
    const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (id === undefined)
        return null; // notifications (e.g. notifications/initialized) get no reply
    if (method === 'initialize') {
        const asked = String((msg.params as Json | undefined)?.protocolVersion ?? '');
        return ok({ protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: 'midas', version: '0.1.0' }, instructions: INSTRUCTIONS });
    }
    if (method === 'ping')
        return ok({});
    if (method === 'tools/list')
        return ok({ tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema, annotations: { readOnlyHint: true } })) });
    if (method === 'resources/list')
        return ok({ resources: [] });
    if (method === 'prompts/list')
        return ok({ prompts: [] });
    if (method === 'tools/call') {
        const p = (msg.params ?? {}) as { name?: string; arguments?: Json }, tool = TOOLS.find(t => t.name === p.name);
        if (!tool)
            return fail(-32602, `Unknown tool: ${String(p.name)}`);
        try {
            let text = JSON.stringify(await tool.run(user, p.arguments ?? {}), null, 1);
            if (text.length > MAX_TEXT)
                text = `${text.slice(0, MAX_TEXT)}\n… (cut: the answer was too long; narrow it down with layer_id, depth, limit or query)`;
            return ok({ content: [{ type: 'text', text }] });
        }
        catch (e) {
            if (e instanceof ToolError)
                return ok({ content: [{ type: 'text', text: e.message }], isError: true });
            throw e;
        }
    }
    return fail(-32601, `Method not found: ${method}`);
}

export async function mcpRoutes(app: FastifyInstance) {
    app.post('/mcp', async (req, reply) => {
        const user = await userFromToken(req.headers.authorization);
        if (!user)
            return reply.code(401).header('www-authenticate', 'Bearer realm="midas"').send({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Send a valid API token: Authorization: Bearer mdt_…' } });
        const body = req.body as Json | Json[] | undefined;
        if (!body || typeof body !== 'object')
            return reply.code(400).send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        try {
            const replies = (await Promise.all((Array.isArray(body) ? body : [body]).map(m => handle(user, m)))).filter((r): r is Json => r !== null);
            if (!replies.length)
                return reply.code(202).send();
            return Array.isArray(body) ? replies : replies[0];
        }
        catch (e) {
            req.log.error(e);
            return reply.code(500).send({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error' } });
        }
    });
    // Stateless server: no server-initiated stream and no sessions to close.
    app.get('/mcp', async (_req, reply) => reply.code(405).header('allow', 'POST').send({ error: 'method_not_allowed' }));
    app.delete('/mcp', async (_req, reply) => reply.code(405).header('allow', 'POST').send({ error: 'method_not_allowed' }));
}
