import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: '127.0.0.1',
        // Midas API (apps/server); same origin so the session cookie just works.
        proxy: { '/api': 'http://127.0.0.1:4000', '/mcp': 'http://127.0.0.1:4000' }
    },
    build: { target: 'es2022', chunkSizeWarningLimit: 2000 }
});
