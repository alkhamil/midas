import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBinding, autoMatchCollection } from '../src/behavior-engine/binding.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';

const collections = [
    { id: 'c-variant', name: 'Variant', modes: [{ id: 'm1', name: 'primary' }, { id: 'm2', name: 'danger' }] },
    { id: 'c-theme', name: 'Theme', modes: [{ id: 'm3', name: 'Light' }] },
];

test('auto-match finds a collection whose name equals the prop collection, ignoring case', () => {
    assert.equal(autoMatchCollection('variant', collections), 'c-variant');
    assert.equal(autoMatchCollection('VARIANT', collections), 'c-variant');
});

test('auto-match returns null when no collection has that name', () => {
    assert.equal(autoMatchCollection('Size', collections), null);
});

test('a new Button binding matches Variant and leaves Size unbound', () => {
    const binding = createBinding(TEMPLATES.get('button'), collections);
    assert.deepEqual(binding, { version: 1, templateId: 'button', variables: { variant: 'c-variant', size: null } });
});
