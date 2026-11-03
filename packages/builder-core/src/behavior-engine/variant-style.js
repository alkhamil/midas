// Variant styles: a variable prop may say how the root of an instance is drawn in one of its modes (`styles`, a border style such as
// dashed). The rule is part of the schema, not a token. Codegen, Play and the canvas read it through these functions.
//
// A style is keyed by the mode's NAME (matched case-insensitively, as the token roles are), never by its id: the modes of a real file are made by Auto Fix with
// ids that are not their names, so matching ids left every real Dashed Button solid.

/**
 * The mode of a collection a style key names: the mode with that name (case-insensitive), else the one with that id.
 * @param {{ id: string, name?: string }[]} modes the collection's modes
 * @param {string} key a key of a prop's `styles`
 * @returns {{ id: string, name?: string } | undefined}
 */
export function modeOfStyleKey(modes, key) {
    const lower = key.toLowerCase();
    return modes.find(m => String(m.name ?? '').toLowerCase() === lower) ?? modes.find(m => m.id === key);
}

/**
 * The border style of an instance in its modes: the style of the first variable prop that has styles, for the mode it selects (solid
 * when that mode has no rule). Null when no variable prop of the template has styles.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, { id: string, name?: string } | null | undefined>} modes the instance's selected mode (id and name) per variable prop
 * @returns {'solid' | 'dashed' | 'dotted' | null}
 */
export function borderStyleOf(template, modes) {
    for (const [dim, def] of Object.entries(template.props)) {
        if (def.source !== 'variable' || !def.styles) continue;
        const mode = modes[dim];
        const key = mode ? Object.keys(def.styles).find(k => modeOfStyleKey([mode], k)) : undefined;
        return (key && def.styles[key].borderStyle) || 'solid';
    }
    return null;
}

/**
 * What to write on an instance's root so it draws a Variant's border style: the node's own stroke style (dashed is dash 4 4, dotted is dot, solid is solid).
 * Null when it already does, and when the template has no variant styles (the node keeps what it has). The Variant sets the style when it changes; the
 * node owns it after that.
 * @param {{ strokeStyle?: string, strokeDash?: number }} node
 * @param {'solid' | 'dashed' | 'dotted' | null} style
 * @returns {{ strokeStyle: string, strokeDash?: number, strokeGap?: number } | null}
 */
export function variantStrokePatch(node, style) {
    if (style === null) return null;
    const own = node.strokeStyle ?? 'solid';
    if (style === 'dashed') return own === 'dash' && node.strokeDash === 4 ? null : { strokeStyle: 'dash', strokeDash: 4, strokeGap: 4 };
    if (style === 'dotted') return own === 'dot' ? null : { strokeStyle: 'dot' };
    return own === 'solid' ? null : { strokeStyle: 'solid' };
}
