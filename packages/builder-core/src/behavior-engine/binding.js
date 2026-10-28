// Binding model (stage 2): a master component -> templateId, and each variable prop -> a variable collection.
// Persisted on the master as `behavior: { version, templateId, variables }`. Unused collections are derived, never stored.
import { BEHAVIOR_DATA_VERSION } from './data.js';
import { TEMPLATES, variableProps } from './registry.js';

/**
 * @typedef {{ id: string, name: string, modes?: { id: string, name: string }[] }} Collection
 * @typedef {{ templateId: string, version: number, variables: Record<string, string | null> }} Binding
 */

/** The name a collection is matched by: case-insensitive, surrounding spaces ignored. */
const nameKey = name => String(name ?? '').trim().toLowerCase();

/**
 * Id of the one collection whose name equals `name` (case-insensitive, spaces ignored), or null when none or more than one
 * does. Two collections with the same name are a guess, so neither is chosen.
 * @param {string | undefined} name
 * @param {Collection[]} collections
 * @returns {string | null}
 */
export function autoMatchCollection(name, collections) {
    const want = nameKey(name);
    if (!want) return null;
    const hits = collections.filter(c => nameKey(c.name) === want);
    return hits.length === 1 ? hits[0].id : null;
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

/**
 * The bindings auto-match would change now: every variable slot that has no collection (null) and whose collection name
 * matches exactly one collection. A slot with a binding is never changed. Masters without a binding are skipped.
 * @param {{ behavior?: any }[]} masters
 * @param {Collection[]} collections
 * @returns {{ node: { behavior?: any }, variables: Record<string, string> }[]}
 */
export function planAutoMatch(masters, collections) {
    const out = [];
    for (const node of masters) {
        const binding = node.behavior;
        if (!binding || !('templateId' in binding)) continue;
        const template = TEMPLATES.get(binding.templateId);
        if (!template) continue;
        /** @type {Record<string, string>} */
        const variables = {};
        for (const [prop, def] of variableProps(template)) {
            if (binding.variables[prop] !== null) continue;
            const id = autoMatchCollection(def.collection, collections);
            if (id !== null) variables[prop] = id;
        }
        if (Object.keys(variables).length) out.push({ node, variables });
    }
    return out;
}
