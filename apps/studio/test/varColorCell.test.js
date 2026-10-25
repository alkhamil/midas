// Regression: the Variables window drew colour values as plain text (no swatch, no opacity). Phase 1 deleted the colour cell.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('a colour variable cell has a swatch, a hex field and an opacity field, like an alias chip', () => {
    const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
    const start = src.indexOf('function vwCell(item, coll, mode)');
    const end = src.indexOf('\nfunction ', start + 10);
    const cell = src.slice(start, end);
    assert.ok(start > 0, 'vwCell found');
    const colour = cell.indexOf("if (item.type === 'color') {");
    const number = cell.indexOf("if (item.type === 'number')");
    assert.ok(colour > 0 && colour < number, 'the colour branch comes before the number branch');
    const branch = cell.slice(colour, number);
    assert.match(branch, /class="vw-sw big"/);
    assert.match(branch, /data-vwt="color"/);
    assert.match(branch, /data-vwt="hex"/);
    assert.match(branch, /data-vwt="alpha"/);
});
