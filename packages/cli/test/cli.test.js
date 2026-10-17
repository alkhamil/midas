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
