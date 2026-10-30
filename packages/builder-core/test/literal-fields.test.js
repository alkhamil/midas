import { test } from 'node:test';
import assert from 'node:assert/strict';
import { literalFields, literalFieldNames } from '../src/behavior-engine/display.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';

const button = TEMPLATES.get('button');

test('the label prop writes the label layer\'s text', () => {
    assert.deepEqual(literalFields(button, resolveProps(button, { label: 'Save' })).filter(f => f.field === 'text'), [
        { key: 'label', field: 'text', value: 'Save' },
    ]);
});

test('no literal prop writes a sizing field: node sizing stays on the node', () => {
    const fields = literalFields(button, resolveProps(button, { label: 'Save', loading: true, hasIcon: true, disabled: true }));
    assert.deepEqual(fields.filter(f => f.field === 'layoutSizingH'), []);
});

test('token sources and props with no node field write nothing (loading, hasIcon, disabled)', () => {
    const fields = literalFields(button, resolveProps(button, { loading: true, hasIcon: true, disabled: true }));
    assert.deepEqual(fields.map(f => f.field).sort(), ['text']);
});

test('the fields literal props write are named per layer: the label text only', () => {
    assert.deepEqual(literalFieldNames(button), [{ key: 'label', field: 'text' }]);
});
