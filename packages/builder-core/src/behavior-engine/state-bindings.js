// State bindings (pure). A persistent state (e.g. `disabled`) is stored as an instance prop, and the variables its tokens replace
// are bound on the instance's layers by the engine, in the same sync that changes the prop. The plan says what to write and what
// to leave alone. Nothing is written by this module.
//
// - A binding the user set by hand (anything that is neither the master's binding nor the state's variable) is never overwritten:
//   it is reported as `rebound-by-hand`.
// - A state's variable that is missing from the collection is reported as `no-variable`, never replaced by the base variable.
// - Running the plan again on its own result gives no operations.
import { dimensionOfGroup } from './validate-schema.js';

/** @typedef {{ key: string, instance: { id: string, vars?: Record<string, string> }, master: { vars?: Record<string, string> } | null }} LayerPair */
/** @typedef {{ instanceId: string, prop: string, value: string | null }} BindingOp */

/** @param {string} name */
const nameKey = name => String(name ?? '').trim().toLowerCase();

/**
 * The plan for one instance.
 * @param {{
 *   template: import('../templates/schema.js').TemplateSchema,
 *   binding: { variables: Record<string, string | null> },
 *   props: Record<string, unknown>,
 *   layers: LayerPair[],
 *   variables: { collections?: any[], items?: any[] }
 * }} input `props` are the instance's resolved literal props; `layers` pairs each display key with its instance and master layers
 * @returns {{ ops: BindingOp[], warnings: { key: string, prop: string, state: string, reason: string }[], problems: { key: string, prop: string, token: string, reason: string }[] }}
 */
export function planStateBindings({ template, binding, props, layers, variables }) {
    /** @type {BindingOp[]} */
    const ops = [];
    /** @type {{ key: string, prop: string, state: string, reason: string }[]} */
    const warnings = [];
    /** @type {{ key: string, prop: string, token: string, reason: string }[]} */
    const problems = [];
    const items = variables.items || [];
    for (const { key, prop, base, state, stateToken } of derivedNodeProps(template)) {
        const on = props[template.persistentStates[state].prop] === true;
        const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(base));
        const dimension = group ? dimensionOfGroup(group, template.props) : null;
        const collectionId = dimension ? binding.variables[dimension] : null;
        if (!collectionId) { problems.push({ key: '*', prop: base, token: base, reason: 'dimension-unbound' }); continue; }
        const stateItem = items.find(i => i.collectionId === collectionId && nameKey(i.name) === `${template.group}/${stateToken}`.toLowerCase());
        if (!stateItem) { problems.push({ key: '*', prop: base, token: stateToken, reason: 'no-variable' }); continue; }
        for (const layer of layers) {
            if (layer.key !== key) continue;
            const baseId = layer.master?.vars?.[prop] ?? null;
            const current = layer.instance.vars?.[prop] ?? null;
            if (on) {
                if (current === stateItem.id) continue;
                if (current === baseId) ops.push({ instanceId: layer.instance.id, prop, value: stateItem.id });
                else warnings.push({ key, prop, state, reason: 'rebound-by-hand' });
            } else if (current === stateItem.id) {
                ops.push({ instanceId: layer.instance.id, prop, value: baseId });
            }
        }
    }
    return { ops, warnings, problems };
}

/**
 * The node properties a persistent state derives: each display property (fill or stroke) whose token a persistent state replaces.
 * One list for the plan and for the vars ownership (see ownedVarKeys), so they cannot drift apart.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {{ key: string, prop: string, base: string, state: string, stateToken: string }[]}
 */
export function derivedNodeProps(template) {
    /** @type {{ key: string, prop: string, base: string, state: string, stateToken: string }[]} */
    const out = [];
    for (const [state, def] of Object.entries(template.persistentStates)) {
        for (const [base, stateToken] of Object.entries(def.tokens)) {
            for (const [key, mapped] of Object.entries(template.display)) {
                for (const [prop, source] of Object.entries(mapped)) {
                    if (source === base && ['fill', 'stroke'].includes(prop)) out.push({ key, prop, base, state, stateToken });
                }
            }
        }
    }
    return out;
}

/**
 * The vars keys the behavior engine owns on an instance's layers: a derived property is written by the engine on every sync, so
 * it is never copied from the master and never snapshotted into the instance's overrides.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {string[]}
 */
export function ownedVarKeys(template) {
    return [...new Set(derivedNodeProps(template).map(d => d.prop))];
}

