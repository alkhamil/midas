// Master layers (pure): the layers of a component that the behavior engine maps to its display keys. `root` is the master itself,
// `label` the first text layer inside it (depth first). Icon slots have no master layer. Diagnostics and the studio share this rule.

/**
 * The first text layer under `id`, depth first; null when there is none.
 * @param {string} id
 * @param {(id: string) => any[]} childrenOf
 * @returns {any}
 */
export function labelLayerOf(id, childrenOf) {
    for (const c of childrenOf(id)) {
        if (c.type === 'text') return c;
        const found = labelLayerOf(c.id, childrenOf);
        if (found) return found;
    }
    return null;
}

/**
 * The master layers a display key maps to, as { key, node } pairs: `root` and, when there is one, `label`.
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @returns {{ key: string, node: any }[]}
 */
export function masterLayersOf(master, childrenOf) {
    const label = labelLayerOf(master.id, childrenOf);
    return [{ key: 'root', node: master }, ...(label ? [{ key: 'label', node: label }] : [])];
}
