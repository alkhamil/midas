// Library Builder: turns a published library version into a usable code package without a developer.
//
// Every component of the library gets code from one of two sources (its `implementation`):
//   design           generated from the design (any component): variants, bound text, show/hide, nested components, icons
//   standard:<Name>  the behaviour of a component of Midas' standard kit (packages/ui-standard), themed by the library
// Both are bundled with esbuild on top of the library's own *generated layer* (tokens, props types, icons), which also gives
// the Studio preview bundle; the layer's type declarations are emitted, an npm tarball is packed, and each component's code
// status is reported:
//   ready            code exists and every design prop is handled
//   mismatch         a standard implementation does not handle some design props
//   not_implemented  code generation failed for the component (a placeholder is exported so apps still compile)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild, type Plugin } from 'esbuild';
import { generateComponent, makeContext } from '@midas/builder-core';
import ts from 'typescript';
import { iconExportName } from './icons.js';
import type { KitFiles } from './kit.js';
import { deriveMapping, pascalCase, type ComponentMapping, type LibrarySnapshot } from './library.js';
import { packageTarball } from './tar.js';

const STANDARD_DIR = process.env.STANDARD_KIT_DIR ?? fileURLToPath(new URL('../../../../packages/ui-standard/', import.meta.url));
const GEN = 'generated/';
const REACT_EXTERNALS = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'];

export interface BuiltComponentStatus { exportName: string; status: 'ready' | 'mismatch' | 'not_implemented'; detail?: string }
export interface BuiltLibrary {
    packageJson: Record<string, unknown>;
    /** The package's dist/index.js (not minified). */
    indexJs: string;
    /** Studio preview bundle: minified ESM + `__midasRuntime`, and its CSS (fonts + utilities + the library's tokens). */
    bundleJs: string;
    bundleCss: string;
    tarball: Buffer;
    statuses: BuiltComponentStatus[];
    warnings: string[];
}
export interface BuildInput {
    packageName: string;
    version: string;
    libraryName: string;
    /** Library Kit files (src/generated/**, with manifest.json, tokens.css, tailwind-theme.css). */
    kit: KitFiles;
    /** The published version: component nodes (also the internal parts), variables, icons, and the mappings. */
    snapshot: LibrarySnapshot;
    mappings: ComponentMapping[];
}

interface StandardKit {
    /** src/** without the generated layer, keyed relative to src/. */
    sources: Map<string, string>;
    /** The reference generated layer, keyed relative to src/generated/. */
    reference: Map<string, string>;
    /** dist/**.d.ts without dist/generated and dist/index.d.ts, keyed relative to dist/. */
    declarations: Map<string, string>;
    indexDts: string;
    utilitiesCss: string;
    tailwindCss: string;
    studioCss: string;
    /** exportName → design props the reference implementation was written against. */
    referenceProps: Map<string, Set<string>>;
}

/** Props the standard components accept besides the ones of the reference design (the design's own name for the same thing). */
const PROP_ALIASES: Record<string, string[]> = { Button: ['label'], Badge: ['label'] };

let cached: StandardKit | null = null;

function walk(dir: string, base = dir, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, base, out);
        else out.push(full.slice(base.length + 1).split('\\').join('/'));
    }
    return out;
}

/** The standard component kit, read once (it only changes with a new Midas build). */
export function standardKit(): StandardKit {
    if (cached) return cached;
    const src = join(STANDARD_DIR, 'src'), dist = join(STANDARD_DIR, 'dist');
    if (!existsSync(join(dist, 'studio-base.css')) || !existsSync(join(dist, 'index.d.ts')))
        throw new Error(`The standard component kit is not built (${STANDARD_DIR}). Run \`npm run build --workspace @midas/ui-standard\`.`);
    const kit: StandardKit = { sources: new Map(), reference: new Map(), declarations: new Map(), indexDts: '', utilitiesCss: '', tailwindCss: '', studioCss: '', referenceProps: new Map() };
    for (const rel of walk(src)) {
        const text = readFileSync(join(src, rel), 'utf8');
        if (rel.startsWith(GEN)) kit.reference.set(rel.slice(GEN.length), text);
        else kit.sources.set(rel, text);
    }
    const components = new Set([...kit.sources.keys()].map(r => /^components\/([^/]+)\//.exec(r)?.[1]).filter(Boolean));
    for (const rel of walk(dist)) {
        if (!rel.endsWith('.d.ts') || rel.startsWith(GEN) || rel === 'index.d.ts') continue;
        const dir = /^components\/([^/]+)\//.exec(rel)?.[1];
        if (dir && !components.has(dir)) continue; // leftovers of components that no longer exist
        kit.declarations.set(rel, readFileSync(join(dist, rel), 'utf8'));
    }
    kit.indexDts = readFileSync(join(dist, 'index.d.ts'), 'utf8');
    kit.utilitiesCss = readFileSync(join(dist, 'utilities.css'), 'utf8');
    kit.tailwindCss = readFileSync(join(dist, 'tailwind.css'), 'utf8');
    kit.studioCss = readFileSync(join(dist, 'studio-base.css'), 'utf8');
    const manifest = JSON.parse(readFileSync(join(dist, 'manifest.json'), 'utf8')) as { components: { exportName: string; props: { name: string }[] }[] };
    for (const c of manifest.components) kit.referenceProps.set(c.exportName, new Set([...c.props.map(p => p.name), ...(PROP_ALIASES[c.exportName] ?? [])]));
    cached = kit;
    return kit;
}

const isTs = (p: string) => /\.tsx?$/.test(p);
const stubSource = (name: string) => `import type { ${name}Props } from '../../generated/props';

/** Placeholder: this component has no standard implementation yet. */
export function ${name}(props: ${name}Props) {
  return <div data-testid={props.testId} data-midas-component="${name}">${name}</div>;
}
${name}.midasStub = true;
`;
const stubDts = (name: string) => `import type { ReactElement } from 'react';
import type { ${name}Props } from '../../generated/props';
/** Placeholder: this component has no standard implementation yet. */
export declare const ${name}: ((props: ${name}Props) => ReactElement) & { midasStub: boolean };
`;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Components of the standard kit a library component can take its behaviour from. */
export function standardCatalog(): { name: string; props: string[] }[] {
    return [...standardKit().referenceProps].map(([name, props]) => ({ name, props: [...props] })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Automatic choice: the standard component of that name when there is one, otherwise the design. */
export function defaultImplementation(exportName: string): string {
    try {
        const hit = [...standardKit().referenceProps.keys()].find(n => normalize(n) === normalize(exportName));
        return hit ? `standard:${hit}` : 'design';
    }
    catch {
        return 'design';
    }
}

/** Validation message for an `implementation` value, or null. */
export function implementationError(impl?: string): string | null {
    if (impl === undefined || impl === 'design')
        return null;
    const m = /^standard:(.+)$/.exec(impl);
    if (!m)
        return 'implementation must be "design" or "standard:<Component>"';
    try {
        return standardKit().referenceProps.has(m[1]) ? null : `the standard kit has no component "${m[1]}"`;
    }
    catch {
        return null;
    }
}

/** The library's generated TS layer, with the reference files filling in what the library did not publish. */
function generatedLayer(std: StandardKit, kit: KitFiles): Map<string, string> {
    const lib = new Map<string, string>();
    for (const [path, text] of Object.entries(kit))
        if (path.startsWith('src/generated/') && isTs(path)) lib.set(path.slice('src/generated/'.length), text);
    const out = new Map(lib);
    const barrelProps: string[] = [], barrelIcons: string[] = [];
    for (const [rel, text] of std.reference) {
        if (!isTs(rel) || out.has(rel)) continue;
        // Standard components import their own props / icons even when the library did not publish them: use the reference.
        out.set(rel, text);
        const m = /^(props|icons)\/([A-Za-z0-9_]+)\.tsx?$/.exec(rel);
        if (!m || m[2] === 'index' || m[2] === 'registry' || m[2] === 'createIcon' || m[2] === 'Icon') continue;
        (m[1] === 'props' ? barrelProps : barrelIcons).push(m[2]);
    }
    const extend = (rel: string, lines: string[]) => {
        if (lines.length) out.set(rel, `${out.get(rel) ?? ''}${(out.get(rel) ?? '').endsWith('\n') ? '' : '\n'}${lines.join('\n')}\n`);
    };
    extend('props/index.ts', barrelProps.map(n => `export * from './${n}';`));
    extend('icons/index.ts', barrelIcons.map(n => `export { ${n} } from './${n}';`));
    return out;
}

/** esbuild plugin: relative imports resolve to the virtual files first, then to the standard kit's sources on disk. */
function virtualFs(files: Map<string, string>): Plugin {
    const find = (path: string): string | null => {
        for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) if (files.has(path + ext)) return path + ext;
        return null;
    };
    return {
        name: 'midas-virtual',
        setup(b) {
            b.onResolve({ filter: /.*/ }, args => {
                if (args.kind === 'entry-point') return { path: args.path, namespace: 'midas' };
                if (args.path.startsWith('.') && args.namespace === 'midas') {
                    const target = find(posix.normalize(posix.join(posix.dirname(args.importer), args.path)));
                    if (target) return { path: target, namespace: 'midas' };
                    return { errors: [{ text: `cannot resolve ${args.path} from ${args.importer}` }] };
                }
                return { path: args.path, external: true };
            });
            b.onLoad({ filter: /.*/, namespace: 'midas' }, args => {
                const text = files.get(args.path);
                if (text === undefined) return { errors: [{ text: `missing virtual file ${args.path}` }] };
                return { contents: text, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts', resolveDir: '/' };
            });
        },
    };
}

/** @types/react: the first node_modules/@types/react above this file (its package exports hide index.d.ts from require.resolve). */
function findReactTypes(): string {
    for (let dir = dirname(fileURLToPath(import.meta.url)); ; dir = dirname(dir)) {
        const candidate = join(dir, 'node_modules/@types/react/index.d.ts');
        if (existsSync(candidate)) return candidate;
        if (dirname(dir) === dir) throw new Error('@types/react is not installed (needed to type the generated icons)');
    }
}

/** Type declarations (.d.ts) of the generated layer, compiled in memory with the TypeScript API. */
function generatedDeclarations(layer: Map<string, string>): { files: Map<string, string>; diagnostics: string[] } {
    const root = '/virtual/src', out = '/virtual/dist';
    const virtual = new Map([...layer].map(([rel, text]) => [`${root}/generated/${rel}`, text]));
    const reactTypes = findReactTypes();
    const options: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
        declaration: true, emitDeclarationOnly: true, strict: true, skipLibCheck: true, rootDir: root, outDir: out,
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], types: [], baseUrl: '/',
        paths: { react: [reactTypes], 'react/jsx-runtime': [reactTypes.replace(/index\.d\.ts$/, 'jsx-runtime.d.ts')], 'react/jsx-dev-runtime': [reactTypes.replace(/index\.d\.ts$/, 'jsx-dev-runtime.d.ts')] },
    };
    const host = ts.createCompilerHost(options);
    const realFileExists = host.fileExists.bind(host), realRead = host.readFile.bind(host), realSource = host.getSourceFile.bind(host);
    const dirs = new Set<string>();
    for (const p of virtual.keys()) for (let d = p.slice(0, p.lastIndexOf('/')); d.length > 1; d = d.slice(0, d.lastIndexOf('/'))) dirs.add(d);
    const realDirExists = host.directoryExists?.bind(host);
    host.directoryExists = d => dirs.has(d) || (realDirExists ? realDirExists(d) : false);
    host.fileExists = p => virtual.has(p) || realFileExists(p);
    host.readFile = p => virtual.get(p) ?? realRead(p);
    host.getSourceFile = (p, lang, onError, shouldCreate) => {
        const text = virtual.get(p);
        return text !== undefined ? ts.createSourceFile(p, text, lang, true, p.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : realSource(p, lang, onError, shouldCreate);
    };
    const emitted = new Map<string, string>();
    const program = ts.createProgram({ rootNames: [...virtual.keys()], options, host });
    program.emit(undefined, (p, text) => { if (p.endsWith('.d.ts')) emitted.set(p.slice(out.length + 1), text); });
    const diagnostics = ts.getPreEmitDiagnostics(program).filter(d => d.category === ts.DiagnosticCategory.Error && d.file && virtual.has(d.file.fileName))
        .map(d => `${d.file!.fileName.slice(root.length + 1)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
    return { files: emitted, diagnostics };
}

export async function buildLibraryPackage(input: BuildInput): Promise<BuiltLibrary> {
    const std = standardKit();
    const warnings: string[] = [];
    const layer = generatedLayer(std, input.kit);
    const files = new Map<string, string>();
    for (const [rel, text] of std.sources) files.set(rel, text);
    for (const [rel, text] of layer) files.set(`${GEN}${rel}`, text);
    const dts = new Map<string, string>();

    // ---- which implementation each component has
    const implementationOf = (m: ComponentMapping) => m.propsMap.implementation ?? defaultImplementation(m.exportName);
    const mapped = new Set(input.mappings.map(m => m.componentKey));
    const iconKeys = new Set((input.snapshot.icons ?? []).map(i => i.componentKey));
    const iconNames = new Map((input.snapshot.icons ?? []).map(i => [i.componentKey, iconExportName(i.name)]));
    // Internal parts: components the published ones are built from (e.g. _SidebarItem); generated, not exported.
    const taken = new Set(input.mappings.map(m => m.exportName));
    const internal: ComponentMapping[] = input.snapshot.components.filter(c => !mapped.has(c.id) && !iconKeys.has(c.id)).map(c => {
        const d = deriveMapping(c);
        let name = pascalCase(c.name.replace(/^[_.\s]+/, '')) || 'Part', n = 2;
        while (taken.has(name) || std.referenceProps.has(name)) name = `${pascalCase(c.name.replace(/^[_.\s]+/, '')) || 'Part'}${n++}`;
        taken.add(name);
        return { ...d, exportName: name };
    });
    const ctx = makeContext({
        nodes: input.snapshot.components.flatMap(c => c.nodes) as never,
        variables: input.snapshot.variables as never,
        mappings: [...input.mappings, ...internal].map(m => ({ ...m, componentKey: m.componentKey })) as never,
        libraryId: 'self', fileId: 'self',
    });

    const statuses: BuiltComponentStatus[] = [];
    const exportLines: string[] = [];
    const delegated = new Set<string>();
    const design = (m: ComponentMapping, inline: boolean) => {
        const out = generateComponent({ ctx, mapping: m as never, types: inline ? 'inline' : 'generated', iconOf: key => iconNames.get(key) ?? null, importPrefix: '../..' });
        files.set(`components/__design/${m.exportName}.tsx`, out.source);
        dts.set(`components/__design/${m.exportName}.d.ts`, out.dts);
        return out;
    };
    const placeholder = (m: ComponentMapping) => {
        files.set(`components/__design/${m.exportName}.tsx`, stubSource(m.exportName).replace("'../../generated/props'", "'../../generated/props'"));
        dts.set(`components/__design/${m.exportName}.d.ts`, stubDts(m.exportName));
    };
    for (const m of input.mappings) {
        const impl = implementationOf(m), std1 = /^standard:(.+)$/.exec(impl)?.[1];
        const propNames = m.propsMap.props.map(p => p.name);
        if (std1 && std.referenceProps.has(std1)) {
            delegated.add(std1);
            files.set(`components/__design/${m.exportName}.tsx`, `export { ${std1} as ${m.exportName} } from '../${std1}/${std1}';\n`);
            dts.set(`components/__design/${m.exportName}.d.ts`, `export { ${std1} as ${m.exportName} } from '../${std1}/${std1}';\n`);
            const unhandled = propNames.filter(p => !std.referenceProps.get(std1)!.has(p));
            statuses.push(unhandled.length
                ? { exportName: m.exportName, status: 'mismatch', detail: `design props not handled by the standard ${std1}: ${unhandled.join(', ')}` }
                : { exportName: m.exportName, status: 'ready', ...(std1 !== m.exportName ? { detail: `behaviour of the standard ${std1}` } : {}) });
        }
        else {
            try {
                const out = design(m, false);
                statuses.push({ exportName: m.exportName, status: 'ready', detail: out.warnings.length ? `generated from the design; ${out.warnings.length} layer(s) not generated: ${out.warnings.slice(0, 2).join('; ')}` : 'generated from the design' });
            }
            catch (e) {
                placeholder(m);
                statuses.push({ exportName: m.exportName, status: 'not_implemented', detail: `could not be generated from the design: ${(e as Error).message}` });
            }
        }
        exportLines.push(`export { ${m.exportName} } from './components/__design/${m.exportName}';`);
    }
    for (const m of internal) {
        try { design(m, true); }
        catch (e) { warnings.push(`internal part ${m.exportName}: ${(e as Error).message}`); placeholder(m); }
    }

    // ---- index.ts: the kit's own exports (theme, generated layer, preview data), the components, and the types of the standard ones
    const stdLines = std.sources.get('index.ts')!.split('\n');
    const keep = (line: string) => {
        const m = /from '\.\/components\/([A-Za-z0-9]+)\//.exec(line);
        if (!m) return true;
        return /^export type /.test(line) && delegated.has(m[1]);
    };
    const nonComponent = stdLines.filter(l => keep(l) && !/^export \{ [A-Za-z0-9]+ \} from '\.\/components\//.test(l));
    files.set('index.ts', `${nonComponent.join('\n')}\n${exportLines.join('\n')}\n`);
    const stdDts = std.indexDts.split('\n');
    dts.set('index.d.ts', `${stdDts.filter(l => keep(l) && !/^export \{ [A-Za-z0-9]+ \} from '\.\/components\//.test(l)).join('\n')}\n${exportLines.join('\n')}\n`);

    // ---- bundles
    const run = (minify: boolean) => esbuild({
        entryPoints: ['index.ts'], bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false, minify,
        external: REACT_EXTERNALS, plugins: [virtualFs(files)], logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' },
    });
    const [plain, small] = await Promise.all([run(false), run(true)]);
    const indexJs = plain.outputFiles[0].text;
    const bundleJs = `${small.outputFiles[0].text}\nexport const __midasRuntime = {};\n`;

    // ---- declarations: standard (prebuilt) + generated layer (compiled now) + the components written above
    const generated = generatedDeclarations(layer);
    warnings.push(...generated.diagnostics.slice(0, 5).map(d => `types: ${d}`));
    for (const [rel, text] of std.declarations) if (!dts.has(rel)) dts.set(rel, text);
    for (const [rel, text] of generated.files) dts.set(rel, text);

    // ---- npm package
    const manifestJson = input.kit['src/generated/manifest.json'] ?? '{}';
    const packageJson = {
        name: input.packageName,
        version: input.version,
        description: `UI components of the "${input.libraryName}" design system, built by Midas`,
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
        files: ['dist', 'src'],
        sideEffects: ['*.css'],
        peerDependencies: { react: '>=18', 'react-dom': '>=18' },
        dependencies: { '@fontsource/inter': '^5.3.0' },
    };
    const pkgFiles: Record<string, string> = {
        'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
        'README.md': `# ${input.packageName}@${input.version}\n\nUI components of the **${input.libraryName}** design system, built by Midas from its standard component kit and the library's tokens, props and icons.\n\nUse it in a Tailwind CSS v4 app:\n\n\`\`\`css\n@import 'tailwindcss';\n@import '${input.packageName}/tailwind.css';\n\`\`\`\n\nTo customise a component: \`npx midas extract <Component>\`.\n`,
        'dist/index.js': indexJs,
        'dist/tokens.css': input.kit['src/generated/tokens.css'] ?? '',
        'dist/tailwind-theme.css': input.kit['src/generated/tailwind-theme.css'] ?? '',
        'dist/utilities.css': std.utilitiesCss,
        'dist/tailwind.css': std.tailwindCss,
        'dist/manifest.json': manifestJson,
    };
    for (const [rel, text] of dts) pkgFiles[`dist/${rel}`] = text;
    // Sources travel with the package so `midas extract` can copy a component into an app.
    for (const [rel, text] of files) pkgFiles[`src/${rel}`] = text;
    for (const [path, text] of Object.entries(input.kit)) if (path.startsWith('src/generated/') && !isTs(path)) pkgFiles[path] = text;
    return {
        packageJson, indexJs, bundleJs,
        bundleCss: `${std.studioCss}\n${input.kit['src/generated/tokens.css'] ?? ''}`,
        tarball: packageTarball(pkgFiles), statuses, warnings,
    };
}
