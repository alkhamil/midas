// The part generator: a master is built from the schema (every required slot and unconditional canvas part is a layer; managed slots
// and conditional parts are instance layers), bound through the existing planner, applied to a frame without duplicating what is
// there, and an instance copies the master with the props it is given.
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
    assert.deepEqual(layerSpecsOf(TEMPLATES.get('input')).map(s => s.key), ['root', 'prefixIcon', 'prefixText', 'value', 'placeholder', 'count', 'clear', 'suffixText', 'suffixIcon', 'eyeBox', 'eyeOn', 'eyeOff', 'footer', 'countArea', 'resizeHandle']);
});

test('applying a Button template to a frame creates its label and spinner, binds them, and reports no problem', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const frame = { id: 'f1', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const out = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [], binding: { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } }, variables: variablesOf(model), idOf: counter() });
    assert.deepEqual(out.created.map(n => n.name), ['label'], 'the spinner is an instance layer while loading is off');
    assert.deepEqual(out.problems, []);
    assert.equal(frame.behavior.templateId, 'button');
    assert.ok(out.created.find(n => n.name === 'label').vars.typography, 'the label is bound to its typography variable');
});

test('a conditional container is a master layer only while its condition holds at the sample props', () => {
    const mini = on => ({
        id: 'mini', name: 'Mini',
        props: { on: { source: 'literal', type: 'boolean', default: false } },
        ...(on ? { sampleProps: { on: true } } : {}),
        anatomy: [{ id: 'box', kind: 'frame', layout: 'horizontal', shownWhen: { prop: 'on', is: true } }],
        tokens: {}, tokenKinds: {}, tokenRoles: {}, display: {},
    });
    const build = template => {
        const frame = { id: 'f1', name: 'Mini', type: 'frame', parentId: null, fills: [] };
        return applyTemplateToFrame(template, { frame, children: [], binding: { variables: {} }, variables: { collections: [], items: [] }, idOf: counter() });
    };
    assert.deepEqual(build(mini(false)).created.map(n => n.name), [], 'no box while the condition is off');
    assert.deepEqual(build(mini(true)).created.map(n => n.name), ['box'], 'the box is built while the condition holds');
});

test('an instance holds a conditional container as a frame layer marked by slot while its condition holds', () => {
    const template = {
        id: 'mini', name: 'Mini',
        props: { on: { source: 'literal', type: 'boolean', default: false } },
        anatomy: [{ id: 'box', kind: 'frame', layout: 'horizontal', managed: true, shownWhen: { prop: 'on', is: true } }],
        tokens: {}, tokenKinds: {}, tokenRoles: {}, display: {},
    };
    const frame = { id: 'f1', name: 'Mini', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(template, { frame, children: [], binding: { variables: {} }, variables: { collections: [], items: [] }, idOf: counter() });
    const out = instanceOf(template, frame, made.created, { on: true }, { id: counter() });
    const box = out.find(n => n.behavior?.slot === 'box');
    assert.ok(box, 'the instance holds the box as a managed layer');
    assert.equal(box.type, 'frame', 'the box is a frame, not a text layer');
});

test('an instance drops the master copy of a conditional container while its condition fails', () => {
    const template = {
        id: 'mini', name: 'Mini',
        props: { on: { source: 'literal', type: 'boolean', default: false } },
        sampleProps: { on: true },
        anatomy: [{ id: 'box', kind: 'frame', layout: 'horizontal', managed: true, shownWhen: { prop: 'on', is: true } }],
        tokens: {}, tokenKinds: {}, tokenRoles: {}, display: {},
    };
    const frame = { id: 'f1', name: 'Mini', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(template, { frame, children: [], binding: { variables: {} }, variables: { collections: [], items: [] }, idOf: counter() });
    assert.deepEqual(made.created.map(n => n.name), ['box'], 'the master holds the box while the sample shows it');
    const out = instanceOf(template, frame, made.created, { on: false }, { id: counter() });
    assert.ok(!out.some(n => n.behavior?.group === 'box'), 'no box copy while the condition fails');
});


test('applying the same template again creates nothing (idempotent)', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const frame = { id: 'f1', name: 'Button', type: 'frame', parentId: null, fills: [] };
    const binding = { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } };
    const first = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [], binding, variables: variablesOf(model), idOf: counter() });
    const second = applyTemplateToFrame(TEMPLATES.get('button'), { frame, children: [...first.created], binding, variables: variablesOf(model), idOf: counter() });
    assert.deepEqual(second.created, []);
    assert.equal(second.matched.length, 1);
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

test('an Input master holds the placeholder only, and an instance has the layers its props switch on', () => {
    const model = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size', semantic: 'c-input-semantic' }, prefix: 'in-' });
    const frame = { id: 'inp', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const out = applyTemplateToFrame(TEMPLATES.get('input'), { frame, children: [], binding: { variables: { variant: model.ids.variant, status: model.ids.status, size: model.ids.size } }, variables: variablesOf(model), idOf: counter() });
    const names = out.created.map(n => n.name);
    assert.deepEqual(names, ['placeholder'], 'the value, the counter and the affix texts are instance layers, like the clear icon');
    const template = TEMPLATES.get('input');
    const instance = instanceOf(template, frame, out.created, { value: '', allowClear: false, showCount: false }, { id: counter() });
    assert.equal(instance.find(n => n.name === 'clear'), undefined, 'no clear layer with allowClear off');
    const shown = instanceOf(template, frame, out.created, { value: 'Kopi Kita', allowClear: true, showCount: true, maxLength: '10' }, { id: counter() });
    assert.equal(shown.find(n => n.name === 'clear').visible, true, 'clear is shown with a value and allowClear on');
    const empty = instanceOf(template, frame, out.created, { value: '', allowClear: true, showCount: false }, { id: counter() });
    assert.equal(empty.find(n => n.name === 'clear').visible, false, 'clear is kept and hidden with an empty value');
    assert.equal(shown.find(n => n.name === 'count').text, '9 / 10', 'count shows the length of the value');
    assert.equal(shown.find(n => n.name === 'value').text, 'Kopi Kita', 'the value layer carries the value');
    assert.equal(instance.find(n => n.name === 'value'), undefined, 'no value layer while the value is empty');
    assert.equal(instance.find(n => n.name === 'count'), undefined, 'no counter layer while Show count is off');
});
