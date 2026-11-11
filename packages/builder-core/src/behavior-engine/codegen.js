// Code generator (stage 8). Pure: a template, its master's binding, the document's variables and a component name in; a React
// component (JSX) and its stylesheet out. Both come from the schema and the same resolver the preview uses, so the same inputs
// give the same text. If any token is unresolved for any mode, nothing is written: the result has no files and lists the reasons.
import { previewOf } from './preview.js';
import { variableProps } from './registry.js';
import { resolveProps } from './instance-props.js';
import { NODE_PROPERTIES, LOADING_OPACITY, elementTagOf, textDecorationOf, alignValuesOf, enumAttrOf, canvasPartsOf, fieldWritersOf, localAttrOf, maskUnlessOf, placeholderPartOf, stateAttributesOf, targetKindOf, toggleStatesOf } from './display.js';
import { pathCommands, svgPathD } from '../geometry/shapes.js';
import { controlOf, iconDefsOf, placementsOfDef, slotDefsOf, swapDefsOf } from './anatomy.js';
import { cssVarOf, splitColor, tokenValueOf } from './tokens.js';
import { glyphFillRuleAttr, glyphPathD } from './glyphs.js';
import { commitNumber, resizeHeight, resizeLimits, startResizeDrag } from '../prototype/press.js';
import { glyphTests } from './validate-schema.js';
import { stateSwaps } from './state-bindings.js';

/** The CSS justify-content of an alignment: start and end are the flex ends, centre is centre. */
const justifyOf = side => (side === 'center' ? 'center' : `flex-${side}`);

/** The JSX value of a primaryAlign writer's data attribute: a boolean prop picks end or start; an enum prop looks its option up in its value map. */
function alignExprOf(writer) {
    if (!writer.values) return `${writer.prop} ? "end" : "start"`;
    const entries = Object.entries(writer.values).map(([option, value]) => `"${option}": "${value}"`).join(', ');
    return `{${entries}}[${writer.prop}]`;
}

/** A camelCase name as kebab-case (the custom properties and data attributes a prop is written as). */
const kebabCase = name => name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
import { rootLayoutOf, labelLayoutOf, flexOf, flowSizing } from './layout.js';
import { labelEntryOf } from './layers.js';
import { managedContainerLayer, managedTextLayer } from './template-master.js';
import { modeOfStyleKey } from './variant-style.js';

// Motion constants (antd seed): the focus ring animates in and out; the click wave expands and fades. Durations and
// easings have no variable type, so they live here, not in Semantic.
// motionDurationMid + motionEaseInOut: the input transition.
const FOCUS_TRANSITION = 'outline-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1), outline-offset 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)';
// Wave spread lands at 20% of the 2s opacity leg (0.4s), motionEaseOutCirc; the colour comes from the wave-color token.
const WAVE_KEYFRAMES = 'midas-wave';
const WAVE_ANIMATION = 'midas-wave 2s cubic-bezier(0.08, 0.82, 0.17, 1)';
export const WAVE_SPREAD = '6px';
const WAVE_START_OPACITY = 0.2;
/** The custom property the wave ring reads its colour from: set on each template's ring, read by the one shared keyframes. */
const WAVE_COLOR_VAR = '--midas-wave-color';
// A part declared `spin` turns about its centre; the arc it draws is what shows the turn.
export const SPIN_KEYFRAMES = 'midas-spin';
export const SPIN_ANIMATION = `${SPIN_KEYFRAMES} 1s linear infinite`;

/** The DOM handler each schema event is written to. */
const DOM_EVENT = { onClick: 'onClick', onHover: 'onMouseEnter', onFocus: 'onFocus', onBlur: 'onBlur' };

/** The elements that have a `disabled` attribute. */
const DISABLEABLE = new Set(['button', 'input', 'select', 'textarea', 'fieldset', 'optgroup', 'option']);

/**
 * The CSS pseudo-class a state is written as. A root with no `disabled` attribute says it disabled with aria-disabled, so its disabled state selects on that.
 * @param {any} template
 * @param {string} state
 */
const pseudoOf = (template, state) => (state === template.element.disabledState && !DISABLEABLE.has(template.element.tag) ? '[aria-disabled="true"]' : template.statePseudo[state]);

/** The disabled pseudo-class of a template, or '' when it declares no disabled state (a non-interactive one). */
const disabledPseudoOf = template => (template.element.disabledState === undefined ? '' : pseudoOf(template, template.element.disabledState));

/** `:not(<disabled>)` for the interaction rules, or '' when the template has no disabled state. */
const notDisabledOf = template => (disabledPseudoOf(template) ? `:not(${disabledPseudoOf(template)})` : '');

/** The props that turn the disabled state on (its own prop and each alias of it), joined for a condition; '' when the template has no disabled state. */
const disabledPropsOf = template => {
    const off = template.element.disabledState;
    if (off === undefined || !template.persistentStates[off]) return '';
    const own = template.persistentStates[off].prop;
    return Object.values(template.persistentStates).filter(def => def.prop === own || def.as === off).map(def => def.prop).join(' || ');
};

/** The DOM handler type each schema event is typed with in a .tsx (the element type fills the generic). */
const EVENT_TYPE = { onClick: 'MouseEventHandler', onHover: 'MouseEventHandler', onFocus: 'FocusEventHandler', onBlur: 'FocusEventHandler' };

/** The React attribute type and the element type of a template's root tag: a few tags by name, any other as the DOM's own element type for that tag. */
const ELEMENT_TYPES = { button: ['ButtonHTMLAttributes', 'HTMLButtonElement'], input: ['InputHTMLAttributes', 'HTMLInputElement'], div: ['HTMLAttributes', 'HTMLDivElement'], span: ['HTMLAttributes', 'HTMLSpanElement'] };

/**
 * The content slots of a template as the props they become in the generated component: one slot is `children`, several keep their schema id.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {{ prop: string, slot: any }[]}
 */
const slotPropsOf = template => (template.slots ?? []).map(slot => ({ prop: template.slots.length === 1 ? 'children' : slot.id, slot }));

/** The TypeScript type of a schema prop: a variable prop is the mode id string, a literal its type, an enum its union, an icon a ReactNode. */
const typeOfProp = def => def.source === 'variable' ? 'string' : def.type === 'enum' ? def.options.map(o => JSON.stringify(o).replace(/"/g, "'")).join(' | ')
    : def.type === 'number' ? (def.default === null ? 'number | null' : 'number') : def.type === 'iconComponent' ? 'ReactNode' : def.type === 'image' ? 'string' : def.type;

/** The props type and the imports of a slotted component (the conventions of play-from-tsx.md 2.1). */
function propsTypeOf(template, name, elementType, attrType) {
    const lines = [];
    for (const [prop, def] of Object.entries(template.props)) lines.push(`  ${prop}?: ${typeOfProp(def)};`);
    for (const event of template.events) lines.push(`  ${event.name}?: ${EVENT_TYPE[event.name]}<${elementType}>;`);
    for (const { prop } of slotPropsOf(template)) lines.push(`  ${prop}?: ReactNode;`);
    lines.push('  className?: string;', '  style?: CSSProperties;');
    const own = [...Object.keys(template.props), ...template.events.map(e => e.name), ...slotPropsOf(template).map(s => s.prop), 'children', 'className', 'style'];
    const omitted = [...new Set(own)].map(key => `'${key}'`).join(' | ');
    const used = ['CSSProperties', 'ReactNode', attrType, ...new Set(template.events.map(e => EVENT_TYPE[e.name]))];
    return [
        template.slots.some(slot => slot.repeat) ? "import { Fragment, forwardRef } from 'react';" : "import { forwardRef } from 'react';",
        `import type { ${[...new Set(used)].sort().join(', ')} } from 'react';`,
        `import './${name}.css';`,
        '',
        `export type ${name}Props = Omit<${attrType}<${elementType}>, ${omitted}> & {`,
        ...lines,
        '};',
        '',
    ];
}

/**
 * The component source for a template. Problems found on the way are pushed onto `problems`.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} name
 * @param {any[]} problems
 */
/**
 * The width an arc part exports at: the master's part layer when it names one, else the template default.
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @returns {(part: any) => number}
 */
function partWidthOf(master, childrenOf) {
    return part => {
        const nodeWidth = childrenOf(master.id).find(c => c.behavior?.part === part.id)?.strokeWidth;
        return typeof nodeWidth === 'number' ? nodeWidth : part.arc.width;
    };
}

/**
 * The placeholder a control input exports: the prop plainly when no placeholder part exists, else while the value is empty
 * (and never while read-only: a read-only input shows its value, not the placeholder). Reads the control extras only.
 */
function placeholderCondition(template, control) {
    if (placeholderPartOf(template) === undefined) return control.placeholder;
    return `String(${control.value} ?? "") === ""${control.readonly ? ` && ${control.readonly} !== true` : ''} ? ${control.placeholder} : undefined`;
}

/** The name of the callback a press toggle reports to: `on<Prop>Change`. */
const toggleCallback = prop => `on${prop[0].toUpperCase()}${prop.slice(1)}Change`;

/** The click handler of a pressable glyph in the export: a toggle reports the next value, a step its direction; nothing while the control is disabled. */
function pressHandlerJsx(template, slot) {
    const entry = (template.press ?? []).find(p => p.slot === slot.id);
    if (!entry) return '';
    const disabled = disabledPropsOf(template);
    if (entry.copy !== undefined) return ` onClick={() => { ${disabled ? `if (!(${disabled})) { ` : '{ '}navigator.clipboard?.writeText(String(${entry.copy} ?? "")); onCopy?.(${entry.copy}); } }}`;
    if (entry.toggleState !== undefined) return ` onClick={() => { ${disabled ? `if (!(${disabled})) ` : ''}set${entry.toggleState[0].toUpperCase()}${entry.toggleState.slice(1)}(!${entry.toggleState}); }}`;
    if (entry.dismiss) return ` onClick={() => { ${disabled ? `if (!(${disabled})) { setDismissed(true); onClose?.(); }` : 'setDismissed(true); onClose?.();'} }}`;
    if (entry.resize) return ` onPointerDown={(e) => { ${disabled ? `if (${disabled}) return; ` : ''}const drag = startResizeDrag(e.currentTarget.closest("[data-field-box]"), e.clientY, (el) => getComputedStyle(el)); if (!drag) return; e.preventDefault(); const move = (m) => drag.move(m.clientY); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }}`;
    return entry.toggle !== undefined ? ` onClick={() => { ${disabled ? `if (!(${disabled})) ` : ''}${toggleCallback(entry.toggle)}?.(!${entry.toggle}); }}` : ` onClick={() => { ${disabled ? `if (!(${disabled})) ` : ''}onStep?.(${entry.step}); }}`;
}

/** `Input.Password = ...`: a sub-component is the component with some props fixed, as antd names them. */
function subcomponentLines(template, name) {
    return (template.subcomponents ?? []).flatMap(sub => ['', `${name}.${sub.name} = function ${sub.name}(props) {`, `  return <${name} {...props} ${Object.entries(sub.props).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join(' ')} />;`, '};']);
}

/** The JSX of an overflow text: the limit and a plus above it, else the count (overflowLabel, as an expression of the props). */
function overflowJsx({ value, limit }) {
    return `{Number(${value}) > Number(${limit}) ? \`\${${limit}}+\` : (${value} ?? "")}`;
}

/** The counter of a slot that sits in a container: a span of its class showing the value's length (and the limit), while its condition holds. */
function counterJsx(template, slot) {
    const { value, max } = slot.text.counter;
    const limit = max ? '{' + max + ' != null ? ` / ${' + max + '}` : ""}' : '';
    return '{(' + shownJsx(slot.shownWhen) + ') && <span className="' + template.id + '-' + slot.id + '">{' + value + '.length}' + limit + '</span>}';
}

/** The element of a glyph slot: a span of the slot's class holding the definition's outline as an SVG, in currentColor. */
export const glyphJsx = (template, slot) => `<span className="${template.id}-${slot.id}"${pressHandlerJsx(template, slot)}><svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="${glyphPathD(slot.glyph)}" fill="currentColor"${glyphFillRuleAttr(slot.glyph)} /></svg></span>`;

function componentSource(template, name, problems, partWidthOf = part => part.arc.width, tagMap = null) {
    const params = Object.entries(template.props).filter(([, def]) => def.derived === undefined).map(([prop, def]) => (def.source === 'variable' ? prop : `${prop} = ${JSON.stringify(def.default)}`));
    for (const event of template.events) {
        if (!DOM_EVENT[event.name]) problems.push({ event: event.name, reason: 'no-dom-event' });
        params.push(event.name);
    }
    // A pressable glyph reports its press: a toggle the next value of its prop, a step its direction.
    if (controlOf(template)?.number) params.push('onCommit');
    for (const entry of (template.press ?? []).filter(p => !p.resize && p.toggleState === undefined)) { const name = entry.toggle !== undefined ? toggleCallback(entry.toggle) : entry.dismiss ? 'onClose' : entry.copy !== undefined ? 'onCopy' : 'onStep'; if (!params.includes(name)) params.push(name); }
    // A derived boolean (the value has reached a limit) is read from the others in the component, never passed in.
    // A `when` rule holds as its condition does; a limit rule reads its value against the limit.
    const derivedLines = Object.entries(template.props).filter(([, def]) => def.derived !== undefined).map(([prop, { derived }]) => derived.when !== undefined ? `  const ${prop} = ${shownJsx(derived.when)};` : `  const ${prop} = ${derived.limit} != null && Number(${derived.value}) ${derived.cmp === 'gte' ? '>=' : '<='} ${derived.limit} && String(${derived.value} ?? "") !== "";`);
    // A control that is a textarea for one kind and an input for the others is one element chosen by the props.
    // A dismiss press keeps the element in local state: it is drawn until the click, then not at all (the export has no exit motion).
    const dismissLines = (template.press ?? []).some(p => p.dismiss) ? ['  const [dismissed, setDismissed] = useState(false);', '  if (dismissed) return null;'] : [];
    // A toggleState press keeps its interaction state local too: false until the click, flipped by it, with no prop and no callback.
    const toggleStates = toggleStatesOf(template);
    const localLines = toggleStates.map(s => `  const [${s}, set${s[0].toUpperCase()}${s.slice(1)}] = useState(false);`);
    const controlLines = controlOf(template)?.multiline?.when ? [`  const Control = ${shownJsx(controlOf(template).multiline.when)} ? "textarea" : "input";`] : [];
    const slotted = (template.slots ?? []).length > 0;
    // The props that write a gap or a width reach the stylesheet as custom properties on the root (a width of none is not set); a layout is a data attribute.
    const varPairs = fieldWritersOf(template).filter(w => w.field === 'gap' || w.field === 'width').map(w => {
        const none = template.props[w.prop].default === null ? `${w.prop} == null ? undefined : ` : '';
        return `'--${template.id}-${w.prop}': ${none}\`\${${w.prop}}px\``;
    });
    // A picture reaches the stylesheet as a url() custom property (the export takes the source as a string), and a data attribute says it shows.
    for (const w of fieldWritersOf(template).filter(w => w.field === 'imageFill')) varPairs.push("'--" + template.id + '-' + w.prop + "': " + w.prop + ' ? `url("${' + w.prop + '}")` : undefined');
    // A multiline control's rows reach the stylesheet as custom properties (the height is rows x line height + padding, see multilineRules).
    const ml = controlOf(template)?.multiline;
    if (ml) {
        varPairs.push(`'--${template.id}-${kebabCase(ml.rows)}': ${ml.rows}`);
        for (const key of [ml.minRows, ml.maxRows]) varPairs.push(`'--${template.id}-${kebabCase(key)}': ${ml.autoSize} && ${key} != null ? ${key} : undefined`);
    }
    // A line clamp reaches the stylesheet as its count (no count is no clamp).
    for (const w of fieldWritersOf(template).filter(w => w.field === 'maxLines')) varPairs.push(`'--${template.id}-${kebabCase(w.prop)}': ${w.prop} ?? undefined`);
    const varsExpr = varPairs.length ?`{ ${varPairs.join(', ')} }` : null;
    // Whatever turns the disabled state on: its own prop, and the prop of each state that is an alias of it (the Input's Read only).
    const disabledProp = disabledPropsOf(template);
    const children = [];
    // The canvas frame parts (the spinner) are drawn as the canvas places them: before the first text layer. An arc is an SVG path
    // of the same geometry the canvas and Play draw, shown while its condition holds (at rest: the turn is Play's).
    const framePartJsx = (part, extra = '') => {
        const { size, start, sweep } = part.arc;
    // A user stroke width is the node's own: Play and the export draw it, so a width set by hand on the part layer wins over the template default.
    const width = partWidthOf(part);
        const node = { type: 'ellipse', w: size - width, h: size - width, arcStart: start, arcSweep: sweep, arcRatio: part.arc.ratio };
        const d = svgPathD(pathCommands(node), value => +value.toFixed(3));
        // The box is the part's icon size token (its display mapping), so the arc follows the Size; the stroke keeps its own width.
        const sizeToken = template.display?.[part.id]?.size;
        const box = sizeToken ? `style={{ width: "var(${cssVarOf(template.id, sizeToken)})", height: "var(${cssVarOf(template.id, sizeToken)})" }}` : `width={${size}} height={${size}}`;
        return `{${part.shownWhen.prop} === true${extra ? ` && ${extra}` : ''} && (<svg className="${template.id}-${part.id}" ${box} viewBox="0 0 ${size} ${size}" aria-hidden="true"><path transform="translate(${width / 2} ${width / 2})" d="${d}" fill="none" stroke="currentColor" strokeWidth={${width}} vectorEffect="non-scaling-stroke" /></svg>)}`;
    };
    const framed = canvasPartsOf(template).filter(part => part.kind === 'frame' && part.arc);
    // A part with a parent draws inside its container (the Switch spinner in the handle), never at the root.
    const rooted = framed.filter(part => !part.parent);
    const parented = part => framed.filter(p => p.parent === part);
    const ctl = controlOf(template);
    // The clear and the counter follow the input, as the canvas and Play order them: a text affix after the input comes after them.
    const countSlot = template.anatomy.find(s => s.text?.counter && !s.parent);
    const controlPartsJsx = () => [
        ...(ctl?.count ? ['{' + (countSlot?.shownWhen ? `(${shownJsx(countSlot.shownWhen)})` : ctl.count) + ' && <span className="' + template.id + '-count">{' + ctl.value + '.length}' + (ctl.maxlength ? '{' + ctl.maxlength + ' != null ? ` / ${' + ctl.maxlength + '}` : ' + "''" + '}' : '') + '</span>}'] : []),
    ];
    let framePlaced = false;
    let sidedAfterPlaced = false;
    const sidedAfter = rooted.filter(part => part.side).map(part => framePartJsx(part, `${part.side} === "end"`));
    const emitSlot = (slot, out) => {
        if (slot.kind === 'text' || slot.kind === 'control') {
            // The counter is written after the control it counts (controlPartsJsx), which is where the anatomy puts it.
            if (slot.text?.counter) {
                // A counter in a container (the text area's footer) is written where its container is, with its own condition.
                if (slot.parent) out.push(counterJsx(template, slot));
                return;
            }
            if (!framePlaced && !slot.parent) { out.push(...rooted.filter(part => !part.side).map(part => framePartJsx(part)), ...rooted.filter(part => part.side).map(part => framePartJsx(part, `${part.side} !== "end"`))); framePlaced = true; }
            const isControl = controlOf(template)?.slot === slot.id;
            const control = controlOf(template);
            // An overflow text derives its text from its count and limit, so it needs no prop of its own.
            if (!template.props[slot.id] && !isControl && !slot.text?.overflow) problems.push({ slot: slot.id, reason: 'no-prop' });
            // A control slot is an input holding the value prop (and the placeholder beside it), not a span.
            const label = control && control.slot === slot.id
                ? `<${control.multiline ? (control.multiline.when ? 'Control' : 'textarea') : 'input'} className="${template.id}-${slot.id}" ${control.number ? `defaultValue={${control.value}} key={${control.value}} data-committed={${control.value}}` : `value={${control.value}}`}${control.placeholder ? ` placeholder={${placeholderCondition(template, control)}}` : ''}${control.readonly ? ` readOnly={${control.readonly}}` : ''}${control.maxlength ? ` maxLength={${control.maxlength}}` : ''}${control.minlength ? ` minLength={${control.minlength}}` : ''}${control.maskUnless ? ` type={${control.maskWhen ? `(${shownJsx(control.maskWhen)}) && !${control.maskUnless}` : `!${control.maskUnless}`} ? "password" : undefined}` : ''}${control.multiline ? ` rows={${control.multiline.when ? `(${shownJsx(control.multiline.when)}) ? ${control.multiline.rows} : undefined` : control.multiline.rows}}` : ''}${control.number ? ` min={${control.number.min} ?? undefined} max={${control.number.max} ?? undefined} step={${control.number.step}} onBlur={(e) => { const next = commitNumber(e.target.value, e.target.dataset.committed ?? "", { min: ${control.number.min} ?? null, max: ${control.number.max} ?? null, precision: ${control.number.precision} ?? null }); e.target.value = next; e.target.dataset.committed = next; onCommit?.(next); }}` : ''} disabled={${disabledProp}} />`
                : `<span className="${template.id}-${slot.id}">${slot.text?.overflow ? overflowJsx(slot.text.overflow) : `{${slot.id}}`}</span>`;
            // The control is always written: the input holds the value and the placeholder whether or not the canvas has a layer for them.
            out.push(isControl ? label : slot.shownWhen ? `{(${shownJsx(slot.shownWhen)}) && ${label}}` : slot.optional ? `{${slot.id} && ${label}}` : label);
            if (!sidedAfterPlaced && !slot.parent) { out.push(...sidedAfter); sidedAfterPlaced = true; }
            if (isControl) out.push(...controlPartsJsx());
        }
        else if (slot.kind === 'frame') emitContainer(slot, out);
        else if (slot.kind === 'glyph') {
            // A glyph is drawn from its definition, always: the stylesheet shows it while its state attribute is on (see glyphRules), so Play and the export need no layer.
            out.push(glyphJsx(template, slot));
        }
        else if (slot.kind === 'line') {
            // A rule is an empty element drawn by its border (see lineDecls); it exists while its condition holds.
            out.push(`{(${shownJsx(slot.shownWhen)}) && <span className="${template.id}-${slot.id}" />}`);
        }
        else if (slot.managed) {
            const defs = slotDefsOf(template, slot.id);
            if (!defs.length) problems.push({ slot: slot.id, reason: 'unsupported-slot' });
            else for (const def of defs) {
                const tests = placementsOfDef(template, def, slot.id).map(value => `${def.placement} === "${value}"`);
                const cond = tests.length === 1 ? tests[0] : tests.length ? `(${tests.join(' || ')})` : null;
                // A slot a canvas part replaces (the start icon while the spinner shows) is not drawn while that part shows.
                const replacedBy = [
                    ...canvasPartsOf(template).filter(part => part.replaces === slot.id).map(part => `${part.shownWhen.prop} !== true`),
                    ...canvasPartsOf(template).filter(part => part.side).flatMap(part => Object.entries(template.props[part.side].slots ?? {}).filter(([, mapped]) => [mapped].flat().includes(slot.id)).map(([value]) => `!(${part.shownWhen.prop} === true && ${part.side} === "${value}")`)),
                ];
                out.push(`{${[...(typeof def.show === 'string' ? [def.show] : def.show === undefined ? [] : [shownJsx(def.show)]), ...(def.hideWhenEmpty !== undefined ? [`${def.hideWhenEmpty} !== ''`] : []), ...(cond ? [cond] : []), ...replacedBy, ...(def.swap ? [swapCondJsx(def.swap)] : [])].join(' && ')} && <span className="${template.id}-${slot.id}">{${def.component}}</span>}`);
            }
        }
        else problems.push({ slot: slot.id, reason: 'unsupported-slot' });
    };
    // A conditional container draws only while its condition holds, like its text does.
    // A container is one element of the template's class around the slots that name it, in anatomy order; its layout is the box frame's own (see boxRules).
    function emitContainer(slot, out) {
        const inner = [];
        for (const child of template.anatomy.filter(c => c.parent === slot.id)) emitSlot(child, inner);
        for (const part of parented(slot.id)) inner.push(framePartJsx(part));
        // A swap icon with no canvas layer is drawn from its component prop, like a managed slot's icon, gated by its show and its swap state.
        for (const def of swapDefsOf(template, slot.id)) {
            if (def.slot === undefined || template.anatomy.some(s => s.id === def.slot && s.managed)) continue;
            const conds = [...(typeof def.show === 'string' ? [def.show] : def.show === undefined ? [] : [shownJsx(def.show)]), swapCondJsx(def.swap)];
            inner.push(`{${conds.join(' && ')} && <span className="${template.id}-${def.slot}">{${def.component}}</span>}`);
        }
        const indented = inner.map(line => line.split('\n').map(l => '  ' + l).join('\n')).join('\n');
        const div = `<div className="${template.id}-${slot.id}"${pressHandlerJsx(template, slot)}>\n${indented}\n</div>`;
        out.push(slot.shownWhen ? `{(${shownJsx(slot.shownWhen)}) && ${div}}` : div);
    }
    for (const slot of template.anatomy.filter(s => !s.parent)) {
        if (slot.kind !== 'frame') { emitSlot(slot, children); continue; }
        emitContainer(slot, children);
    }
    if (!framePlaced) children.push(...rooted.filter(part => !part.side).map(part => framePartJsx(part)));
    // A content slot is an element of the component, after the other layers in schema order: drawn when its prop holds something, always with showEmpty.
    for (const { prop, slot } of slotPropsOf(template)) {
        // A repeating slot draws its children `<id>Copies` times (0 while they are empty), in one slot element; without copies it is empty like any other.
        const element = slot.repeat ? `<div className="${template.id}-${slot.id}">{Array.from({ length: ${slot.id}Copies }, (_, i) => <Fragment key={i}>{${prop}}</Fragment>)}</div>` : `<div className="${template.id}-${slot.id}">{${prop}}</div>`;
        const guard = slot.repeat ? `${slot.id}Copies > 0` : `filled(${prop})`;
        children.push(slot.showEmpty === true ? element : `{${guard} && ${element}}`);
    }
    const { attrs: tagAttrs, blockClickProps } = template.element;
    // An element whose tag follows a mode (a Title's level) is a local `Tag` read from the mode's id; any other has its fixed tag.
    const tag = tagMap ? 'Tag' : template.element.tag;
    const fixedTag = template.element.tag;
    const dims = variableProps(template).map(([prop]) => prop);
    const attrs = [
        ...Object.entries(tagAttrs).map(([key, value]) => `${key === 'tabindex' ? 'tabIndex' : key}="${value}"`),
        slotted ? `className={['${template.id}', className].filter(Boolean).join(' ')}` : `className="${template.id}"`,
        ...(slotted ? ['ref={ref}', varsExpr ? `style={{ ...${varsExpr}, ...style } as CSSProperties}` : 'style={style}'] : varsExpr ? [`style={${varsExpr}}`] : []),
        // A link has no href while it is disabled.
        ...(template.element.hrefProp ? [`href={${disabledProp ? `${disabledProp} ? undefined : ` : ''}${template.element.hrefProp} || undefined}`] : []),
        ...(template.interaction?.wave ? ['data-wave'] : []),
        ...(template.interaction?.wave && !template.events.some(event => event.name === 'onClick') ? ['onClick={(e) => { if (blocked) return; waveDown(e.currentTarget); }}'] : []),
        ...(template.interaction?.wave ? [`onAnimationEnd={(e) => { if (e.animationName === '${WAVE_KEYFRAMES}') e.currentTarget.removeAttribute('data-wave-on'); }}`] : []),
        ...dims.map(dim => `data-${dim}={${dim}}`),
        // A persistent state the stylesheet selects as an attribute (`[data-checked]`) is written from its prop.
        ...stateAttributesOf(template).map(({ attr, prop }) => `${attr}={${prop} || undefined}`),
        // A local interaction state is the root's own: written from the local, absent while false, so the stylesheet can follow it.
        ...toggleStatesOf(template).map(state => `${localAttrOf(state)}={${state} || undefined}`),
        // A toggle control says its state to assistive technology: true, false, or mixed while the state it clears holds.
        ...(template.toggle ? [`aria-checked={${template.toggle.clears ? `${template.toggle.clears} ? "mixed" : ` : ''}${template.toggle.prop} ? "true" : "false"}`] : []),
        ...fieldWritersOf(template).filter(w => w.field === 'layout').map(w => `data-${w.prop}={${w.prop}}`),
        ...fieldWritersOf(template).filter(w => w.field === 'imageFill').map(w => `data-${w.prop}={${w.prop} ? "" : undefined}`),
        // The text styles are data attributes the stylesheet draws: italic, each decoration line, and a line clamp while it has a count.
        ...fieldWritersOf(template).filter(w => w.field === 'fontStyle' || w.flag !== undefined).map(w => `data-${kebabCase(w.prop)}={${w.prop} || undefined}`),
        ...fieldWritersOf(template).filter(w => w.field === 'textTruncate').map(w => `data-${kebabCase(w.prop)}={${w.prop} || undefined}`),
        ...(ml ? [`data-${kebabCase(ml.resize)}={${ml.resize}}`, `data-${kebabCase(ml.autoSize)}={${ml.autoSize} || undefined}`] : []),
        // A prop that aligns the row's content to the end says which end as a data attribute (a Switch's handle).
        ...fieldWritersOf(template).filter(w => w.field === 'primaryAlign').map(w => `data-${w.prop}-align={${alignExprOf(w)}}`),
        // Only some elements have a `disabled` attribute; any other root says it with aria-disabled (and the schema's state pseudo selects on it).
        ...(ctl || !disabledProp ? [] : [DISABLEABLE.has(tag) ? `disabled={${disabledProp}}` : `aria-disabled={${disabledProp} || undefined}`]),
        // A root whose click a prop blocks says so, so the loading rule (see blockedRules) matches in Play and in the export alike.
        ...(blockClickProps.length ? ['data-blocked={blocked || undefined}'] : []),
        ...template.events.map(event => `${DOM_EVENT[event.name]}={${event.name === 'onClick' ? (template.interaction?.wave ? 'blocked ? undefined : (e) => { if (onClick) onClick(e); waveDown(e.currentTarget); }' : 'blocked ? undefined : onClick') : event.name}}`),
        ...(slotted ? ['{...rest}'] : []),
    ];
    const indent = (/** @type {string} */ text, /** @type {number} */ n) => text.split('\n').map(line => ' '.repeat(n) + line).join('\n');
    if (slotted) {
        const [attrType, elementType] = ELEMENT_TYPES[fixedTag] ?? ['HTMLAttributes', `HTMLElementTagNameMap['${fixedTag}']`];
        const slotParams = [...params, ...slotPropsOf(template).map(s => s.prop), 'className', 'style', '...rest'];
        const needsFilled = template.slots.some(slot => slot.showEmpty !== true || slot.repeat);
        const counts = slotPropsOf(template).filter(({ slot }) => slot.repeat).map(({ prop, slot }) => {
            const fallback = typeof template.props[slot.repeat].default === 'number' ? template.props[slot.repeat].default : 0;
            return `  const ${slot.id}Copies = filled(${prop}) ? copies(${slot.repeat}, ${fallback}) : 0;`;
        });
        return [
            ...propsTypeOf(template, name, elementType, attrType),
            `export const ${name} = forwardRef<${elementType}, ${name}Props>(function ${name}({ ${slotParams.join(', ')} }, ref) {`,
            `  const blocked = ${blockClickProps.join(' || ') || 'false'};`,
            ...derivedLines,
            ...controlLines,
            ...localLines,
            ...counts,
            '  return (',
            `    <${tag}`,
            ...attrs.map(attr => `      ${attr}`),
            '    >',
            ...children.map(child => indent(child, 6)),
            `    </${tag}>`,
            '  );',
            '});',
            ...(template.interaction?.wave ? ['', 'function waveDown(el: (HTMLElement & { disabled?: boolean }) | null) {', "  if (!el || el.disabled) return;", "  el.removeAttribute('data-wave-on');", '  void el.offsetWidth;', "  el.setAttribute('data-wave-on', '');", '}'] : []),
            ...(needsFilled ? ['', 'function filled(node: ReactNode): boolean {', `  return Array.isArray(node) ? node.some(filled) : node !== undefined && node !== null && typeof node !== 'boolean' && node !== '';`, '}'] : []),
            ...(counts.length ? ['', 'function copies(count: number | null | undefined, fallback: number): number {', '  const n = count ?? fallback;', '  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;', '}'] : []),
            '',
        ].join('\n');
    }
    return [
        ...((template.press ?? []).some(p => p.dismiss || p.toggleState) ? ["import { useState } from 'react';", ''] : []),
        ...(tagMap ? [`const TAGS = ${JSON.stringify(tagMap)};`, ''] : []),
        `export function ${name}({ ${params.join(', ')} }) {`,
        `  const blocked = ${blockClickProps.join(' || ') || 'false'};`,
        ...(tagMap ? [`  const Tag = TAGS[${template.element.tagBy.prop}] ?? ${JSON.stringify(template.element.tag)};`] : []),
        ...derivedLines,
        ...controlLines,
        ...dismissLines,
        ...localLines,
        '  return (',
        `    <${tag}`,
        ...attrs.map(attr => `      ${attr}`),
        '    >',
        ...children.map(child => indent(child, 6)),
        `    </${tag}>`,
        '  );',
        '}',
        ...subcomponentLines(template, name),
        ...controlOf(template)?.number ? ['', `const commitNumber = ${commitNumber.toString()};`] : [],
        ...(template.press ?? []).some(p => p.resize) ? ['', `const resizeLimits = ${resizeLimits.toString()};`, `const resizeHeight = ${resizeHeight.toString()};`, `const startResizeDrag = ${startResizeDrag.toString()};`] : [],
        ...(template.interaction?.wave ? ['', 'function waveDown(el) {', "  if (!el || el.disabled) return;", "  el.removeAttribute('data-wave-on');", '  void el.offsetWidth;', "  el.setAttribute('data-wave-on', '');", '}'] : []),
        '',
    ].join('\n');
}

/**
 * A style object as CSS declaration lines: camelCase names become kebab-case, in the object's order.
 * @param {Record<string, string>} style
 * @returns {string[]}
 */
const cssDecls = style => Object.entries(style).map(([prop, value]) => '  ' + prop.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ': ' + value + ';\n');

/**
 * A `shownWhen` condition as a JSX expression over the component's props, the same test conditionHolds makes on the canvas.
 * @param {any} cond
 * @returns {string}
 */
/**
 * The JSX clause a swap def adds to its element's gate: the local state it swaps by, negated for the side shown while the state is off.
 * @param {{ by: string | object, is?: unknown }} swap
 */
function swapCondJsx(swap) {
    const shown = typeof swap.by === 'string' ? swap.by : shownJsx(swap.by);
    return swap.is === false ? (typeof swap.by === 'string' ? `!${shown}` : `!(${shown})`) : shown;
}

function shownJsx(cond) {
    if (cond.all) return cond.all.map(c => `(${shownJsx(c)})`).join(' && ');
    if (cond.any) return cond.any.map(c => `(${shownJsx(c)})`).join(' || ');
    if ('is' in cond) return `${cond.prop} === ${JSON.stringify(cond.is)}`;
    const text = `String(${cond.prop} ?? "")`;
    return cond.empty ? `${text} === ""` : `${text} !== ""`;
}

/**
 * One rule per node the display mapping styles from a token: each mapped property is written to its CSS property, reading the
 * token's custom property. Literal sources (width, text) are not CSS and are written by the component.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function rootBorderWidthOf(master) {
    return typeof master.strokeWidth === 'number' && master.strokeWidth > 0 ? master.strokeWidth : 0;
}
function displayRules(template, master, childrenOf, geometry) {
    const tokens = Object.values(template.tokens).flat();
    const entry = labelEntryOf(master.id, childrenOf, master);
    // Every layer under the master with the frame that holds it, for the text part each display key draws from.
    const at = (id, parent) => (childrenOf(id) ?? []).flatMap(c => [{ node: c, parent }, ...at(c.id, c)]);
    const under = at(master.id, master);
    // A text part lays out from its own layer: only the value/label fills the row, the rest hug, as on the canvas
    // and in Play. A canvas part matches by marker, an affix text by name; a key with no layer keeps the label layout.
    // A managed text slot has no layer on the master: it lays out as the layer an instance gets (it fills when its slot says so, else it hugs).
    const managedEntry = key => {
        const slot = template.anatomy.find(s => s.id === key && s.managed && s.kind !== 'icon' && s.kind !== 'glyph');
        return slot ? { node: managedTextLayer(template, key, resolveProps(template, {}), { id: key, parentId: master.id }), parent: master } : undefined;
    };
    // A managed container has no layer on the master unless its condition holds at the sample props: it is laid out as the layer an instance gets.
    const managedBox = key => (template.anatomy.some(s => s.id === key && s.managed && s.kind === 'frame') ? managedContainerLayer(template, key, resolveProps(template, {}), { id: key, parentId: master.id }) : undefined);
    const entryFor = key => under.find(({ node: c }) => c.behavior?.part === key)
        ?? under.find(({ node: c }) => c.type === 'text' && c.name === key && !c.behavior?.part && !c.behavior?.slot)
        ?? managedEntry(key)
        ?? entry;
    return Object.entries(template.display).map(([key, props]) => {
        const kind = targetKindOf(template, key);
        // The root lays its label and its icon slots out like the canvas auto layout frame. Play draws the same rules
        // with display:flex (a real element in its parent's layout); the export is inline-flex so a hug Button keeps its
        // natural width. The label keeps its own width and alignment from its layer.
        const decls = kind === 'glyph' ? ['  display: block;\n', '  flex-shrink: 0;\n'] : key === 'root'
            ? ['  display: inline-flex;\n', '  box-sizing: border-box;\n', ...cssDecls(rootLayoutOf(master, 0)), ...(master.layoutSizingH === 'fixed' && master.vars?.w === undefined && master.w > 0 ? [`  width: ${master.w}px;\n`] : [])]
            : kind === 'text' ? cssDecls(labelLayoutOf(entryFor(key)?.node, entryFor(key)?.parent ?? master)) : [];
        // A container pinned to the right edge is out of the flow: it starts on the box's top border line (the padding box starts inside the border, so top is minus the border)
        // and its height is the box's height token, so it is as tall as the box at every Size mode.
        if (template.anatomy.find(s => s.id === key)?.edge === 'right') decls.push('  position: absolute;\n', `  top: calc(-1 * var(${cssVarOf(template.id, template.display.root.strokeWidth)}));\n`, '  right: 0;\n');
        if (key === 'root' && template.outline) {
            // The outline width includes the border: the ring starts back at the border's inner edge (an inside stroke),
            // so the visible ring is the width minus the border with no gap. A border as wide as the outline leaves no ring.
            // Both widths resolve from the binding (see tokenValueOf): a null geometry means the token pass already
            // refused the export, and the CSS below is discarded with it.
            if (geometry.outline === null || geometry.border === null || geometry.outline <= geometry.border) decls.push('  outline: none;\n');
            else decls.push(`  outline: ${geometry.outline}px solid var(${cssVarOf(template.id, 'outline-color')});\n`, `  outline-offset: ${template.outline.offset - geometry.border}px;\n`);
            decls.push(`  transition: ${FOCUS_TRANSITION};\n`);
        }
        // A root with no focus ring of its own (Checkbox, Radio, Switch draw focus on the box border) must not show the browser's default one.
        if (key === 'root' && !template.outline) decls.push('  outline: none;\n');
        // An anchor has no underline of its own (the browser draws one): the underline prop draws it on the label.
        if (key === 'root' && template.element.hrefProp) decls.push('  text-decoration: none;\n');
        // A root that draws no border of its own (Switch is a button) must not show the browser's default button border.
        if (key === 'root' && !('stroke' in (template.display.root ?? {}))) decls.push('  border: 0;\n');
        // The root draws its own border, so the children sit inside the compensated padding.
        if (key === 'root' && 'stroke' in (template.display.root ?? {})) { const w = rootBorderWidthOf(master); const swapped = stateSwaps(template, 'root', 'strokeWidth');
        // A state that swaps the border width (the code span's border) makes it the token's value, read from its custom property, not the master's number.
        decls.push(`  border-width: ${swapped ? `var(${cssVarOf(template.id, template.display.root.strokeWidth)})` : `${w}px`};\n`, `  border-style: ${w === 0 && !swapped ? 'none' : lineStyleOf(master)};\n`);
        decls.push(`  background-clip: border-box;\n`); }
        if (key === 'root' && (template.interaction?.wave || template.anatomy.some(s => s.corner) || 'stroke' in (template.display.root ?? {}))) decls.push('  position: relative;\n');
        // A box of the anatomy (a group frame) draws its own border the same way, from its own layer: its size includes the border.
        if (key !== 'root' && kind === 'frame' && 'stroke' in props) {
            const box = under.find(({ node: c }) => c.behavior?.group === key)?.node ?? managedBox(key) ?? master;
            const w = rootBorderWidthOf(box);
            const side = box.strokeSides;
            // A box with a stroke on one side only (the handler column's inline-start and the divider above the down half) draws that side's border from the width token.
            if (['left', 'top', 'right', 'bottom'].includes(side)) decls.push('  box-sizing: border-box;\n', '  border-style: solid;\n', '  border-width: 0;\n', `  border-${side === 'left' ? 'inline-start' : side === 'right' ? 'inline-end' : side}-width: var(${cssVarOf(template.id, props.strokeWidth)});\n`, `  background-clip: border-box;\n`);
            else decls.push('  box-sizing: border-box;\n', `  border-width: ${w}px;\n`, `  border-style: ${w === 0 ? 'none' : lineStyleOf(box)};\n`, `  background-clip: border-box;\n`);
        }
        // A control slot draws as a native input: it owns text only, so the reset comes first and the
        // token-driven declarations below win for colour and font metrics. Generic: any template with a
        // `control` reads this path. Its width is its text's, as the canvas's hugging layer is: the value, or the placeholder while
        // the value is empty (field-sizing), not the browser's default width for an input.
        if (controlOf(template)?.slot === key) decls.push(
            '  field-sizing: content;\n',
            '  background: transparent;\n',
            '  border: none;\n',
            '  outline: none;\n',
            '  box-shadow: none;\n',
            '  padding: 0;\n',
            '  margin: 0;\n',
            '  border-radius: 0;\n',
            '  appearance: none;\n',
            '  font: inherit;\n',
        );
        // A managed icon slot is drawn in its colour token: the icon swapped into it draws with currentColor (the Play DOM sets the same colour
        // on the slot), so the colour is the slot's CSS colour, and the disabled state changes the token it reads.
        const iconDef = kind === 'icon' ? slotDefsOf(template, key)[0] : undefined;
        if (iconDef?.tokens?.colour !== undefined && tokens.includes(iconDef.tokens.colour)) decls.push(`  color: var(${cssVarOf(template.id, iconDef.tokens.colour)});\n`);
        if (iconDef?.cursor !== undefined) decls.push(`  cursor: ${iconDef.cursor};\n`);
        for (const [prop, source] of Object.entries(props)) {
            const { css, perMember } = NODE_PROPERTIES[kind][prop];
            if (!css || !tokens.includes(source)) continue;
            if (perMember) { for (const name of css) decls.push(`  ${name}: var(${cssVarOf(template.id, source)}-${name});\n`); continue; }
            for (const name of [css].flat()) { if (key === 'root' && (prop === 'paddingX' || prop === 'paddingY' || prop === 'paddingStart' || prop === 'paddingEnd')) { const bw = rootBorderWidthOf(master); if (stateSwaps(template, 'root', 'strokeWidth')) { decls.push(`  ${name}: max(0px, calc(var(${cssVarOf(template.id, source)}) - var(${cssVarOf(template.id, template.display.root.strokeWidth)})));\n`); continue; } if (bw > 0) { decls.push(`  ${name}: max(0px, calc(var(${cssVarOf(template.id, source)}) - ${bw}px));\n`); continue; } } decls.push(`  ${name}: var(${cssVarOf(template.id, source)});\n`); }
        }
        if (kind === 'line') decls.push(...lineDecls(template, key, props, tokens));
        if (!decls.length) return '';
        const selector = key === 'root' ? `.${template.id}` : `.${template.id}-${key}`;
        const rule = `${selector} {\n${decls.join('')}}\n`;
        if (controlOf(template)?.slot === key && props.placeholder) return `${rule}${selector}::placeholder {\n  color: var(${cssVarOf(template.id, props.placeholder)});\n}\n`;
        // A glyph draws its outline as an inline svg: without a display of its own it sits on the text
        // baseline, so the strut pushes it below the span centre on every font. As a block it fills the
        // centred span exactly, and the ink (centred in its own space) lands centred.
        if (kind === 'glyph') return `${rule}${selector} svg {\n  display: block;\n}\n`;
        return rule;
    }).filter(Boolean);
}

/**
 * The stylesheet: one block per combination of variable modes with its base tokens, then one block per state holding only
 * the tokens that state changes. Problems are pushed onto `problems` with the modes they belong to.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {{ variables: Record<string, string | null> }} binding
 * @param {{ collections?: any[], items?: any[] }} variables
 * @param {any[]} problems
 */
/**
 * The declarations of a line slot: an empty block whose one border is the rule, along the slot's axis. The colour and the width are its tokens; the style is solid here
 * and the Style mode's rule (see the variant styles below) makes it dashed or dotted. A rule that fills takes what is left of the row; a fixed one keeps its token's length.
 * @param {any} template
 * @param {string} key the slot id
 * @param {Record<string, string>} props the slot's display mapping
 * @param {string[]} tokens
 * @returns {string[]}
 */
function lineDecls(template, key, props, tokens) {
    const slot = template.anatomy.find(s => s.id === key);
    const v = prop => (props[prop] !== undefined && tokens.includes(props[prop]) ? `var(${cssVarOf(template.id, props[prop])})` : undefined);
    const side = slot.axis === 'horizontal' ? 'top' : 'left';
    const decls = ['  display: block;\n', '  box-sizing: content-box;\n', '  flex-shrink: 0;\n', `  border-${side}: ${v('strokeWidth')} solid ${v('stroke')};\n`];
    if (slot.axis === 'horizontal') decls.push('  height: 0;\n', slot.fill === true ? '  flex: 1 1 0;\n' : `  width: ${v('width')};\n`);
    else decls.push('  width: 0;\n', slot.fill === true ? '  align-self: stretch;\n' : `  height: ${v('height')};\n`);
    return decls;
}

/**
 * The CSS line style of a master's stroke: its own Solid, Dash or Dots. A Variant that sets a style (dashed) overrides it by its
 * attribute rule, so the master's style is the default of every Variant that sets none.
 * @param {any} master
 * @returns {'solid' | 'dashed'}
 */
function lineStyleOf(master) {
    return master.strokeStyle === 'dash' ? 'dashed' : 'solid';
}


/**
 * The hover rule of each icon slot that declares a hover colour token (the Input's clear icon): the slot takes that colour while the pointer
 * is over it and the component is not disabled. Hover has no static canvas visual, so the canvas keeps the rest colour.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {string[]}
 */
function iconHoverRules(template) {
    const guard = template.focusTarget === 'wrapper' ? ':not(:has(:disabled))' : notDisabledOf(template);
    return iconDefsOf(template).filter(def => def.tokens?.hoverColour !== undefined && def.slot !== undefined)
        .map(def => `.${template.id}${guard} .${template.id}-${def.slot}:hover {\n  color: var(${cssVarOf(template.id, def.tokens.hoverColour)});\n}\n`);
}

/**
 * A swap icon's visibility follows its local state: the side shown while the state holds hides until it does, the side shown
 * while it is off hides while it does. Play and the export share them; the export's JSX gates the same way.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {string[]}
 */
function swapRules(template) {
    return iconDefsOf(template).filter(def => def.swap && def.slot !== undefined).flatMap(def => {
        const by = def.swap.by;
        const attr = toggleStatesOf(template).includes(by) ? localAttrOf(by) : stateAttributesOf(template).find(a => a.prop === (typeof by === 'string' ? by : by.prop))?.attr;
        if (!attr) return [];
        // Only the hidden side is written; the shown side keeps the display its element has. !important, because Play draws a nested icon with an inline display.
        const hidden = def.swap.is === true ? `.${template.id}:not([${attr}]) .${template.id}-${def.slot}` : `.${template.id}[${attr}] .${template.id}-${def.slot}`;
        return [`${hidden} {\n  display: none !important;\n}\n`];
    });
}

/**
 * The blocked rule of a template whose click a prop blocks (see element.blockClickProps): while blocked for a reason
 * other than its disabled state, the root draws at the loading opacity and takes no pointer, so hover, pressed and
 * focus cannot land on it either. Play and the export share it.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {string[]}
 */
function blockedRules(template) {
    if (!(template.element.blockClickProps?.length ?? 0)) return [];
    const enabled = DISABLEABLE.has(template.element.tag) ? ':not(:disabled)' : ':not([aria-disabled="true"])';
    return [`.${template.id}[data-blocked]${enabled} {\n  opacity: ${LOADING_OPACITY};\n  pointer-events: none;\n}\n`];
}

/**
 * The click-wave rules for a wave template: the ::after ring inherits the host radius, starts at zero spread and is
 * transparent, and expands to the antd spread while fading when data-wave-on is set. The host colour comes from the
 * wave-color token, so it follows the button colour per mode.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function waveRules(template) {
    // The keyframes are one text for every wave template (a page holds several stylesheets, and a second @keyframes of the same name replaces the first), so they
    // read the colour from a custom property the ring sets on its own element, from its template's token.
    const color = `var(${WAVE_COLOR_VAR})`;
    return [
        `.${template.id}[data-wave-on]::after {\n  animation: ${WAVE_ANIMATION};\n}\n`,
        `.${template.id}::after {\n  content: '';\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  pointer-events: none;\n  ${WAVE_COLOR_VAR}: var(${cssVarOf(template.id, 'wave-color')});\n  box-shadow: 0 0 0 0 ${color};\n  opacity: 0;\n}\n`,
        `@keyframes ${WAVE_KEYFRAMES} {\n  0% { box-shadow: 0 0 0 0 ${color}; opacity: ${WAVE_START_OPACITY}; }\n  20% { box-shadow: 0 0 0 ${WAVE_SPREAD} ${color}; }\n  100% { box-shadow: 0 0 0 ${WAVE_SPREAD} ${color}; opacity: 0; }\n}\n`,
    ].join('\n');
}

/**
 * Reduced motion kills the focus transition, the wave and template motion. Emitted per template with interaction or motion behaviour.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
/**
 * The motion rules of a template, from its schema `motion` (antd timings and easings only): colour
 * transitions, glyph draw-in appearances, the sliding handle and the press grow. Play and the export
 * share them; the canvas never reads them. A disabled root neither transitions nor plays an appearance.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {string[]}
 */
function motionRules(template) {
    const motion = template.motion;
    if (!motion) return [];
    const out = [];
    const dis = disabledPseudoOf(template);
    const notDis = notDisabledOf(template);
    // The exit of a dismissed root: the fade and scale of the motion, over the transition the exit names (Play only; the export has no such attribute).
    if (motion.exit) {
        const { duration, timing, to } = motion.exit;
        out.push(`.${template.id} {\n  transition: ${Object.keys(to).map(p => `${p} ${duration} ${timing}`).join(', ')};\n}\n`, `.${template.id}[data-dismissed] {\n${Object.entries(to).map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}\n`);
    }
    const selOf = key => key === 'root' ? `.${template.id}` : `.${template.id}-${key}`;
    for (const t of motion.transitions ?? []) {
        const sel = selOf(t.key);
        out.push(`${sel} {\n  transition: ${t.props.map(p => `${p} ${t.duration} ${t.timing}${t.delay ? ` ${t.delay}` : ''}`).join(', ')};\n}\n`);
        // A control taking the disabled state swaps colours with no transition, so the swap is instant.
        if (dis) out.push(`${t.key === 'root' ? `.${template.id}${dis}` : `.${template.id}${dis} ${sel}`} {\n  transition: none;\n}\n`);
    }
    for (const a of motion.appearances ?? []) {
        const name = `midas-${template.id}-${a.key}-in`;
        out.push(`@keyframes ${name} {\n  from {\n${Object.entries(a.from).map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n  }\n}\n`);
        const roots = a.states.map(s => `.${template.id}[${stateAttributesOf(template).find(x => x.state === s)?.attr}]${notDis} .${template.id}-${a.key}`);
        out.push(`${roots.join(', ')} {\n  animation: ${name} ${a.duration} ${a.timing}${a.delay ? ` ${a.delay}` : ''} backwards;\n}\n`);
    }
    if (motion.press) {
        const { key, token, prop, growRatio } = motion.press;
        out.push(`.${template.id}:active${notDis} .${template.id}-${key} {\n  ${prop}: calc(var(${cssVarOf(template.id, token)}) * ${1 + growRatio});\n}\n`);
    }
    return out;
}
/**
 * What a press on a container does to the look, for Play and the export (the canvas is static): the pointer cursor, the hover and pressed colour of the glyph inside it (tokens),
 * and, while its limit is reached (`blockedBy`, a state of the root), a muted half that takes no click. A disabled control changes nothing.
 * @param {any} template
 * @returns {string[]}
 */
function pressRules(template) {
    const id = template.id, out = [];
    const dead = ':not(:has(:disabled))';
    for (const entry of (template.press ?? []).filter(p => template.anatomy.find(s => s.id === p.slot)?.kind === 'frame')) {
        const box = `.${id}-${entry.slot}`;
        const free = entry.blockedBy ? `:not([${stateAttributesOf(template).find(a => a.prop === entry.blockedBy).attr}])` : '';
        out.push(`${box} {\n  cursor: pointer;\n}\n`, `.${id}:has(:disabled) ${box} {\n  cursor: not-allowed;\n}\n`);
        if (entry.hoverFill) out.push(`.${id}${free}${dead} ${box}:hover .${id}-${entry.glyph} {\n  color: var(${cssVarOf(id, entry.hoverFill)});\n}\n`);
        if (entry.activeFill) out.push(`.${id}${free}${dead} ${box}:active .${id}-${entry.glyph} {\n  color: var(${cssVarOf(id, entry.activeFill)});\n}\n`);
        if (entry.blockedBy) out.push(`.${id}[${stateAttributesOf(template).find(a => a.prop === entry.blockedBy).attr}] ${box} {\n  cursor: not-allowed;\n  pointer-events: none;\n}\n`);
    }
    return out;
}

/**
 * What an expand press lifts: while the root says it is expanded (`data-expanded`, Play flips it, the export keeps it in local state), the line clamp of the text a prop clamps is gone.
 * !important, because Play draws the clamp as the text layer's inline style.
 * @param {any} template
 * @returns {string[]}
 */
function expandRules(template) {
    if (!(template.press ?? []).some(p => p.expand)) return [];
    const writer = fieldWritersOf(template).find(w => w.field === 'maxLines');
    return [`.${template.id}[${localAttrOf('expanded')}] .${template.id}-${writer.key} {
  display: block !important;
  -webkit-line-clamp: unset !important;
  overflow: visible !important;
}
`];
}

/**
 * The hover colour of a glyph (`hoverFill`, a colour token): Play and the export only, the canvas is static. A disabled control never changes it.
 * @param {any} template
 * @returns {string[]}
 */
function glyphHoverRules(template) {
    const off = template.focusTarget === 'wrapper' ? ':not(:has(:disabled))' : notDisabledOf(template);
    return template.anatomy.filter(slot => slot.kind === 'glyph' && slot.hoverFill !== undefined)
        .map(slot => `.${template.id}${off} .${template.id}-${slot.id}:hover {
  color: var(${cssVarOf(template.id, slot.hoverFill)});
}
`);
}

/**
 * The handler column that appears on hover or focus (`reveal`): drawn on the canvas always, here transparent and one `slide` off to the right until the control is hovered or holds
 * focus, then fading and sliding in over the time and easing antd gives it (motionDurationMid), and back out on leave. A disabled control never reveals it, and reduced motion shows it
 * at once with no slide.
 * @param {any} template
 * @returns {string[]}
 */
function revealRules(template) {
    if (!template.reveal) return [];
    const id = template.id, slot = `.${id}-${template.reveal.slot}`, off = ':not(:has(:disabled))';
    const { duration, easing, slide } = template.reveal;
    return [
        // The slide leaves the box, so the control clips it: the column never shows outside the border while it moves.
        `.${id} {\n  overflow: hidden;\n}\n`,
        `${slot} {\n  opacity: 0;\n  transform: translateX(${slide});\n  pointer-events: none;\n  transition: opacity ${duration} ${easing}, transform ${duration} ${easing};\n}\n`,
        `.${id}:hover${off} ${slot},\n.${id}:focus-within${off} ${slot} {\n  opacity: 1;\n  transform: translateX(0);\n  pointer-events: auto;\n}\n`,
        `@media (prefers-reduced-motion: reduce) {\n  ${slot} {\n    transition: none;\n    transform: none;\n  }\n}\n`,
    ];
}

function reducedMotion(template) {
    const sel = `.${template.id}`;
    const wave = template.interaction?.wave ? `\n  ${sel}[data-wave-on]::after {\n    animation: none;\n  }` : '';
    // A dismissed root under reduced motion has no exit: it is hidden at once.
    const dismissed = template.motion?.exit ? `\n  ${sel}[data-dismissed] {\n    display: none;\n  }` : '';
    const dis2 = notDisabledOf(template);
    const motion = template.motion ? [...(template.motion.transitions ?? []).map(t => `\n  ${t.key === 'root' ? sel : `${sel}-${t.key}`} {\n    transition: none;\n  }`),
        ...(template.motion.appearances ?? []).map(a => `\n  ${a.states.map(s => `${sel}[${stateAttributesOf(template).find(x => x.state === s)?.attr}]${dis2} ${sel}-${a.key}`).join(', ')} {\n    animation: none;\n  }`)] : [];
    return `@media (prefers-reduced-motion: reduce) {\n  ${sel} {\n    transition: none;\n  }${wave}${dismissed}${motion.join('')}\n}\n`;
}

/**
 * The rules of a multiline control, scoped to the kind that has it (the root says it as a data attribute). The whole box acts as the field: the cursor is the text cursor over
 * it (not-allowed while disabled). The field fills the box in both directions, at least `rows` lines tall (rows x line height, tokens) and, with autoSize, between the min and max
 * rows; the box adds its padding around it. Resize is one rule per option on the data attribute; autoSize never resizes. The native grip is hidden: the grip glyph is the handle.
 * @param {any} template
 * @returns {string[]}
 */
function multilineRules(template) {
    const ml = controlOf(template)?.multiline;
    if (!ml) return [];
    const id = template.id, slot = controlOf(template).slot;
    const kind = ml.when ? `[${enumAttrOf(template, ml.when.prop)}="${ml.when.is}"]` : '';
    const lineHeight = `var(${cssVarOf(id, template.display[slot].typography)}-line-height)`;
    const rows = name => `var(--${id}-${kebabCase(name)})`;
    const height = count => `calc(${count} * ${lineHeight})`;
    const auto = `[data-${kebabCase(ml.autoSize)}]`, root = `.${id}${kind}`, field = `${root} .${id}-${slot}`;
    return [
        `${root} {\n  cursor: text;\n}\n`,
        `${root}:has(:disabled) {\n  cursor: not-allowed;\n}\n`,
        `${field} {\n  display: block;\n  flex: 1 1 auto;\n  align-self: stretch;\n  min-width: 0px;\n  min-height: ${height(rows(ml.rows))};\n  resize: none;\n}\n`,
        `${field}::-webkit-resizer {\n  display: none;\n}\n`,
        `${root}${auto} .${id}-${slot} {\n  min-height: calc(var(--${id}-${kebabCase(ml.minRows)}, ${rows(ml.rows)}) * ${lineHeight});\n  max-height: ${height(rows(ml.maxRows))};\n}\n`,
        `${root}[data-${kebabCase(ml.resize)}="vertical"] .${id}-${slot} {\n  resize: vertical;\n}\n`,
    ];
}

/**
 * The rules that read what the layout, gap and width props put on the root (see fieldStyleOf): a layout is one rule per option on the data attribute, a gap
 * and a width read their custom property (a width falls back to auto, the hugging layer).
 * @param {any} template
 * @returns {string[]}
 */
function fieldRules(template) {
    // The decoration lines of one layer compose: one rule per line on its own, then one for every pair (more specific, so it wins) with the value the node holds.
    const flagWriters = fieldWritersOf(template).filter(w => w.flag !== undefined);
    return fieldWritersOf(template).flatMap(({ prop, key, field, values, flag }) => {
        const target = key === 'root' ? '' : ` .${template.id}-${key}`;
        if (field === 'fontStyle') return [`.${template.id}[data-${kebabCase(prop)}]${target} {\n  font-style: italic;\n}\n`];
        if (flag !== undefined) {
            const same = flagWriters.filter(w => w.key === key && w.field === field);
            const rules = [`.${template.id}[data-${kebabCase(prop)}]${target} {\n  text-decoration: ${flag};\n}\n`];
            if (same[same.length - 1].prop === prop) {
                const all = same.map(w => `[data-${kebabCase(w.prop)}]`).join('');
                if (same.length > 1) rules.push(`.${template.id}${all}${target} {\n  text-decoration: ${textDecorationOf(same.map(w => w.flag))};\n}\n`);
            }
            return rules;
        }
        // A clamp: while the root says it is on, the text shows its rows (the row count prop of the same layer) and cuts the rest.
        if (field === 'textTruncate') {
            const rows = fieldWritersOf(template).find(w => w.field === 'maxLines' && w.key === key);
            return [`.${template.id}[data-${kebabCase(prop)}]${target} {\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: ${rows ? `var(--${template.id}-${kebabCase(rows.prop)})` : '1'};\n  overflow: hidden;\n}\n`];
        }
        if (field === 'maxLines') return [];
        if (field === 'layout') {
            // A slot that fills the width it is given takes the cross axis of a vertical root and what is left of the row in a horizontal one (flowSizing, per option).
            const fills = key === 'root' ? (template.slots ?? []).filter(slot => slot.fill).map(slot => slot.id) : [];
            const direction = option => `.${template.id}[data-${prop}="${option}"]${target} {\n  flex-direction: ${(values?.[option] ?? option) === 'horizontal' ? 'row' : 'column'};\n}\n`;
            const fill = (option, id) => `.${template.id}[data-${prop}="${option}"] .${template.id}-${id} {\n${option === 'horizontal' ? '  flex: 1 1 0;\n  min-width: 0px;\n  align-self: auto;' : '  flex: none;\n  align-self: stretch;'}\n}\n`;
            return template.props[prop].options.flatMap(option => [direction(option), ...fills.map(id => fill(option, id))]);
        }
        // A prop that aligns the content to the end: one rule per side, selected on the data attribute the root carries.
        if (field === 'primaryAlign') return alignValuesOf({ values }).map(side => `.${template.id}[data-${prop}-align="${side}"]${target} {\n  justify-content: ${justifyOf(side)};\n}\n`);
        // A picture covers the box over a clear background (the colour under it does not show through a transparent picture).
        if (field === 'imageFill') return [`.${template.id}[data-${prop}] {
  background-image: var(--${template.id}-${prop});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: transparent;
}
`];
        const own = key === 'root' ? `.${template.id}` : `.${template.id}-${key}`;
        return [`${own} {
  ${field === 'gap' ? `gap: var(--${template.id}-${prop})` : `width: var(--${template.id}-${prop}, auto)`};
}
`];
    });
}

/**
 * The rule of each container of the anatomy: the box frame's own auto layout and flow sizing, as the canvas lays it out (a missing frame is laid out as its
 * schema says). Its children are styled by their own rules.
 * @param {any} template
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @returns {string[]}
 */
function groupRules(template, master, childrenOf) {
    // The layers of the master, at any depth (a container may sit in a container).
    const below = id => (childrenOf(id) ?? []).flatMap(c => [c, ...below(c.id)]);
    const held = below(master.id);
    // A container the master does not hold is laid out as the layer an instance gets (alignment, sizing, strokes, pinned edge), not as a bare frame.
    const layerOf = slot => held.find(c => c.behavior?.group === slot.id) ?? (slot.managed ? managedContainerLayer(template, slot.id, resolveProps(template, {}), { id: slot.id, parentId: master.id }) : { type: 'frame', layout: slot.layout, w: 0, h: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' });
    return template.anatomy.filter(slot => slot.kind === 'frame').map(slot => {
        const node = layerOf(slot);
        const holder = slot.parent === undefined ? master : layerOf(template.anatomy.find(x => x.id === slot.parent));
        // An axis bound to a variable is the token's value (the display rule writes it): the node's own number is not a second source, and written after the token it would win.
        const sizing = flowSizing(node, holder);
        if (node.vars?.w !== undefined) delete sizing.width;
        if (node.vars?.h !== undefined) delete sizing.height;
        return `.${template.id}-${slot.id} {
${cssDecls({ ...flexOf(node, 0), ...sizing }).join('')}}
`;
    });
}

/**
 * The rule that hides each glyph while its state attribute is off: the glyph is always in the markup, and the root's attribute (`data-checked`) decides.
 * @param {any} template
 * @returns {string[]}
 */
function glyphRules(template) {
    const attrs = stateAttributesOf(template);
    const attrOf = prop => attrs.find(a => a.prop === prop).attr;
    return template.anatomy.filter(slot => slot.kind === 'glyph').flatMap(slot => {
        const on = `.${template.id}`, glyph = `.${template.id}-${slot.id}`;
        // A glyph is hidden when any of its tests fails: a state that must be on fails without its attribute, one that must be off fails with it, an enum option fails
        // while the root says another.
        const fails = glyphTests(slot.shownWhen).map(t => typeof t.is === 'string' ? `${on}:not([${enumAttrOf(template, t.prop)}="${t.is}"]) ${glyph}` : t.is ? `${on}:not([${attrOf(t.prop)}]) ${glyph}` : `${on}[${attrOf(t.prop)}] ${glyph}`);
        const press = (template.press ?? []).find(p => p.slot === slot.id);
        // A corner glyph is out of the flow, `inset` in from the box's outer corner: the border is inside the padding box, so the offset is the inset minus the border width (as the canvas, whose stroke is inside the box).
        const corner = slot.corner === 'bottom-right' ? [`${glyph} {\n  position: absolute;\n  right: calc(${slot.inset ? `var(${cssVarOf(template.id, slot.inset)})` : '0px'} - var(${cssVarOf(template.id, template.display.root.strokeWidth)}));\n  bottom: calc(${slot.inset ? `var(${cssVarOf(template.id, slot.inset)})` : '0px'} - var(${cssVarOf(template.id, template.display.root.strokeWidth)}));\n}\n`] : [];
        return [`${fails.join(',\n')} {
  display: none;
}
`, ...corner, ...(press ? [`${glyph} {
  cursor: ${press.resize ? 'ns-resize' : 'pointer'};
}
${on}:has(:disabled) ${glyph} {
  cursor: not-allowed;
}
`] : [])];
    });
}

/**
 * The rule of each content slot's element: the slot frame's own auto layout and flow sizing, the canvas rules (a missing frame is laid out as its schema
 * says, so the export still draws; Diagnostics report the missing frame). Nothing of the icon rules (size, colour) applies to slot content.
 * @param {any} template
 * @param {any} master
 * @param {(id: string) => any[]} childrenOf
 * @returns {string[]}
 */
function slotRules(template, master, childrenOf) {
    return (template.slots ?? []).map(slot => {
        const node = childrenOf(master.id).find(c => c.propBind?.slot === slot.id) ?? { type: 'frame', layout: slot.layout, w: 0, h: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' };
        return `.${template.id}-${slot.id} {
${cssDecls({ ...flexOf(node, 0), ...flowSizing(node, master) }).join('')}}
`;
    });
}

function stylesheet(template, binding, variables, problems, master, childrenOf) {
    const dims = variableProps(template).map(([prop]) => prop);
    /** @type {Record<string, string[]>} */
    const modes = {};
    for (const dim of dims) {
        const collectionId = binding.variables[dim];
        if (!collectionId) { problems.push({ dimension: dim, reason: 'dimension-unbound' }); modes[dim] = []; continue; }
        const collection = (variables.collections || []).find(c => c.id === collectionId);
        if (!collection) { problems.push({ dimension: dim, reason: 'collection-missing' }); modes[dim] = []; continue; }
        if (!collection.modes?.length) problems.push({ dimension: dim, reason: 'no-modes' });
        modes[dim] = (collection.modes || []).map(/** @param {{ id: string }} m */ m => m.id);
    }
    const combos = dims.reduce((acc, dim) => acc.flatMap(combo => modes[dim].map(mode => ({ ...combo, [dim]: mode }))), [{}]);
    const geometry = { border: tokenValueOf(template, binding, variables, 'borderWidth'), outline: tokenValueOf(template, binding, variables, 'outlineWidth') };
    const blocks = displayRules(template, master, childrenOf, geometry);
    for (const [dim, def] of variableProps(template)) {
        // A style is keyed by the mode's name; the selector names the mode's id, as every other mode rule does.
        const collection = (variables.collections || []).find(c => c.id === binding.variables[dim]);
        for (const [key, rule] of Object.entries(def.styles ?? {})) {
            const mode = collection && modeOfStyleKey(collection.modes || [], key);
            if (!mode) continue;
            // The root draws the style as its border; a line slot draws it as its rule.
            const selectors = [`.${template.id}[data-${dim}="${mode.id}"]`, ...template.anatomy.filter(s => s.kind === 'line').map(s => `.${template.id}[data-${dim}="${mode.id}"] .${template.id}-${s.id}`)];
            blocks.push(`${selectors.join(',\n')} {\n  border-style: ${rule.borderStyle};\n}\n`);
        }
    }
    const { disabledState } = template.element;
    const defaults = resolveProps(template, {});
    for (const combo of combos) {
        const selector = `.${template.id}${dims.map(dim => `[data-${dim}="${combo[dim]}"]`).join('')}`;
        const base = previewOf(template, binding, combo, variables, defaults, 'default');
        for (const u of base.unresolved) problems.push({ ...u, ...combo });
        if (Object.keys(base.vars).length) blocks.push(`${selector} {\n${declarations(base.vars)}}\n`);
        for (const state of [...Object.keys(template.persistentStates).filter(name => !template.persistentStates[name].as), ...Object.keys(template.previewStates)]) {
            const pseudo = pseudoOf(template, state);
            const persistent = template.persistentStates[state];
            const changed = persistent
                ? previewOf(template, binding, combo, variables, { ...defaults, [persistent.prop]: true }, 'default').vars
                : previewOf(template, binding, combo, variables, defaults, state).vars;
            const delta = Object.fromEntries(Object.entries(changed).filter(([name, value]) => base.vars[name] !== value));
            // The interaction switch reads the active variable, so status and mode colours fall out of the mode
            // blocks; only the rest colour is resolved. Schema-driven: any template declaring the token pair.
            const restVar = cssVarOf(template.id, 'outline-color');
            const activeTokens = [...(template.tokens.fromVariant ?? []), ...(template.tokens.fromColor ?? []), ...(template.tokens.fromStatus ?? []), ...(template.tokens.fromSize ?? [])];
            if (delta[restVar] !== undefined && activeTokens.includes('outline-color-active')) delta[restVar] = `var(${cssVarOf(template.id, 'outline-color-active')})`;
            // A disabled element shows only its disabled style: the other states never apply to it.
            // Nor do they apply while a click-blocking prop holds (a loading Button): those guards also exclude [data-blocked].
            // A wrapper focus target reflects the inner control state: the disabled rule matches
            // `:has(:disabled)`, focus matches `:has(:focus-visible)` with a `:focus-within` fallback, and the
            // other states are guarded by `:not(:has(:disabled))`. Plain `:focus`, `:focus-visible` and
            // `:disabled` never match the wrapper, so no dead rule is emitted for them.
            const wrapperTarget = template.focusTarget === 'wrapper';
            // A click-blocking prop held hides the interaction states, like disabled does; a persistent state it carries (a checked Switch that loads) still applies, as the canvas binds it.
            const blockedGuard = !persistent && (template.element.blockClickProps?.length ?? 0) ? ':not([data-blocked])' : '';
            const noDisabled = wrapperTarget ? ':not(:has(:disabled))' : notDisabledOf(template);
            // A marker state (strong, code) says how the text looks, not what it is doing: a disabled element keeps it, so it carries no disabled guard.
            const guard = state === disabledState || persistent?.marker === true ? '' : `${noDisabled}${blockedGuard}`;
            if (!Object.keys(delta).length) continue;
            // A preview state does not apply while a state the root says as an attribute replaces the tokens it changes (the checked look wins over hover).
            const replaced = persistent ? '' : stateAttributesOf(template).filter(a => Object.keys(template.persistentStates[a.state].tokens).some(base => Object.hasOwn(template.previewStates[state] ?? {}, base))).map(a => `:not(${template.statePseudo[a.state]})`).join('');
            const sels = !wrapperTarget ? [`${selector}${pseudo}${replaced}${guard}`]
                : state === disabledState ? [`${selector}:has(:disabled)`]
                : pseudo === ':focus' || pseudo === ':focus-visible' ? [`${selector}:has(:focus-visible)${guard}`, `${selector}:focus-within${guard}`]
                : [`${selector}${pseudo}${guard}`];
            for (const sel of sels) blocks.push(`${sel} {\n${declarations(delta)}}\n`);
        }
    }
    // A hiding state takes the root out of Play and the export while it holds (the canvas keeps the node).
    for (const [state, def] of Object.entries(template.persistentStates)) if (def.hide === true) blocks.push(`.${template.id}${template.statePseudo[state]} {\n  display: none;\n}\n`);
    blocks.push(...iconHoverRules(template), ...blockedRules(template), ...swapRules(template));
    if (template.parts?.some(part => part.spin)) blocks.push(`@keyframes ${SPIN_KEYFRAMES} {\n  to { transform: rotate(360deg); }\n}\n`);
    if (template.interaction?.wave) blocks.push(waveRules(template));
    blocks.push(...expandRules(template), ...pressRules(template), ...glyphHoverRules(template), ...fieldRules(template), ...multilineRules(template), ...revealRules(template), ...motionRules(template), ...groupRules(template, master, childrenOf), ...glyphRules(template), ...slotRules(template, master, childrenOf));
    if (template.interaction || template.motion) blocks.push(reducedMotion(template));
    return blocks.join('\n');
}

/**
 * @param {Record<string, string>} vars
 */
function declarations(vars) {
    return Object.entries(vars).map(([name, value]) => `  ${name}: ${value};\n`).join('');
}

/**
 * The name a template's component is written under: its name as an identifier, each word capitalised and the separators dropped ("Icon Button" is `IconButton`).
 * @param {{ name: string }} template
 * @returns {string}
 */
export function componentNameOf(template) {
    return template.name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join('');
}

/**
 * The tag of each mode id of the prop a template's element tag follows (`element.tagBy`), or null for a fixed tag: the export reads it from the mode a Title is in.
 * @param {any} template
 * @param {{ variables: Record<string, string | null> }} binding
 * @param {{ collections?: any[] }} variables
 * @returns {Record<string, string> | null}
 */
function tagMapOf(template, binding, variables) {
    const by = template.element.tagBy;
    if (!by) return null;
    const collection = (variables.collections || []).find(c => c.id === binding.variables[by.prop]);
    return Object.fromEntries((collection?.modes || []).map(m => [m.id, elementTagOf(template, m.name)]));
}

/**
 * The component and its stylesheet for a bound master. Refused (no files) when anything is unresolved, with the reasons.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {{ variables: Record<string, string | null> }} binding the master's binding
 * @param {{ collections?: any[], items?: any[] }} variables the document's variables
 * @param {string} name the component name, e.g. `Button`
 * @param {any} master the master's node: the root's layout comes from its fields
 * @param {(id: string) => any[]} childrenOf how to reach the master's subtree, for the label layer
 * @returns {{ files: Record<string, string> | null, problems: Record<string, unknown>[] }}
 */
export function generateComponent(template, binding, variables, name, master, childrenOf) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) throw new Error(`"${name}" is not a component name`);
    if (!master) throw new Error('generateComponent needs the master node');
    if (typeof childrenOf !== 'function') throw new Error('generateComponent needs a childrenOf lookup');
    /** @type {any[]} */
    const problems = [];
    const jsx = componentSource(template, name, problems, partWidthOf(master, childrenOf), tagMapOf(template, binding, variables));
    const css = stylesheet(template, binding, variables, problems, master, childrenOf);
    if (problems.length) return { files: null, problems };
    return { files: { [`${name}.${template.slots?.length ? 'tsx' : 'jsx'}`]: jsx, [`${name}.css`]: css }, problems: [] };
}
