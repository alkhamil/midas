import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// Build library: dependency & peer tidak ikut dibundel; CSS digabung ke dist/styles.css.
const external = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})];

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'styles' },
    // CSS dari dependency (mis. react-datepicker) dibundel ke styles.css, bukan dibiarkan sebagai import.
    rollupOptions: { external: id => !id.endsWith('.css') && external.some(dep => id === dep || id.startsWith(`${dep}/`)) },
    emptyOutDir: false,
  },
});
