import { validateTemplateSchema } from './validate-schema.js';
import { BUTTON } from '../templates/button.js';
import { INPUT } from '../templates/input.js';
import { FORM_ITEM } from '../templates/form-item.js';
import { LIST } from '../templates/list.js';
import { ICON_BUTTON } from '../templates/icon-button.js';
import { CHECKBOX } from '../templates/checkbox.js';
import { SWITCH } from '../templates/switch.js';
import { RADIO } from '../templates/radio.js';
import { PASSWORD } from '../templates/password.js';
import { TEXTAREA } from '../templates/textarea.js';
import { INPUTNUMBER } from '../templates/inputnumber.js';

/**
 * Validate every template and index it by id. An invalid schema throws: the registry never holds a broken template. A slot's `accepts` may
 * name any template of the registry, whatever the order, itself included. A registry is built the same way from the templates of a document.
 * @param {import('../templates/schema.js').TemplateSchema[]} schemas
 * @returns {Map<string, import('../templates/schema.js').TemplateSchema>}
 */
export function createTemplateRegistry(schemas) {
    const byId = new Map();
    const templateIds = new Set(schemas.map(s => s?.id));
    for (const schema of schemas) {
        const problems = validateTemplateSchema(schema, { templateIds });
        if (problems.length) throw new Error(`Invalid template "${schema?.id ?? '?'}": ${problems.join('; ')}`);
        if (byId.has(schema.id)) throw new Error(`Duplicate template id "${schema.id}"`);
        byId.set(schema.id, schema);
    }
    return byId;
}

/** The templates the engine ships. */
export const BUILT_IN_TEMPLATES = createTemplateRegistry([BUTTON, INPUT, FORM_ITEM, LIST, ICON_BUTTON, CHECKBOX, SWITCH, RADIO, PASSWORD, TEXTAREA, INPUTNUMBER]);

/**
 * The registry every engine call reads: the built-in templates and the Custom templates of the open document (see custom-templates.js, which fills it).
 * One Map, so a call site never asks which of the two a template is.
 */
export const TEMPLATES = new Map(BUILT_IN_TEMPLATES);

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
 * The collection name for a template dimension: always "<Template> <Name>", regardless of creation order:
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

