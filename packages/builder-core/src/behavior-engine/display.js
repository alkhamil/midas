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
        // The colour a layer shows under its picture until it loads, or when it fails: bound to a variable, and no entry of the Fill list (no hidden fill).
        fillFallback: { kind: 'color', css: 'background-color' },
        stroke: { kind: 'color', css: 'border-color' },
        // No css: the root draws no border itself (its stroke is the ::before overlay, read from the node).
        strokeWidth: { kind: 'length' },
        radius: { kind: 'length', css: 'border-radius' },
        paddingX: { kind: 'length', css: 'padding-inline' },
        paddingY: { kind: 'length', css: 'padding-block' },
        paddingStart: { kind: 'length', css: 'padding-inline-start' },
        paddingEnd: { kind: 'length', css: 'padding-inline-end' },
        gap: { kind: 'length', css: 'gap' },
        height: { kind: 'length', css: 'height' },
        // The corners at the end side only (the right ones in a left to right row): a handler column attached to the right edge.
        radiusEnd: { kind: 'length', css: ['border-top-right-radius', 'border-bottom-right-radius'] },
        // A floor under the box's height: the box hugs its content and is never shorter than the token.
        minHeight: { kind: 'length', css: 'min-height' },
        // A fixed width from a token, bound through the w variable like the height through h.
        width: { kind: 'length', css: 'width' },
        minWidth: { kind: 'length', css: 'min-width' },
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
    // A glyph (the Checkbox's checkmark): a vector drawn filled in the CSS colour (currentColor), of a token's size on both axes.
    glyph: {
        fill: { kind: 'color', css: 'color' },
        size: { kind: 'length', css: ['width', 'height'] },
        // A stretched glyph (the stepper's divider is a bar a column wide and a line thick) sizes its axes apart.
        width: { kind: 'length', css: 'width' },
        height: { kind: 'length', css: 'height' },
    },
    // A line (a divider rule): a vector line node. Its stroke colour and width bind like any stroke; the length of a vertical one is a height token. The export draws none yet (codegen reports the slot).
    line: {
        stroke: { kind: 'color', css: null },
        strokeWidth: { kind: 'length' },
        width: { kind: 'length', css: null },
        height: { kind: 'length', css: null },
        // The least length of a filling vertical rule: a hugging root would otherwise collapse it.
        minHeight: { kind: 'length', css: 'min-height' },
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
    frame: { visible: { kind: 'boolean' }, primaryAlign: { kind: 'boolean', values: { true: 'end', false: 'start' } }, counterAlign: { kind: 'boolean', values: { true: 'start', false: 'center' } }, layout: { kind: 'enum', options: ['horizontal', 'vertical'] }, gap: { kind: 'number' }, width: { kind: 'number' }, widthSizing: { kind: 'enum', options: ['hug', 'fill'] }, opacity: { kind: 'boolean', values: { true: LOADING_OPACITY } }, imageFill: { kind: 'image' } },
    // fontStyle: a boolean writes italic or normal. textDecoration: flags, each boolean prop that names one adds it to the one value (underline and line-through compose
    // as `underline line-through`, none is `none`).
    text: {
        text: { kind: 'string' }, visible: { kind: 'boolean' }, width: { kind: 'number' }, heightSizing: { kind: 'enum', options: ['hug', 'fill'] },
        fontStyle: { kind: 'boolean', values: { true: 'italic', false: 'normal' } },
        textDecoration: { kind: 'boolean', flags: ['underline', 'line-through'] },
        // textTruncate clamps the text to its maxLines (a number of rows); a prop writes each.
        textTruncate: { kind: 'boolean', values: { true: true, false: false } },
        maxLines: { kind: 'number' },
    },
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

/**
 * A template's click toggle: the root attribute of the state prop a click turns on (and off), the attribute of the state it clears, and whether the click
 * only turns it on. Null when the template declares none. Play reads it from data attributes on the root.
 * @param {any} template
 * @returns {{ attr: string, clearsAttr: string | undefined, once: boolean } | null}
 */
export function toggleOf(template) {
    if (!template.toggle) return null;
    const attrs = stateAttributesOf(template);
    return { attr: attrs.find(a => a.prop === template.toggle.prop)?.attr, clearsAttr: attrs.find(a => a.prop === template.toggle.clears)?.attr, once: template.toggle.once === true };
}

/**
 * The aria-checked of a toggle control for the resolved props: `mixed` while the state it clears holds, else true or false. Undefined for a template with no toggle.
 * @param {any} template
 * @param {Record<string, unknown>} props
 * @returns {'true' | 'false' | 'mixed' | undefined}
 */
export function ariaCheckedOf(template, props) {
    if (!template.toggle) return undefined;
    if (template.toggle.clears && props[template.toggle.clears] === true) return 'mixed';
    return props[template.toggle.prop] === true ? 'true' : 'false';
}

/**
 * The tag of a template's element for a mode of the prop its tag follows (`element.tagBy`, a Title's level), else its fixed tag. The mode is matched by its name.
 * @param {any} template
 * @param {string | undefined} modeName
 * @returns {string}
 */
export function elementTagOf(template, modeName) {
    const by = template.element.tagBy;
    return (by && modeName !== undefined && Object.entries(by.tags).find(([mode]) => mode.toLowerCase() === String(modeName).toLowerCase())?.[1]) || template.element.tag;
}

/** The root attribute a state prop is written as (`data-password-visible`), or undefined when no state with an attribute follows it. */
export const attrOfProp = (template, prop) => stateAttributesOf(template).find(a => a.prop === prop)?.attr;

/** The root attribute a local interaction state is written as (`data-revealed`): the state's kebab name. */
export const localAttrOf = name => `data-${kebabOf(name)}`;

/** The local interaction states of a template, in press order: the toggleState names of its press entries. */
export const toggleStatesOf = template => [...new Set((template.press ?? []).filter(p => p.toggleState).map(p => p.toggleState))];

/**
 * What unmasks a masked control: a boolean prop, or a local interaction state of the template.
 * @returns {{ kind: 'prop', name: string } | { kind: 'local', name: string } | null}
 */
export const maskUnlessOf = template => {
    const m = template.control?.maskUnless;
    if (m === undefined) return null;
    return toggleStatesOf(template).includes(m) ? { kind: 'local', name: m } : { kind: 'prop', name: m };
};

/**
 * What a pressable glyph says about its click, as data attributes (Play reads them, see press.js): a toggle names the root attribute it flips, a step its direction.
 * @param {any} template
 * @param {string} slot the glyph slot's id
 * @returns {Record<string, string>}
 */
export function pressAttrsOf(template, slot) {
    const entry = (template.press ?? []).find(p => p.slot === slot);
    if (!entry) return {};
    if (entry.resize) return { 'data-press': 'resize' };
    // A copy press says which text it copies: the class of that slot's element, which Play reads the text from.
    if (entry.copy !== undefined) return { 'data-press': 'copy', 'data-press-copy': `${template.id}-${entry.copy}` };
    if (entry.dismiss) return { 'data-press': 'dismiss' };
    if (entry.toggleState !== undefined) return { 'data-press': 'toggle', 'data-press-attr': localAttrOf(entry.toggleState) };
    return entry.toggle !== undefined ? { 'data-press': 'toggle', 'data-press-attr': attrOfProp(template, entry.toggle) } : { 'data-press': 'step', 'data-press-step': String(entry.step) };
}

/**
 * The min and max height of a multiline control's text, from its rows: rows x line height (the metric is the bound layer's own, in px). The box adds its padding around it.
 * Without autoSize the box is at least `rows` tall and grows with its text; with it, `minRows` (else `rows`) is the floor and `maxRows` the ceiling (none when empty).
 * Null for a template with no multiline control.
 * @param {any} template
 * @param {Record<string, unknown>} props the resolved props
 * @param {{ lineHeight: number, paddingY: number }} metrics
 * @returns {{ minH: number, maxH: number | null } | null}
 */
export function rowsBounds(template, props, { lineHeight }) {
    const ml = multilineOf(template, props);
    if (!ml) return null;
    const box = rows => rows * lineHeight;
    const auto = props[ml.autoSize] === true;
    const min = auto && props[ml.minRows] != null ? props[ml.minRows] : props[ml.rows];
    const max = auto && props[ml.maxRows] != null ? props[ml.maxRows] : null;
    return { minH: box(Number(min)), maxH: max === null ? null : box(Number(max)) };
}

const kebabOf = name => name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

/**
 * What a multiline control puts on the root of Play and of the export: the resize option and autoSize as data attributes, the rows as custom properties
 * (`--<template>-rows`, and the autoSize min and max), which the stylesheet turns into the box's height with the line height and padding tokens.
 * @param {any} template
 * @param {Record<string, unknown>} props the resolved props
 * @returns {{ attrs: Record<string, string | true>, vars: Record<string, string> }}
 */
export function multilineStyleOf(template, props) {
    const ml = multilineOf(template, props);
    /** @type {Record<string, string | true>} */
    const attrs = {}, vars = {};
    if (!ml) return { attrs, vars };
    // The whole box acts as the field: the cursor is the text cursor over it and a click on its padding focuses the field (see forwardFocus).
    attrs['data-field-box'] = '';
    attrs[`data-${kebabOf(ml.resize)}`] = String(props[ml.resize]);
    vars[`--${template.id}-${kebabOf(ml.rows)}`] = String(props[ml.rows]);
    if (props[ml.autoSize] === true) {
        attrs[`data-${kebabOf(ml.autoSize)}`] = true;
        for (const key of [ml.minRows, ml.maxRows]) if (props[key] != null) vars[`--${template.id}-${kebabOf(key)}`] = String(props[key]);
    }
    return { attrs, vars };
}

/** The root attribute an enum prop is written as (`data-kind`): the prop lays the box out, or is the multiline control's resize option. Undefined when none is. */
export function enumAttrOf(template, prop) {
    const written = nodeWritersOf(template).some(w => w.prop === prop && w.field === 'layout') || template.control?.multiline?.resize === prop;
    return written ? `data-${kebabOf(prop)}` : undefined;
}

/** The node kind a display key targets: `root` is the instance's frame, otherwise the anatomy slot's or the part's kind. */
export const targetKindOf = (template, key) => {
    if (key === 'root') return 'frame';
    const slot = Array.isArray(template.anatomy) ? template.anatomy.find(s => s.id === key) : undefined;
    const part = Array.isArray(template.parts) ? template.parts.find(p => p.id === key) : undefined;
    const kind = slot ?? part;
    // A prop-only swap icon names no anatomy slot or part; its def still decides the kind.
    if (!kind) return (template.icons ?? []).some(d => d && typeof d === 'object' && d.slot === key) ? 'icon' : null;
    if (part?.arc) return 'arc';
    return kind.kind === 'icon' ? 'icon' : kind.kind === 'frame' ? 'frame' : kind.kind === 'glyph' ? 'glyph' : kind.kind === 'line' ? 'line' : 'text';
};

/** The text a counter part shows: the value's length, and `/ max` when the template has a maximum. */
export const counterLabel = (value, max) => `${String(value ?? '').length}${max != null ? ` / ${max}` : ''}`;

/** The text an overflow text shows: the count, or the limit and a plus once the count is above the limit (Badge's 99+). Never stored. */
export const overflowLabel = (count, limit) => (count != null && Number(count) > Number(limit) ? `${limit}+` : String(count ?? ''));

/** The text a derived text part or slot shows for these props, or undefined when it has none (a plain text). */
function derivedTextOf(text, props) {
    if (text?.counter) return counterLabel(props[text.counter.value], props[text.counter.max]);
    if (text?.overflow) return overflowLabel(props[text.overflow.value], props[text.overflow.limit]);
    return undefined;
}

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
        const partText = derivedTextOf(part.text, props);
        if (partText !== undefined) out.push({ key: part.id, field: 'text', value: partText });
    }
    // A text slot with a condition is a layer shown while it holds (an affix text, shown with its switch and a non-empty text).
    for (const slot of template.anatomy) {
        if (slot.shownWhen) out.push({ key: slot.id, field: 'visible', value: conditionHolds(slot.shownWhen, props) });
        // A derived text slot shows its counter's length or its overflow label, as a derived part does.
        const slotText = derivedTextOf(slot.text, props);
        if (slotText !== undefined) out.push({ key: slot.id, field: 'text', value: slotText });
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

/**
 * The node variable keys (`vars`) a mapped property is bound through in the editor. One property can take more than one key
 * (an icon's size binds both width and height). `paddingX` and `paddingY` use the editor's paired padding keys.
 * @type {Record<string, string[]>}
 */
export const VARIABLE_KEYS = {
    fill: ['fills.0'],
    fillFallback: ['fallbackFill'],
    stroke: ['stroke'],
    // A length with no CSS mapping on purpose: the border width binds like any mapped property (so bind, Auto Fix
    // and the variables window pick it up), but the export draws it on the ::before overlay from the node, not as
    // a root declaration.
    strokeWidth: ['strokeWidth'],
    radius: ['radius'],
    paddingX: ['padH'],
    paddingY: ['padV'],
    paddingStart: ['padL'],
    paddingEnd: ['padR'],
    gap: ['gap'],
    fontSize: ['fontSize'],
    lineHeight: ['lineHeight'],
    typography: ['typography'],
    height: ['h'],
    width: ['w'],
    minWidth: ['minW'],
    minHeight: ['minH'],
    radiusEnd: ['rTR', 'rBR'],
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
        .filter(([, def]) => def.source === 'literal')
        .flatMap(([prop, def]) => [/** @type {any} */ (def).node, .../** @type {any} */ (def).nodes ?? []].filter(Boolean).map(n => ({ prop, key: n.key, field: n.field, values: n.values, flag: n.flag })));
}

/**
 * The text decoration of the lines that are on, one value for the node, Play and the export: `underline`, `line-through`, both as `underline line-through`, or `none`.
 * @param {string[]} lines the decoration lines that are on (any order)
 * @returns {string}
 */
export function textDecorationOf(lines) {
    return NODE_FIELDS.text.textDecoration.flags.filter(f => lines.includes(f)).join(' ') || 'none';
}

/**
 * Which decoration lines a node's `textDecoration` value draws: the canvas draws the underline and the strike from this, not from an exact match.
 * @param {unknown} value
 * @returns {{ underline: boolean, strike: boolean }}
 */
export function decorationLinesOf(value) {
    const words = String(value ?? 'none').split(/\s+/);
    return { underline: words.includes('underline'), strike: words.includes('line-through') };
}

/**
 * Whether the canvas draws a prop's text as bullets: it is the control's value and the prop named by `control.maskUnless` is off. The value stays in its prop.
 * @param {any} template
 * @param {string} prop
 * @param {Record<string, unknown>} props the resolved props
 */
export const masked = (template, prop, props) => template.control?.value === prop && maskedOn(template, props);

/** Whether the control's text is masked for these props: it has a mask, the mask applies (`maskWhen`), and the prop that unmasks it is off. */
export const maskedOn = (template, props) => template.control?.maskUnless !== undefined && (template.control.maskWhen === undefined || conditionHolds(template.control.maskWhen, props)) && props[template.control.maskUnless] !== true;

/** The multiline control for these props, or null: the control has one and it applies (`when`). */
export function multilineOf(template, props) {
    const ml = template.control?.multiline;
    return ml && (ml.when === undefined || conditionHolds(ml.when, props)) ? ml : null;
}

/**
 * The prop that stores the text of a display key's layer: the literal prop whose `node` is `{ key, field: 'text' }`. Undefined when the key has none.
 * @param {any} template
 * @param {string} key
 * @returns {string | undefined}
 */
export function textPropOfKey(template, key) {
    return nodeWritersOf(template).find(w => w.key === key && w.field === 'text')?.prop;
}

/**
 * The canvas is the source of truth for text: the props to write back so each text prop holds the text its layer shows. A layer is read through
 * `textOf(key)` (undefined when the instance has no layer for it). A masked control's layer holds bullets, not the value, so it is never written back.
 * @param {any} template
 * @param {Record<string, unknown>} props the instance's resolved props
 * @param {(key: string) => string | undefined} textOf
 * @returns {Record<string, string>} prop -> text, only where the layer and the prop differ
 */
export function textWriteBacks(template, props, textOf) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const { prop, key, field } of nodeWritersOf(template)) {
        if (field !== 'text' || masked(template, prop, props)) continue;
        const text = textOf(key);
        if (typeof text === 'string' && text !== String(props[prop] ?? '')) out[prop] = text;
    }
    return out;
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
    /** @type {Map<string, { entry: { key: string, field: string, value: unknown }, on: Set<string> }>} the one entry of a field several flag props write */
    const flagged = new Map();
    for (const { prop, key, field, values, flag } of nodeWritersOf(template)) {
        const spec = NODE_FIELDS[targetKindOf(template, key)][field];
        const raw = props[prop];
        // Flag props compose into one value: the flags that are on, in the field's order (`underline line-through`), else `none`.
        if (flag !== undefined) {
            const id = `${key}\0${field}`;
            if (!flagged.has(id)) { const entry = { key, field, value: 'none' }; flagged.set(id, { entry, on: new Set() }); out.push(entry); }
            const held = flagged.get(id);
            if (raw === true) held.on.add(flag);
            held.entry.value = textDecorationOf([...held.on]);
            continue;
        }
        // An enum prop may write a different value to each of its options (the kind lays the box out as a row or a column).
        if (values) out.push({ key, field, value: values[String(raw)] });
        else if (spec.kind === 'boolean') out.push({ key, field, value: spec.values[String(raw === true)] });
        else if (spec.kind === 'number') out.push({ key, field, value: raw == null ? null : Number(raw) });
        else if (spec.kind === 'image') out.push({ key, field, value: raw == null || raw === '' ? null : String(raw) });
        else out.push({ key, field, value: masked(template, prop, props) ? '•'.repeat(String(raw).length) : String(raw) });
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
const OWNED_NODE_FIELDS = { width: ['w', 'layoutSizingH', 'autoW'], heightSizing: ['layoutSizingV'], widthSizing: ['layoutSizingH'], imageFill: ['fills'] };

/** An image fill without the natural size of its old picture. */
function withoutNaturalSize({ iw, ih, ...rest }) {
    return rest;
}

/**
 * The fills of a node that holds a picture: its other fills stay as they are (none is hidden or added) and the picture is one image fill after them, covering the box. A picture
 * the node already has keeps everything but its asset (hidden, mode, scale, opacity are the designer's, set in the Fill panel); only the asset is the prop's. No asset removes the
 * picture. The result is the whole `fills` list.
 * @param {unknown} asset the asset id, or nothing
 * @param {{ fills?: any[] } | undefined} node
 */
function imageFillPatch(asset, node) {
    const colours = (node?.fills ?? []).filter(f => f.type !== 'image');
    const own = (node?.fills ?? []).find(f => f.type === 'image');
    // The mode and the tile scale stay the designer's across a new source; the old picture's natural size goes with it.
    return { fills: asset == null ? colours : [...colours, own ? { ...(own.image === asset ? own : withoutNaturalSize(own)), image: asset } : { type: 'image', image: asset, mode: 'fill', scale: 1, opacity: 1, visible: true }] };
}

/**
 * What a field write puts on a node: the field itself, except `width`, which is a fixed width (its sizing fixed, and a text no longer measures itself) or, with
 * no number, hug (and a text measures itself again); and `gap`, where no number is none.
 * @param {string} field
 * @param {unknown} value
 * @param {string} type the node's type (`text` or a frame)
 * @returns {Record<string, unknown>}
 */
export function nodeFieldPatch(field, value, type, node) {
    if (field === 'imageFill') return imageFillPatch(value, node);
    if (field === 'width') {
        if (value == null) return type === 'text' ? { layoutSizingH: 'hug', autoW: true } : { layoutSizingH: 'hug' };
        return type === 'text' ? { w: value, layoutSizingH: 'fixed', autoW: false } : { w: value, layoutSizingH: 'fixed' };
    }
    if (field === 'heightSizing') return { layoutSizingV: value };
    if (field === 'widthSizing') return { layoutSizingH: value };
    if (field === 'gap') return { gap: value == null ? 0 : value };
    // A row count is at least one (the canvas never holds none).
    if (field === 'maxLines') return { maxLines: value == null ? 1 : value };
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
export function fieldStyleOf(template, props, assets = {}) {
    /** @type {Record<string, string>} */
    const attrs = {}, vars = {}, style = {};
    for (const writer of nodeWritersOf(template)) {
        const { prop, field } = writer;
        if (field === 'layout') attrs[`data-${prop}`] = String(props[prop]);
        else if (field === 'primaryAlign') attrs[`data-${prop}-align`] = alignValueOf(writer, props[prop]);
        else if (field === 'counterAlign') attrs[`data-${prop}-cross`] = alignValueOf(writer, props[prop]);
        // A text style the stylesheet draws from a data attribute on the root (italic, an underline or a strike line), and a line clamp from its count.
        else if (field === 'fontStyle' || writer.flag !== undefined) { if (props[prop] === true) attrs[`data-${kebabOf(prop)}`] = ''; }
        else if (field === 'textTruncate') { if (props[prop] === true) attrs[`data-${kebabOf(prop)}`] = ''; }
        else if (field === 'maxLines') { if (props[prop] != null) vars[`--${template.id}-${kebabOf(prop)}`] = String(props[prop]); }
        else if ((field === 'gap' || field === 'width') && props[prop] != null) vars[`--${template.id}-${prop}`] = `${props[prop]}px`;
        // A picture is a data attribute that clears the colour under it, and the asset's source as the root's own background image: not a custom property, which Chrome drops
        // above about 2 MB (a picture is a data URL of any size here). The export carries a short URL as a custom property the stylesheet reads.
        // The picture of the root is the root's background; a picture on another layer is that layer's own (Play draws it from the layer's fill, the export from its rule).
        else if (field === 'imageFill' && writer.key === 'root' && props[prop] != null && assets[String(props[prop])]) { attrs[`data-${prop}`] = ''; style.backgroundImage = `url("${assets[String(props[prop])]}")`; }
    }
    const multiline = multilineStyleOf(template, props);
    return { attrs: { ...attrs, ...multiline.attrs }, vars: { ...vars, ...multiline.vars }, style };
}

/**
 * The prop writers whose fields the export draws with data attributes and custom properties, as { prop, key, field }.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
export function fieldWritersOf(template) {
    return nodeWritersOf(template).filter(({ field }) => ['layout', 'gap', 'width', 'primaryAlign', 'counterAlign', 'imageFill', 'fontStyle', 'textDecoration', 'textTruncate', 'maxLines'].includes(field));
}

/**
 * The alignment a primaryAlign writer gives for a prop's value: the writer's own value map (an enum), else a boolean's true and false map
 * (a Switch's handle: on is the end).
 * @param {{ values?: Record<string, string> }} writer
 * @param {unknown} raw the prop's value
 * @returns {string}
 */
export function alignValueOf(writer, raw) {
    return writer.values ? writer.values[String(raw)] : NODE_FIELDS.frame[writer.field ?? 'primaryAlign'].values[String(raw === true)];
}

/**
 * The alignments a primaryAlign writer can give: the distinct values of its map, or start and end for a boolean.
 * @param {{ values?: Record<string, string> }} writer
 * @returns {string[]}
 */
export function alignValuesOf(writer) {
    return [...new Set(Object.values(writer.values ?? NODE_FIELDS.frame[writer.field ?? 'primaryAlign'].values))];
}
