// Play applies a descriptor's style to its element: a custom property (`--formitem-labelGap`, which the template's rules read) goes through setProperty, since
// assigning it as a property of element.style does nothing; every other property is assigned as before. Without it a FormItem's gap and label width were
// not applied in Play, though the canvas and the export had them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStyle } from '../src/engine/styleApply.js';

const fakeElement = () => {
    const set = new Map();
    return { style: { setProperty: (k, v) => set.set(k, v) }, set };
};

test('a custom property is set with setProperty and a plain property is assigned', () => {
    const el = fakeElement();
    applyStyle(el, { display: 'flex', '--formitem-labelGap': '16px', flexDirection: 'row' });
    assert.equal(el.style.display, 'flex');
    assert.equal(el.style.flexDirection, 'row');
    assert.equal(el.set.get('--formitem-labelGap'), '16px');
    assert.equal(el.style['--formitem-labelGap'], undefined, 'not assigned as a property: that does nothing in a browser');
});

test('no style is nothing to apply', () => {
    const el = fakeElement();
    applyStyle(el, undefined);
    assert.deepEqual([...el.set], []);
});
