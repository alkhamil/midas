// Appearance modes of a node (pure). The same rule the editor uses for Appearance (nodeMode): the node's own mode for a
// collection, then its parents', then the page's, then the collection's first mode. Behavior reads modes through this and
// writes them through the same `varModes` field, so Behavior and Appearance always agree.

/**
 * The mode a collection resolves to for one node.
 * @param {{ id: string, modes: { id: string }[] }} collection
 * @param {{ id: string, parentId?: string | null, varModes?: Record<string, string> }} node
 * @param {Map<string, any>} nodesById every node of the document by id
 * @param {Record<string, string> | undefined} pageVarModes the page's own modes (the page is the node's fallback)
 * @returns {string | null} null when the collection has no modes
 */
export function resolveMode(collection, node, nodesById, pageVarModes) {
    const has = (/** @type {string | undefined} */ id) => !!id && collection.modes.some(m => m.id === id);
    let cur = node;
    for (let guard = 0; cur && guard < 200; guard++) {
        const mode = cur.varModes?.[collection.id];
        if (has(mode)) return /** @type {string} */ (mode);
        cur = cur.parentId ? nodesById.get(cur.parentId) : undefined;
    }
    const page = pageVarModes?.[collection.id];
    if (has(page)) return /** @type {string} */ (page);
    return collection.modes[0]?.id ?? null;
}
