// `midas bundle` — bundle ESM + CSS library untuk Live DOM Renderer di Studio (spec §7.5).
// Dibangun dari hasil `npm run build` (dist/) memakai Vite milik repo paket: semua dependency ikut dibundel,
// kecuali React (Studio menyuplai React miliknya supaya hook & context tetap satu instance).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REACT_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'];

/** Provider yang dibutuhkan renderer untuk komponen yang memakai router / i18n, bila paket memakainya. */
const RUNTIME = [
    ['react-router', "import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router';", 'MemoryRouter, createMemoryRouter, RouterProvider'],
    ['react-i18next', "import { I18nextProvider, initReactI18next } from 'react-i18next';", 'I18nextProvider, initReactI18next'],
    ['i18next', "import i18next from 'i18next';", 'i18next'],
];

/** Isi entry bundle: semua export paket + `__midasRuntime` (provider untuk renderer). */
export function studioEntry(pkg, { libEntry, cssEntry }) {
    const deps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.devDependencies };
    const used = RUNTIME.filter(([name]) => deps[name]);
    return [
        `// Dibuat oleh \`midas bundle\` — boleh dihapus.`,
        cssEntry ? `import '${cssEntry}';` : null,
        `export * from '${libEntry}';`,
        ...used.map(([, imp]) => imp),
        `export const __midasRuntime = { ${used.map(([, , names]) => names).join(', ')} };`,
        '',
    ].filter(l => l !== null).join('\n');
}

async function importFrom(dir, name) {
    const req = createRequire(join(dir, 'package.json'));
    let path;
    try {
        path = req.resolve(name);
    } catch {
        return null;
    }
    return import(pathToFileURL(path).href);
}

/**
 * Font yang di-inline (data URL) bisa sangat besar karena semua subset ikut (cyrillic, greek, …). Untuk renderer
 * cukup subset latin & latin-ext: @font-face lain dengan `unicode-range` dibuang.
 */
export function latinFontsOnly(css) {
    return css.replace(/@font-face\{[^}]*\}/g, block => {
        const range = /unicode-range:([^;}]*)/.exec(block)?.[1];
        return !range || /U\+0000-00FF|U\+0100-02/i.test(range) ? block : '';
    });
}

/** Build bundle ke `.midas/studio-bundle/` → { js, css }. */
export async function buildStudioBundle(dir) {
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const libFile = join(dir, pkg.module || pkg.main || 'dist/index.js');
    if (!existsSync(libFile)) throw new Error(`${relative(dir, libFile)} tidak ada — jalankan \`npm run build\` dulu`);
    const vite = await importFrom(dir, 'vite');
    if (!vite?.build) throw new Error('vite tidak terpasang di repo paket (devDependency `vite`)');
    const work = join(dir, '.midas');
    mkdirSync(work, { recursive: true });
    // CSS: entry Tailwind paket (token + utility + CSS komponen) dikompilasi penuh, karena Studio tidak punya Tailwind.
    const twEntry = join(dir, 'dist/tailwind.css'), plainCss = join(dir, 'dist/styles.css');
    let cssEntry = null, plugins = [];
    if (existsSync(twEntry)) {
        const tailwind = await importFrom(dir, '@tailwindcss/vite');
        if (!tailwind) throw new Error('dist/tailwind.css butuh `@tailwindcss/vite` dan `tailwindcss` sebagai devDependency untuk `midas bundle`');
        // source(none): hanya kelas yang dipakai paket (lewat @source di dist/tailwind.css), bukan seluruh repo.
        writeFileSync(join(work, 'studio.css'), `@import 'tailwindcss' source(none);\n@import '${relative(work, twEntry).split('\\').join('/')}';\n`);
        cssEntry = './studio.css';
        plugins = [tailwind.default()];
    }
    else if (existsSync(plainCss)) cssEntry = `./${relative(work, plainCss).split('\\').join('/')}`;
    const entry = join(work, 'studio-entry.js');
    writeFileSync(entry, studioEntry(pkg, { libEntry: `./${relative(work, libFile).split('\\').join('/')}`, cssEntry }));
    const outDir = join(work, 'studio-bundle');
    await vite.build({
        root: dir, configFile: false, logLevel: 'warn', plugins,
        define: { 'process.env.NODE_ENV': '"production"' },
        build: {
            outDir, emptyOutDir: true, target: 'es2022', minify: true, copyPublicDir: false,
            lib: { entry, formats: ['es'], fileName: () => 'index.js', cssFileName: 'style' },
            rollupOptions: { external: id => REACT_EXTERNALS.includes(id), output: { inlineDynamicImports: true } },
        },
    });
    const css = join(outDir, 'style.css');
    const cssText = existsSync(css) ? latinFontsOnly(readFileSync(css, 'utf8')) : '';
    if (cssText) writeFileSync(css, cssText);
    return { js: readFileSync(join(outDir, 'index.js'), 'utf8'), css: cssText };
}
