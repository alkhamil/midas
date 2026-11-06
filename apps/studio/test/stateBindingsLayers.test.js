// stateBindingsOf pairs every layer a persistent state recolours with the master's layer it copies: the root, the label, and the boxes (group frames) and
// frame parts the display maps. midas.js needs a browser, so the pairing is read from its source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/engine/midas.js', import.meta.url), 'utf8');
const body = name => {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at >= 0, `${name} exists`);
    return src.slice(at, src.indexOf('\n}\n', at));
};

test('stateBindingsOf pairs the group and part copies with their master layers, by the key the display uses', () => {
    const fn = body('stateBindingsOf');
    assert.ok(fn.includes('copyPairsOf(inst, master)'), 'the box and part copies are paired');
    const pairs = body('copyPairsOf');
    assert.ok(pairs.includes('behavior?.group') && pairs.includes('behavior?.part'), 'by group and part marker');
    assert.ok(pairs.includes('sourceId === m.id'), 'each copy is found through its source layer');
});
