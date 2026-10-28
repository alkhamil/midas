// Behavior panel models (stages 7-9 in the panel): the pure rows and download payloads, without the DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findingRows, codeFindings, stateFindings, codeDownloads, previewRows, PREVIEW_STATES } from '../src/engine/behaviorPanel.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

test('the preview states are Default, Hover, Active and Disabled, in that order', () => {
    assert.deepEqual(PREVIEW_STATES.map(([id]) => id), ['default', 'hover', 'active', 'disabled']);
});

test('a finding is one row: its severity badge, then its message', () => {
    const html = findingRows([{ severity: 'error', message: 'Button: token "bg" is unresolved (no-mode-selected).' }], esc);
    assert.match(html, /<span class="badge">Error<\/span>/);
    assert.match(html, /token &quot;bg&quot; is unresolved \(no-mode-selected\)\./);
});

test('a warning is labelled Warning, and the message is escaped', () => {
    const html = findingRows([{ severity: 'warning', message: 'Unused collection "<Brand>".' }], esc);
    assert.match(html, /<span class="badge">Warning<\/span>/);
    assert.match(html, /&lt;Brand&gt;/);
});

test('code problems become error findings that name the token and the modes', () => {
    const found = codeFindings([{ token: 'bg-hover', dimension: 'variant', reason: 'no-variable', variant: 'primary', size: 'sm' }]);
    assert.deepEqual(found, [{ severity: 'error', message: 'Code: bg-hover in variant primary, size sm (no-variable).' }]);
});

test('a missing state token of the previewed state is an error finding, and other tokens are left out', () => {
    const unresolved = [
        { token: 'bg-hover', dimension: 'variant', reason: 'no-variable' },
        { token: 'fg', dimension: 'variant', reason: 'no-variable' },
    ];
    assert.deepEqual(stateFindings(unresolved, ['bg-hover']), [
        { severity: 'error', message: 'Preview: token "bg-hover" is missing (no-variable).' },
    ]);
});

test('the download payload is the two generated files, in order', () => {
    const result = { files: { 'Button.jsx': 'JSX', 'Button.css': 'CSS' }, problems: [] };
    assert.deepEqual(codeDownloads(result), [
        { name: 'Button.jsx', text: 'JSX' },
        { name: 'Button.css', text: 'CSS' },
    ]);
});

test('a refused generation has no download payload', () => {
    assert.deepEqual(codeDownloads({ files: null, problems: [{ token: 'bg-hover', reason: 'no-variable' }] }), []);
});

test('resolved tokens are read-only rows, named without the template prefix', () => {
    const html = previewRows({ '--button-bg': '#3730a3', '--button-font-size': '14px' }, 'button', esc);
    assert.match(html, /<span title="--button-bg">bg<\/span>/);
    assert.match(html, /#3730a3/);
    assert.match(html, /font-size/);
});

test('no resolved tokens is an empty state, not an empty list', () => {
    assert.match(previewRows({}, 'button', esc), /class="empty-state"/);
});
