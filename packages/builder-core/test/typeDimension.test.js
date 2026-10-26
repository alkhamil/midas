// Type dimension: a component has a type only when one of its value groups covers at least two of the four levels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isTypeDimension, showsTypeField, mappingWarns, ignoredTypeNote, hidesTypeRows, expectsType, levelStatus, suggestLevelMap } from '../src/index.js';

test('a group that covers two levels is a type dimension, through synonyms too', () => {
    assert.equal(isTypeDimension(['Info', 'Error']), true);
    assert.equal(isTypeDimension(['Danger', 'Ok', 'Caution', 'Neutral']), true);
    assert.equal(isTypeDimension(['Primary', 'Danger']), false, 'one level is not a type');
});

test('a size, tone or state group that matches no level, or only one, is not a type', () => {
    assert.equal(isTypeDimension(['Small', 'Medium', 'Large']), false);
    assert.equal(isTypeDimension(['Default', 'Error']), false, 'a single error value next to a default');
    assert.equal(isTypeDimension([]), false);
});

test('expectsType is true for Alert, Message and Notification only', () => {
    assert.deepEqual(['alert', 'message', 'notification'].map(expectsType), [true, true, true]);
    assert.deepEqual(['modal', 'drawer', 'popconfirm'].map(expectsType), [false, false, false]);
});

test('the Type field shows for a typed component, or for a kind that expects a type', () => {
    assert.equal(showsTypeField('modal', false), false);
    assert.equal(showsTypeField('drawer', false), false);
    assert.equal(showsTypeField('popconfirm', false), false);
    assert.equal(showsTypeField('modal', true), true, 'a modal with a danger variant');
    assert.equal(showsTypeField('alert', false), true);
});

test('warnings: Alert, Message and Notification warn on an unresolved level; Modal, Drawer and Popconfirm never do', () => {
    const partial = { success: levelStatus(['Info', 'Warning'], 'success'), error: levelStatus(['Info', 'Warning'], 'error'), warning: levelStatus(['Info', 'Warning'], 'warning'), info: levelStatus(['Info', 'Warning'], 'info') };
    assert.equal(mappingWarns('alert', partial), true);
    assert.equal(mappingWarns('message', partial), true);
    assert.equal(mappingWarns('notification', partial), true);
    assert.equal(mappingWarns('modal', partial), false);
    assert.equal(mappingWarns('drawer', partial), false);
    assert.equal(mappingWarns('popconfirm', partial), false);
});

test('no warning when every level resolves, or when the kind is a typed one with all four mapped', () => {
    const full = suggestLevelMap(['info', 'success', 'warning', 'danger']);
    const levels = Object.fromEntries(['success', 'error', 'warning', 'info'].map(l => [l, levelStatus(['info', 'success', 'warning', 'danger'], l)]));
    assert.equal(Object.keys(full).length, 4);
    assert.equal(mappingWarns('alert', levels), false);
});

test('a feedback component with no type dimension hides its type rows; a typed one and an unknown one keep them', () => {
    assert.equal(hidesTypeRows(isTypeDimension(['Primary', 'Danger'])), true, 'one level is not a type');
    assert.equal(hidesTypeRows(isTypeDimension(['Small', 'Medium', 'Large'])), true, 'a size group is not a type');
    assert.equal(hidesTypeRows(isTypeDimension(['Info', 'Error'])), false, 'a typed component keeps the rows');
    assert.equal(hidesTypeRows(null), false, 'no component set: keep the rows and its note');
});

test('a Type set on a component with no type dimension is reported as ignored, once, without an error', () => {
    assert.equal(ignoredTypeNote('Modal', false, 'error'), 'Modal has no type; the Type setting is ignored');
    assert.equal(ignoredTypeNote('Modal', false, undefined), null, 'nothing set, nothing to say');
    assert.equal(ignoredTypeNote('Modal', true, 'error'), null, 'a typed modal uses it');
});
