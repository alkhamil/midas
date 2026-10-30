import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProps, setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');

test('an instance with no stored props resolves every literal prop to its schema default', () => {
    assert.deepEqual(resolveProps(button, {}), {
        label: 'Button',
        hasIcon: false,
        iconPlacement: 'start',
        icon: null,
        iconEnd: null,
        loading: false,
        disabled: false,
    });
});

test('a stored prop overrides its default, the others keep theirs', () => {
    const props = resolveProps(button, { label: 'Save' });
    assert.equal(props.label, 'Save');
    assert.equal(props.disabled, false);
});

test('a variable prop is not a behavior prop: it is not resolved, and a stored one is not read', () => {
    assert.equal('variant' in resolveProps(button, { variant: 'm2' }), false);
    assert.equal('size' in resolveProps(button, {}), false);
});

test('setting a variable prop is refused: the mode is an Appearance mode', () => {
    assert.throws(() => setInstanceProp(button, {}, 'variant', 'danger'), /is an Appearance mode/);
});

test('a prop hidden by visibleIf ignores a stored value and resolves to its default', () => {
    const props = resolveProps(button, { hasIcon: false, iconPlacement: 'end' });
    assert.equal(props.iconPlacement, 'start');
});

test('setting a prop hidden by visibleIf is refused', () => {
    assert.throws(() => setInstanceProp(button, {}, 'iconPlacement', 'end'), /hidden by visibleIf/);
});
