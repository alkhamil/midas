// A template declares its content slots as data (`slots`): the same names and settings as Figma's slot property, so the generator can write them
// into the existing slot property. This file: the shape of a slot definition and the rules the validator holds it to. Content slots only; the icon
// slots of a template (`icons`, managed anatomy slots) are separate and keep their own checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { BUTTON } from '../src/templates/button.js';
import { INPUT } from '../src/templates/input.js';

/** A valid content slot, as in docs/slots.md. */
const SLOT = { id: 'content', name: 'Content', description: 'The control this item labels', min: 1, max: 1, accepts: ['input', 'select'], onlyAccepts: true, showEmpty: true, fillCounter: true, layout: 'vertical' };
const withSlots = (...slots) => ({ ...structuredClone(BUTTON), slots });
const problems = (...slots) => validateTemplateSchema(withSlots(...slots)).join('\n');

test('a template with no slots, and the templates that ship, are valid and unchanged', () => {
    assert.equal('slots' in BUTTON, false);
    assert.equal('slots' in INPUT, false);
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
    assert.deepEqual(validateTemplateSchema(INPUT), []);
    assert.deepEqual(validateTemplateSchema({ ...structuredClone(BUTTON), slots: [] }), [], 'an empty list is no slots');
});

test('a slot with every field the plan lists is valid, and so is one with only the fields it needs', () => {
    assert.deepEqual(validateTemplateSchema(withSlots(SLOT)), []);
    assert.deepEqual(validateTemplateSchema(withSlots({ id: 'header', name: 'Header', layout: 'horizontal' }, { id: 'footer', name: 'Footer', layout: 'vertical' })), []);
});

test('slots must be a list of objects', () => {
    assert.match(validateTemplateSchema({ ...structuredClone(BUTTON), slots: 'content' }).join('\n'), /slots must be a list/);
    assert.match(validateTemplateSchema({ ...structuredClone(BUTTON), slots: { id: 'content' } }).join('\n'), /slots must be a list/);
    assert.match(problems('content'), /slot 0 must be an object/);
    assert.match(problems(null), /slot 0 must be an object/);
});

test('a slot id is its prop name in the generated code: an identifier, unique, and not a name the component already has', () => {
    assert.match(problems({ ...SLOT, id: '' }), /slot 0 has no id/);
    assert.match(problems({ ...SLOT, id: undefined }), /slot 0 has no id/);
    for (const bad of ['Content', 'my-slot', '1st', 'a b', 'class']) assert.match(problems({ ...SLOT, id: bad }), new RegExp(`slot id "${bad}" must be a lower camel case identifier`), bad);
    assert.match(problems(SLOT, { ...SLOT, name: 'Other' }), /duplicate slot "content"/);
});

test('a slot id may not be a prop of the component, a reserved prop of the generated component, an anatomy slot or a part', () => {
    assert.match(problems({ ...SLOT, id: 'label' }), /slot "label" is named like a prop of the template/);
    assert.match(problems({ ...SLOT, id: 'variant' }), /slot "variant" is named like a prop of the template/);
    for (const reserved of ['children', 'className', 'style', 'ref', 'key']) assert.match(problems({ ...SLOT, id: reserved }), new RegExp(`slot "${reserved}" is named like a prop of the generated component`), reserved);
    assert.match(problems({ ...SLOT, id: 'iconStart' }), /slot "iconStart" is named like an anatomy slot: an icon slot is not a content slot/);
    assert.match(problems({ ...SLOT, id: 'spinner' }), /slot "spinner" is named like a part of the template/);
});

test('a slot has a name, a string description when it has one, and its names are unique', () => {
    assert.match(problems({ ...SLOT, name: '' }), /slot "content" has no name/);
    assert.match(problems({ ...SLOT, name: undefined }), /slot "content" has no name/);
    assert.match(problems({ ...SLOT, description: 3 }), /slot "content" description must be text/);
    assert.match(problems(SLOT, { ...SLOT, id: 'other' }), /slot "other" has the name "Content", which slot "content" already has/);
});

test('the limits are whole numbers: a minimum of 0 or more, a maximum of 1 or more, and the minimum is not above the maximum', () => {
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, min: 0, max: undefined })), []);
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, min: undefined, max: 5 })), []);
    assert.match(problems({ ...SLOT, min: -1 }), /slot "content" min must be a whole number, 0 or more/);
    assert.match(problems({ ...SLOT, min: 1.5 }), /slot "content" min must be a whole number, 0 or more/);
    assert.match(problems({ ...SLOT, min: '1' }), /slot "content" min must be a whole number, 0 or more/);
    assert.match(problems({ ...SLOT, max: 0 }), /slot "content" max must be a whole number, 1 or more/);
    assert.match(problems({ ...SLOT, max: 2.5 }), /slot "content" max must be a whole number, 1 or more/);
    assert.match(problems({ ...SLOT, min: 3, max: 2 }), /slot "content" min 3 is above its max 2/);
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, min: 2, max: 2 })), [], 'equal limits are fine');
});

test('layout is horizontal or vertical, and is required: the slot frame is an auto layout and there is no default to guess', () => {
    assert.match(problems({ ...SLOT, layout: undefined }), /slot "content" layout must be horizontal or vertical/);
    assert.match(problems({ ...SLOT, layout: 'grid' }), /slot "content" layout must be horizontal or vertical/);
    assert.match(problems({ ...SLOT, layout: 'none' }), /slot "content" layout must be horizontal or vertical/);
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, layout: 'horizontal' })), []);
});

test('accepts is a list of non-repeating template ids; onlyAccepts is a boolean and needs something to accept', () => {
    assert.match(problems({ ...SLOT, accepts: 'input' }), /slot "content" accepts must be a list of template ids/);
    assert.match(problems({ ...SLOT, accepts: ['input', ''] }), /slot "content" accepts must be a list of template ids/);
    assert.match(problems({ ...SLOT, accepts: ['input', 3] }), /slot "content" accepts must be a list of template ids/);
    assert.match(problems({ ...SLOT, accepts: ['input', 'input'] }), /slot "content" accepts names "input" twice/);
    assert.match(problems({ ...SLOT, onlyAccepts: 'yes' }), /slot "content" onlyAccepts must be a boolean/);
    assert.match(problems({ ...SLOT, accepts: undefined }), /slot "content" onlyAccepts needs accepts: it restricts to the templates accepts names/);
    assert.match(problems({ ...SLOT, accepts: [] }), /slot "content" onlyAccepts needs accepts/);
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, onlyAccepts: undefined })), [], 'accepts without onlyAccepts is a hint, not a restriction');
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, accepts: undefined, onlyAccepts: undefined })), []);
});

test('showEmpty and fillCounter are booleans', () => {
    assert.match(problems({ ...SLOT, showEmpty: 'yes' }), /slot "content" showEmpty must be a boolean/);
    assert.match(problems({ ...SLOT, fillCounter: 1 }), /slot "content" fillCounter must be a boolean/);
    assert.deepEqual(validateTemplateSchema(withSlots({ ...SLOT, showEmpty: false, fillCounter: false })), []);
});

test('a field a slot does not have is refused by name, so a typo does not pass for a setting', () => {
    assert.match(problems({ ...SLOT, maxx: 3 }), /slot "content" has no field "maxx"/);
    assert.match(problems({ ...SLOT, onlyPreferred: true }), /slot "content" has no field "onlyPreferred"/);
    assert.match(problems({ ...SLOT, preferred: ['x'] }), /slot "content" has no field "preferred"/);
});

test('every problem of a slot is reported, so a pasted schema is fixed in one go', () => {
    const all = problems({ id: 'Bad Id', min: -1, max: 0, layout: 'grid', showEmpty: 'x' });
    for (const part of [/must be a lower camel case identifier/, /has no name/, /min must be/, /max must be/, /layout must be/, /showEmpty must be a boolean/]) assert.match(all, part);
});
