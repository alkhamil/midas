import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDisabledTarget, eventFromDom } from '../src/prototype/events.js';

const frame = { tag: 'div', attrs: {} };
const button = disabled => ({ tag: 'button', attrs: disabled ? { type: 'button', disabled: true } : { type: 'button' } });
const label = { tag: 'span', attrs: { class: 'button-label' } };

test('a disabled Button is a disabled target', () => {
    assert.equal(isDisabledTarget(button(true), [frame]), true);
});

test('the label inside a disabled Button is a disabled target', () => {
    assert.equal(isDisabledTarget(label, [frame, button(true)]), true);
});

test('a nested layer inside a disabled Button is a disabled target', () => {
    const nested = { tag: 'div', attrs: {} };
    assert.equal(isDisabledTarget(nested, [frame, button(true), label]), true);
});

test('an enabled sibling of a disabled Button is not disabled', () => {
    assert.equal(isDisabledTarget(button(false), [frame]), false);
    assert.equal(isDisabledTarget(label, [frame, button(false)]), false);
});

test('a frame with an on-click is not disabled by its own interaction: only its disabled children are', () => {
    assert.equal(isDisabledTarget(frame, []), false);
});

test('a mouse event on a DOM type Play does not listen to is no event', () => {
    assert.equal(eventFromDom('dblclick', 'n'), null);
    assert.deepEqual(eventFromDom('click', 'n'), { type: 'pointer', nodeId: 'n', trigger: 'on-click' });
});
