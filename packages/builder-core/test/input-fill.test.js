import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplateToFrame } from '../src/behavior-engine/template-master.js';
import { INPUT } from '../src/templates/input.js';
import { inputModel } from '../../../scripts/input-model.mjs';

test('the Input value and placeholder fill the row; the clear, count, prefix and suffix hug their text', () => {
    const model = inputModel();
    const variables = { collections: model.collections, items: model.items };
    let n = 0;
    const frame = { id: 'f', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 32, fills: [], clip: false, layout: 'horizontal', gap: 0, padding: 0 };
    const out = applyTemplateToFrame(INPUT, { frame, children: [], binding: model.binding, variables, idOf: key => `g${++n}-${key}` });
    const sizing = Object.fromEntries(out.created.map(node => [node.name, node.layoutSizingH]));
    assert.equal(sizing.label, 'fill', 'the value fills');
    assert.equal(sizing.placeholder, 'fill', 'the placeholder fills');
    for (const hugging of ['prefixText', 'suffixText', 'count', 'clear']) {
        if (sizing[hugging] !== undefined) assert.equal(sizing[hugging], 'hug', `${hugging} hugs its text`);
    }
});
