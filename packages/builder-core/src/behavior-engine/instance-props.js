// Instance props store (stage 3): an instance holds only its own literal prop values, stored sparsely as `behavior: { version, props }`.
// Variable props (variant, size) are not stored here: an instance's mode is its Appearance mode for the bound collection (`varModes`).
// Unset props fall back to the schema default. A prop hidden by visibleIf keeps no stored value, except a `remembered` prop: its
// value (an icon, a text) survives while its switch is off, so it is there again when the switch is turned back on.
import { BEHAVIOR_DATA_VERSION } from './data.js';
import { conditionHolds } from './display.js';
/** @typedef {import('../templates/schema.js').PropDef} PropDef */
/** @typedef {Record<string, string | boolean | null>} StoredProps */

/**
 * Whether `name` is shown, given the values of the props it depends on: its `visibleIf` is one test (`{ prop, is }`) or every test of
 * an `{ all: [...] }`. A prop with no visibleIf is always shown.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} name
 * @param {Record<string, unknown>} values
 */
export function isPropVisible(template, name, values) {
    const cond = template.props[name].visibleIf;
    return !cond || conditionHolds(cond, values);
}

/**
 * Every literal prop's value: the stored one when the prop is visible and set, else the schema default. Variable props are not
 * in the result.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {StoredProps} [stored]
 */
export function resolveProps(template, stored = {}) {
    const literal = Object.entries(template.props).filter(([, def]) => def.source === 'literal');
    /** @type {Record<string, unknown>} */
    const base = {};
    for (const [name, def] of literal) base[name] = stored[name] !== undefined ? stored[name] : /** @type {any} */ (def).default;
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [name, def] of literal) {
        out[name] = isPropVisible(template, name, base) && stored[name] !== undefined ? stored[name] : /** @type {any} */ (def).default;
    }
    // A derived boolean is read from the others, never stored: it holds while the value has reached its limit (an empty value or no limit reaches nothing).
    for (const [name, def] of literal) {
        const rule = /** @type {any} */ (def).derived;
        if (rule === undefined) continue;
        // A condition over the other props (InputNumber has no stepper while its controls are off).
        if (rule.when !== undefined) { out[name] = conditionHolds(rule.when, out); continue; }
        const value = out[rule.value] === '' || out[rule.value] == null ? NaN : Number(out[rule.value]), limit = out[rule.limit];
        out[name] = limit != null && Number.isFinite(value) && (rule.cmp === 'gte' ? value >= limit : value <= limit);
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
        if (template.props[name] && (isPropVisible(template, name, values) || template.props[name].remembered === true)) out[name] = value;
    }
    return out;
}

/**
 * Why a value cannot be stored for this prop, or null when it can.
 * @param {PropDef} def
 * @param {unknown} value
 * @returns {string | null}
 */
export function valueProblem(def, value) {
    if (def.source === 'variable') return 'variable props are not stored in behavior data: an instance\'s mode is its Appearance mode';
    if (def.type === 'boolean' && typeof value !== 'boolean') return 'expects a boolean';
    if (def.type === 'string' && typeof value !== 'string') return 'expects text';
    if (def.type === 'enum' && !def.options.includes(/** @type {string} */ (value))) return `expects one of ${def.options.join(', ')}`;
    if (def.type === 'number' && /** @type {any} */ (def).decimal === true && value !== null && !(typeof value === 'number' && Number.isFinite(value))) return 'expects a number, or nothing';
    if (def.type === 'number' && /** @type {any} */ (def).decimal !== true && value !== null && !(Number.isInteger(value) && value >= 0)) return 'expects a whole number, 0 or more, or nothing';
    if (def.type === 'iconComponent' && value !== null && typeof value !== 'string') return 'expects an icon id or null';
    return null;
}

/**
 * Store one prop value. Refused when the prop is unknown, a variable prop, hidden right now, or the value has the wrong type.
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
        if (def.source === 'variable') throw new Error(`Prop "${name}" is an Appearance mode, not a behavior prop`);
        if (/** @type {any} */ (def).derived !== undefined) throw new Error(`Prop "${name}" on ${template.id} is derived from other props, not stored`);
        if (!isPropVisible(template, name, resolveProps(template, stored))) throw new Error(`Prop "${name}" is hidden by visibleIf`);
        const problem = valueProblem(def, value);
        if (problem) throw new Error(`Prop "${name}" on ${template.id}: ${problem}`);
        next[name] = value;
        // A prop that names an `atMost` bound (minLength, at most maxLength) is refused when the pair is out of order.
        const values = resolveProps(template, next);
        for (const [low, lowDef] of Object.entries(template.props)) {
            if (lowDef.atMost === undefined || values[low] == null || values[lowDef.atMost] == null) continue;
            if (values[low] > values[lowDef.atMost]) throw new Error(`Prop "${low}" on ${template.id} is more than "${lowDef.atMost}"`);
        }
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
    // A template layer's marker (its part, slot, text or group) goes with its copy: Play and the canvas find the layer by it (instanceOf makes the same copy).
    if (src.behavior && ('part' in src.behavior || 'slot' in src.behavior || 'text' in src.behavior || 'group' in src.behavior)) {
        copy.behavior = structuredClone(src.behavior);
        return copy;
    }
    if (!copy.isInstance || src.behavior === undefined) delete copy.behavior;
    else copy.behavior = 'templateId' in src.behavior ? { version: BEHAVIOR_DATA_VERSION, props: {} } : structuredClone(src.behavior);
    return copy;
}
