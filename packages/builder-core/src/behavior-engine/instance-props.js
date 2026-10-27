// Instance props store (stage 3): an instance holds only its own prop values, stored sparsely as
// `behavior: { version, props }`. A variable prop stores the selected mode id; a literal prop stores its value.
// Unset props fall back to the schema default. A prop hidden by visibleIf keeps no stored value.
/** @typedef {import('../templates/schema.js').TemplateSchema} TemplateSchema */
/** @typedef {import('../templates/schema.js').PropDef} PropDef */
/** @typedef {Record<string, string | boolean | null>} StoredProps */

/**
 * Whether `name` is shown, given the values of the props it depends on. A prop with no visibleIf is always shown.
 * @param {TemplateSchema} template
 * @param {string} name
 * @param {Record<string, unknown>} values
 */
function isPropVisible(template, name, values) {
    const cond = template.props[name].visibleIf;
    return !cond || values[cond.prop] === cond.is;
}

/** @param {PropDef} def */
const defaultOf = def => (def.source === 'literal' ? def.default : null);

/**
 * Every prop's value: the stored one when the prop is visible and set, else the schema default.
 * @param {TemplateSchema} template
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
 * @param {TemplateSchema} template
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
 * @param {TemplateSchema} template
 * @param {string} name
 * @param {PropDef} def
 * @param {unknown} value
 */
function checkValue(template, name, def, value) {
    /** @param {string} msg */
    const bad = msg => new Error(`Prop "${name}" on ${template.id}: ${msg}`);
    if (def.source === 'variable') {
        if (value !== null && typeof value !== 'string') throw bad('a variable prop stores a mode id or null');
        return;
    }
    if (def.type === 'boolean' && typeof value !== 'boolean') throw bad('expects a boolean');
    if (def.type === 'string' && typeof value !== 'string') throw bad('expects text');
    if (def.type === 'enum' && !def.options.includes(/** @type {string} */ (value))) throw bad(`expects one of ${def.options.join(', ')}`);
    if (def.type === 'iconComponent' && value !== null && typeof value !== 'string') throw bad('expects an icon id or null');
}

/**
 * Store one prop value. Refused when the prop is unknown, hidden right now, or the value has the wrong type.
 * `value === undefined` unsets the prop. Returns a new stored object; the input is not changed.
 * @param {TemplateSchema} template
 * @param {StoredProps} stored
 * @param {string} name
 * @param {string | boolean | null | undefined} value
 * @returns {StoredProps}
 */
export function setInstanceProp(template, stored, name, value) {
    const def = template.props[name];
    if (!def) throw new Error(`Unknown prop "${name}" on ${template.id}`);
    if (!isPropVisible(template, name, resolveProps(template, stored))) throw new Error(`Prop "${name}" is hidden by visibleIf`);
    /** @type {StoredProps} */
    const next = { ...stored };
    if (value === undefined) delete next[name];
    else {
        checkValue(template, name, def, value);
        next[name] = value;
    }
    return pruneHidden(template, next);
}
