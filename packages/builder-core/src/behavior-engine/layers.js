// Master layers (pure): the layers of a component that the behavior engine maps to its display keys. `root` is the master itself,
// `label` the first text layer inside it, depth first in visual order (see layoutOrder: a flipped auto layout frame reads its
// children back to front). Icon slots have no master layer. Diagnostics and the studio share this rule.
import { layoutOrder } from '../geometry/autolayout.js';

/**
 * The first text layer under `id` with the frame that holds it, depth first in visual order; null when there is none.
 * @param {string} id
 * @param {(id: string) => any[]} childrenOf
 * @param {any} [parent] the frame `id` hangs under: the parent of a top-level hit, or the frame itself when it is known
 * (a flipped auto layout frame is read back to front, so its visual-first text differs from its stored-first one)
 * @returns {{ node: any, parent: any } | null}
 */
export function labelEntryOf(id, childrenOf, parent = null) {
    const kids = parent && parent.id === id ? layoutOrder(parent, childrenOf(id)) : childrenOf(id);
    for (const c of kids) {
        if (c.type === 'text') return { node: c, parent };
        const found = labelEntryOf(c.id, childrenOf, c);
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
 * The master layers a display key maps to, as { key, node } pairs: `root` and, when there is one, `label`.
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @returns {{ key: string, node: any }[]}
 */
export function masterLayersOf(master, childrenOf) {
    const label = labelLayerOf(master.id, childrenOf, master);
    return [{ key: 'root', node: master }, ...(label ? [{ key: 'label', node: label }] : [])];
}
