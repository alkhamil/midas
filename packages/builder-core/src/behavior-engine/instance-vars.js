// Instance vars (pure). An instance's `vars` mix two kinds of binding: the ones it copies from its master (Bind tokens reaches them),
// and the owned ones the behavior engine derives per instance from its persistent states (see ownedVarKeys). The copy and the
// override check work on the first kind only; the derivation keeps the second.

/**
 * The vars without the owned keys. Undefined vars give an empty object.
 * @param {Record<string, string> | undefined} vars
 * @param {string[]} owned
 * @returns {Record<string, string>}
 */
export function withoutOwnedVars(vars, owned) {
    return Object.fromEntries(Object.entries(vars ?? {}).filter(([key]) => !owned.includes(key)));
}

/**
 * The vars an instance gets from its master: the master's copied vars, with the instance's own owned bindings kept. Undefined when
 * nothing is left, so the instance loses its vars.
 * @param {Record<string, string> | undefined} master the master's vars
 * @param {Record<string, string> | undefined} instance the instance's vars now
 * @param {string[]} owned
 * @returns {Record<string, string> | undefined}
 */
export function mergeCopiedVars(master, instance, owned) {
    const own = Object.fromEntries(owned.filter(key => instance?.[key] !== undefined).map(key => [key, instance[key]]));
    const merged = { ...withoutOwnedVars(master, owned), ...own };
    return Object.keys(merged).length ? merged : undefined;
}

/**
 * Whether two vars hold the same bindings, whatever order their keys were written in (the merge does not keep the master's order).
 * @param {Record<string, string> | undefined} a
 * @param {Record<string, string> | undefined} b
 */
export function sameVars(a, b) {
    const ka = Object.keys(a ?? {}), kb = Object.keys(b ?? {});
    return ka.length === kb.length && ka.every(key => (a ?? {})[key] === (b ?? {})[key]);
}

/** The node fields one vars key drives: the editor binds a pair of padding fields through one key (padH: left and right). */
const FIELDS_OF_VAR = { padH: ['padL', 'padR'], padV: ['padT', 'padB'] };

/**
 * The node fields that are bound through vars. A bound field's value is written from its variable on every apply, so it is never an
 * override of the master, whatever its value is now.
 * @param {Record<string, string> | undefined} vars
 * @returns {Set<string>}
 */
export function fieldsBoundBy(vars) {
    return new Set(Object.keys(vars ?? {}).flatMap(key => FIELDS_OF_VAR[key] ?? [key]));
}

/**
 * Whether the master's value of a field is copied onto the instance. A field bound through vars is not: its variable decides its
 * value, so copying the master's value would only be overwritten again on the next apply (the write churn).
 * @param {string} key the node field
 * @param {Record<string, string> | undefined} vars the instance's vars
 */
export function isCopiedField(key, vars) {
    return !fieldsBoundBy(vars).has(key);
}

/**
 * Whether the layout engine writes a field of a node, so a copy of the master's value would be rewritten on the next layout pass
 * (the write churn). It mirrors runLayout in the studio: a flow child of an auto-layout parent gets x and y; a frame sized hug gets
 * the hugged axis, a text layer hugs its height by default and its width when it auto-sizes; a fill child gets the fill axis from
 * its parent. Absolutely positioned children are not in flow.
 * @param {{ type?: string, layout?: string, layoutPositioning?: string, layoutSizingH?: string, layoutSizingV?: string, autoW?: boolean }} node
 * @param {{ type?: string, layout?: string } | undefined} parent
 * @param {string} field a node field: 'x', 'y', 'w' or 'h'
 */
export function isLayoutOwnedField(node, parent, field) {
    const flow = parent?.type === 'frame' && node.layoutPositioning !== 'absolute';
    const autoParent = flow && !!parent.layout && parent.layout !== 'none';
    if (field === 'x' || field === 'y') return autoParent;
    if (field !== 'w' && field !== 'h') return false;
    const explicit = field === 'w' ? node.layoutSizingH : node.layoutSizingV;
    const sizing = explicit ?? (node.type === 'text' ? (field === 'h' || node.autoW ? 'hug' : 'fixed') : 'fixed');
    if (sizing === 'hug') return node.type === 'frame' || (node.type === 'text' && flow && (autoParent || !!explicit));
    if (sizing === 'fill') return flow;
    return false;
}
