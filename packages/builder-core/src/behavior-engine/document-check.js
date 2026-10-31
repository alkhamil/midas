// Phase 2 of the load rules: needs the whole document. Each instance's props are checked against its master's template
// and binding. Only the master holds the binding; an instance never names a template.
import { TEMPLATES, variableProps } from './registry.js';
import { assertBehaviorShape, behaviorError, BehaviorDataError } from './data.js';
import { isPropVisible, resolveProps, valueProblem } from './instance-props.js';
import { planInstanceAnatomy } from './anatomy.js';

/**
 * Phase 1 and phase 2 for a whole document. Throws BehaviorDataError naming the page, the node and the prop, mode or layer at fault.
 * @param {{ variables?: { collections?: any[] }, pages?: { id: string, name: string, nodes?: any[] }[] } | null | undefined} doc
 */
export function assertBehaviorData(doc) {
    assertBehaviorShape(doc);
    checkPages(doc, null);
}

/**
 * Phase 1 and phase 2 for the pages that have just arrived in a lazily opened file. Pages may still be missing: an instance
 * whose master is not loaded yet is left alone until the master's page arrives. So the check covers the arrived pages, and
 * every instance on a loaded page whose master is on an arrived page, which makes cross-page rules run when either page arrives.
 * @param {{ variables?: { collections?: any[] }, pages?: { id: string, name: string, nodes?: any[] }[] } | null | undefined} doc the document as far as it is loaded
 * @param {string[]} pageIds the pages that have just arrived
 */
export function assertPagesBehavior(doc, pageIds) {
    assertBehaviorShape(doc);
    checkPages(doc, new Set(pageIds));
}

/**
 * Phase 2 over the pages of a document. `arrived` null checks every page; otherwise only the arrived pages and the instances
 * that name a master on them. An instance whose master is missing is checked only when the document is complete.
 * @param {{ variables?: { collections?: any[] }, pages?: { id: string, name: string, nodes?: any[] }[] } | null | undefined} doc
 * @param {Set<string> | null} arrived
 */
function checkPages(doc, arrived) {
    const pages = doc?.pages || [];
    const all = pages.flatMap(p => p.nodes || []);
    const nodes = new Map(all.map(n => [n.id, n]));
    const children = childrenByParent(all);
    const collections = doc?.variables?.collections || [];
    const arrivedNodes = new Set(pages.filter(p => !arrived || arrived.has(p.id)).flatMap(p => (p.nodes || []).map(n => n.id)));
    for (const page of pages) {
        const isArrived = !arrived || arrived.has(page.id);
        for (const n of page.nodes || []) {
            const isInstance = n.isInstance === true;
            const masterMissing = isInstance && !nodes.has(n.sourceId);
            if (!isArrived && !(isInstance && arrivedNodes.has(n.sourceId))) continue;
            if (arrived && masterMissing) continue; // deferred until the master's page arrives
            if (isInstance && n.behavior && 'props' in n.behavior) checkInstance(n, nodes, collections, page.name);
            if (isInstance) checkAnatomy(n, nodes, children, page.name);
            if (isArrived && n.behavior && 'slot' in n.behavior && !nodes.get(n.parentId)?.isInstance) throw behaviorError(n, 'a managed layer sits outside an instance', page.name);
        }
    }
}

/**
 * The first behavior problem of a document as { name, problem } (the node's name and the reason), or null when it is valid.
 * The editor uses it as a backstop after each change, so it can say what is wrong instead of failing to open.
 * @param {{ variables?: { collections?: any[] }, pages?: { nodes?: any[] }[] } | null | undefined} doc
 * `partial` checks a document with pages still missing (see assertPagesBehavior).
 * @param {{ partial?: boolean }} [options]
 * @returns {{ name: string, problem: string } | null}
 */
export function behaviorProblem(doc, { partial = false } = {}) {
    try {
        if (partial) assertPagesBehavior(doc, (doc?.pages || []).map(p => p.id));
        else assertBehaviorData(doc);
        return null;
    }
    catch (err) {
        if (err instanceof BehaviorDataError && err.detail) return err.detail;
        throw err;
    }
}

/**
 * The children of every node, in document order.
 * @param {any[]} all
 * @returns {Map<string | null, any[]>}
 */
function childrenByParent(all) {
    /** @type {Map<string | null, any[]>} */
    const out = new Map();
    for (const n of all) {
        const key = n.parentId ?? null;
        if (!out.has(key)) out.set(key, []);
        /** @type {any[]} */ (out.get(key)).push(n);
    }
    return out;
}

/**
 * The nodes under `id`, depth first.
 * @param {string} id
 * @param {Map<string | null, any[]>} children
 * @returns {any[]}
 */
function descendantsOf(id, children) {
    return (children.get(id) || []).flatMap(c => [c, ...descendantsOf(c.id, children)]);
}

/**
 * The managed layers of an instance must match its values: present iff hasIcon, the right slot, the right position.
 * Nothing is repaired; the first mismatch fails the file. A master without a label layer or auto layout is not checked.
 * @param {any} n an instance
 * @param {Map<string, any>} nodes every node of the document by id
 * @param {Map<string | null, any[]>} children
 * @param {string} page the name of the page the instance is on
 */
function checkAnatomy(n, nodes, children, page) {
    const master = nodes.get(n.sourceId);
    const { ops, reason } = planInstanceAnatomy({
        binding: master?.behavior,
        masterRoot: { isAutoLayout: !!master && master.type === 'frame' && !!master.layout && master.layout !== 'none' },
        masterTree: master ? descendantsOf(master.id, children) : [],
        // A flipped instance root stores its children back to front: the planner places icons at the visual start and end.
        flip: !!n.layoutFlip,
        stored: n.behavior?.props,
        children: (children.get(n.id) || []).map(c => ({
            id: c.id, slot: c.behavior?.slot ?? null,
            // A slot shows the icon its nested instance is an instance of (null for the placeholder).
            component: c.behavior && 'slot' in c.behavior ? (children.get(c.id) || []).find(x => x.isInstance && x.sourceId)?.sourceId ?? null : undefined,
        })),
    });
    if (reason || !ops.length) return;
    const op = ops[0];
    /** @param {string} id */
    const slotOf = id => nodes.get(id)?.behavior?.slot;
    const problem = op.op === 'remove' ? `managed layer "${slotOf(op.id)}" is not expected for these values`
        : op.op === 'insert' ? `managed layer "${op.slot}" is missing`
            : op.op === 'swap' ? `managed layer "${slotOf(op.id)}" does not show the icon its instance chose`
                : `managed layer "${slotOf(op.id)}" is at the wrong position`;
    throw behaviorError(n, problem, page);
}

/**
 * @param {any} n an instance with props
 * @param {Map<string, any>} nodes every node of the document by id
 * @param {any[]} collections the document's variable collections
 * @param {string} page the name of the page the instance is on
 */
function checkInstance(n, nodes, collections, page) {
    /** @type {(problem: string) => never} */
    const fail = problem => {
        throw behaviorError(n, problem, page);
    };
    const binding = nodes.get(n.sourceId)?.behavior;
    if (!binding || !('templateId' in binding)) fail('its master has no behavior binding');
    const template = TEMPLATES.get(binding.templateId);
    if (!template) fail(`its master names an unknown template "${binding.templateId}"`);
    const stored = n.behavior.props;
    for (const name of Object.keys(stored)) {
        if (!Object.hasOwn(template.props, name)) fail(`prop "${name}" is not a prop of ${template.id}`);
        const def = template.props[name];
        const problem = valueProblem(def, stored[name]);
        if (problem) fail(`prop "${name}": ${problem}`);
    }
    const resolved = resolveProps(template, stored);
    for (const name of Object.keys(stored)) {
        if (!isPropVisible(template, name, resolved) && template.props[name].type !== 'iconComponent') fail(`prop "${name}" is hidden by its visibleIf but holds a value`);
    }
    // An Appearance mode the instance holds must be a mode of the collection its master binds: no silent fallback to another mode.
    for (const [dim] of variableProps(template)) {
        const collectionId = binding.variables[dim];
        const mode = collectionId ? n.varModes?.[collectionId] : undefined;
        if (mode === undefined) continue;
        const collection = collections.find(c => c.id === collectionId);
        if (!collection) fail(`collection "${collectionId}" is bound to ${dim}, but does not exist`);
        if (!collection.modes?.some(m => m.id === mode)) fail(`mode "${mode}" is not in collection "${collection.name}"`);
    }
}

