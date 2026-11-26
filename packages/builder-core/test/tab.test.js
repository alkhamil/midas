// A Tab (antd-tab) is a selectable item of a Tabs box: its toggle is exclusive and its aria attribute is aria-selected, in Play and in the export.
// The Tabs container selects one of its tabs (the `selected` slot), and the first when none is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { toDomTree } from '../src/prototype/dom-tree.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

const tab = TEMPLATES.get('antd-tab'), tabs = TEMPLATES.get('antd-tabs');

test('a Tab is a selectable item: an exclusive once toggle on its active prop, aria-selected, and role tab', () => {
    assert.deepEqual(tab.toggle, { prop: 'active', once: true, exclusive: true, aria: 'selected' });
    assert.equal(tab.element.attrs.role, 'tab');
    assert.deepEqual(validateTemplateSchema(tab), []);
});

test('the Tabs bar selects one of its tabs, the first when none is, and holds only Tabs', () => {
    const slot = tabs.slots.find(s => s.id === 'items');
    assert.equal(slot.selected, 'active');
    assert.deepEqual(slot.accepts, ['antd-tab']);
    assert.equal(slot.current, undefined, 'the Breadcrumb rule (last item) is not used');
    assert.deepEqual(validateTemplateSchema(tabs), []);
});

test('Play: a selected tab says aria-selected true; its root carries the exclusive toggle', () => {
    const model = modelFor(tab);
    const nodes = instanceFor(model, { active: true });
    const { root } = toDomTree({ pages: [{ id: 'p', name: 'S', nodes: [model.frame, ...model.created, ...nodes] }], variables: model.variables }, nodes[0].id);
    assert.equal(root.attrs['role'], 'tab');
    assert.equal(root.attrs['data-toggle'], 'data-active');
    assert.equal(root.attrs['data-toggle-exclusive'], true);
    assert.equal(root.attrs['aria-selected'], 'true');
    assert.equal(root.attrs['aria-checked'], undefined);
});

test('the export gives a tab aria-selected, from its active prop', () => {
    const model = modelFor(tab);
    const jsx = generateComponent(tab, model.binding, model.variables, tab.name, model.frame, id => model.created.filter(n => n.parentId === id)).files[`${tab.name}.jsx`];
    assert.match(jsx, /aria-selected=\{active \? "true" : "false"\}/);
    assert.doesNotMatch(jsx, /aria-checked/);
});
