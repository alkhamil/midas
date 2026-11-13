// Desktop shell scripts: `node scripts/desktop.mjs dev|build` (npm run dev:desktop / build:desktop).
// Runs the WASM core pre-hook, then `tauri dev` or `tauri build`. On Windows the MSVC developer environment
// (vcvars64.bat) is loaded inside the child cmd only, so the global PATH is not changed. VCVARS64 may name the
// .bat file to use; otherwise vswhere finds the newest Visual Studio with the C++ tools.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2];
if (!['dev', 'build'].includes(command)) {
    console.error('usage: node scripts/desktop.mjs dev|build');
    process.exit(2);
}

function vcvars() {
    if (process.env.VCVARS64) return process.env.VCVARS64;
    const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    const found = spawnSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' });
    const installPath = found.status === 0 ? found.stdout.trim() : '';
    const bat = join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
    if (!installPath || !existsSync(bat)) {
        console.error('desktop: the MSVC build tools were not found. Install "Desktop development with C++" in Visual Studio 2022, or set VCVARS64 to the path of vcvars64.bat.');
        process.exit(1);
    }
    return bat;
}

// The WASM core is built before the shell, as it is before dev, build and test.
const core = spawnSync(process.execPath, [join(root, 'scripts', 'build-core.mjs')], { stdio: 'inherit' });
if (core.status !== 0) process.exit(core.status ?? 1);

const tauriArgs = command === 'dev' ? 'dev' : 'build';
if (process.platform === 'win32') {
    const line = `call "${vcvars()}" >nul && npx tauri ${tauriArgs}`;
    const run = spawnSync('cmd.exe', ['/d', '/s', '/c', `"${line}"`], { cwd: root, stdio: 'inherit', windowsVerbatimArguments: true });
    process.exit(run.status ?? 1);
}
const run = spawnSync('npx', ['tauri', tauriArgs], { cwd: root, stdio: 'inherit' });
process.exit(run.status ?? 1);
