// Builds the Rust core (crates/midas-core through its bindings crate crates/midas-wasm) to WASM for builder-core with wasm-pack.
// The output is packages/builder-core/src/core/pkg (generated, not committed). A build is skipped while the output is newer than every
// Rust source and manifest; `--force` always builds, `--dev` builds without optimisation (faster, bigger).
// Needs cargo, rustc and wasm-pack on the PATH (`~/.cargo/bin` is added); it names what is missing instead of failing in the middle.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const crates = ['midas-core', 'midas-wasm'].map(c => join(root, 'crates', c)), crate = crates[1];
const out = join(root, 'packages', 'builder-core', 'src', 'core', 'pkg');
const wasm = join(out, 'midas_core_bg.wasm');
const force = process.argv.includes('--force'), dev = process.argv.includes('--dev');
const env = { ...process.env, PATH: [join(homedir(), '.cargo', 'bin'), process.env.PATH].join(delimiter) };

const newest = dir => readdirSync(dir, { withFileTypes: true }).reduce((m, e) => Math.max(m, e.isDirectory() ? newest(join(dir, e.name)) : statSync(join(dir, e.name)).mtimeMs), 0);
const sources = () => Math.max(...crates.flatMap(c => [newest(join(c, 'src')), statSync(join(c, 'Cargo.toml')).mtimeMs]), statSync(join(root, 'Cargo.toml')).mtimeMs);

if (!force && existsSync(wasm) && statSync(wasm).mtimeMs >= sources()) process.exit(0);

for (const tool of ['cargo', 'rustc', 'wasm-pack']) {
    const r = spawnSync(tool, ['--version'], { env, shell: process.platform === 'win32', encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(`build-core: ${tool} is not available (${(r.stderr || r.error?.message || '').trim()}).\nInstall Rust from https://rustup.rs, then: rustup target add wasm32-unknown-unknown && cargo install wasm-pack --locked`);
        process.exit(1);
    }
}
const args = ['build', crate, '--target', 'web', dev ? '--dev' : '--release', '--out-dir', out, '--out-name', 'midas_core'];
const r = spawnSync('wasm-pack', args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
process.exit(r.status ?? 1);
