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
