import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveProps, setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const button = TEMPLATES.get('button');

test('an instance with no stored props resolves every prop to its schema default', () => {
    assert.deepEqual(resolveProps(button, {}), {
        variant: null,
        size: null,
        label: 'Button',
        hasIcon: false,
        iconPlacement: 'start',
        icon: null,
        loading: false,
        disabled: false,
        fullWidth: false,
    });
});

test('a stored prop overrides its default, the others keep theirs', () => {
    const props = resolveProps(button, { label: 'Save', variant: 'm2' });
    assert.equal(props.label, 'Save');
    assert.equal(props.variant, 'm2');
    assert.equal(props.disabled, false);
});

test('a prop hidden by visibleIf ignores a stored value and resolves to its default', () => {
    const props = resolveProps(button, { hasIcon: false, iconPlacement: 'end' });
    assert.equal(props.iconPlacement, 'start');
});

test('setting a prop hidden by visibleIf is refused', () => {
    assert.throws(() => setInstanceProp(button, {}, 'iconPlacement', 'end'), /hidden by visibleIf/);
});
