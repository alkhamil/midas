// The browser tab title: the open file's name, or the Home section's label, then the app name.
import test from 'node:test';
import assert from 'node:assert/strict';
import { documentTitleOf } from '../src/engine/documentTitle.js';

test('a file that is open is titled by its name', () => {
    assert.equal(documentTitleOf({ inFile: true, fileName: 'Landing page', view: 'recent' }), 'Landing page - Midas');
});

test('on Home the title is the section', () => {
    assert.equal(documentTitleOf({ inFile: false, fileName: 'Landing page', view: 'recent' }), 'Recents - Midas');
    assert.equal(documentTitleOf({ inFile: false, fileName: '', view: 'all' }), 'All files - Midas');
});

test('an unknown view falls back to the app name', () => {
    assert.equal(documentTitleOf({ inFile: false, fileName: '', view: 'nowhere' }), 'Midas');
});
