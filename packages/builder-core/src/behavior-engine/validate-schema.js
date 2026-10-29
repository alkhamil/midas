import { COLOUR_TOKENS, NODE_FIELDS, displayProblems, targetKindOf } from './display.js';

const LITERAL_TYPES = ['boolean', 'string', 'enum', 'iconComponent'];

/** @param {unknown} v */
export const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
/** @param {unknown} v */
const isName = v => typeof v === 'string' && v.trim() !== '';

/**
 * Problems in one prop definition, as messages.
 * @param {string} name
 * @param {any} def
 * @param {Record<string, any>} props
 */
function propProblems(name, def, props) {
    const out = [];
    if (!isPlainObject(def)) return [`prop "${name}" must be an object`];
    if (def.source === 'variable') {
        if (!isName(def.collection)) out.push(`prop "${name}" is variable but names no collection`);
    } else if (def.source === 'literal') {
        if (!LITERAL_TYPES.includes(def.type)) out.push(`prop "${name}" has unknown type "${def.type}"`);
        if (def.type === 'enum') {
            if (!Array.isArray(def.options) || def.options.length === 0) out.push(`prop "${name}" is an enum with no options`);
            else if (!def.options.includes(def.default)) out.push(`prop "${name}" has default "${def.default}" that is not in its options`);
        }
        if (def.type === 'boolean' && typeof def.default !== 'boolean') out.push(`prop "${name}" is boolean but its default is not`);
        if (def.type === 'string' && typeof def.default !== 'string') out.push(`prop "${name}" is string but its default is not`);
    } else {
        out.push(`prop "${name}" has unknown source "${def.source}"`);
    }
    if (def.visibleIf !== undefined) {
        const cond = def.visibleIf;
        const target = isPlainObject(cond) && props[cond.prop];
        if (!target) out.push(`prop "${name}" visibleIf refers to unknown prop "${isPlainObject(cond) ? cond.prop : cond}"`);
        else if (target.source !== 'literal' || !['boolean', 'enum'].includes(target.type)) out.push(`prop "${name}" visibleIf must test a boolean or enum prop, not "${cond.prop}"`);
    }
    return out;
}

/**
 * The variable prop a token group draws from: `fromSize` -> the variable prop named `size` (case-insensitive), or null.
 * @param {string} group
 * @param {Record<string, any>} props
 * @returns {string | null}
 */
export function dimensionOfGroup(group, props) {
    const want = group.slice(4).toLowerCase();
    const hit = Object.entries(props || {}).find(([name, def]) => name.toLowerCase() === want && def?.source === 'variable');
    return hit ? hit[0] : null;
}

/**
 * Problems in a template schema, as messages. An empty list means the schema is valid. Pure: nothing is changed.
 * @param {import('../templates/schema.js').TemplateSchema} schema
 * @returns {string[]}
 */
export function validateTemplateSchema(schema) {
    if (!isPlainObject(schema)) return ['schema must be an object'];
    const out = [];
    if (!isName(schema.id)) out.push('schema has no id');
    if (!isName(schema.name)) out.push('schema has no name');

    const anatomy = Array.isArray(schema.anatomy) ? schema.anatomy : [];
    if (!Array.isArray(schema.anatomy)) out.push('anatomy must be a list');
    const seen = new Set();
    for (const slot of anatomy) {
        if (!isPlainObject(slot) || !isName(slot.id)) { out.push('anatomy slot has no id'); continue; }
        if (seen.has(slot.id)) out.push(`duplicate anatomy slot "${slot.id}"`);
        seen.add(slot.id);
        if (!['text', 'icon'].includes(slot.kind)) out.push(`anatomy slot "${slot.id}" has unknown kind "${slot.kind}"`);
        if (slot.managed && slot.kind !== 'icon') out.push(`anatomy slot "${slot.id}" is managed but not an icon`);
        if (slot.managed && !slot.optional) out.push(`managed anatomy slot "${slot.id}" must be optional`);
    }
    const text = anatomy.filter(s => isPlainObject(s) && s.kind === 'text' && !s.optional);
    if (text.length === 0) out.push('anatomy needs a required text slot');

    const props = isPlainObject(schema.props) ? schema.props : null;
    if (!props) out.push('props must be an object');
    else for (const [name, def] of Object.entries(props)) out.push(...propProblems(name, def, props));

    const tokens = schema.tokens;
    if (!isPlainObject(tokens)) out.push('tokens must be an object');
    else {
        for (const [group, names] of Object.entries(tokens)) {
            if (!group.startsWith('from') || !Array.isArray(names)) { out.push(`tokens group "${group}" must be from<Dimension> with a list of names`); continue; }
            if (!dimensionOfGroup(group, props || {})) out.push(`tokens group "${group}" has no variable prop "${group.slice(4)}"`);
        }
    }

    if (!isName(schema.group)) out.push('schema has no group (the variable name prefix, e.g. "button")');
    const allTokens = isPlainObject(tokens) ? Object.values(tokens).flat() : [];
    out.push(...stateProblems(schema, allTokens, props || {}));
    out.push(...displayProblems(schema));
    out.push(...tokenKindProblems(schema, allTokens));
    out.push(...elementProblems(schema));
    out.push(...iconProblems(schema, allTokens));
    out.push(...nodeProblems(schema));
    if (!Array.isArray(schema.events)) out.push('events must be a list');
    else for (const ev of schema.events) if (!isPlainObject(ev) || !isName(ev.name) || typeof ev.exposeAsTrigger !== 'boolean') out.push('event needs a name and exposeAsTrigger');

    return out;
}

/**
 * Problems in the state declarations: persistent states (a boolean prop and the tokens it replaces) and preview-only states
 * (colour tokens only, replaced by tokens of the template).
 * @param {any} schema
 * @param {string[]} allTokens
 * @param {Record<string, any>} props
 * @returns {string[]}
 */
function stateProblems(schema, allTokens, props) {
    const out = [];
    const persistent = isPlainObject(schema.persistentStates) ? schema.persistentStates : null;
    const preview = isPlainObject(schema.previewStates) ? schema.previewStates : null;
    if (!persistent) out.push('persistentStates must be an object');
    if (!preview) out.push('previewStates must be an object');
    for (const [state, def] of Object.entries(persistent || {})) {
        if (!isPlainObject(def)) { out.push(`persistent state "${state}" must be an object`); continue; }
        const prop = props[def.prop];
        if (!prop || prop.source !== 'literal' || prop.type !== 'boolean') out.push(`persistent state "${state}" needs a boolean prop, not "${def.prop}"`);
        if (!isPlainObject(def.tokens)) { out.push(`persistent state "${state}" must name its tokens`); continue; }
        for (const [base, stateToken] of Object.entries(def.tokens)) {
            if (!allTokens.includes(base)) out.push(`persistent state "${state}" overrides "${base}", which is not a token`);
            if (!allTokens.includes(/** @type {string} */ (stateToken))) out.push(`persistent state "${state}" maps "${base}" to "${stateToken}", which is not a token`);
        }
    }
    for (const [state, overrides] of Object.entries(preview || {})) {
        if (state in (persistent || {})) out.push(`state "${state}" is declared as both persistent and preview-only`);
        if (!isPlainObject(overrides)) { out.push(`preview state "${state}" must be an object`); continue; }
        for (const [base, stateToken] of Object.entries(overrides)) {
            if (!COLOUR_TOKENS.includes(base)) out.push(`preview state "${state}" changes "${base}", but preview states change colours only (${COLOUR_TOKENS.join(', ')})`);
            if (!allTokens.includes(/** @type {string} */ (stateToken))) out.push(`preview state "${state}" maps "${base}" to "${stateToken}", which is not a token`);
        }
    }
    return out;
}

/**
 * Problems in the kind of each token: every token of the template has a kind the resolver knows.
 * @param {any} schema
 * @param {string[]} allTokens
 * @returns {string[]}
 */
function tokenKindProblems(schema, allTokens) {
    const kinds = isPlainObject(schema.tokenKinds) ? schema.tokenKinds : {};
    return allTokens.filter(t => !['length', 'ratio', 'color'].includes(kinds[t])).map(t => `token "${t}" has no kind (length, ratio or color)`);
}

/**
 * Problems in the element a component is written as: its tag, its attributes, the persistent state that disables it, and the props
 * that stop onClick (boolean literal props).
 * @param {any} schema
 * @returns {string[]}
 */
function elementProblems(schema) {
    const el = schema.element;
    if (!isPlainObject(el)) return ['schema has no element'];
    const out = [];
    if (!isName(el.tag)) out.push('element has no tag');
    if (!isPlainObject(el.attrs)) out.push('element attrs must be an object');
    if (!isPlainObject(schema.persistentStates) || !(el.disabledState in schema.persistentStates)) out.push(`element disabledState "${el.disabledState}" is not a persistent state`);
    if (!Array.isArray(el.blockClickProps)) out.push('element blockClickProps must be a list');
    else for (const prop of el.blockClickProps) {
        const def = isPlainObject(schema.props) ? schema.props[prop] : undefined;
        if (!def || def.source !== 'literal' || def.type !== 'boolean') out.push(`element blockClickProps names "${prop}", which is not a boolean prop`);
    }
    return out;
}

/**
 * Problems in the managed icon slot: its show, placement and component props, its colour and size tokens, and the anatomy slot each
 * placement value maps to (a managed icon slot).
 * @param {any} schema
 * @param {string[]} allTokens
 * @returns {string[]}
 */
function iconProblems(schema, allTokens) {
    const icon = schema.icon;
    if (!isPlainObject(icon)) return ['schema has no icon slot'];
    const props = isPlainObject(schema.props) ? schema.props : {};
    const out = [];
    const show = props[icon.show], placement = props[icon.placement], component = props[icon.component];
    if (!show || show.source !== 'literal' || show.type !== 'boolean') out.push(`icon show "${icon.show}" is not a boolean prop`);
    if (!placement || placement.source !== 'literal' || placement.type !== 'enum') out.push(`icon placement "${icon.placement}" is not an enum prop`);
    if (!component || component.source !== 'literal' || component.type !== 'iconComponent') out.push(`icon component "${icon.component}" is not an icon prop`);
    if (placement && placement.type === 'enum') {
        if (!isPlainObject(placement.slots)) out.push(`icon placement "${icon.placement}" has no slots`);
        else {
            const managed = (Array.isArray(schema.anatomy) ? schema.anatomy : []).filter(s => isPlainObject(s) && s.managed).map(s => s.id);
            for (const option of placement.options) {
                if (!managed.includes(placement.slots[option])) out.push(`icon placement "${option}" maps to "${placement.slots[option]}", which is not a managed anatomy slot`);
            }
        }
    }
    if (placement && placement.type === 'enum') {
        for (const value of placement.iconOnly ?? []) if (!placement.options.includes(value)) out.push(`icon-only placement "${value}" is not an option of "${icon.placement}"`);
    }
    for (const role of ['colour', 'disabledColour', 'size']) {
        if (!allTokens.includes(icon.tokens?.[role])) out.push(`icon ${role} token "${icon.tokens?.[role]}" is not a token`);
    }
    return out;
}

/**
 * Problems in the node a literal prop writes: the node must be root or an anatomy slot, the field must be one that node kind takes,
 * and the prop type must match the field (see NODE_FIELDS in display.js). Also every persistent and preview state has a pseudo-class.
 * @param {any} schema
 * @returns {string[]}
 */
function nodeProblems(schema) {
    const out = [];
    for (const [name, def] of Object.entries(isPlainObject(schema.props) ? schema.props : {})) {
        if (!isPlainObject(def) || !def.node) continue;
        const kind = targetKindOf(schema, def.node.key);
        if (!kind) { out.push(`prop "${name}" writes "${def.node.key}", which is not root or an anatomy slot`); continue; }
        const field = NODE_FIELDS[kind]?.[def.node.field];
        if (!field) { out.push(`prop "${name}" writes "${def.node.field}", which a ${kind} does not take`); continue; }
        if (def.type !== field.kind) out.push(`prop "${name}" is ${def.type} but writes "${def.node.field}", which takes ${field.kind}`);
    }
    const states = [...Object.keys(isPlainObject(schema.persistentStates) ? schema.persistentStates : {}), ...Object.keys(isPlainObject(schema.previewStates) ? schema.previewStates : {})];
    const pseudo = isPlainObject(schema.statePseudo) ? schema.statePseudo : {};
    for (const state of states) if (!String(pseudo[state] ?? '').startsWith(':')) out.push(`state "${state}" has no pseudo-class in statePseudo`);
    return out;
}
