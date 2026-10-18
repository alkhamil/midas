import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { requireUser } from '../lib/auth.js';

// templates/ at the repo root (apps/server/{src,dist}/routes → four levels up). Override with TEMPLATES_DIR.
const TEMPLATES_DIR = process.env.TEMPLATES_DIR ?? fileURLToPath(new URL('../../../../templates/', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', '.npmrc', 'package-lock.json', '.DS_Store']);

function walk(dir: string, root: string, out: Record<string, string>) {
    for (const name of readdirSync(dir)) {
        if (SKIP.has(name)) continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, root, out);
        else out[relative(root, full).split(sep).join('/')] = readFileSync(full, 'utf8');
    }
}

export async function templateRoutes(app: FastifyInstance) {
    app.addHook('preHandler', requireUser);

    // The base project template as { path: text }. Studio merges the generated code into it for "Download project".
    app.get<{ Params: { name: string } }>('/api/templates/:name', async (req, reply) => {
        if (!/^[a-z0-9-]+$/.test(req.params.name)) return reply.code(404).send({ error: 'not_found' });
        const root = join(TEMPLATES_DIR, req.params.name);
        const files: Record<string, string> = {};
        try {
            walk(root, root, files);
        }
        catch {
            return reply.code(404).send({ error: 'not_found', message: 'Template not found' });
        }
        return { name: req.params.name, files };
    });
}
