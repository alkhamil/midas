// midas — CLI untuk repo paket design system (spec §3.3–§3.4).
//   midas login [--server URL] [--email E]   simpan token akses di ~/.midas/config.json
//   midas whoami                             tampilkan akun yang dipakai
//   midas init <folder> --library <paket>    buat repo paket dari kerangka + Library Kit
//   midas sync [--version X] [--library P]   timpa src/generated dengan Library Kit versi X (default terbaru)
//   midas report [--no-upload] [--json]      setelah build: status kode tiap komponen (ready / not_implemented / mismatch)
//   midas bundle [--no-upload]               setelah build: bundle ESM + CSS untuk Live DOM Renderer di Studio
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { buildStudioBundle } from './bundle.js';

const GENERATED_DIR = 'src/generated';
const DEFAULT_SERVER = 'http://127.0.0.1:4000';

const HELP = `midas — CLI design system Midas

Perintah:
  midas login [--server URL] [--email EMAIL]
  midas whoami
  midas init <folder> --library <@midas/paket> [--version X] [--force]
  midas sync [--version X] [--library <@midas/paket>] [--dir FOLDER]
  midas report [--dir FOLDER] [--no-upload] [--json] [--strict]
  midas bundle [--dir FOLDER] [--no-upload]

Lingkungan:
  MIDAS_SERVER    URL Midas API (default dari midas.config.json / login)
  MIDAS_TOKEN     token akses (untuk CI), menggantikan token dari login
  MIDAS_PASSWORD  password untuk \`midas login\` tanpa prompt
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
                headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
                body: body ? JSON.stringify(body) : undefined,
            });
        } catch (e) {
            throw new Error(`tidak bisa terhubung ke ${base} (${e.cause?.code || e.message})`);
        }
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { message: text };
        }
        // Login gagal: tampilkan pesan server ("Email atau password salah"), bukan saran login ulang.
        if (res.status === 401 && data?.error === 'invalid_credentials') throw new Error(data.message);
        if (res.status === 401) throw new Error('belum login atau token kedaluwarsa — jalankan `midas login`');
        if (!res.ok) throw new Error(data?.message || `request gagal (${res.status})`);
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
        if (target !== base && !target.startsWith(base + sep)) throw new Error(`path tidak valid dari server: ${rel}`);
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
    console.log(`Login sebagai ${me.user.name} <${me.user.email}> di ${server} (token berlaku sampai ${new Date(expiresAt).toLocaleDateString()}).`);
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
    if (!dir || !args.library) throw new Error('pakai: midas init <folder> --library <@midas/paket> [--version X]');
    const target = resolve(dir);
    if (existsSync(target) && readdirSync(target).length && !args.force)
        throw new Error(`folder ${dir} tidak kosong (pakai --force untuk menimpa)`);
    const { request } = connection(args, null);
    const lib = await resolveLibrary(request, args.library);
    const q = args.version ? `?version=${encodeURIComponent(args.version)}` : '';
    const res = await request('GET', `/api/libraries/${encodeURIComponent(lib.id)}/scaffold${q}`);
    writeFiles(target, res.files);
    console.log(`Repo ${res.package}@${res.version} dibuat di ${dir} (${Object.keys(res.files).length} file).`);
    console.log(`Berikutnya: cd ${dir} && npm install, lalu implementasikan komponen di src/components/.`);
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
        if (!wanted) throw new Error('tidak ada midas.config.json — pakai --library <@midas/paket>');
        libraryId = (await resolveLibrary(request, wanted)).id;
    }
    const q = args.version ? `?version=${encodeURIComponent(args.version)}` : '';
    const kit = await request('GET', `/api/libraries/${encodeURIComponent(libraryId)}/kit${q}`);
    rmSync(join(dir, GENERATED_DIR), { recursive: true, force: true });
    writeFiles(dir, kit.files);
    if (pkg && pkg.name === kit.package && pkg.version !== kit.version) {
        pkg.version = kit.version;
        writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
    }
    if (!repo) writeFiles(dir, { 'midas.config.json': JSON.stringify({ server: connection(args, null).server, libraryId, package: kit.package }, null, 2) + '\n' });
    const manifest = JSON.parse(kit.files[`${GENERATED_DIR}/manifest.json`]);
    console.log(`Library Kit ${kit.package}@${kit.version} ditulis ke ${GENERATED_DIR}/ (${manifest.components.length} komponen, ${manifest.tokens.length} token).`);
    console.log('Setelah build, jalankan `midas report` untuk melihat komponen yang belum diimplementasikan atau props-nya belum sesuai desain.');
    for (const w of manifest.warnings) console.log(`Peringatan: ${w}`);
}

// ---------------------------------------------------------------- report
const CHECK_DIR = '.midas';

/**
 * File cek tipe: setiap prop desain (src/generated/props) harus bisa diterima props komponen.
 * Hasilnya `true` bila cocok; bila tidak, tsc melaporkan `{ mismatch_a: true; mismatch_b: true }`.
 */
export function contractCheckSource(names) {
    const lines = names.map(n => `export const ${n}_contract: Expect<Mismatched<D.${n}Props, PropsOf<typeof Lib.${n}>>> = true;`);
    return `// Dibuat oleh \`midas report\` — boleh dihapus.
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
    if (!existsSync(manifestFile)) throw new Error('src/generated/manifest.json tidak ada — jalankan `midas sync` dulu');
    const dist = join(dir, 'dist/index.js');
    if (!existsSync(dist)) throw new Error('dist/index.js tidak ada — jalankan `npm run build` dulu');
    const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const lib = await import(pathToFileURL(dist).href);
    const exported = manifest.components.filter(c => lib[c.exportName] != null && !lib[c.exportName].midasStub).map(c => c.exportName);
    const mismatches = exported.length ? contractMismatches(dir, exported) : {};
    const components = manifest.components.map(c => {
        const value = lib[c.exportName];
        if (value == null) return { exportName: c.exportName, status: 'not_implemented', detail: 'tidak di-export dari src/index.ts' };
        if (value.midasStub) return { exportName: c.exportName, status: 'not_implemented', detail: 'masih kerangka (midasStub)' };
        const bad = mismatches?.[c.exportName];
        if (bad?.length) return { exportName: c.exportName, status: 'mismatch', detail: `props tidak sesuai desain: ${bad.join(', ')}` };
        return { exportName: c.exportName, status: 'ready' };
    });
    const count = s => components.filter(c => c.status === s).length;
    if (args.json) console.log(JSON.stringify({ package: pkg.name, version: pkg.version, components }, null, 2));
    else {
        for (const c of components) console.log(`${{ ready: '✓', not_implemented: '·', mismatch: '✗' }[c.status]} ${c.exportName.padEnd(24)} ${c.status}${c.detail ? ` — ${c.detail}` : ''}`);
        console.log(`\n${pkg.name}@${pkg.version}: ${count('ready')} ready, ${count('not_implemented')} not implemented, ${count('mismatch')} mismatch${mismatches === null ? ' (cek kontrak dilewati: typescript tidak terpasang)' : ''}`);
    }
    if (!args['no-upload']) {
        const repo = readRepoConfig(dir);
        if (!repo?.libraryId) throw new Error('midas.config.json tidak ada — pakai --no-upload atau jalankan `midas sync`');
        const { request } = connection(args, repo);
        const res = await request('POST', `/api/libraries/${encodeURIComponent(repo.libraryId)}/versions/${encodeURIComponent(pkg.version)}/code`, { components });
        if (!args.json) console.log(`Status dikirim ke Midas: kode ${res.codeStatus}.`);
    }
    return args.strict && (count('mismatch') || count('not_implemented')) ? 1 : 0;
}

async function bundle(args) {
    const dir = resolve(args.dir || process.cwd());
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const { js, css } = await buildStudioBundle(dir);
    const kb = n => `${Math.round(n / 1024)} KB`;
    console.log(`Bundle Studio ${pkg.name}@${pkg.version}: index.js ${kb(js.length)}, style.css ${kb(css.length)} (.midas/studio-bundle/)`);
    if (args['no-upload']) return 0;
    const repo = readRepoConfig(dir);
    if (!repo?.libraryId) throw new Error('midas.config.json tidak ada — pakai --no-upload atau jalankan `midas sync`');
    const { request } = connection(args, repo);
    const res = await request('PUT', `/api/libraries/${encodeURIComponent(repo.libraryId)}/versions/${encodeURIComponent(pkg.version)}/bundle`, { js, css });
    console.log(`Diunggah ke Midas: ${res.bundleUrl}`);
    return 0;
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
    if (cmd === 'sync') return sync(args);
    if (cmd === 'report') return report(args);
    if (cmd === 'bundle') return bundle(args);
    console.error(`perintah tidak dikenal: ${cmd}\n\n${HELP}`);
    return 1;
}
