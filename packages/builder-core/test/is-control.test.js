// `isControl`: the schema says a template is a form control (a value the user sets), as opposed to a container or a display part. Data only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';

test('isControl must be a boolean when a schema sets it', () => {
    const base = structuredClone(TEMPLATES.get('input'));
    assert.deepEqual(validateTemplateSchema({ ...base, isControl: true }), []);
    assert.deepEqual(validateTemplateSchema({ ...base, isControl: false }), []);
    assert.ok(validateTemplateSchema({ ...base, isControl: 'yes' }).some(p => /isControl/.test(p)));
});
