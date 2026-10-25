// Regression: the colour input of a Selection colors swatch covered the whole row, so the buttons next to it (bind a variable,
// select the layers that use the colour) opened the colour picker. The swatch must be the positioned box its input sits in.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('a Selection colors swatch is a positioned box, so its colour input stays inside it', () => {
    const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
    assert.match(css, /\.sc-row \.fr-sw \{[^}]*position: relative/);
    assert.match(css, /\.sc-row \.fr-sw input\[type=color\] \{[^}]*position: absolute/);
});
