import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API (apps/server) is not listening for a few seconds after a start: migrations, the seed and the bucket check run first.
// Vite's own answer to a refused connection is a bare 500 with no body, which looks like a server bug. Answer 503 with a reason.
export function apiProxyError(err, req, res) {
    if (res.headersSent || res.writableEnded) return;
    res.writeHead(503, { 'content-type': 'application/json', 'retry-after': '2' });
    res.end(JSON.stringify({
        error: 'api_unavailable',
        message: 'The Midas API is not running yet (or stopped). It starts after its database checks: try again in a few seconds.',
        code: err?.code || null,
    }));
}
const api = {
    target: 'http://127.0.0.1:4000',
    configure: proxy => proxy.on('error', apiProxyError),
};

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: '127.0.0.1',
        // Midas API (apps/server); same origin so the session cookie just works.
        proxy: { '/api': api, '/mcp': api }
    },
    build: { target: 'es2022', chunkSizeWarningLimit: 2000 }
});
