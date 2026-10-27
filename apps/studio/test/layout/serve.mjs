// Static server for the layout harness: serves the harness page and the engine modules from their real locations.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const STUDIO = fileURLToPath(new URL('../../', import.meta.url));
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };

/** `doc` (optional): an absolute path served as /doc.json, for the file-level rect dump. */
export function serve({ doc } = {}) {
    const map = [
        ['/src/', join(STUDIO, 'src')],
        ['/test/', join(STUDIO, 'test')],
        ['/packages/', join(REPO, 'packages')],
    ];
    const server = http.createServer(async (req, res) => {
        const url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
        if (doc && url === '/doc.json') {
            res.writeHead(200, { 'content-type': MIME['.json'] });
            res.end(await readFile(doc));
            return;
        }
        const hit = map.find(([prefix]) => url.startsWith(prefix));
        if (!hit) { res.writeHead(404).end(); return; }
        const file = normalize(join(hit[1], url.slice(hit[0].length)));
        if (!file.startsWith(hit[1])) { res.writeHead(403).end(); return; }
        try {
            res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
            res.end(await readFile(file));
        } catch {
            res.writeHead(404).end();
        }
    });
    return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}
