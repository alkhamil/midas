// Which commits can change a component: the sync of instances, the slot and behaviour checks, and the page switches they cause. A commit
// that cannot change one skips that work. The rule is conservative: when a change is not understood, the commit takes the full path.
//
// A change set lists the layers a commit added, removed or edited, each with the flags its own fields give (layerFlagsOf) and whether
// it lies inside a master or an instance. A layer edited in place is listed as changed without its keys, so it always takes the full
// path. Undo, redo, paste and import are given as `full`.

/** The fields that tie a layer to components, variables, slots, or behaviour. A layer with any of them can change a component. */
const COMPONENT_FIELDS = ['component', 'componentSet', 'isInstance', 'sourceId', 'behavior', 'propBind', 'vars', 'cprops', 'booleanOp'];

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

/**
 * Whether a commit can change a component.
 * @param {{ added: any[], removed: any[], changed: any[], full: boolean } | null} change
 * @returns {{ affects: boolean, reason: string | null }}
 */
export function commitAffectsComponents(change) {
    if (!change) return { affects: true, reason: 'the change is not known' };
    if (change.full) return { affects: true, reason: 'undo, redo, paste or import' };
    if (change.changed.length) return { affects: true, reason: 'an existing layer was edited (its keys are not known here)' };
    for (const layer of [...change.added, ...change.removed]) {
        if (layer.inComponent) return { affects: true, reason: `"${layer.id}" is inside a master or an instance` };
        if (layer.flags.length) return { affects: true, reason: `"${layer.id}" has ${layer.flags.join(', ')}` };
        if (layer.parentId == null && (layer.type === 'frame' || layer.type === 'section' || layer.type === 'group')) return { affects: true, reason: 'page structure' };
    }
    return { affects: false, reason: null };
}
