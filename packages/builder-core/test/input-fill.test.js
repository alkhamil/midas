import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { INPUT } from '../src/templates/input.js';
import { inputModel } from '../../../scripts/input-model.mjs';

test('the Input value and placeholder fill the row; the count, prefix and suffix hug their text', () => {
    const model = inputModel();
    const variables = { collections: model.collections, items: model.items };
    let n = 0;
    const frame = { id: 'f', name: 'Input', type: 'frame', parentId: null, x: 0, y: 0, w: 200, h: 32, fills: [], clip: false, layout: 'horizontal', gap: 0, padding: 0 };
    const out = applyTemplateToFrame(INPUT, { frame, children: [], binding: model.binding, variables, idOf: key => `g${++n}-${key}` });
    assert.equal(out.created.find(node => node.name === 'placeholder').layoutSizingH, 'fill', 'the placeholder fills');
    // The value, the counter and the affix texts are layers of an instance: they are sized as they are made.
    const props = { value: 'x', showCount: true, allowClear: true, hasPrefix: true, prefixText: 'a', hasSuffix: true, suffixText: 'b' };
    const sizing = Object.fromEntries(instanceOf(INPUT, frame, out.created, props, { id: key => `i${++n}-${key}` }).map(node => [node.name, node.layoutSizingH]));
    assert.equal(sizing.value, 'fill', 'the value fills');
    for (const hugging of ['prefixText', 'suffixText', 'count']) assert.equal(sizing[hugging], 'hug', `${hugging} hugs its text`);
});
