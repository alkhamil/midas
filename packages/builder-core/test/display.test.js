import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';

const withDisplay = display => ({ ...BUTTON, display });

test('the Button schema is valid and maps every node it projects', () => {
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
    assert.ok(TEMPLATES.has('button'));
    assert.deepEqual(Object.keys(BUTTON.display).sort(), ['iconEnd', 'iconStart', 'label', 'root']);
});

test('a schema with no display mapping is refused', () => {
    const { display, ...rest } = BUTTON;
    assert.match(validateTemplateSchema(rest).join('\n'), /display/);
});

test('a mapping to a node that is not in the anatomy is refused', () => {
    const problems = validateTemplateSchema(withDisplay({ ...BUTTON.display, nowhere: { fill: 'bg' } }));
    assert.match(problems.join('\n'), /nowhere/);
});

test('a mapping to a token that does not exist is refused', () => {
    const problems = validateTemplateSchema(withDisplay({ ...BUTTON.display, root: { fill: 'nope' } }));
    assert.match(problems.join('\n'), /"nope"/);
});

test('a property the node kind does not take is refused', () => {
    const problems = validateTemplateSchema(withDisplay({ ...BUTTON.display, iconStart: { fill: 'bg' } }));
    assert.match(problems.join('\n'), /iconStart.*fill/);
});

test('a literal prop cannot be mapped in the display: it writes its node field from its own schema', () => {
    const problems = validateTemplateSchema(withDisplay({ ...BUTTON.display, label: { fill: 'hasIcon' } }));
    assert.match(problems.join('\n'), /"label.fill" to "hasIcon", which is not a token/);
});

test('a prop that writes a node field the node does not take is refused', () => {
    const bad = { ...BUTTON, props: { ...BUTTON.props, label: { ...BUTTON.props.label, node: { key: 'root', field: 'text' } } } };
    assert.match(validateTemplateSchema(bad).join('\n'), /prop "label" writes "text", which a frame does not take/);
});
