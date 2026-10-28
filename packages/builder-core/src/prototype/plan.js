// Prototype planner (pure). Each function returns the new prototype data, or the list of changes a document edit has to apply, and
// never touches a document. Destinations are kept, dropped or remapped as the operation requires, and every drop is reported.
// A node's prototype keeps its scroll behaviour (`overflow`) through every interaction edit.
import { PROTOTYPE_VERSION, OVERFLOWS } from './data.js';

/**
 * Refuses a node that cannot own interactions: a managed layer (the slot of a behavior component) belongs to its instance.
 * @param {{ behavior?: any }} node
 */
export function assertCanOwnInteractions(node) {
    if (node.behavior && typeof node.behavior === 'object' && 'slot' in node.behavior) throw new Error('A managed layer cannot own interactions.');
}

/**
 * The prototype data of a node with the given interactions. The node's scroll behaviour stays. Undefined when neither is left.
 * @param {{ version: number, interactions: any[], overflow?: string } | undefined} prototype
 * @param {any[]} interactions
 */
function withInteractions(prototype, interactions) {
    const next = { version: PROTOTYPE_VERSION, interactions };
    if (prototype?.overflow) next.overflow = prototype.overflow;
    return interactions.length || next.overflow ? next : undefined;
}

/**
 * The prototype data with one interaction appended. Refuses an id the node already has.
 * @param {{ version: number, interactions: any[], overflow?: string } | undefined} prototype
 * @param {any} interaction
 */
export function addInteraction(prototype, interaction) {
    const interactions = prototype?.interactions ?? [];
    if (interactions.some(i => i.id === interaction.id)) throw new Error(`The node already has interaction "${interaction.id}".`);
    return withInteractions(prototype, [...interactions, interaction]);
}

/**
 * The prototype data with one interaction's trigger or action replaced. Its id and place stay.
 * @param {{ version: number, interactions: any[], overflow?: string }} prototype
 * @param {string} id
 * @param {{ trigger?: any, action?: any }} patch
 */
export function editInteraction(prototype, id, patch) {
    if (!prototype?.interactions.some(i => i.id === id)) throw new Error(`The node has no interaction "${id}".`);
    return withInteractions(prototype, prototype.interactions.map(i => (i.id === id ? { ...i, ...patch } : i)));
}

/**
 * The prototype data without one interaction. Undefined when no interaction and no scroll behaviour is left.
 * @param {{ version: number, interactions: any[], overflow?: string } | undefined} prototype
 * @param {string} id
 */
export function removeInteraction(prototype, id) {
    return withInteractions(prototype, (prototype?.interactions ?? []).filter(i => i.id !== id));
}

/**
 * The prototype data of a frame with its scroll behaviour set. `none` is the default and is not stored. Undefined when nothing is left.
 * @param {{ version: number, interactions: any[], overflow?: string } | undefined} prototype
 * @param {string} overflow one of OVERFLOWS
 */
export function setOverflow(prototype, overflow) {
    if (!OVERFLOWS.includes(overflow)) throw new Error(`Unknown scroll behaviour "${overflow}".`);
    const interactions = prototype?.interactions ?? [];
    const next = { version: PROTOTYPE_VERSION, interactions };
    if (overflow !== 'none') next.overflow = overflow;
    return interactions.length || overflow !== 'none' ? next : undefined;
}

/** @param {any} interaction */
const destinationOf = interaction => (interaction.action?.type === 'navigate-to' ? interaction.action.destinationId : null);

/**
 * What deleting a set of nodes does to the prototype. Interactions that point at a deleted node are removed from the nodes that own
 * them. A flow that starts at a deleted frame is listed in `flows` for removal with the frame. A deleted node's own interactions go
 * with it. Each change is reported.
 * @param {{ name: string, nodes?: any[], prototype?: any }[]} pages
 * @param {Set<string>} removed the ids of the nodes being deleted, descendants included
 */
export function planNodeRemoval(pages, removed) {
    const edits = [];
    const report = [];
    for (const page of pages) {
        for (const node of page.nodes || []) {
            if (removed.has(node.id) || !node.prototype?.interactions) continue;
            const gone = node.prototype.interactions.filter(i => removed.has(destinationOf(i)));
            if (!gone.length) continue;
            edits.push({ pageId: page.id, page: page.name, node: node.name, nodeId: node.id, removeInteractions: gone.map(i => i.id) });
            for (const i of gone) report.push({ code: 'interaction-removed', page: page.name, node: node.name, interaction: i.id, destination: destinationOf(i) });
        }
    }
    const flows = [];
    for (const page of pages) {
        for (const flow of page.prototype?.flows ?? []) {
            if (!removed.has(flow.startFrameId)) continue;
            flows.push({ pageId: page.id, page: page.name, flowId: flow.id, flowName: flow.name });
            report.push({ code: 'flow-start-removed', page: page.name, flow: flow.name, frame: flow.startFrameId });
        }
    }
    return { edits, flows, report };
}

/**
 * The interactions a copied node keeps. A destination that the copy also contains is remapped to its copy; one the target
 * document does not have is dropped and reported. `exists` answers for the target document. The scroll behaviour is copied as it is.
 * @param {{ prototype: { version: number, interactions: any[], overflow?: string } | undefined, remap?: Map<string, string>, exists: (id: string) => boolean }} input
 */
export function planCopiedInteractions({ prototype, remap = new Map(), exists }) {
    const dropped = [];
    const kept = [];
    for (const interaction of prototype?.interactions ?? []) {
        const destination = destinationOf(interaction);
        if (destination === null) {
            kept.push(interaction);
            continue;
        }
        const target = remap.get(destination) ?? destination;
        if (!exists(target)) {
            dropped.push({ code: 'interaction-dropped', interaction: interaction.id, destination });
            continue;
        }
        kept.push({ ...interaction, action: { ...interaction.action, destinationId: target } });
    }
    return { prototype: withInteractions(prototype, kept), dropped };
}

/**
 * What detaching an instance does to the prototype. The instance keeps its own interactions. Its inner layers that copy the master
 * (a master-owned layer, with sourceId) and its managed layers lose theirs: those interactions belong to the component, not to the
 * detached copy. Each drop is reported.
 * @param {any[]} nodes every node in the document
 * @param {string} instanceId
 */
export function planDetach(nodes, instanceId) {
    const edits = [];
    const report = [];
    const within = new Set([instanceId]);
    const stack = [instanceId];
    while (stack.length) {
        const id = stack.pop();
        for (const c of nodes.filter(n => n.parentId === id)) {
            if (!within.has(c.id)) {
                within.add(c.id);
                stack.push(c.id);
            }
        }
    }
    for (const n of nodes) {
        if (!within.has(n.id) || n.id === instanceId || !n.prototype?.interactions?.length) continue;
        const master = !!n.sourceId;
        const managed = !!n.behavior && typeof n.behavior === 'object' && 'slot' in n.behavior;
        if (!master && !managed) continue;
        edits.push({ nodeId: n.id, removeInteractions: n.prototype.interactions.map(i => i.id) });
        for (const i of n.prototype.interactions) report.push({ code: 'interaction-dropped-on-detach', node: n.name, interaction: i.id });
    }
    return { edits, report };
}
