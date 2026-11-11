// A text edit on the canvas writes back to the prop that stores it, on every path that edits a text layer (the pure rule is builder-core's textWriteBacks).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const fn = name => { const at = src.indexOf('function ' + name + '('); const end = src.indexOf('\nfunction ', at + 1); return src.slice(at, end); };

test('the text editor, search and replace and the plugin setter write the edited text back to its prop', () => {
    assert.ok(fn('finishText').includes('writeBackCanvasText(n)'));
    assert.ok(src.includes('    n.text = next;\n    writeBackCanvasText(n);'), 'search and replace');
    assert.ok(src.includes('n.text = String(v);\n        writeBackCanvasText(n);'), 'the plugin characters setter');
});

test('the write-back finds the layer by the same targets the prop-to-canvas write uses, and changes nothing a prop already holds', () => {
    const body = fn('writeBackCanvasText');
    assert.ok(body.includes('literalTargetsOf(inst, master, template)'));
    assert.ok(body.includes('textWriteBacks('));
});
