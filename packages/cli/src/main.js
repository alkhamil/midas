// midas — CLI for design system package repos and Code Builder apps (spec §3.3–§3.4).
//   midas login [--server URL] [--email E]   store the access token in ~/.midas/config.json
//   midas whoami                             show the account in use
//   midas init <folder> --library <paket>    create a package repo from the scaffold + Library Kit
//   midas sync [--version X] [--library P]   overwrite src/generated with the Library Kit of version X (default: "pin" in midas.config.json, else latest)
//   midas report [--no-upload] [--json]      after build: code status of each component (ready / not_implemented / mismatch)
//   midas bundle [--no-upload]               after build: ESM + CSS bundle for the Studio Live DOM Renderer
//   midas generate [project] [--out DIR]     pull Code Builder output (modules, routes, menu) into an app repo
//   midas extract <Component> [--to DIR]     copy a library component's source into the app (src/shared/components/custom)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { buildStudioBundle } from './bundle.js';
import { DEFAULT_CUSTOM_DIR, extractComponent, findPackageDir } from './extract.js';
import { generateFromServer, listProjects } from './generate.js';

const GENERATED_DIR = 'src/generated';
const DEFAULT_SERVER = 'http://127.0.0.1:4000';

const HELP = `midas — Midas design system CLI

Commands:
  midas login [--server URL] [--email EMAIL]
  midas whoami
  midas init <folder> --library <@midas/package> [--version X] [--force]
  midas sync [--version X] [--library <@midas/package>] [--dir FOLDER] [--soft]
  midas report [--dir FOLDER] [--no-upload] [--json] [--strict] [--soft]
  midas bundle [--dir FOLDER] [--no-upload] [--soft]
  midas generate [<project>] [--out FOLDER] [--list] [--dry-run]
  midas extract <Component> [--dir APP] [--to FOLDER] [--package <@midas/ui-…>] [--from <package folder>] [--force]

Environment:
  MIDAS_OFFLINE   set to 1 to skip the --soft steps (sync/report/bundle at build time)
  MIDAS_SERVER    Midas API URL (default from midas.config.json / login)
  MIDAS_TOKEN     access token (for CI), replaces the token from login
  MIDAS_PASSWORD  password for \`midas login\` without a prompt
`;

export function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const [k, v] = a.slice(2).split('=', 2);
            if (v !== undefined) out[k] = v;
            else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
            else out[k] = true;
        }
        else out._.push(a);
    }
    return out;
}

export const configPath = () => join(process.env.MIDAS_HOME || join(homedir(), '.midas'), 'config.json');

export function readUserConfig() {
    try {
        return JSON.parse(readFileSync(configPath(), 'utf8'));
    } catch {
        return {};
    }
}

function writeUserConfig(cfg) {
    mkdirSync(dirname(configPath()), { recursive: true });
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
}

function readRepoConfig(dir) {
    const file = join(dir, 'midas.config.json');
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf8'));
}

/** Klien Midas API. Token dari MIDAS_TOKEN atau `midas login`. */
export function client(server, token) {
    const base = server.replace(/\/+$/, '');
    return async function request(method, path, body) {
        let res;
        try {
            res = await fetch(base + path, {
                method,
                headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': Buffer.isBuffer(body) ? 'application/gzip' : 'application/json' } : {}) },
                body: body ? (Buffer.isBuffer(body) ? body : JSON.stringify(body)) : undefined,
            });
        } catch (e) {
            throw new Error(`cannot connect to ${base} (${e.cause?.code || e.message})`);
        }
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { message: text };
        }
        // Login gagal: tampilkan pesan server ("Wrong email or password"), bukan saran login ulang.
        if (res.status === 401 && data?.error === 'invalid_credentials') throw new Error(data.message);
        if (res.status === 401) throw new Error('not signed in or the token has expired — run `midas login`');
        if (!res.ok) throw new Error(data?.message || `request failed (${res.status})`);
        return data;
    };
}

function connection(args, repo) {
    const user = readUserConfig();
    const server = args.server || process.env.MIDAS_SERVER || repo?.server || user.server || DEFAULT_SERVER;
    const token = process.env.MIDAS_TOKEN || (user.server && user.server.replace(/\/+$/, '') !== server.replace(/\/+$/, '') ? null : user.token);
    return { server, request: client(server, token) };
}

function ask(question, { hidden = false } = {}) {
    return new Promise(res => {
        const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        if (hidden) rl._writeToOutput = s => rl.output.write(s.includes(question) ? s : '');
        rl.question(question, answer => {
            rl.close();
            if (hidden) process.stdout.write('\n');
            res(answer.trim());
        });
    });
}

/** Tulis file relatif terhadap `root`; menolak path yang keluar dari `root`. */
export function writeFiles(root, files) {
    const base = resolve(root);
    for (const [rel, content] of Object.entries(files)) {
        const target = resolve(base, rel);
        if (target !== base && !target.startsWith(base + sep)) throw new Error(`invalid path from the server: ${rel}`);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
    }
}

async function login(args) {
    const server = args.server || process.env.MIDAS_SERVER || readUserConfig().server || DEFAULT_SERVER;
    const email = args.email || await ask('Email: ');
    const password = process.env.MIDAS_PASSWORD || await ask('Password: ', { hidden: true });
    const { token, expiresAt } = await client(server)('POST', '/api/auth/tokens', { email, password });
    writeUserConfig({ ...readUserConfig(), server, token });
    const me = await client(server, token)('GET', '/api/auth/me');
    console.log(`Signed in as ${me.user.name} <${me.user.email}> at ${server} (token valid until ${new Date(expiresAt).toLocaleDateString()}).`);
}

async function whoami(args) {
    const { server, request } = connection(args, readRepoConfig(process.cwd()));
    const me = await request('GET', '/api/auth/me');
    console.log(`${me.user.name} <${me.user.email}> · ${server}`);
}

async function resolveLibrary(request, pkg) {
    return request('GET', `/api/libraries/resolve?package=${encodeURIComponent(pkg)}`);
}

async function init(args) {
    const dir = args._[1];
    if (!dir || !args.library) throw new Error('usage: midas init <folder> --library <@midas/package> [--version X]');
    const target = resolve(dir);
    if (existsSync(target) && readdirSync(target).length && !args.force)
        throw new Error(`folder ${dir} is not empty (use --force to overwrite)`);
    const { request } = connection(args, null);
    const lib = await resolveLibrary(request, args.library);
    const q = args.version ? `?version=${encodeURIComponent(args.version)}` : '';
    const res = await request('GET', `/api/libraries/${encodeURIComponent(lib.id)}/scaffold${q}`);
    writeFiles(target, res.files);
    console.log(`Repo ${res.package}@${res.version} created in ${dir} (${Object.keys(res.files).length} files).`);
    console.log(`Next: cd ${dir} && npm install, then implement the components in src/components/.`);
}

/** Same files with the same content already in src/generated (so an automatic sync at build time changes nothing). */
function kitUpToDate(dir, files) {
    const root = join(dir, GENERATED_DIR);
    if (!existsSync(root)) return false;
    const onDisk = [];
    const walk = d => { for (const e of readdirSync(d, { withFileTypes: true })) (e.isDirectory() ? walk(join(d, e.name)) : onDisk.push(join(d, e.name))); };
    walk(root);
    const wanted = Object.keys(files).filter(f => f.startsWith(`${GENERATED_DIR}/`));
    if (onDisk.length !== wanted.length) return false;
    return wanted.every(f => existsSync(join(dir, f)) && readFileSync(join(dir, f), 'utf8') === files[f]);
}

/** package.json follows the library version when it is the same package. */
function syncPackageVersion(dir, pkg, kit) {
    if (pkg && pkg.name === kit.package && pkg.version !== kit.version) {
        pkg.version = kit.version;
        writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
        console.log(`package.json version → ${kit.version}`);
    }
}

async function sync(args) {
    const dir = resolve(args.dir || process.cwd());
    const repo = readRepoConfig(dir);
    const pkgFile = join(dir, 'package.json');
    const pkg = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, 'utf8')) : null;
    const { request } = connection(args, repo);
    let libraryId = repo?.libraryId;
    const wanted = args.library || repo?.package || pkg?.name;
    if (args.library || !libraryId) {
        if (!wanted) throw new Error('midas.config.json not found — use --library <@midas/package>');
        libraryId = (await resolveLibrary(request, wanted)).id;
    }
    // Version: --version, else the "pin" of midas.config.json (stay on a version), else the latest.
    const targetVersion = args.version || repo?.pin;
    const q = targetVersion ? `?version=${encodeURIComponent(targetVersion)}` : '';
    const kit = await request('GET', `/api/libraries/${encodeURIComponent(libraryId)}/kit${q}`);
    if (kitUpToDate(dir, kit.files)) {
        syncPackageVersion(dir, pkg, kit);
        if (!args.quiet) console.log(`Library Kit ${kit.package}@${kit.version} is up to date.`);
        return;
    }
    rmSync(join(dir, GENERATED_DIR), { recursive: true, force: true });
    writeFiles(dir, kit.files);
    syncPackageVersion(dir, pkg, kit);
    if (!repo) writeFiles(dir, { 'midas.config.json': JSON.stringify({ server: connection(args, null).server, libraryId, package: kit.package }, null, 2) + '\n' });
    const manifest = JSON.parse(kit.files[`${GENERATED_DIR}/manifest.json`]);
    console.log(`Library Kit ${kit.package}@${kit.version} written to ${GENERATED_DIR}/ (${manifest.components.length} components, ${manifest.tokens.length} tokens).`);
    console.log('After building, run `midas report` to see components that are not implemented yet or whose props do not match the design.');
    for (const w of manifest.warnings) console.log(`Warning: ${w}`);
}

// ---------------------------------------------------------------- report
const CHECK_DIR = '.midas';

/**
 * File cek tipe: setiap prop desain (src/generated/props) harus bisa diterima props komponen.
 * Hasilnya `true` bila cocok; bila tidak, tsc melaporkan `{ mismatch_a: true; mismatch_b: true }`.
 */
export function contractCheckSource(names) {
    const lines = names.map(n => `export const ${n}_contract: Expect<Mismatched<D.${n}Props, PropsOf<typeof Lib.${n}>>> = true;`);
    return `// Created by \`midas report\` — safe to delete.
import type { JSXElementConstructor } from 'react';
import type * as Lib from '../src/index';
import type * as D from '../src/generated/props';

type PropsOf<C> = C extends JSXElementConstructor<infer P> ? P : never;
type Mismatched<Design, Props> = {
  [K in Exclude<keyof Design, 'testId'>]-?: K extends keyof Props
    ? (NonNullable<Design[K]> extends NonNullable<Props[K]> ? never : K)
    : K;
}[Exclude<keyof Design, 'testId'>];
// Kunci objek selalu dijabarkan tsc di pesan error → nama prop terbaca: { mismatch_size: true; … }
type Expect<T> = [T] extends [never] ? true : { [K in T & string as \`mismatch_\${K}\`]: true };

${lines.join('\n')}
`;
}

/** Jalankan tsc repo pada file cek; kembalikan nama komponen → prop yang tidak cocok. */
function contractMismatches(dir, names) {
    let tsc;
    try {
        tsc = createRequire(join(dir, 'package.json')).resolve('typescript/bin/tsc');
    } catch {
        return null; // TypeScript tidak terpasang: lewati cek kontrak
    }
    mkdirSync(join(dir, CHECK_DIR), { recursive: true });
    writeFileSync(join(dir, CHECK_DIR, 'contract.check.ts'), contractCheckSource(names));
    writeFileSync(join(dir, CHECK_DIR, 'tsconfig.json'), JSON.stringify({ extends: '../tsconfig.json', compilerOptions: { noEmit: true }, include: ['contract.check.ts'] }, null, 2));
    let out = '';
    try {
        execFileSync(process.execPath, [tsc, '-p', join(dir, CHECK_DIR, 'tsconfig.json'), '--pretty', 'false'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
        out = `${e.stdout || ''}${e.stderr || ''}`;
    }
    const result = {};
    for (const line of out.split('\n')) {
        const m = /contract\.check\.ts\((\d+),\d+\): error TS\d+: (.*)$/.exec(line);
        if (!m) continue;
        const name = /export const (\w+)_contract/.exec(readFileSync(join(dir, CHECK_DIR, 'contract.check.ts'), 'utf8').split('\n')[Number(m[1]) - 1] || '')?.[1];
        if (!name) continue;
        const props = [...m[2].matchAll(/mismatch_(\w+)/g)].map(x => x[1]);
        result[name] = props.length ? props : [m[2]];
    }
    return result;
}

async function report(args) {
    const dir = resolve(args.dir || process.cwd());
    const manifestFile = join(dir, GENERATED_DIR, 'manifest.json');
    if (!existsSync(manifestFile)) throw new Error('src/generated/manifest.json not found — run `midas sync` first');
    const dist = join(dir, 'dist/index.js');
    if (!existsSync(dist)) throw new Error('dist/index.js not found — run `npm run build` first');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const lib = await import(pathToFileURL(dist).href);
    const exported = manifest.components.filter(c => lib[c.exportName] != null && !lib[c.exportName].midasStub).map(c => c.exportName);
    const mismatches = exported.length ? contractMismatches(dir, exported) : {};
    const components = manifest.components.map(c => {
        const value = lib[c.exportName];
        if (value == null) return { exportName: c.exportName, status: 'not_implemented', detail: 'not exported from src/index.ts' };
        if (value.midasStub) return { exportName: c.exportName, status: 'not_implemented', detail: 'masih kerangka (midasStub)' };
        const bad = mismatches?.[c.exportName];
        if (bad?.length) return { exportName: c.exportName, status: 'mismatch', detail: `props do not match the design: ${bad.join(', ')}` };
        return { exportName: c.exportName, status: 'ready' };
    });
    const count = s => components.filter(c => c.status === s).length;
    if (args.json) console.log(JSON.stringify({ package: pkg.name, version: pkg.version, components }, null, 2));
    else {
        for (const c of components) console.log(`${{ ready: '✓', not_implemented: '·', mismatch: '✗' }[c.status]} ${c.exportName.padEnd(24)} ${c.status}${c.detail ? ` — ${c.detail}` : ''}`);
        console.log(`\n${pkg.name}@${pkg.version}: ${count('ready')} ready, ${count('not_implemented')} not implemented, ${count('mismatch')} mismatch${mismatches === null ? ' (contract check skipped: typescript is not installed)' : ''}`);
    }
    if (!args['no-upload']) {
        const repo = readRepoConfig(dir);
        if (!repo?.libraryId) throw new Error('midas.config.json not found — use --no-upload or run `midas sync`');
        const { request } = connection(args, repo);
        const res = await request('POST', `/api/libraries/${encodeURIComponent(repo.libraryId)}/versions/${encodeURIComponent(pkg.version)}/code`, { components });
        if (!args.json) console.log(`Status sent to Midas: code ${res.codeStatus}.`);
    }
    return args.strict && (count('mismatch') || count('not_implemented')) ? 1 : 0;
}

async function bundle(args) {
    const dir = resolve(args.dir || process.cwd());
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const { js, css } = await buildStudioBundle(dir);
    const kb = n => `${Math.round(n / 1024)} KB`;
    console.log(`Studio bundle ${pkg.name}@${pkg.version}: index.js ${kb(js.length)}, style.css ${kb(css.length)} (.midas/studio-bundle/)`);
    if (args['no-upload']) return 0;
    const repo = readRepoConfig(dir);
    if (!repo?.libraryId) throw new Error('midas.config.json not found — use --no-upload or run `midas sync`');
    const { request } = connection(args, repo);
    const res = await request('PUT', `/api/libraries/${encodeURIComponent(repo.libraryId)}/versions/${encodeURIComponent(pkg.version)}/bundle`, { js, css });
    console.log(`Uploaded to Midas: ${res.bundleUrl}`);
    // Also upload the built npm package: Studio's "Download project" embeds it, so developers need no registry login.
    const out = join(dir, '.midas');
    mkdirSync(out, { recursive: true });
    const file = execFileSync('npm', ['pack', '--silent', '--pack-destination', out], { cwd: dir, encoding: 'utf8' }).trim().split('\n').at(-1);
    const tgz = readFileSync(join(out, file));
    await request('PUT', `/api/libraries/${encodeURIComponent(repo.libraryId)}/versions/${encodeURIComponent(pkg.version)}/package`, tgz);
    console.log(`Package ${file} uploaded (${Math.round(tgz.length / 1024)} KB) for "Download project"`);
    return 0;
}

async function generate(args) {
    const out = resolve(args.out || process.cwd());
    const { request } = connection(args, readRepoConfig(out));
    if (args.list) return listProjects(request);
    return generateFromServer(request, { out, project: args._[1], dryRun: !!args['dry-run'] });
}

/** Copy a library component into the app for customising (default folder src/shared/components/custom). */
async function extract(args) {
    const name = args._[1];
    if (!name) throw new Error('usage: midas extract <Component> [--to src/shared/components/custom] [--package @midas/ui-…]');
    const appDir = resolve(args.dir || process.cwd());
    const pkgDir = findPackageDir(appDir, { from: args.from, packageName: args.package });
    const res = extractComponent({ appDir, pkgDir, name, to: typeof args.to === 'string' ? args.to : DEFAULT_CUSTOM_DIR, force: !!args.force });
    console.log(`Extracted ${name} from ${res.packageName}@${res.version}:`);
    for (const f of res.written) console.log(`  + ${f}`);
    for (const f of res.skipped) console.log(`  = ${f} (already there, kept — use --force to overwrite)`);
    console.log(`\nImport your copy instead of the package component, e.g.\n  import { ${name} } from '@/${res.importPath.replace(/^src\//, '')}';   // or a relative path`);
    return 0;
}

/**
 * `--soft` (used by the package scripts that run at build time): never fail the build because Midas is unreachable, the
 * user is not signed in, or this is not a Midas package; print one line and carry on. MIDAS_OFFLINE=1 skips the step.
 */
async function soft(args, run) {
    if (!args.soft) return run();
    if (process.env.MIDAS_OFFLINE === '1') return 0;
    try {
        return await run();
    } catch (e) {
        console.log(`midas ${args._[0]}: skipped (${e.message})`);
        return 0;
    }
}

export async function main(argv) {
    const args = parseArgs(argv);
    const cmd = args._[0];
    if (!cmd || args.help || cmd === 'help') {
        console.log(HELP);
        return 0;
    }
    if (cmd === 'login') return login(args);
    if (cmd === 'whoami') return whoami(args);
    if (cmd === 'init') return init(args);
    if (cmd === 'sync') return soft(args, () => sync({ ...args, ...(args.soft ? { quiet: true } : {}) }));
    if (cmd === 'report') return soft(args, () => report(args));
    if (cmd === 'bundle') return soft(args, () => bundle(args));
    if (cmd === 'generate') return generate(args);
    if (cmd === 'extract') return extract(args);
    console.error(`unknown command: ${cmd}\n\n${HELP}`);
    return 1;
}
