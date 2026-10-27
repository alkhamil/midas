// Load rules for the `behavior` key of a node (see AGENTS.md). A file with no behavior data opens normally. Data whose
// version or shape does not match fails with an explicit error. Nothing is repaired and nothing is partially loaded.
// Phase 1 (this file) checks one node at a time. Phase 2 (document-check.js) checks instances against their masters.
import { TEMPLATES, variableProps } from './registry.js';
import { isPlainObject } from './validate-schema.js';

export const BEHAVIOR_DATA_VERSION = 1;

export class BehaviorDataError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = 'BehaviorDataError';
    }
}

/**
 * The error for one node's behavior data, naming the node and the problem.
 * @param {{ id: string, name?: string }} node
 * @param {string} problem
 */
export function behaviorError(node, problem) {
    return new BehaviorDataError(`Cannot open this file: behavior data on "${node.name}" (${node.id}) is invalid: ${problem}. This build reads behavior version ${BEHAVIOR_DATA_VERSION}.`);
}

/** @param {unknown} v */
const isValue = v => v === null || typeof v === 'string' || typeof v === 'boolean';

/**
 * The first problem with a node's behavior data, or null when it is valid. Master = binding, instance = props.
 * @param {{ isInstance?: boolean, behavior: any }} node
 * @returns {string | null}
 */
function problemOf(node) {
    const b = node.behavior;
    if (!isPlainObject(b)) return 'behavior must be an object';
    if (b.version !== BEHAVIOR_DATA_VERSION) return `behavior version ${b.version} is not version ${BEHAVIOR_DATA_VERSION}`;
    const managed = 'slot' in b;
    const master = 'templateId' in b;
    const want = managed ? ['slot'] : master ? ['templateId', 'variables'] : ['props'];
    const extra = Object.keys(b).filter(k => k !== 'version' && !want.includes(k));
    if (extra.length) return `unknown field ${extra.join(', ')}`;
    const missing = want.filter(k => !(k in b));
    if (missing.length) return `missing ${missing.join(', ')}`;
    if (managed) {
        if (node.isInstance) return 'a managed layer cannot be an instance';
        return typeof b.slot === 'string' && b.slot !== '' ? null : 'slot must name a managed slot';
    }
    if (master) {
        if (node.isInstance) return 'binding data on an instance (instances hold props only)';
        const template = typeof b.templateId === 'string' ? TEMPLATES.get(b.templateId) : undefined;
        if (!template) return `unknown template "${b.templateId}"`;
        if (!isPlainObject(b.variables)) return 'variables must be an object';
        const dimensions = variableProps(template).map(([prop]) => prop);
        for (const [prop, id] of Object.entries(b.variables)) {
            if (!dimensions.includes(prop)) return `"${prop}" is not a variable prop of ${template.id}`;
            if (id !== null && typeof id !== 'string') return `variable "${prop}" must name a collection or be null`;
        }
        return null;
    }
    if (!node.isInstance) return 'instance props on a node that is not an instance';
    if (!isPlainObject(b.props)) return 'props must be an object';
    for (const [prop, v] of Object.entries(b.props)) if (!isValue(v)) return `prop "${prop}" holds a value that is not text, boolean or null`;
    return null;
}

/**
 * Detaching an instance strips the behavior data of it and its layers (props and managed slot markers), so the file reopens.
 * Changes the nodes in place.
 * @param {{ behavior?: unknown }[]} nodes
 */
export function detachBehavior(nodes) {
    for (const n of nodes) delete n.behavior;
}

/**
 * Phase 1: throws BehaviorDataError for the first node whose behavior data does not match this build.
 * Used alone for partial loads (one page at a time), where the masters of some instances are not in memory yet.
 * @param {{ pages?: { nodes?: any[] }[] } | null | undefined} doc
 */
export function assertBehaviorShape(doc) {
    // Nodes are flat per page and link to their parent by parentId (see apps/studio/src/engine/midas.js).
    for (const page of doc?.pages || []) {
        for (const n of page.nodes || []) {
            if (n.behavior === undefined) continue;
            const problem = problemOf(n);
            if (problem) throw behaviorError(n, problem);
        }
    }
}
