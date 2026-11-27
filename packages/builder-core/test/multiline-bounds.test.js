// The min and max height of a multiline control's text layer: its rows x line height, where a line height that is a ratio (below 4) is measured at
// the layer's font size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { multilineLayerBounds } from '../src/behavior-engine/display.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';

const input = TEMPLATES.get('input');
const textarea = rows => resolveProps(input, { kind: 'textarea', rows });

test('a pixel line height is taken as it is: rows x line height', () => {
    const layer = { lineHeight: 20, fontSize: 14 };
    assert.deepEqual(multilineLayerBounds(input, textarea(2), layer), { minH: 40, maxH: undefined });
});

test('a ratio line height (below 4) is measured at the font size', () => {
    const layer = { lineHeight: 1.5, fontSize: 14 };
    assert.deepEqual(multilineLayerBounds(input, textarea(2), layer), { minH: 42, maxH: undefined });
});

test('a control that is not multiline has no bounds', () => {
    const plain = resolveProps(input, { kind: 'text' });
    assert.deepEqual(multilineLayerBounds(input, plain, { lineHeight: 20, fontSize: 14 }), { minH: undefined, maxH: undefined });
});
