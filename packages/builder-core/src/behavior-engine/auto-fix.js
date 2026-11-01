// Auto Fix (pure). Plans and applies what a bound master is missing: required collections, modes and variables per
// the template schema, with values that alias base variables by role. Component variables alias base variables (or
// other component variables of the same template, followed through the bound collection); never Primitives, never
// literals. Nothing existing is overwritten or renamed: modes, variables and bindings are kept, missing mode values
// are only filled. Collections resolve by the schema declaration (name and modes): a same-named collection is shared
// only when its modes match the schema's exactly, otherwise the template gets its own "<Template> <Name>" collection
// and the frame rebinds to it; a collection serving another template is never altered. Collections are routed by plan
// identity, never by name alone, so a component collection sharing a base name (component `Size` vs base `Size`)
// stays its own collection. Unfixable findings (structural) are reported, never touched.
import { TEMPLATES, variableProps } from './registry.js';
import { variableKey, splitColor, withOpacity, restOf } from './tokens.js';
import { planBindTokens } from './bind-tokens.js';
import { dimensionOfGroup } from './validate-schema.js';
import ROLES from '../base-tokens/roles.json' with { type: 'json' };
import BASE_SNAPSHOT from '../base-tokens/base-snapshot.json' with { type: 'json' };
import { planFromSnapshot } from '../base-tokens/importer.js';
/** The bundled base as a plan: the snapshot with the Semantic text styles, the same items Generate base applies. */
const BASE_PLAN = planFromSnapshot(BASE_SNAPSHOT);

export { ROLES };

/** Names of the base collections Auto Fix reads aliases from: exactly the Generate base output. */
export const BASE_COLLECTIONS = ['Primitives', 'Semantic', 'Typography'];

const modeKey = (/** @type {unknown} */ s) => String(s ?? '').toLowerCase();
const varTypeOf = (/** @type {string} */ kind) => kind === 'color' ? 'color' : kind === 'length' || kind === 'ratio' ? 'number' : kind === 'typography' ? 'typography' : null;

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

/** A `./token` reference is a component variable; anything else is a base role name. */
const isRef = (/** @type {string} */ role) => typeof role === 'string' && role.startsWith('./');

/**
 * Plans the Auto Fix for one bound master. Pure: the store is only read. The creation plan applies through
 * `applyAutoFix` (same idempotent semantics as base generation); `summary.boundProperties` counts the layer bindings
 * the existing auto-bind pipeline then writes, for the confirm message.
 * @param {{ template: any, binding: { variables: Record<string, string | null> }, variables: { collections?: any[], items?: any[] }, layers?: any[], roles?: any, baseSnapshot?: any }} input
 */
export function planAutoFix({ template, binding, variables, layers = [], roles = ROLES, baseSnapshot = BASE_PLAN }) {
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
    const collsNamed = (/** @type {string} */ name) => collections.filter(c => c.name === name);
    const componentNs = [...TEMPLATES.values()].map(t => `${t.name} `);
    const isComponentColl = (/** @type {any} */ c) => componentNs.some(ns => c.name.startsWith(ns));
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
    // Collection resolution is deterministic and never order-dependent: every template collection is always
    // "<Template> <Name>", so the first frame bound and the next one resolve the same names. A bound dimension stays
    // on its collection when it is the template's own (custom modes included); bound anywhere else it rebinds to its
    // own. An unbound dimension reuses the single same-named collection or creates it; duplicate names fail.
    const ownName = (/** @type {any} */ def) => `${template.name} ${def.collection}`;
    const schemaModes = (/** @type {any} */ def) => Array.isArray(def.modes) ? def.modes : [];
    /** @type {Record<string, any>} */
    const dimCollection = {};
    /** @type {Record<string, number>} */
    const dimEntry = {};
    /** @type {{ dim: string, from: string | null, to: string }[]} */
    const reboundDims = [];
    const dimDef = (/** @type {string} */ dim) => variableProps(template).find(([d]) => d === dim)?.[1];
    /** Rebinds a dimension to the template's own collection, creating it when it does not exist yet. */
    const toOwn = (/** @type {string} */ dim, /** @type {any} */ def, /** @type {string | null} */ from) => {
        const name = ownName(def);
        const cands = collsNamed(name);
        if (cands.length > 1) { fail(dim, `${cands.length} collections named "${name}"`); return; }
        dimEntry[dim] = collEntry(name, schemaModes(def), 'component');
        bindingUpdates[dim] = name;
        dimCollection[dim] = cands[0] ?? null;
        reboundDims.push({ dim, from, to: name });
    };
    const useCollection = (/** @type {string} */ dim, /** @type {any} */ def, /** @type {any} */ coll) => {
        dimCollection[dim] = coll;
        dimEntry[dim] = collEntry(coll.name, schemaModes(def), 'component');
    };
    for (const [dim, def] of variableProps(template)) {
        const boundId = binding.variables[dim];
        const bound = boundId ? collections.find(c => c.id === boundId) : null;
        if (bound && bound.name === ownName(def)) { useCollection(dim, def, bound); continue; }
        if (bound) { toOwn(dim, def, bound.name); continue; }
        const cands = collsNamed(ownName(def));
        if (cands.length > 1) { fail(dim, `${cands.length} collections named "${ownName(def)}"`); continue; }
        if (cands.length === 1) {
            bindingUpdates[dim] = cands[0].name;
            useCollection(dim, def, cands[0]);
            continue;
        }
        dimEntry[dim] = collEntry(ownName(def), schemaModes(def), 'component');
        bindingUpdates[dim] = ownName(def);
        dimCollection[dim] = null;
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
        const ordered = [...cands.filter(c => !isComponentColl(c)), ...cands.filter(isComponentColl)];
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
            derived.push({ name: `${baseColl}/${baseName}`, reason: `alias to ${derive.from}${typeof derive.opacity === 'number' ? ` at ${derive.opacity}%` : ''}` });
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
    /** Follows a component reference (`./token`) to the variable it names in its bound collection. */
    const followRef = (/** @type {string} */ ref, /** @type {Set<string>} */ guard) => {
        const token = ref.slice(2);
        if (!allTokens.includes(token)) { fail(ref, `is not a token variable of this template`); return null; }
        if (guard.has(ref)) { fail(ref, `refers to itself`); return null; }
        const dim = dimOfToken(token);
        if (!dim || !(dim in dimCollection) || !(dim in dimEntry)) { fail(ref, `its dimension is not fixable`); return null; }
        const coll = dimCollection[dim];
        if (plannedVar(coll, dimDef(dim)?.collection, dimEntry[dim], token)) return { collectionIndex: dimEntry[dim], name: token };
        guard.add(ref);
        const planned = ensureVariable(dim, token, guard);
        guard.delete(ref);
        if (!planned) return null;
        return { collectionIndex: dimEntry[dim], name: token };
    };
    /** Plans one component variable (missing values only); null when it cannot be made. */
    function ensureVariable(dim, token, guard = new Set()) {
        const def = dimDef(dim);
        if (!def) return null;
        const coll = dimCollection[dim];
        const collectionName = coll ? coll.name : def.collection;
        const varName = token;
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
    const storedLiteral = (item, modeName, guard = new Set(), ops = []) => {
        if (!item || guard.has(item.id)) return undefined;
        guard.add(item.id);
        const modes = collections.find(c => c.id === item.collectionId)?.modes ?? [];
        const modeId = modes.find(m => modeKey(m.name) === modeKey(modeName))?.id
            ?? modes.find(m => item.values?.[m.id] !== undefined)?.id ?? modes[0]?.id;
        const value = modeId === undefined ? undefined : item.values?.[modeId];
        if (typeof value === 'number' || typeof value === 'string') {
            let text = value;
            for (let k = ops.length - 1; k >= 0; k--) {
                if (typeof text === 'string' && splitColor(text)) text = withOpacity(text, ops[k]);
            }
            return text;
        }
        if (value && typeof value === 'object' && typeof value.alias === 'string') {
            if (value.opacity != null && value.opacity < 100) ops.push(value.opacity);
            return storedLiteral(items.find(i => i.id === value.alias), modeName, guard, ops);
        }
        return undefined;
    };
    // Rest colours that must stay transparent resolve through the transparent token. A stored value that is
    // opaque or not Semantic-aliased is repaired like a ratio leftover: the value is overwritten with the role alias.
    // The transparent base marks these tokens; no token name is special-cased.
    let transparentRepaired = 0;
    for (const [dim] of variableProps(template)) {
        if (!(dim in dimCollection)) continue;
        const coll = dimCollection[dim];
        for (const [group, names] of Object.entries(template.tokens ?? {})) {
            if (dimensionOfGroup(group, template.props) !== dim) continue;
            for (const token of names) {
                const varName = token;
                const have = coll ? itemIn(coll.id, varName) : null;
                if (!have || have.type !== 'color') continue;
                for (const mode of modesOf(dim)) {
                    const role = roleOf(template, token, mode);
                    if (!role || typeof role !== 'string' || isRef(role) || ROLES[role]?.base !== 'Semantic/colorTransparent') continue;
                    const hasMode = coll.modes.some(m => modeKey(m.name) === modeKey(mode));
                    if (!hasMode) continue;
                    const modeId = coll.modes.find(m => modeKey(m.name) === modeKey(mode))?.id;
                    const chain = modeId === undefined ? undefined : restOf(have, mode, items, collections);
                    if (!chain?.trail.includes('Semantic')) continue;
                    const split = typeof chain.literal === 'string' && splitColor(chain.literal);
                    if (split && split.alpha === 0) continue;
                    const target = baseTarget(role, 'color', `${coll.name}/${varName}.${mode}`);
                    if (!target) continue;
                    newItems.push({ collection: coll.name, collectionIndex: dimEntry[dim], name: varName, type: 'color', values: { [mode]: { alias: { collectionIndex: target.collectionIndex, name: target.name } } }, repair: true });
                    transparentRepaired++;
                }
            }
        }
    }
    // Provenance: every other set component value resolves through Semantic. One that does not is rebound
    // to its role alias (a ref role follows the template chain, like creation does); a missing role stays
    // missing and is reported, never defaulted. Schema vocabulary only: no token name is special-cased.
    let provenanceRepaired = 0;
    for (const [dim] of variableProps(template)) {
        if (!(dim in dimCollection)) continue;
        const coll = dimCollection[dim];
        for (const [group, names] of Object.entries(template.tokens ?? {})) {
            if (dimensionOfGroup(group, template.props) !== dim) continue;
            for (const token of names) {
                const varName = token;
                const have = coll ? itemIn(coll.id, varName) : null;
                const kind = template.tokenKinds?.[token];
                const type = kind === 'color' ? 'color' : kind === 'length' || kind === 'ratio' ? 'number' : null;
                if (!have || !type || have.type !== type) continue;
                for (const mode of modesOf(dim)) {
                    const hasMode = coll.modes.some(m => modeKey(m.name) === modeKey(mode));
                    if (!hasMode) continue;
                    const modeId = coll.modes.find(m => modeKey(m.name) === modeKey(mode))?.id;
                    if (modeId === undefined || have.values?.[modeId] === undefined) continue;
                    if (restOf(have, mode, items, collections)?.trail.includes('Semantic')) continue;
                    const role = roleOf(template, token, mode);
                    if (!role || typeof role !== 'string') continue;
                    const target = isRef(role) ? followRef(role, new Set()) : baseTarget(role, type, `${coll.name}/${varName}.${mode}`);
                    if (!target) continue;
                    newItems.push({ collection: coll.name, collectionIndex: dimEntry[dim], name: varName, type, values: { [mode]: { alias: { collectionIndex: target.collectionIndex, name: target.name } } }, repair: true });
                    provenanceRepaired++;
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
            const coll = merged.collections.filter(c => c.name === name)[0];
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
        return cands.some(c => itemIn(c.id, wanted.name));
    }
    const created = newItems.filter(i => !matchingItem(i));
    const summary = {
        variables: created.length,
        fills: newItems.length - created.length,
        collections: [...new Set(newItems.map(i => i.collection))],
        modes: [...new Set(newCollections.filter(c => c.origin === 'component').map(c => `${c.name} (${c.modes.join(', ')})`))],
        boundProperties,
        transparentRepaired,
        provenanceRepaired,
        derived: derived.map(d => d.name),
        needsValue: needsValue.map(n => n.name),
        unfixable: unfixable.map(u => `${u.name} (${u.reason})`),
        createdCollections: [...new Set(newCollections.filter(c => c.origin === 'component' && !collections.some(e => e.name === c.name)).map(c => c.name))],
        reboundDims,
    };
    const fixable = created.length > 0 || summary.fills > 0 || Object.keys(bindingUpdates).length > 0;
    return { fixable, plan: { collections: newCollections, items: newItems }, bindingUpdates, derived, needsValue, unfixable, summary };
}

/**
 * Applies an Auto Fix plan to the store and the master's binding. Same idempotent semantics as `applyBasePlan`:
 * existing collections, modes, variables and valid bindings are never overwritten or renamed. Collections route by
 * plan identity, so same-named collections stay separate.
 * @param {{ collections: any[], items: any[] }} store
 * @param {{ variables: Record<string, string | null> }} binding the master's binding (mutated in place)
 * @param {{ plan: { collections: { name: string, modes: string[] }[], items: any[] }, bindingUpdates: Record<string, string> }} autoFix
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
                if (!reuse.modes.some(m => modeKey(m.name) === modeKey(mode))) { reuse.modes.push({ id: uid(), name: mode }); stats.modes++; }
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
            if (value.needsValue) { item.needsValue = true; }
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
    for (const [dim, name] of Object.entries(autoFix.bindingUpdates)) {
        // The plan resolves every update explicitly (a rebind moves a slot off another template's collection), so an
        // update always wins; a slot already pointing at the resolved collection is left alone.
        const cands = (store.collections || []).filter(c => c.name === name);
        const coll = cands[0];
        if (!coll || binding.variables[dim] === coll.id) continue;
        binding.variables[dim] = coll.id;
        bindings++;
    }
    return { ...stats, bindings };
}
