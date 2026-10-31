// Base token importer (pure). Reads a token JSON in the Figma variables shape — a list where each item is one collection
// with one mode (`{ "<Collection>": { modes: { "<Mode>": nested groups of { $type, $value } } } }`) — and turns it into
// resolved token sources. No component-specific code: every collection is parsed the same way, and references (`{a.b.c}`)
// resolve by path against the parsed sources (same collection first, then the others in source order). Unresolved refs are
// reported, never replaced with literals.
import ANT_MAP from './ant-map.json' with { type: 'json' };
export const SOURCE_ORDER = ['Primitives', 'Semantic', 'Size', 'Typography', 'Size icons'];
export { ANT_MAP };

/** The variable type a token `$type` becomes; null when the JSON type has no variable kind. */
export const VARIABLE_TYPE = { color: 'color', float: 'number', string: 'string', boolean: 'boolean' };

/**
 * One deterministic sanitize rule for token names: a comma is a decimal point (`stroke/1,5` -> `stroke/1.5`), `%`
 * becomes `pct` (`disabled-5%` -> `disabled-5pct`), a space becomes a dash (`line height` -> `line-height`).
 * @param {string} path the slash-joined token path
 * @returns {{ name: string, renamed: boolean }}
 */
export function sanitizeTokenName(path) {
    const name = path.replace(/,/g, '.').replace(/%/g, 'pct').replace(/ /g, '-');
    return { name, renamed: name !== path };
}

/**
 * Parses the token JSON into sources. Entries with the same collection name merge into one collection with one entry
 * per mode; groups flatten to slash paths; names are sanitized (the reverse map is kept for the report).
 * @param {unknown} data the parsed token JSON (a list of single-collection items)
 * @returns {{ sources: { name: string, modes: Record<string, { path: string, type: string, raw: unknown }[]> }[], renames: [string, string][], unknownTypes: { collection: string, mode: string, path: string, type: unknown }[] }}
 */
export function parseTokenJson(data) {
    const list = Array.isArray(data) ? data : [data];
    /** @type {Map<string, { name: string, modes: Record<string, { path: string, type: string, raw: unknown }[]> }>} */
    const sources = new Map();
    /** @type {[string, string][]} */
    const renames = [];
    /** @type {{ collection: string, mode: string, path: string, type: unknown }[]} */
    const unknownTypes = [];
    for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        for (const [collection, cv] of Object.entries(entry)) {
            const modes = cv && typeof cv === 'object' && cv.modes && typeof cv.modes === 'object' ? cv.modes : null;
            if (!modes) continue;
            let source = sources.get(collection);
            if (!source) { source = { name: collection, modes: {} }; sources.set(collection, source); }
            for (const [mode, tree] of Object.entries(modes)) {
                const tokens = source.modes[mode] ?? (source.modes[mode] = []);
                const seen = new Map(tokens.map(t => [t.path, t]));
                const walk = (/** @type {any} */ node, /** @type {string[]} */ path) => {
                    if (!node || typeof node !== 'object') return;
                    if (path.length && ('$value' in node)) {
                        const rawPath = path.join('/');
                        const { name, renamed } = sanitizeTokenName(rawPath);
                        if (renamed) renames.push([`${collection}/${rawPath}`, `${collection}/${name}`]);
                        const type = VARIABLE_TYPE[/** @type {string} */ (node.$type)] ?? null;
                        if (!type) { unknownTypes.push({ collection, mode, path: name, type: node.$type }); return; }
                        const token = { path: name, type, raw: node.$value };
                        if (seen.has(name)) seen.get(name).raw = node.$value;
                        else { seen.set(name, token); tokens.push(token); }
                        return;
                    }
                    for (const [key, child] of Object.entries(node)) {
                        if (!key.startsWith('$')) walk(child, [...path, key]);
                    }
                };
                walk(tree, []);
            }
        }
    }
    return { sources: [...sources.values()], renames, unknownTypes };
}

/** @param {unknown} value */
const refOf = value => typeof value === 'string' ? /^\{(.+)\}$/.exec(value.trim())?.[1] ?? null : null;

/**
 * Resolves every token reference to the variable it points at. A ref `{a.b.c}` names a slash path; it is looked up in
 * the token's own collection first, then in the other sources in source order. Exactly one holder must match; none or
 * several report the ref as unresolved.
 * @param {{ name: string, modes: Record<string, { path: string, type: string, raw: unknown }[]> }[]} sources
 * @param {string[]} [only] the collections refs may resolve against (defaults to all parsed sources)
 * @returns {{ unresolved: { collection: string, mode: string, path: string, ref: string }[] }} the tokens carry `resolved`
 */
export function resolveTokenRefs(sources, only = sources.map(s => s.name)) {
    /** @type {Map<string, { collection: string, path: string }[]>} */
    const holders = new Map();
    for (const source of sources) {
        if (!only.includes(source.name)) continue;
        const paths = new Set();
        for (const tokens of Object.values(source.modes)) for (const t of tokens) paths.add(t.path);
        for (const path of paths) {
            const list = holders.get(path) ?? [];
            list.push({ collection: source.name, path });
            holders.set(path, list);
        }
    }
    /** @type {{ collection: string, mode: string, path: string, ref: string }[]} */
    const unresolved = [];
    const order = (name, a, b) => (a.collection === name ? 0 : 1) - (b.collection === name ? 0 : 1)
        || SOURCE_ORDER.indexOf(a.collection) - SOURCE_ORDER.indexOf(b.collection);
    for (const source of sources) {
        for (const [mode, tokens] of Object.entries(source.modes)) {
            for (const token of tokens) {
                const ref = refOf(token.raw);
                if (!ref) { token.resolved = { kind: 'literal', value: token.raw }; continue; }
                const path = sanitizeTokenName(ref.replace(/\./g, '/')).name;
                const found = (holders.get(path) ?? []).sort((a, b) => order(source.name, a, b));
                if (found.length !== 1) { unresolved.push({ collection: source.name, mode, path: token.path, ref }); continue; }
                token.resolved = { kind: 'ref', collection: found[0].collection, path: found[0].path };
            }
        }
    }
    return { unresolved };
}

/** The placeholder value of a variable flagged "needs value" (mirrors the studio's empty-variable defaults). */
export const NEEDS_VALUE_DEFAULT = { color: '#d9d9d9', number: 0, string: '', boolean: false };

/** A resolved literal or alias target: `{ collection, name, type }`, or null when it cannot become a variable. */
function targetOf(sourcesByName, collection, path, mode, guard = []) {
    const key = `${collection}/${mode}/${path}`;
    if (guard.includes(key)) return null;
    const source = sourcesByName.get(collection);
    const token = source?.modes[mode]?.find(t => t.path === path);
    if (!token || !token.resolved) return null;
    if (token.resolved.kind === 'literal') return { collection, name: path, type: token.type, literal: token.raw };
    const next = correspondingMode(sourcesByName, token.resolved.collection, mode);
    if (!next) return null;
    return targetOf(sourcesByName, token.resolved.collection, token.resolved.path, next, [...guard, key]);
}

/** The JSON mode a ref target is read in: the same mode name when the target has it, else its single mode. */
function correspondingMode(sourcesByName, collection, mode) {
    const modes = Object.keys(sourcesByName.get(collection)?.modes ?? {});
    if (modes.includes(mode)) return mode;
    if (modes.length === 1) return modes[0];
    return null;
}

/**
 * Builds the base variable plan from parsed token sources through the Ant-name mapping. Primitives and Typography keep
 * the JSON names as literals; Semantic and Size use Ant global names as aliases; Icons takes its sizes from Size icons
 * and its colors as aliases to Semantic. Every mapping ref must resolve, or the build throws naming it (an unmappable
 * name belongs in the mapping as derived or needs-value, never as a silent literal).
 * @param {{ sources: { name: string, modes: Record<string, { path: string, type: string, raw: unknown }[]> }[], renames: [string, string][], unknownTypes: unknown[] }} parsed
 * @param {any} [antMap] the mapping (defaults to the bundled ant-map.json)
 * @returns {{ collections: { name: string, modes: string[] }[], items: { collection: string, name: string, type: string, values: Record<string, { literal: unknown } | { alias: { collection: string, name: string } } | { needsValue: true, note: string }> }[], report: { created: string[], derived: { name: string, reason: string }[], needsValue: { name: string, reason: string }[], renamed: [string, string][], unresolved: { collection: string, mode: string, path: string, ref: string }[] } }}
 */
export function buildBasePlan(parsed, antMap = ANT_MAP) {
    const only = SOURCE_ORDER.filter(n => parsed.sources.some(s => s.name === n));
    const { unresolved } = resolveTokenRefs(parsed.sources, only);
    const inScope = unresolved.filter(u => only.includes(u.collection));
    const sourcesByName = new Map(parsed.sources.map(s => [s.name, s]));
    /** @type {{ collection: string, name: string, type: string, values: Record<string, any> }[]} */
    const items = [];
    /** @type {{ name: string, reason: string }[]} */
    const derived = [], needsValue = [];
    const fail = (/** @type {string} */ what) => { throw new Error(`Base variables: ${what}`); };
    /** Follows a mapping ref to the generated variable it aliases, or records why it cannot. Like a token ref, the path is looked up in its own source first, then in the other sources. */
    const aliasTo = (/** @type {string} */ collection, /** @type {string} */ mode, /** @type {string} */ path, /** @type {string} */ owner) => {
        const ordered = [collection, ...only.filter(n => n !== collection)];
        const holder = ordered.find(name => (sourcesByName.get(name)?.modes[mode] ?? []).some(t => t.path === path))
            ?? ordered.find(name => Object.values(sourcesByName.get(name)?.modes ?? {}).some(tokens => tokens.some(t => t.path === path)));
        if (!holder) fail(`${owner} points at missing ${collection}/${mode}/${path}`);
        const useMode = (sourcesByName.get(holder)?.modes[mode] ?? []).some(t => t.path === path) ? mode : Object.keys(sourcesByName.get(holder)?.modes ?? {})[0];
        const target = targetOf(sourcesByName, holder, path, useMode);
        if (!target) { needsValue.push({ name: owner, reason: `no literal behind ${collection}/${path}` }); return null; }
        return target;
    };
    const pushRaw = (/** @type {string} */ collection, /** @type {string} */ mode) => {
        for (const token of sourcesByName.get(collection)?.modes[mode] ?? []) {
            items.push({ collection, name: token.path, type: token.type, values: { [mode]: { literal: token.raw } } });
        }
    };
    // Primitives and Typography: raw data, one item per token.
    for (const mode of antMap.Primitives.modes) pushRaw(antMap.Primitives.source, mode);
    for (const mode of antMap.Typography.modes) pushRaw(antMap.Typography.source, mode);
    // Semantic and Size: Ant names as aliases into the JSON values.
    for (const [section, wantType] of [['Semantic', 'color'], ['Size', 'number']]) {
        const map = antMap[section];
        for (const [antName, entry] of Object.entries(map.items)) {
            const values = {};
            for (const mode of map.modes) {
                const jsonMode = map.jsonModes ? map.jsonModes[mode] : mode;
                if (entry.needsValue) { values[mode] = { needsValue: true, note: entry.reason ?? 'no fitting JSON value' }; continue; }
                const target = aliasTo(map.source, jsonMode, entry[mode], `${section}/${antName}.${mode}`);
                if (!target) { values[mode] = { needsValue: true, note: `no literal behind ${map.source}/${entry[mode]}` }; continue; }
                if (target.type !== wantType) fail(`${section}/${antName} reaches a ${target.type}, not a ${wantType}`);
                values[mode] = { alias: { collection: target.collection, name: target.name } };
            }
            items.push({ collection: section, name: antName, type: wantType, values });
            const owner = `${section}/${antName}`;
            if (entry.derived) derived.push({ name: owner, reason: entry.role });
            if (Object.values(values).some(v => v.needsValue)) needsValue.push({ name: owner, reason: entry.reason ?? entry.role ?? 'unresolved chain' });
        }
    }
    // Icons: sizes from Size icons, colors as aliases to Semantic (single mode; aliases follow the target's mode).
    for (const mode of antMap.Icons.modes) {
        for (const token of sourcesByName.get(antMap.Icons.sizes.source)?.modes[mode] ?? []) {
            items.push({ collection: 'Icons', name: `${antMap.Icons.sizes.prefix}${token.path}`, type: token.type, values: { [mode]: { literal: token.raw } } });
        }
    }
    for (const [name, entry] of Object.entries(antMap.Icons.colors)) {
        const [targetCollection, targetName] = entry.target.includes(':') ? entry.target.split(':') : ['Semantic', entry.target];
        items.push({ collection: 'Icons', name, type: 'color', values: Object.fromEntries(antMap.Icons.modes.map(m => [m, { alias: { collection: targetCollection, name: targetName } }])) });
        if (entry.derived) derived.push({ name: `Icons/${name}`, reason: entry.role });
    }
    const created = [...new Set(items.map(i => `${i.collection}/${i.name}`))];
    return { collections: ['Primitives', 'Semantic', 'Size', 'Typography', 'Icons'].map(name => ({ name, modes: antMap[name].modes })), items, report: { created, derived, needsValue, renamed: parsed.renames, unresolved: inScope } };
}

/**
 * Applies a base plan to a variable store (`{ collections, items }`, the document shape). Idempotent: a second run
 * creates nothing — existing collections keep their ids and modes, existing variables are never overwritten or renamed,
 * only missing mode values are filled. Runs synchronously in one pass, so the caller can wrap it in one undo step.
 * @param {{ collections: any[], items: any[] }} store
 * @param {{ collections: { name: string, modes: string[] }[], items: { collection: string, name: string, type: string, values: Record<string, any> }[] }} plan
 * @param {() => string} uid the id maker
 * @returns {{ collections: number, items: number, modes: number, aliases: number }}
 */
export function applyBasePlan(store, plan, uid) {
    const stats = { collections: 0, items: 0, modes: 0, aliases: 0 };
    const keyOf = (/** @type {unknown} */ name) => String(name ?? '').trim().toLowerCase().replace(/-/g, '');
    const collByName = new Map(store.collections.map(c => [c.name, c]));
    for (const wanted of plan.collections) {
        let coll = collByName.get(wanted.name);
        if (!coll) { coll = { id: uid(), name: wanted.name, modes: [] }; store.collections.push(coll); collByName.set(wanted.name, coll); stats.collections++; }
        for (const mode of wanted.modes) {
            if (!coll.modes.some(m => m.name === mode)) { coll.modes.push({ id: uid(), name: mode }); stats.modes++; }
        }
    }
    const exactByKey = new Map(store.items.map(i => [i.collectionId + '|' + i.name, i]));
    const itemByKey = new Map(store.items.map(i => [i.collectionId + '|' + keyOf(i.name), i]));
    // An exact name wins (`spacing/-6` is not `spacing/6`); the normalized key only catches case variants.
    const findItem = (/** @type {string} */ collectionId, /** @type {string} */ name) => exactByKey.get(collectionId + '|' + name) ?? itemByKey.get(collectionId + '|' + keyOf(name));
    const modeIdOf = (/** @type {any} */ coll, /** @type {string} */ mode) => coll.modes.find(m => m.name === mode)?.id;
    // First literals and placeholders, so aliases always find their targets.
    for (const wanted of plan.items) {
        const coll = collByName.get(wanted.collection);
        if (!coll) continue;
        // An exact name decides creation (`spacing/-6` is its own variable); normalized keys only resolve alias targets.
        let item = exactByKey.get(coll.id + '|' + wanted.name);
        if (!item) { item = { id: uid(), collectionId: coll.id, name: wanted.name, type: wanted.type, values: {} }; store.items.push(item); exactByKey.set(coll.id + '|' + item.name, item); itemByKey.set(coll.id + '|' + keyOf(item.name), item); stats.items++; }
        if (item.type !== wanted.type) continue;
        for (const [mode, value] of Object.entries(wanted.values)) {
            const id = modeIdOf(coll, mode);
            if (!id || item.values[id] !== undefined) continue;
            if (value.needsValue) { item.values[id] = NEEDS_VALUE_DEFAULT[wanted.type] ?? null; item.needsValue = true; }
            else if (value.literal !== undefined) item.values[id] = value.literal;
        }
    }
    for (const wanted of plan.items) {
        const coll = collByName.get(wanted.collection);
        if (!coll) continue;
        const item = findItem(coll.id, wanted.name);
        if (!item || item.type !== wanted.type) continue;
        for (const [mode, value] of Object.entries(wanted.values)) {
            const id = modeIdOf(coll, mode);
            if (!id || item.values[id] !== undefined || !value.alias) continue;
            const targetColl = collByName.get(value.alias.collection);
            const target = targetColl && findItem(targetColl.id, value.alias.name);
            if (target && target.type === item.type && target.id !== item.id) { item.values[id] = { alias: target.id }; stats.aliases++; }
        }
    }
    return stats;
}
