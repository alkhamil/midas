// The Input's side parts: the prefix text and the suffix text are layers of the master (shown by their props), so a master that lacks one is
// reported (part-missing) even while its value layer is there, and the generator adds only the layer that is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel();
const variables = { collections: model.collections, items: model.items };
const binding = model.binding;
let seq = 0;
const idOf = key => `s-${key}-${++seq}`;
const frame = () => ({ id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] });
const docOf = (f, nodes) => ({ variables, pages: [{ name: 'p', nodes: [f, ...nodes] }] });
const missing = (f, nodes) => diagnoseDocument(docOf(f, nodes)).filter(finding => finding.code === 'part-missing').map(finding => finding.layer);

test('the master layers of an Input are its side texts, value, placeholder, count and clear slot, in the anatomy order', () => {
    assert.deepEqual(layerSpecsOf(input).map(s => s.key), ['root', 'prefixIcon', 'prefixText', 'value', 'placeholder', 'count', 'clear', 'suffixText', 'suffixIcon']);
    assert.deepEqual(layerSpecsOf(input).filter(s => s.role === 'text').map(s => s.key), ['prefixText', 'suffixText']);
});

for (const side of ['prefixText', 'suffixText']) {
    test(`a master without its ${side} layer is reported, though its value layer is there, and the generator adds only that layer`, () => {
        const f = frame();
        const made = applyTemplateToFrame(input, { frame: f, children: [], binding, variables, idOf });
        assert.deepEqual(missing(f, made.created), [], 'a generated master is complete');
        const without = made.created.filter(n => n.name !== side);
        assert.equal(without.length, made.created.length - 1);
        assert.deepEqual(missing(f, without), [side]);
        const again = applyTemplateToFrame(input, { frame: f, children: without, binding, variables, idOf });
        assert.deepEqual(again.created.map(n => n.name), [side], 'only the missing layer is made');
        assert.equal(again.created[0].behavior.text, side, 'it carries its text marker');
        assert.deepEqual(missing(f, [...without, ...again.created]), []);
        assert.deepEqual(applyTemplateToFrame(input, { frame: f, children: [...without, ...again.created], binding, variables, idOf }).created, [], 'a second run makes nothing');
    });
}

test('a master that lacks both side texts is reported for each, and Auto Fix keeps the layers it has', () => {
    const f = frame();
    const made = applyTemplateToFrame(input, { frame: f, children: [], binding, variables, idOf });
    const kept = made.created.filter(n => n.name !== 'prefixText' && n.name !== 'suffixText');
    assert.deepEqual(missing(f, kept).sort(), ['prefixText', 'suffixText']);
    const again = applyTemplateToFrame(input, { frame: f, children: kept, binding, variables, idOf });
    assert.deepEqual(again.created.map(n => n.name).sort(), ['prefixText', 'suffixText']);
    for (const node of kept) assert.ok(again.matched.some(m => m.nodeId === node.id) || node.name === 'root', `${node.name} is kept`);
});
