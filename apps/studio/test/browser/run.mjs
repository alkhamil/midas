// Runs the browser tests: `npm run test:browser [-- --dev] [-- <test files>]`.
//   (default)  the studio is the production build served by `vite preview`; the servers start once for the whole run
//   --dev      the Vite dev server instead (the fallback when the production build is the problem)
//   --no-build keep the existing build in apps/studio/dist
// Files default to every *.browser.test.mjs; any other argument is passed to `node --test` (a file, or --test-name-pattern=...).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dev = args.includes('--dev'), noBuild = args.includes('--no-build');
const rest = args.filter(a => a !== '--dev' && a !== '--no-build');
const files = rest.filter(a => a.endsWith('.mjs')).map(f => resolve(process.cwd(), f));
const flags = rest.filter(a => !a.endsWith('.mjs'));
const targets = files.length ? files : readdirSync(here).filter(f => f.endsWith('.browser.test.mjs')).map(f => join(here, f));
const env = { ...process.env, MIDAS_STUDIO: dev ? 'dev' : 'preview', ...(noBuild ? { MIDAS_SKIP_BUILD: '1' } : {}) };
const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', `--test-global-setup=${join(here, 'global-setup.mjs')}`, ...flags, ...targets], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
