// Model perilaku (tab Behavior): tipe komponen, state mapping ke variable, interaction, input behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentTypeOf, getPath, isStateCollection, normalizeInputBehavior, normalizeInteractions, normalizeStateMapping, overridesFor, setPath, stateOfMode, statesFor } from '../src/engine/behavior.js';

test('component type comes from the component name', () => {
    assert.equal(componentTypeOf('Button Primary'), 'button');
    assert.equal(componentTypeOf('IconButton'), 'button');
    assert.equal(componentTypeOf('TextField'), 'input');
    assert.equal(componentTypeOf('SelectField'), 'input');
    assert.equal(componentTypeOf('Dropdown'), 'dropdown');
    assert.equal(componentTypeOf('Sidebar'), 'generic');
});

test('a mode name means a state', () => {
    assert.equal(stateOfMode('Default'), 'default');
    assert.equal(stateOfMode('hover'), 'hover');
    assert.equal(stateOfMode('Pressed'), 'pressed');
    assert.equal(stateOfMode('Error-filled'), 'error');
    assert.equal(stateOfMode('Light'), null);
});

test('a state collection is named after states or has several state modes', () => {
    const modes = names => names.map((name, i) => ({ id: `m${i}`, name }));
    assert.ok(isStateCollection({ name: 'Button states', modes: modes(['Default']) }));
    assert.ok(isStateCollection({ name: 'Tokens', modes: modes(['Default', 'Hover', 'Pressed']) }));
    assert.ok(!isStateCollection({ name: 'Color', modes: modes(['Light', 'Dark']) }));
    assert.ok(!isStateCollection({ name: 'Color', modes: modes(['Default']) }));
});

test('the error state is only asked for input fields', () => {
    assert.ok(!statesFor('button').includes('error'));
    assert.ok(statesFor('input').includes('error'));
    assert.ok(statesFor('generic').includes('disabled'));
});

test('a state reads from a variable collection or from a manual value', () => {
    const mapping = normalizeStateMapping({
        default: { fill: { collectionId: 'colors', variableId: 'primary' } },
        hover: { fill: { value: '#4338CA' } },
        pressed: { stroke: { collectionId: 'borders', variableId: 'focused' } },
    });
    assert.deepEqual(mapping.default.fill, { collectionId: 'colors', variableId: 'primary' });
    assert.deepEqual(mapping.hover.fill, { value: '#4338CA' });
    assert.deepEqual(mapping.pressed.stroke, { collectionId: 'borders', variableId: 'focused' });
});

test('an empty property slot survives normalization (the designer picked the property)', () => {
    const mapping = normalizeStateMapping({ error: { stroke: {} } });
    assert.deepEqual(mapping, { error: { stroke: {} } });
});

test('each property falls back through the state chain on its own', () => {
    const mapping = {
        default: { fill: { value: '#fff' } },
        hover: { fill: { value: '#eee' } },
    };
    const over = overridesFor(mapping, 'pressed');
    assert.equal(over.fill.value, '#eee');           // pressed → hover → default
    const only = overridesFor({ default: { fill: { value: '#fff' } } }, 'hover');
    assert.equal(only.fill.value, '#fff');            // hover has no value of its own → default
    assert.deepEqual(overridesFor({ hover: { fill: { value: '#eee' } } }, 'error'), {});
});

test('interactions keep their trigger, action and target', () => {
    const list = normalizeInteractions([
        { id: 'i1', trigger: 'onClick', action: { type: 'navigate', targetFrameId: 'dashboard' } },
        { trigger: 'nonsense', action: { type: 'open-overlay', targetFrameId: 'modal', backdrop: true } },
    ]);
    assert.equal(list[0].trigger, 'onClick');
    assert.equal(list[0].action.type, 'navigate');
    assert.equal(list[0].action.targetFrameId, 'dashboard');
    assert.equal(list[1].trigger, 'onClick');         // trigger tak dikenal → default
    assert.equal(list[1].action.type, 'open-overlay');
    assert.equal(list[1].action.backdrop, true);
});

test('input behavior keeps label, typeable area, error and validation', () => {
    const ib = normalizeInputBehavior({
        label: { exists: true, reference: { type: 'layer', layerId: 'label-email' } },
        typeable: { frameId: 'input-box', placeholder: { variableId: 'placeholder-email', collectionId: 'text' } },
        error: { stateName: 'error', borderVariable: { collectionId: 'borders', variableId: 'error' }, errorFrameId: 'hint' },
        validation: { required: true },
    });
    assert.equal(ib.label.reference.layerId, 'label-email');
    assert.equal(ib.typeable.frameId, 'input-box');
    assert.equal(ib.typeable.placeholder.variableId, 'placeholder-email');
    assert.equal(ib.error.frameId, 'hint');
    assert.equal(ib.validation.required, true);
});

test('values are written and read with a dotted path', () => {
    const root = {};
    setPath(root, 'state.hover.fill.variableId', 'primary');
    assert.equal(getPath(root, 'state.hover.fill.variableId'), 'primary');
    assert.deepEqual(getPath(root, 'state.hover.fill'), { variableId: 'primary' });
    assert.equal(getPath(root, 'state.hover.radius'), undefined);
});
