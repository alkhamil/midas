// The pure logic Play and the export share for the number input and the text area: committing a typed number on blur, dragging the resize handle within the box's
// min and max height, and a click on the box's padding focusing the field. Element-like fakes, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commitNumber, resizeHeight, resizeLimits, forwardFocus, startResizeDrag } from '../src/prototype/press.js';

const limits = { min: 0, max: 10, precision: null };

test('blur: empty -> letters -> blur = empty', () => {
    let committed = '';
    const typed = 'abc';
    assert.equal(commitNumber(typed, committed, limits), '');
});

test('blur: 3 -> letters -> blur = 3 (the last committed value comes back)', () => {
    assert.equal(commitNumber('3x', '3', limits), '3');
    assert.equal(commitNumber('abc', '3', limits), '3');
    assert.equal(commitNumber('--', '3', limits), '3');
});

test('blur: 3 -> 5 -> blur = 5 (a valid number commits), and the commit becomes the next fallback', () => {
    const first = commitNumber('5', '3', limits);
    assert.equal(first, '5');
    assert.equal(commitNumber('zzz', first, limits), '5');
});

test('blur: a valid number is clamped to min and max and rounded to the precision', () => {
    assert.equal(commitNumber('15', '3', limits), '10');
    assert.equal(commitNumber('-4', '3', limits), '0');
    assert.equal(commitNumber('1.2345', '3', { ...limits, precision: 2 }), '1.23');
    assert.equal(commitNumber('2', '3', { ...limits, precision: 2 }), '2.00');
    assert.equal(commitNumber('7', '3', { min: null, max: null, precision: null }), '7');
});

test('blur: clearing the field is a valid empty value, not an error', () => {
    assert.equal(commitNumber('', '3', limits), '');
    assert.equal(commitNumber('   ', '3', limits), '');
});

test('the commit function carries no outside reference, so the export can embed its source', () => {
    const source = commitNumber.toString();
    // eslint-disable-next-line no-new-func
    const standalone = new Function(`return (${source});`)();
    assert.equal(standalone('3x', '3', limits), '3');
    assert.equal(standalone('9', '3', limits), '9');
});

test('resize limits: the textarea may be as short as the box minimum allows and as tall as its maximum, the chrome around it kept', () => {
    // root min 68, max 128 (the tokens, computed by the browser), the root is 80 tall with a 60 tall textarea: 20px of padding and footer around it.
    assert.deepEqual(resizeLimits({ minHeight: '68px', maxHeight: '128px' }, 80, 60), { min: 48, max: 108 });
    assert.deepEqual(resizeLimits({ minHeight: '68px', maxHeight: 'none' }, 80, 60), { min: 48, max: Infinity });
    assert.deepEqual(resizeLimits({ minHeight: '0px', maxHeight: 'none' }, 80, 60), { min: 0, max: Infinity });
});

test('resize: dragging the handle changes the height within min and max, vertically only', () => {
    const limitsOf = { min: 48, max: 108 };
    assert.equal(resizeHeight(60, 20, limitsOf), 80);
    assert.equal(resizeHeight(60, 200, limitsOf), 108, 'clamped at the max-height token');
    assert.equal(resizeHeight(60, -200, limitsOf), 48, 'clamped at the min-height token');
});

test('resize drag: pointer down on the handle, move, release sets the textarea height; a disabled field does not resize', () => {
    const area = { offsetHeight: 60, style: {}, hasAttribute: n => n === 'disabled' && area.disabled === true, disabled: false };
    const root = { offsetHeight: 80, querySelector: () => area };
    const computed = { minHeight: '48px', maxHeight: '108px' };
    const drag = startResizeDrag(root, 100, () => computed);
    drag.move(130);
    assert.equal(area.style.height, '90px');
    drag.move(400);
    assert.equal(area.style.height, '108px');
    drag.move(-400);
    assert.equal(area.style.height, '48px');
    area.disabled = true;
    area.style = {};
    assert.equal(startResizeDrag(root, 100, () => computed), null, 'disabled: no drag');
});

// A fake element tree for the click forwarding.
function node(attrs = {}, parent = null, tag = 'div') {
    const n = { tag, attrs: { ...attrs }, parent, focused: false,
        hasAttribute(name) { return name in this.attrs; },
        closest(sel) { for (let e = this; e; e = e.parent) if (sel.split(',').some(s => (s.startsWith('[') ? e.hasAttribute(s.slice(1, -1)) : e.tag === s))) return e; return null; },
        querySelector(sel) { return this.kids.find(k => sel.split(',').includes(k.tag)) ?? null; }, kids: [],
        focus() { this.focused = true; } };
    parent?.kids.push(n);
    return n;
}

test('a click on the padding of the box focuses the field; a click on the field itself, on a handle or on a disabled box does not', () => {
    const box = node({ 'data-field-box': '' });
    const area = node({}, box, 'textarea');
    assert.equal(forwardFocus(box), true);
    assert.ok(area.focused, 'the field takes the focus');
    area.focused = false;
    assert.equal(forwardFocus(area), false, 'the field handles its own click');
    const handle = node({ 'data-press': 'resize' }, box);
    assert.equal(forwardFocus(handle), false, 'the handle keeps its own behaviour');
    area.attrs.disabled = '';
    assert.equal(forwardFocus(box), false, 'a disabled box focuses nothing');
    assert.ok(!area.focused);
    assert.equal(forwardFocus(node({})), false, 'a click elsewhere is nothing');
});
