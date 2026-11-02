import test from 'node:test';
import assert from 'node:assert/strict';
import { setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { BUTTON } from '../src/templates/button.js';
import { INPUT } from '../src/templates/input.js';

test('Button\'s icon placement is start or end: both is refused', () => {
    assert.deepEqual(BUTTON.props.iconPlacement.options, ['start', 'end'], 'Button offers start and end only');
    assert.equal(setInstanceProp(BUTTON, { hasIcon: true }, 'iconPlacement', 'end').iconPlacement, 'end');
    assert.throws(() => setInstanceProp(BUTTON, { hasIcon: true }, 'iconPlacement', 'both'), /expects one of start, end/);
});

test('Input has no icon placement: its sides are prefix and suffix, each Text or Icon', () => {
    for (const prop of ['hasIcon', 'iconPlacement', 'icon', 'iconEnd']) assert.equal(prop in INPUT.props, false, `Input has no ${prop}`);
    for (const slot of ['iconStart', 'iconEnd']) assert.equal(INPUT.anatomy.some(s => s.id === slot), false, `Input has no ${slot} slot`);
    for (const [side, has] of [['prefix', 'hasPrefix'], ['suffix', 'hasSuffix']]) {
        assert.deepEqual(INPUT.props[`${side}Kind`].options, ['text', 'icon']);
        assert.equal(INPUT.props[`${side}Kind`].default, 'text');
        assert.equal(INPUT.props[`${side}Kind`].control, 'segmented');
        assert.throws(() => setInstanceProp(INPUT, { [has]: true }, `${side}Kind`, 'both'), /expects one of text, icon/);
    }
});
