// Bind tokens (pure). Plans the variable bindings a bound master is missing: each mapped node property that has no variable on its
// layer gets the variable of its token in the group (`button/bg`) from the collection of its dimension. A binding that already
// exists is never overwritten, unless it points to a variable that no longer exists: a stale binding is rebound, never kept.
// A token with no variable in its group, or with no bound collection, is a problem, not a guess.
import { NODE_PROPERTIES, VARIABLE_KEYS, targetKindOf } from './display.js';
import { dimensionOfGroup } from './validate-schema.js';
import { variableKey } from './tokens.js';

/** @param {string} name */

/**
 * The bindings to add to a master, and what could not be bound.
 * @param {{
 *   template: import('../templates/schema.js').TemplateSchema,
 *   binding: { variables: Record<string, string | null> },
 *   layers: { key: string, node: { vars?: Record<string, string> } }[],
 *   variables: { collections?: any[], items?: any[] }
 * }} input `layers` are the master layers a display key maps to (`root`, `label`)
 * @returns {{ ops: { key: string, varKey: string, itemId: string }[], problems: { key: string, prop: string, token: string, reason: string }[] }}
 */
export function planBindTokens({ template, binding, layers, variables }) {
    /** @type {{ key: string, varKey: string, itemId: string }[]} */
    const ops = [];
    /** @type {{ key: string, prop: string, token: string, reason: string }[]} */
    const problems = [];
    const tokens = Object.values(template.tokens).flat();
    const items = variables.items || [];
    for (const { key, node } of layers) {
        const kind = targetKindOf(template, key);
        for (const [prop, source] of Object.entries(template.display[key] || {})) {
            if (!tokens.includes(source) || !NODE_PROPERTIES[kind][prop]) continue;
            const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(source));
            const dimension = group ? dimensionOfGroup(group, template.props) : null;
            const collectionId = dimension ? binding.variables[dimension] : null;
            if (!collectionId) { problems.push({ key, prop, token: source, reason: 'dimension-unbound' }); continue; }
            const item = items.find(i => i.collectionId === collectionId && variableKey(i.name) === variableKey(`${template.group}/${source}`));
            if (!item) { problems.push({ key, prop, token: source, reason: 'no-variable' }); continue; }
            const known = new Set(items.map(i => i.id));
            for (const varKey of VARIABLE_KEYS[prop] || []) {
                if (node.vars?.[varKey] !== undefined && known.has(node.vars[varKey])) continue;
                ops.push({ key, varKey, itemId: item.id });
            }
        }
    }
    return { ops, problems };
}

