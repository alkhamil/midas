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

    if (!Array.isArray(schema.states) || !schema.states.length) out.push('states must be a non-empty list');
    const allTokens = isPlainObject(tokens) ? Object.values(tokens).flat() : [];
    if (schema.stateTokens !== undefined) {
        if (!isPlainObject(schema.stateTokens)) out.push('stateTokens must be an object');
        else for (const [state, overrides] of Object.entries(schema.stateTokens)) {
            if (!(Array.isArray(schema.states) && schema.states.includes(state))) out.push(`stateTokens names unknown state "${state}"`);
            if (!isPlainObject(overrides)) { out.push(`stateTokens for "${state}" must be an object`); continue; }
            for (const [base, stateToken] of Object.entries(overrides)) {
                if (!allTokens.includes(base)) out.push(`stateTokens overrides "${base}", which is not a token`);
                if (!allTokens.includes(stateToken)) out.push(`stateTokens maps "${base}" to "${stateToken}", which is not a token`);
            }
        }
    }
    if (!Array.isArray(schema.events)) out.push('events must be a list');
    else for (const ev of schema.events) if (!isPlainObject(ev) || !isName(ev.name) || typeof ev.exposeAsTrigger !== 'boolean') out.push('event needs a name and exposeAsTrigger');

    return out;
}
