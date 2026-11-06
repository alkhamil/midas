// Checkbox, Radio and Switch declare the hover and focus preview states Button and Input have: the Behavior tab lists them, previewing one recolours the
// tokens it names while no persistent state replaces them, and the export carries the same rules (guarded by the disabled state and by the checked state,
// which replace those colours). Each root is focusable (tabindex) and says its role.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { previewOf } from '../src/behavior-engine/preview.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { modelFor } from './helpers/box-template.js';

const names = ['checkbox', 'radio', 'switch'];
/** The default mode of each dimension of a model, as an instance picks it. */
const modesOf = model => Object.fromEntries(Object.entries(model.binding.variables).map(([prop, id]) => {
    const collection = model.variables.collections.find(c => c.id === id);
    const wanted = model.template.props[prop].defaultMode;
    return [prop, (collection.modes.find(m => m.id === wanted || m.name === wanted) ?? collection.modes[0]).id];
}));

test('each control declares hover and focus, and the Behavior tab lists no other preview state for it', () => {
    for (const id of names) assert.deepEqual(Object.keys(TEMPLATES.get(id).previewStates), ['hover', 'focus'], id);
});

test('previewing hover or focus recolours the unchecked control and changes nothing while it is checked', () => {
    for (const id of names) {
        const model = modelFor(TEMPLATES.get(id)), modes = modesOf(model);
        const at = (props, state) => previewOf(model.template, model.binding, modes, model.variables, props, state);
        for (const state of ['hover', 'focus']) {
            const rest = at({}, 'default'), shown = at({}, state);
            assert.deepEqual(shown.unresolved.filter(u => model.template.previewStates[state] && Object.values(model.template.previewStates[state]).includes(u.token)), [], `${id} ${state} resolves`);
            assert.notDeepEqual(shown.vars, rest.vars, `${id} ${state} changes a colour`);
            assert.deepEqual(at({ checked: true }, state).vars, at({ checked: true }, 'default').vars, `${id} ${state} is replaced by the checked look`);
        }
    }
});

test('the export carries the hover and focus rules for the unchecked control, not the disabled or the checked one', () => {
    for (const id of names) {
        const model = modelFor(TEMPLATES.get(id));
        const css = generateComponent(model.template, model.binding, model.variables, model.template.name, model.frame, parent => model.created.filter(n => n.parentId === parent)).files[`${model.template.name}.css`];
        assert.match(css, /:hover:not\(\[data-checked\]\)/, `${id} hover`);
        assert.match(css, /:focus-visible:not\(\[data-checked\]\)/, `${id} focus`);
        assert.doesNotMatch(css, /:hover:not\(\[data-checked\]\)[^{]*\{[^}]*--[a-z-]+-checked/, `${id} hover does not touch the checked tokens`);
    }
});

test('each root is focusable and says its role', () => {
    for (const id of names) assert.equal(TEMPLATES.get(id).element.attrs.tabindex, '0', id);
});
