import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { moduleWriterPlugin } from './vite-plugin/moduleWriter.ts';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), moduleWriterPlugin()],
});
