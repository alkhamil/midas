import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { bumpVersion, listArg, packageFromFileName, pickPackageName } from '../../../scripts/lib/library-name.mjs';
import { extractComponent } from '../src/extract.js';
import { parseArgs, writeFiles } from '../src/main.js';

test('parseArgs reads flags and positionals', () => {
    assert.deepEqual(parseArgs(['init', 'ui-cms', '--library', '@midas/ui-cms', '--force', '--version=1.2.0']), {
        _: ['init', 'ui-cms'], library: '@midas/ui-cms', force: true, version: '1.2.0',
    });
});

test('writeFiles writes nested files and refuses paths outside the folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'midas-cli-'));
    writeFiles(dir, { 'src/generated/theme.ts': 'x' });
    assert.equal(readFileSync(join(dir, 'src/generated/theme.ts'), 'utf8'), 'x');
    assert.throws(() => writeFiles(dir, { '../evil.txt': 'x' }), /invalid path/);
    assert.throws(() => writeFiles(dir, { '/etc/evil': 'x' }), /invalid path/);
});

test('report finds stubs, missing exports and props that do not match the design', async () => {
    const { execFileSync } = await import('node:child_process');
    const dir = new URL('./fixtures/report-repo/', import.meta.url).pathname;
    const out = execFileSync(process.execPath, [new URL('../bin/midas.js', import.meta.url).pathname, 'report', '--no-upload', '--json'], { cwd: dir, encoding: 'utf8' });
    const byName = Object.fromEntries(JSON.parse(out).components.map(c => [c.exportName, c]));
    assert.equal(byName.Good.status, 'ready');
    assert.equal(byName.Bad.status, 'mismatch');
    assert.deepEqual(byName.Bad.detail.replace('props do not match the design: ', '').split(', ').sort(), ['label', 'size', 'variant']);
    assert.equal(byName.Stub.status, 'not_implemented');
    assert.equal(byName.Missing.status, 'not_implemented');
});

test('studioEntry re-exports the package and the providers the renderer needs', async () => {
    const { studioEntry } = await import('../src/bundle.js');
    const src = studioEntry({ peerDependencies: { react: '*', 'react-router': '*', 'react-i18next': '*', i18next: '*' } }, { libEntry: '../dist/index.js', cssEntry: './studio.css' });
    assert.match(src, /import '\.\/studio\.css';/);
    assert.match(src, /export \* from '\.\.\/dist\/index\.js';/);
    assert.match(src, /export const __midasRuntime = \{ MemoryRouter, createMemoryRouter, RouterProvider, I18nextProvider, initReactI18next, i18next \};/);
    const bare = studioEntry({}, { libEntry: './x.js', cssEntry: null });
    assert.doesNotMatch(bare, /import '/);
    assert.match(bare, /__midasRuntime = \{  \}/);
});

test('latinFontsOnly keeps latin subsets and fonts without unicode-range', async () => {
    const { latinFontsOnly } = await import('../src/bundle.js');
    const css = '@font-face{font-family:A;unicode-range:U+0301,U+0400-045F}@font-face{font-family:B;unicode-range:U+0000-00FF,U+0131}@font-face{font-family:C;unicode-range:U+0100-02BA}@font-face{font-family:D}.x{color:red}';
    assert.equal(latinFontsOnly(css), '@font-face{font-family:B;unicode-range:U+0000-00FF,U+0131}@font-face{font-family:C;unicode-range:U+0100-02BA}@font-face{font-family:D}.x{color:red}');
});

test('generate writes module files, removes stale ones and pins the library version', async () => {
    const { existsSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { generateFromServer } = await import('../src/generate.js');
    const out = mkdtempSync(join(tmpdir(), 'midas-gen-'));
    mkdirSync(join(out, 'src/modules/dashboard'), { recursive: true });
    writeFileSync(join(out, 'src/modules/dashboard/index.ts'), '// bawaan base project\n');
    writeFileSync(join(out, 'package.json'), JSON.stringify({ dependencies: { '@midas/ui-x': '1.0.0' } }));
    const nodes = [
        { id: 'set', name: 'Button', type: 'frame', componentSet: true, libRef: 'lib:btn', cprops: [{ id: 'cp', name: 'Label', type: 'text', def: 'Button' }] },
        { id: 'v', parentId: 'set', name: 'Default', type: 'frame', component: true, variant: {}, libRef: 'lib:btn-v' },
        { id: 'frame', name: 'Home', type: 'frame', w: 1000, h: 500, layout: 'vertical' },
        { id: 'b', parentId: 'frame', type: 'frame', isInstance: true, sourceId: 'v', w: 100, h: 40, name: 'Go', propValues: { cp: 'Pergi' } },
    ];
    let config = { modules: [{ id: 'm', name: 'dashboard', label: 'Dashboard', parentId: null, pageId: 'p', screens: [{ id: 's', frameId: 'frame', pageId: 'p', name: 'Dashboard', role: 'custom', nodes: {} }] }] };
    const project = () => ({ id: 'pr', name: 'Demo', fileId: 'f', library: { id: 'lib', packageName: '@midas/ui-x', version: '1.2.0' }, config });
    const request = async (method, path) => {
        if (path === '/api/builder-projects') return { projects: [{ id: 'pr', name: 'Demo' }] };
        if (path === '/api/builder-projects/pr') return { project: project() };
        if (path === '/api/files/f/export') return { pages: [{ id: 'p', nodes }], variables: { items: [] } };
        if (path.endsWith('/mappings')) return { mappings: [{ componentKey: 'btn', exportName: 'Button', propsMap: { props: [{ source: 'text', key: 'cp', name: 'children', type: 'string' }] } }] };
        throw new Error(`unexpected ${method} ${path}`);
    };
    const quiet = console.log;
    console.log = () => {};
    try {
        assert.equal(await generateFromServer(request, { out, project: 'Demo', dryRun: false }), 0);
        const page = readFileSync(join(out, 'src/modules/dashboard/pages/DashboardPage.tsx'), 'utf8');
        assert.match(page, /<Button/);
        assert.match(readFileSync(join(out, 'src/modules/dashboard/i18n/en.json'), 'utf8'), /Pergi/);
        assert.equal(JSON.parse(readFileSync(join(out, 'package.json'), 'utf8')).dependencies['@midas/ui-x'], '1.2.0');
        const manifest = JSON.parse(readFileSync(join(out, '.midas/generated.json'), 'utf8'));
        assert.ok(manifest.files.includes('src/modules/dashboard/pages/DashboardPage.tsx'));
        assert.ok(!manifest.files.includes('src/modules/dashboard/index.ts')); // file bawaan ditimpa tapi tidak dimiliki generator
        // regenerate tanpa module: file hasil generate hilang, file bawaan tetap ada
        config = { modules: [] };
        await generateFromServer(request, { out, project: undefined, dryRun: false });
        assert.ok(!existsSync(join(out, 'src/modules/dashboard/pages/DashboardPage.tsx')));
        assert.ok(existsSync(join(out, 'src/modules/dashboard/index.ts')));
    }
    finally {
        console.log = quiet;
    }
});

test('extract copies a component with its internal helpers and points other components and icons at the package', () => {
    const root = mkdtempSync(join(tmpdir(), 'midas-extract-'));
    const pkg = join(root, 'pkg'), app = join(root, 'app');
    const put = (base, rel, text) => { mkdirSync(join(base, rel, '..'), { recursive: true }); writeFileSync(join(base, rel), text); };
    put(pkg, 'package.json', JSON.stringify({ name: '@midas/ui-test', version: '1.2.3' }));
    put(pkg, 'src/index.ts', "export * from './components/Foo/Foo';\n");
    put(pkg, 'src/components/Foo/Foo.tsx', "import { cx } from '../../internal/cx';\nimport { fooDefaults } from '../../generated/props';\nimport { Bar } from '../Bar/Bar';\nimport { CloseIcon } from '../../generated/icons';\nexport const Foo = () => cx(fooDefaults, Bar, CloseIcon);\n");
    put(pkg, 'src/components/Bar/Bar.tsx', 'export const Bar = 1;\n');
    put(pkg, 'src/internal/cx.ts', 'export const cx = (...a) => a.join(" ");\n');
    put(pkg, 'src/generated/props/index.ts', "export * from './Foo';\n");
    put(pkg, 'src/generated/props/Foo.ts', 'export const fooDefaults = {};\n');
    put(pkg, 'src/generated/icons/index.ts', 'export const CloseIcon = 1;\n');
    put(app, 'package.json', '{}');
    const res = extractComponent({ appDir: app, pkgDir: pkg, name: 'Foo' });
    const custom = join(app, 'src/shared/components/custom');
    const main = readFileSync(join(custom, 'Foo/Foo.tsx'), 'utf8');
    assert.match(main, /Extracted from @midas\/ui-test@1\.2\.3/);
    assert.match(main, /from '\.\.\/_shared\/internal\/cx'/);
    assert.match(main, /from '\.\.\/_shared\/generated\/props'/);          // directory import stays a directory import
    assert.match(main, /import \{ Bar \} from '@midas\/ui-test'/);           // other component → package
    assert.match(main, /import \{ CloseIcon \} from '@midas\/ui-test'/);     // icons → package
    assert.ok(existsSync(join(custom, '_shared/internal/cx.ts')));
    assert.ok(existsSync(join(custom, '_shared/generated/props/Foo.ts')));
    assert.ok(!existsSync(join(custom, 'Bar')), 'other components are not copied');
    assert.equal(readFileSync(join(custom, 'index.ts'), 'utf8'), "export * from './Foo/Foo';\n");
    assert.equal(res.importPath, 'src/shared/components/custom');
    // Running it again keeps edited files and does not duplicate the index line.
    writeFileSync(join(custom, '_shared/internal/cx.ts'), '// edited\n');
    const again = extractComponent({ appDir: app, pkgDir: pkg, name: 'Foo', force: false });
    assert.ok(again.skipped.some(f => f.endsWith('internal/cx.ts')));
    assert.equal(readFileSync(join(custom, '_shared/internal/cx.ts'), 'utf8'), '// edited\n');
    assert.equal(readFileSync(join(custom, 'index.ts'), 'utf8').match(/Foo/g).length, 2);
    assert.throws(() => extractComponent({ appDir: app, pkgDir: pkg, name: 'Nope' }), /not found in @midas\/ui-test\. Available: Bar, Foo/);
});

test('seed scripts derive the library package name and version instead of hardcoding them', () => {
    assert.equal(packageFromFileName('CMS Design System'), '@midas/ui-cms-design-system');
    const pick = o => pickPackageName({ fileName: 'My Lib', ...o });
    assert.deepEqual(pick({ arg: '@acme/x', published: { packageName: '@old/y' }, codePackage: { name: '@c/z' } }), { name: '@acme/x', from: '--package' });
    assert.equal(pick({ published: { packageName: '@old/y' }, codePackage: { name: '@c/z' } }).name, '@old/y');   // locked after the first publish
    assert.equal(pick({ codePackage: { name: '@c/z' } }).name, '@c/z');
    assert.equal(pick({}).name, '@midas/ui-my-lib');
    assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
    assert.equal(bumpVersion('1.2.3', 'minor'), '1.3.0');
    assert.equal(bumpVersion('1.2.3', 'major'), '2.0.0');
    assert.deepEqual([...listArg('Button, Table')], ['button', 'table']);
    assert.equal(listArg(undefined), null);
});
