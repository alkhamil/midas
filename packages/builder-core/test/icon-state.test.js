// An icon takes the colour the persistent states give its colour token while they are on: a Tab's Active recolours its icon as its label.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { iconColourTokenOf } from '../src/behavior-engine/icon-slot.js';

const tab = TEMPLATES.get('antd-tab');

test('Active gives the icon the active colour token; off keeps the colour token', () => {
    assert.equal(iconColourTokenOf(tab, { active: true }, 'fg'), 'fg-active');
    assert.equal(iconColourTokenOf(tab, { active: false }, 'fg'), 'fg');
});

test('a token no persistent state changes stays as it is', () => {
    assert.equal(iconColourTokenOf(tab, { active: true }, 'iconSize'), 'iconSize');
});
