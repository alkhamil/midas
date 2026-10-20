// midas extract <Component> — copy a library component's source into the app so it can be customised.
//
// The published package ships `src/` next to `dist/`. The component and the internal files it needs (helpers, generated
// props) are copied to <app>/src/shared/components/custom/; imports of other library components and icons are pointed at
// the package, so the copy only carries what it must. After that the copy belongs to the app and no longer follows the
// library: import it from the custom folder instead of from the package.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

export const DEFAULT_CUSTOM_DIR = 'src/shared/components/custom';
const EXTENSIONS = ['', '.tsx', '.ts', '/index.tsx', '/index.ts', '.jsx', '.js'];
const IMPORT_RE = /(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g;

const isFile = p => existsSync(p) && statSync(p).isFile();
const posix = p => p.split(sep).join('/');

function resolveRelative(fromFile, spec) {
    const base = resolve(dirname(fromFile), spec);
    // TypeScript sources may import "./x.js" for "./x.ts"
    const bare = base.replace(/\.js$/, '');
    for (const stem of base === bare ? [base] : [base, bare]) for (const ext of EXTENSIONS) if (isFile(stem + ext)) return stem + ext;
    return null;
}

/** Package folder that holds `src/`: --from, or node_modules/<package> of the app. */
export function findPackageDir(appDir, { from, packageName } = {}) {
    if (from) return resolve(from);
    let name = packageName;
    if (!name) {
        const pkgFile = join(appDir, 'package.json');
        const pkg = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, 'utf8')) : {};
        name = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).find(n => /^@midas\/ui-/.test(n));
    }
    if (!name) throw new Error('library package not found in package.json — use --package <@midas/ui-…>');
    const dir = join(appDir, 'node_modules', ...name.split('/'));
    if (!existsSync(dir)) throw new Error(`${name} is not installed in ${appDir} — run npm install`);
    return dir;
}

/**
 * Copy component `name` (and what it needs) from the package folder `pkgDir` into `<appDir>/<to>`.
 * Returns { written: [relative paths], skipped: [...], packageName, version, imports: import path hint }.
 */
export function extractComponent({ appDir, pkgDir, name, to = DEFAULT_CUSTOM_DIR, force = false }) {
    const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    const src = join(pkgDir, 'src');
    const componentsDir = join(src, 'components');
    if (!existsSync(componentsDir)) throw new Error(`${pkg.name}@${pkg.version} does not ship its sources (no src/components) — ask the library maintainer to publish with "src" in package.json "files"`);
    const dir = join(componentsDir, name);
    const main = [`${name}.tsx`, `${name}.ts`, 'index.tsx', 'index.ts'].map(f => join(dir, f)).find(isFile);
    if (!main) {
        const available = readdirSync(componentsDir).filter(d => statSync(join(componentsDir, d)).isDirectory());
        throw new Error(`component "${name}" not found in ${pkg.name}. Available: ${available.join(', ')}`);
    }
    const customRoot = resolve(appDir, to);
    const destOf = file => {
        const rel = posix(relative(src, file));
        const own = `components/${name}/`;
        return rel.startsWith(own) ? join(customRoot, name, rel.slice(own.length)) : join(customRoot, '_shared', rel);
    };
    // Other library components and icons stay in the package: importing them from there keeps one source of truth.
    const external = file => {
        const rel = posix(relative(src, file));
        if (/^components\/[^/]+\//.test(rel) && !rel.startsWith(`components/${name}/`)) return true;
        return /^generated\/icons(\/|$)/.test(rel) || /^index\.(tsx?|jsx?)$/.test(rel);
    };
    const out = new Map(); // dest path → content
    const seen = new Set();
    // The generated props index re-exports every component's props; the copy only needs its own, so it gets a small index.
    const propsIndex = join(customRoot, '_shared/generated/props/index.ts');
    const propsIndexLines = [];
    const isPropsIndex = file => /^generated\/props\/index\.[jt]sx?$/.test(posix(relative(src, file)));
    const visit = file => {
        if (seen.has(file)) return;
        seen.add(file);
        const dest = destOf(file);
        const text = readFileSync(file, 'utf8').replace(IMPORT_RE, (whole, lead, quote, spec) => {
            const target = resolveRelative(file, spec);
            if (!target) return whole;
            if (external(target)) return `${lead}${quote}${pkg.name}${quote}`;
            if (isPropsIndex(target)) {
                const own = join(src, 'generated/props', `${name}.ts`);
                if (isFile(own)) { visit(own); propsIndexLines.push(`export * from './${name}';`); }
            }
            else visit(target);
            let next = posix(relative(dirname(dest), destOf(target)));
            if (!/\.[jt]sx?$/.test(spec)) {
                next = next.replace(/\.[jt]sx?$/, '');
                if (/\/index$/.test(next) && !/\/index$/.test(spec)) next = next.replace(/\/index$/, ''); // directory import stays one
            }
            return `${lead}${quote}${next.startsWith('.') ? next : `./${next}`}${quote}`;
        });
        out.set(dest, file === main
            ? `// Extracted from ${pkg.name}@${pkg.version} with \`midas extract ${name}\`.\n// This copy belongs to the app: edit freely. It no longer follows library updates.\n${text}`
            : text);
    };
    visit(main);
    const written = [], skipped = [];
    for (const [dest, content] of out) {
        // Shared helpers are reused between extracted components; never overwrite an edited copy unless forced.
        if (existsSync(dest) && !force) { skipped.push(posix(relative(appDir, dest))); continue; }
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, content);
        written.push(posix(relative(appDir, dest)));
    }
    if (propsIndexLines.length) {
        const have = existsSync(propsIndex) ? readFileSync(propsIndex, 'utf8') : '';
        const add = propsIndexLines.filter(l => !have.includes(l));
        if (add.length) {
            mkdirSync(dirname(propsIndex), { recursive: true });
            writeFileSync(propsIndex, have + add.map(l => `${l}\n`).join(''));
            written.push(posix(relative(appDir, propsIndex)));
        }
    }
    const indexFile = join(customRoot, 'index.ts');
    const line = `export * from './${name}/${basename(destOf(main)).replace(/\.[jt]sx?$/, '')}';\n`;
    const current = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : '';
    if (!current.includes(line.trim())) {
        mkdirSync(dirname(indexFile), { recursive: true });
        writeFileSync(indexFile, current + line);
        written.push(posix(relative(appDir, indexFile)));
    }
    return { written, skipped, packageName: pkg.name, version: pkg.version, importPath: posix(relative(appDir, customRoot)) };
}
