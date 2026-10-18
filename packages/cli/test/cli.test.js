import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
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
    assert.throws(() => writeFiles(dir, { '../evil.txt': 'x' }), /path tidak valid/);
    assert.throws(() => writeFiles(dir, { '/etc/evil': 'x' }), /path tidak valid/);
});

test('report finds stubs, missing exports and props that do not match the design', async () => {
    const { execFileSync } = await import('node:child_process');
    const dir = new URL('./fixtures/report-repo/', import.meta.url).pathname;
    const out = execFileSync(process.execPath, [new URL('../bin/midas.js', import.meta.url).pathname, 'report', '--no-upload', '--json'], { cwd: dir, encoding: 'utf8' });
    const byName = Object.fromEntries(JSON.parse(out).components.map(c => [c.exportName, c]));
    assert.equal(byName.Good.status, 'ready');
    assert.equal(byName.Bad.status, 'mismatch');
    assert.deepEqual(byName.Bad.detail.replace('props tidak sesuai desain: ', '').split(', ').sort(), ['label', 'size', 'variant']);
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
