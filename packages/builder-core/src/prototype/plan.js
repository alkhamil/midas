// Prototype planner (pure). Each function returns the new prototype data, or the list of changes a document edit has to apply, and
// never touches a document. Destinations are kept, dropped or remapped as the operation requires, and every drop is reported.
// A node's prototype keeps its scroll behaviour (`overflow`) through every interaction edit.
import { PROTOTYPE_VERSION, OVERFLOWS } from './data.js';
import { nextInteractionId } from './play.js';

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
export function withInteractions(prototype, interactions) {
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

/**
 * An action with every navigate-to's destination passed through `rewrite`: a new id, or null to drop that navigation. A conditional keeps
 * the branches that still hold an action and its else when that still holds one; a conditional left with no branch and no else is gone.
 * Every dropped destination is pushed to `dropped`. Undefined when the action itself is gone.
 * @param {any} action
 * @param {(destination: string) => string | null} rewrite
 * @param {string[]} dropped
 * @returns {any}
 */
export function rewriteAction(action, rewrite, dropped) {
    if (action?.type === 'navigate-to') {
        const next = rewrite(action.destinationId);
        if (next === null) {
            dropped.push(action.destinationId);
            return undefined;
        }
        return next === action.destinationId ? action : { ...action, destinationId: next };
    }
    if (action?.type !== 'conditional') return action;
    const branches = [];
    for (const b of action.branches) {
        const actions = rewriteList(b.actions, rewrite, dropped);
        if (actions.length) branches.push({ ...b, actions });
    }
    const elseActions = action.else === undefined ? [] : rewriteList(action.else, rewrite, dropped);
    if (!branches.length && !elseActions.length) return undefined;
    return { type: 'conditional', branches, ...(elseActions.length ? { else: elseActions } : {}) };
}

/** @param {any[]} actions @param {(destination: string) => string | null} rewrite @param {string[]} dropped */
const rewriteList = (actions, rewrite, dropped) => actions.map(a => rewriteAction(a, rewrite, dropped)).filter(a => a !== undefined);

/**
 * What deleting a set of nodes does to the prototype. Navigations to a deleted node are dropped from the actions that hold them: a
 * conditional loses the branch actions and the branches that are left empty, and an interaction whose action is gone is removed. A
 * flow that starts at a deleted frame is listed in `flows` for removal with the frame. A deleted node's own interactions go with it.
 * Each change is reported. `edits` hold each changed node's new interaction list.
 * @param {{ id: string, name: string, nodes?: any[], prototype?: any }[]} pages
 * @param {Set<string>} removed the ids of the nodes being deleted, descendants included
 */
export function planNodeRemoval(pages, removed) {
    const edits = [];
    const report = [];
    const gone = id => (removed.has(id) ? null : id);
    for (const page of pages) {
        for (const node of page.nodes || []) {
            if (removed.has(node.id) || !node.prototype?.interactions) continue;
            /** @type {any[]} */
            const interactions = [];
            let changed = false;
            for (const i of node.prototype.interactions) {
                const dropped = [];
                const action = rewriteAction(i.action, gone, dropped);
                if (!dropped.length) {
                    interactions.push(i);
                    continue;
                }
                changed = true;
                if (action === undefined) {
                    report.push({ code: 'interaction-removed', page: page.name, node: node.name, interaction: i.id, destination: dropped[0] });
                    continue;
                }
                interactions.push({ ...i, action });
                for (const destination of dropped) report.push({ code: 'action-removed', page: page.name, node: node.name, interaction: i.id, destination });
            }
            if (changed) edits.push({ pageId: page.id, page: page.name, node: node.name, nodeId: node.id, interactions });
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
        edits.push({ nodeId: n.id, interactions: [] });
        for (const i of n.prototype.interactions) report.push({ code: 'interaction-dropped-on-detach', node: n.name, interaction: i.id });
    }
    return { edits, report };
}

/**
 * The prototype of copied nodes, for their copies. Every copied interaction gets a new id. A link to a node that was copied with
 * them points at the copy. A link to any other node that still exists keeps pointing at it, on whatever page it is. A link to a node
 * that is gone is dropped and reported. A copy left with neither interactions nor a scroll behaviour has no prototype.
 * @param {{ nodes: { id: string, name: string, prototype?: any }[], copyOf: Map<string, string>, exists: (id: string) => boolean }} input
 *   the copied nodes (the originals); the copy id of each copied node; whether a node exists in the document
 * @returns {{ prototypes: Map<string, any>, report: { code: string, node: string, interaction: string, destination: string }[] }}
 *   the copy's prototype by the original's id (undefined when none is left)
 */
export function planCopiedInteractions({ nodes, copyOf, exists }) {
    const prototypes = new Map(), report = [];
    for (const node of nodes) {
        const p = node.prototype;
        if (!p) continue;
        /** @type {any[]} */
        const interactions = [];
        const target = d => (copyOf.has(d) ? copyOf.get(d) : exists(d) ? d : null);
        for (const i of p.interactions) {
            const dropped = [];
            const action = rewriteAction(i.action, target, dropped);
            for (const destination of dropped) report.push({ code: 'interaction-dropped-on-copy', node: node.name, interaction: i.id, destination });
            if (action === undefined) continue;
            interactions.push({ ...i, id: nextInteractionId(interactions.map(x => x.id)), action });
        }
        if (interactions.length || p.overflow !== undefined) prototypes.set(node.id, { ...p, interactions });
        else prototypes.set(node.id, undefined);
    }
    return { prototypes, report };
}

/**
 * The flow start of a page: the start frame of its first flow, or null when the page has none.
 * @param {{ flows?: { startFrameId: string }[] } | undefined} prototype the page's prototype data
 * @returns {string | null}
 */
export function flowStartOf(prototype) {
    return prototype?.flows?.[0]?.startFrameId ?? null;
}

/**
 * The page's prototype data with its one flow starting at a frame. A page has one flow start: setting it replaces the start. `null`
 * clears it, and then the page has no prototype data left. The flow is named after the page.
 * @param {{ version: number, flows: any[] } | undefined} prototype the page's prototype data
 * @param {string | null} frameId the top-level frame to start at, or null
 * @param {string} pageName
 */
export function withFlowStart(prototype, frameId, pageName) {
    if (frameId === null) return undefined;
    const flow = prototype?.flows?.[0];
    return { version: PROTOTYPE_VERSION, flows: [{ id: flow?.id ?? 'flow', name: flow?.name ?? pageName, startFrameId: frameId }] };
}
