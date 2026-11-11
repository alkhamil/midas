// Bind tokens (pure). Plans the variable bindings a bound master is missing: each mapped node property that has no variable on its
// layer gets the variable of its token in the group (`button/bg`) from the collection of its dimension. A binding that already
// exists is never overwritten, unless it points to a variable that no longer exists: a stale binding is rebound, never kept.
// A token with no variable in its group, or with no bound collection, is a problem, not a guess.
import { NODE_PROPERTIES, VARIABLE_KEYS, targetKindOf } from './display.js';
import { dimensionOfGroup } from './validate-schema.js';
import { variableKey } from './tokens.js';
import { varsWithBinding } from './edits.js';
import { setStrokeWeight, strokePaintMissing } from '../geometry/shapes.js';
import { fixBoundAxes } from '../geometry/autolayout.js';
import { stateTokenOf } from './state-bindings.js';
import { isOverridden, noteEngineBinding } from './overrides.js';

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
            const item = items.find(i => i.collectionId === collectionId && variableKey(i.name) === variableKey(source));
            if (!item) { problems.push({ key, prop, token: source, reason: 'no-variable' }); continue; }
            const known = new Set(items.map(i => i.id));
            for (const varKey of VARIABLE_KEYS[prop] || []) {
                if (node.vars?.[varKey] !== undefined && known.has(node.vars[varKey])) continue;
                // The user detached it: their raw value stands.
                if (isOverridden(node, varKey)) continue;
                ops.push({ key, varKey, itemId: item.id });
            }
            if (prop === 'stroke' && !isOverridden(node, 'stroke') && strokePaintMissing(node) && !ops.some(o => o.key === key && o.varKey === 'stroke')) {
                // The template owns the stroke: a master with no paint still gets the stroke op, so one bind adds and binds it.
                ops.push({ key, varKey: 'stroke', itemId: item.id });
            }
        }
    }
    return { ops, problems };
}

/**
 * The bindings of an instance's managed text layers, which have no master layer to carry them: each mapped property is bound to the
 * variable of its token (from the master's collections), or of the state's token while a persistent state is on. A binding that is
 * neither of the two (a designer's) is kept; one pointing at a variable that no longer exists is rebound. Same ops as planBindTokens,
 * so applyBindTokens writes them.
 * @param {{
 *   template: import('../templates/schema.js').TemplateSchema,
 *   binding: { variables: Record<string, string | null> },
 *   props: Record<string, unknown>,
 *   layers: { key: string, node: { vars?: Record<string, string> } }[],
 *   variables: { collections?: any[], items?: any[] }
 * }} input `props` are the instance's resolved literal props; `layers` the instance's managed text layers by slot id
 * @returns {{ ops: { key: string, varKey: string, itemId: string }[], problems: { key: string, prop: string, token: string, reason: string }[] }}
 */
export function planManagedTextBindings({ template, binding, props, layers, variables }) {
    /** @type {{ key: string, varKey: string, itemId: string }[]} */
    const ops = [];
    /** @type {{ key: string, prop: string, token: string, reason: string }[]} */
    const problems = [];
    const tokens = Object.values(template.tokens).flat();
    const items = variables.items || [];
    const known = new Set(items.map(i => i.id));
    /** The variable of a token, or why there is none. */
    const itemOf = token => {
        const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(token));
        const dimension = group ? dimensionOfGroup(group, template.props) : null;
        const collectionId = dimension ? binding.variables[dimension] : null;
        if (!collectionId) return { reason: 'dimension-unbound' };
        const item = items.find(i => i.collectionId === collectionId && variableKey(i.name) === variableKey(token));
        return item ? { item } : { reason: 'no-variable' };
    };
    for (const { key, node } of layers) {
        const kind = targetKindOf(template, key);
        for (const [prop, source] of Object.entries(template.display[key] || {})) {
            if (!tokens.includes(source) || !NODE_PROPERTIES[kind][prop]) continue;
            const base = itemOf(source);
            if (!base.item) { problems.push({ key, prop, token: source, reason: base.reason }); continue; }
            const state = stateTokenOf(template, props, key, prop, source);
            const stateHit = state ? itemOf(state.stateToken) : null;
            if (stateHit && !stateHit.item) { problems.push({ key, prop, token: state.stateToken, reason: stateHit.reason }); continue; }
            const want = state?.on ? stateHit.item : base.item;
            for (const varKey of VARIABLE_KEYS[prop] || []) {
                const current = node.vars?.[varKey];
                // A key the engine bound that is gone now was detached by the user: it is theirs (see overrides.js).
                const ours = (current === undefined ? !isOverridden(node, varKey) : (!known.has(current) || current === base.item.id || current === stateHit?.item.id));
                if (ours && current !== want.id) ops.push({ key, varKey, itemId: want.id });
            }
        }
    }
    return { ops, problems };
}

/**
 * Applies bind ops to their layers. A stroke op also gives the layer the template-owned paint when it has none (width 1,
 * align inside); the rest of the stroke paint (opacity, visibility) follows the variable's colour, which the caller
 * resolves (see restoreStrokePaint).
 * @param {{ key: string, node: any }[]} layers the master layers a display key maps to (`root`, `label`)
 * @param {{ key: string, varKey: string, itemId: string }[]} ops
 * @returns {any[]} the layers that changed
 */
export function applyBindTokens(layers, ops) {
    const touched = [];
    for (const op of ops) {
        const layer = layers.find(l => l.key === op.key);
        if (!layer) continue;
        const n = layer.node;
        n.vars = varsWithBinding(n.vars, op.varKey, op.itemId);
        noteEngineBinding(n, op.varKey, op.itemId);
        if (op.varKey === 'fills.0') delete n.vars.fill;
        if (op.varKey === 'stroke') {
            if (!(n.strokeWidth > 0)) setStrokeWeight(n, 1);
            if (n.strokeAlign === undefined) n.strokeAlign = 'inside';
        }
        // A bound width or height is the variable's value in every mode: that axis is fixed, never hug or fill.
        fixBoundAxes(n);
        touched.push(n);
    }
    // A layer whose size was bound before but still hugs (a file from before this rule) is fixed by the next bind too.
    for (const { node } of layers) fixBoundAxes(node);
    return touched;
}
