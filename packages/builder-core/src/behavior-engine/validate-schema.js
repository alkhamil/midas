import { COLOUR_TOKENS, NODE_FIELDS, displayProblems, targetKindOf } from './display.js';

const LITERAL_TYPES = ['boolean', 'string', 'number', 'enum', 'iconComponent'];

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
        if (def.modes !== undefined && (!Array.isArray(def.modes) || def.modes.length === 0 || !def.modes.every(isName))) out.push(`prop "${name}" modes must be a non-empty list of mode names`);
        for (const [mode, rule] of Object.entries(def.styles ?? {})) {
            if (!['solid', 'dashed', 'dotted'].includes(rule?.borderStyle)) out.push(`prop "${name}" style for mode "${mode}" has no border style (solid, dashed or dotted)`);
        }
    } else if (def.source === 'literal') {
        if (!LITERAL_TYPES.includes(def.type)) out.push(`prop "${name}" has unknown type "${def.type}"`);
        if (def.type === 'enum') {
            if (!Array.isArray(def.options) || def.options.length === 0) out.push(`prop "${name}" is an enum with no options`);
            else if (!def.options.includes(def.default)) out.push(`prop "${name}" has default "${def.default}" that is not in its options`);
        }
        if (def.type === 'boolean' && typeof def.default !== 'boolean') out.push(`prop "${name}" is boolean but its default is not`);
        if (def.exclusiveWith !== undefined && (def.type !== 'boolean' || !isPlainObject(props[def.exclusiveWith]) || props[def.exclusiveWith].type !== 'boolean' || props[def.exclusiveWith].source !== 'literal')) out.push(`prop "${name}" exclusiveWith must name a boolean literal prop`);
        if (def.fillEmpty !== undefined && (def.type !== 'boolean' || !isPlainObject(def.fillEmpty) || !isPlainObject(props[def.fillEmpty.prop]) || props[def.fillEmpty.prop].source !== 'literal' || props[def.fillEmpty.prop].type !== 'string' || typeof def.fillEmpty.text !== 'string')) out.push(`prop "${name}" fillEmpty must name a literal string prop and its fallback text`);
        if (def.type === 'string' && typeof def.default !== 'string') out.push(`prop "${name}" is string but its default is not`);
        if (def.type === 'number' && !(def.default === null || (Number.isInteger(def.default) && def.default >= 0))) out.push(`prop "${name}" is a number but its default is not a whole number, 0 or more, or null`);
        if (def.defaultMode !== undefined && !(Array.isArray(def.modes) && def.modes.includes(def.defaultMode))) out.push(`prop "${name}" defaultMode "${def.defaultMode}" is not one of its modes`);
        if (def.atMost !== undefined && (def.type !== 'number' || props[def.atMost]?.type !== 'number')) out.push(`prop "${name}" atMost must name a number prop`);
    } else {
        out.push(`prop "${name}" has unknown source "${def.source}"`);
    }
    if (def.requires !== undefined) {
        if (!Array.isArray(def.requires)) out.push(`prop "${name}" requires must be a list of dimensions`);
        else for (const dim of def.requires) {
            const target = isPlainObject(props[dim]) && props[dim];
            if (!target || target.source !== 'variable') out.push(`prop "${name}" requires "${dim}", which is not a variable prop`);
        }
    }
    if (def.visibleIf !== undefined) out.push(...conditionProblems(def.visibleIf, props, `prop "${name}" visibleIf`));
    if (def.control !== undefined) {
        if (def.control !== 'segmented') out.push(`prop "${name}" control "${def.control}" is not segmented`);
        else if (def.type !== 'enum') out.push(`prop "${name}" control "segmented" needs an enum prop`);
        else if (!Array.isArray(def.options) || def.options.length < 2 || def.options.length > 3) out.push(`prop "${name}" control "segmented" takes 2 to 3 options`);
    }
    // A remembered prop keeps its value while a switch hides it, so it only means something on a prop that a visibleIf hides.
    if (def.remembered !== undefined) {
        if (typeof def.remembered !== 'boolean') out.push(`prop "${name}" remembered must be a boolean`);
        else if (def.remembered && def.visibleIf === undefined) out.push(`prop "${name}" is remembered but has no visibleIf: only a prop a switch hides is remembered`);
    }
    return out;
}

/**
 * Problems in a condition (a `shownWhen` on an anatomy slot): `all` is a non-empty list of conditions; a test names a literal prop
 * that exists, with `is` on a boolean or enum prop, or `empty` (a boolean) on a string prop.
 * @param {any} cond
 * @param {Record<string, any>} props
 * @param {string} where names the condition in the messages
 * @returns {string[]}
 */
function conditionProblems(cond, props, where) {
    if (!isPlainObject(cond)) return [`${where} must be an object`];
    if ('all' in cond) {
        if (!Array.isArray(cond.all) || cond.all.length === 0) return [`${where} "all" must be a non-empty list of conditions`];
        return cond.all.flatMap(c => conditionProblems(c, props, where));
    }
    if ('any' in cond) {
        if (!Array.isArray(cond.any) || cond.any.length === 0) return [`${where} "any" must be a non-empty list of conditions`];
        return cond.any.flatMap(c => conditionProblems(c, props, where));
    }
    const target = isPlainObject(props[cond.prop]) ? props[cond.prop] : null;
    if (!target) return [`${where} refers to unknown prop "${cond.prop}"`];
    if (target.source !== 'literal') return [`${where} tests "${cond.prop}", which is not a literal prop`];
    if ('is' in cond) return ['boolean', 'enum'].includes(target.type) ? [] : [`${where} tests "${cond.prop}" with "is", which needs a boolean or enum prop`];
    if ('empty' in cond) return typeof cond.empty === 'boolean' && target.type === 'string' ? [] : [`${where} tests "${cond.prop}" with "empty", which needs a string prop and a boolean`];
    return [`${where} has neither "is" nor "empty"`];
}

/**
 * Problems in the `shownWhen` of the anatomy slots: only a text slot has one, and its condition must hold on the template's props.
 * @param {any} schema
 * @param {Record<string, any>} props
 * @returns {string[]}
 */
function shownWhenProblems(schema, props) {
    const out = [];
    for (const slot of Array.isArray(schema.anatomy) ? schema.anatomy : []) {
        if (!isPlainObject(slot) || slot.shownWhen === undefined) continue;
        if (slot.kind !== 'text' && slot.kind !== 'control') out.push(`anatomy slot "${slot.id}" has shownWhen but is not a text slot`);
        out.push(...conditionProblems(slot.shownWhen, props, `anatomy slot "${slot.id}" shownWhen`));
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
 * @param {{ templateIds?: Set<string> }} [context] the ids of the templates the schema lives among: a slot's `accepts` must name one of them.
 *   Without it (a schema checked on its own) the ids are not checked.
 * @returns {string[]}
 */
export function validateTemplateSchema(schema, { templateIds } = {}) {
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
        if (!['text', 'control', 'icon', 'frame'].includes(slot.kind)) out.push(`anatomy slot "${slot.id}" has unknown kind "${slot.kind}"`);
        if (slot.kind === 'frame') {
            if (slot.layout !== 'horizontal' && slot.layout !== 'vertical') out.push(`frame slot "${slot.id}" layout must be horizontal or vertical`);
            if (slot.optional || slot.managed) out.push(`frame slot "${slot.id}" cannot be optional or managed`);
            if (!anatomy.some(c => isPlainObject(c) && c.parent === slot.id)) out.push(`frame slot "${slot.id}" holds no slot`);
        }
        if (slot.parent !== undefined) {
            const holder = anatomy.find(c => isPlainObject(c) && c.id === slot.parent);
            if (!holder || holder.kind !== 'frame') out.push(`anatomy slot "${slot.id}" has the parent "${slot.parent}", which is not a frame slot`);
            else if (slot.kind === 'frame') out.push(`frame slot "${slot.id}" cannot sit inside another frame slot`);
        }
        if (slot.managed && !['icon', 'text', 'control'].includes(slot.kind)) out.push(`anatomy slot "${slot.id}" is managed but not an icon, text or control slot`);
        // A managed text or control layer is made and removed from the props: the schema says when its instance layer is wanted.
        if (slot.managed && slot.kind !== 'icon' && slot.shownWhen === undefined) out.push(`managed ${slot.kind} slot "${slot.id}" needs a shownWhen`);
        // An always visible icon slot is on every instance: it has no switch, so it is the one managed slot that is not optional.
        if (slot.alwaysVisible !== undefined && typeof slot.alwaysVisible !== 'boolean') out.push(`anatomy slot "${slot.id}" alwaysVisible must be true or false`);
        if (slot.alwaysVisible === true) {
            if (!(slot.kind === 'icon' && slot.managed)) out.push(`anatomy slot "${slot.id}" alwaysVisible needs a managed icon slot`);
            if (slot.optional) out.push(`alwaysVisible slot "${slot.id}" cannot be optional`);
        }
        else if (slot.managed && !slot.optional) out.push(`managed anatomy slot "${slot.id}" must be optional`);
    }
    const text = anatomy.filter(s => isPlainObject(s) && (s.kind === 'text' || s.kind === 'control') && (!s.optional || s.id === schema.primarySlot));
    const shown = anatomy.filter(s => isPlainObject(s) && s.alwaysVisible === true && s.kind === 'icon' && s.managed);
    if (text.length === 0 && shown.length === 0 && !(Array.isArray(schema.slots) && schema.slots.length > 0)) out.push('anatomy needs a required text or control slot, an always visible icon slot, or a content slot');

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

    const allTokens = isPlainObject(tokens) ? Object.values(tokens).flat() : [];
    out.push(...stateProblems(schema, allTokens, props || {}));
    out.push(...displayProblems(schema));
    out.push(...tokenKindProblems(schema, allTokens));
    out.push(...tokenRoleProblems(schema, allTokens));
    out.push(...elementProblems(schema));
    if (schema.rootLayout !== undefined && !['horizontal', 'vertical'].includes(schema.rootLayout)) out.push(`rootLayout "${schema.rootLayout}" must be horizontal or vertical`);
    if (schema.rootPrimaryAlign !== undefined && !['start', 'center', 'end'].includes(schema.rootPrimaryAlign)) out.push(`rootPrimaryAlign "${schema.rootPrimaryAlign}" must be start, center or end`);
    if (schema.rootWidth !== undefined && !(typeof schema.rootWidth === 'number' && Number.isFinite(schema.rootWidth) && schema.rootWidth > 0)) out.push('rootWidth must be a positive number of px');
    if (schema.rootAlign !== undefined && !['start', 'center', 'end'].includes(schema.rootAlign)) out.push(`rootAlign "${schema.rootAlign}" must be start, center or end`);
    out.push(...iconProblems(schema, allTokens));
    out.push(...partTokenProblems(schema, allTokens));
    out.push(...slotProblems(schema, templateIds));
    out.push(...controlProblems(schema));
    out.push(...primarySlotProblems(schema));
    out.push(...shownWhenProblems(schema, props || {}));
    out.push(...focusTargetProblems(schema));
    out.push(...interactionProblems(schema));
    out.push(...nodeProblems(schema));
    out.push(...outlineProblems(schema));
    if (!Array.isArray(schema.events)) out.push('events must be a list');
    else for (const ev of schema.events) if (!isPlainObject(ev) || !isName(ev.name) || typeof ev.exposeAsTrigger !== 'boolean') out.push('event needs a name and exposeAsTrigger');

    return out;
}

/**
 * Problems in the token roles: every key is a token, every value a role or a per-mode role map. A value with
 * a slash is a reference to another token variable of the same template (`<group>/<token>`).
 * @param {string[]} allTokens
 */
function tokenRoleProblems(schema, allTokens) {
    const roles = schema.tokenRoles;
    if (roles === undefined) return [];
    if (!isPlainObject(roles)) return ['tokenRoles must be an object'];
    const out = [];
    const refOf = v => (typeof v === 'string' && v.startsWith('./')) ? v : null;
    for (const [token, entry] of Object.entries(roles)) {
        if (!allTokens.includes(token)) { out.push(`tokenRoles names "${token}", which is not a token`); continue; }
        const values = typeof entry === 'string' ? [entry] : isPlainObject(entry) ? Object.values(entry) : null;
        if (!values || !values.every(isName)) { out.push(`tokenRoles["${token}"] must be a role or a map of mode to role`); continue; }
        for (const value of values) {
            const ref = refOf(value);
            if (!ref) continue;
            const name = ref.slice(2);
            if (!allTokens.includes(name)) out.push(`tokenRoles["${token}"] refers to "${ref}", which is not a token variable of this template`);
        }
    }
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
        if (def.as !== undefined) {
            const target = isPlainObject(persistent) ? persistent[def.as] : undefined;
            if (!isPlainObject(target)) out.push(`persistent state "${state}" is an alias of "${def.as}", which is not a persistent state`);
            else if (target.as !== undefined) out.push(`persistent state "${state}" is an alias of "${def.as}", which is itself an alias`);
            if (Object.keys(def.tokens).length) out.push(`persistent state "${state}" is an alias and takes no tokens of its own`);
        }
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
    return allTokens.filter(t => !['length', 'ratio', 'color', 'typography', 'effect'].includes(kinds[t])).map(t => `token "${t}" has no kind (length, ratio, color, typography or effect)`);
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
 * Problems in the managed icon slots: each def names a boolean show prop and an icon component prop, and either a placement enum
 * (each value maps to a managed anatomy slot) or a fixed managed slot. Each def names the colour and size tokens of its slot.
 * @param {any} schema
 * @param {string[]} allTokens
 * @returns {string[]}
 */
function iconProblems(schema, allTokens) {
    const icons = schema.icons ?? [];
    if (!Array.isArray(icons)) return ['icons must be a list'];
    const props = isPlainObject(schema.props) ? schema.props : {};
    const managed = (Array.isArray(schema.anatomy) ? schema.anatomy : []).filter(s => isPlainObject(s) && s.managed && s.kind === 'icon').map(s => s.id);
    const out = [];
    // A managed slot is drawn from its definition: one that no definition names would never show.
    const named = new Set(icons.flatMap(icon => isPlainObject(icon) ? [icon.slot, ...(isPlainObject(props[icon.placement]?.slots) ? Object.values(props[icon.placement].slots).flat() : [])] : []));
    for (const id of managed) if (!named.has(id)) out.push(`managed anatomy slot "${id}" has no icon def`);
    icons.forEach((icon, i) => {
        const tag = `icon def ${i}`;
        if (!isPlainObject(icon)) { out.push(`${tag} must be an object`); return; }
        const show = props[icon.show], component = props[icon.component];
        const always = (Array.isArray(schema.anatomy) ? schema.anatomy : []).some(s => isPlainObject(s) && s.id === icon.slot && s.alwaysVisible === true);
        if (always) { if (icon.show !== undefined) out.push(`${tag} shows an alwaysVisible slot, so it has no show switch`); }
        else if (!show || show.source !== 'literal' || show.type !== 'boolean') out.push(`${tag} show "${icon.show}" is not a boolean prop`);
        if (!component || component.source !== 'literal' || component.type !== 'iconComponent') out.push(`${tag} component "${icon.component}" is not an icon prop`);
        if (icon.hideWhenEmpty !== undefined && (props[icon.hideWhenEmpty]?.source !== 'literal' || props[icon.hideWhenEmpty]?.type !== 'string')) out.push(`${tag} hideWhenEmpty "${icon.hideWhenEmpty}" is not a string prop`);
        if (icon.placement !== undefined) {
            const placement = props[icon.placement];
            if (!placement || placement.source !== 'literal' || placement.type !== 'enum') out.push(`${tag} placement "${icon.placement}" is not an enum prop`);
            else {
                if (!isPlainObject(placement.slots)) out.push(`${tag} placement "${icon.placement}" has no slots`);
                else for (const option of placement.options) {
                    for (const slot of [placement.slots[option] ?? []].flat()) {
                        if (!managed.includes(slot)) out.push(`${tag} placement "${option}" maps to "${slot}", which is not a managed anatomy slot`);
                    }
                }
            }
            if (icon.slot !== undefined && !managed.includes(icon.slot)) out.push(`${tag} slot "${icon.slot}" is not a managed anatomy slot`);
        } else {
            if (!isName(icon.slot)) out.push(`${tag} needs a slot or a placement`);
            else if (!managed.includes(icon.slot)) out.push(`${tag} slot "${icon.slot}" is not a managed anatomy slot`);
        }
        for (const role of ['colour', 'disabledColour', 'size']) {
            if (!allTokens.includes(icon.tokens?.[role])) out.push(`${tag} ${role} token "${icon.tokens?.[role]}" is not a token`);
        }
        // The hover colour is optional; a slot that has one is a fixed slot that carries the hover rule.
        if (icon.tokens?.hoverColour !== undefined) {
            if (!allTokens.includes(icon.tokens.hoverColour)) out.push(`${tag} hoverColour token "${icon.tokens.hoverColour}" is not a token`);
            if (!isName(icon.slot)) out.push(`${tag} has a hover colour but names no slot`);
        }
    });
    return out;
}

/** Words a prop name cannot be: the generated component destructures its props, so a slot id is a JavaScript identifier. */
const RESERVED_WORDS = new Set(['await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null', 'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield']);
/** The props every generated component has besides its own: `children` is the single slot's, the rest pass through to the root. */
const GENERATED_PROPS = ['children', 'className', 'style', 'ref', 'key'];
/** The fields of a content slot definition. They are the names and settings of Figma's slot property, so the generator can write them into it. */
const SLOT_FIELDS = ['id', 'name', 'description', 'min', 'max', 'accepts', 'onlyAccepts', 'showEmpty', 'fillCounter', 'layout', 'repeat', 'fill'];

/**
 * Problems in the content slots a template declares (`slots`): a frame of the component that instances fill with their own layers. A slot's id
 * is its prop name in the generated code, so it is a lower camel case identifier that no prop, anatomy slot or part of the template already
 * uses (an icon slot is a different thing and keeps its own id space). Not the icon slots (`icons`).
 * @param {any} schema
 * @param {Set<string>} [templateIds] the templates a slot may accept, when they are known
 * @returns {string[]}
 */
function slotProblems(schema, templateIds) {
    if (schema.slots === undefined) return [];
    if (!Array.isArray(schema.slots)) return ['slots must be a list'];
    const out = [];
    const props = isPlainObject(schema.props) ? schema.props : {};
    const anatomy = new Set((Array.isArray(schema.anatomy) ? schema.anatomy : []).filter(isPlainObject).map(s => s.id));
    const parts = new Set((Array.isArray(schema.parts) ? schema.parts : []).filter(isPlainObject).map(p => p.id));
    const ids = new Set(), names = new Map();
    schema.slots.forEach((slot, i) => {
        if (!isPlainObject(slot)) { out.push(`slot ${i} must be an object`); return; }
        const has = isName(slot.id);
        const tag = has ? `slot "${slot.id}"` : `slot ${i}`;
        if (!has) out.push(`${tag} has no id`);
        else {
            if (!/^[a-z][A-Za-z0-9]*$/.test(slot.id) || RESERVED_WORDS.has(slot.id)) out.push(`slot id "${slot.id}" must be a lower camel case identifier`);
            if (ids.has(slot.id)) out.push(`duplicate slot "${slot.id}"`);
            ids.add(slot.id);
            if (GENERATED_PROPS.includes(slot.id)) out.push(`${tag} is named like a prop of the generated component`);
            else if (Object.hasOwn(props, slot.id)) out.push(`${tag} is named like a prop of the template`);
            else if (anatomy.has(slot.id)) out.push(`${tag} is named like an anatomy slot: an icon slot is not a content slot`);
            else if (parts.has(slot.id)) out.push(`${tag} is named like a part of the template`);
        }
        if (!isName(slot.name)) out.push(`${tag} has no name`);
        else if (names.has(slot.name)) out.push(`${tag} has the name "${slot.name}", which slot "${names.get(slot.name)}" already has`);
        else names.set(slot.name, has ? slot.id : `${i}`);
        if (slot.description !== undefined && typeof slot.description !== 'string') out.push(`${tag} description must be text`);
        const minOk = slot.min === undefined || (Number.isInteger(slot.min) && slot.min >= 0);
        const maxOk = slot.max === undefined || (Number.isInteger(slot.max) && slot.max >= 1);
        if (!minOk) out.push(`${tag} min must be a whole number, 0 or more`);
        if (!maxOk) out.push(`${tag} max must be a whole number, 1 or more`);
        if (minOk && maxOk && slot.min !== undefined && slot.max !== undefined && slot.min > slot.max) out.push(`${tag} min ${slot.min} is above its max ${slot.max}`);
        if (slot.layout !== 'horizontal' && slot.layout !== 'vertical') out.push(`${tag} layout must be horizontal or vertical`);
        const acceptsOk = slot.accepts === undefined || (Array.isArray(slot.accepts) && slot.accepts.every(isName));
        if (!acceptsOk) out.push(`${tag} accepts must be a list of template ids`);
        else {
            for (const id of new Set((slot.accepts ?? []).filter((/** @type {string} */ a, /** @type {number} */ k, /** @type {string[]} */ all) => all.indexOf(a) !== k))) out.push(`${tag} accepts names "${id}" twice`);
            if (templateIds) for (const id of new Set(slot.accepts ?? [])) if (!templateIds.has(id)) out.push(`${tag} accepts "${id}", which is not a registered template`);
        }
        if (slot.onlyAccepts !== undefined && typeof slot.onlyAccepts !== 'boolean') out.push(`${tag} onlyAccepts must be a boolean`);
        else if (slot.onlyAccepts === true && !(acceptsOk && slot.accepts?.length)) out.push(`${tag} onlyAccepts needs accepts: it restricts to the templates accepts names`);
        for (const flag of ['showEmpty', 'fillCounter', 'fill']) {
            if (slot[flag] !== undefined && typeof slot[flag] !== 'boolean') out.push(`${tag} ${flag} must be a boolean`);
        }
        if (slot.repeat !== undefined) {
            const target = isName(slot.repeat) ? props[slot.repeat] : undefined;
            if (!isName(slot.repeat)) out.push(`${tag} repeat must be the name of a number prop`);
            else if (!target) out.push(`${tag} repeat names "${slot.repeat}", which is not a prop of the template`);
            else if (target.source !== 'literal' || target.type !== 'number') out.push(`${tag} repeat names "${slot.repeat}", which is not a number prop`);
        }
        for (const field of Object.keys(slot)) if (!SLOT_FIELDS.includes(field)) out.push(`${tag} has no field "${field}"`);
    });
    return out;
}

/**
 * Problems in the icon tokens of a part: a part that holds `tokens` (the colour, the disabled colour and the size of an icon-like part, the
 * spinner) is a frame part and names tokens of the template, as an icon def does.
 * @param {any} schema
 * @param {string[]} allTokens
 * @returns {string[]}
 */
function partTokenProblems(schema, allTokens) {
    const out = [];
    for (const part of Array.isArray(schema.parts) ? schema.parts : []) {
        if (!isPlainObject(part) || part.tokens === undefined) continue;
        if (part.kind !== 'frame') { out.push(`part "${part.id}" has icon tokens but is not a frame part`); continue; }
        for (const role of ['colour', 'disabledColour', 'size']) {
            if (!allTokens.includes(part.tokens?.[role])) out.push(`part "${part.id}" ${role} token "${part.tokens?.[role]}" is not a token`);
        }
    }
    return out;
}

/**
 * Problems in the control: it names a text anatomy slot and the string props that fill its value and placeholder.
 * @param {any} schema
 * @returns {string[]}
 */
/**
 * The primary text part: one anatomy slot that is a text or control slot. A template with a required text or control slot declares it;
 * a template with none declares none. A declaration given twice (a list) is refused.
 * @param {any} schema
 */
function primarySlotProblems(schema) {
    const declared = schema.primarySlot;
    const anatomy = Array.isArray(schema.anatomy) ? schema.anatomy.filter(isPlainObject) : [];
    const hasText = anatomy.some(s => (s.kind === 'text' || s.kind === 'control') && (!s.optional || s.managed));
    if (Array.isArray(declared)) return declared.length > 1 ? ['primarySlot is declared more than once'] : ['primarySlot must name one anatomy slot'];
    if (declared === undefined) return hasText ? ['primarySlot is missing: name the text part a fresh instance shows'] : [];
    if (typeof declared !== 'string') return ['primarySlot must name one anatomy slot'];
    const slot = anatomy.find(s => s.id === declared);
    if (!slot) return [`primarySlot "${declared}" names no anatomy slot`];
    if (slot.kind !== 'text' && slot.kind !== 'control') return [`primarySlot "${declared}" is not a text part`];
    return [];
}

function controlProblems(schema) {
    const control = schema.control;
    if (control === undefined) return [];
    if (!isPlainObject(control)) return ['control must be an object'];
    const out = [];
    const text = (Array.isArray(schema.anatomy) ? schema.anatomy : []).filter(s => isPlainObject(s) && (s.kind === 'text' || s.kind === 'control')).map(s => s.id);
    if (!text.includes(control.slot)) out.push(`control slot "${control.slot}" is not a text or control anatomy slot`);
    const props = isPlainObject(schema.props) ? schema.props : {};
    const value = props[control.value];
    if (!value || value.source !== 'literal' || value.type !== 'string') out.push(`control value "${control.value}" is not a string prop`);
    if (control.placeholder !== undefined) {
        const placeholder = props[control.placeholder];
        if (!placeholder || placeholder.source !== 'literal' || placeholder.type !== 'string') out.push(`control placeholder "${control.placeholder}" is not a string prop`);
    }
    for (const [field, kind] of [['maxlength', 'number'], ['minlength', 'number'], ['readonly', 'boolean'], ['count', 'boolean']]) {
        if (control[field] === undefined) continue;
        const def = props[control[field]];
        if (!def || def.source !== 'literal' || def.type !== kind) out.push(`control ${field} "${control[field]}" is not a ${kind} prop`);
    }
    for (const flag of ['hideWhenEmpty', 'hidePlaceholderWhenFilled']) {
        if (control[flag] !== undefined && typeof control[flag] !== 'boolean') out.push(`control ${flag} must be a boolean`);
    }
    // The value wins over the placeholder: the placeholder prop writes a part of the template, which the value then hides.
    if (control.hidePlaceholderWhenFilled === true) {
        if (control.placeholder === undefined) out.push('control hidePlaceholderWhenFilled needs a placeholder prop');
        else {
            const key = props[control.placeholder]?.node?.key;
            const parts = (Array.isArray(schema.parts) ? schema.parts : []).filter(p => isPlainObject(p) && p.canvas !== false).map(p => p.id);
            if (!parts.includes(key)) out.push(`control hidePlaceholderWhenFilled names the placeholder layer "${key}", which is not a part of the template`);
        }
    }
    return out;
}

/**
 * Problems in the focus target: only `wrapper`, and only with a control whose state the root reflects.
 * @param {any} schema
 * @returns {string[]}
 */
/**
 * Problems in the interaction behaviour: `focus` is "outline" or "halo", `wave` a boolean. A halo switches the ring
 * on :focus as well as focus-visible (mouse focus shows it); an outline switches on focus-visible only (a mouse click
 * shows no persistent ring), so no :focus state of an outline template may switch outline-color.
 * @param {any} schema
 * @returns {string[]}
 */
function interactionProblems(schema) {
    if (schema.interaction === undefined) return [];
    if (!isPlainObject(schema.interaction)) return ['interaction must be an object'];
    const out = [];
    const { focus, wave } = schema.interaction;
    if (focus !== 'outline' && focus !== 'halo') out.push(`interaction focus "${focus}" must be "outline" or "halo"`);
    if (typeof wave !== 'boolean') out.push('interaction wave must be a boolean');
    const focusRing = Object.keys(schema.previewStates ?? {}).filter(s => schema.statePseudo?.[s] === ':focus' && Object.hasOwn(schema.previewStates[s] ?? {}, 'outline-color'));
    if (focus === 'halo' && !focusRing.length) out.push('halo focus must switch outline-color on :focus');
    if (focus === 'outline' && focusRing.length) out.push('outline focus must not switch outline-color on :focus');
    return out;
}

/**
 * Problems in the focus target: only `wrapper`, and only with a control whose state the root reflects.
 * @param {any} schema
 * @returns {string[]}
 */
function focusTargetProblems(schema) {
    if (schema.focusTarget === undefined) return [];
    if (schema.focusTarget !== 'wrapper') return [`focusTarget "${schema.focusTarget}" must be "wrapper"`];
    if (!isPlainObject(schema.control)) return ['focusTarget needs a control'];
    return [];
}

/**
 * Problems in the focus outline: a width and an offset, in px, 0 or more.
 * @param {any} schema
 * @returns {string[]}
 */
function outlineProblems(schema) {
    const o = schema.outline;
    if (o === undefined) return [];
    if (!isPlainObject(o)) return ['outline must be an object (offset)'];
    // The width is the outline-width token now, not a static number; only the extra gap stays on the schema.
    // A stale width is refused loudly, never silently ignored (old templates fail to open until it is removed).
    if ('width' in o) return ['outline.width is no longer read: remove it and bind the outline-width token instead.'];
    return ['offset'].filter(k => typeof o[k] !== 'number' || o[k] < 0).map(k => `outline ${k} must be a number of px, 0 or more`);
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
        else if (field.kind === 'enum') for (const option of def.options ?? []) if (!field.options.includes(option)) out.push(`prop "${name}" offers "${option}", which "${def.node.field}" does not take`);
    }
    const states = [...Object.keys(isPlainObject(schema.persistentStates) ? schema.persistentStates : {}), ...Object.keys(isPlainObject(schema.previewStates) ? schema.previewStates : {})];
    const pseudo = isPlainObject(schema.statePseudo) ? schema.statePseudo : {};
    const aliases = new Set(Object.entries(isPlainObject(schema.persistentStates) ? schema.persistentStates : {}).filter(([, d]) => isPlainObject(d) && d.as !== undefined).map(([name]) => name));
    for (const state of states) if (!aliases.has(state) && !String(pseudo[state] ?? '').startsWith(':')) out.push(`state "${state}" has no pseudo-class in statePseudo`);
    return out;
}
