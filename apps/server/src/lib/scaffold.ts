// Kerangka repo paket frontend (spec §3.4). Dibuat sekali; setelah itu repo milik developer.
// Folder `src/generated` (Library Kit) ditimpa oleh `midas sync`, sisanya tidak.
import type { ComponentMapping } from './library.js';
import { buildKit, type KitFiles, type KitInput } from './kit.js';

export interface ScaffoldInput extends KitInput {
    libraryId: string;
    serverUrl: string;
    registryUrl: string;
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

function componentStub(m: ComponentMapping): string {
    const names = m.propsMap.props.map(p => p.name);
    const destructure = [...names, 'testId'].join(', ');
    const hasChildren = names.includes('children');
    return `import type { ${m.exportName}Props } from '../../generated/props';
import { ${m.exportName[0].toLowerCase() + m.exportName.slice(1)}Defaults } from '../../generated/props';

/**
 * ${m.exportName} — komponen desain "${m.componentName}".
 * TODO: implementasikan sesuai desain di Midas, lalu hapus \`midasStub\` di bawah.
 * Props wajib mengikuti \`${m.exportName}Props\` (dibangkitkan dari desain).
 */
export function ${m.exportName}(props: ${m.exportName}Props) {
  const { ${destructure} } = { ...${m.exportName[0].toLowerCase() + m.exportName.slice(1)}Defaults, ...props };
  void [${names.filter(n => n !== 'children').join(', ')}];
  return <div data-testid={testId} data-midas-component="${m.exportName}">${hasChildren ? '{children}' : `${m.componentName.replace(/[{}<>]/g, '')}`}</div>;
}

/** Penanda kerangka yang belum diimplementasikan — dibaca CI untuk status "Not implemented". */
${m.exportName}.midasStub = true;
`;
}

export function buildScaffold(input: ScaffoldInput): KitFiles {
    const pkgDir = input.packageName.split('/')[1];
    const registryHost = input.registryUrl.replace(/^https?:/, '');
    const files: KitFiles = {
        'package.json': json({
            name: input.packageName,
            version: input.version,
            description: `Komponen UI dari design system "${input.libraryName}" di Midas`,
            type: 'module',
            main: './dist/index.js',
            module: './dist/index.js',
            types: './dist/index.d.ts',
            exports: {
                '.': { types: './dist/index.d.ts', import: './dist/index.js' },
                './tokens.css': './dist/tokens.css',
                './tailwind-theme.css': './dist/tailwind-theme.css',
                './tailwind.css': './dist/tailwind.css',
                './manifest.json': './dist/manifest.json',
            },
            files: ['dist'],
            sideEffects: ['*.css'],
            scripts: {
                sync: 'midas sync',
                build: 'tsc -p tsconfig.build.json && vite build && node scripts/copy-assets.mjs',
                typecheck: 'tsc -p tsconfig.json --noEmit',
                prepublishOnly: 'npm run build',
            },
            peerDependencies: { react: '>=18', 'react-dom': '>=18' },
            devDependencies: {
                '@midas/cli': '^0.1.0',
                '@types/react': '^19.0.0',
                '@types/react-dom': '^19.0.0',
                '@vitejs/plugin-react': '^4.3.4',
                react: '^19.0.0',
                'react-dom': '^19.0.0',
                typescript: '~5.9.0',
                vite: '^6.0.7',
            },
            publishConfig: { registry: input.registryUrl },
        }),
        'midas.config.json': json({ server: input.serverUrl, libraryId: input.libraryId, package: input.packageName }),
        '.npmrc': `@midas:registry=${input.registryUrl}\n${registryHost}:_authToken=\${MIDAS_REGISTRY_TOKEN}\n`,
        '.gitignore': 'node_modules/\ndist/\n.midas/\n',
        'tsconfig.json': json({
            compilerOptions: {
                target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'ESNext', moduleResolution: 'Bundler', jsx: 'react-jsx',
                strict: true, skipLibCheck: true, resolveJsonModule: true, isolatedModules: true, noEmit: true,
            },
            include: ['src'],
        }),
        'tsconfig.build.json': json({
            extends: './tsconfig.json',
            compilerOptions: { noEmit: false, declaration: true, emitDeclarationOnly: true, outDir: 'dist' },
            include: ['src'],
        }),
        'vite.config.ts': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build library: React tidak ikut dibundel (peer dependency).
export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
    emptyOutDir: false,
  },
});
`,
        'scripts/copy-assets.mjs': `// Salin CSS token + manifest Library Kit dan entry Tailwind ke dist/.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
for (const f of ['tokens.css', 'tailwind-theme.css', 'manifest.json']) copyFileSync(\`src/generated/\${f}\`, \`dist/\${f}\`);
copyFileSync('src/tailwind.css', 'dist/tailwind.css');
`,
        'src/tailwind.css': `/*
 * Satu import untuk aplikasi Tailwind CSS v4:
 *   @import 'tailwindcss';
 *   @import '${input.packageName}/tailwind.css';
 * Berisi token tema, utility Tailwind dari token, dan @source agar class yang dipakai
 * komponen library ikut dibangkitkan (path relatif terhadap file ini).
 */
@import './tokens.css';
@import './tailwind-theme.css';
@source './index.js';
`,
        'src/theme/ThemeProvider.tsx': `import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, defaultTheme, themeNames, themes, type ThemeName } from '../generated/theme';

interface ThemeContextValue {
  theme: ThemeName;
  themes: ThemeName[];
  setTheme: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Terapkan token tema (dari Variables design system) ke dokumen. */
export function ThemeProvider({ initialTheme = defaultTheme, children }: { initialTheme?: ThemeName; children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme in themes ? initialTheme : defaultTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const value = useMemo(() => ({ theme, themes: themeNames, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam <ThemeProvider>');
  return ctx;
}
`,
        'src/index.ts': `// Entry paket ${input.packageName}.
export * from './generated';
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
${input.mappings.map(m => `export { ${m.exportName} } from './components/${m.exportName}/${m.exportName}';`).join('\n')}
`,
        'README.md': `# ${input.packageName}

Komponen UI dari design system **${input.libraryName}** di Midas (spec §3.4).

## Alur kerja

1. Desainer publish versi baru library di Midas.
2. Ambil Library Kit versi itu:

   \`\`\`bash
   npx midas sync --version <versi>
   \`\`\`

   Ini menimpa \`src/generated/\` (token tema, tipe props, manifest) dan menyamakan \`version\` di \`package.json\`.
3. Implementasikan / sesuaikan komponen di \`src/components/\`. Props wajib memakai tipe dari \`src/generated/props\`.
   Komponen kerangka ditandai \`midasStub = true\` — hapus penanda itu setelah komponen selesai.
4. \`npm run build\`, lalu publish ke Midas Registry:

   \`\`\`bash
   MIDAS_REGISTRY_TOKEN=... npm publish
   npx midas report     # status kode tiap komponen (ready / not implemented / mismatch) → Midas
   \`\`\`

## Memakai di project

\`\`\`css
/* src/index.css aplikasi (Tailwind CSS v4) */
@import 'tailwindcss';
@import '${input.packageName}/tailwind.css';
\`\`\`

\`\`\`tsx
import { ThemeProvider${input.mappings[0] ? `, ${input.mappings[0].exportName}` : ''} } from '${input.packageName}';
\`\`\`

Folder: \`${pkgDir}/\` · Library id di Midas: \`${input.libraryId}\`.
`,
        '.github/workflows/release.yml': `# Rilis paket saat tag v* dipush: sync Library Kit versi yang sama → build → publish ke Midas Registry.
name: release
on:
  push:
    tags: ['v*']
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
        env:
          MIDAS_REGISTRY_TOKEN: \${{ secrets.MIDAS_REGISTRY_TOKEN }}
      - run: npx midas sync --version "\${GITHUB_REF_NAME#v}"
        env:
          MIDAS_TOKEN: \${{ secrets.MIDAS_TOKEN }}
      - run: npm run build
      - run: npm publish
        env:
          MIDAS_REGISTRY_TOKEN: \${{ secrets.MIDAS_REGISTRY_TOKEN }}
      # Laporkan status kode tiap komponen (ready / not_implemented / mismatch) ke Midas.
      - run: npx midas report
        env:
          MIDAS_TOKEN: \${{ secrets.MIDAS_TOKEN }}
`,
    };
    for (const m of input.mappings)
        files[`src/components/${m.exportName}/${m.exportName}.tsx`] = componentStub(m);
    return { ...files, ...buildKit(input) };
}
