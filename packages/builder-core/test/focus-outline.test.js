import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

const button = TEMPLATES.get('button');
const model = buttonModel({ colors: ['primary', 'danger'], variantModes: ['solid'], sizeModes: [{ id: 'sm', name: 'Small' }] });
const css = generateComponent(button, model.binding, { collections: model.collections, items: model.items }, 'Button').files['Button.css'];

test('the root draws the outline at its static width and offset, in the outline-color variable', () => {
    assert.match(css, /\.button \{\n(?:.*\n)*?\s*outline: 2px solid var\(--button-outline-color\);\n\s*outline-offset: 1px;/);
});

test('focus sets the outline colour, and only while the Button is not disabled', () => {
    assert.match(css, /\.button\[data-variant="solid"\]\[data-color="primary"\]\[data-size="sm"\]:focus:not\(:disabled\) \{\n\s*--button-outline-color: #4338ca33;\n\}/);
    assert.doesNotMatch(css, /:focus \{/);
});

test('a disabled Button never shows the outline: its disabled block holds no outline colour', () => {
    const disabled = css.match(/\[data-size="sm"\]:disabled \{\n([^}]*)\}/);
    assert.ok(disabled, 'expected a disabled block');
    assert.doesNotMatch(disabled[1], /outline/);
});

test('the outline is a width and an offset, in px: a schema without them is refused', () => {
    const bad = structuredClone(BUTTON);
    bad.outline = { width: '2', offset: 1 };
    assert.match(validateTemplateSchema(bad).join('\n'), /outline width must be a number of px, 0 or more/);
    const missing = structuredClone(BUTTON);
    delete missing.outline;
    assert.match(validateTemplateSchema(missing).join('\n'), /schema has no outline/);
});
