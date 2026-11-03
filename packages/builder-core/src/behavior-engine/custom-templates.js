// Custom templates (pure apart from `activateDocumentTemplates`). A designer pastes a template schema as JSON; it is stored in the document under the one
// Behavior key, `behavior: { version, templates: { [id]: schema } }`, and is document data (saved, undone, copied with the file). The same validator that
// holds the built-in schemas holds it, plus the Custom rules here: its id is `custom-<slug>` and clashes with no built-in or other Custom template.
// A schema is data and never code: it is JSON, and every kind, node property and token role in it is checked by the validator against what the engine knows.
// The registry the engine reads (`TEMPLATES`) is the built-in templates and the open document's; a slot's `accepts` resolves against all of them.
import { BUILT_IN_TEMPLATES, TEMPLATES, createTemplateRegistry } from './registry.js';
import { BEHAVIOR_DATA_VERSION, BehaviorDataError } from './data.js';
import { isPlainObject, validateTemplateSchema } from './validate-schema.js';

const CUSTOM_ID = /^custom-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * The text a designer pasted, parsed. A syntax error or a value that is not an object is a problem to show, not an exception.
 * @param {string} text
 * @returns {{ schema: any } | { problems: string[] }}
 */
export function parseCustomSchema(text) {
    let value;
    try { value = JSON.parse(text); }
    catch (err) { return text.trim() === '' ? { problems: ['schema must be a JSON object'] } : { problems: [`schema is not valid JSON: ${/** @type {Error} */ (err).message}`] }; }
    return isPlainObject(value) ? { schema: value } : { problems: ['schema must be a JSON object'] };
}

/**
 * The problems of one Custom schema: its id, then everything the validator holds a schema to, with `accepts` checked against the built-in templates,
 * the other Custom templates and the schema itself.
 * @param {any} schema
 * @param {{ builtIns: Set<string>, others: Set<string> }} known the built-in template ids, and the ids of the document's other Custom templates
 * @returns {string[]}
 */
export function customSchemaProblems(schema, { builtIns, others }) {
    if (!isPlainObject(schema)) return ['schema must be a JSON object'];
    const out = [];
    const id = schema.id;
    if (typeof id !== 'string' || !CUSTOM_ID.test(id)) out.push(`id "${id}" must be custom- and a lower case slug (letters, digits, single hyphens)`);
    else if (builtIns.has(id)) out.push(`id "${id}" is a built-in template`);
    else if (others.has(id)) out.push(`id "${id}" is already a Custom template`);
    out.push(...validateTemplateSchema(schema, { templateIds: new Set([...builtIns, ...others, ...(typeof id === 'string' ? [id] : [])]) }));
    return out;
}

/**
 * The problems of a document's Behavior key as far as its templates go (the load rules): an object of this build's version holding only `templates`, an
 * object of schemas each stored under its own id and valid. A document with no behavior data has none.
 * @param {unknown} behavior the document's `behavior`, or undefined
 * @returns {string[]}
 */
export function documentTemplateProblems(behavior) {
    if (behavior === undefined) return [];
    if (!isPlainObject(behavior)) return ['behavior must be an object'];
    const out = [];
    if (behavior.version !== BEHAVIOR_DATA_VERSION) out.push(`behavior version ${behavior.version} is not version ${BEHAVIOR_DATA_VERSION}`);
    const extra = Object.keys(behavior).filter(k => k !== 'version' && k !== 'templates');
    if (extra.length) out.push(`unknown field ${extra.join(', ')}`);
    if (!isPlainObject(behavior.templates)) return [...out, 'templates must be an object'];
    const builtIns = new Set(BUILT_IN_TEMPLATES.keys());
    const ids = Object.keys(behavior.templates);
    for (const [key, schema] of Object.entries(behavior.templates)) {
        if (isPlainObject(schema) && schema.id !== key) out.push(`template "${key}" holds a schema with the id "${schema.id}"`);
        for (const problem of customSchemaProblems(schema, { builtIns, others: new Set(ids.filter(other => other !== key)) })) out.push(`template "${key}": ${problem}`);
    }
    return out;
}

/**
 * Makes the registry the built-in templates plus the document's Custom ones (none for a document with no behavior data), replacing the Custom templates
 * of whatever was open before. A malformed document throws a BehaviorDataError and leaves the registry as it was: nothing is partly loaded.
 * @param {unknown} behavior the document's `behavior`, or undefined
 */
export function activateDocumentTemplates(behavior) {
    const problems = documentTemplateProblems(behavior);
    if (problems.length) throw new BehaviorDataError(`Cannot open this file: the custom templates are invalid: ${problems.join('; ')}. This build reads behavior version ${BEHAVIOR_DATA_VERSION}.`);
    const next = createTemplateRegistry([...BUILT_IN_TEMPLATES.values(), ...Object.values(/** @type {any} */ (behavior)?.templates ?? {})]);
    TEMPLATES.clear();
    for (const [id, schema] of next) TEMPLATES.set(id, schema);
}

/**
 * Applying pasted text to a document: the problems (nothing else), or the document's next Behavior key with this schema in it (a schema with an id the
 * document already has replaces it, an edit). An edit is refused while it would remove a prop that instances of the template hold a value for, so no value
 * is lost silently. The document's own Behavior key is not changed.
 * @param {string} text the pasted JSON
 * @param {unknown} behavior the document's `behavior`, or undefined
 * @param {{ templateId: string, props: Record<string, unknown> }[]} instances the instances in the document, with the props each one stores
 * @returns {{ problems: string[], behavior?: undefined, id?: undefined } | { behavior: { version: number, templates: Record<string, any> }, id: string, problems?: undefined }}
 */
export function applyCustomSchema(text, behavior, instances) {
    const parsed = parseCustomSchema(text);
    if ('problems' in parsed) return { problems: parsed.problems };
    const { schema } = parsed;
    const templates = /** @type {Record<string, any>} */ (isPlainObject(behavior) && isPlainObject(behavior.templates) ? behavior.templates : {});
    const others = new Set(Object.keys(templates).filter(id => id !== schema.id));
    const problems = customSchemaProblems(schema, { builtIns: new Set(BUILT_IN_TEMPLATES.keys()), others });
    const previous = templates[schema.id];
    if (previous && isPlainObject(schema.props)) {
        for (const prop of Object.keys(previous.props ?? {})) {
            if (prop in schema.props) continue;
            const holding = instances.filter(i => i.templateId === schema.id && i.props[prop] !== undefined).length;
            if (holding) problems.push(`prop "${prop}" is removed, and ${holding} ${holding === 1 ? 'instance holds' : 'instances hold'} a value for it`);
        }
    }
    if (problems.length) return { problems };
    return { behavior: { version: BEHAVIOR_DATA_VERSION, templates: { ...templates, [schema.id]: schema } }, id: schema.id };
}
