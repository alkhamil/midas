// Display mapping. A template's `display` says which token drives which property of which node. A literal prop writes its node field
// (`node` in the prop's schema). The code generator and the diagnostics both read these tables.

/**
 * What each node kind takes from the token mapping: `kind` is the value format a token must hold, `css` the CSS properties it is
 * written to by the code generator (null: the generator does not write it).
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
    },
    text: {
        fill: { kind: 'color', css: 'color' },
        fontSize: { kind: 'length', css: 'font-size' },
        lineHeight: { kind: 'ratio', css: 'line-height' },
        placeholder: { kind: 'color', css: null },
    },
    icon: {
        size: { kind: 'length', css: ['width', 'height'] },
    },
};

/**
 * The node fields a literal prop can write, per node kind: the prop type it takes.
 * Frames take none: node sizing is the node's own, never written by a template prop.
 * @type {Record<'frame' | 'text', Record<string, { kind: 'boolean' | 'string', values?: Record<string, string> }>>}
 */
export const NODE_FIELDS = {
    frame: {},
    text: { text: { kind: 'string' } },
};

/** The node kind a display key targets: `root` is the instance's frame, otherwise the anatomy slot's kind. */
export const targetKindOf = (template, key) => {
    if (key === 'root') return 'frame';
    const slot = Array.isArray(template.anatomy) ? template.anatomy.find(s => s.id === key) : undefined;
    if (!slot) return null;
    return slot.kind === 'icon' ? 'icon' : 'text';
};

/**
 * Problems in a template's display mapping, as messages. Every key must be `root` or an anatomy slot, every property must be one its
 * node kind takes, and every source must be a token of the template.
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
            if (!NODE_PROPERTIES[kind][prop]) { out.push(`display maps "${key}" to "${prop}", which a ${kind} does not take`); continue; }
            if (!tokens.includes(source)) out.push(`display maps "${key}.${prop}" to "${source}", which is not a token`);
        }
    }
    return out;
}

/** The base tokens a preview-only state may change. Size, padding and radius are not colours, so a preview state never changes them. */
export const COLOUR_TOKENS = ['bg', 'fg', 'border', 'outline-color'];

/**
 * The node variable keys (`vars`) a mapped property is bound through in the editor. One property can take more than one key
 * (an icon's size binds both width and height). `paddingX` and `paddingY` use the editor's paired padding keys.
 * @type {Record<string, string[]>}
 */
export const VARIABLE_KEYS = {
    fill: ['fills.0'],
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
 * The literal props that write a node field, in prop order, as [prop, node, field]. A prop with no `node` writes nothing (loading,
 * hasIcon, disabled): loading is reported by the diagnostics, the others are handled by the anatomy and state sync.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function nodeWritersOf(template) {
    return Object.entries(template.props)
        .filter(([, def]) => def.source === 'literal' && 'node' in def && def.node)
        .map(([prop, def]) => ({ prop, key: def.node.key, field: def.node.field }));
}

/**
 * The node fields the literal props write, with the value each one writes. A boolean writes the field value its `values` map gives.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, unknown>} props the instance's resolved literal props
 * @returns {{ key: string, field: string, value: string }[]}
 */
export function literalFields(template, props) {
    /** @type {{ key: string, field: string, value: unknown }[]} */
    const out = [];
    for (const { prop, key, field } of nodeWritersOf(template)) {
        const spec = NODE_FIELDS[targetKindOf(template, key)][field];
        const raw = props[prop];
        if (spec.kind === 'boolean') out.push({ key, field, value: spec.values[String(raw === true)] });
        else out.push({ key, field, value: String(raw) });
    }
    return out;
}

/**
 * The node fields literal props write, per display key: the label text. These fields belong to the instance
 * once a prop writes them, so the copy from the master never overwrites them.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {{ key: string, field: string }[]}
 */
export function literalFieldNames(template) {
    return nodeWritersOf(template).map(({ key, field }) => ({ key, field }));
}
