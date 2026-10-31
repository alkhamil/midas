// Base token importer (pure). Reads a token JSON in the Figma variables shape — a list where each item is one collection
// with one mode (`{ "<Collection>": { modes: { "<Mode>": nested groups of { $type, $value } } } }`) — and turns it into
// resolved token sources. No component-specific code: every collection is parsed the same way, and references (`{a.b.c}`)
// resolve by path against the parsed sources (same collection first, then the others in source order). Unresolved refs are
// reported, never replaced with literals.
export const SOURCE_ORDER = ['Primitives', 'Semantic', 'Size', 'Typography', 'Size icons'];

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
