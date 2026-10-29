// Variant styles: a variable prop may say how the root of an instance is drawn in one of its modes (`styles`, a border style such as
// dashed). The rule is part of the schema, not a token. Codegen, Play and the canvas read it through this one function.

/**
 * The border style of an instance in its modes: the style of the first variable prop that has styles, for the mode it selects (solid
 * when that mode has no rule). Null when no variable prop of the template has styles.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, string | null | undefined>} modes the instance's selected mode per variable prop
 * @returns {'solid' | 'dashed' | 'dotted' | null}
 */
export function borderStyleOf(template, modes) {
    for (const [dim, def] of Object.entries(template.props)) {
        if (def.source !== 'variable' || !def.styles) continue;
        return def.styles[modes[dim] ?? '']?.borderStyle ?? 'solid';
    }
    return null;
}
