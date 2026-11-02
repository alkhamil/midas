import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { SIZE_MODES } from '../src/templates/size-modes.js';
import { BUTTON } from '../src/templates/button.js';
import { INPUT } from '../src/templates/input.js';

const testing = () => JSON.parse(readFileSync(new URL('../../../testing.midas', import.meta.url), 'utf8'));

/** The collection a template's Size prop binds to in a document. */
const sizeCollectionOf = (doc, template) => {
    const master = doc.pages.flatMap(p => p.nodes).find(n => n.component && n.behavior?.templateId === template.id);
    return doc.variables.collections.find(c => c.id === master.behavior.variables.size);
};

test('every template takes the shared Size scale: xs, sm, md, lg, xl, and md is the default', () => {
    for (const template of [BUTTON, INPUT]) {
        assert.deepEqual(template.props.size.modes, SIZE_MODES, `${template.id} lists the shared modes`);
        assert.equal(template.props.size.standard, true, `${template.id} marks the Size scale as standard`);
        assert.equal(template.props.size.defaultMode, 'md', `${template.id} starts a new instance at md`);
    }
    assert.deepEqual(SIZE_MODES, ['xs', 'sm', 'md', 'lg', 'xl']);
});

test('a Size collection that lacks a standard mode is a mode-missing error, and a renamed mode counts as missing', () => {
    const doc = testing();
    sizeCollectionOf(doc, BUTTON).modes = sizeCollectionOf(doc, BUTTON).modes.filter(m => m.name !== 'md');
    const size = sizeCollectionOf(doc, INPUT);
    size.modes = size.modes.map(m => (m.name === 'lg' ? { ...m, name: 'Large' } : m));
    const found = diagnoseDocument(doc).filter(f => f.code === 'mode-missing');
    assert.ok(found.some(f => f.collection === 'Button Size' && f.modes.join() === 'md'), 'Button Size lacks md');
    assert.ok(found.some(f => f.collection === 'Input Size' && f.modes.join() === 'lg'), 'a renamed Input Size mode is reported as lg missing');
});

test('a non-standard collection missing a mode is not a mode-missing diagnostic (the template defines its own modes)', () => {
    const doc = testing();
    const variant = doc.variables.collections.find(c => c.name === 'Button Variant');
    variant.modes = variant.modes.filter(m => m.name !== 'Text');
    assert.equal(diagnoseDocument(doc).filter(f => f.code === 'mode-missing' && f.collection === 'Button Variant').length, 0);
});
