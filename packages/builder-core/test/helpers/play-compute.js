// A small CSS evaluator for the parity tests: the declarations a Play element ends up with, from the stylesheet the export writes. It understands what that
// stylesheet uses: compound selectors of a class, attribute tests, :not([attr]), :disabled, and the descendant combinator, in source order (a later equal rule
// wins), and var(--x) read from the custom properties of the element and its ancestors. Hover and focus never apply (they are not a resting state).
const parseRules = css => [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ selector: m[1].trim(), decls: [...m[2].matchAll(/([a-z-]+|--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(d => [d[1], d[2].trim()]) }));

const has = (el, name, value) => {
    const v = el.attrs[name];
    return value === undefined ? v !== undefined && v !== false : String(v) === value;
};

/** Whether one compound selector (no spaces) matches an element. */
function matchesCompound(compound, el) {
    // A rule for a pseudo-element (::placeholder, ::-webkit-resizer) styles a part of the element, never the element.
    if (compound.includes('::')) return false;
    const cls = /^\.([A-Za-z0-9-]+)/.exec(compound)?.[1];
    if (cls && el.attrs.class !== cls) return false;
    const rest = cls ? compound.slice(cls.length + 1) : compound;
    for (const m of rest.matchAll(/:not\(:disabled\)|:not\(\[([^\]=]+)(?:="([^"]*)")?\]\)|\[([^\]=]+)(?:="([^"]*)")?\]|:(disabled)|:(hover|focus-visible|focus|active)|:(has\([^)]*\))/g)) {
        if (m[0] === ':not(:disabled)') { if (has(el, 'disabled') || el.attrs['aria-disabled'] === 'true') return false; }
        else if (m[1] !== undefined) { if (has(el, m[1], m[2])) return false; }
        else if (m[3] !== undefined) { if (!has(el, m[3], m[4])) return false; }
        else if (m[5]) { if (!has(el, 'disabled') && el.attrs['aria-disabled'] !== 'true') return false; }
        else return false;
    }
    return true;
}

/** Whether a selector (descendant combinators allowed) matches the element at the end of the chain (root first). */
function matches(selector, chain) {
    const parts = selector.split(/\s+/);
    let at = chain.length - 1;
    if (!matchesCompound(parts.at(-1), chain[at])) return false;
    for (let i = parts.length - 2; i >= 0; i--) {
        at--;
        while (at >= 0 && !matchesCompound(parts[i], chain[at])) at--;
        if (at < 0) return false;
    }
    return true;
}

/** The declarations of the last element of the chain, as a map, with var() read from the custom properties of the chain. */
export function computed(css, chain) {
    const rules = parseRules(css);
    const vars = {};
    let own = {};
    for (let i = 0; i < chain.length; i++) {
        own = {};
        for (const rule of rules) {
            if (!rule.selector.split(',').some(s => matches(s.trim(), chain.slice(0, i + 1)))) continue;
            for (const [name, value] of rule.decls) own[name] = value;
        }
        for (const [name, value] of Object.entries(own)) if (name.startsWith('--')) vars[name] = value;
    }
    const out = {};
    for (const [name, value] of Object.entries(own)) out[name] = value.replace(/var\((--[a-z0-9-]+)\)/g, (_, v) => vars[v] ?? `var(${v})`);
    return out;
}

/** Every element of a Play tree with the chain from the root, as [{ el, chain }]. */
export function elementsOf(root, chain = []) {
    const here = [...chain, root];
    return [{ el: root, chain: here }, ...(root.children ?? []).flatMap(c => elementsOf(c, here))];
}
