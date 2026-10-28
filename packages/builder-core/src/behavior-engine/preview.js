// Preview (pure): the CSS custom properties one instance draws with, for its modes and its state. Persistent states come from the
// instance's props (disabled, ...) and win over a preview-only state (hover, active, focus), which is studio-side only. A state
// token that does not resolve is reported by the resolver and left out: it is never replaced by the base token.
import { resolveTokens, cssVarOf } from './tokens.js';

/**
 * The state an instance is in: every persistent state whose prop is true (their tokens merged), else the preview-only state asked
 * for, else the default. Unknown preview-only states are refused.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, unknown>} props the instance's resolved literal props
 * @param {string} preview the preview-only state asked for, or 'default'
 * @returns {{ state: string, overrides: Record<string, string> }}
 */
export function activeStateOf(template, props, preview) {
    /** @type {string[]} */
    const names = [];
    /** @type {Record<string, string>} */
    const overrides = {};
    for (const [name, def] of Object.entries(template.persistentStates)) {
        if (props[def.prop] !== true) continue;
        names.push(name);
        Object.assign(overrides, def.tokens);
    }
    if (names.length) return { state: names.join('+'), overrides };
    if (preview === 'default') return { state: 'default', overrides };
    const def = template.previewStates[preview];
    if (!def) throw new Error(`${template.id}: unknown preview state "${preview}"`);
    return { state: preview, overrides: { ...def } };
}

/**
 * What an instance draws in one state.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {{ variables: Record<string, string | null> }} binding the master's binding
 * @param {Record<string, string | null>} modes the instance's mode per variable prop (its Appearance modes)
 * @param {{ collections?: any[], items?: any[] }} variables the document's variables
 * @param {Record<string, unknown>} props the instance's resolved literal props
 * @param {string} [preview] the preview-only state asked for, or 'default'
 * @returns {{ state: string, vars: Record<string, string>, unresolved: { token: string, dimension: string | null, reason: string }[] }}
 */
export function previewOf(template, binding, modes, variables, props, preview = 'default') {
    const { vars, unresolved } = resolveTokens(template, binding, modes, variables);
    const { state, overrides } = activeStateOf(template, props, preview);
    for (const [base, stateToken] of Object.entries(overrides)) {
        const target = cssVarOf(template.id, base), source = cssVarOf(template.id, stateToken);
        if (source in vars) vars[target] = vars[source];
        else delete vars[target];
    }
    return { state, vars, unresolved };
}

/**
 * The colours the canvas draws for an instance's root in a preview-only state: the root fill and stroke whose base token the state
 * overrides, and nothing else (text colour is read in the Preview section only). Null when the instance draws its own colours: the
 * default state, a persistent state (a real disabled wins over a preview), or a state colour that does not resolve.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {{ variables: Record<string, string | null> }} binding the master's binding
 * @param {Record<string, string | null>} modes the instance's mode per variable prop
 * @param {{ collections?: any[], items?: any[] }} variables the document's variables
 * @param {Record<string, unknown>} props the instance's resolved literal props
 * @param {string} [preview] the preview-only state asked for, or 'default'
 * @returns {{ fill?: string, stroke?: string } | null}
 */
export function canvasColorsOf(template, binding, modes, variables, props, preview = 'default') {
    const { state, overrides } = activeStateOf(template, props, preview);
    if (!Object.hasOwn(template.previewStates, state)) return null;
    const { vars } = previewOf(template, binding, modes, variables, props, preview);
    /** @type {{ fill?: string, stroke?: string }} */
    const out = {};
    for (const field of ['fill', 'stroke']) {
        const token = template.display?.root?.[field];
        if (token === undefined || !Object.hasOwn(overrides, token)) continue;
        const value = vars[cssVarOf(template.id, token)];
        if (value !== undefined) out[field] = value;
    }
    return Object.keys(out).length ? out : null;
}

/**
 * The state token that is the text colour of a template: the token the label layer's fill is driven by. The canvas never draws it
 * in a preview; the Preview section shows it read-only with a note.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {string | null}
 */
export function textColorTokenOf(template) {
    return template.display?.label?.fill ?? null;
}
