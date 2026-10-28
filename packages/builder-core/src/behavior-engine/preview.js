// Preview renderer (stage 7). Pure: the template, the master's binding, an instance's stored props, the document's variables and
// a state in; the props the component receives and the CSS custom properties it draws with out. A state's tokens replace the
// base tokens they override (see stateTokens in the schema). A missing state token is left out and reported, never replaced
// by the base token.
import { variableProps } from './registry.js';
import { resolveProps } from './instance-props.js';
import { resolveTokens, cssVarOf } from './tokens.js';

/**
 * The effective state of an instance: a disabled instance is in the disabled state whatever state is asked for.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, unknown>} props the resolved props
 * @param {string} state the requested state
 */
function effectiveState(template, props, state) {
    if (!template.states.includes(state)) throw new Error(`${template.id}: unknown state "${state}"`);
    return props.disabled === true ? 'disabled' : state;
}

/**
 * What an instance draws in one state.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {{ variables: Record<string, string | null> }} binding the master's binding
 * @param {Record<string, string | boolean | null>} stored the instance's stored props
 * @param {{ collections?: any[], items?: any[] }} variables the document's variables
 * @param {string} state the requested state
 * @returns {{ state: string, props: Record<string, unknown>, vars: Record<string, string>, unresolved: { token: string, dimension: string | null, reason: string }[] }}
 */
export function previewOf(template, binding, stored, variables, state) {
    const props = resolveProps(template, stored);
    const active = effectiveState(template, props, state);
    const selected = Object.fromEntries(variableProps(template).map(([name]) => [name, /** @type {string | null} */ (stored[name] ?? null)]));
    const { vars, unresolved } = resolveTokens(template, binding, selected, variables);
    for (const [base, stateToken] of Object.entries(template.stateTokens?.[active] ?? {})) {
        const target = cssVarOf(template.id, base);
        if (cssVarOf(template.id, stateToken) in vars) vars[target] = vars[cssVarOf(template.id, stateToken)];
        else delete vars[target];
    }
    return { state: active, props, vars, unresolved };
}
