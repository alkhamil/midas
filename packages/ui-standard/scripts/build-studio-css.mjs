// dist/studio-base.css — the CSS of the standard components for Midas' Live DOM Renderer (Studio has no Tailwind):
// Inter (latin only, inlined), the Tailwind utilities the components use, and the spacing utilities. It carries NO token
// values: the utilities refer to --theme-* variables (@theme inline), so a library publish only adds its own tokens.css.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwind from '@tailwindcss/vite';
import { build } from 'vite';

const root = process.cwd();
const work = join(root, '.build');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
writeFileSync(join(work, 'studio-base.css'), `@import 'tailwindcss' source(none);
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '../dist/tailwind-theme.css';
@import '../dist/utilities.css';
@source '../dist/index.js';
`);
writeFileSync(join(work, 'entry.js'), "import './studio-base.css';\nexport {};\n");
await build({
    root, configFile: false, logLevel: 'warn', plugins: [tailwind()],
    build: { outDir: join(work, 'out'), emptyOutDir: true, minify: true, copyPublicDir: false, lib: { entry: join(work, 'entry.js'), formats: ['es'], fileName: () => 'entry.js', cssFileName: 'style' } },
});
const raw = readFileSync(join(work, 'out/style.css'), 'utf8');
// Only the latin subset is needed by the renderer. The minifier shortens its range (U+0000-00FF) to U+??.
const LATIN = /^U\+(?:00)?\?\?|^U\+(?:0000|0)-(?:00)?FF\b/i;
const css = raw.replace(/@font-face\{[^}]*\}/g, block => {
    const range = /unicode-range:([^;}]*)/.exec(block)?.[1];
    return !range || LATIN.test(range.trim()) ? block : '';
});
writeFileSync(join(root, 'dist/studio-base.css'), css);
rmSync(work, { recursive: true, force: true });
console.log(`dist/studio-base.css (${Math.round(css.length / 1024)} KB)`);
