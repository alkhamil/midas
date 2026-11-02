import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { INPUT } from '../src/templates/input.js';

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
