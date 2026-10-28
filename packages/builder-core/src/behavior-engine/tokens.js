// Token resolver (stage 4). Pure: the schema, the master's binding, the instance's selected mode per variable prop and the
// document's variables in, CSS custom properties and the unresolved tokens (with the reason) out. Nothing is guessed.
import { variableProps } from './registry.js';
import { dimensionOfGroup } from './validate-schema.js';

/**
 * The kind of value each known token holds. `length` is a number in px (line height included: it is px, not a ratio), `ratio` is a
 * unitless number, `color` is a CSS colour string. A token not listed here has no kind and is reported.
 * @type {Record<string, 'length' | 'ratio' | 'color'>}
 */
const TOKEN_KIND = {
    fontSize: 'length',
    lineHeight: 'length',
    paddingX: 'length',
    paddingY: 'length',
    gap: 'length',
    radius: 'length',
    iconSize: 'length',
    bg: 'color',
    fg: 'color',
    border: 'color',
    'bg-hover': 'color',
    'bg-active': 'color',
    'bg-disabled': 'color',
    'fg-disabled': 'color',
    'border-focus': 'color',
};

/** A variable name as it is matched: trimmed and lower case. Variables are named `<group>/<token>`, e.g. `button/bg`. */
const nameKey = (/** @type {unknown} */ name) => String(name ?? '').trim().toLowerCase();

/** `fontSize` -> `font-size`, `paddingX` -> `padding-x`. */
const kebab = (/** @type {string} */ token) => token.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * The CSS custom property a token is written to: `--<templateId>-<token in kebab-case>`.
 * @param {string} templateId
 * @param {string} token
 */
export const cssVarOf = (templateId, token) => `--${templateId}-${kebab(token)}`;

/**
 * A colour as its 6-digit form and its alpha in percent, the way the editor reads it (#rgb, #rgba, #rrggbb, #rrggbbaa).
 * @param {string} color
 * @returns {{ rgb: string, alpha: number } | null}
 */
function splitColor(color) {
    const m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color);
    if (!m) return null;
    const h = m[1].length <= 4 ? m[1].split('').map(c => c + c).join('') : m[1];
    return { rgb: '#' + h.slice(0, 6).toLowerCase(), alpha: h.length === 8 ? Math.round(parseInt(h.slice(6, 8), 16) / 255 * 100) : 100 };
}

/**
 * The colour with its alpha multiplied by `percent` (the editor's arithmetic and rounding, so both draw the same colour).
 * @param {string} color
 * @param {number} percent
 * @returns {string | null}
 */
function withOpacity(color, percent) {
    const split = splitColor(color);
    if (!split) return null;
    const a = Math.max(0, Math.min(100, Math.round(split.alpha * percent / 100)));
    return a < 100 ? split.rgb + Math.round(a / 100 * 255).toString(16).padStart(2, '0') : split.rgb;
}

/**
 * The value of an item in one mode, following aliases (an alias is `{ alias: itemId, opacity? }`) inside the same mode.
 * An alias's own opacity (below 100) is kept, outermost first, to be applied to the colour it reaches.
 * @param {any} item
 * @param {string} mode
 * @param {any[]} items
 * @returns {{ item: any, value: unknown, opacities: number[] } | { reason: string }}
 */
function valueIn(item, mode, items) {
    const seen = new Set();
    /** @type {number[]} */
    const opacities = [];
    let current = item;
    for (;;) {
        if (seen.has(current.id)) return { reason: 'alias-cycle' };
        seen.add(current.id);
        const value = current.values?.[mode];
        if (value === undefined) return { reason: 'no-value-in-mode' };
        if (value && typeof value === 'object' && 'alias' in value) {
            if (typeof value.opacity === 'number' && value.opacity < 100) opacities.push(value.opacity);
            const next = items.find((/** @type {any} */ i) => i.id === value.alias);
            if (!next) return { reason: 'alias-missing' };
            current = next;
            continue;
        }
        return { item: current, value, opacities };
    }
}

/**
 * The CSS text of a value of a kind, or null when the stored value does not fit the kind.
 * @param {string} kind
 * @param {unknown} value
 * @param {number[]} opacities alias opacities, outermost first (colours only)
 * @returns {string | null}
 */
function formatOf(kind, value, opacities) {
    if (kind === 'color') {
        if (typeof value !== 'string') return null;
        let text = value;
        for (const percent of [...opacities].reverse()) {
            const next = withOpacity(text, percent);
            if (next === null) return null;
            text = next;
        }
        return text;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return kind === 'length' ? `${value}px` : String(value);
}

/**
 * Resolves the base tokens of a template for one instance.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {{ variables: Record<string, string | null> }} binding the master's binding
 * @param {Record<string, string | null | undefined>} selectedModes the instance's selected mode per variable prop
 * @param {{ collections?: any[], items?: any[] }} variables the document's variables
 * @returns {{ vars: Record<string, string>, unresolved: { token: string, dimension: string | null, reason: string }[] }}
 */
export function resolveTokens(template, binding, selectedModes, variables) {
    const collections = variables?.collections || [];
    /** @type {any[]} */
    const items = variables?.items || [];
    /** @type {Record<string, string>} */
    const vars = {};
    /** @type {{ token: string, dimension: string | null, reason: string }[]} */
    const unresolved = [];
    const props = Object.fromEntries(variableProps(template));
    for (const [group, names] of Object.entries(template.tokens)) {
        const dimension = dimensionOfGroup(group, template.props);
        for (const token of names) {
            /** @param {string} reason */
            const miss = reason => unresolved.push({ token, dimension, reason });
            const kind = Object.hasOwn(TOKEN_KIND, token) ? TOKEN_KIND[token] : null;
            if (!kind) { miss('no-kind'); continue; }
            if (!dimension || !props[dimension]) { miss('no-dimension'); continue; }
            const collectionId = binding.variables?.[dimension] ?? null;
            if (!collectionId) { miss('dimension-unbound'); continue; }
            const collection = collections.find(c => c.id === collectionId);
            if (!collection) { miss('collection-missing'); continue; }
            const mode = selectedModes[dimension] ?? null;
            if (mode === null) { miss('no-mode-selected'); continue; }
            if (!collection.modes?.some((/** @type {{ id: string }} */ m) => m.id === mode)) { miss('mode-missing'); continue; }
            const named = items.filter(i => i.collectionId === collection.id && nameKey(i.name) === `${template.group}/${token}`.toLowerCase());
            if (named.length === 0) { miss('no-variable'); continue; }
            if (named.length > 1) { miss('ambiguous'); continue; }
            const found = valueIn(named[0], mode, items);
            if ('reason' in found) { miss(found.reason); continue; }
            if (found.item.type !== (kind === 'color' ? 'color' : 'number')) { miss('type-mismatch'); continue; }
            const text = formatOf(kind, found.value, found.opacities);
            if (text === null) { miss('invalid-value'); continue; }
            vars[cssVarOf(template.id, token)] = text;
        }
    }
    return { vars, unresolved };
}
