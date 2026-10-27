// Binding model (stage 2): a master component -> templateId, and each variable prop -> a variable collection.
// Persisted on the master as `behavior: { version, templateId, variables }`. Unused collections are derived, never stored.
import { BEHAVIOR_DATA_VERSION } from './data.js';
/** @typedef {import('../templates/schema.js').TemplateSchema} TemplateSchema */

/**
 * @typedef {{ id: string, name: string, modes?: { id: string, name: string }[] }} Collection
 * @typedef {{ templateId: string, version: number, variables: Record<string, string | null> }} Binding
 */

/**
 * Id of the collection whose name equals `name` (case-insensitive), or null when none does.
 * @param {string | undefined} name
 * @param {Collection[]} collections
 * @returns {string | null}
 */
export function autoMatchCollection(name, collections) {
    const want = String(name ?? '').trim().toLowerCase();
    if (!want) return null;
    const hit = collections.find(c => String(c.name ?? '').trim().toLowerCase() === want);
    return hit ? hit.id : null;
}

/**
 * [propName, def] for every variable prop of a template.
 * @param {TemplateSchema} template
 */
function variableProps(template) {
    return Object.entries(template.props).filter(([, def]) => def.source === 'variable');
}

/**
 * A new binding: every variable prop auto-matched by collection name.
 * @param {TemplateSchema} template
 * @param {Collection[]} collections
 * @returns {Binding}
 */
export function createBinding(template, collections) {
    /** @type {Record<string, string | null>} */
    const variables = {};
    for (const [prop, def] of variableProps(template)) {
        if (def.source === 'variable') variables[prop] = autoMatchCollection(def.collection, collections);
    }
    return { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables };
}

/**
 * Binding with one variable prop set by hand (null clears it). Only variable props accept a collection.
 * @param {Binding} binding
 * @param {TemplateSchema} template
 * @param {string} prop
 * @param {string | null} collectionId
 * @param {Collection[]} collections
 * @returns {Binding}
 */
export function setVariableBinding(binding, template, prop, collectionId, collections) {
    if (!variableProps(template).some(([name]) => name === prop)) throw new Error(`"${prop}" is not a variable prop of ${template.id}`);
    if (collectionId !== null && !collections.some(c => c.id === collectionId)) throw new Error(`No collection "${collectionId}"`);
    return { ...binding, variables: { ...binding.variables, [prop]: collectionId } };
}

/**
 * The stored binding read against the collections that exist now: a deleted collection reads as unbound.
 * @param {Binding} binding
 * @param {TemplateSchema} template
 * @param {Collection[]} collections
 * @returns {Binding}
 */
export function resolveBinding(binding, template, collections) {
    const ids = new Set(collections.map(c => c.id));
    /** @type {Record<string, string | null>} */
    const variables = {};
    for (const [prop] of variableProps(template)) {
        const id = binding.variables[prop];
        variables[prop] = id && ids.has(id) ? id : null;
    }
    return { ...binding, variables };
}

/**
 * Collections on the canvas that no dimension of this component is bound to. Excluded from preview and code.
 * @param {Binding} binding
 * @param {Collection[]} collections
 * @returns {Collection[]}
 */
export function unusedCollections(binding, collections) {
    const used = new Set(Object.values(binding.variables).filter(Boolean));
    return collections.filter(c => !used.has(c.id));
}
