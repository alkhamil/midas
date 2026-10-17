// midas — CLI untuk repo paket design system (spec §3.3–§3.4).
//   midas login [--server URL] [--email E]   simpan token akses di ~/.midas/config.json
//   midas whoami                             tampilkan akun yang dipakai
//   midas init <folder> --library <paket>    buat repo paket dari kerangka + Library Kit
//   midas sync [--version X] [--library P]   timpa src/generated dengan Library Kit versi X (default terbaru)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';

const GENERATED_DIR = 'src/generated';
const DEFAULT_SERVER = 'http://127.0.0.1:4000';

const HELP = `midas — CLI design system Midas

Perintah:
  midas login [--server URL] [--email EMAIL]
  midas whoami
  midas init <folder> --library <@midas/paket> [--version X] [--force]
  midas sync [--version X] [--library <@midas/paket>] [--dir FOLDER]

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
    const missing = manifest.components.filter(c => !existsSync(join(dir, 'src/components', c.exportName, `${c.exportName}.tsx`)));
    if (missing.length) console.log(`Komponen baru tanpa file di src/components: ${missing.map(c => c.exportName).join(', ')}`);
    for (const w of manifest.warnings) console.log(`Peringatan: ${w}`);
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
    console.error(`perintah tidak dikenal: ${cmd}\n\n${HELP}`);
    return 1;
}
