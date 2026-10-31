import { validateTemplateSchema } from './validate-schema.js';
import { BUTTON } from '../templates/button.js';
import { INPUT } from '../templates/input.js';

/**
 * Validate every template and index it by id. An invalid schema throws: the registry never holds a broken template.
 * @param {import('../templates/schema.js').TemplateSchema[]} schemas
 * @returns {Map<string, import('../templates/schema.js').TemplateSchema>}
 */
function createTemplateRegistry(schemas) {
    const byId = new Map();
    for (const schema of schemas) {
        const problems = validateTemplateSchema(schema);
        if (problems.length) throw new Error(`Invalid template "${schema?.id ?? '?'}": ${problems.join('; ')}`);
        if (byId.has(schema.id)) throw new Error(`Duplicate template id "${schema.id}"`);
        byId.set(schema.id, schema);
    }
    return byId;
}

/** Every template the engine ships. Button is the only one until the pipeline works end to end. */
export const TEMPLATES = createTemplateRegistry([BUTTON, INPUT]);

/**
 * Whether two mode lists name the same modes: same count, matched case-insensitively, in any order.
 * Entries may be mode names or `{ name }` mode objects.
 * @param {(string | { name: string })[]} a
 * @param {(string | { name: string })[]} b
 */
export function sameModes(a, b) {
    const keys = list => list.map(m => String(typeof m === 'string' ? m : m?.name ?? '').trim().toLowerCase());
    const ka = keys(a), kb = keys(b);
    return ka.length === kb.length && kb.every(k => ka.includes(k));
}

/**
 * The collection a template owns for a dimension when the schema-named one serves another template:
 * "<Template> <Name>" (e.g. "Input Variant"). Schema data (the template name and the declared collection),
 * never a guess.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {import('../templates/schema.js').VariableProp} def
 */
export function fallbackCollection(template, def) {
    return `${template.name} ${def.collection}`;
}

/**
 * [propName, def] for every variable prop of a template (the dimensions a binding may name).
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {[string, import('../templates/schema.js').VariableProp][]}
 */
export function variableProps(template) {
    /** @type {[string, import('../templates/schema.js').VariableProp][]} */
    const out = [];
    for (const [name, def] of Object.entries(template.props)) if (def.source === 'variable') out.push([name, def]);
    return out;
}

