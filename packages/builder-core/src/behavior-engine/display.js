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
        // No css: the root draws no border itself (its stroke is the ::before overlay, read from the node).
        strokeWidth: { kind: 'length' },
        radius: { kind: 'length', css: 'border-radius' },
        paddingX: { kind: 'length', css: 'padding-inline' },
        paddingY: { kind: 'length', css: 'padding-block' },
        gap: { kind: 'length', css: 'gap' },
        height: { kind: 'length', css: 'height' },
        // A fixed width from a token (a Switch's track), bound through the w variable like the height through h.
        width: { kind: 'length', css: 'width' },
        size: { kind: 'length', css: ['width', 'height'] },
        // An effect token: the elevation of the box, a list of drop shadows (an empty list is none).
        shadow: { kind: 'effect', css: 'box-shadow' },
    },
    text: {
        fill: { kind: 'color', css: 'color' },
        // A typography token drives every member: one custom property per member, each read in its own name (perMember).
        typography: { kind: 'typography', css: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing'], perMember: true },
        placeholder: { kind: 'color', css: null },
    },
    icon: {
        size: { kind: 'length', css: ['width', 'height'] },
    },
    // An arc part (the spinner) is an SVG drawn with `currentColor`: its colour is the CSS colour, and it is the icon size wide and high.
    arc: {
        stroke: { kind: 'color', css: 'color' },
        size: { kind: 'length', css: ['width', 'height'] },
    },
};

/**
 * The node fields a literal prop or a part can write, per node kind: the value type it takes. `visible` is written by a part's
 * `shownWhen`; node sizing is never written by a template. A boolean field with a `values` map writes the mapped value
 * while the prop holds, and the field's default when it does not (opacity: 1), so a node never holds no opacity.
 * @type {Record<'frame' | 'text', Record<string, { kind: 'boolean' | 'string' | 'number', values?: Record<string, string | number> }>>}
 */
/**
 * The root opacity a loading Button draws at on the canvas and in Play (the export carries the same number in its
 * blocked rule, see codegen). No variable type holds an opacity, so like the wave and focus durations this constant
 * lives with the engine; the loading behaviour mandates 0.65.
 */
export const LOADING_OPACITY = 0.65;

export const NODE_FIELDS = {
    frame: { visible: { kind: 'boolean' }, primaryAlign: { kind: 'boolean', values: { true: 'end', false: 'start' } }, layout: { kind: 'enum', options: ['horizontal', 'vertical'] }, gap: { kind: 'number' }, width: { kind: 'number' }, opacity: { kind: 'boolean', values: { true: LOADING_OPACITY } } },
    text: { text: { kind: 'string' }, visible: { kind: 'boolean' }, width: { kind: 'number' } },
    arc: { visible: { kind: 'boolean' } },
};

/** The attribute selector a persistent state may be written as instead of a pseudo-class: `[data-<name>]`. */
export const STATE_ATTRIBUTE = /^\[(data-[a-z][a-z0-9-]*)\]$/;

/**
 * The persistent states the root says as an attribute: `{ state, attr, prop }` for each whose statePseudo is `[data-<name>]`. The export writes the
 * attribute from the prop and Play draws the same one, so the stylesheet's selector matches on every surface.
 * @param {any} template
 * @returns {{ state: string, attr: string, prop: string }[]}
 */
export function stateAttributesOf(template) {
    return Object.entries(template.persistentStates ?? {}).flatMap(([state, def]) => {
        const attr = STATE_ATTRIBUTE.exec(String(template.statePseudo?.[state] ?? ''))?.[1];
        return attr ? [{ state, attr, prop: def.prop }] : [];
    });
}

/** The node kind a display key targets: `root` is the instance's frame, otherwise the anatomy slot's or the part's kind. */
export const targetKindOf = (template, key) => {
    if (key === 'root') return 'frame';
    const slot = Array.isArray(template.anatomy) ? template.anatomy.find(s => s.id === key) : undefined;
    const part = Array.isArray(template.parts) ? template.parts.find(p => p.id === key) : undefined;
    const kind = slot ?? part;
    if (!kind) return null;
    if (part?.arc) return 'arc';
    return kind.kind === 'icon' ? 'icon' : kind.kind === 'frame' ? 'frame' : 'text';
};

/** The text a counter part shows: the value's length, and `/ max` when the template has a maximum. */
export const counterLabel = (value, max) => `${String(value ?? '').length}${max != null ? ` / ${max}` : ''}`;

/**
 * Whether a persistent state is on: its own prop is set, or the prop of a state that is an alias of it (`as`: Read only is the disabled state turned on by
 * its own prop). Every surface asks this one question.
 * @param {any} template
 * @param {string} state
 * @param {Record<string, unknown>} props the resolved props
 */
export function stateOn(template, state, props) {
    return Object.entries(template.persistentStates).some(([name, def]) => (name === state || /** @type {any} */ (def).as === state) && props[/** @type {any} */ (def).prop] === true);
}

/** Whether one condition holds for the resolved props: `{ prop, is }`, `{ prop, empty }` (a string prop is empty), `{ all: [...] }` (every one holds) or `{ any: [...] }` (one holds). */
export function conditionHolds(cond, props) {
    if (cond.all) return cond.all.every(c => conditionHolds(c, props));
    if (cond.any) return cond.any.some(c => conditionHolds(c, props));
    const raw = props[cond.prop];
    if ('is' in cond) return raw === cond.is;
    return (String(raw ?? '') === '') === cond.empty;
}

/**
 * The id of the placeholder part the value outranks, or undefined: the part the control's placeholder prop writes, when the control declares
 * `hidePlaceholderWhenFilled`. Canvas, Play and the export all read this one rule.
 * @param {any} template
 * @returns {string | undefined}
 */
export function placeholderPartOf(template) {
    const control = template.control;
    if (!control?.hidePlaceholderWhenFilled || !control.placeholder) return undefined;
    return template.props[control.placeholder]?.node?.key;
}

/** The names of the props a condition reads, in order. */
export function conditionProps(cond) {
    return cond.all || cond.any ? (cond.all || cond.any).flatMap(conditionProps) : [cond.prop];
}

/**
 * The parts the canvas draws, as nodes in the master and in each instance: `{ id, kind, shownWhen, text, canvas, reason }`. A part
 * with `canvas: false` is play-only and has no node; `reason` says why.
 * @param {any} template
 */
export const canvasPartsOf = template => (template.parts ?? []).filter(p => p.canvas !== false);

/**
 * What the parts write to their nodes, for the resolved literal props: `visible` from `shownWhen`, and the counter text. A glyph or
 * a fixed text is written when the master is built, so it writes nothing here.
 * @param {any} template
 * @param {Record<string, unknown>} props
 * @returns {{ key: string, field: string, value: unknown }[]}
 */
export function partWrites(template, props) {
    /** @type {{ key: string, field: string, value: unknown }[]} */
    const out = [];
    if (template.control?.hideWhenEmpty) out.push({ key: template.control.slot, field: 'visible', value: String(props[template.control.value] ?? '') !== '' });
    const placeholderPart = placeholderPartOf(template);
    const valueFilled = template.control ? String(props[template.control.value] ?? '') !== '' : false;
    // A read-only input shows its value, never the placeholder: readOnly outranks it like a value does.
    const readOnly = template.control?.readonly ? props[template.control.readonly] === true : false;
    for (const part of canvasPartsOf(template)) {
        // The value wins: a placeholder part is hidden while the value is not empty (control.hidePlaceholderWhenFilled).
        const outranked = part.id === placeholderPart && (valueFilled || readOnly);
        out.push({ key: part.id, field: 'visible', value: conditionHolds(part.shownWhen, props) && !outranked });
        if (part.text?.counter) out.push({ key: part.id, field: 'text', value: counterLabel(props[part.text.counter.value], props[part.text.counter.max]) });
    }
    // A text slot with a condition is a layer shown while it holds (an affix text, shown with its switch and a non-empty text).
    for (const slot of template.anatomy) {
        if (slot.shownWhen) out.push({ key: slot.id, field: 'visible', value: conditionHolds(slot.shownWhen, props) });
        // A counter slot shows the value's length, as a counter part does.
        if (slot.text?.counter) out.push({ key: slot.id, field: 'text', value: counterLabel(props[slot.text.counter.value], props[slot.text.counter.max]) });
    }
    return out;
}

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
    // A length with no CSS mapping on purpose: the border width binds like any mapped property (so bind, Auto Fix
    // and the variables window pick it up), but the export draws it on the ::before overlay from the node, not as
    // a root declaration.
    strokeWidth: ['strokeWidth'],
    radius: ['radius'],
    paddingX: ['padH'],
    paddingY: ['padV'],
    gap: ['gap'],
    fontSize: ['fontSize'],
    lineHeight: ['lineHeight'],
    typography: ['typography'],
    height: ['h'],
    width: ['w'],
    size: ['w', 'h'],
    shadow: ['effects'],
};

/**
 * The literal props that write a node field, in prop order, as [prop, node, field]. A prop with no `node` writes nothing
 * (hasIcon, disabled): hasIcon is handled by the anatomy and state sync. Loading writes the root opacity.
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
        else if (spec.kind === 'number') out.push({ key, field, value: raw == null ? null : Number(raw) });
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
    return nodeWritersOf(template).flatMap(({ key, field }) => (OWNED_NODE_FIELDS[field] ?? [field]).map(name => ({ key, field: name })));
}

/** The node fields a prop's field writes: `width` is a fixed width (or hug), so it owns the width, its sizing and, for a text, whether it measures itself. */
const OWNED_NODE_FIELDS = { width: ['w', 'layoutSizingH', 'autoW'] };

/**
 * What a field write puts on a node: the field itself, except `width`, which is a fixed width (its sizing fixed, and a text no longer measures itself) or, with
 * no number, hug (and a text measures itself again); and `gap`, where no number is none.
 * @param {string} field
 * @param {unknown} value
 * @param {string} type the node's type (`text` or a frame)
 * @returns {Record<string, unknown>}
 */
export function nodeFieldPatch(field, value, type) {
    if (field === 'width') {
        if (value == null) return type === 'text' ? { layoutSizingH: 'hug', autoW: true } : { layoutSizingH: 'hug' };
        return type === 'text' ? { w: value, layoutSizingH: 'fixed', autoW: false } : { w: value, layoutSizingH: 'fixed' };
    }
    if (field === 'gap') return { gap: value == null ? 0 : value };
    if (field === 'opacity') return { opacity: value ?? 1 };
    return { [field]: value };
}

/**
 * The data attributes and custom properties the props that write layout, gap and width put on the root of Play and of the export, so the stylesheet's rules
 * (fieldRules in the codegen) draw them: a layout is `data-<prop>`, a gap or a width `--<template>-<prop>` in px (none for no width).
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {Record<string, unknown>} props the resolved props
 * @returns {{ attrs: Record<string, string>, vars: Record<string, string> }}
 */
export function fieldStyleOf(template, props) {
    /** @type {Record<string, string>} */
    const attrs = {}, vars = {};
    for (const { prop, field } of nodeWritersOf(template)) {
        if (field === 'layout') attrs[`data-${prop}`] = String(props[prop]);
        else if (field === 'primaryAlign') attrs[`data-${prop}-align`] = NODE_FIELDS.frame.primaryAlign.values[String(props[prop] === true)];
        else if ((field === 'gap' || field === 'width') && props[prop] != null) vars[`--${template.id}-${prop}`] = `${props[prop]}px`;
    }
    return { attrs, vars };
}

/**
 * The prop writers whose fields the export draws with data attributes and custom properties, as { prop, key, field }.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
export function fieldWritersOf(template) {
    return nodeWritersOf(template).filter(({ field }) => ['layout', 'gap', 'width', 'primaryAlign'].includes(field));
}
