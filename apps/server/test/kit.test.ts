import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildKit, buildTokens, tokenKey } from '../src/lib/kit.js';
import { deriveMapping } from '../src/lib/library.js';
import { buildScaffold } from '../src/lib/scaffold.js';
import { zipFiles } from '../src/lib/zip.js';

const variables = {
    collections: [
        { id: 'c-color', name: 'Color', modes: [{ id: 'm-light', name: 'Light' }, { id: 'm-dark', name: 'Dark' }] },
        { id: 'c-size', name: 'Size', modes: [{ id: 'm-base', name: 'Base' }] },
    ],
    items: [
        { id: 'blue', collectionId: 'c-color', name: 'base/blue-600', type: 'color', values: { 'm-light': '#2563eb', 'm-dark': '#3b82f6' } },
        { id: 'primary', collectionId: 'c-color', name: 'color/primary', type: 'color', values: { 'm-light': { alias: 'blue' }, 'm-dark': { alias: 'blue' } }, description: 'Warna aksi utama' },
        { id: 'fg', collectionId: 'c-color', name: 'color/primary-foreground', type: 'color', values: { 'm-light': '#ffffff', 'm-dark': '#0f172a' } },
        { id: 'r', collectionId: 'c-size', name: 'radius/md', type: 'number', values: { 'm-base': 6 } },
        { id: 'fx', collectionId: 'c-size', name: 'shadow/card', type: 'effect', values: { 'm-base': [] } },
    ],
};
const button = {
    id: 'btn', name: 'Button', set: true,
    nodes: [
        { id: 'btn', parentId: null, componentSet: true, cprops: [{ id: 'cp-label', name: 'Label', type: 'text', default: 'Simpan' }, { id: 'cp-icon', name: 'Icon', type: 'instance' }] },
        { id: 'b1', parentId: 'btn', component: true, variant: { Type: 'Primary' } },
        { id: 'b2', parentId: 'btn', component: true, variant: { Type: 'Ghost' } },
    ],
};
const mapping = deriveMapping(button);
mapping.propsMap.props[0].name = 'variant';
const input = { packageName: '@midas/ui-cms', version: '1.2.0', libraryName: 'CMS DS', publishedAt: new Date('2026-10-01T00:00:00Z'), snapshot: { components: [button], variables }, mappings: [mapping] };

test('tokenKey drops a leading color group', () => {
    assert.equal(tokenKey('color/primary-foreground', 'color'), 'primaryForeground');
    assert.equal(tokenKey('radius/md', 'number'), 'radiusMd');
    assert.equal(tokenKey('base/blue-600', 'color'), 'baseBlue600');
});

test('tokens resolve aliases per theme and skip effects', () => {
    const t = buildTokens(input.snapshot);
    assert.deepEqual(t.themes, ['light', 'dark']);
    assert.equal(t.values.light.primary, '#2563eb');
    assert.equal(t.values.dark.primary, '#3b82f6');
    assert.equal(t.values.dark.radiusMd, '6px');
    assert.match(t.warnings[0], /effect/);
});

test('kit files contain theme, css, props and manifest', () => {
    const files = buildKit(input);
    assert.match(files['src/generated/theme.ts'], /export type ThemeName = "light" \| "dark";/);
    assert.match(files['src/generated/theme.ts'], /\/\*\* Warna aksi utama \*\/\n  primary: string;/);
    assert.match(files['src/generated/tokens.css'], /:root,\n\[data-theme="light"\] \{\n[^}]*--theme-primary-foreground: #ffffff;/);
    assert.match(files['src/generated/tokens.css'], /\[data-theme="dark"\] \{[^}]*--theme-primary: #3b82f6;/);
    assert.match(files['src/generated/tailwind-theme.css'], /--color-primary: var\(--theme-primary\);/);
    assert.match(files['src/generated/tailwind-theme.css'], /--radius-md: var\(--theme-radius-md\);/);
    const props = files['src/generated/props/Button.ts'];
    assert.match(props, /variant\?: "primary" \| "ghost";/);
    assert.match(props, /label\?: string;/);
    assert.match(props, /icon\?: ReactNode;/);
    assert.match(props, /"variant": "primary"/);
    assert.match(props, /"label": "Simpan"/);
    const manifest = JSON.parse(files['src/generated/manifest.json']);
    assert.equal(manifest.components[0].exportName, 'Button');
    assert.deepEqual(manifest.components[0].props[0].values, ['primary', 'ghost']);
    assert.deepEqual(buildKit(input), files, 'kit must be deterministic');
});

test('scaffold has a package.json with the library package name and stubs', () => {
    const files = buildScaffold({ ...input, libraryId: 'lib-1', serverUrl: 'http://127.0.0.1:4000', registryUrl: 'http://127.0.0.1:4873/' });
    const pkg = JSON.parse(files['package.json']);
    assert.equal(pkg.name, '@midas/ui-cms');
    assert.equal(pkg.version, '1.2.0');
    assert.match(files['src/components/Button/Button.tsx'], /Button\.midasStub = true;/);
    assert.match(files['src/index.ts'], /export \{ Button \} from '\.\/components\/Button\/Button';/);
    assert.equal(JSON.parse(files['midas.config.json']).libraryId, 'lib-1');
    assert.ok(files['src/generated/theme.ts']);
});

test('zip output can be listed by unzip', () => {
    const dir = mkdtempSync(join(tmpdir(), 'midas-zip-'));
    const file = join(dir, 'kit.zip');
    writeFileSync(file, zipFiles({ 'a.txt': 'hello', 'src/b.ts': 'export {};\n' }, 'pkg'));
    const out = execFileSync('unzip', ['-l', file]).toString();
    assert.match(out, /pkg\/a\.txt/);
    assert.match(out, /pkg\/src\/b\.ts/);
    assert.equal(execFileSync('unzip', ['-p', file, 'pkg/a.txt']).toString(), 'hello');
});
