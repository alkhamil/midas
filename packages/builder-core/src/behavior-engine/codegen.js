// Code generator (stage 8). Pure: a template, its master's binding, the document's variables and a component name in; a React
// component (JSX) and its stylesheet out. Both come from the schema and the same resolver the preview uses, so the same inputs
// give the same text. If any token is unresolved for any mode, nothing is written: the result has no files and lists the reasons.
import { previewOf } from './preview.js';
import { variableProps } from './registry.js';
import { resolveProps } from './instance-props.js';
import { NODE_PROPERTIES, LOADING_OPACITY, canvasPartsOf, fieldWritersOf, placeholderPartOf, stateAttributesOf, targetKindOf } from './display.js';
import { pathCommands, svgPathD } from '../geometry/shapes.js';
import { controlOf, iconDefsOf, placementsOfDef, slotDefsOf } from './anatomy.js';
import { cssVarOf, splitColor, tokenValueOf } from './tokens.js';
import { glyphPathD } from './glyphs.js';
import { rootLayoutOf, labelLayoutOf, flexOf, flowSizing } from './layout.js';
import { labelEntryOf } from './layers.js';
import { managedTextLayer } from './template-master.js';
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
    : def.type === 'number' ? (def.default === null ? 'number | null' : 'number') : def.type === 'iconComponent' ? 'ReactNode' : def.type;

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

/** The element of a glyph slot: a span of the slot's class holding the definition's outline as an SVG, in currentColor. */
export const glyphJsx = (template, slot) => `<span className="${template.id}-${slot.id}"><svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true"><path d="${glyphPathD(slot.glyph)}" fill="currentColor" /></svg></span>`;

function componentSource(template, name, problems, partWidthOf = part => part.arc.width) {
    const params = Object.entries(template.props).map(([prop, def]) => (def.source === 'variable' ? prop : `${prop} = ${JSON.stringify(def.default)}`));
    for (const event of template.events) {
        if (!DOM_EVENT[event.name]) problems.push({ event: event.name, reason: 'no-dom-event' });
        params.push(event.name);
    }
    const slotted = (template.slots ?? []).length > 0;
    // The props that write a gap or a width reach the stylesheet as custom properties on the root (a width of none is not set); a layout is a data attribute.
    const varPairs = fieldWritersOf(template).filter(w => w.field === 'gap' || w.field === 'width').map(w => {
        const none = template.props[w.prop].default === null ? `${w.prop} == null ? undefined : ` : '';
        return `'--${template.id}-${w.prop}': ${none}\`\${${w.prop}}px\``;
    });
    const varsExpr = varPairs.length ? `{ ${varPairs.join(', ')} }` : null;
    // Whatever turns the disabled state on: its own prop, and the prop of each state that is an alias of it (the Input's Read only).
    const disabledProp = Object.values(template.persistentStates).filter(def => def.prop === template.persistentStates[template.element.disabledState].prop || def.as === template.element.disabledState).map(def => def.prop).join(' || ');
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
    const controlPartsJsx = () => [
        ...(ctl?.count ? ['{' + ctl.count + ' && <span className="' + template.id + '-count">{' + ctl.value + '.length}' + (ctl.maxlength ? '{' + ctl.maxlength + ' != null ? ` / ${' + ctl.maxlength + '}` : ' + "''" + '}' : '') + '</span>}'] : []),
    ];
    let framePlaced = false;
    let sidedAfterPlaced = false;
    const sidedAfter = rooted.filter(part => part.side).map(part => framePartJsx(part, `${part.side} === "end"`));
    const emitSlot = (slot, out) => {
        if (slot.kind === 'text' || slot.kind === 'control') {
            // The counter is written after the control it counts (controlPartsJsx), which is where the anatomy puts it.
            if (slot.text?.counter) return;
            if (!framePlaced && !slot.parent) { out.push(...rooted.filter(part => !part.side).map(part => framePartJsx(part)), ...rooted.filter(part => part.side).map(part => framePartJsx(part, `${part.side} !== "end"`))); framePlaced = true; }
            const isControl = controlOf(template)?.slot === slot.id;
            const control = controlOf(template);
            if (!template.props[slot.id] && !isControl) problems.push({ slot: slot.id, reason: 'no-prop' });
            // A control slot is an input holding the value prop (and the placeholder beside it), not a span.
            const label = control && control.slot === slot.id
                ? `<input className="${template.id}-${slot.id}" value={${control.value}}${control.placeholder ? ` placeholder={${placeholderCondition(template, control)}}` : ''}${control.readonly ? ` readOnly={${control.readonly}}` : ''}${control.maxlength ? ` maxLength={${control.maxlength}}` : ''}${control.minlength ? ` minLength={${control.minlength}}` : ''} disabled={${disabledProp}} />`
                : `<span className="${template.id}-${slot.id}">{${slot.id}}</span>`;
            // The control is always written: the input holds the value and the placeholder whether or not the canvas has a layer for them.
            out.push(isControl ? label : slot.shownWhen ? `{(${shownJsx(slot.shownWhen)}) && ${label}}` : slot.optional ? `{${slot.id} && ${label}}` : label);
            if (!sidedAfterPlaced && !slot.parent) { out.push(...sidedAfter); sidedAfterPlaced = true; }
            if (isControl) out.push(...controlPartsJsx());
        }
        else if (slot.kind === 'glyph') {
            // A glyph is drawn from its definition, always: the stylesheet shows it while its state attribute is on (see glyphRules), so Play and the export need no layer.
            out.push(glyphJsx(template, slot));
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
                out.push(`{${[...(def.show !== undefined ? [def.show] : []), ...(def.hideWhenEmpty !== undefined ? [`${def.hideWhenEmpty} !== ''`] : []), ...(cond ? [cond] : []), ...replacedBy].join(' && ')} && <span className="${template.id}-${slot.id}">{${def.component}}</span>}`);
            }
        }
        else problems.push({ slot: slot.id, reason: 'unsupported-slot' });
    };
    // A container is one element of the template's class around the slots that name it, in anatomy order; its layout is the box frame's own (see boxRules).
    for (const slot of template.anatomy.filter(s => !s.parent)) {
        if (slot.kind !== 'frame') { emitSlot(slot, children); continue; }
        const inner = [];
        for (const child of template.anatomy.filter(c => c.parent === slot.id)) emitSlot(child, inner);
        for (const part of parented(slot.id)) inner.push(framePartJsx(part));
        const indented = inner.map(line => line.split('\n').map(l => '  ' + l).join('\n')).join('\n');
        children.push(`<div className="${template.id}-${slot.id}">\n${indented}\n</div>`);
    }
    if (!framePlaced) children.push(...rooted.filter(part => !part.side).map(part => framePartJsx(part)));
    // A content slot is an element of the component, after the other layers in schema order: drawn when its prop holds something, always with showEmpty.
    for (const { prop, slot } of slotPropsOf(template)) {
        // A repeating slot draws its children `<id>Copies` times (0 while they are empty), in one slot element; without copies it is empty like any other.
        const element = slot.repeat ? `<div className="${template.id}-${slot.id}">{Array.from({ length: ${slot.id}Copies }, (_, i) => <Fragment key={i}>{${prop}}</Fragment>)}</div>` : `<div className="${template.id}-${slot.id}">{${prop}}</div>`;
        const guard = slot.repeat ? `${slot.id}Copies > 0` : `filled(${prop})`;
        children.push(slot.showEmpty === true ? element : `{${guard} && ${element}}`);
    }
    const { tag, attrs: tagAttrs, disabledState, blockClickProps } = template.element;
    const dims = variableProps(template).map(([prop]) => prop);
    const attrs = [
        ...Object.entries(tagAttrs).map(([key, value]) => `${key === 'tabindex' ? 'tabIndex' : key}="${value}"`),
        slotted ? `className={['${template.id}', className].filter(Boolean).join(' ')}` : `className="${template.id}"`,
        ...(slotted ? ['ref={ref}', varsExpr ? `style={{ ...${varsExpr}, ...style } as CSSProperties}` : 'style={style}'] : varsExpr ? [`style={${varsExpr}}`] : []),
        ...(template.interaction?.wave ? ['data-wave'] : []),
        ...(template.interaction?.wave && !template.events.some(event => event.name === 'onClick') ? ['onClick={(e) => { if (blocked) return; waveDown(e.currentTarget); }}'] : []),
        ...(template.interaction?.wave ? [`onAnimationEnd={(e) => { if (e.animationName === '${WAVE_KEYFRAMES}') e.currentTarget.removeAttribute('data-wave-on'); }}`] : []),
        ...dims.map(dim => `data-${dim}={${dim}}`),
        // A persistent state the stylesheet selects as an attribute (`[data-checked]`) is written from its prop.
        ...stateAttributesOf(template).map(({ attr, prop }) => `${attr}={${prop} || undefined}`),
        // A toggle control says its state to assistive technology: true, false, or mixed while the state it clears holds.
        ...(template.toggle ? [`aria-checked={${template.toggle.clears ? `${template.toggle.clears} ? "mixed" : ` : ''}${template.toggle.prop} ? "true" : "false"}`] : []),
        ...fieldWritersOf(template).filter(w => w.field === 'layout').map(w => `data-${w.prop}={${w.prop}}`),
        // A prop that aligns the row's content to the end says which end as a data attribute (a Switch's handle).
        ...fieldWritersOf(template).filter(w => w.field === 'primaryAlign').map(w => `data-${w.prop}-align={${w.prop} ? "end" : "start"}`),
        // Only some elements have a `disabled` attribute; any other root says it with aria-disabled (and the schema's state pseudo selects on it).
        ...(ctl ? [] : [DISABLEABLE.has(tag) ? `disabled={${disabledProp}}` : `aria-disabled={${disabledProp} || undefined}`]),
        // A root whose click a prop blocks says so, so the loading rule (see blockedRules) matches in Play and in the export alike.
        ...(blockClickProps.length ? ['data-blocked={blocked || undefined}'] : []),
        ...template.events.map(event => `${DOM_EVENT[event.name]}={${event.name === 'onClick' ? (template.interaction?.wave ? 'blocked ? undefined : (e) => { if (onClick) onClick(e); waveDown(e.currentTarget); }' : 'blocked ? undefined : onClick') : event.name}}`),
        ...(slotted ? ['{...rest}'] : []),
    ];
    const indent = (/** @type {string} */ text, /** @type {number} */ n) => text.split('\n').map(line => ' '.repeat(n) + line).join('\n');
    if (slotted) {
        const [attrType, elementType] = ELEMENT_TYPES[tag] ?? ['HTMLAttributes', `HTMLElementTagNameMap['${tag}']`];
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
        `export function ${name}({ ${params.join(', ')} }) {`,
        `  const blocked = ${blockClickProps.join(' || ') || 'false'};`,
        '  return (',
        `    <${tag}`,
        ...attrs.map(attr => `      ${attr}`),
        '    >',
        ...children.map(child => indent(child, 6)),
        `    </${tag}>`,
        '  );',
        '}',
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
function clipOf(master) {
    if (master.strokeStyle === 'dash') return 'border-box';
    if (master.strokeVisible === false) return 'border-box';
    const split = typeof master.stroke === 'string' ? splitColor(master.stroke) : null;
    const alpha = (split ? split.alpha / 100 : 1) * (master.strokeOpacity ?? 1);
    if (alpha < 1) return 'border-box';
    return 'padding-box';
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
        if (key === 'root' && template.outline) {
            // The outline width includes the border: the ring starts back at the border's inner edge (an inside stroke),
            // so the visible ring is the width minus the border with no gap. A border as wide as the outline leaves no ring.
            // Both widths resolve from the binding (see tokenValueOf): a null geometry means the token pass already
            // refused the export, and the CSS below is discarded with it.
            if (geometry.outline === null || geometry.border === null || geometry.outline <= geometry.border) decls.push('  outline: none;\n');
            else decls.push(`  outline: ${geometry.outline}px solid var(${cssVarOf(template.id, 'outline-color')});\n`, `  outline-offset: ${template.outline.offset - geometry.border}px;\n`);
            decls.push(`  transition: ${FOCUS_TRANSITION};\n`);
        }
        // The root draws its own border, so the children sit inside the compensated padding.
        if (key === 'root' && 'stroke' in (template.display.root ?? {})) { const w = rootBorderWidthOf(master); decls.push(`  border-width: ${w}px;\n`, `  border-style: ${w === 0 ? 'none' : lineStyleOf(master)};\n`);
        decls.push(`  background-clip: ${clipOf(master)};\n`); }
        if (key === 'root' && (template.interaction?.wave || 'stroke' in (template.display.root ?? {}))) decls.push('  position: relative;\n');
        // A box of the anatomy (a group frame) draws its own border the same way, from its own layer: its size includes the border.
        if (key !== 'root' && kind === 'frame' && 'stroke' in props) {
            const box = under.find(({ node: c }) => c.behavior?.group === key)?.node ?? master;
            const w = rootBorderWidthOf(box);
            decls.push('  box-sizing: border-box;\n', `  border-width: ${w}px;\n`, `  border-style: ${w === 0 ? 'none' : lineStyleOf(box)};\n`, `  background-clip: ${clipOf(box)};\n`);
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
            for (const name of [css].flat()) { if (key === 'root' && (prop === 'paddingX' || prop === 'paddingY')) { const bw = rootBorderWidthOf(master); if (bw > 0) { decls.push(`  ${name}: max(0px, calc(var(${cssVarOf(template.id, source)}) - ${bw}px));\n`); continue; } } decls.push(`  ${name}: var(${cssVarOf(template.id, source)});\n`); }
        }
        if (!decls.length) return '';
        const selector = key === 'root' ? `.${template.id}` : `.${template.id}-${key}`;
        const rule = `${selector} {\n${decls.join('')}}\n`;
        if (controlOf(template)?.slot === key && props.placeholder) return `${rule}${selector}::placeholder {\n  color: var(${cssVarOf(template.id, props.placeholder)});\n}\n`;
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
    const guard = template.focusTarget === 'wrapper' ? ':not(:has(:disabled))' : `:not(${pseudoOf(template, template.element.disabledState)})`;
    return iconDefsOf(template).filter(def => def.tokens?.hoverColour !== undefined && def.slot !== undefined)
        .map(def => `.${template.id}${guard} .${template.id}-${def.slot}:hover {\n  color: var(${cssVarOf(template.id, def.tokens.hoverColour)});\n}\n`);
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
    const dis = pseudoOf(template, template.element.disabledState);
    const notDis = `:not(${dis})`;
    const selOf = key => key === 'root' ? `.${template.id}` : `.${template.id}-${key}`;
    for (const t of motion.transitions ?? []) {
        const sel = selOf(t.key);
        out.push(`${sel} {\n  transition: ${t.props.map(p => `${p} ${t.duration} ${t.timing}${t.delay ? ` ${t.delay}` : ''}`).join(', ')};\n}\n`);
        // A control taking the disabled state swaps colours with no transition, so the swap is instant.
        out.push(`${t.key === 'root' ? `.${template.id}${dis}` : `.${template.id}${dis} ${sel}`} {\n  transition: none;\n}\n`);
    }
    for (const a of motion.appearances ?? []) {
        const name = `midas-${template.id}-${a.key}-in`;
        out.push(`@keyframes ${name} {\n  from {\n${Object.entries(a.from).map(([p, v]) => `    ${p}: ${v};`).join('\n')}\n  }\n}\n`);
        const roots = a.states.map(s => `.${template.id}[${stateAttributesOf(template).find(x => x.state === s)?.attr}]${notDis} .${template.id}-${a.key}`);
        out.push(`${roots.join(', ')} {\n  animation: ${name} ${a.duration} ${a.timing}${a.delay ? ` ${a.delay}` : ''} backwards;\n}\n`);
    }
    if (motion.slide) {
        const { key, prop, travel } = motion.slide;
        const attr = stateAttributesOf(template).find(x => x.prop === prop)?.attr;
        const v = t => `var(${cssVarOf(template.id, t)})`;
        out.push(`.${template.id} .${template.id}-${key} {\n  transform: translateX(0);\n}\n`);
        // The resting end position stays where the canvas puts it (track - handle - padding), but reached
        // by transform so the travel animates; this overrides the align-end rule above (same specificity, later wins).
        out.push(`.${template.id}[${attr}] {\n  justify-content: flex-start;\n}\n`);
        out.push(`.${template.id}[${attr}] .${template.id}-${key} {\n  transform: translateX(calc(${v(travel.track)} - ${v(travel.handle)} - 2 * ${v(travel.padding)}));\n}\n`);
    }
    if (motion.press) {
        const { key, token, prop, grow } = motion.press;
        out.push(`.${template.id}:active${notDis} .${template.id}-${key} {\n  ${prop}: calc(var(${cssVarOf(template.id, token)}) + ${grow});\n}\n`);
        const slide = motion.slide;
        if (slide && slide.key === key) {
            // A slid handle grows toward the inside: while pressed and slid it widens leftwards,
            // so its far edge stays on the padding (more specific than the press rule, so it wins).
            const attr = stateAttributesOf(template).find(x => x.prop === slide.prop)?.attr;
            const v = t => `var(${cssVarOf(template.id, t)})`;
            const travel = slide.travel;
            out.push(`.${template.id}[${attr}]:active${notDis} .${template.id}-${key} {\n  ${prop}: calc(var(${cssVarOf(template.id, token)}) + ${grow});\n  transform: translateX(calc(${v(travel.track)} - ${v(travel.handle)} - 2 * ${v(travel.padding)} - ${grow}));\n}\n`);
        }
    }
    return out;
}
function reducedMotion(template) {
    const sel = `.${template.id}`;
    const wave = template.interaction?.wave ? `\n  ${sel}[data-wave-on]::after {\n    animation: none;\n  }` : '';
    const dis2 = `:not(${pseudoOf(template, template.element.disabledState)})`;
    const motion = template.motion ? [...(template.motion.transitions ?? []).map(t => `\n  ${t.key === 'root' ? sel : `${sel}-${t.key}`} {\n    transition: none;\n  }`),
        ...(template.motion.appearances ?? []).map(a => `\n  ${a.states.map(s => `${sel}[${stateAttributesOf(template).find(x => x.state === s)?.attr}]${dis2} ${sel}-${a.key}`).join(', ')} {\n    animation: none;\n  }`)] : [];
    return `@media (prefers-reduced-motion: reduce) {\n  ${sel} {\n    transition: none;\n  }${wave}${motion.join('')}\n}\n`;
}

/**
 * The rules that read what the layout, gap and width props put on the root (see fieldStyleOf): a layout is one rule per option on the data attribute, a gap
 * and a width read their custom property (a width falls back to auto, the hugging layer).
 * @param {any} template
 * @returns {string[]}
 */
function fieldRules(template) {
    return fieldWritersOf(template).flatMap(({ prop, key, field }) => {
        const target = key === 'root' ? '' : ` .${template.id}-${key}`;
        if (field === 'layout') {
            // A slot that fills the width it is given takes the cross axis of a vertical root and what is left of the row in a horizontal one (flowSizing, per option).
            const fills = key === 'root' ? (template.slots ?? []).filter(slot => slot.fill).map(slot => slot.id) : [];
            const direction = option => `.${template.id}[data-${prop}="${option}"]${target} {\n  flex-direction: ${option === 'horizontal' ? 'row' : 'column'};\n}\n`;
            const fill = (option, id) => `.${template.id}[data-${prop}="${option}"] .${template.id}-${id} {\n${option === 'horizontal' ? '  flex: 1 1 0;\n  min-width: 0px;\n  align-self: auto;' : '  flex: none;\n  align-self: stretch;'}\n}\n`;
            return template.props[prop].options.flatMap(option => [direction(option), ...fills.map(id => fill(option, id))]);
        }
        // A prop that aligns the content to the end: one rule per side, selected on the data attribute the root carries.
        if (field === 'primaryAlign') return ['start', 'end'].map(side => `.${template.id}[data-${prop}-align="${side}"]${target} {\n  justify-content: flex-${side};\n}\n`);
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
    return template.anatomy.filter(slot => slot.kind === 'frame').map(slot => {
        const node = childrenOf(master.id).find(c => c.behavior?.group === slot.id) ?? { type: 'frame', layout: slot.layout, w: 0, h: 0, layoutSizingH: 'hug', layoutSizingV: 'hug' };
        // An axis bound to a variable is the token's value (the display rule writes it): the node's own number is not a second source, and written after the token it would win.
        const sizing = flowSizing(node, master);
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
    return template.anatomy.filter(slot => slot.kind === 'glyph').map(slot => `.${template.id}:not([${attrs.find(a => a.prop === slot.shownWhen.prop).attr}]) .${template.id}-${slot.id} {
  display: none;
}
`);
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
            if (mode) blocks.push(`.${template.id}[data-${dim}="${mode.id}"] {\n  border-style: ${rule.borderStyle};\n}\n`);
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
            // A click-blocking prop held hides every other state, like disabled does.
            const blockedGuard = (template.element.blockClickProps?.length ?? 0) ? ':not([data-blocked])' : '';
            const noDisabled = wrapperTarget ? ':not(:has(:disabled))' : `:not(${pseudoOf(template, disabledState)})`;
            const guard = state === disabledState ? '' : `${noDisabled}${blockedGuard}`;
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
    blocks.push(...iconHoverRules(template), ...blockedRules(template));
    if (template.parts?.some(part => part.spin)) blocks.push(`@keyframes ${SPIN_KEYFRAMES} {\n  to { transform: rotate(360deg); }\n}\n`);
    if (template.interaction?.wave) blocks.push(waveRules(template));
    blocks.push(...fieldRules(template), ...motionRules(template), ...groupRules(template, master, childrenOf), ...glyphRules(template), ...slotRules(template, master, childrenOf));
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
    const jsx = componentSource(template, name, problems, partWidthOf(master, childrenOf));
    const css = stylesheet(template, binding, variables, problems, master, childrenOf);
    if (problems.length) return { files: null, problems };
    return { files: { [`${name}.${template.slots?.length ? 'tsx' : 'jsx'}`]: jsx, [`${name}.css`]: css }, problems: [] };
}
