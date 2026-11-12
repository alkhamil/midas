// Preview (pure): the CSS custom properties one instance draws with, for its modes and its state. Persistent states come from the
// instance's props (disabled, ...) and win over a preview-only state (hover, active, focus), which is studio-side only. A state
// token that does not resolve is reported by the resolver and left out: it is never replaced by the base token.
import { resolveTokens, cssVarOf } from './tokens.js';

/** The custom properties a typography token is written as, one per member (see typographyCss). */
const TYPOGRAPHY_CSS_MEMBERS = ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'];

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
    /** @type {Record<string, string>} */
    const markerOverrides = {};
    for (const [own, alias] of Object.entries(template.persistentStates)) {
        if (props[alias.prop] !== true) continue;
        // A marker state is never the state the instance is in (a hover still shows over it): it says a switch to the stylesheet (a data attribute the glyphs follow) and may swap
        // a token that is not a colour of the interaction (the padding an attached handler column leaves).
        if (alias.marker === true) { Object.assign(markerOverrides, alias.tokens); continue; }
        // An alias is the state it names turned on by its own prop: it draws that state.
        const name = alias.as ?? own, def = template.persistentStates[name];
        if (!names.includes(name)) names.push(name);
        Object.assign(overrides, def.tokens);
    }
    if (names.length) return { state: names.join('+'), overrides: { ...markerOverrides, ...overrides } };
    // A preview state a boolean prop gates (Card's hover needs Hoverable) is Default while the prop is off.
    const gate = template.previewRequires?.[preview];
    if (preview === 'default' || (gate !== undefined && props[gate] !== true)) return { state: 'default', overrides: markerOverrides };
    const def = template.previewStates[preview];
    if (!def) throw new Error(`${template.id}: unknown preview state "${preview}"`);
    return { state: preview, overrides: { ...markerOverrides, ...def } };
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
        // A typography token is one custom property per member (font-size, ...): the state swaps each.
        if (template.tokenKinds[base] === 'typography') {
            for (const member of TYPOGRAPHY_CSS_MEMBERS) {
                if (`${source}-${member}` in vars) vars[`${target}-${member}`] = vars[`${source}-${member}`];
                else delete vars[`${target}-${member}`];
            }
            continue;
        }
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
 * @returns {{ fill?: string, stroke?: string, shadow?: { x: number, y: number, blur: number, spread: number, color: string }[] } | null}
 */
export function canvasColorsOf(template, binding, modes, variables, props, preview = 'default') {
    const { state, overrides } = activeStateOf(template, props, preview);
    if (!Object.hasOwn(template.previewStates, state)) return null;
    const { vars } = previewOf(template, binding, modes, variables, props, preview);
    /** @type {{ fill?: string, stroke?: string, shadow?: { x: number, y: number, blur: number, spread: number, color: string }[] }} */
    const out = {};
    // A state that swaps the root's shadow token: the canvas draws those drop shadows around the node (an overlay; the document keeps its own effects).
    const shadowToken = template.display?.root?.shadow;
    if (shadowToken !== undefined && Object.hasOwn(overrides, shadowToken)) out.shadow = shadowLayersOf(vars[cssVarOf(template.id, shadowToken)]);
    for (const field of ['fill', 'stroke']) {
        const token = template.display?.root?.[field];
        if (token === undefined || !Object.hasOwn(overrides, token)) continue;
        const value = vars[cssVarOf(template.id, token)];
        if (value !== undefined) out[field] = value;
    }
    return Object.keys(out).length ? out : null;
}

/**
 * The drop shadows of a CSS box-shadow value as the export writes it (`x y blur spread #rrggbbaa`, comma separated); none gives an empty list.
 * @param {string | undefined} css
 * @returns {{ x: number, y: number, blur: number, spread: number, color: string }[]}
 */
export function shadowLayersOf(css) {
    if (css === undefined || css === 'none') return [];
    return css.split(/,\s*/).flatMap(part => {
        const m = /^(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(#[0-9a-fA-F]{6,8})$/.exec(part.trim());
        return m ? [{ x: Number(m[1]), y: Number(m[2]), blur: Number(m[3]), spread: Number(m[4]), color: m[5] }] : [];
    });
}

/**
 * The preview state to show for a template: the one asked for when the template declares it, else Default (a state left selected on another template is not
 * an error here).
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} state
 * @returns {string}
 */
export function previewStateOf(template, state) {
    return state === 'default' || Object.hasOwn(template.previewStates, state) ? state : 'default';
}
