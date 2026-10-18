// Salin CSS token + manifest Library Kit dan entry Tailwind ke dist/.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
for (const f of ['tokens.css', 'tailwind-theme.css', 'manifest.json']) copyFileSync(`src/generated/${f}`, `dist/${f}`);
copyFileSync('src/tailwind.css', 'dist/tailwind.css');
