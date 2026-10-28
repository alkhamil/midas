import { createHash } from 'node:crypto';
import { posix } from 'node:path';
import { gzipSync } from 'node:zlib';
import { compile, optimize } from '@tailwindcss/node';
import { build, type Plugin } from 'esbuild';
import { kebabCase, libraryPackage, TAILWIND_PREFIX, type LibraryPackageIssue, type LibraryPackageResult } from '@midas/builder-core';
import type { LibrarySnapshot } from './library.js';

/** Bump when the generated package changes, so packages cached for an older generator are built again. */
export const GENERATOR_VERSION = 5;

export interface PackageInfo {
    libraryId: string;
    libraryName: string;
    seq: number;
    packageName: string;
    version: string;
    fileName: string;
    sizeBytes: number;
    files: number;
    generator: number;
    components: LibraryPackageResult['components'];
    icons: LibraryPackageResult['icons'];
    warnings: string[];
    /** What the design needs or what could not become code: the component, the layer, and what to do about it. */
    issues: LibraryPackageIssue[];
    /** package.json, the checksums of the tarball: what the built-in npm registry answers with. */
    manifest: Record<string, unknown>;
    shasum: string;
    integrity: string;
}

export type StepId = 'load' | 'read' | 'components' | 'icons' | 'tokens' | 'bundle' | 'styles' | 'pack' | 'save';
/** What a build tells the caller while it runs (streamed to Studio as NDJSON). */
export type PackageEvent =
    | { type: 'step'; id: StepId; label: string; status: 'running' | 'done'; detail?: string; current?: number; total?: number }
    | { type: 'issue'; issue: LibraryPackageIssue }
    | { type: 'done'; package: PackageInfo & { downloadUrl: string } }
    | { type: 'error'; step: StepId; message: string; fix: string; where?: string };

export const STEP_LABEL: Record<StepId, string> = {
    load: 'Loading the published version', read: 'Reading the design', components: 'Writing components', icons: 'Drawing icons',
    tokens: 'Building theme tokens', bundle: 'Compiling to JavaScript', styles: 'Compiling the stylesheet', pack: 'Packing the tarball', save: 'Saving the package',
};

/** A failure in one step, with what it means and what to do. */
export class PackageBuildError extends Error {
    constructor(public step: StepId, message: string, public fix: string, public where?: string) { super(message); }
}

/** `@midas/<library name>`: the scope is fixed, the name follows the library. */
export const packageNameOf = (libraryName: string) => `@midas/${kebabCase(libraryName) || 'ui'}`;
/** Every publish is a new package version. */
export const versionOf = (seq: number) => `1.0.${seq}`;
/** What `npm pack` names the file: no scope. */
export const tarballName = (packageName: string, version: string) => `${packageName.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

/** `src/` → `dist/index.js`: one ES module with React left as a peer dependency. The files are served from memory, nothing touches the disk. */
async function bundle(files: Record<string, string>): Promise<string> {
    const virtual: Plugin = {
        name: 'midas-package',
        setup(b) {
            b.onResolve({ filter: /.*/ }, args => {
                if (args.kind === 'entry-point') return { path: posix.normalize(args.path), namespace: 'pkg' }; // esbuild says ./src/index.ts, the files are keyed src/index.ts
                if (!args.path.startsWith('.')) return { path: args.path, external: true }; // react, react/jsx-runtime
                const base = posix.join(posix.dirname(args.importer), args.path);
                const hit = [base, `${base}.tsx`, `${base}.ts`, posix.join(base, 'index.ts')].find(p => p in files);
                if (!hit) return { errors: [{ text: `Cannot find ${args.path} from ${args.importer}` }] };
                return { path: hit, namespace: 'pkg' };
            });
            b.onLoad({ filter: /.*/, namespace: 'pkg' }, args => ({ contents: files[args.path], loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' }));
        },
    };
    try {
        const out = await build({
            entryPoints: ['src/index.ts'], outfile: 'dist/index.js', bundle: true, write: false, format: 'esm', platform: 'neutral',
            target: 'es2020', jsx: 'automatic', plugins: [virtual], logLevel: 'silent',
        });
        return out.outputFiles[0].text;
    }
    catch (e) {
        const m = (e as { errors?: { text: string; location?: { file: string; line: number } | null }[] }).errors?.[0];
        const file = m?.location?.file.match(/(?:components|icons)\/(\w+)\.tsx?$/)?.[1];
        throw new PackageBuildError('bundle', `${file ? `${file} could not be compiled` : 'The generated code could not be compiled'}: ${m?.text ?? (e as Error).message}${m?.location ? ` (line ${m.location.line})` : ''}`,
            'This is a problem in the code generated from the design, not something you did wrong. Deselect that component in the publish list to publish without it, and report it with the component name.', file);
    }
}

/**
 * The stylesheet of the components, compiled by Tailwind for exactly the classes they use: the project that installs the package needs
 * no Tailwind. Every class has the `mds:` prefix and sits in the `midas` layer, so a Tailwind of the project's own wins over it.
 */
async function styles(classes: string[], themeCss: string): Promise<string> {
    const input = `@import "tailwindcss/theme.css" layer(midas) prefix(${TAILWIND_PREFIX});\n@import "tailwindcss/utilities.css" layer(midas) prefix(${TAILWIND_PREFIX});\n${themeCss}`;
    try {
        const compiler = await compile(input, { base: import.meta.dirname, onDependency: () => {} });
        return optimize(compiler.build(classes), { minify: true }).code;
    }
    catch (e) {
        throw new PackageBuildError('styles', `The stylesheet could not be compiled: ${(e as Error).message}`, 'This is a problem in the code generated from the design, not something you did wrong. Report it with the library name.');
    }
}

const octal = (n: number, width: number) => `${n.toString(8).padStart(width - 1, '0')}\0`;

/** One ustar entry. A path longer than 100 bytes is split over the `prefix` field. */
function tarEntry(name: string, data: Buffer, mtime: number): Buffer {
    let prefix = '';
    if (Buffer.byteLength(name) > 100) {
        const cut = [...name.matchAll(/\//g)].map(m => m.index!).reverse().find(i => i <= 155 && Buffer.byteLength(name) - i - 1 <= 100);
        if (cut === undefined) throw new Error(`Path too long for a tarball: ${name}`);
        prefix = name.slice(0, cut);
        name = name.slice(cut + 1);
    }
    const h = Buffer.alloc(512);
    h.write(name, 0, 100);
    h.write('0000644\0', 100);
    h.write('0000000\0', 108);
    h.write('0000000\0', 116);
    h.write(octal(data.length, 12), 124);
    h.write(octal(mtime, 12), 136);
    h.write('        ', 148); // the checksum is summed with this field as spaces
    h.write('0', 156);
    h.write('ustar\0', 257);
    h.write('00', 263);
    h.write(prefix, 345, 155);
    h.write(`${octal([...h].reduce((s, b) => s + b, 0), 7)} `, 148);
    return Buffer.concat([h, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

/** A gzipped tarball with every file under `package/`, the layout `npm install` expects. Entries are sorted so the same files give the same bytes. */
export function tarGz(files: Record<string, string>, mtime = 0): Buffer {
    const entries = Object.keys(files).sort().map(n => tarEntry(`package/${n}`, Buffer.from(files[n]), mtime));
    return gzipSync(Buffer.concat([...entries, Buffer.alloc(1024)]), { level: 9 });
}

/** The React package of one library version: generated from the design, compiled, and packed. `emit` hears every step as it happens. */
export async function buildLibraryPackage(snapshot: LibrarySnapshot, meta: { libraryId: string; libraryName: string; seq: number; publishedAt: number }, emit: (e: PackageEvent) => void = () => {}): Promise<{ tgz: Buffer; info: PackageInfo }> {
    const packageName = packageNameOf(meta.libraryName), version = versionOf(meta.seq);
    let open: StepId | null = null, openDetail = '';
    const step = (id: StepId, status: 'running' | 'done', detail?: string, current?: number, total?: number) => emit({ type: 'step', id, label: STEP_LABEL[id], status, detail, current, total });
    const begin = (id: StepId, detail?: string, current?: number, total?: number) => { if (open && open !== id) step(open, 'done', openDetail); open = id; openDetail = detail ?? ''; step(id, 'running', detail, current, total); };
    begin('read');
    let out: LibraryPackageResult;
    try {
        out = libraryPackage(snapshot, {
            packageName, version, libraryName: meta.libraryName,
            onProgress: e => {
                if (e.phase === 'analyze') { openDetail = `${e.components} components · ${e.icons} icons`; step('read', 'done', openDetail); open = null; }
                else if (e.phase === 'components') begin('components', e.name, e.current, e.total);
                else if (e.phase === 'icons') begin('icons', e.name, e.current, e.total);
                else if (e.phase === 'tokens') begin('tokens', `${e.total} variables`);
                if (e.phase === 'components') openDetail = `${e.total} components`;
                if (e.phase === 'icons') openDetail = `${e.total} icons`;
            },
        });
    }
    catch (e) {
        throw new PackageBuildError(open ?? 'read', `The design could not be turned into code: ${(e as Error).message}`, 'Open the library file and check the components you published; if it still fails, report it with the component name.');
    }
    if (open) step(open, 'done', openDetail);
    for (const issue of out.issues) emit({ type: 'issue', issue });
    open = null;
    step('bundle', 'running');
    const js = await bundle(out.files);
    step('bundle', 'done', `index.js ${Math.round(js.length / 1024)} KB`);
    step('styles', 'running');
    const css = await styles(out.classes, out.themeCss);
    step('styles', 'done', `styles.css ${Math.round(css.length / 1024)} KB · ${out.classes.length} classes`);
    const files = { ...out.files, 'dist/index.js': js, 'dist/styles.css': css };
    step('pack', 'running');
    const tgz = tarGz(files, Math.floor(meta.publishedAt / 1000));
    step('pack', 'done', `${Object.keys(files).length} files · ${Math.round(tgz.length / 1024)} KB`);
    return {
        tgz,
        info: {
            libraryId: meta.libraryId, libraryName: meta.libraryName, seq: meta.seq, packageName, version, fileName: tarballName(packageName, version),
            sizeBytes: tgz.length, files: Object.keys(files).length, generator: GENERATOR_VERSION, components: out.components, icons: out.icons, warnings: out.warnings, issues: out.issues,
            manifest: JSON.parse(out.files['package.json']), shasum: createHash('sha1').update(tgz).digest('hex'), integrity: `sha512-${createHash('sha512').update(tgz).digest('base64')}`,
        },
    };
}
