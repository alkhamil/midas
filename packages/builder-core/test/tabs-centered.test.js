// Tabs centred: on, the tabs sit in the middle of the bar; off, they sit at the start (the default). The bar hugs its tabs, and its baseline is a line of
// its own under them, so it never paints over a tab's indicator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { literalFields } from '../src/behavior-engine/display.js';

const tabs = TEMPLATES.get('antd-tabs');

/** The box's field values a set of props writes. */
const boxFields = props => Object.fromEntries(literalFields(tabs, props).filter(w => w.key === 'itemsBox').map(w => [w.field, w.value]));

test('Tabs is valid with Centred, hugs its tabs, and has a baseline under them', () => {
    assert.deepEqual(validateTemplateSchema(tabs, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(tabs.props.centered.default, false);
    assert.equal(tabs.rootSizingH, undefined);
    const base = tabs.anatomy.find(a => a.id === 'baseline');
    assert.equal(base.fill, true);
    assert.equal(tabs.anatomy.find(a => a.id === 'itemsBox').strokeSides, undefined);
});

test('centred centres the tabs in the box; off puts them at the start', () => {
    assert.equal(boxFields({ centered: true }).primaryAlign, 'center');
    assert.equal(boxFields({ centered: false }).primaryAlign, 'start');
});
