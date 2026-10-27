// Binding model (stage 2): a master component -> templateId, and each variable prop -> a variable collection.
// Persisted on the master as `behavior: { version, templateId, variables }`. Unused collections are derived, never stored.
import { BEHAVIOR_DATA_VERSION } from './data.js';
import { variableProps } from './registry.js';

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
    const want = String(name ?? '').toLowerCase();
    if (!want) return null;
    const hit = collections.find(c => String(c.name ?? '').toLowerCase() === want);
    return hit ? hit.id : null;
}

/**
 * A new binding: every variable prop auto-matched by collection name.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Collection[]} collections
 * @returns {Binding}
 */
export function createBinding(template, collections) {
    /** @type {Record<string, string | null>} */
    const variables = {};
    for (const [prop, def] of variableProps(template)) variables[prop] = autoMatchCollection(def.collection, collections);
    return { version: BEHAVIOR_DATA_VERSION, templateId: template.id, variables };
}

/**
 * Binding with one variable prop set by hand (null clears it). Only variable props accept a collection.
 * @param {Binding} binding
 * @param {import('../templates/schema.js').TemplateSchema} template
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

