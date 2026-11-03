// Content slots (pure). A content slot is a frame of a main component that instances fill with their own layers: Figma's slot, a component
// property of type `slot` whose frame carries `propBind.slot`. It is not an icon slot (a managed layer of a template, see managed-layers.js
// and anatomy.js): an icon slot belongs to the engine, a content slot to the instance, and neither borrows the other's rules.
// The studio used to decide all of this inline; it calls these, so the rules can be tested and the generator and the export read the same ones.

/** The room an empty content slot that hugs keeps so its "+" can be seen and clicked: width and height, in px. */
const EMPTY_SLOT_FLOOR = { w: 120, h: 56 };

/**
 * Whether a layer holds a slot property: it is the slot's frame in a main component, or the instance's copy of it.
 * @param {{ propBind?: { slot?: string } } | null | undefined} n
 * @returns {boolean}
 */
export function hasSlotProperty(n) {
    return !!n?.propBind?.slot;
}

/**
 * Whether a layer is a content slot of an instance: the copy of a slot frame that an instance fills (it has a source layer). The frame in the
 * main component is not one: nothing is put into it there.
 * @param {{ propBind?: { slot?: string }, sourceId?: string } | null | undefined} n
 * @returns {boolean}
 */
export function isContentSlot(n) {
    return !!(n?.propBind?.slot && n.sourceId);
}

/**
 * The content slot a layer is placed in: the nearest content slot above it, below `rootId` (the instance being read), looking at most `limit`
 * levels up. Null when the layer is not in a slot.
 * @param {{ parentId?: string | null }} node
 * @param {string} rootId
 * @param {(id: string | null | undefined) => any} getNode
 * @param {number} [limit]
 * @returns {any}
 */
export function slotOwnerOf(node, rootId, getNode, limit = 200) {
    for (let p = getNode(node.parentId), i = 0; p && p.id !== rootId && i < limit; p = getNode(p.parentId), i++) {
        if (isContentSlot(p)) return p;
    }
    return null;
}

/**
 * Whether a layer can become a slot: a frame of a main component, so not a component, a component set, an instance or a section, and not
 * inside an instance. `hasHolder` is whether the layer has a main component to hold the property.
 * @param {any} n
 * @param {{ insideInstance: boolean, hasHolder: boolean }} where
 * @returns {boolean}
 */
export function canBeSlot(n, { insideInstance, hasHolder }) {
    return !!n && n.type === 'frame' && !n.component && !n.componentSet && !n.isInstance && !n.isSection && !insideInstance && hasHolder;
}

/**
 * Whether a click on a layer may land on it: it is not inside an instance, or a content slot sits between it and its instance (an instance is
 * closed, only what is in its slots opens). `chain` is the layer then its ancestors, `instanceAt` the index of the first instance in it
 * (-1 for none).
 * @param {{ propBind?: { slot?: string } }[]} chain
 * @param {number} instanceAt
 * @returns {boolean}
 */
export function selectableThroughSlot(chain, instanceAt) {
    return instanceAt < 0 || chain.slice(0, instanceAt).some(hasSlotProperty);
}

/**
 * The least size an empty content slot keeps on one axis, or null when it keeps none: only a slot that hugs and holds nothing, so its "+"
 * placeholder stays big enough to see and click.
 * @param {any} n
 * @param {'w' | 'h'} dim
 * @param {'hug' | 'fill' | 'fixed'} sizing the slot's sizing on that axis
 * @param {number} childCount
 * @returns {number | null}
 */
export function emptySlotFloor(n, dim, sizing, childCount) {
    return isContentSlot(n) && sizing === 'hug' && childCount === 0 ? EMPTY_SLOT_FLOOR[dim] : null;
}

/**
 * Makes the instance the owner of a slot: from now on the slot holds what the instance put there (or left there), and a sync from the main
 * component never copies into it. Changes the slot; says whether it did.
 * @param {{ slotOwned?: boolean }} slot
 * @returns {boolean}
 */
export function claimSlot(slot) {
    if (slot.slotOwned) return false;
    slot.slotOwned = true;
    return true;
}

/**
 * Whether a sync keeps exactly what an instance holds in a slot: the instance owns it.
 * @param {{ slotOwned?: boolean } | null | undefined} slot
 * @returns {boolean}
 */
export function slotKeepsContent(slot) {
    return !!slot?.slotOwned;
}

/**
 * Gives a slot back to the main component: the instance stops owning it, so the next sync copies the main component's content into it again.
 * The inverse of claimSlot. Changes the slot; says whether it did.
 * @param {{ slotOwned?: boolean }} slot
 * @returns {boolean}
 */
export function releaseSlot(slot) {
    if (!slot.slotOwned) return false;
    delete slot.slotOwned;
    return true;
}
