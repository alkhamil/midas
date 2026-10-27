// Instance props store (stage 3): an instance holds only its own prop values, stored sparsely as
// `behavior: { version, props }`. A variable prop stores the selected mode id; a literal prop stores its value.
// Unset props fall back to the schema default. A prop hidden by visibleIf keeps no stored value.
import { BEHAVIOR_DATA_VERSION } from './data.js';
/** @typedef {import('../templates/schema.js').PropDef} PropDef */
/** @typedef {Record<string, string | boolean | null>} StoredProps */

/**
 * Whether `name` is shown, given the values of the props it depends on. A prop with no visibleIf is always shown.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} name
 * @param {Record<string, unknown>} values
 */
export function isPropVisible(template, name, values) {
    const cond = template.props[name].visibleIf;
    return !cond || values[cond.prop] === cond.is;
}

/** @param {PropDef} def */
const defaultOf = def => (def.source === 'literal' ? def.default : null);

/**
 * Every prop's value: the stored one when the prop is visible and set, else the schema default.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {StoredProps} [stored]
 */
export function resolveProps(template, stored = {}) {
    /** @type {Record<string, unknown>} */
    const base = {};
    for (const [name, def] of Object.entries(template.props)) base[name] = stored[name] !== undefined ? stored[name] : defaultOf(def);
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [name, def] of Object.entries(template.props)) {
        out[name] = isPropVisible(template, name, base) && stored[name] !== undefined ? stored[name] : defaultOf(def);
    }
    return out;
}

/**
 * The stored props without the values of props that are hidden now.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {StoredProps} stored
 * @returns {StoredProps}
 */
function pruneHidden(template, stored) {
    const values = resolveProps(template, stored);
    /** @type {StoredProps} */
    const out = {};
    for (const [name, value] of Object.entries(stored)) {
        if (template.props[name] && isPropVisible(template, name, values)) out[name] = value;
    }
    return out;
}

/**
 * Why a value cannot be stored for this prop, or null when it can. A variable prop stores a mode id or null; the
 * mode itself is checked against its collection elsewhere.
 * @param {PropDef} def
 * @param {unknown} value
 * @returns {string | null}
 */
export function valueProblem(def, value) {
    if (def.source === 'variable') return value === null || typeof value === 'string' ? null : 'a variable prop stores a mode id or null';
    if (def.type === 'boolean' && typeof value !== 'boolean') return 'expects a boolean';
    if (def.type === 'string' && typeof value !== 'string') return 'expects text';
    if (def.type === 'enum' && !def.options.includes(/** @type {string} */ (value))) return `expects one of ${def.options.join(', ')}`;
    if (def.type === 'iconComponent' && value !== null && typeof value !== 'string') return 'expects an icon id or null';
    return null;
}

/**
 * Store one prop value. Refused when the prop is unknown, hidden right now, or the value has the wrong type.
 * `value === undefined` unsets the prop, even when it is hidden. Returns a new stored object; the input is not changed.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {StoredProps} stored
 * @param {string} name
 * @param {string | boolean | null | undefined} value
 * @returns {StoredProps}
 */
export function setInstanceProp(template, stored, name, value) {
    const def = template.props[name];
    if (!def) throw new Error(`Unknown prop "${name}" on ${template.id}`);
    /** @type {StoredProps} */
    const next = { ...stored };
    if (value === undefined) delete next[name];
    else {
        if (!isPropVisible(template, name, resolveProps(template, stored))) throw new Error(`Prop "${name}" is hidden by visibleIf`);
        const problem = valueProblem(def, value);
        if (problem) throw new Error(`Prop "${name}" on ${template.id}: ${problem}`);
        next[name] = value;
    }
    return pruneHidden(template, next);
}

/**
 * Gives a copy the behavior data it gets when it is placed. The binding stays on the master: a copy that is an instance
 * gets an empty props store (or keeps its own props when copied from an instance), a plain layer inside an instance gets none.
 * @param {{ isInstance?: boolean, behavior?: any }} copy the node being placed; changed in place
 * @param {{ behavior?: any }} src the node it was copied from
 * @returns {{ isInstance?: boolean, behavior?: any }}
 */
export function withInstanceBehavior(copy, src) {
    if (!copy.isInstance || src.behavior === undefined) delete copy.behavior;
    else copy.behavior = 'templateId' in src.behavior ? { version: BEHAVIOR_DATA_VERSION, props: {} } : structuredClone(src.behavior);
    return copy;
}
