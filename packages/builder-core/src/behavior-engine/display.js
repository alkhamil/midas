// Display mapping. A template's `display` says which token or literal prop drives which property of which node. The code
// generator and the diagnostics both read this one table.

/**
 * What each node kind takes from the mapping: `kind` is the value format a token must hold (or the prop type a literal must
 * have), `css` the CSS properties it is written to by the code generator (null: the generator does not write it).
 * @type {Record<'frame' | 'text' | 'icon', Record<string, { kind: string, css: string | string[] | null }>>}
 */
export const NODE_PROPERTIES = {
    frame: {
        fill: { kind: 'color', css: 'background-color' },
        stroke: { kind: 'color', css: 'border-color' },
        radius: { kind: 'length', css: 'border-radius' },
        paddingX: { kind: 'length', css: 'padding-inline' },
        paddingY: { kind: 'length', css: 'padding-block' },
        gap: { kind: 'length', css: 'gap' },
        width: { kind: 'boolean', css: null },
    },
    text: {
        fill: { kind: 'color', css: 'color' },
        fontSize: { kind: 'length', css: 'font-size' },
        lineHeight: { kind: 'length', css: 'line-height' },
        text: { kind: 'string', css: null },
    },
    icon: {
        size: { kind: 'length', css: ['width', 'height'] },
    },
};

/** The node kind a display key targets: `root` is the instance's frame, otherwise the anatomy slot's kind. */
export const targetKindOf = (template, key) => {
    if (key === 'root') return 'frame';
    const slot = Array.isArray(template.anatomy) ? template.anatomy.find(s => s.id === key) : undefined;
    if (!slot) return null;
    return slot.kind === 'text' ? 'text' : 'icon';
};

/**
 * Problems in a template's display mapping, as messages. Every key must be `root` or an anatomy slot, every property must be one
 * its node kind takes, and every source must be a token of the template (token sources) or a literal prop of the matching type.
 * @param {any} template
 * @returns {string[]}
 */
export function displayProblems(template) {
    if (!template.display || typeof template.display !== 'object' || Array.isArray(template.display)) return ['schema has no display mapping'];
    const tokens = Object.values(template.tokens || {}).flat();
    const out = [];
    for (const [key, props] of Object.entries(template.display)) {
        const kind = targetKindOf(template, key);
        if (!kind) { out.push(`display maps "${key}", which is not root or an anatomy slot`); continue; }
        for (const [prop, source] of Object.entries(props)) {
            const def = NODE_PROPERTIES[kind][prop];
            if (!def) { out.push(`display maps "${key}" to "${prop}", which a ${kind} does not take`); continue; }
            if (tokens.includes(source)) continue;
            const literal = template.props?.[source];
            if (!literal) out.push(`display maps "${key}.${prop}" to "${source}", which is neither a token nor a prop`);
            else if (literal.source !== 'literal' || literal.type !== def.kind) out.push(`display maps "${key}.${prop}" to prop "${source}", which is not a ${def.kind} prop`);
        }
    }
    return out;
}

/** The base tokens a preview-only state may change. Size, padding and radius are not colours, so a preview state never changes them. */
export const COLOUR_TOKENS = ['bg', 'fg', 'border'];

/**
 * The node variable keys (`vars`) a mapped property is bound through in the editor. One property can take more than one key
 * (an icon's size binds both width and height). `paddingX` and `paddingY` use the editor's paired padding keys.
 * @type {Record<string, string[]>}
 */
export const VARIABLE_KEYS = {
    fill: ['fill'],
    stroke: ['stroke'],
    radius: ['radius'],
    paddingX: ['padH'],
    paddingY: ['padV'],
    gap: ['gap'],
    fontSize: ['fontSize'],
    lineHeight: ['lineHeight'],
    size: ['w', 'h'],
};

/**
 * The node fields the literal props write: the label prop writes the text of the `label` layer, fullWidth writes the root's
 * width mode (fill when on, hug when off). Token sources are not literal and write nothing here. A prop with no node field
 * (loading, hasIcon, disabled) writes nothing: loading is reported by the diagnostics, the others are handled by the anatomy
 * and state sync.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, unknown>} props the instance's resolved literal props
 * @returns {{ key: string, field: string, value: string }[]}
 */
export function literalFields(template, props) {
    const tokens = Object.values(template.tokens).flat();
    /** @type {{ key: string, field: string, value: string }[]} */
    const out = [];
    for (const [key, mapped] of Object.entries(template.display)) {
        for (const [prop, source] of Object.entries(mapped)) {
            if (tokens.includes(source) || !(source in props)) continue;
            if (prop === 'text') out.push({ key, field: 'text', value: String(props[source]) });
            else if (prop === 'width') out.push({ key, field: 'layoutSizingH', value: props[source] === true ? 'fill' : 'hug' });
        }
    }
    return out;
}

/**
 * The node fields literal props write, per display key: the label text and the root width mode. These fields belong to the
 * instance once a prop writes them, so the copy from the master never overwrites them.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {{ key: string, field: string }[]}
 */
export function literalFieldNames(template) {
    const tokens = Object.values(template.tokens).flat();
    /** @type {{ key: string, field: string }[]} */
    const out = [];
    for (const [key, mapped] of Object.entries(template.display)) {
        for (const [prop, source] of Object.entries(mapped)) {
            if (tokens.includes(source)) continue;
            if (prop === 'text') out.push({ key, field: 'text' });
            else if (prop === 'width') out.push({ key, field: 'layoutSizingH' });
        }
    }
    return out;
}
