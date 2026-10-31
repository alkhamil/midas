// Managed layers (stage 6): a layer that anatomy sync owns. It stays selectable, but it is never moved, reordered,
// reparented, deleted, copied or otherwise changed on its own. Only anatomy sync adds and removes it. The editor asks
// managedRefusal before an action and stops the action with the message it returns.

/** What each action means, for the message: "... <what> on its own is not allowed." */
const WHAT = {
    delete: 'deleting it',
    copy: 'copying it',
    duplicate: 'duplicating it',
    reorder: 'reordering it',
    move: 'moving it',
    group: 'grouping it',
    align: 'aligning it',
    boolean: 'using it in a boolean operation',
    flatten: 'flattening it',
    replace: 'replacing it',
};

/**
 * A managed layer carries its slot name under `behavior` (see anatomy.js).
 * @param {any} node
 */
export function isManagedLayer(node) {
    return !!node.behavior && typeof node.behavior === 'object' && 'slot' in node.behavior;
}

/**
 * Whether the engine owns a node sizing: the icon instance a managed slot holds fills its slot on every side, so the
 * copy from the icon component never overwrites its sizing. Nothing else is engine-sized: the Button root and the label
 * keep the sizing the user chose, and the icon inner layers stay faithful copies of the component.
 * @param {any} node
 * @param {any} parent its parent layer
 */
export function isSlotIconInstance(node, parent) {
    return !!node && node.isInstance === true && !!parent && isManagedLayer(parent);
}

/**
 * Why `action` is refused for the nodes it would touch, or null when none of them is managed.
 * @param {keyof typeof WHAT} action
 * @param {any[]} nodes the top-level layers the action would touch
 * @returns {string | null}
 */
export function managedRefusal(action, nodes) {
    const managed = nodes.find(isManagedLayer);
    if (!managed) return null;
    return `"${managed.behavior.slot}" is managed by its instance: ${WHAT[action]} on its own is not allowed.`;
}

/**
 * Why pasting these nodes is refused, or null. A managed layer is pasted only together with its instance: its parent must be in
 * the same payload. A whole instance (with its managed layers) is allowed; the layers then sync in the paste transaction.
 * @param {{ id: string, parentId?: string | null, behavior?: any }[]} nodes the clipboard payload, every node in it
 * @returns {string | null}
 */
export function managedPasteRefusal(nodes) {
    const ids = new Set(nodes.map(n => n.id));
    const orphan = nodes.find(n => isManagedLayer(n) && !ids.has(n.parentId));
    return orphan ? `"${orphan.behavior.slot}" is managed by its instance: pasting it without that instance is not allowed.` : null;
}
