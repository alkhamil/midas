// An icon slot that is on from the start takes the library's default icon when its instance is created, not on the first edit: createdIconDefaults is the
// creation-time use of the rule newlyShownIconDefaults applies to edits (the same code, with nothing shown before). An instance of Button or Input starts with
// no icon switch on, so it gets no write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_TEMPLATES } from '../src/behavior-engine/registry.js';
import { createdIconDefaults, newlyShownIconDefaults, planInstanceAnatomy } from '../src/behavior-engine/anatomy.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { iconButtonModel } from '../../../scripts/icon-button-model.mjs';

const DEFAULT = 'icon-default';
const iconButton = BUILT_IN_TEMPLATES.get('icon-button');
const button = BUILT_IN_TEMPLATES.get('button');
const input = BUILT_IN_TEMPLATES.get('input');

test('an always visible slot takes the default icon at creation, and keeps one the props already hold', () => {
    assert.deepEqual(createdIconDefaults(iconButton, {}, DEFAULT), { icon: DEFAULT });
    assert.deepEqual(createdIconDefaults(iconButton, { icon: 'mine' }, DEFAULT), {});
    assert.deepEqual(createdIconDefaults(iconButton, {}, null), {}, 'no icon in the document, no write');
});

test('Button and Input start with no icon on, so creation writes nothing to them', () => {
    for (const template of [button, input]) {
        assert.deepEqual(createdIconDefaults(template, {}, DEFAULT), {}, template.id);
        assert.deepEqual(createdIconDefaults(template, {}, null), {}, template.id);
    }
});

test('a slot whose switch is on from the start takes the default icon too, in the slot the placement picks', () => {
    assert.deepEqual(createdIconDefaults(button, { hasIcon: true }, DEFAULT), { icon: DEFAULT });
    assert.deepEqual(createdIconDefaults(button, { hasIcon: true, iconPlacement: 'end' }, DEFAULT), { iconEnd: DEFAULT });
    assert.deepEqual(createdIconDefaults(button, { hasIcon: true, icon: 'mine' }, DEFAULT), {});
});

test('creation is the edit rule with nothing shown before: the edit results do not change', () => {
    assert.deepEqual(newlyShownIconDefaults(button, {}, { hasIcon: true }, DEFAULT), { icon: DEFAULT });
    assert.deepEqual(newlyShownIconDefaults(button, { hasIcon: true }, { hasIcon: true }, DEFAULT), {});
    assert.deepEqual(newlyShownIconDefaults(iconButton, {}, {}, DEFAULT), { icon: DEFAULT }, 'an always visible slot with no icon ever chosen still takes it on an edit');
});

/** The document of one Icon Button master and one instance made with `props`, the icon slot filled the way the anatomy plan fills it (a nested instance of the icon component). */
function documentWith(props) {
    const model = iconButtonModel();
    const variables = { collections: model.collections, items: model.items };
    const frame = { id: 'm', name: 'IconButton', type: 'frame', parentId: null, component: true, fills: [], x: 400, y: 0 };
    const { created } = applyTemplateToFrame(iconButton, { frame, children: [], binding: { variables: model.binding.variables }, variables, idOf: key => `m-${key}` });
    const nodes = instanceOf(iconButton, frame, created, props, { id: src => `i-${src}`, varModes: { [model.ids.variant]: 'default', [model.ids.shape]: 'square', [model.ids.size]: 'md' } });
    nodes[0].parentId = 'stage';
    const slot = nodes.find(n => n.behavior?.slot === 'icon');
    const plan = planInstanceAnatomy({ binding: { templateId: 'icon-button' }, masterRoot: { isAutoLayout: true }, masterTree: [{ id: 'm', type: 'frame' }], stored: props, children: [{ id: slot.id, slot: 'icon', name: 'icon', component: null }] });
    const swap = plan.ops.find(op => op.op === 'swap');
    const filled = swap ? [{ id: 'icon-inst', name: 'Icon / Star', type: 'frame', parentId: slot.id, isInstance: true, sourceId: swap.component, overrides: {} }] : [];
    const stage = { id: 'stage', name: 'Stage', type: 'frame', parentId: null, x: 0, y: 0, w: 300, h: 200, fills: [] };
    return { variables, pages: [{ name: 'p', nodes: [stage, frame, ...created, ...nodes, ...filled] }] };
}
const emptySlots = doc => diagnoseDocument(doc).filter(f => f.code === 'icon-slot-empty');

test('an Icon Button created with the creation writes holds the default icon and Diagnostics reports no empty slot', () => {
    const props = { ...createdIconDefaults(iconButton, {}, DEFAULT) };
    assert.deepEqual(emptySlots(documentWith(props)), []);
});

test('the same instance made without them keeps an empty slot, which Diagnostics reports (the case this fixes)', () => {
    assert.equal(emptySlots(documentWith({})).length, 1);
});
