// Frontend package repo scaffold (spec §3.4). Created once; after that the repo belongs to the developer.
// The `src/generated` folder (Library Kit) is overwritten by `midas sync`; the rest is not.
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
 * ${m.exportName} — design component "${m.componentName}".
 * TODO: implementasikan sesuai desain di Midas, lalu hapus \`midasStub\` di bawah.
 * Props wajib mengikuti \`${m.exportName}Props\` (dibangkitkan dari desain).
 */
export function ${m.exportName}(props: ${m.exportName}Props) {
  const { ${destructure} } = { ...${m.exportName[0].toLowerCase() + m.exportName.slice(1)}Defaults, ...props };
  void [${names.filter(n => n !== 'children').join(', ')}];
  return <div data-testid={testId} data-midas-component="${m.exportName}">${hasChildren ? '{children}' : `${m.componentName.replace(/[{}<>]/g, '')}`}</div>;
}

/** Marker for scaffolded, not-yet-implemented components — read by CI for the "Not implemented" status. */
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
            description: `UI components from the "${input.libraryName}" design system in Midas`,
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
            files: ['dist', 'src'], // src ships with the package so `midas extract` can copy a component into an app
            sideEffects: ['*.css'],
            scripts: {
                sync: 'midas sync',
                // Build keeps Midas in step without extra commands: the Library Kit is pulled before, the code status and the
                // Studio bundle are sent after. --soft = never fails when Midas is unreachable; MIDAS_OFFLINE=1 skips them.
                prebuild: 'midas sync --soft',
                build: 'tsc -p tsconfig.build.json && vite build && node scripts/copy-assets.mjs',
                postbuild: 'midas report --soft && midas bundle --soft',
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

// Library build: React is not bundled (peer dependency).
export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime'] },
    emptyOutDir: false,
  },
});
`,
        'scripts/copy-assets.mjs': `// Copy the Library Kit token CSS + manifest and the Tailwind entry to dist/.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
for (const f of ['tokens.css', 'tailwind-theme.css', 'manifest.json']) copyFileSync(\`src/generated/\${f}\`, \`dist/\${f}\`);
copyFileSync('src/tailwind.css', 'dist/tailwind.css');
`,
        'src/tailwind.css': `/*
 * One import for a Tailwind CSS v4 app:
 *   @import 'tailwindcss';
 *   @import '${input.packageName}/tailwind.css';
 * Contains the theme tokens, the Tailwind utilities from the tokens, and @source so the classes used
 * by the library components are generated too (path relative to this file).
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

/** Apply the theme tokens (from the design system Variables) to the document. */
export function ThemeProvider({ initialTheme = defaultTheme, children }: { initialTheme?: ThemeName; children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeName>(initialTheme in themes ? initialTheme : defaultTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const value = useMemo(() => ({ theme, themes: themeNames, setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
`,
        'src/index.ts': `// Entry paket ${input.packageName}.
export * from './generated';
export { ThemeProvider, useTheme } from './theme/ThemeProvider';
${input.mappings.map(m => `export { ${m.exportName} } from './components/${m.exportName}/${m.exportName}';`).join('\n')}
`,
        'README.md': `# ${input.packageName}

UI components from the **${input.libraryName}** design system in Midas (spec §3.4).

## Workflow

1. The designer publishes a new library version in Midas.
2. Pull the Library Kit for that version:

   \`\`\`bash
   npx midas sync --version <version>
   \`\`\`

   This overwrites \`src/generated/\` (theme tokens, props types, manifest) and aligns \`version\` in \`package.json\`.
3. Implement / adjust the components in \`src/components/\`. Props must use the types from \`src/generated/props\`.
   Scaffolded components are marked \`midasStub = true\` — remove the marker once the component is done.
4. Run \`npm run build\`, then publish to the Midas Registry:

   \`\`\`bash
   MIDAS_REGISTRY_TOKEN=... npm publish
   npx midas report     # code status of each component (ready / not implemented / mismatch) → Midas
   \`\`\`

## Using it in a project

\`\`\`css
/* the app's src/index.css (Tailwind CSS v4) */
@import 'tailwindcss';
@import '${input.packageName}/tailwind.css';
\`\`\`

\`\`\`tsx
import { ThemeProvider${input.mappings[0] ? `, ${input.mappings[0].exportName}` : ''} } from '${input.packageName}';
\`\`\`

Folder: \`${pkgDir}/\` · Library id di Midas: \`${input.libraryId}\`.
`,
        '.github/workflows/release.yml': `# Release the package when a v* tag is pushed: sync the same Library Kit version → build → publish to the Midas Registry.
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
      # Report each component's code status (ready / not_implemented / mismatch) to Midas.
      - run: npx midas report
        env:
          MIDAS_TOKEN: \${{ secrets.MIDAS_TOKEN }}
`,
    };
    for (const m of input.mappings)
        files[`src/components/${m.exportName}/${m.exportName}.tsx`] = componentStub(m);
    return { ...files, ...buildKit(input) };
}
