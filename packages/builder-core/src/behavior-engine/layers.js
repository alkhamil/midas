// Master layers (pure): the layers of a component that the behavior engine maps to its display keys. `root` is the master itself,
// `label` the first text layer inside it that is neither a canvas part nor an affix text (behavior.text), depth first in visual order (see layoutOrder: a flipped auto
// layout frame reads its children back to front). Icon slots and canvas parts are not the label. Diagnostics and the studio share this rule.
import { layoutOrder } from '../geometry/autolayout.js';

/**
 * The first text layer under `id` with the frame that holds it, depth first in visual order; null when there is none.
 * @param {string} id
 * @param {(id: string) => any[]} childrenOf
 * @param {any} [parent] the frame `id` hangs under: the parent of a top-level hit, or the frame itself when it is known
 * (a flipped auto layout frame is read back to front, so its visual-first text differs from its stored-first one)
 * @param {string | null} [primary] the template's primary text part: an instance's managed text layer is the label only when it is the
 * primary one (a master holds no managed layer, so a master needs none)
 * @returns {{ node: any, parent: any } | null}
 */
export function labelEntryOf(id, childrenOf, parent = null, primary = null) {
    // The template's primary managed layer wins over a plain text layer: an instance can hold a hidden copy of the master's label first.
    return (primary !== null ? findLabel(id, childrenOf, parent, primary, true) : null) ?? findLabel(id, childrenOf, parent, primary, false);
}

/** @returns {{ node: any, parent: any } | null} */
function findLabel(id, childrenOf, parent, primary, primaryOnly) {
    const kids = parent && parent.id === id ? layoutOrder(parent, childrenOf(id)) : childrenOf(id);
    for (const c of kids) {
        // A canvas part is a text layer too (placeholder, count, clear), but the label is the value layer only.
        if (c.type === 'text') {
            const managed = primaryOnly ? c.behavior?.slot === primary : c.behavior?.slot === undefined || c.behavior.slot === primary;
            if (!c.behavior?.part && !c.behavior?.text && managed) return { node: c, parent };
            continue;
        }
        const found = findLabel(c.id, childrenOf, c, primary, primaryOnly);
        if (found) return found;
    }
    return null;
}

/**
 * The first text layer under `id` (depth first in visual order); null when there is none.
 * @param {string} id
 * @param {(id: string) => any[]} childrenOf
 * @param {any} [parent] the frame itself, when it is known (see labelEntryOf)
 * @returns {any}
 */
export function labelLayerOf(id, childrenOf, parent = null) {
    return labelEntryOf(id, childrenOf, parent)?.node ?? null;
}

/**
 * The master layers a display key maps to, as { key, node } pairs: `root` and, when there is one, the primary text layer under the
 * key the template names it by (its primarySlot, see primarySlotOf).
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @param {string | null} primary the template's primary text part id
 * @returns {{ key: string, node: any }[]}
 */
export function masterLayersOf(master, childrenOf, primary) {
    const text = labelLayerOf(master.id, childrenOf, master);
    return [{ key: 'root', node: master }, ...(text && primary ? [{ key: primary, node: text }] : [])];
}
