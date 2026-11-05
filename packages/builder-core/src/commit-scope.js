// Which commits can change a component: the sync of instances, the slot and behaviour checks, and the page switches they cause. A commit
// that cannot change one skips that work. The rule is conservative: when a change is not understood, the commit takes the full path.
//
// A change set lists the layers a commit added, removed or edited, each with the flags its own fields give (layerFlagsOf) and whether
// it lies inside a master, an instance or a boolean group. An edited layer lists the keys it changed (`keys`), or null when they are not
// known. Undo, redo, paste and import are given as `full`.

/** The fields that tie a layer to components, variables, slots, behaviour, or a boolean result. A layer with any of them can change a component. */
const COMPONENT_FIELDS = ['component', 'componentSet', 'isInstance', 'sourceId', 'behavior', 'propBind', 'vars', 'cprops', 'booleanOp', 'prototype'];

/**
 * The keys an edit of a plain layer may change without touching a component: its geometry, its paint, its name and visibility. A
 * binding to a variable is a `vars` flag, so a painted value here is a literal.
 */
const PLAIN_KEYS = new Set(['x', 'y', 'w', 'h', 'rotation', 'flipX', 'flipY', 'points', 'contours', 'closed', 'pathW', 'pathH', 'fillRule', 'name', 'visible', 'locked', 'opacity', 'fills', 'fill', 'fillOpacity', 'stroke', 'strokeOpacity', 'strokeWidth', 'radius', 'layoutSizingH', 'layoutSizingV', 'autoW']);

/**
 * The flags a layer's own fields give: the names of the component fields it has. Only presence counts.
 * @param {any} n
 * @returns {string[]}
 */
export function layerFlagsOf(n) {
    const flags = [];
    for (const key of COMPONENT_FIELDS) {
        const value = key === 'component' || key === 'componentSet' || key === 'isInstance' ? n[key] === true : n[key];
        const present = Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== false && value !== '' && !(typeof value === 'object' && Object.keys(value).length === 0);
        if (present) flags.push(key === 'isInstance' ? 'instance' : key);
    }
    return flags;
}

/** A layer that is plain: no flags, outside any master, instance or boolean group. */
const plain = layer => layer.flags.length === 0 && !layer.inComponent;

/**
 * Whether a commit can change a component.
 * @param {{ added: any[], removed: any[], changed: any[], full: boolean } | null} change
 * @returns {{ affects: boolean, reason: string | null }}
 */
export function commitAffectsComponents(change) {
    if (!change) return { affects: true, reason: 'the change is not known' };
    if (change.full) return { affects: true, reason: 'undo, redo, paste or import' };
    const added = new Set(change.added.map(l => l.id));
    const removed = new Set(change.removed.map(l => l.id));
    // The parents of the layers a commit adds or removes: their children list changed, which is not a change to them.
    const parents = new Set([...change.added, ...change.removed].map(l => l.parentId).filter(id => id != null));
    for (const layer of [...change.added, ...change.removed]) {
        if (layer.inComponent) return { affects: true, reason: `"${layer.id}" is inside a master, an instance or a boolean group` };
        if (layer.flags.length) return { affects: true, reason: `"${layer.id}" has ${layer.flags.join(', ')}` };
        if (layer.parentId == null && (layer.type === 'frame' || layer.type === 'section' || layer.type === 'group')) return { affects: true, reason: 'page structure' };
    }
    for (const layer of change.changed) {
        if (!plain(layer)) return { affects: true, reason: `"${layer.id}" has ${layer.flags.length ? layer.flags.join(', ') : 'an ancestor in a master, an instance or a boolean group'}` };
        // A layer the commit added or removed, or the parent of one, is plain: its own change is the add or the remove.
        if (added.has(layer.id) || removed.has(layer.id) || parents.has(layer.id)) continue;
        if (layer.keys && layer.keys.every(k => PLAIN_KEYS.has(k))) continue;
        return { affects: true, reason: `"${layer.id}" is edited in ${layer.keys ? layer.keys.join(', ') : 'keys not known'}` };
    }
    return { affects: false, reason: null };
}
