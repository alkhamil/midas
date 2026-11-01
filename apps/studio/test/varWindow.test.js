// The Variables window creates Color, Number, String, Boolean and Effect variables. There is no Enum type: a string variable
// is a string. A render error shows a message and Retry, not a blank window.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VAR_TYPES } from '../src/engine/varTypes.js';
import { errorBoundaryHtml, guarded, errorMessage } from '../src/engine/errorBoundary.js';

test('Create variable menu offers the six variable types, no Enum', () => {
    assert.deepEqual(VAR_TYPES.map(t => t[0]), ['color', 'number', 'string', 'boolean', 'effect', 'typography']);
});

test('midas.js imports only the varTypes names it uses, and no Enum helper exists', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    const imp = /import \{([^}]*)\} from '\.\/varTypes\.js'/.exec(src);
    assert.ok(imp, 'midas.js imports from ./varTypes.js');
    assert.deepEqual(imp[1].split(',').map(s => s.trim()), ['VAR_TYPES']);
    assert.ok(!/\bENUM_DEFAULT_OPTIONS\b|\bvarOptions\b|data-vw-create="enum"/.test(src), 'no Enum variable type in the Variables window');
});

test('the Variables window starts with no collection and creates Collection 1 lazily, in the same transaction as the variable', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    assert.equal((src.match(/name: 'Collection 1'/g) || []).length, 1, 'Collection 1 is created in one place only: the lazy create-variable path');
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
