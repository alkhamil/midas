// The Design System bundle's planning: which templates it builds, in what order (a template whose slots accept another comes after it), which already have a
// master on the page, the section each gets, and the toast. Pure: the studio applies it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { WAVE_SPREAD } from '../src/behavior-engine/codegen.js';
import { DESIGN_SYSTEM_PAGE, ICONS_SECTION, designSystemSummary, mastersByTemplate, orderTemplates, planDesignSystem, sectionSpecs, templateDependencies } from '../src/behavior-engine/design-system.js';

const t = (id, accepts = []) => ({ id, name: id.toUpperCase(), slots: accepts.length ? [{ id: 'content', accepts }] : undefined });

test('the page is named Design System', () => {
    assert.equal(DESIGN_SYSTEM_PAGE, 'Design System');
});

test('a template depends on the registered templates its slots accept, never on itself or on an id the registry does not hold', () => {
    const all = [t('a'), t('b', ['a', 'b', 'ghost'])];
    assert.deepEqual(templateDependencies(all[1], all), ['a']);
    assert.deepEqual(templateDependencies(all[0], all), []);
    assert.deepEqual(templateDependencies({ id: 'x' }, all), [], 'a template with no slots');
});

test('a template comes after the templates its slots accept; the rest keep the registry order', () => {
    const { order, cycles } = orderTemplates([t('form', ['input']), t('button'), t('input'), t('list')]);
    assert.deepEqual(order.map(x => x.id), ['button', 'input', 'form', 'list']);
    assert.deepEqual(cycles, []);
});

test('a chain is ordered end to end, whatever the input order', () => {
    const { order } = orderTemplates([t('c', ['b']), t('b', ['a']), t('a')]);
    assert.deepEqual(order.map(x => x.id), ['a', 'b', 'c']);
});

test('a cycle is reported once, and every template is still in the order (nothing loops, nothing is dropped)', () => {
    const { order, cycles } = orderTemplates([t('a', ['b']), t('b', ['a']), t('c', ['a']), t('d')]);
    assert.deepEqual(order.map(x => x.id), ['d', 'a', 'b', 'c']);
    assert.deepEqual(cycles, [['a', 'b']]);
});

test('the built-in registry is ordered with Input before FormItem, and every template is in it', () => {
    const { order, cycles } = orderTemplates([...BUILT_IN_TEMPLATES.values()]);
    assert.deepEqual(order.map(x => x.id), ['button', 'input', 'formitem', 'list', 'icon-button', 'checkbox', 'switch', 'radio', 'inputnumber', 'antd-badge', 'antd-tag', 'antd-divider', 'antd-avatar', 'antd-text', 'antd-title', 'antd-paragraph', 'antd-link']);
    assert.ok(order.findIndex(x => x.id === 'input') < order.findIndex(x => x.id === 'formitem'));
    assert.deepEqual(cycles, []);
});

test('the masters on the page are its components bound to a template, one per template (the first in document order)', () => {
    const nodes = [
        { id: 'f', type: 'frame', name: 'Design System' },
        { id: 'm1', component: true, behavior: { version: 2, templateId: 'button', variables: {} } },
        { id: 'm2', component: true, behavior: { version: 2, templateId: 'button', variables: {} } },
        { id: 'i1', isInstance: true, behavior: { version: 2, props: {} } },
        { id: 'plain', component: true },
        { id: 'm3', component: true, behavior: { version: 2, templateId: 'input', variables: {} } },
    ];
    const found = mastersByTemplate(nodes);
    assert.deepEqual([...found].map(([id, n]) => [id, n.id]), [['button', 'm1'], ['input', 'm3']]);
});

test('the plan creates a master for each template that has none and completes the ones that have one', () => {
    const templates = [t('form', ['input']), t('button'), t('input')];
    const nodes = [{ id: 'm', component: true, behavior: { version: 2, templateId: 'button', variables: {} } }];
    const plan = planDesignSystem({ templates, nodes });
    assert.deepEqual(plan.order.map(x => x.id), ['button', 'input', 'form']);
    assert.deepEqual(plan.create.map(x => x.id), ['input', 'form']);
    assert.deepEqual(plan.present.map(x => x.id), ['button']);
    assert.equal(plan.masters.get('button').id, 'm');
    const again = planDesignSystem({ templates, nodes: [...nodes, { id: 'm2', component: true, behavior: { version: 2, templateId: 'input', variables: {} } }, { id: 'm3', component: true, behavior: { version: 2, templateId: 'form', variables: {} } }] });
    assert.deepEqual(again.create, [], 'a second run builds nothing new');
    assert.deepEqual(again.present.map(x => x.id), ['button', 'input', 'form']);
});

test('adding a template to the registry adds it to the plan with no other change', () => {
    const before = planDesignSystem({ templates: [t('a')], nodes: [] });
    const after = planDesignSystem({ templates: [t('a'), t('new-one')], nodes: [] });
    assert.deepEqual(before.create.map(x => x.id), ['a']);
    assert.deepEqual(after.create.map(x => x.id), ['a', 'new-one']);
});

test('a section is a vertical frame titled with the template name, holding a row of masters with a consistent gap', () => {
    const spec = sectionSpecs({ id: 'icon-button', name: 'Icon Button' });
    assert.equal(spec.section.props.name, 'Icon Button');
    assert.equal(spec.section.props.layout, 'vertical');
    assert.equal(spec.title.type, 'text');
    assert.equal(spec.title.props.text, 'Icon Button');
    assert.equal(spec.row.props.layout, 'horizontal');
    assert.equal(spec.row.props.gap, sectionSpecs({ id: 'x', name: 'X' }).row.props.gap, 'the same gap in every section');
    for (const node of [spec.section, spec.row]) assert.deepEqual([node.props.layoutSizingH, node.props.layoutSizingV], ['hug', 'hug']);
    assert.equal(sectionSpecs({ id: 'a', name: 'A' }).root, undefined);
});

test('the toast counts the variables added, the icons and masters created (with those already present), and the problems', () => {
    assert.equal(designSystemSummary({ variables: 342, icons: 1, iconsPresent: 0, created: 5, present: 0, problems: 0 }), 'Design System: 342 variables added, 1 icon created (0 already present), 5 masters created (0 already present), 0 problems.');
    assert.equal(designSystemSummary({ variables: 0, icons: 0, iconsPresent: 1, created: 0, present: 5, problems: 1 }), 'Design System: 0 variables added, 0 icons created (1 already present), 0 masters created (5 already present), 1 problem.');
    assert.equal(designSystemSummary({ variables: 1, icons: 2, iconsPresent: 1, created: 1, present: 1, problems: 2 }), 'Design System: 1 variable added, 2 icons created (1 already present), 1 master created (1 already present), 2 problems.');
});

test('the Icons section is a section like the others: a titled vertical frame with its row of components', () => {
    const spec = sectionSpecs(ICONS_SECTION);
    assert.deepEqual([spec.section.props.name, spec.title.props.text, spec.row.props.name], ['Icons', 'Icons', 'Components']);
    assert.equal(spec.row.props.gap, sectionSpecs({ id: 'x', name: 'X' }).row.props.gap);
});

test('a row leaves room for what a component draws outside its box: Play clips every frame, so the click wave (6px) and the focus ring (1px outside the border) must fit inside the row', () => {
    const { row, section } = sectionSpecs({ id: 'a', name: 'A' });
    assert.ok(row.props.padding >= parseFloat(WAVE_SPREAD), `the row padding ${row.props.padding} holds the ${WAVE_SPREAD} wave`);
    assert.ok(row.props.padding >= 1, 'and the ring');
    assert.equal(section.props.padding, 0, 'the section adds none: the row is its edge');
});

test('the room is the same in the Icons section and every template section', () => {
    const pads = ['a', 'b', 'icons'].map(id => sectionSpecs({ id, name: id }).row.props.padding);
    assert.deepEqual([...new Set(pads)].length, 1);
});
