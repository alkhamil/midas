// User overrides of a template layer's properties (pure). The engine binds a managed layer's colours, typography and sizes to the template's variables and remembers
// the vars keys it bound on the layer (`engineBound`). Per layer and per property, then:
//   - a key the engine bound that is now gone from `vars` was detached by the user (a raw value stands in for it): it is overridden, and no sync, state or variant change binds it again;
//   - a key bound to a variable that is not the engine's is the user's too (the planners keep it);
//   - Reset forgets the key, so the next sync binds the template's variable again.
// A property the engine never bound has no mark and is written as before. Nothing here adds a layer.

/**
 * The vars keys of a layer that the user detached: bound by the engine once, gone now.
 * @param {{ vars?: Record<string, string>, engineBound?: string[] }} node
 * @returns {string[]}
 */
export function overriddenKeysOf(node) {
    return (node.engineBound ?? []).filter(key => node.vars?.[key] === undefined);
}

/**
 * Whether the user detached a vars key of a layer.
 * @param {{ vars?: Record<string, string>, engineBound?: string[] }} node
 * @param {string} key
 */
export const isOverridden = (node, key) => node.engineBound?.includes(key) === true && node.vars?.[key] === undefined;

/**
 * Records what the engine did to a vars key of a layer: bound it (an item id) or removed its own binding (null, which is not an override).
 * @param {{ engineBound?: string[] }} node
 * @param {string} key
 * @param {string | null} itemId
 */
export function noteEngineBinding(node, key, itemId) {
    const held = node.engineBound ?? [];
    // The order is the order the engine first bound the keys in, so a second pass changes nothing.
    const next = itemId === null ? held.filter(k => k !== key) : held.includes(key) ? held : [...held, key];
    if (next.length) node.engineBound = next;
    else delete node.engineBound;
}

/**
 * Reset a property to the template's default: the layer forgets that it overrode the key and drops whatever binding it holds there, so the next sync binds the
 * template's variable (and the variable's value) again.
 * @param {{ vars?: Record<string, string>, engineBound?: string[] }} node
 * @param {string} key
 */
export function resetOverride(node, key) {
    if (node.vars) {
        delete node.vars[key];
        if (!Object.keys(node.vars).length) delete node.vars;
    }
    noteEngineBinding(node, key, null);
}
