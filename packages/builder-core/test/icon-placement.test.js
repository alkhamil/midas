import test from 'node:test';
import assert from 'node:assert/strict';
import { setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { BUTTON } from '../src/templates/button.js';
import { INPUT } from '../src/templates/input.js';

test('an icon placement is start or end: both is refused on every template that has icons', () => {
    for (const template of [BUTTON, INPUT]) {
        assert.deepEqual(template.props.iconPlacement.options, ['start', 'end'], `${template.id} offers start and end only`);
        assert.equal(setInstanceProp(template, { hasIcon: true }, 'iconPlacement', 'end').iconPlacement, 'end');
        assert.throws(() => setInstanceProp(template, { hasIcon: true }, 'iconPlacement', 'both'), /expects one of start, end/);
    }
});
