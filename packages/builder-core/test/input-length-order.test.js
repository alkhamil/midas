// The Behavior panel lists Min Length before Max Length, for every Input kind (text, password, textarea) that has the pair. An order change only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { modelFor } from './helpers/box-template.js';

const input = TEMPLATES.get('input');
const model = modelFor(input);
const rowsOf = props => instancePanel({ behavior: { props } }, model.frame, model.variables.collections, {}).rows.map(r => r.prop);
for (const kind of ['text', 'password', 'textarea']) {
    test(`${kind}: Min Length is listed before Max Length`, () => {
        const props = rowsOf({ kind });
        assert.ok(props.includes('minLength') && props.includes('maxLength'), `${kind} lists both`);
        assert.ok(props.indexOf('minLength') < props.indexOf('maxLength'), `${kind}: ${props.indexOf('minLength')} vs ${props.indexOf('maxLength')}`);
    });
}
