// The templates a component is bound to (pure). A slot's `accepts` names template ids, and a candidate qualifies when it is an instance of a master
// bound to one of them. The binding is `behavior.templateId` on the master: it is carried by a copy, survives a rename, and is part of a library
// snapshot's nodes (and so of the copy a file imports from it), which an id or a name is not.

/**
 * The template ids a main component is bound to: its own binding, or for a component set those of its variants (once each, in variant order).
 * A plain component, or an id that is not among the nodes, has none.
 * @param {{ id: string, parentId?: string | null, component?: boolean, componentSet?: boolean, behavior?: { templateId?: string } }[]} nodes
 *   the nodes the component lives among: a file's nodes, or a library snapshot component's `nodes`
 * @param {string} id the main component, or its set
 * @returns {string[]}
 */
export function templateIdsOf(nodes, id) {
    const self = nodes.find(n => n.id === id);
    if (!self) return [];
    const masters = self.componentSet ? nodes.filter(n => n.parentId === id && n.component) : [self];
    return [...new Set(masters.map(n => n.behavior?.templateId).filter(t => typeof t === 'string'))];
}
