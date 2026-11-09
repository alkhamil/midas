// The shared pieces the Input family (Password, TextArea, InputNumber) stands on: the family helper, the built-in glyphs, glyph conditions, the masked
// control, the press actions (a toggle and a step), decimal number props with derived bounds. Synthetic schemas built on the Input, never a registered template.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INPUT } from '../src/templates/input.js';
import { inputFamily } from '../src/templates/input-family.js';
import { GLYPHS, glyphPathD } from '../src/behavior-engine/glyphs.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { literalFields } from '../src/behavior-engine/display.js';
import { resolveProps, setInstanceProp } from '../src/behavior-engine/instance-props.js';
import { applyPress, stepValue } from '../src/prototype/press.js';

const SECRET_ADDED = {
    props: {
        visibilityToggle: { source: 'literal', type: 'boolean', default: true },
        revealed: { source: 'literal', type: 'boolean', default: false, visibleIf: { prop: 'visibilityToggle', is: true } },
    },
    anatomy: [
        { id: 'reveal', kind: 'glyph', glyph: 'eye', optional: true, managed: true, shownWhen: { all: [{ prop: 'visibilityToggle', is: true }, { prop: 'revealed', is: true }] } },
        { id: 'conceal', kind: 'glyph', glyph: 'eyeOff', optional: true, managed: true, shownWhen: { all: [{ prop: 'visibilityToggle', is: true }, { prop: 'revealed', is: false }] } },
    ],
    tokens: { fromVariant: ['toggle-fg'] },
    tokenKinds: { 'toggle-fg': 'color' },
    tokenRoles: { 'toggle-fg': 'placeholder' },
    display: { reveal: { fill: 'toggle-fg', size: 'iconSize' }, conceal: { fill: 'toggle-fg', size: 'iconSize' } },
    persistentStates: { visibilityToggle: { prop: 'visibilityToggle', tokens: {} }, revealed: { prop: 'revealed', tokens: {} } },
    statePseudo: { visibilityToggle: '[data-visibility-toggle]', revealed: '[data-revealed]' },
    control: { ...INPUT.control, maskUnless: 'revealed' },
    press: [{ slot: 'reveal', toggle: 'revealed' }, { slot: 'conceal', toggle: 'revealed' }],
};
const secret = (added = {}) => inputFamily({ id: 'secret', name: 'Secret', sampleProps: { placeholder: 'Secret' }, added: { ...SECRET_ADDED, ...added } });

test('the family helper clones the Input: its sizes, states and managed text are Input\'s own, the clear icon is dropped', () => {
    const s = secret();
    assert.deepEqual(validateTemplateSchema(s), []);
    assert.notEqual(s.props, INPUT.props, 'a clone, not the Input itself');
    assert.deepEqual(s.props.size, INPUT.props.size);
    assert.ok(!('allowClear' in s.props) && !('clearIcon' in s.props));
    assert.ok(!s.anatomy.some(a => a.id === 'clear') && !s.icons.some(d => d.slot === 'clear') && !('clear' in s.display));
    assert.ok(!s.tokens.fromSize.includes('clearIconSize') && !s.tokens.fromVariant.includes('clear-hover'));
    assert.ok(INPUT.anatomy.some(a => a.id === 'clear'), 'the Input itself is untouched');
    assert.deepEqual(s.anatomy.slice(-2).map(a => a.id), ['reveal', 'conceal'], 'added slots go last');
});

test('the built-in glyphs of the family are closed outlines in the 24 space', () => {
    for (const name of ['eye', 'eyeOff', 'chevronUp', 'chevronDown']) {
        assert.ok(GLYPHS[name], name);
        assert.ok(GLYPHS[name].points.length >= 3);
        assert.ok(GLYPHS[name].points.every(p => p.x >= 0 && p.x <= 24 && p.y >= 0 && p.y <= 24), `${name} stays in the box`);
        assert.match(glyphPathD(name), /^M/);
    }
    assert.notEqual(glyphPathD('eye'), glyphPathD('eyeOff'));
    assert.notEqual(glyphPathD('chevronUp'), glyphPathD('chevronDown'));
});

test('a glyph is shown by a condition over state props: every one must be a boolean with an attribute state', () => {
    assert.deepEqual(validateTemplateSchema(secret()), []);
    const bad = secret({ statePseudo: { visibilityToggle: '[data-visibility-toggle]', revealed: ':hover' } });
    assert.ok(validateTemplateSchema(bad).some(p => /glyph slot "reveal"/.test(p)), 'revealed has no attribute state');
    const nonBool = secret({ anatomy: [{ id: 'reveal', kind: 'glyph', glyph: 'eye', optional: true, managed: true, shownWhen: { prop: 'placeholder', empty: false } }] });
    assert.ok(validateTemplateSchema(nonBool).some(p => /glyph slot "reveal"/.test(p)));
});

test('maskUnless: the canvas value is bullets while the named prop is off, and the value stays in its prop', () => {
    const s = secret();
    const value = (props) => literalFields(s, resolveProps(s, props)).find(f => f.key === 'value' && f.field === 'text').value;
    assert.equal(value({ value: 'abc' }), '•••');
    assert.equal(value({ value: 'abc', revealed: true }), 'abc');
    assert.equal(value({ value: '' }), '');
    assert.equal(resolveProps(s, { value: 'abc' }).value, 'abc');
    assert.equal(value({ value: 'abc', visibilityToggle: false }), '•••', 'no toggle means no way to reveal: masked');
});

test('maskUnless must name a boolean prop of the template', () => {
    assert.ok(validateTemplateSchema(secret({ control: { ...INPUT.control, maskUnless: 'nope' } })).some(p => /maskUnless/.test(p)));
    assert.ok(validateTemplateSchema(secret({ control: { ...INPUT.control, maskUnless: 'placeholder' } })).some(p => /maskUnless/.test(p)));
});

test('press toggle names a glyph slot and a boolean state prop; press step is validated apart', () => {
    assert.ok(validateTemplateSchema(secret({ press: [{ slot: 'nope', toggle: 'revealed' }] })).some(p => /press/.test(p)));
    assert.ok(validateTemplateSchema(secret({ press: [{ slot: 'reveal', toggle: 'placeholder' }] })).some(p => /press/.test(p)));
    assert.ok(validateTemplateSchema(secret({ press: [{ slot: 'reveal' }] })).some(p => /press/.test(p)), 'an entry with neither toggle nor step');
    assert.ok(validateTemplateSchema(secret({ press: [{ slot: 'reveal', step: 2 }] })).some(p => /press/.test(p)), 'a step is 1 or -1');
});

// A minimal element: attributes, a parent chain and children, enough for applyPress.
function el(attrs = {}, parent = null, tag = 'div') {
    const node = {
        tag, attrs: { ...attrs }, parent, kids: [], value: '', type: undefined,
        getAttribute(n) { return n in this.attrs ? String(this.attrs[n]) : null; },
        hasAttribute(n) { return n in this.attrs; },
        setAttribute(n, v) { this.attrs[n] = String(v); },
        removeAttribute(n) { delete this.attrs[n]; },
        closest(sel) { const m = /^\[([a-z-]+)\]$/.exec(sel)[1]; for (let e = this; e; e = e.parent) if (e.hasAttribute(m)) return e; return null; },
        querySelectorAll(sel) { const m = /^\[([a-z-]+)\]$/.exec(sel)?.[1]; const out = []; const walk = e => { for (const k of e.kids) { if (m ? k.hasAttribute(m) : sel.split(',').includes(k.tag)) out.push(k); walk(k); } }; walk(this); return out; },
        querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; },
    };
    parent?.kids.push(node);
    return node;
}

test('applyPress toggle flips the root attribute, retypes the masked input, and a disabled input blocks it', () => {
    const root = el({ 'data-press-root': '' });
    const input = el({ 'data-mask-unless': 'data-revealed' }, root, 'input'); input.type = 'password';
    const glyph = el({ 'data-press': 'toggle', 'data-press-attr': 'data-revealed' }, root);
    assert.equal(applyPress(glyph), true);
    assert.equal(root.hasAttribute('data-revealed'), true);
    assert.equal(input.type, 'text');
    applyPress(glyph);
    assert.equal(root.hasAttribute('data-revealed'), false);
    assert.equal(input.type, 'password');
    input.attrs.disabled = '';
    assert.equal(applyPress(glyph), false);
    assert.equal(root.hasAttribute('data-revealed'), false, 'disabled blocks');
    assert.equal(applyPress(el({})), false, 'a click elsewhere is nothing');
});

test('stepValue moves by step within min and max, formats to the precision, and starts from 0 when empty', () => {
    const opts = { min: 0, max: 10, step: 1, precision: null };
    assert.equal(stepValue('3', 1, opts), '4');
    assert.equal(stepValue('3', -1, opts), '2');
    assert.equal(stepValue('', 1, opts), '1');
    assert.equal(stepValue('10', 1, opts), '10', 'clamped at max');
    assert.equal(stepValue('0', -1, opts), '0', 'clamped at min');
    assert.equal(stepValue('0.1', 1, { ...opts, step: 0.2 }), '0.3', 'no float drift');
    assert.equal(stepValue('1', 1, { ...opts, step: 0.5, precision: 2 }), '1.50');
    assert.equal(stepValue('abc', 1, opts), '1', 'not a number counts as empty');
    assert.equal(stepValue('5', 1, { ...opts, min: null, max: null }), '6', 'no limits');
});

test('applyPress step writes the input, marks the bound reached on the root, and a disabled input blocks it', () => {
    const root = el({ 'data-press-root': '' });
    const input = el({ 'data-num-min': '0', 'data-num-max': '2', 'data-num-step': '1' }, root, 'input'); input.value = '1';
    const up = el({ 'data-press': 'step', 'data-press-step': '1' }, root);
    const down = el({ 'data-press': 'step', 'data-press-step': '-1' }, root);
    applyPress(up);
    assert.equal(input.value, '2');
    assert.ok(root.hasAttribute('data-at-max') && !root.hasAttribute('data-at-min'));
    applyPress(up);
    assert.equal(input.value, '2');
    applyPress(down); applyPress(down);
    assert.equal(input.value, '0');
    assert.ok(root.hasAttribute('data-at-min') && !root.hasAttribute('data-at-max'));
    input.attrs.disabled = '';
    assert.equal(applyPress(up), false);
    assert.equal(input.value, '0');
});

test('a decimal number prop takes negatives and fractions; a plain number prop still takes whole numbers only', () => {
    const t = inputFamily({ id: 'num', name: 'Num', sampleProps: { placeholder: 'n' }, added: { props: { min: { source: 'literal', type: 'number', decimal: true, default: null }, step: { source: 'literal', type: 'number', decimal: true, default: 1 } } } });
    assert.deepEqual(validateTemplateSchema(t), []);
    assert.equal(setInstanceProp(t, {}, 'min', -2.5).min, -2.5);
    assert.throws(() => setInstanceProp(t, {}, 'min', Infinity));
    assert.throws(() => setInstanceProp(t, {}, 'maxLength', -1), /whole number/);
});

test('a derived bound prop is true while the value reaches its limit, and is never stored', () => {
    const t = inputFamily({ id: 'num', name: 'Num', sampleProps: { placeholder: 'n' }, added: { props: {
        min: { source: 'literal', type: 'number', decimal: true, default: null },
        max: { source: 'literal', type: 'number', decimal: true, default: null },
        atMin: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'min', cmp: 'lte' } },
        atMax: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'max', cmp: 'gte' } },
    } } });
    assert.deepEqual(validateTemplateSchema(t), []);
    const at = props => { const r = resolveProps(t, props); return [r.atMin, r.atMax]; };
    assert.deepEqual(at({ value: '5', min: 0, max: 5 }), [false, true]);
    assert.deepEqual(at({ value: '0', min: 0, max: 5 }), [true, false]);
    assert.deepEqual(at({ value: '3', min: 0, max: 5 }), [false, false]);
    assert.deepEqual(at({ value: '', min: 0, max: 5 }), [false, false], 'empty reaches nothing');
    assert.deepEqual(at({ value: '9', min: null, max: null }), [false, false], 'no limit');
    assert.throws(() => setInstanceProp(t, {}, 'atMax', true), /derived/);
});
