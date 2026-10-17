// Salin CSS token + manifest Library Kit ke dist/.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
for (const f of ['tokens.css', 'tailwind-theme.css', 'manifest.json']) copyFileSync(`src/generated/${f}`, `dist/${f}`);
