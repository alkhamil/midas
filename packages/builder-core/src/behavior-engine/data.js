// Load rules for the `behavior` key of a node (see AGENTS.md). A file with no behavior data opens normally. Data whose
// version or shape does not match fails with an explicit error. Nothing is repaired and nothing is partially loaded.
import { TEMPLATES } from './registry.js';

export const BEHAVIOR_DATA_VERSION = 1;

export class BehaviorDataError extends Error {
    /** @param {string} message */
    constructor(message) {
        super(message);
        this.name = 'BehaviorDataError';
    }
}

/** @param {unknown} v */
const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {unknown} v */
const isValue = v => v === null || typeof v === 'string' || typeof v === 'boolean';

/**
 * The first problem with a node's behavior data, or null when it is valid. Master = binding, instance = props.
 * @param {{ isInstance?: boolean, behavior: any }} node
 * @returns {string | null}
 */
function problemOf(node) {
    const b = node.behavior;
    if (!isPlain(b)) return 'behavior must be an object';
    if (b.version !== BEHAVIOR_DATA_VERSION) return `behavior version ${b.version} is not version ${BEHAVIOR_DATA_VERSION}`;
    const master = 'templateId' in b;
    const want = master ? ['templateId', 'variables'] : ['props'];
    const extra = Object.keys(b).filter(k => k !== 'version' && !want.includes(k));
    if (extra.length) return `unknown field ${extra.join(', ')}`;
    const missing = want.filter(k => !(k in b));
    if (missing.length) return `missing ${missing.join(', ')}`;
    if (master) {
        if (node.isInstance) return 'binding data on an instance (instances hold props only)';
        if (typeof b.templateId !== 'string' || !TEMPLATES.has(b.templateId)) return `unknown template "${b.templateId}"`;
        if (!isPlain(b.variables)) return 'variables must be an object';
        const props = TEMPLATES.get(b.templateId)?.props ?? {};
        const dimensions = Object.keys(props).filter(p => props[p].source === 'variable');
        for (const [prop, id] of Object.entries(b.variables)) {
            if (!dimensions.includes(prop)) return `"${prop}" is not a variable prop of ${b.templateId}`;
            if (id !== null && typeof id !== 'string') return `variable "${prop}" must name a collection or be null`;
        }
        return null;
    }
    if (!node.isInstance) return 'instance props on a node that is not an instance';
    if (!isPlain(b.props)) return 'props must be an object';
    for (const [prop, v] of Object.entries(b.props)) if (!isValue(v)) return `prop "${prop}" holds a value that is not text, boolean or null`;
    return null;
}

/**
 * Throws BehaviorDataError for the first node in the file whose behavior data does not match this build.
 * @param {{ pages?: { nodes?: any[] }[] } | null | undefined} doc
 */
export function assertBehaviorData(doc) {
    // Nodes are flat per page and link to their parent by parentId (see apps/studio/src/engine/midas.js).
    for (const page of doc?.pages || []) {
        for (const n of page.nodes || []) {
            if (n.behavior === undefined) continue;
            const problem = problemOf(n);
            if (problem) throw new BehaviorDataError(`Cannot open this file: behavior data on "${n.name}" (${n.id}) is invalid: ${problem}. This build reads behavior version ${BEHAVIOR_DATA_VERSION}.`);
        }
    }
}
