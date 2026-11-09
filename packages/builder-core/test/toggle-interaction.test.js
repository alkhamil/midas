// A control declares `toggle: { prop, clears?, once? }`: a click in Play turns the state prop on (and off again, unless `once`), clears the state named by
// `clears` (a Checkbox's indeterminate), and does nothing while disabled. The root says the toggle as data attributes so Play needs no template, and says
// aria-checked in Play and in the export. The step itself is a pure function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { toggleOf, ariaCheckedOf } from '../src/behavior-engine/display.js';
import { nextToggle } from '../src/prototype/toggle.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const checkbox = TEMPLATES.get('checkbox'), radio = TEMPLATES.get('radio'), sw = TEMPLATES.get('switch');

test('the three controls declare their toggle', () => {
    assert.deepEqual(checkbox.toggle, { prop: 'checked', clears: 'indeterminate' });
    assert.deepEqual(radio.toggle, { prop: 'checked', once: true });
    assert.deepEqual(sw.toggle, { prop: 'checked' });
    assert.deepEqual(toggleOf(checkbox), { attr: 'data-checked', clearsAttr: 'data-indeterminate', once: false });
    assert.deepEqual(toggleOf(radio), { attr: 'data-checked', clearsAttr: undefined, once: true });
    assert.equal(toggleOf({ ...checkbox, toggle: undefined }), null);
});

test('the schema refuses a toggle whose prop is not a boolean state with an attribute', () => {
    const bad = patch => { const t = structuredClone(checkbox); t.toggle = patch; return validateTemplateSchema(t); };
    assert.deepEqual(bad({ prop: 'checked' }), []);
    assert.ok(bad({ prop: 'label' }).some(p => /toggle/.test(p)));
    assert.ok(bad({ prop: 'disabled' }).some(p => /toggle/.test(p)), 'disabled is a state without an attribute');
    assert.ok(bad({ prop: 'checked', clears: 'hasLabel' }).some(p => /toggle/.test(p)));
    assert.ok(bad({ prop: 'checked', once: 'yes' }).some(p => /toggle/.test(p)));
});

test('a click turns the state on and off; a Checkbox clears indeterminate; a once toggle never turns off', () => {
    assert.deepEqual(nextToggle({ checked: false, indeterminate: false }, { once: false }), { checked: true, indeterminate: false });
    assert.deepEqual(nextToggle({ checked: true, indeterminate: false }, { once: false }), { checked: false, indeterminate: false });
    assert.deepEqual(nextToggle({ checked: false, indeterminate: true }, { once: false, clears: true }), { checked: true, indeterminate: false }, 'a mixed box becomes checked and is no longer mixed');
    assert.deepEqual(nextToggle({ checked: true, indeterminate: true }, { once: false, clears: true }), { checked: false, indeterminate: false });
    assert.deepEqual(nextToggle({ checked: false, indeterminate: false }, { once: true }), { checked: true, indeterminate: false });
    assert.deepEqual(nextToggle({ checked: true, indeterminate: false }, { once: true }), { checked: true, indeterminate: false }, 'a radio stays selected');
});

test('aria-checked is true, false or mixed from the props', () => {
    assert.equal(ariaCheckedOf(checkbox, { checked: true }), 'true');
    assert.equal(ariaCheckedOf(checkbox, {}), 'false');
    assert.equal(ariaCheckedOf(checkbox, { indeterminate: true }), 'mixed');
    assert.equal(ariaCheckedOf(radio, { checked: true }), 'true');
    assert.equal(ariaCheckedOf({ ...radio, toggle: undefined }, { checked: true }), undefined);
});

test('the roles are on the roots and Play and the export carry the toggle and aria-checked', () => {
    assert.equal(checkbox.element.attrs.role, 'checkbox');
    assert.equal(radio.element.attrs.role, 'radio');
    assert.equal(sw.element.attrs.role, 'switch');
    for (const template of [checkbox, radio, sw]) {
        const model = modelFor(template);
        const nodes = instanceFor(model, { checked: true });
        const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
        assert.equal(root.attrs['data-toggle'], 'data-checked', template.id);
        assert.equal(root.attrs['aria-checked'], 'true', template.id);
        const jsx = generateComponent(template, model.binding, model.variables, template.name, model.frame, id => model.created.filter(n => n.parentId === id)).files[`${template.name}.jsx`];
        assert.match(jsx, template.toggle.clears ? /aria-checked=\{indeterminate \? "mixed" : checked \? "true" : "false"\}/ : /aria-checked=\{checked \? "true" : "false"\}/, template.id);
    }
    const model = modelFor(checkbox);
    const nodes = instanceFor(model, { indeterminate: true });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.equal(root.attrs['aria-checked'], 'mixed');
    assert.equal(root.attrs['data-toggle-clears'], 'data-indeterminate');
    const radioModel = modelFor(radio), rn = instanceFor(radioModel, {});
    assert.equal(toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [radioModel.frame, ...radioModel.created, ...rn] }], variables: radioModel.variables }, rn[0].id).root.attrs['data-toggle-once'], true);
});

// ---- applyToggle: the DOM step, over a plain element-like object ----
import { applyToggle, flipToggle } from '../src/prototype/toggle.js';

/** An element-like object: attributes, a style, descendants, and a hidden flag. */
function fake(attrs) {
    const map = new Map(Object.entries(attrs));
    return {
        style: {},
        getAttribute: name => map.get(name) ?? null,
        hasAttribute: name => map.has(name),
        setAttribute: (name, value) => map.set(name, String(value)),
        removeAttribute: name => map.delete(name),
        has: name => map.has(name),
        get: name => map.get(name),
    };
}

test('a click on a checkbox sets checked, ends indeterminate and updates aria-checked (the glyphs follow from the attributes, in the stylesheet)', () => {
    const root = fake({ 'data-toggle': 'data-checked', 'data-toggle-clears': 'data-indeterminate', 'data-indeterminate': '', 'aria-checked': 'mixed' });
    assert.equal(applyToggle(root), true);
    assert.ok(root.has('data-checked') && !root.has('data-indeterminate'));
    assert.equal(root.get('aria-checked'), 'true');
    applyToggle(root);
    assert.ok(!root.has('data-checked'));
    assert.equal(root.get('aria-checked'), 'false');
});

test('a click on a radio selects it and a second click leaves it selected', () => {
    const root = fake({ 'data-toggle': 'data-checked', 'data-toggle-once': '', 'aria-checked': 'false' });
    applyToggle(root);
    applyToggle(root);
    assert.ok(root.has('data-checked'));
    assert.equal(root.get('aria-checked'), 'true');
});

test('a click on a switch moves the handle: the alignment attribute and the root style follow', () => {
    const root = fake({ 'data-toggle': 'data-checked', 'data-checked-align': 'start', 'aria-checked': 'false' });
    applyToggle(root);
    assert.deepEqual([root.get('data-checked-align'), root.style.justifyContent], ['end', 'flex-end']);
    applyToggle(root);
    assert.deepEqual([root.get('data-checked-align'), root.style.justifyContent], ['start', 'flex-start']);
});

test('a disabled control and an element with no toggle ignore the click', () => {
    for (const disabled of [{ disabled: '' }, { 'aria-disabled': 'true' }]) {
        const root = fake({ 'data-toggle': 'data-checked', ...disabled });
        assert.equal(applyToggle(root), false);
        assert.ok(!root.has('data-checked'));
    }
    assert.equal(applyToggle(fake({})), false);
});

test('a switch click glides the handle: the child that moved animates from its old spot', () => {
    const calls = [];
    let n = 0;
    const mover = { getBoundingClientRect: () => ({ left: n++ === 0 ? 10 : 50 }), animate: (frames, opts) => calls.push([frames, opts]) };
    const root = { ...fake({ 'data-toggle': 'data-checked', 'data-checked-align': 'start', 'aria-checked': 'false' }), children: [mover] };
    assert.equal(flipToggle(root), true);
    assert.deepEqual(calls.length, 1);
    assert.deepEqual(calls[0][0], [{ transform: 'translateX(-40px)' }, { transform: 'translateX(0px)' }]);
    assert.equal(calls[0][1].duration, 200);
});

test('a click that moves nothing animates nothing; reduced motion skips the glide', () => {
    const still = { getBoundingClientRect: () => ({ left: 10 }), animate: () => { throw new Error('no animation expected'); } };
    assert.equal(flipToggle({ ...fake({ 'data-toggle': 'data-checked', 'aria-checked': 'false' }), children: [still] }), true);
    let m = 0;
    const mover = { getBoundingClientRect: () => ({ left: m++ === 0 ? 10 : 50 }), animate: () => { throw new Error('no animation expected'); } };
    const reduced = { ...fake({ 'data-toggle': 'data-checked', 'data-checked-align': 'start', 'aria-checked': 'false' }), children: [mover], ownerDocument: { defaultView: { matchMedia: () => ({ matches: true }) } } };
    assert.equal(flipToggle(reduced), true);
});

test('a disabled toggle glides nothing and returns false', () => {
    assert.equal(flipToggle({ ...fake({ 'data-toggle': 'data-checked', disabled: '' }), children: [] }), false);
});

test('flipToggle works on a real DOM children collection, which has no map', () => {
    let n = 0;
    const mover = { getBoundingClientRect: () => ({ left: n++ === 0 ? 10 : 50 }), animate: () => {} };
    // An HTMLCollection is array-like: indexed with a length, but no map.
    const collection = { 0: mover, length: 1 };
    const root = { ...fake({ 'data-toggle': 'data-checked', 'data-checked-align': 'start', 'aria-checked': 'false' }), children: collection };
    assert.equal(flipToggle(root), true);
    assert.ok(root.has('data-checked'), 'the click flips the state even though children has no map');
});

test('a handle that is released from a press moves and resizes in one glide, anchored by the alignment', () => {
    const run = (align, rects, on = false) => {
        const calls = [];
        let n = 0;
        const handle = { style: { transition: '' }, getBoundingClientRect: () => rects[n++], animate: (frames, opts) => calls.push([frames, opts]) };
        const root = { ...fake({ 'data-toggle': 'data-checked', 'data-checked-align': align, ...(on ? { 'data-checked': '' } : {}), 'aria-checked': String(on) }), children: [handle] };
        assert.equal(flipToggle(root), true);
        assert.equal(handle.style.transition, '', 'the handle\'s own transition is given back');
        return calls[0][0];
    };
    // Unchecked to checked: pressed width 22 at the start (left 2) ends 18 wide at the end (left 24); the far edge is the anchor.
    assert.deepEqual(run('start', [{ left: 2, width: 22 }, { left: 24, width: 18 }]), [{ transform: 'translateX(-18px)', width: '22px' }, { transform: 'translateX(0px)', width: '18px' }]);
    // Checked to unchecked: pressed width 22 at the end (left 20) ends 18 wide at the start (left 2); the near edge is the anchor.
    assert.deepEqual(run('end', [{ left: 20, width: 22 }, { left: 2, width: 18 }], true), [{ transform: 'translateX(18px)', width: '22px' }, { transform: 'translateX(0px)', width: '18px' }]);
});

test('a scaled stage: the glide is in the handle\'s own px, not the screen\'s', () => {
    const calls = [];
    let n = 0;
    const rects = [{ left: 4, width: 44 }, { left: 48, width: 36 }];
    const handle = { style: { transition: '' }, getBoundingClientRect: () => rects[n++], animate: (frames) => calls.push(frames) };
    // The track is 44px wide in its own px and 88px on screen: a stage scaled by 2.
    const root = { ...fake({ 'data-toggle': 'data-checked', 'data-checked-align': 'start', 'aria-checked': 'false' }), offsetWidth: 44, getBoundingClientRect: () => ({ left: 0, width: 88 }), children: [handle] };
    assert.equal(flipToggle(root), true);
    assert.deepEqual(calls[0], [{ transform: 'translateX(-18px)', width: '22px' }, { transform: 'translateX(0px)', width: '18px' }]);
});
