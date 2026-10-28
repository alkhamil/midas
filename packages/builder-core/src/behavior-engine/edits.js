// Edits (pure): the decisions the studio makes before it writes a node's behavior fields. Each returns the new value of one field,
// or undefined where the node loses the field. The studio applies them inside a transaction; nothing here touches the document.

/**
 * The vars of a node after one binding op from planStateBindings (value null removes the prop's binding).
 * @param {Record<string, string> | undefined} vars
 * @param {{ prop: string, value: string | null }} op
 * @returns {Record<string, string> | undefined}
 */
export function varsWithOp(vars, op) {
    const next = { ...(vars || {}) };
    if (op.value === null) delete next[op.prop];
    else next[op.prop] = op.value;
    return Object.keys(next).length ? next : undefined;
}

/**
 * The vars of a node after Bind tokens binds one of its keys to a variable item. The other bindings are kept.
 * @param {Record<string, string> | undefined} vars
 * @param {string} varKey
 * @param {string} itemId
 * @returns {Record<string, string>}
 */
export function varsWithBinding(vars, varKey, itemId) {
    return { ...(vars || {}), [varKey]: itemId };
}

/**
 * The Appearance modes of a node after a mode is chosen for one collection. An empty mode clears the collection's entry.
 * @param {Record<string, string> | undefined} varModes
 * @param {string} collectionId
 * @param {string | null} modeId
 * @returns {Record<string, string> | undefined}
 */
export function varModesWith(varModes, collectionId, modeId) {
    const next = { ...(varModes || {}) };
    if (modeId) next[collectionId] = modeId;
    else delete next[collectionId];
    return Object.keys(next).length ? next : undefined;
}

/**
 * The collection a variable prop is bound to in a master's binding, or null when the prop is unbound.
 * @param {{ variables?: Record<string, string | null> } | undefined} binding
 * @param {string} prop
 * @returns {string | null}
 */
export function collectionOfProp(binding, prop) {
    return binding?.variables?.[prop] ?? null;
}
