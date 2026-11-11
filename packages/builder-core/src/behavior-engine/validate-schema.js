import { GLYPHS } from './glyphs.js';
import { NODE_FIELDS, STATE_ATTRIBUTE, displayProblems, enumAttrOf, stateAttributesOf, targetKindOf } from './display.js';

const LITERAL_TYPES = ['boolean', 'string', 'number', 'enum', 'iconComponent', 'image'];

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
        if (def.decimal !== undefined && (typeof def.decimal !== 'boolean' || def.type !== 'number')) out.push(`prop "${name}" decimal must be a boolean on a number prop`);
        if (def.type === 'number' && def.decimal === true) { if (!(def.default === null || Number.isFinite(def.default))) out.push(`prop "${name}" is a decimal number but its default is not a number or null`); }
        else if (def.type === 'number' && !(def.default === null || (Number.isInteger(def.default) && def.default >= 0))) out.push(`prop "${name}" is a number but its default is not a whole number, 0 or more, or null`);
        if (def.derived !== undefined) {
            const d = def.derived;
            const readable = n => props[n]?.source === 'literal' && (props[n].type === 'number' || props[n].type === 'string');
            if (def.type === 'boolean' && isPlainObject(d) && d.when !== undefined) out.push(...conditionProblems(d.when, props, `prop "${name}" derived when`));
            // The limit is a number prop, or a literal number (a count that holds at zero).
            else if (def.type !== 'boolean' || !isPlainObject(d) || !readable(d.value) || !(typeof d.limit === 'number' || props[d.limit]?.type === 'number') || !['gte', 'lte'].includes(d.cmp)) out.push(`prop "${name}" derived must be { when } or { value, limit, cmp: gte | lte } on a boolean prop (the second over a text or number prop and a number prop or a literal number)`);
        }
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
 * The tests of a glyph's condition: one `{ prop, is: boolean }` or an `all` of them. Null when it is anything else (the stylesheet shows a glyph by attributes, so it can
 * only follow on/off states).
 * @param {any} cond
 * @returns {{ prop: string, is: boolean }[] | null}
 */
export function glyphTests(cond) {
    const list = isPlainObject(cond) && Array.isArray(cond.all) ? cond.all : [cond];
    return list.every(t => isPlainObject(t) && typeof t.prop === 'string' && (typeof t.is === 'boolean' || typeof t.is === 'string') && Object.keys(t).length === 2) ? list : null;
}

/**
 * Problems in the `shownWhen` of the anatomy slots: only a text, control, glyph or frame-container slot has one, and its condition must hold on the template's props.
 * @param {any} schema
 * @param {Record<string, any>} props
 * @returns {string[]}
 */
function shownWhenProblems(schema, props) {
    const out = [];
    for (const slot of Array.isArray(schema.anatomy) ? schema.anatomy : []) {
        if (!isPlainObject(slot) || slot.shownWhen === undefined) continue;
        if (slot.kind !== 'text' && slot.kind !== 'control' && slot.kind !== 'glyph' && slot.kind !== 'frame' && slot.kind !== 'line') out.push(`anatomy slot "${slot.id}" has shownWhen but is not a text, control, glyph, frame or line slot`);
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
        if (!['text', 'control', 'icon', 'frame', 'glyph', 'line'].includes(slot.kind)) out.push(`anatomy slot "${slot.id}" has unknown kind "${slot.kind}"`);
        if (slot.kind === 'frame') {
            if (slot.layout !== 'horizontal' && slot.layout !== 'vertical') out.push(`frame slot "${slot.id}" layout must be horizontal or vertical`);
            if (slot.optional) out.push(`frame slot "${slot.id}" cannot be optional`);
            if (slot.edge !== undefined && (slot.edge !== 'right' || slot.parent !== undefined)) out.push(`frame slot "${slot.id}" edge must be right, on a container of the box itself`);
            if (slot.strokeSides !== undefined && !['left', 'top', 'right', 'bottom'].includes(slot.strokeSides)) out.push(`frame slot "${slot.id}" strokeSides must be left, top, right or bottom`);
            if (slot.managed && slot.shownWhen === undefined) out.push(`frame slot "${slot.id}" is managed but unconditional: a managed container names when it shows`);
            // A container that holds nothing is a drawn box when the display maps it (a Switch's handle).
            if (!anatomy.some(c => isPlainObject(c) && c.parent === slot.id) && !drawnBox(schema, slot.id)) out.push(`frame slot "${slot.id}" holds no slot`);
        }
        if (slot.parent !== undefined) {
            const holder = anatomy.find(c => isPlainObject(c) && c.id === slot.parent);
            if (!holder || holder.kind !== 'frame') out.push(`anatomy slot "${slot.id}" has the parent "${slot.parent}", which is not a frame slot`);
            // Containers nest one level (the handler column holds its two halves), never deeper.
            else if (slot.kind === 'frame' && holder.parent !== undefined) out.push(`frame slot "${slot.id}" sits too deep: containers nest one level`);
        }
        if (slot.managed && !['icon', 'text', 'control', 'glyph', 'frame', 'line'].includes(slot.kind)) out.push(`anatomy slot "${slot.id}" is managed but not an icon, text, control, glyph, frame or line slot`);
        // A line is a vector line node of the instance (a divider rule), along one axis: managed and optional, a layer of the root.
        if (slot.kind === 'line') {
            if (slot.axis !== 'horizontal' && slot.axis !== 'vertical') out.push(`line slot "${slot.id}" axis must be horizontal or vertical`);
            if (slot.managed !== true || slot.optional !== true) out.push(`line slot "${slot.id}" must be managed and optional`);
            if (slot.parent !== undefined) out.push(`line slot "${slot.id}" is a layer of the root: it has no parent`);
        }
        // A glyph is a built-in outline drawn in a box: managed, shown by a state the root says as an attribute (so Play and the export need no layer).
        if (slot.kind === 'glyph') {
            if (!Object.hasOwn(GLYPHS, slot.glyph)) out.push(`glyph slot "${slot.id}" names the glyph "${slot.glyph}", which is not a built-in glyph`);
            if (slot.managed !== true || slot.optional !== true) out.push(`glyph slot "${slot.id}" must be managed and optional`);
            if (slot.hoverFill !== undefined && !Object.values(isPlainObject(schema.tokens) ? schema.tokens : {}).flat().includes(slot.hoverFill)) out.push(`glyph slot "${slot.id}" hoverFill "${slot.hoverFill}" is not a token`);
            if (slot.inset !== undefined && !Object.values(isPlainObject(schema.tokens) ? schema.tokens : {}).flat().includes(slot.inset)) out.push(`glyph slot "${slot.id}" inset "${slot.inset}" is not a token`);
            if (slot.corner !== undefined && (slot.corner !== 'bottom-right' || slot.parent !== undefined)) out.push(`glyph slot "${slot.id}" corner must be bottom-right, on a glyph that is a layer of the box itself`);
            const tests = glyphTests(slot.shownWhen);
            const attrs = stateAttributesOf(schema);
            const state = tests !== null && tests.every(t => isPlainObject(schema.props) && (typeof t.is === 'boolean'
                ? schema.props[t.prop]?.type === 'boolean' && attrs.some(a => a.prop === t.prop)
                : schema.props[t.prop]?.type === 'enum' && schema.props[t.prop].options.includes(t.is) && enumAttrOf(schema, t.prop) !== undefined));
            if (!state) out.push(`glyph slot "${slot.id}" needs a shownWhen of { prop, is } tests (or an all of them): a boolean prop that a state with an attribute follows, or an enum option of a prop the root says as an attribute`);
        }
        // A managed text or control layer is made and removed from the props: the schema says when its instance layer is wanted.
        if (slot.managed && slot.kind !== 'icon' && slot.shownWhen === undefined) out.push(`managed ${slot.kind} slot "${slot.id}" needs a shownWhen`);
        // An always visible icon slot is on every instance: it has no switch, so it is the one managed slot that is not optional.
        if (slot.alwaysVisible !== undefined && typeof slot.alwaysVisible !== 'boolean') out.push(`anatomy slot "${slot.id}" alwaysVisible must be true or false`);
        if (slot.alwaysVisible === true) {
            if (!(slot.kind === 'icon' && slot.managed)) out.push(`anatomy slot "${slot.id}" alwaysVisible needs a managed icon slot`);
            if (slot.optional) out.push(`alwaysVisible slot "${slot.id}" cannot be optional`);
        }
        else if (slot.managed && !slot.optional && slot.kind !== 'frame') out.push(`managed anatomy slot "${slot.id}" must be optional`);
    }
    const text = anatomy.filter(s => isPlainObject(s) && (s.kind === 'text' || s.kind === 'control') && (!s.optional || s.id === schema.primarySlot));
    const shown = anatomy.filter(s => isPlainObject(s) && s.alwaysVisible === true && s.kind === 'icon' && s.managed);
    const drawn = anatomy.some(s => isPlainObject(s) && s.kind === 'frame' && drawnBox(schema, s.id));
    if (text.length === 0 && shown.length === 0 && !drawn && !(Array.isArray(schema.slots) && schema.slots.length > 0)) out.push('anatomy needs a required text or control slot, an always visible icon slot, a drawn box or a content slot');

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
    if (schema.isControl !== undefined && typeof schema.isControl !== 'boolean') out.push('isControl must be true or false');
    out.push(...sampleProblems(schema));
    out.push(...iconProblems(schema, allTokens));
    out.push(...partTokenProblems(schema, allTokens));
    out.push(...partParentProblems(schema));
    out.push(...slotProblems(schema, templateIds));
    out.push(...controlProblems(schema));
    out.push(...primarySlotProblems(schema));
    out.push(...shownWhenProblems(schema, props || {}));
    out.push(...focusTargetProblems(schema));
    out.push(...interactionProblems(schema));
    out.push(...motionProblems(schema, allTokens));
    out.push(...toggleProblems(schema));
    out.push(...pressProblems(schema));
    out.push(...revealProblems(schema));
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
        // A hiding state hides the root in Play and the export: only an attribute state can, so a pseudo-class never hides on hover.
        if (def.hide === true && !STATE_ATTRIBUTE.test(String(schema.statePseudo?.[state] ?? ''))) out.push(`persistent state "${state}" hides the root, so it must be an attribute state (statePseudo [data-…])`);
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
            if (schema.tokenKinds?.[base] !== 'color') out.push(`preview state "${state}" changes "${base}", but preview states change colours only (a token of kind color)`);
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
    // A template may declare no disabled state (a non-interactive one); a name it does declare must be a persistent state.
    if (el.disabledState !== undefined && (!isPlainObject(schema.persistentStates) || !(el.disabledState in schema.persistentStates))) out.push(`element disabledState "${el.disabledState}" is not a persistent state`);
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
        const showName = typeof icon.show === 'string' ? icon.show : isPlainObject(icon.show) ? icon.show.prop : icon.show;
        const show = props[showName], component = props[icon.component];
        const always = (Array.isArray(schema.anatomy) ? schema.anatomy : []).some(s => isPlainObject(s) && s.id === icon.slot && s.alwaysVisible === true);
        if (always) { if (icon.show !== undefined) out.push(`${tag} shows an alwaysVisible slot, so it has no show switch`); }
        else if (!show || show.source !== 'literal' || show.type !== 'boolean') out.push(`${tag} show "${showName}" is not a boolean prop`);
        else if (isPlainObject(icon.show) && typeof icon.show.is !== 'boolean') out.push(`${tag} show "is" must be true or false`);
        if (!component || component.source !== 'literal' || component.type !== 'iconComponent') out.push(`${tag} component "${icon.component}" is not an icon prop`);
        if (icon.hideWhenEmpty !== undefined && (props[icon.hideWhenEmpty]?.source !== 'literal' || props[icon.hideWhenEmpty]?.type !== 'string')) out.push(`${tag} hideWhenEmpty "${icon.hideWhenEmpty}" is not a string prop`);
        // A swap icon follows a local interaction state instead of a canvas layer: it renders from its component where the toggle's press sits,
        // and its slot needs no managed anatomy slot (one with anatomy still gets its layer, hidden by the state).
        if (icon.swap !== undefined) {
            if (!isPlainObject(icon.swap) || typeof icon.swap.by !== 'string' || typeof icon.swap.is !== 'boolean') out.push(`${tag} swap must be { by, is } with a press toggleState and true or false`);
            else {
                const press = (Array.isArray(schema.press) ? schema.press : []).find(p => isPlainObject(p) && p.toggleState === icon.swap.by);
                const holder = (Array.isArray(schema.anatomy) ? schema.anatomy : []).find(s => isPlainObject(s) && s.id === press?.slot);
                if (!press) out.push(`${tag} swap by "${icon.swap.by}" names no press toggleState`);
                else if (holder?.kind !== 'frame') out.push(`${tag} swap by "${icon.swap.by}" sits on "${press.slot}", which is not a frame slot to draw the icon in`);
            }
            if (icon.placement !== undefined) out.push(`${tag} swap names a placement: a swap icon is prop-only or layered, never placed`);
        }
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
            if (icon.slot !== undefined && !managed.includes(icon.slot) && icon.swap === undefined) out.push(`${tag} slot "${icon.slot}" is not a managed anatomy slot`);
        } else {
            if (!isName(icon.slot)) out.push(`${tag} needs a slot or a placement`);
            else if (!managed.includes(icon.slot) && icon.swap === undefined) out.push(`${tag} slot "${icon.slot}" is not a managed anatomy slot`);
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
/**
 * Problems in a part's parent: a part inside a container names an anatomy frame slot of the template.
 * @param {any} schema
 * @returns {string[]}
 */
function partParentProblems(schema) {
    const out = [];
    const frames = new Set((Array.isArray(schema.anatomy) ? schema.anatomy : []).filter(s => isPlainObject(s) && s.kind === 'frame').map(s => s.id));
    for (const part of Array.isArray(schema.parts) ? schema.parts : []) {
        if (!isPlainObject(part) || part.parent === undefined) continue;
        if (!frames.has(part.parent)) out.push(`part "${part.id}" parent "${part.parent}" is not an anatomy frame slot`);
        if (part.side !== undefined) out.push(`part "${part.id}" has both a parent and a side: it cannot sit on a side inside a container`);
    }
    return out;
}
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
/** Whether a container of the anatomy is a drawn box: the display maps it, so it draws itself (fill, radius, size) and needs no content. */
function drawnBox(schema, id) {
    return isPlainObject(schema.display) && isPlainObject(schema.display[id]) && Object.keys(schema.display[id]).length > 0;
}

/** `sampleProps` (the props a generated master and its demo instance start with) are literal props of the right type. */
function sampleProblems(schema) {
    const sample = schema.sampleProps;
    if (sample === undefined) return [];
    if (!isPlainObject(sample)) return ['sampleProps must be an object of prop values'];
    const props = isPlainObject(schema.props) ? schema.props : {};
    return Object.entries(sample).flatMap(([name, value]) => {
        const def = props[name];
        if (!isPlainObject(def) || def.source !== 'literal') return [`sampleProps "${name}" names no literal prop`];
        const ok = def.type === 'string' ? typeof value === 'string'
            : def.type === 'boolean' ? typeof value === 'boolean'
            : def.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
            : def.type === 'enum' ? Array.isArray(def.options) && def.options.includes(value)
            : false;
        return ok ? [] : [`sampleProps "${name}" must be a ${def.type} value`];
    });
}

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
    if (control.multiline !== undefined) {
        const ml = control.multiline;
        const kinds = { rows: 'number', autoSize: 'boolean', minRows: 'number', maxRows: 'number', resize: 'enum' };
        if (!isPlainObject(ml)) out.push('control multiline must be an object');
        else for (const [field, kind] of Object.entries(kinds)) {
            const def = props[ml[field]];
            if (!def || def.source !== 'literal' || def.type !== kind) out.push(`control multiline ${field} "${ml[field]}" is not a ${kind} prop`);
        }
    }
    if (control.number !== undefined) {
        if (!isPlainObject(control.number)) out.push('control number must be an object');
        else for (const field of ['min', 'max', 'step', 'precision']) {
            const def = props[control.number[field]];
            if (!def || def.source !== 'literal' || def.type !== 'number') out.push(`control number ${field} "${control.number[field]}" is not a number prop`);
        }
    }
    for (const [field, cond] of [['maskWhen', control.maskWhen], ['multiline when', control.multiline?.when]]) if (cond !== undefined) out.push(...conditionProblems(cond, props, `control ${field}`));
    const toggleStates = (Array.isArray(schema.press) ? schema.press : []).filter(p => isPlainObject(p) && p.toggleState).map(p => p.toggleState);
    if (control.maskUnless !== undefined && !(props[control.maskUnless]?.source === 'literal' && props[control.maskUnless]?.type === 'boolean') && !toggleStates.includes(control.maskUnless)) out.push(`control maskUnless "${control.maskUnless}" is neither a boolean prop nor a press toggleState`);
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
 * Problems in the press actions: each entry names a glyph slot of the template and one action: `toggle` (a boolean prop that a state with an attribute follows),
 * `toggleState` (a local interaction state the press flips on the root, with no prop), `step` (1 or -1, which needs a control with `number` limits) or
 * `dismiss`.
 * @param {any} schema
 * @returns {string[]}
 */
function pressProblems(schema) {
    if (schema.press === undefined) return [];
    if (!Array.isArray(schema.press)) return ['press must be a list'];
    const props = isPlainObject(schema.props) ? schema.props : {};
    const attrs = stateAttributesOf(schema);
    const out = [];
    for (const entry of schema.press) {
        const slot = (Array.isArray(schema.anatomy) ? schema.anatomy : []).find(s => isPlainObject(s) && isPlainObject(entry) && s.id === entry.slot);
        if (!isPlainObject(entry) || !['glyph', 'frame'].includes(slot?.kind)) { out.push(`press names "${entry?.slot}", which is not a glyph or frame slot`); continue; }
        const tokens = Object.values(isPlainObject(schema.tokens) ? schema.tokens : {}).flat();
        for (const field of ['hoverFill', 'activeFill']) if (entry[field] !== undefined && !tokens.includes(entry[field])) out.push(`press ${field} "${entry[field]}" on "${entry.slot}" is not a token`);
        if (entry.glyph !== undefined && !(Array.isArray(schema.anatomy) && schema.anatomy.some(s => isPlainObject(s) && s.id === entry.glyph && s.parent === entry.slot))) out.push(`press glyph "${entry.glyph}" is not a slot inside "${entry.slot}"`);
        if (entry.blockedBy !== undefined && !stateAttributesOf(schema).some(a => a.prop === entry.blockedBy)) out.push(`press blockedBy "${entry.blockedBy}" is not a state with an attribute`);
        const actions = ['toggle', 'toggleState', 'step', 'resize', 'dismiss'].filter(k => entry[k] !== undefined);
        if (actions.length !== 1) { out.push(`press on "${entry.slot}" needs exactly one of toggle, toggleState, step, resize or dismiss`); continue; }
        if (entry.toggleState !== undefined && !/^[A-Za-z][A-Za-z0-9]*$/.test(entry.toggleState)) out.push(`press toggleState "${entry.toggleState}" on "${entry.slot}" is not a name a local state can be written as`);
        if (entry.resize !== undefined && !(entry.resize === true && schema.control?.multiline)) out.push(`press resize on "${entry.slot}" needs a multiline control`);
        if (entry.toggle !== undefined && !(props[entry.toggle]?.source === 'literal' && props[entry.toggle]?.type === 'boolean' && attrs.some(a => a.prop === entry.toggle))) out.push(`press toggle "${entry.toggle}" on "${entry.slot}" is not a boolean prop that a state with an attribute follows`);
        if (entry.step !== undefined) {
            if (entry.step !== 1 && entry.step !== -1) out.push(`press step on "${entry.slot}" must be 1 or -1`);
            if (!isPlainObject(schema.control?.number)) out.push(`press step on "${entry.slot}" needs a control with number limits`);
        }
    }
    return out;
}

/**
 * Problems in `reveal`: the container of the anatomy that Play and the export show only while the control is hovered or has focus (antd's handler column), and the
 * time it takes. The canvas always draws it.
 * @param {any} schema
 * @returns {string[]}
 */
function revealProblems(schema) {
    if (schema.reveal === undefined) return [];
    if (!isPlainObject(schema.reveal)) return ['reveal must be an object'];
    const slot = (Array.isArray(schema.anatomy) ? schema.anatomy : []).find(s => isPlainObject(s) && s.id === schema.reveal.slot);
    const out = [];
    if (slot?.kind !== 'frame') out.push(`reveal names "${schema.reveal.slot}", which is not a frame slot`);
    if (typeof schema.reveal.duration !== 'string' || !/^[0-9.]+m?s$/.test(schema.reveal.duration)) out.push('reveal duration must be a time such as 0.2s');
    if (typeof schema.reveal.easing !== 'string' || !/^(ease|ease-in|ease-out|ease-in-out|linear|cubic-bezier\([^)]*\))$/.test(schema.reveal.easing)) out.push('reveal easing must be a CSS easing such as ease');
    if (typeof schema.reveal.slide !== 'string' || !/^[0-9.]+(%|px)$/.test(schema.reveal.slide)) out.push('reveal slide must be the distance the column leaves from, such as 100%');
    return out;
}

/**
 * Problems in a click toggle: its prop (and the state it clears) is a boolean literal prop that a persistent state with an attribute follows, so Play can write it
 * on the root; `once` is a boolean.
 * @param {any} schema
 * @returns {string[]}
 */
function toggleProblems(schema) {
    if (schema.toggle === undefined) return [];
    if (!isPlainObject(schema.toggle)) return ['toggle must be an object'];
    const props = isPlainObject(schema.props) ? schema.props : {};
    const attrs = stateAttributesOf(schema);
    const out = [];
    for (const key of ['prop', 'clears']) {
        const name = schema.toggle[key];
        if (key === 'clears' && name === undefined) continue;
        if (!(props[name]?.source === 'literal' && props[name]?.type === 'boolean' && attrs.some(a => a.prop === name))) out.push(`toggle ${key} "${name}" is not a boolean prop that a state with an attribute follows`);
    }
    if (schema.toggle.once !== undefined && typeof schema.toggle.once !== 'boolean') out.push('toggle once must be true or false');
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
 * Problems in the motion behaviour: colour transitions, glyph draw-in appearances, the sliding
 * handle and the press grow. Durations and easings are schema data (they have no variable type),
 * keys name the display mapping, states name persistent states the root says as an attribute.
 * @param {any} schema
 * @param {string[]} allTokens
 * @returns {string[]}
 */
const CSS_TIME = /^\d+(\.\d+)?m?s$/;
const CSS_EASE = /^(linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|steps\([^)]*\)|cubic-bezier\([^)]*\))$/;
const CSS_PROP = /^[a-z-]+$/;
const CSS_LENGTH = /^\d+(\.\d+)?px$/;
function motionProblems(schema, allTokens) {
    const motion = schema.motion;
    if (motion === undefined) return [];
    if (!isPlainObject(motion)) return ['motion must be an object'];
    const out = [];
    const keys = ['root', ...Object.keys(schema.display ?? {})];
    const attributed = new Set(stateAttributesOf(schema).map(a => a.state));
    const time = (what, value) => { if (typeof value !== 'string' || !CSS_TIME.test(value)) out.push(`motion ${what} must be a CSS duration (0.3s)`); };
    const ease = (what, value) => { if (typeof value !== 'string' || !CSS_EASE.test(value)) out.push(`motion ${what} must be a CSS easing (ease-in-out or cubic-bezier(...))`); };
    for (const t of motion.transitions ?? []) {
        const where = `motion transition "${t?.key ?? '?'}"`;
        if (!isPlainObject(t)) { out.push('motion transitions must be objects'); continue; }
        if (!keys.includes(t.key)) out.push(`${where} names "${t.key}", which is not root or a display key`);
        if (!Array.isArray(t.props) || !t.props.length || !t.props.every(p => typeof p === 'string' && CSS_PROP.test(p))) out.push(`${where} props must be a non-empty list of CSS properties`);
        time(`${where} duration`, t.duration);
        ease(`${where} timing`, t.timing);
        if (t.delay !== undefined) time(`${where} delay`, t.delay);
    }
    for (const a of motion.appearances ?? []) {
        const where = `motion appearance "${a?.key ?? '?'}"`;
        if (!isPlainObject(a)) { out.push('motion appearances must be objects'); continue; }
        if (!keys.includes(a.key)) out.push(`${where} names "${a.key}", which is not root or a display key`);
        if (!Array.isArray(a.states) || !a.states.length || !a.states.every(s => attributed.has(s))) out.push(`${where} states must name persistent states the root says as an attribute`);
        if (!isPlainObject(a.from) || !Object.keys(a.from).length || !Object.entries(a.from).every(([p, v]) => CSS_PROP.test(p) && typeof v === 'string' && v !== '')) out.push(`${where} from must be CSS declarations`);
        time(`${where} duration`, a.duration);
        ease(`${where} timing`, a.timing);
        if (a.delay !== undefined) time(`${where} delay`, a.delay);
    }
    if (motion.press !== undefined) {
        const p = motion.press, where = 'motion press';
        if (!isPlainObject(p)) out.push(`${where} must be an object`);
        else {
            if (!keys.includes(p.key)) out.push(`${where} names "${p.key}", which is not root or a display key`);
            if (!allTokens.includes(p.token)) out.push(`${where} token "${p.token}" is not a token`);
            if (typeof p.prop !== 'string' || !CSS_PROP.test(p.prop)) out.push(`${where} prop must be a CSS property`);
            if (typeof p.growRatio !== 'number' || !(p.growRatio > 0)) out.push(`${where} growRatio must be a number above 0`);
        }
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
        if (!isPlainObject(def)) continue;
        for (const node of [def.node, ...(Array.isArray(def.nodes) ? def.nodes : [])].filter(Boolean)) {
            const kind = targetKindOf(schema, node.key);
            if (!kind) { out.push(`prop "${name}" writes "${node.key}", which is not root or an anatomy slot`); continue; }
            const field = NODE_FIELDS[kind]?.[node.field];
            if (!field) { out.push(`prop "${name}" writes "${node.field}", which a ${kind} does not take`); continue; }
            // An enum prop with a value map writes the mapped value of each option, which the field must take.
            if (node.values !== undefined) {
                for (const option of def.options ?? []) {
                    if (node.values[option] === undefined) out.push(`prop "${name}" maps no value for "${option}" to "${node.field}"`);
                    else if (field.kind === 'enum' && !field.options.includes(node.values[option])) out.push(`prop "${name}" maps "${option}" to "${node.values[option]}", which "${node.field}" does not take`);
                }
                continue;
            }
            if (def.type !== field.kind) out.push(`prop "${name}" is ${def.type} but writes "${node.field}", which takes ${field.kind}`);
            else if (field.kind === 'enum') for (const option of def.options ?? []) if (!field.options.includes(option)) out.push(`prop "${name}" offers "${option}", which "${node.field}" does not take`);
        }
    }
    const states = [...Object.keys(isPlainObject(schema.persistentStates) ? schema.persistentStates : {}), ...Object.keys(isPlainObject(schema.previewStates) ? schema.previewStates : {})];
    const pseudo = isPlainObject(schema.statePseudo) ? schema.statePseudo : {};
    const aliases = new Set(Object.entries(isPlainObject(schema.persistentStates) ? schema.persistentStates : {}).filter(([, d]) => isPlainObject(d) && d.as !== undefined).map(([name]) => name));
    // A persistent state may be an attribute of the root (`[data-checked]`): the export writes it from the prop; a preview state is a pseudo-class.
    const persistent = isPlainObject(schema.persistentStates) ? schema.persistentStates : {};
    for (const state of states) {
        const ok = String(pseudo[state] ?? '').startsWith(':') || (Object.hasOwn(persistent, state) && STATE_ATTRIBUTE.test(String(pseudo[state] ?? '')));
        if (!aliases.has(state) && !ok) out.push(`state "${state}" has no pseudo-class in statePseudo`);
    }
    return out;
}
