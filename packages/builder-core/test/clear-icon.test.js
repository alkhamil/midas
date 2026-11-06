import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { INPUT } from '../src/templates/input.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

test('the clear is a managed icon slot shown while Allow Clear is on, hidden while the value is empty, with the hand cursor', () => {
    assert.deepEqual(validateTemplateSchema(INPUT), []);
    const def = INPUT.icons.find(icon => icon.slot === 'clear');
    assert.deepEqual({ show: def.show, component: def.component, hideWhenEmpty: def.hideWhenEmpty, cursor: def.cursor }, { show: 'allowClear', component: 'clearIcon', hideWhenEmpty: 'value', cursor: 'pointer' });
    assert.equal(INPUT.props.clearIcon.type, 'iconComponent', 'the clear icon is an icon prop, swapped like the start and end icons');
    assert.equal(INPUT.anatomy.find(slot => slot.id === 'clear').managed, true);
});

test('a clear icon that hides while its value is empty must name a string prop', () => {
    const bad = structuredClone(INPUT);
    bad.icons.find(icon => icon.slot === 'clear').hideWhenEmpty = 'allowClear';
    assert.match(validateTemplateSchema(bad).join('\n'), /hideWhenEmpty "allowClear" is not a string prop/);
});

test('live typing: Allow Clear adds the layer, the empty value only hides it, a value shows it, off removes it', () => {
    const model = modelFor(INPUT);
    const clearOf = nodes => nodes.find(n => n.behavior?.slot === 'clear');
    assert.equal(clearOf(instanceFor(model, {})), undefined, 'off: no clear layer');
    assert.equal(clearOf(instanceFor(model, { allowClear: true }))?.visible, false, 'on with an empty value: present but hidden, so Play can show it as the value is typed');
    assert.equal(clearOf(instanceFor(model, { allowClear: true, value: 'a' }))?.visible, true, 'on with a value: drawn');
    assert.equal(clearOf(instanceFor(model, { allowClear: false, value: 'a' })), undefined, 'off with a value: still no layer');
});
