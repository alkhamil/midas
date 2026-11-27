// The Tab's ink bar slide: the Tab's toggle names its indicator, and Play writes that class on the root, where the bar is drawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { modelFor, instanceFor } from './helpers/box-template.js';
import { toDomTree } from '../src/prototype/dom-tree.js';

const tab = TEMPLATES.get('antd-tab');

test('Tab is valid with a slide on its indicator', () => {
    assert.deepEqual(validateTemplateSchema(tab, { templateIds: new Set(TEMPLATES.keys()) }), []);
    assert.equal(tab.toggle.slide, 'indicator');
});

test('Play writes the indicator class on a Tab root, and that class is drawn', () => {
    const model = modelFor(tab);
    const nodes = instanceFor(model, { active: true, label: 'Tab 1' });
    const variables = { collections: model.variables.collections, items: model.variables.items };
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'P', nodes: [model.frame, ...nodes] }], variables }, nodes[0].id);
    assert.equal(root.attrs['data-toggle-slide'], 'antd-tab-indicator');
    const classes = [];
    const walk = el => { if (!el) return; if (el.attrs?.class) classes.push(el.attrs.class); (el.children || []).forEach(walk); };
    walk(root);
    assert.ok(classes.includes('antd-tab-indicator'), 'the bar is drawn with that class');
});
