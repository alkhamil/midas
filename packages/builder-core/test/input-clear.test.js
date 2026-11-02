import test from 'node:test';
import assert from 'node:assert/strict';
import { setInstanceValue } from '../src/behavior-engine/panel.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { partWrites } from '../src/behavior-engine/display.js';
import { INPUT } from '../src/templates/input.js';

// A master bound to the Input template (its variables are not read by these tests).
const master = { id: 'm', name: 'Input', type: 'frame', component: true, behavior: { version: 2, templateId: 'input', variables: {} } };

/** The count part's text for stored props, as the engine writes it from the props (partWrites). */
const countText = props => partWrites(INPUT, resolveProps(INPUT, props)).find(w => w.key === 'count' && w.field === 'text').value;

test('clearing Max length stores null (no limit), and the counter then reads the length only', () => {
    const set = (props, prop, value) => setInstanceValue({ behavior: { version: 2, props } }, master, prop, value).props;
    const limited = set({ value: 'Hello', showCount: true }, 'maxLength', 5);
    assert.equal(limited.maxLength, 5);
    assert.equal(countText(limited), '5 / 5');
    const cleared = set(limited, 'maxLength', null);
    assert.equal(cleared.maxLength, null, 'a cleared Max length is stored as null');
    assert.equal(countText(cleared), '5', 'the counter refreshes to the length only');
});

test('clearing Min length stores null', () => {
    const set = (props, prop, value) => setInstanceValue({ behavior: { version: 2, props } }, master, prop, value).props;
    const bounded = set({ minLength: 3, maxLength: 5 }, 'minLength', 3);
    assert.equal(bounded.minLength, 3);
    const cleared = set(bounded, 'minLength', null);
    assert.equal(cleared.minLength, null);
    assert.equal(cleared.maxLength, 5, 'the Max length is kept');
});
