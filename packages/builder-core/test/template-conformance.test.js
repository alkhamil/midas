// Conformance over every registered template: the generator gives each contract part a layer, every binding resolves, the result has
// no diagnostics errors, a second run changes nothing, and a layer the user adds survives. A template with no model below fails:
// every template must be covered here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame, instanceOf } from '../src/behavior-engine/template-master.js';
import { canvasPartsOf } from '../src/behavior-engine/display.js';
import { diagnoseDocument } from '../src/behavior-engine/diagnostics.js';
import { buttonModel } from '../../../scripts/button-model.mjs';
import { inputModel } from '../../../scripts/input-model.mjs';
import { formItemModel } from '../../../scripts/form-item-model.mjs';

/** The variable model and binding each registered template is checked with. */
const MODELS = {
    button: () => {
        const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
        return { variables: { collections: model.collections, items: model.items }, binding: { variables: { variant: model.ids.variant, color: model.ids.color, size: model.ids.size } } };
    },
    list: () => ({ variables: { collections: [], items: [] }, binding: { variables: {} } }),
    formitem: () => {
        const model = formItemModel({ ids: { size: 'c-formitem-size', semantic: 'c-formitem-semantic' }, prefix: 'fi-' });
        return { variables: { collections: model.collections, items: model.items }, binding: { variables: { size: model.ids.size } } };
    },
    input: () => {
        const model = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size', semantic: 'c-input-semantic' }, prefix: 'in-' });
        return { variables: { collections: model.collections, items: model.items }, binding: { variables: { variant: model.ids.variant, status: model.ids.status, size: model.ids.size } } };
    },
};

let seq = 0;
const idOf = key => `c-${key}-${++seq}`;

/** The layers a master must have: every anatomy slot that is not a managed icon slot (an affix text included), and every canvas part. Managed icon slots are instance layers. */
const requiredKeys = template => [
    ...template.anatomy.filter(slot => !slot.managed && slot.kind !== 'icon').map(slot => slot.id),
    ...canvasPartsOf(template).map(part => part.id),
    ...(template.slots ?? []).map(slot => slot.id),
];
/** Whether a layer is the one a key stands for: by name, as a canvas part, or as the content slot the key names. */
const isLayerOf = (n, key) => n.name === key || n.behavior?.part === key || n.propBind?.slot === key;

for (const template of TEMPLATES.values()) {
    test(`${template.id}: the generator gives every contract part a layer`, () => {
        assert.ok(MODELS[template.id], `${template.id} has no conformance model: add one above`);
        const { variables, binding } = MODELS[template.id]();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        const out = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
        const keys = new Set(out.created.flatMap(n => [n.name, n.propBind?.slot]));
        for (const key of requiredKeys(template)) assert.ok(keys.has(key) || out.matched.some(m => m.key === key), `${template.id} has a layer for ${key}`);
        assert.deepEqual(out.problems, [], `${template.id} bindings resolve`);
    });

    test(`${template.id}: an instance with its managed slots shown has a layer for each`, () => {
        const { variables, binding } = MODELS[template.id]();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        const out = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
        // Every managed slot shown: each icon def's switch on, once with each option of each placement prop (a start and an end slot; a
        // Text and an Icon side), so every slot a placement can pick is drawn in one of the instances.
        const switches = Object.fromEntries(template.icons.map(def => [def.show, true]));
        const placements = [...new Set(template.icons.filter(def => def.placement).map(def => def.placement))];
        const cases = placements.length ? placements.flatMap(prop => template.props[prop].options.map(option => ({ [prop]: option }))) : [{}];
        const copies = cases.flatMap(chosen => instanceOf(template, frame, out.created, { ...switches, ...chosen, ...(template.control ? { [template.control.value]: 'x' } : {}) }, { id: idOf }));
        for (const slot of template.anatomy.filter(s => s.managed || s.kind === 'icon')) assert.ok(copies.some(n => n.behavior?.slot === slot.id), `${template.id} instance has ${slot.id}`);
    });

    test(`${template.id}: the generated master has no diagnostics errors`, () => {
        const { variables, binding } = MODELS[template.id]();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        const out = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
        const doc = { variables, pages: [{ name: 'p', nodes: [frame, ...out.created] }] };
        assert.deepEqual(diagnoseDocument(doc).filter(f => f.severity === 'error'), []);
    });

    test(`${template.id}: a root that binds a height is fixed vertically and carries the Size height variable`, () => {
        if (!('height' in (template.display.root ?? {}))) return;
        const { variables, binding } = MODELS[template.id]();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
        assert.equal(frame.layoutSizingV, 'fixed', 'the box is the Size height, not its content');
        assert.ok(frame.vars?.h, 'the root height is bound to a variable');
    });

    test(`${template.id}: a second run creates nothing and the tree is unchanged; a user layer survives`, () => {
        const { variables, binding } = MODELS[template.id]();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        const first = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
        const user = { id: 'user-layer', name: 'Note', type: 'frame', parentId: 'master', text: 'kept' };
        const children = [...first.created, user];
        const second = applyTemplateToFrame(template, { frame, children, binding, variables, idOf });
        assert.deepEqual(second.created, [], 'nothing is created the second time');
        assert.deepEqual(children.map(n => `${n.name}:${n.type}`), [...first.created, user].map(n => `${n.name}:${n.type}`), 'the tree is unchanged');
        assert.ok(children.includes(user) && user.text === 'kept', 'the user layer survives untouched');
    });

    test(`${template.id}: a generated master has no missing-part warning; a master without a required layer is reported, and the generator adds it`, () => {
        const { variables, binding } = MODELS[template.id]();
        const frame = { id: 'master', name: template.name, type: 'frame', parentId: null, fills: [] };
        const first = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf });
        const doc = nodes => ({ variables, pages: [{ name: 'p', nodes: [frame, ...nodes] }] });
        const missing = (nodes) => diagnoseDocument(doc(nodes)).filter(f => f.code === 'part-missing');
        assert.deepEqual(missing(first.created), [], 'a generated master is complete');
        const user = { id: 'user-layer', name: 'Note', type: 'frame', parentId: 'master', text: 'kept' };
        const required = requiredKeys(template)[requiredKeys(template).length - 1];
        const without = first.created.filter(n => !isLayerOf(n, required));
        assert.ok(without.length < first.created.length, `${template.id} has a layer for ${required} to remove`);
        assert.ok(missing([...without, user]).some(f => f.layer === required), `${required} is reported missing`);
        const children = [...without, user];
        const second = applyTemplateToFrame(template, { frame, children, binding, variables, idOf });
        assert.ok(second.created.some(n => isLayerOf(n, required)), 'the generator adds the missing layer');
        const rest = [...children, ...second.created];
        assert.deepEqual(missing(rest), [], 'no missing-part warning after the generator ran');
        assert.ok(rest.includes(user) && user.text === 'kept', 'the user layer is kept');
        assert.deepEqual(applyTemplateToFrame(template, { frame, children: rest, binding, variables, idOf }).created, [], 'a second run creates nothing');
    });
}
