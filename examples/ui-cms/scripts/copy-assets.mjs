// Salin CSS token + manifest Library Kit, utilitas, dan entry Tailwind ke dist/.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
for (const f of ['tokens.css', 'tailwind-theme.css', 'manifest.json']) copyFileSync(`src/generated/${f}`, `dist/${f}`);
copyFileSync('src/styles/utilities.css', 'dist/utilities.css');
copyFileSync('src/tailwind.css', 'dist/tailwind.css');
