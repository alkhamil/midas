// Search Field: the Input family with the suffix on as a magnifier icon. It is built from the Input's schema, so the Variant, Status, Size, states and clear icon are
// Input's own; the enter button and onSearch are not part of it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { ICON_SET } from '../src/behavior-engine/icon-set.js';
import { INPUT_BASE } from '../src/templates/input-base.js';

const search = TEMPLATES.get('antd-search');

test('Search Field is registered, valid, and is Input with the suffix on as the search icon', () => {
    assert.ok(search, 'Search Field is in the registry');
    assert.equal(search.name, 'Search Field');
    assert.deepEqual(validateTemplateSchema(search, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(search.props.hasSuffix.default, true);
    assert.equal(search.props.suffixKind.default, 'icon');
    assert.deepEqual(search.props.variant, INPUT_BASE.props.variant, 'Variant is Input\'s own');
    const suffix = search.icons.find(d => d.slot === 'suffixIcon');
    assert.equal(suffix.role, 'search');
    assert.ok(ICON_SET.some(icon => icon.role === 'search'), 'the search glyph is in the built-in set');
});

test('Search Field keeps the Input\'s clear icon and has no enter button or search prop', () => {
    assert.ok(search.anatomy.some(s => s.id === 'clear'));
    assert.ok(!('enterButton' in search.props) && !('onSearch' in search.props));
});
