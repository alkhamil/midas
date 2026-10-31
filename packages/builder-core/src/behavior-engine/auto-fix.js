// Auto Fix (pure). Plans and applies what a bound master is missing: required collections, modes and variables per
// the template schema, with values that alias base variables by role. Component variables alias base variables (or
// other component variables of the same template, followed through the bound collection); never Primitives, never
// literals. Nothing existing is overwritten or renamed: same-named collections, modes, variables and bindings are kept,
// missing mode values are only filled. Collections are routed by plan identity, never by name alone, so a component
// collection sharing a base name (component `Size` vs base `Size`) stays its own collection. Unfixable findings
// (structural) are reported, never touched.
import { variableProps } from './registry.js';
import { variableKey } from './tokens.js';
import { planBindTokens } from './bind-tokens.js';
import { dimensionOfGroup } from './validate-schema.js';
import ROLES from '../base-tokens/roles.json' with { type: 'json' };
import BASE_SNAPSHOT from '../base-tokens/base-snapshot.json' with { type: 'json' };

export { ROLES };

/** Names of the base collections Auto Fix reads aliases from. Size lives here no longer: the size scale moved to Semantic. */
export const BASE_COLLECTIONS = ['Primitives', 'Semantic', 'Typography', 'Icons'];

const modeKey = (/** @type {unknown} */ s) => String(s ?? '').toLowerCase();
const varTypeOf = (/** @type {string} */ kind) => kind === 'color' ? 'color' : kind === 'length' || kind === 'ratio' ? 'number' : null;

/**
 * The role a token fills in one collection mode: the schema entry (a plain role, or a per-mode map matched
 * case-insensitively with `default` as the fallback), defaulting to the token's own name.
 * @param {any} template
 * @param {string} token
 * @param {string} modeName
 * @returns {string}
 */
export function roleOf(template, token, modeName) {
    const entry = template.tokenRoles?.[token];
    if (typeof entry === 'string' || entry === undefined) return entry ?? token;
    const hit = Object.keys(entry).find(k => modeKey(k) === modeKey(modeName));
    if (hit) return entry[hit];
    return typeof entry.default === 'string' ? entry.default : token;
}

/** A `group/token` reference is a component variable; anything else is a base role name. */
const isRef = (/** @type {string} */ role) => role.includes('/');

/**
 * Plans the Auto Fix for one bound master. Pure: the store is only read. The creation plan applies through
 * `applyAutoFix` (same idempotent semantics as base generation); `summary.boundProperties` counts the layer bindings
 * the existing auto-bind pipeline then writes, for the confirm message.
 * @param {{ template: any, binding: { variables: Record<string, string | null> }, variables: { collections?: any[], items?: any[] }, layers?: any[], roles?: any, baseSnapshot?: any }} input
 */
export function planAutoFix({ template, binding, variables, layers = [], roles = ROLES, baseSnapshot = BASE_SNAPSHOT }) {
    const collections = variables.collections || [];
    const items = variables.items || [];
    /** @type {{ name: string, modes: string[], origin: string }[]} */
    const newCollections = [];
    /** @type {{ collection: string, collectionIndex: number, name: string, type: string, values: Record<string, any> }[]} */
    const newItems = [];
    /** @type {{ name: string, reason: string }[]} */
    const derived = [], needsValue = [], unfixable = [];
    /** @type {Record<string, string>} */
    const bindingUpdates = {};
    const fail = (/** @type {string} */ name, /** @type {string} */ reason) => { unfixable.push({ name, reason }); };
    const groupPrefix = template.group.toLowerCase() + '/';
    const collsNamed = (/** @type {string} */ name) => collections.filter(c => c.name === name);
    const itemIn = (/** @type {string} */ collectionId, /** @type {string} */ name) => items.find(i => i.collectionId === collectionId && variableKey(i.name) === variableKey(name));
    const key2 = (/** @type {string} */ c, /** @type {string} */ n) => `${c}|${n.toLowerCase()}`;
    /** @type {Map<string, any>} */
    const plannedItems = new Map();
    const snapshotModesOf = (/** @type {string} */ name) => baseSnapshot.collections.find((/** @type {any} */ c) => c.name === name)?.modes ?? [];
    /**
     * Snapshot alias values name their collection; plan aliases route by collection entry. Rebased here so every
     * planned alias carries a collectionIndex (opacity survives the rebasing).
     */
    const reindexAlias = (/** @type {any} */ value) => {
        if (!value?.alias || value.alias.collectionIndex !== undefined) return value;
        const at = collEntry(value.alias.collection, [], 'base');
        return { ...value, alias: { collectionIndex: at, name: value.alias.name } };
    };
    /** The plan entry for a collection (created once per name and origin); base entries carry the snapshot modes. */
    const collEntry = (/** @type {string} */ name, /** @type {string[]} */ modes, /** @type {string} */ origin) => {
        let idx = newCollections.findIndex(c => c.name === name && c.origin === origin);
        if (idx === -1) {
            idx = newCollections.length;
            newCollections.push({ name, modes: origin === 'base' ? snapshotModesOf(name) : modes, origin });
        } else if (origin === 'component') {
            for (const m of modes) if (!newCollections[idx].modes.some((/** @type {string} */ n) => modeKey(n) === modeKey(m))) newCollections[idx].modes.push(m);
        }
        return idx;
    };
    // A same-named collection already holding `group/*` variables (or nothing yet) is the component's; otherwise the
    // one same-named collection there is reused as is, even when it is a base collection sharing the name. Only
    // several same-named collections with no single component one are ambiguous.
    const isComponent = (/** @type {any} */ c) => {
        const names = items.filter(i => i.collectionId === c.id).map(i => i.name);
        return !names.length || names.some(n => n.toLowerCase().startsWith(groupPrefix));
    };
    /** @type {Record<string, any>} */
    const dimCollection = {};
    /** @type {Record<string, number>} */
    const dimEntry = {};
    const dimDef = (/** @type {string} */ dim) => variableProps(template).find(([d]) => d === dim)?.[1];
    for (const [dim, def] of variableProps(template)) {
        const boundId = binding.variables[dim];
        const bound = boundId ? collections.find(c => c.id === boundId) : null;
        if (bound) {
            const names = items.filter(i => i.collectionId === bound.id).map(i => i.name);
            if (names.length && !names.some(n => n.toLowerCase().startsWith(groupPrefix))) { fail(`${template.group}/* (${dim})`, `collection "${bound.name}" holds no ${template.group}/* variables`); continue; }
            dimCollection[dim] = bound;
            dimEntry[dim] = collEntry(bound.name, Array.isArray(def.modes) ? def.modes : [], 'component');
            continue;
        }
        const required = collsNamed(def.collection);
        const mine = required.filter(isComponent);
        const pick = required.length === 1 ? required[0] : mine.length === 1 ? mine[0] : null;
        if (!pick) {
            if (!required.length) {
                dimEntry[dim] = collEntry(def.collection, Array.isArray(def.modes) ? def.modes : [], 'component');
                bindingUpdates[dim] = def.collection;
                dimCollection[dim] = null;
                continue;
            }
            fail(`${template.group}/* (${dim})`, `${required.length} collections are named "${def.collection}"`);
            continue;
        }
        bindingUpdates[dim] = pick.name;
        dimCollection[dim] = pick;
        dimEntry[dim] = collEntry(pick.name, Array.isArray(def.modes) ? def.modes : [], 'component');
    }
    const modesOf = (/** @type {string} */ dim) => {
        const def = dimDef(dim);
        const coll = dimCollection[dim];
        const seen = new Map();
        if (coll) for (const m of coll.modes) seen.set(modeKey(m.name), m.name);
        if (Array.isArray(def?.modes)) for (const s of def.modes) if (!seen.has(modeKey(s))) seen.set(modeKey(s), s);
        return [...seen.values()];
    };
    const allTokens = Object.values(template.tokens ?? {}).flat();
    const dimOfToken = (/** @type {string} */ token) => {
        for (const [group, names] of Object.entries(template.tokens ?? {})) {
            if (names.includes(token)) return dimensionOfGroup(group, template.props);
        }
        return null;
    };
    const plannedVar = (/** @type {any} */ coll, /** @type {string} */ collectionName, /** @type {number} */ entry, /** @type {string} */ name) => {
        if (coll) return itemIn(coll.id, name) ?? plannedItems.get(key2(`id:${coll.id}`, name)) ?? null;
        return plannedItems.get(key2(`at:${entry}`, name)) ?? null;
    };
    /** The base variable a role points at: existing, derived, or re-created from the snapshot. */
    const baseTarget = (/** @type {string} */ role, /** @type {string} */ type, /** @type {string} */ owner) => {
        const entry = roles[role];
        if (!entry || typeof entry.base !== 'string') { needsValue.push({ name: owner, reason: `no base role "${role}"` }); return null; }
        const slash = entry.base.indexOf('/');
        const baseColl = entry.base.slice(0, slash), baseName = entry.base.slice(slash + 1);
        if (!BASE_COLLECTIONS.includes(baseColl)) { needsValue.push({ name: owner, reason: `unknown base collection in "${entry.base}"` }); return null; }
        const cands = collsNamed(baseColl);
        const ordered = [...cands.filter(c => !items.some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(groupPrefix))), ...cands.filter(c => items.some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(groupPrefix)))];
        const existing = ordered.flatMap(c => items.filter(i => i.collectionId === c.id && variableKey(i.name) === variableKey(baseName)))[0];
        if (existing) {
            if (existing.type !== type) { fail(owner, `base variable "${entry.base}" is ${existing.type}, not ${type}`); return null; }
            return { collectionIndex: collEntry(baseColl, [], 'base'), name: baseName };
        }
        if (plannedItems.has(key2(`base:${baseColl}`, baseName))) return { collectionIndex: collEntry(baseColl, [], 'base'), name: baseName };
        const derive = entry.derive;
        if (derive && typeof derive.from === 'string') {
            const pslash = derive.from.indexOf('/');
            const pColl = derive.from.slice(0, pslash), pName = derive.from.slice(pslash + 1);
            const source = collsNamed(pColl).flatMap(c => items.filter(i => i.collectionId === c.id && variableKey(i.name) === variableKey(pName)))[0]
                ?? baseSnapshot.items.find((/** @type {any} */ i) => i.collection === pColl && variableKey(i.name) === variableKey(pName));
            if (!source) { needsValue.push({ name: owner, reason: `nothing behind "${derive.from}"` }); return null; }
            const values = {};
            const primaries = collEntry(pColl, [], 'base');
            for (const m of snapshotModesOf(baseColl)) values[m] = { alias: { collectionIndex: primaries, name: pName }, ...(typeof derive.opacity === 'number' ? { opacity: derive.opacity } : {}) };
            const at = collEntry(baseColl, [], 'base');
            newItems.push({ collection: baseColl, collectionIndex: at, name: baseName, type, values });
            plannedItems.set(key2(`base:${baseColl}`, baseName), true);
            derived.push({ name: `${baseColl}/${baseName}`, reason: `alias to ${derive.from}${derive.opacity ? ` at ${derive.opacity}%` : ''}` });
            return { collectionIndex: at, name: baseName };
        }
        const snap = baseSnapshot.items.find((/** @type {any} */ i) => i.collection === baseColl && variableKey(i.name) === variableKey(baseName));
        if (!snap) { needsValue.push({ name: owner, reason: `no base variable "${entry.base}"` }); return null; }
        const at = collEntry(baseColl, [], 'base');
        const values = {};
        for (const [mode, value] of Object.entries(snap.values)) values[mode] = reindexAlias(value);
        newItems.push({ collection: snap.collection, collectionIndex: at, name: snap.name, type: snap.type ?? type, values });
        plannedItems.set(key2(`base:${baseColl}`, baseName), true);
        const snapDerived = (baseSnapshot.report?.derived ?? []).find(d => d.name === `${baseColl}/${baseName}`);
        if (snapDerived && !derived.some(x => x.name === snapDerived.name)) derived.push({ ...snapDerived });
        return { collectionIndex: at, name: baseName };
    };
    /** Follows a component reference (`group/token`) to the variable it names in its bound collection. */
    const followRef = (/** @type {string} */ ref, /** @type {Set<string>} */ guard) => {
        const slash = ref.indexOf('/');
        const group = ref.slice(0, slash), token = ref.slice(slash + 1);
        if (group !== template.group || !allTokens.includes(token)) { fail(ref, `is not a token variable of this template`); return null; }
        if (guard.has(ref)) { fail(ref, `refers to itself`); return null; }
        const dim = dimOfToken(token);
        if (!dim || !(dim in dimCollection) || !(dim in dimEntry)) { fail(ref, `its dimension is not fixable`); return null; }
        const coll = dimCollection[dim];
        if (plannedVar(coll, dimDef(dim)?.collection, dimEntry[dim], `${template.group}/${token}`)) return { collectionIndex: dimEntry[dim], name: `${template.group}/${token}` };
        guard.add(ref);
        const planned = ensureVariable(dim, token, guard);
        guard.delete(ref);
        if (!planned) return null;
        return { collectionIndex: dimEntry[dim], name: `${template.group}/${token}` };
    };
    /** Plans one component variable (missing values only); null when it cannot be made. */
    function ensureVariable(dim, token, guard = new Set()) {
        const def = dimDef(dim);
        if (!def) return null;
        const coll = dimCollection[dim];
        const collectionName = coll ? coll.name : def.collection;
        const varName = `${template.group}/${token}`;
        const type = template.tokenKinds?.[token] ? varTypeOf(template.tokenKinds[token]) : null;
        if (!type) { fail(varName, `token kind "${template.tokenKinds?.[token] ?? 'missing'}" has no variable type`); return null; }
        const have = coll ? itemIn(coll.id, varName) : null;
        if (have && have.type !== type) { fail(varName, `kept as ${have.type}`); return null; }
        const values = {};
        let needed = !have;
        for (const mode of modesOf(dim)) {
            const has = have && coll && coll.modes.some((/** @type {any} */ m) => modeKey(m.name) === modeKey(mode) && have.values?.[m.id] !== undefined);
            if (has) continue;
            needed = true;
            const role = roleOf(template, token, mode);
            if (isRef(role)) {
                const target = followRef(role, guard);
                if (!target) { values[mode] = { needsValue: true, note: `nothing behind "${role}"` }; needsValue.push({ name: `${collectionName}/${varName}.${mode}`, reason: `nothing behind "${role}"` }); continue; }
                values[mode] = { alias: { collectionIndex: target.collectionIndex, name: target.name } };
                continue;
            }
            const target = baseTarget(role, type, `${collectionName}/${varName}.${mode}`);
            if (!target) { values[mode] = { needsValue: true, note: `no base role "${role}"` }; continue; }
            values[mode] = { alias: { collectionIndex: target.collectionIndex, name: target.name } };
        }
        if (!needed) return { existing: true };
        const pkey = coll ? key2(`id:${coll.id}`, varName) : key2(`at:${dimEntry[dim]}`, varName);
        const at = plannedItems.get(pkey);
        if (at && at !== true) { Object.assign(at.values, values); return { planned: true }; }
        const entry = { collection: collectionName, collectionIndex: dimEntry[dim], name: varName, type, values };
        newItems.push(entry);
        plannedItems.set(pkey, entry);
        return { planned: true };
    }
    // Base collections the aliases read from: when any is missing, the same base generation runs first, in full
    // (its derived entries travel with it, so the report lists what is new).
    if (BASE_COLLECTIONS.some(n => !collsNamed(n).length)) {
        for (const c of baseSnapshot.collections) {
            const at = collEntry(c.name, c.modes, 'base');
            void at;
        }
        for (const i of baseSnapshot.items) {
            const at = collEntry(i.collection, [], 'base');
            const values = {};
            for (const [mode, value] of Object.entries(i.values)) values[mode] = reindexAlias(value);
            newItems.push({ collection: i.collection, collectionIndex: at, name: i.name, type: i.type, values });
            plannedItems.set(key2(`base:${i.collection}`, i.name), true);
        }
        for (const d of baseSnapshot.report?.derived ?? []) {
            if (!derived.some(x => x.name === d.name)) derived.push({ ...d });
        }
    }
    for (const [dim] of variableProps(template)) {
        if (!(dim in dimCollection)) continue;
        for (const [group, names] of Object.entries(template.tokens ?? {})) {
            if (dimensionOfGroup(group, template.props) !== dim) continue;
            for (const token of names) ensureVariable(dim, token);
        }
    }
    /** The literal a stored mode value resolves to, following aliases (each read in its own collection's mode). */
    const storedLiteral = (item, modeName, guard = new Set()) => {
        if (!item || guard.has(item.id)) return undefined;
        guard.add(item.id);
        const modes = collections.find(c => c.id === item.collectionId)?.modes ?? [];
        const modeId = modes.find(m => modeKey(m.name) === modeKey(modeName))?.id ?? modes[0]?.id;
        const value = modeId === undefined ? undefined : item.values?.[modeId];
        if (typeof value === 'number' || typeof value === 'string') return value;
        if (value && typeof value === 'object' && typeof value.alias === 'string') {
            return storedLiteral(items.find(i => i.id === value.alias), modeName, guard);
        }
        return undefined;
    };
    /** A ratio leftover: a positive number below any plausible px line height. */
    const isRatio = value => typeof value === 'number' && value > 0 && value < 4;
    // Line heights that resolve to a ratio are rebound to the paired px token. The Semantic base a role names is
    // repaired first (to the snapshot's Typography alias); the component variable then aliases the repaired base.
    // `lineHeight` is schema vocabulary shared by every template, not per-component code.
    let rebound = 0;
    /** Plans overwriting one mode value with an alias; the applier writes repair entries even when a value is set. */
    const rebind = (collectionName, collectionIndex, name, type, mode, target) => {
        newItems.push({ collection: collectionName, collectionIndex, name, type, values: { [mode]: { alias: { collectionIndex: target.collectionIndex, name: target.name } } }, repair: true });
        rebound++;
    };
    const lineRoles = new Map();
    for (const [dim] of variableProps(template)) {
        if (!(dim in dimCollection)) continue;
        for (const [group, names] of Object.entries(template.tokens ?? {})) {
            if (dimensionOfGroup(group, template.props) !== dim) continue;
            for (const token of names) {
                if (token !== 'lineHeight') continue;
                for (const mode of modesOf(dim)) {
                    const role = roleOf(template, token, mode);
                    if (!isRef(role) && !lineRoles.has(role)) lineRoles.set(role, true);
                }
            }
        }
    }
    for (const role of lineRoles.keys()) {
        const entry = roles[role];
        if (!entry || typeof entry.base !== 'string') continue;
        const slash = entry.base.indexOf('/');
        const baseColl = entry.base.slice(0, slash), baseName = entry.base.slice(slash + 1);
        const cands = collsNamed(baseColl);
        const ordered = [...cands.filter(c => !items.some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(groupPrefix))), ...cands.filter(c => items.some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(groupPrefix)))];
        const base = ordered.flatMap(c => items.filter(i => i.collectionId === c.id && variableKey(i.name) === variableKey(baseName)))[0];
        const target = baseTarget(role, 'number', `${baseColl}/${baseName}`);
        if (!target || !base || base.type !== 'number') continue;
        const snap = baseSnapshot.items.find(i => i.collection === baseColl && variableKey(i.name) === variableKey(baseName));
        for (const m of baseSnapshot.collections.find(c => c.name === baseColl)?.modes ?? []) {
            const hasMode = ordered.find(c => c.id === base.collectionId)?.modes.some(mm => modeKey(mm.name) === modeKey(m));
            if (hasMode && isRatio(storedLiteral(base, m)) && snap?.values[m]?.alias) {
                rebind(baseColl, collEntry(baseColl, [], 'base'), baseName, 'number', m, { collectionIndex: collEntry('Typography', [], 'base'), name: snap.values[m].alias.name });
            }
        }
    }
    for (const [dim] of variableProps(template)) {
        if (!(dim in dimCollection)) continue;
        const coll = dimCollection[dim];
        for (const [group, names] of Object.entries(template.tokens ?? {})) {
            if (dimensionOfGroup(group, template.props) !== dim) continue;
            for (const token of names) {
                if (token !== 'lineHeight') continue;
                const varName = `${template.group}/${token}`;
                const have = coll ? itemIn(coll.id, varName) : null;
                if (!have || have.type !== 'number') continue;
                for (const mode of modesOf(dim)) {
                    const hasMode = coll.modes.some(m => modeKey(m.name) === modeKey(mode));
                    if (!hasMode || !isRatio(storedLiteral(have, mode))) continue;
                    const role = roleOf(template, token, mode);
                    const target = isRef(role) ? followRef(role, new Set()) : baseTarget(role, 'number', `${coll.name}/${varName}.${mode}`);
                    if (!target) continue;
                    rebind(coll.name, dimEntry[dim], varName, 'number', mode, target);
                }
            }
        }
    }
    // The layer bindings the existing auto-bind pipeline would write against the fixed store, for the confirm count.
    let boundProperties = 0;
    if (layers.length) {
        try {
            boundProperties = planBindTokens({ template, binding: updatedBinding(), layers, variables: mergedStore() }).ops.length;
        } catch { boundProperties = 0; }
    }
    /** The binding with the planned updates applied, against the merged store. */
    function updatedBinding() {
        const merged = mergedStore();
        const updated = { ...binding.variables };
        for (const [dim, name] of Object.entries(bindingUpdates)) {
            const cands = merged.collections.filter(c => c.name === name);
            const coll = cands.find(c => merged.items.some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(groupPrefix))) ?? cands[0];
            updated[dim] = coll?.id ?? null;
        }
        return { ...binding, variables: updated };
    }
    /** Existing collections and items plus the planned ones under temporary ids (for the bind count only). */
    function mergedStore() {
        const mergedCollections = collections.map(c => ({ ...c }));
        const idOfEntry = new Map();
        let n = 0;
        for (let e = 0; e < newCollections.length; e++) {
            const wanted = newCollections[e];
            const id = `autofix-c-${++n}`;
            mergedCollections.push({ id, name: wanted.name, modes: wanted.modes.map(m => ({ id: `autofix-m-${n}-${m}`, name: m })) });
            idOfEntry.set(e, id);
        }
        const mergedItems = items.map(i => ({ ...i }));
        for (const wanted of newItems) {
            const cid = idOfEntry.get(wanted.collectionIndex);
            if (!cid) continue;
            if (mergedItems.some(i => i.collectionId === cid && variableKey(i.name) === variableKey(wanted.name))) continue;
            mergedItems.push({ id: `autofix-i-${++n}`, collectionId: cid, name: wanted.name, type: wanted.type, values: {} });
        }
        return { collections: mergedCollections, items: mergedItems };
    }
    /** Whether a store item already covers a planned one (same collection identity and name). */
    function matchingItem(/** @type {any} */ wanted) {
        const entry = newCollections[wanted.collectionIndex];
        if (!entry) return false;
        if (entry.origin !== 'base') {
            const dims = Object.keys(dimEntry).filter(d => dimEntry[d] === wanted.collectionIndex);
            for (const d of dims) if (dimCollection[d] && itemIn(dimCollection[d].id, wanted.name)) return true;
            return false;
        }
        const cands = collsNamed(wanted.collection);
        const isForeign = (/** @type {any} */ c) => items.some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(groupPrefix));
        return [...cands.filter(c => !isForeign(c)), ...cands.filter(isForeign)].some(c => itemIn(c.id, wanted.name));
    }
    const created = newItems.filter(i => !matchingItem(i));
    const summary = {
        variables: created.length,
        fills: newItems.length - created.length,
        collections: [...new Set(newItems.map(i => i.collection))],
        modes: [...new Set(newCollections.filter(c => c.origin === 'component').map(c => `${c.name} (${c.modes.join(', ')})`))],
        boundProperties,
        rebound,
        derived: derived.map(d => d.name),
        needsValue: needsValue.map(n => n.name),
        unfixable: unfixable.map(u => `${u.name} (${u.reason})`),
    };
    const fixable = created.length > 0 || summary.fills > 0 || rebound > 0 || Object.keys(bindingUpdates).length > 0;
    return { fixable, group: template.group, plan: { collections: newCollections, items: newItems }, bindingUpdates, derived, needsValue, unfixable, summary };
}

/**
 * Applies an Auto Fix plan to the store and the master's binding. Same idempotent semantics as `applyBasePlan`:
 * existing collections, modes, variables and valid bindings are never overwritten or renamed. Collections route by
 * plan identity, so same-named collections stay separate.
 * @param {{ collections: any[], items: any[] }} store
 * @param {{ variables: Record<string, string | null> }} binding the master's binding (mutated in place)
 * @param {{ group?: string, plan: { collections: { name: string, modes: string[] }[], items: any[] }, bindingUpdates: Record<string, string> }} autoFix
 * @param {() => string} uid the id maker
 */
export function applyAutoFix(store, binding, autoFix, uid) {
    const stats = { collections: 0, items: 0, modes: 0, aliases: 0 };
    const keyOf = (/** @type {unknown} */ name) => String(name ?? '').trim().toLowerCase().replace(/-/g, '');
    const usedIds = new Set();
    const preIds = new Set((store.collections || []).map(c => c.id));
    const collIdOf = [];
    for (const wanted of autoFix.plan.collections) {
        // Base entries merge into a pre-existing same-named collection; component entries consume exclusively so a
        // component collection sharing a base name stays its own collection.
        const reuse = wanted.origin === 'base'
            ? (store.collections || []).find(c => c.name === wanted.name && preIds.has(c.id))
            : (store.collections || []).find(c => c.name === wanted.name && !usedIds.has(c.id));
        if (reuse) {
            for (const mode of wanted.modes) {
                if (!reuse.modes.some(m => m.name === mode)) { reuse.modes.push({ id: uid(), name: mode }); stats.modes++; }
            }
            usedIds.add(reuse.id);
            collIdOf.push(reuse.id);
            continue;
        }
        const coll = { id: uid(), name: wanted.name, modes: wanted.modes.map(m => ({ id: uid(), name: m })) };
        store.collections.push(coll);
        usedIds.add(coll.id);
        collIdOf.push(coll.id);
        stats.collections++;
    }
    /** @type {Map<string, any>} */
    const byId = new Map();
    const findItem = (/** @type {string} */ collectionId, /** @type {string} */ name) => byId.get(collectionId + '|' + name)
        ?? (store.items || []).find(i => i.collectionId === collectionId && i.name === name)
        ?? (store.items || []).find(i => i.collectionId === collectionId && keyOf(i.name) === keyOf(name));
    const modeIdOf = (/** @type {any} */ coll, /** @type {string} */ mode) => coll.modes.find(m => m.name === mode)?.id;
    const targetOf = (/** @type {{ collectionIndex: number, name: string }} */ alias) => {
        const cid = collIdOf[alias.collectionIndex];
        const target = cid === undefined ? undefined : findItem(cid, alias.name);
        return { cid, target };
    };
    for (const wanted of autoFix.plan.items) {
        const cid = collIdOf[wanted.collectionIndex];
        if (cid === undefined) continue;
        let item = (store.items || []).find(i => i.collectionId === cid && i.name === wanted.name);
        if (!item) { item = { id: uid(), collectionId: cid, name: wanted.name, type: wanted.type, values: {} }; store.items.push(item); stats.items++; }
        if (item.type !== wanted.type) continue;
        byId.set(cid + '|' + wanted.name, item);
    }
    for (const wanted of autoFix.plan.items) {
        const cid = collIdOf[wanted.collectionIndex];
        if (cid === undefined) continue;
        const item = findItem(cid, wanted.name);
        if (!item || item.type !== wanted.type) continue;
        const coll = (store.collections || []).find(c => c.id === cid);
        for (const [mode, value] of Object.entries(wanted.values)) {
            const id = coll && modeIdOf(coll, mode);
            if (!id || (item.values[id] !== undefined && wanted.repair !== true)) continue;
            if (value.needsValue) { item.values[id] = { color: '#d9d9d9', number: 0, string: '', boolean: false }[wanted.type] ?? null; item.needsValue = true; }
            else if (value.literal !== undefined) item.values[id] = value.literal;
            else if (value.alias) {
                const { cid: tcid, target } = targetOf(value.alias);
                if (tcid === undefined || !target || target.type !== item.type || target.id === item.id) continue;
                const applied = { alias: target.id };
                if (typeof value.opacity === 'number') applied.opacity = value.opacity;
                item.values[id] = applied;
                stats.aliases++;
            }
        }
    }
    let bindings = 0;
    const prefix = `${String(autoFix.group ?? '').toLowerCase()}/`;
    for (const [dim, name] of Object.entries(autoFix.bindingUpdates)) {
        const current = binding.variables[dim];
        if (current != null && (store.collections || []).some(c => c.id === current)) continue;
        const cands = (store.collections || []).filter(c => c.name === name);
        const coll = cands.find(c => (store.items || []).some(i => i.collectionId === c.id && i.name.toLowerCase().startsWith(prefix))) ?? cands[0];
        if (!coll) continue;
        binding.variables[dim] = coll.id;
        bindings++;
    }
    return { ...stats, bindings };
}
