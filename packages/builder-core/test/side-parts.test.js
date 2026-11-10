// The Input's side texts are managed text layers: a layer of an instance only, made while its props ask for it. A master holds none of them,
// so it is complete with its placeholder, a master that lacks the placeholder is reported (part-missing) and the generator adds only that.
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

test('the layer specs of an Input are its side texts, value, placeholder, count and clear slot, in the anatomy order; the texts are instance (slot) layers', () => {
    assert.deepEqual(layerSpecsOf(input).map(s => s.key), ['root', 'prefixIcon', 'prefixText', 'value', 'placeholder', 'count', 'clear', 'suffixText', 'suffixIcon', 'eyeBox', 'eyeOff', 'footer', 'countArea', 'resizeHandle']);
    assert.deepEqual(layerSpecsOf(input).filter(s => s.role === 'text').map(s => s.key), [], 'no text layer of the master is an affix');
    assert.deepEqual(layerSpecsOf(input).filter(s => s.role === 'slot' && s.type === 'text').map(s => s.key), ['prefixText', 'value', 'count', 'suffixText', 'countArea']);
});

test('a generated Input master is its placeholder only, and is complete: no side text, value or counter is required of it', () => {
    const f = frame();
    const made = applyTemplateToFrame(input, { frame: f, children: [], binding, variables, idOf });
    assert.deepEqual(made.created.map(n => n.name), ['placeholder']);
    assert.deepEqual(missing(f, made.created), []);
});

test('a master without its placeholder is reported, and the generator adds only that layer', () => {
    const f = frame();
    const made = applyTemplateToFrame(input, { frame: f, children: [], binding, variables, idOf });
    assert.deepEqual(missing(f, []), ['placeholder']);
    const again = applyTemplateToFrame(input, { frame: f, children: [], binding, variables, idOf });
    assert.deepEqual(again.created.map(n => n.name), ['placeholder']);
    assert.deepEqual(applyTemplateToFrame(input, { frame: f, children: made.created, binding, variables, idOf }).created, [], 'a second run makes nothing');
});

test('Auto Fix and the generator never recreate what is intentionally absent: a master that holds a value or side text layer of its own keeps it as an unknown layer', () => {
    const f = frame();
    const made = applyTemplateToFrame(input, { frame: f, children: [], binding, variables, idOf });
    const own = { id: 'own', name: 'prefixText', type: 'text', parentId: f.id, text: 'x' };
    const again = applyTemplateToFrame(input, { frame: f, children: [...made.created, own], binding, variables, idOf });
    assert.deepEqual(again.created, []);
    assert.ok(!again.matched.some(m => m.nodeId === 'own'), 'it is not claimed as a template layer');
});
