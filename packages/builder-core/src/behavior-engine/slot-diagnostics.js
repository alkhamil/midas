// Diagnostics of content slots (pure): a slot that holds fewer layers than its minimum, more than its maximum, or a layer it does not take.
// Warnings, not errors: the designer can still do it, and the file says so. One scan of the document, so every way content enters a slot (the
// picker, a paste, a drag, a duplicate, an import, a delete) ends in the same report. Content slots only: the icon slots of a template have
// their own checks (document-check.js).
import { isContentSlot } from './content-slots.js';
import { slotAccepts, slotCounts, slotRefusal, slotRestricts } from './slot-rules.js';
import { templateIdsOf } from './component-templates.js';

/** @param {number} n */
const layers = n => `${n} layer${n === 1 ? '' : 's'}`;

/**
 * The slot findings of a document: for each content slot of an instance, below minimum, above maximum, and each layer that is not one of the
 * preferred instances or accepted templates of a slot that only allows those. A finding names the instance that owns the slot (the nearest instance above the slot
 * layer), the slot layer, and for a layer that is not taken, that layer. Same shape as the other findings (see diagnostics.js).
 * @param {any[]} nodes every node of the document, in document order
 * @returns {{ severity: 'warning', code: string, node: string, nodeId: string, slot: string, layer?: string, message: string }[]}
 */
export function diagnoseSlots(nodes) {
    /** @type {Map<string, any>} */
    const byId = new Map(nodes.map(n => [n.id, n]));
    /** @type {Map<string, any>} */
    const props = new Map();
    /** @type {Map<string, any[]>} */
    const children = new Map();
    for (const n of nodes) {
        for (const p of n.cprops ?? []) if (p.type === 'slot') props.set(p.id, p);
        if (n.parentId) (children.get(n.parentId) ?? children.set(n.parentId, []).get(n.parentId)).push(n);
    }
    // A component, its set and its sibling variants are one preferred instance: the picker stores a set's default variant.
    const family = (/** @type {string} */ id) => {
        const set = byId.get(byId.get(id)?.parentId);
        return set?.componentSet ? [id, set.id, ...(children.get(set.id) ?? []).map(v => v.id)] : [id];
    };
    /** @type {any[]} */
    const out = [];
    for (const slot of nodes) {
        if (!isContentSlot(slot)) continue;
        const prop = props.get(slot.propBind.slot);
        if (!prop) continue;
        let owner = byId.get(slot.parentId);
        while (owner && !owner.isInstance) owner = byId.get(owner.parentId);
        if (!owner) continue;
        const held = children.get(slot.id) ?? [];
        const where = { node: owner.name, nodeId: owner.id, slot: slot.id };
        const { belowMin, aboveMax } = slotCounts(prop, held.length);
        if (belowMin) out.push({ severity: 'warning', code: 'slot-below-min', ...where, message: `${owner.name}: slot "${prop.name}" holds ${layers(held.length)}, at least ${prop.min} needed.` });
        if (aboveMax) out.push({ severity: 'warning', code: 'slot-above-max', ...where, message: `${owner.name}: slot "${prop.name}" holds ${layers(held.length)}, at most ${prop.max} allowed.` });
        if (!slotRestricts(prop)) continue;
        for (const layer of held) {
            const taken = layer.isInstance && layer.sourceId && slotAccepts(prop, { ids: family(layer.sourceId), templates: templateIdsOf(nodes, layer.sourceId) });
            if (!taken) out.push({ severity: 'warning', code: 'slot-not-accepted', ...where, layer: layer.id, message: `${owner.name}: "${layer.name}" is not ${slotRefusal(prop)}.` });
        }
    }
    return out;
}

/**
 * The slot findings an edit introduced: those after it that were not there before. A finding is the same one while its numbers change (the
 * key is the kind, the instance, the slot and the layer, not the message), so an edit that improves a slot that was already over its maximum
 * says nothing.
 * @param {{ code: string, nodeId: string, slot: string, layer?: string }[]} before the findings before the edit
 * @param {{ code: string, nodeId: string, slot: string, layer?: string }[]} after the findings after it
 * @returns {any[]}
 */
export function introducedSlotProblems(before, after) {
    const key = (/** @type {any} */ p) => [p.code, p.nodeId, p.slot, p.layer].join('\u0000');
    const known = new Set(before.map(key));
    return after.filter(p => !known.has(key(p)));
}

/**
 * What the studio says about the findings an edit introduced: the first one, and how many more there are. Null when there are none.
 * @param {{ message: string }[]} problems
 * @returns {string | null}
 */
export function slotNotice(problems) {
    if (!problems.length) return null;
    return problems.length === 1 ? problems[0].message : `${problems[0].message} (${problems.length - 1} more)`;
}

/**
 * The findings without the minimums of instances just created: a freshly created instance has not been filled yet, so it is always below its
 * minimum and that is not news. Only the notice leaves it out; the Diagnostics still report it. Any other finding of a new instance stays.
 * @param {{ code: string, nodeId: string }[]} problems
 * @param {Set<string>} freshIds the ids of the instances (and the layers inside them) the edit created from a component
 * @returns {any[]}
 */
export function withoutFreshMinimums(problems, freshIds) {
    return problems.filter(p => !(p.code === 'slot-below-min' && freshIds.has(p.nodeId)));
}
