// Regression: the Variables window rendered blank because Phase 1 deleted varOptions / VAR_CREATE / ENUM_DEFAULT_OPTIONS from midas.js
// (itemGlyph → ReferenceError). The enum helpers now live in varTypes.js; a render error shows a message and Retry, not a blank window.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VAR_TYPES, VAR_CREATE, ENUM_DEFAULT_OPTIONS, varOptions } from '../src/engine/varTypes.js';
import { errorBoundaryHtml, guarded, errorMessage } from '../src/engine/errorBoundary.js';

test('varOptions: only a string variable with options is an enum', () => {
    assert.deepEqual(varOptions({ type: 'string', options: ['a', 'b'] }), ['a', 'b']);
    assert.equal(varOptions({ type: 'string', options: [] }), null);
    assert.equal(varOptions({ type: 'string' }), null);
    assert.equal(varOptions({ type: 'number', options: ['a'] }), null);
    assert.equal(varOptions(undefined), null);
});

test('Create variable menu offers Enum right after String; enum starts with default options', () => {
    assert.deepEqual(VAR_CREATE.map(t => t[0]), ['color', 'number', 'string', 'enum', 'boolean', 'effect']);
    assert.equal(VAR_TYPES.length, 5);
    assert.ok(ENUM_DEFAULT_OPTIONS.length >= 2);
});

test('midas.js imports every varTypes name it uses', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    const imp = /import \{([^}]*)\} from '\.\/varTypes\.js'/.exec(src);
    assert.ok(imp, 'midas.js imports from ./varTypes.js');
    const names = imp[1].split(',').map(s => s.trim());
    for (const n of ['VAR_TYPES', 'VAR_CREATE', 'ENUM_DEFAULT_OPTIONS', 'varOptions']) {
        assert.ok(names.includes(n), n + ' imported');
        assert.ok(!new RegExp(`^(const|function) ${n}\b`, 'm').test(src), n + ' is not redefined in midas.js');
    }
});

test('error boundary: a throwing render is caught and shown with Retry', () => {
    let shown = null;
    const ok = guarded(() => { throw new ReferenceError('varOptions is not defined'); }, e => { shown = errorBoundaryHtml('Variables', e); });
    assert.equal(ok, false);
    assert.match(shown, /Variables could not be shown/);
    assert.match(shown, /varOptions is not defined/);
    assert.match(shown, /data-eb-retry/);
    assert.equal(guarded(() => { }, () => assert.fail()), true);
});

test('error boundary escapes the message', () => {
    assert.ok(!errorBoundaryHtml('X', new Error('<img onerror=1>')).includes('<img'));
    assert.equal(errorMessage(null), 'Unknown error');
});
