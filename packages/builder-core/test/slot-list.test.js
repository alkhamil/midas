// One slot list per template: the Behavior panel's Slots block and the component's slot properties are both derived from `slotListOf`, so they cannot differ. For every
// template, in several prop states: the panel's slots are the list; the main component's slot properties hold every slot of the list (same id, name, kind); a toggle is a
// Prop and never an entry; an entry exists exactly while its layer does (no hidden layers); a free-content slot's content is not in the Behavior tab; and an instance holder
// takes instances only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { resolveProps } from '../src/behavior-engine/instance-props.js';
import { instancePanel } from '../src/behavior-engine/panel.js';
import { slotHolds, slotListOf } from '../src/behavior-engine/slot-list.js';
import { diagnoseSlots } from '../src/behavior-engine/slot-diagnostics.js';
import { modelFor, instanceFor } from './helpers/box-template.js';

/** The prop states of a template: the defaults, each boolean toggle on alone, and every toggle on. */
function statesOf(template) {
    const toggles = Object.entries(template.props).filter(([, def]) => def.source === 'literal' && def.type === 'boolean' && def.derived === undefined).map(([name]) => name);
    return [{}, ...toggles.map(name => ({ [name]: true })), Object.fromEntries(toggles.map(name => [name, true]))];
}

for (const template of TEMPLATES.values()) {
    test(`${template.id}: the panel's slots, the component's slot properties and the layers are one list`, () => {
        const model = modelFor(template);
        const master = model.frame;
        const cprops = (master.cprops ?? []).filter(p => p.type === 'slot');
        for (const state of statesOf(template)) {
            const values = resolveProps(template, state);
            const entries = slotListOf(template, values);
            const nodes = instanceFor(model, state);
            const panel = instancePanel(nodes[0], master, model.variables.collections, {});
            assert.deepEqual(panel.slots, entries, `the Behavior Slots are the list with ${JSON.stringify(state)}`);

            // The component's slot properties: every instance or content slot of the list is one, with its name and kind.
            for (const e of entries.filter(e => e.kind === 'instance' || e.kind === 'content' || e.kind === 'image')) {
                const p = cprops.find(c => c.id === e.id);
                assert.ok(p, `${e.name} is a slot property of the component`);
                assert.equal(p.name, e.name, `${e.id}: same name`);
                assert.equal(slotHolds(p), e.kind, `${e.id}: same kind`);
            }
            // A slot property that is no slot of the template is a stray.
            for (const p of cprops) assert.ok((template.slots ?? []).some(s => s.id === p.id), `${p.id} is declared by the template`);

            // A toggle is a Prop: no entry is backed by a boolean prop, and none is named like one.
            for (const e of entries) {
                if (e.prop !== undefined) assert.notEqual(template.props[e.prop].type, 'boolean', `${e.id} is not a toggle`);
            }

            // No hidden layers: a content or instance slot is in the layer tree exactly while it is in the list.
            const bound = new Set(nodes.map(n => n.propBind?.slot).filter(Boolean));
            const listed = new Set(entries.filter(e => e.kind === 'instance' || e.kind === 'content' || e.kind === 'image').map(e => e.id));
            assert.deepEqual([...bound].sort(), [...listed].sort(), `the slot layers are the listed slots with ${JSON.stringify(state)}`);

            // An image slot is edited by one control in both tabs: its entry names the image prop, whose Behavior row is the slot's row.
            for (const e of entries.filter(e => e.kind === 'image')) {
                assert.ok(panel.rows.some(r => r.prop === e.prop && r.kind === 'image' && r.slot), `${e.id}: the picture row is the slot's row`);
                assert.ok(!entries.some(o => o.kind === 'content' && o.id === e.id), `${e.id} is not listed as content`);
            }
            // A free-content slot's content is not in the Behavior tab: no row, no prop, only the entry.
            for (const e of entries.filter(e => e.kind === 'content')) {
                assert.equal(e.prop, undefined, `${e.id} has no prop`);
                assert.ok(!panel.rows.some(r => r.prop === e.id), `${e.id} has no Behavior row`);
            }
        }
    });

    test(`${template.id}: an instance holder takes instances only, a free-content slot takes anything`, () => {
        for (const slot of template.slots ?? []) {
            const prop = { id: 'p1', name: slot.name, type: 'slot', def: null, holds: slotHolds(slot), ...(slot.accepts ? { accepts: slot.accepts } : {}) };
            const doc = held => [
                { id: 'card', name: 'Card', type: 'frame', component: true, parentId: null, cprops: [prop] },
                { id: 'frame', name: slot.name, type: 'frame', parentId: 'card', propBind: { slot: 'p1' } },
                { id: 'inst', name: 'Instance', type: 'frame', parentId: null, isInstance: true, sourceId: 'card' },
                { id: 'slot', name: slot.name, type: 'frame', parentId: 'inst', sourceId: 'frame', propBind: { slot: 'p1' } },
                ...held.map((n, i) => ({ id: `c${i}`, parentId: 'slot', ...n })),
            ];
            const kinds = [['text', { name: 'Text', type: 'text' }], ['frame', { name: 'Frame', type: 'frame' }], ['vector', { name: 'Vector', type: 'path' }]];
            for (const [label, node] of kinds) {
                const refused = diagnoseSlots(doc([node])).some(f => f.code === 'slot-not-instance');
                assert.equal(refused, slotHolds(slot) === 'instance', `${slot.id}: a ${label} is ${slotHolds(slot) === 'instance' ? 'refused' : 'taken'}`);
            }
        }
    });
}

import { planAnatomy } from '../src/behavior-engine/anatomy.js';
import { slotAccepts } from '../src/behavior-engine/slot-rules.js';
import { templateDependencies } from '../src/behavior-engine/design-system.js';

for (const template of TEMPLATES.values()) {
    test(`${template.id}: a toggle that turns a slot on makes the sync insert its layer, so the picker has a slot to fill`, () => {
        const toggles = Object.entries(template.props).filter(([, def]) => def.source === 'literal' && def.type === 'boolean' && def.derived === undefined).map(([name]) => name);
        const all = resolveProps(template, Object.fromEntries(toggles.map(name => [name, true])));
        const listed = slotListOf(template, all).filter(e => e.kind === 'instance' || e.kind === 'content').map(e => e.id);
        const inserted = planAnatomy(template, all, []).filter(op => op.op === 'insert').map(op => op.slot);
        for (const slot of (template.slots ?? []).filter(s => listed.includes(s.id) && s.box === undefined)) {
            // A slot the instance makes (its own condition, or its managed container) is inserted; any other is the main component's own layer.
            const own = slot.shownWhen !== undefined || (slot.parent !== undefined && template.anatomy.some(a => a.id === slot.parent && a.managed));
            assert.equal(inserted.includes(slot.id), own, `${slot.id}: inserted by the sync exactly when the instance makes it`);
        }
    });

    test(`${template.id}: a restricted instance slot lists only its templates, and its templates are in the dependency order`, () => {
        for (const slot of (template.slots ?? []).filter(s => slotHolds(s) === 'instance' && s.accepts?.length)) {
            const prop = { id: slot.id, name: slot.name, type: 'slot', holds: 'instance', accepts: slot.accepts, onlyAccepts: slot.onlyAccepts === true };
            assert.equal(slot.onlyAccepts, true, `${slot.id} enforces its templates`);
            for (const id of slot.accepts) assert.equal(slotAccepts(prop, { ids: ['c'], templates: [id] }), true, `${slot.id} takes ${id}`);
            assert.equal(slotAccepts(prop, { ids: ['c'], templates: ['some-other'] }), false, `${slot.id} refuses another template`);
            assert.equal(slotAccepts(prop, { ids: ['c'], templates: [] }), false, `${slot.id} refuses a component with no template`);
            const known = new Set([...TEMPLATES.keys()]);
            const needed = templateDependencies(template, [...TEMPLATES.values()]);
            for (const id of slot.accepts.filter(a => known.has(a))) assert.ok(needed.includes(id) || id === template.id, `${id} is built before ${template.id}`);
        }
    });
}
