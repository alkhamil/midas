// The part generator: a master is built from the schema (every anatomy slot and canvas part is a layer), bound through the existing
// planner, applied to a frame without duplicating what is there, and an instance copies the master with the props it is given.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf, layerSpecsOf } from '../src/behavior-engine/template-master.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';

const counter = () => { let n = 0; return key => `${key}-${++n}`; };
const variablesOf = model => ({ collections: model.collections, items: model.items });

test('Button is built from its label, icon slots and spinner; Input from its affixes, value, icons and parts', () => {
    assert.deepEqual(layerSpecsOf(TEMPLATES.get('button')).map(s => s.key), ['root', 'iconStart', 'spinner', 'label', 'iconEnd']);
    assert.deepEqual(layerSpecsOf(TEMPLATES.get('input')).map(s => s.key), ['root', 'iconStart', 'prefixText', 'label', 'placeholder', 'clear', 'count', 'suffixText', 'iconEnd']);
});

test('applying a Button template to a frame creates its label and spinner, binds them, and reports no problem', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const frame = { id: 'f1', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const out = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [], binding: { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } }, variables: variablesOf(model), idOf: counter() });
    assert.deepEqual(out.created.map(n => n.name), ['spinner', 'label']);
    assert.equal(out.created.find(n => n.name === 'spinner').type, 'ellipse');
    assert.deepEqual(out.problems, []);
    assert.equal(frame.behavior.templateId, 'button');
    assert.ok(out.created.find(n => n.name === 'label').vars.typography, 'the label is bound to its typography variable');
});

test('applying the same template again creates nothing (idempotent)', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const frame = { id: 'f1', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const binding = { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } };
    const first = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [], binding, variables: variablesOf(model), idOf: counter() });
    const second = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [...first.created], binding, variables: variablesOf(model), idOf: counter() });
    assert.deepEqual(second.created, []);
    assert.equal(second.matched.length, 2);
});

test('a frame with a user text layer keeps it: the label is matched, not duplicated', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const frame = { id: 'f1', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const user = { id: 'u1', name: 'Caption', type: 'text', parentId: 'f1', text: 'Save' };
    const out = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [user], binding: { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } }, variables: variablesOf(model), idOf: counter() });
    assert.deepEqual(out.matched.find(m => m.key === 'label'), { key: 'label', nodeId: 'u1' });
    assert.equal(out.created.some(n => n.name === 'label'), false);
    assert.equal(user.text, 'Save', 'the user layer is not restyled or renamed');
});

test('an Input master holds every part as a layer, and an instance shows the parts its props switch on', () => {
    const model = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size', semantic: 'c-input-semantic' }, prefix: 'in-' });
    const frame = { id: 'inp', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const out = applyTemplateToFrame(TEMPLATES.get('input'), { frame, children: [], binding: { variables: { variant: model.ids.variant, status: model.ids.status, size: model.ids.size } }, variables: variablesOf(model), idOf: counter() });
    const names = out.created.map(n => n.name);
    for (const part of ['label', 'placeholder', 'clear', 'count']) assert.ok(names.includes(part), `${part} is a layer`);
    const template = TEMPLATES.get('input');
    const instance = instanceOf(template, frame, out.created, { value: '', allowClear: false, showCount: false }, { id: counter() });
    assert.equal(instance.find(n => n.name === 'clear').visible, false, 'clear is hidden with allowClear off');
    const shown = instanceOf(template, frame, out.created, { value: 'Kopi Kita', allowClear: true, showCount: true, maxLength: '10' }, { id: counter() });
    assert.equal(shown.find(n => n.name === 'clear').visible, true, 'clear is shown with a value and allowClear on');
    assert.equal(shown.find(n => n.name === 'count').text, '9 / 10', 'count shows the length of the value');
});
