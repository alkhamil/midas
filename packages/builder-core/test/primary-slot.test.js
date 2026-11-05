import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { primarySlotOf } from '../src/behavior-engine/anatomy.js';
import { BUTTON } from '../src/templates/button.js';
import { ICON_START } from '../src/templates/icon-slots.js';
import { INPUT } from '../src/templates/input.js';
import { FORM_ITEM } from '../src/templates/form-item.js';
import { ICON_BUTTON } from '../src/templates/icon-button.js';
import { LIST } from '../src/templates/list.js';

const clone = o => structuredClone(o);

test('Button, Input and FormItem declare their primary text part, and it names a text part', () => {
    assert.equal(BUTTON.primarySlot, 'label');
    assert.equal(INPUT.primarySlot, 'value');
    assert.equal(FORM_ITEM.primarySlot, 'label');
    for (const t of [BUTTON, INPUT, FORM_ITEM]) assert.deepEqual(validateTemplateSchema(t), []);
});

test('a template with no text part declares no primary slot and is valid', () => {
    assert.equal(ICON_BUTTON.primarySlot, undefined);
    assert.equal(LIST.primarySlot, undefined);
    assert.deepEqual(validateTemplateSchema(ICON_BUTTON), []);
    assert.deepEqual(validateTemplateSchema(LIST), []);
});

test('primarySlotOf reads the declaration', () => {
    assert.equal(primarySlotOf(BUTTON), 'label');
    assert.equal(primarySlotOf(ICON_BUTTON), null);
});

test('a primary slot that names no anatomy slot is rejected, naming the id', () => {
    const bad = clone(BUTTON);
    bad.primarySlot = 'missing';
    assert.match(validateTemplateSchema(bad).join('\n'), /primarySlot "missing" names no anatomy slot/);
});

test('a primary slot that is not a text part is rejected: an icon or a frame', () => {
    const icon = clone(BUTTON);
    icon.primarySlot = ICON_START.id;
    assert.match(validateTemplateSchema(icon).join('\n'), new RegExp(`primarySlot "${ICON_START.id}" is not a text part`));
    const frame = clone(FORM_ITEM);
    frame.primarySlot = 'labelBox';
    assert.match(validateTemplateSchema(frame).join('\n'), /primarySlot "labelBox" is not a text part/);
});

test('a template with text parts and no primary slot is rejected', () => {
    const bad = clone(BUTTON);
    delete bad.primarySlot;
    assert.match(validateTemplateSchema(bad).join('\n'), /primarySlot is missing/);
});

test('a primary slot declared more than once is rejected', () => {
    const bad = clone(BUTTON);
    bad.primarySlot = ['label', 'label'];
    assert.match(validateTemplateSchema(bad).join('\n'), /primarySlot is declared more than once/);
});
