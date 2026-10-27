import { validateTemplateSchema } from './validate-schema.js';
import { BUTTON } from '../templates/button.js';

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
export const TEMPLATES = createTemplateRegistry([BUTTON]);

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

