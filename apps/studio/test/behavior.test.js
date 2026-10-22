// Model perilaku (tab Behavior): tipe komponen, state mapping ke variable, interaction, input behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentTypeOf, getPath, isStateCollection, modeForState, normalizeInputBehavior, normalizePlacement, PLACEMENTS, normalizeInteractions, normalizeStateMapping, overridesFor, setPath, stateChain, stateOfMode, statesFor, effectiveState, normalizeAction, SELECT_MODES, stateLabel, statesIn } from '../src/engine/behavior.js';

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
    assert.equal(stateOfMode('Error-filled'), 'error-filled', 'the token modes keep their own state');
    assert.equal(stateOfMode('Current'), 'selected', 'current is how Nav items call selected');
    assert.equal(stateOfMode('disabled-on'), 'disabled-on');
    assert.equal(stateOfMode('Focused-selected'), 'focused-selected');
    assert.equal(stateOfMode('Light'), null);
});

test('a state collection is named after states or has several state modes', () => {
    const modes = names => names.map((name, i) => ({ id: `m${i}`, name }));
    assert.ok(isStateCollection({ name: 'Button states', modes: modes(['Default']) }));
    assert.ok(isStateCollection({ name: 'Tokens', modes: modes(['Default', 'Hover', 'Pressed']) }));
    assert.ok(!isStateCollection({ name: 'Color', modes: modes(['Light', 'Dark']) }));
    assert.ok(!isStateCollection({ name: 'Color', modes: modes(['Default']) }));
});

test('a state reads the mode its name suggests, by name priority and not by collection order', () => {
    const coll = { id: 'c', modes: ['Default', 'Selected', 'Typing', 'Filled', 'Disabled', 'Error-empty', 'Error-filled', 'Focused'].map((name, i) => ({ id: `m${i}`, name })) };
    const name = state => modeForState(coll, state)?.name;
    assert.equal(name('filled'), 'Filled');      // not "Default", which comes first in the collection
    assert.equal(name('selected'), 'Selected');
    assert.equal(name('focused'), 'Focused');    // Tab focus is not the clicked "Selected" look
    assert.equal(name('typing'), 'Typing');
    assert.equal(name('error-filled'), 'Error-filled');
    assert.equal(name('error-empty'), 'Error-empty');
    assert.equal(name('error'), undefined, 'a collection with only error-empty / error-filled has no plain error mode');
    assert.equal(modeForState({ id: 'c', modes: [{ id: 'a', name: 'Default' }] }, 'hover'), null);
});

test('a state can be pointed at any mode, whatever it is called', () => {
    const coll = { id: 'c', modes: [{ id: 'a', name: 'Rest' }, { id: 'b', name: 'Active input' }] };
    assert.equal(modeForState(coll, 'typing', 'b').name, 'Active input');
    assert.equal(modeForState(coll, 'typing', 'gone'), null, 'a stale pick falls back to the name guess');
});

test('selected, typing and filled are input states with their own fallbacks', () => {
    for (const s of ['selected', 'typing', 'filled']) {
        assert.ok(statesFor('input').includes(s));
        assert.ok(!statesFor('button').includes(s));
    }
    assert.deepEqual(stateChain('filled'), ['filled', 'default']);
    assert.deepEqual(stateChain('selected').slice(0, 2), ['selected', 'focused']);
});

test('an input field has an explicit type, text unless chosen', () => {
    assert.equal(normalizeInputBehavior({ typeable: {} }).typeable.inputType, undefined);
    const pw = normalizeInputBehavior({ typeable: { inputType: 'password', showIconId: 'eye', hideIconId: 'eye-off' } }).typeable;
    assert.equal(pw.inputType, 'password');
    assert.equal(pw.showIconId, 'eye', 'the icon shown while the text is hidden is a component');
    assert.equal(pw.hideIconId, 'eye-off');
    assert.equal(normalizeInputBehavior({ typeable: { inputType: 'nonsense' } }).typeable.inputType, undefined);
});

test('a dropdown, overlay or popover opens a component; a frame picked earlier keeps working until replaced', () => {
    const [dropdown, overlay, navigate, legacy, both] = normalizeInteractions([
        { action: { type: 'open-dropdown', targetComponentId: 'menu' } },
        { action: { type: 'open-overlay', targetComponentId: 'dialog', targetFrameId: 'old' } },
        { action: { type: 'navigate', targetFrameId: 'page', targetComponentId: 'ignored' } },
        { action: { type: 'open-popover', targetFrameId: 'frame' } },
        { action: { type: 'open-dropdown', targetComponentId: 'menu', targetFrameId: 'frame' } },
    ]);
    assert.equal(dropdown.actions[0].targetComponentId, 'menu');
    assert.equal(overlay.actions[0].targetComponentId, 'dialog');
    assert.equal(overlay.actions[0].targetFrameId, undefined, 'a component replaces the frame');
    assert.equal(navigate.actions[0].targetFrameId, 'page', 'navigating still goes to a page frame');
    assert.equal(navigate.actions[0].targetComponentId, undefined);
    assert.equal(legacy.actions[0].targetFrameId, 'frame');
    assert.equal(both.actions[0].targetFrameId, undefined);
});

test('a dropdown or popover sits on a side of its anchor, a number of pixels away', () => {
    assert.equal(PLACEMENTS.length, 12);
    assert.equal(normalizePlacement('right-start'), 'right-start');
    assert.equal(normalizePlacement('bottom-left'), 'bottom-start', 'the corner names used before still work');
    assert.equal(normalizePlacement('top-right'), 'top-end');
    assert.equal(normalizePlacement('nonsense', 'top'), 'top');
    const [dd, pop, overlay] = normalizeInteractions([
        { action: { type: 'open-dropdown', position: 'bottom-left', offset: '8' } },
        { action: { type: 'open-popover', position: 'left-end', offset: 'x' } },
        { action: { type: 'open-overlay', position: 'center', offset: 4 } },
    ]);
    assert.equal(dd.actions[0].position, 'bottom-start');
    assert.equal(dd.actions[0].offset, 8);
    assert.equal(pop.actions[0].position, 'left-end');
    assert.equal(pop.actions[0].offset, undefined, 'an offset that is not a number is dropped');
    assert.equal(overlay.actions[0].position, 'center', 'an overlay is placed on the screen, not around an anchor');
    assert.equal(overlay.actions[0].offset, undefined);
});

test('the states of a collection are the ones its modes are named after, plus the ones its kind is asked about', () => {
    const checkbox = { modes: ['default', 'selected', 'indeterminate', 'disabled-off', 'disabled-on', 'error', 'focused', 'focused-selected', 'focused-indeterminate'].map((name, i) => ({ id: 'm' + i, name })) };
    const rows = statesIn(checkbox, 'generic');
    for (const s of ['default', 'selected', 'indeterminate', 'disabled-off', 'disabled-on', 'focused-selected', 'focused-indeterminate', 'error']) assert.ok(rows.includes(s), s);
    assert.ok(!rows.includes('typing'), 'a checkbox is not asked how it looks while typing');
    const input = { modes: ['default', 'selected', 'typing', 'filled', 'disabled', 'error-empty', 'error-filled', 'read-only', 'focused'].map((name, i) => ({ id: 'm' + i, name })) };
    const inputRows = statesIn(input, 'input');
    for (const s of ['error-empty', 'error-filled', 'read-only', 'typing']) assert.ok(inputRows.includes(s), s);
    assert.equal(stateLabel('disabled-on'), 'Disabled on');
    assert.equal(stateLabel('hover'), 'Hover');
});

test('what is drawn combines the base state with what stays on the layer', () => {
    assert.equal(effectiveState('default', {}), 'default');
    assert.equal(effectiveState('default', { selected: true }), 'selected');
    assert.equal(effectiveState('default', { indeterminate: true }), 'indeterminate');
    assert.equal(effectiveState('hover', { selected: true }), 'selected-hover');
    assert.equal(effectiveState('focused', { selected: true }), 'focused-selected');
    assert.equal(effectiveState('focused', { indeterminate: true }), 'focused-indeterminate');
    assert.equal(effectiveState('disabled', { selected: true }), 'disabled-on');
    assert.equal(effectiveState('disabled', {}), 'disabled-off');
    assert.equal(effectiveState('error', { empty: true }), 'error-empty');
    assert.equal(effectiveState('error', { empty: false }), 'error-filled');
    assert.equal(effectiveState('typing', { selected: true }), 'typing', 'other states are left as they are');
});

test('compound states fall back the way the token spells out', () => {
    assert.deepEqual(stateChain('focused-selected'), ['focused-selected', 'focused', 'selected', 'default']);
    assert.deepEqual(stateChain('error-empty'), ['error-empty', 'error', 'default']);
    assert.deepEqual(stateChain('error-filled'), ['error-filled', 'error', 'default']);
    assert.deepEqual(stateChain('pressed'), ['pressed', 'hover', 'default']);
    assert.deepEqual(stateChain('selected').slice(0, 3), ['selected', 'focused', 'default']);
    assert.deepEqual(stateChain('disabled-on').slice(0, 2), ['disabled-on', 'disabled']);
});

test('an interaction runs several actions in order; the single action of earlier files is the first', () => {
    const [many, old, empty] = normalizeInteractions([
        { trigger: 'onClick', actions: [{ type: 'close-overlay', close: 'current' }, { type: 'set-variable', variableId: 'checked', value: true }, { type: 'navigate', targetFrameId: 'dashboard' }] },
        { trigger: 'onHover', action: { type: 'open-popover', targetComponentId: 'tip' } },
        { trigger: 'onClick' },
    ]);
    assert.deepEqual(many.actions.map(a => a.type), ['close-overlay', 'set-variable', 'navigate']);
    assert.equal(many.actions[1].variableId, 'checked');
    assert.equal(many.actions[1].value, true);
    assert.equal(old.actions.length, 1);
    assert.equal(old.actions[0].targetComponentId, 'tip');
    assert.equal(empty.actions.length, 1, 'an interaction always has an action to show');
});

test('Set variable and Set active / selected keep what they need', () => {
    assert.deepEqual(normalizeAction({ type: 'set-variable', variableId: 'v', value: '#fff' }), { type: 'set-variable', variableId: 'v', value: '#fff' });
    assert.deepEqual(normalizeAction({ type: 'set-variable', value: '' }), { type: 'set-variable' });
    assert.equal(normalizeAction({ type: 'set-selected' }).mode, 'toggle');
    assert.equal(normalizeAction({ type: 'set-selected', mode: 'exclusive' }).mode, 'exclusive');
    assert.equal(normalizeAction({ type: 'set-selected', mode: 'nonsense' }).mode, 'toggle');
    assert.deepEqual(SELECT_MODES.map(m => m.id), ['toggle', 'select', 'exclusive']);
    assert.equal(normalizeAction({ type: 'navigate', variableId: 'ignored', mode: 'x' }).variableId, undefined);
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
    assert.equal(list[0].actions[0].type, 'navigate');
    assert.equal(list[0].actions[0].targetFrameId, 'dashboard');
    assert.equal(list[1].trigger, 'onClick');         // trigger tak dikenal → default
    assert.equal(list[1].actions[0].type, 'open-overlay');
    assert.equal(list[1].actions[0].backdrop, true);
});

test('input behavior keeps the typing layer, its type and when it is checked; label, placeholder and error frame are not kept', () => {
    const ib = normalizeInputBehavior({
        label: { exists: true, reference: { type: 'layer', layerId: 'label-email' } },
        typeable: { frameId: 'input-box', placeholder: { variableId: 'placeholder-email', collectionId: 'text' }, valueVariableId: 'v' },
        error: { stateName: 'error', errorFrameId: 'hint' },
        validation: { required: true, trigger: 'change' },
    });
    assert.equal(ib.typeable.frameId, 'input-box');
    assert.equal(ib.validation.required, true);
    assert.equal(ib.validation.trigger, 'change');
    for (const gone of ['label', 'error']) assert.equal(ib[gone], undefined, gone + ' lives in Appearance / State mapping');
    assert.equal(ib.typeable.placeholder, undefined);
    assert.equal(ib.typeable.valueVariableId, undefined);
    assert.equal(normalizeInputBehavior({ validation: { trigger: 'nonsense' } }).validation.trigger, undefined);
});

test('values are written and read with a dotted path', () => {
    const root = {};
    setPath(root, 'state.hover.fill.variableId', 'primary');
    assert.equal(getPath(root, 'state.hover.fill.variableId'), 'primary');
    assert.deepEqual(getPath(root, 'state.hover.fill'), { variableId: 'primary' });
    assert.equal(getPath(root, 'state.hover.radius'), undefined);
});
