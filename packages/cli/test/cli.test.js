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
