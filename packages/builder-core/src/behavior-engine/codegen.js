// Code generator (stage 8). Pure: a template, its master's binding, the document's variables and a component name in; a React
// component (JSX) and its stylesheet out. Both come from the schema and the same resolver the preview uses, so the same inputs
// give the same text. If any token is unresolved for any mode, nothing is written: the result has no files and lists the reasons.
import { previewOf } from './preview.js';
import { variableProps } from './registry.js';
import { resolveProps } from './instance-props.js';
import { NODE_PROPERTIES, canvasPartsOf, targetKindOf } from './display.js';
import { pathCommands, svgPathD } from '../geometry/shapes.js';
import { controlOf, placementsOfDef, slotDefsOf } from './anatomy.js';
import { cssVarOf } from './tokens.js';
import { rootLayoutOf, labelLayoutOf } from './layout.js';
import { labelEntryOf } from './layers.js';

// Motion constants (antd seed): the focus ring animates in and out; the click wave expands and fades. Durations and
// easings have no variable type, so they live here, not in Semantic.
// motionDurationMid + motionEaseInOut: the input transition.
const FOCUS_TRANSITION = 'outline-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1), outline-offset 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)';
// Wave spread lands at 20% of the 2s opacity leg (0.4s), motionEaseOutCirc; the colour comes from the wave-color token.
const WAVE_KEYFRAMES = 'midas-wave';
const WAVE_ANIMATION = 'midas-wave 2s cubic-bezier(0.08, 0.82, 0.17, 1)';
const WAVE_SPREAD = '6px';
const WAVE_START_OPACITY = 0.2;
// A part declared `spin` turns about its centre; the arc it draws is what shows the turn.
export const SPIN_KEYFRAMES = 'midas-spin';
export const SPIN_ANIMATION = `${SPIN_KEYFRAMES} 1s linear infinite`;

/** The DOM handler each schema event is written to. */
const DOM_EVENT = { onClick: 'onClick', onHover: 'onMouseEnter', onFocus: 'onFocus', onBlur: 'onBlur' };

/**
 * The component source for a template. Problems found on the way are pushed onto `problems`.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} name
 * @param {any[]} problems
 */
function componentSource(template, name, problems) {
    const params = Object.entries(template.props).map(([prop, def]) => (def.source === 'variable' ? prop : `${prop} = ${JSON.stringify(def.default)}`));
    for (const event of template.events) {
        if (!DOM_EVENT[event.name]) problems.push({ event: event.name, reason: 'no-dom-event' });
        params.push(event.name);
    }
    const children = [];
    // The canvas frame parts (the spinner) are drawn as the canvas places them: before the first text layer. An arc is an SVG path
    // of the same geometry the canvas and Play draw, shown while its condition holds (at rest: the turn is Play's).
    const framePartJsx = part => {
        const { size, start, sweep, width } = part.arc;
        const node = { type: 'ellipse', w: size - width, h: size - width, arcStart: start, arcSweep: sweep, arcRatio: 0 };
        const d = svgPathD(pathCommands(node), value => +value.toFixed(3));
        return `{${part.shownWhen.prop} === true && (<svg className="${template.id}-${part.id}" width={${size}} height={${size}} viewBox="0 0 ${size} ${size}" aria-hidden="true"><path transform="translate(${width / 2} ${width / 2})" d="${d}" fill="none" stroke="currentColor" strokeWidth={${width}} /></svg>)}`;
    };
    const framed = canvasPartsOf(template).filter(part => part.kind === 'frame' && part.arc);
    const ctl = controlOf(template);
    // The clear and the counter follow the input, as the canvas and Play order them: a text affix after the input comes after them.
    const controlPartsJsx = () => [
        ...(ctl?.clear ? ['{' + ctl.clear + ' && ' + ctl.value + " !== '' && <span className=\"" + template.id + '-clear">×</span>}'] : []),
        ...(ctl?.count ? ['{' + ctl.count + ' && <span className="' + template.id + '-count">{' + ctl.value + '.length}' + (ctl.maxlength ? '{' + ctl.maxlength + ' != null ? ` / ${' + ctl.maxlength + '}` : ' + "''" + '}' : '') + '</span>}'] : []),
    ];
    let framePlaced = false;
    for (const slot of template.anatomy) {
        if (slot.kind === 'text' || slot.kind === 'control') {
            if (!framePlaced) { children.push(...framed.map(framePartJsx)); framePlaced = true; }
            const isControl = controlOf(template)?.slot === slot.id;
            const control = controlOf(template);
            if (!template.props[slot.id] && !isControl) problems.push({ slot: slot.id, reason: 'no-prop' });
            // A control slot is an input holding the value prop (and the placeholder beside it), not a span.
            const label = control && control.slot === slot.id
                ? `<input className="${template.id}-${slot.id}" value={${control.value}}${control.placeholder ? ` placeholder={${control.placeholder}}` : ''}${control.readonly ? ` readOnly={${control.readonly}}` : ''}${control.maxlength ? ` maxLength={${control.maxlength}}` : ''}${control.minlength ? ` minLength={${control.minlength}}` : ''} disabled={${template.persistentStates[template.element.disabledState].prop}} />`
                : `<span className="${template.id}-${slot.id}">{${slot.id}}</span>`;
            children.push(slot.shownWhen ? `{(${shownJsx(slot.shownWhen)}) && ${label}}` : slot.optional ? `{${slot.id} && ${label}}` : label);
            if (isControl) children.push(...controlPartsJsx());
        }
        else if (slot.managed) {
            const defs = slotDefsOf(template, slot.id);
            if (!defs.length) problems.push({ slot: slot.id, reason: 'unsupported-slot' });
            else for (const def of defs) {
                const tests = placementsOfDef(template, def, slot.id).map(value => `${def.placement} === "${value}"`);
                const cond = tests.length === 1 ? tests[0] : tests.length ? `(${tests.join(' || ')})` : null;
                // A slot a canvas part replaces (the start icon while the spinner shows) is not drawn while that part shows.
                const replacedBy = canvasPartsOf(template).filter(part => part.replaces === slot.id).map(part => `${part.shownWhen.prop} !== true`);
                children.push(`{${[def.show, ...(cond ? [cond] : []), ...replacedBy].join(' && ')} && <span className="${template.id}-${slot.id}">{${def.component}}</span>}`);
            }
        }
        else problems.push({ slot: slot.id, reason: 'unsupported-slot' });
    }
    if (!framePlaced) children.push(...framed.map(framePartJsx));
    const { tag, attrs: tagAttrs, disabledState, blockClickProps } = template.element;
    const disabledProp = template.persistentStates[disabledState].prop;
    const dims = variableProps(template).map(([prop]) => prop);
    const attrs = [
        ...Object.entries(tagAttrs).map(([key, value]) => `${key}="${value}"`),
        `className="${template.id}"`,
        ...(template.interaction?.wave ? ['data-wave'] : []),
        ...(template.interaction?.wave && !template.events.some(event => event.name === 'onClick') ? ['onClick={(e) => { if (blocked) return; waveDown(e.currentTarget); }}'] : []),
        ...(template.interaction?.wave ? [`onAnimationEnd={(e) => { if (e.animationName === '${WAVE_KEYFRAMES}') e.currentTarget.removeAttribute('data-wave-on'); }}`] : []),
        ...dims.map(dim => `data-${dim}={${dim}}`),
        ...(ctl ? [] : [`disabled={${disabledProp}}`]),
        ...template.events.map(event => `${DOM_EVENT[event.name]}={${event.name === 'onClick' ? (template.interaction?.wave ? 'blocked ? undefined : (e) => { if (onClick) onClick(e); waveDown(e.currentTarget); }' : 'blocked ? undefined : onClick') : event.name}}`),
    ];
    const indent = (/** @type {string} */ text, /** @type {number} */ n) => text.split('\n').map(line => ' '.repeat(n) + line).join('\n');
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
    if ('is' in cond) return `${cond.prop} === ${JSON.stringify(cond.is)}`;
    const text = `String(${cond.prop} ?? "")`;
    return cond.empty ? `${text} === ""` : `${text} !== ""`;
}

/**
 * One rule per node the display mapping styles from a token: each mapped property is written to its CSS property, reading the
 * token's custom property. Literal sources (width, text) are not CSS and are written by the component.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function displayRules(template, master, childrenOf) {
    const tokens = Object.values(template.tokens).flat();
    const entry = labelEntryOf(master.id, childrenOf, master);
    return Object.entries(template.display).map(([key, props]) => {
        const kind = targetKindOf(template, key);
        // The root lays its label and its icon slots out like the canvas auto layout frame. Play draws the same rules
        // with display:flex (a real element in its parent's layout); the export is inline-flex so a hug Button keeps its
        // natural width. The label keeps its own width and alignment from its layer.
        const decls = key === 'root'
            ? ['  display: inline-flex;\n', '  box-sizing: border-box;\n', ...cssDecls(rootLayoutOf(master, 0, template.rootAlign))]
            : kind === 'text' ? cssDecls(labelLayoutOf(entry?.node, entry?.parent ?? master)) : [];
        if (key === 'root' && template.outline) {
            decls.push(`  outline: ${template.outline.width}px solid var(${cssVarOf(template.id, 'outline-color')});\n`, `  outline-offset: ${template.outline.offset}px;\n`, `  transition: ${FOCUS_TRANSITION};\n`);
        }
        // The root draws no border: its stroke is the ::before overlay (see strokeRules), so the children sit inside the padding.
        if (key === 'root') decls.push('  border-width: 0;\n', '  border-style: solid;\n');
        if (key === 'root' && (template.interaction?.wave || 'stroke' in (template.display.root ?? {}))) decls.push('  position: relative;\n');
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
        for (const [prop, source] of Object.entries(props)) {
            const { css, perMember } = NODE_PROPERTIES[kind][prop];
            if (!css || !tokens.includes(source)) continue;
            if (perMember) { for (const name of css) decls.push(`  ${name}: var(${cssVarOf(template.id, source)}-${name});\n`); continue; }
            for (const name of [css].flat()) decls.push(`  ${name}: var(${cssVarOf(template.id, source)});\n`);
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
 * The root stroke rule: the ::before overlay takes the host's colour, style and radius, and is inside the box (no layout).
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function strokeRules(template) {
    if (!('stroke' in (template.display.root ?? {}))) return '';
    // The stroke is inside the box and takes no space: an absolutely positioned overlay with the host's colour, style and radius.
    return `.${template.id}::before {\n  content: '';\n  position: absolute;\n  inset: 0;\n  box-sizing: border-box;\n  border: 1px solid;\n  border-color: inherit;\n  border-style: inherit;\n  border-radius: inherit;\n  pointer-events: none;\n}\n`;
}

/**
 * The click-wave rules for a wave template: the ::after ring inherits the host radius, starts at zero spread and is
 * transparent, and expands to the antd spread while fading when data-wave-on is set. The host colour comes from the
 * wave-color token, so it follows the button colour per mode.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function waveRules(template) {
    const color = `var(${cssVarOf(template.id, 'wave-color')})`;
    return [
        `.${template.id}[data-wave-on]::after {\n  animation: ${WAVE_ANIMATION};\n}\n`,
        `.${template.id}::after {\n  content: '';\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  pointer-events: none;\n  box-shadow: 0 0 0 0 ${color};\n  opacity: 0;\n}\n`,
        `@keyframes ${WAVE_KEYFRAMES} {\n  0% { box-shadow: 0 0 0 0 ${color}; opacity: ${WAVE_START_OPACITY}; }\n  20% { box-shadow: 0 0 0 ${WAVE_SPREAD} ${color}; }\n  100% { box-shadow: 0 0 0 ${WAVE_SPREAD} ${color}; opacity: 0; }\n}\n`,
    ].join('\n');
}

/**
 * Reduced motion kills the focus transition and the wave. Emitted per template with interaction behaviour.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function reducedMotion(template) {
    const sel = `.${template.id}`;
    const wave = template.interaction?.wave ? `\n  ${sel}[data-wave-on]::after {\n    animation: none;\n  }` : '';
    return `@media (prefers-reduced-motion: reduce) {\n  ${sel} {\n    transition: none;\n  }${wave}\n}\n`;
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
    const blocks = displayRules(template, master, childrenOf);
    for (const [dim, def] of variableProps(template)) {
        for (const [mode, rule] of Object.entries(def.styles ?? {})) {
            if (modes[dim]?.includes(mode)) blocks.push(`.${template.id}[data-${dim}="${mode}"] {\n  border-style: ${rule.borderStyle};\n}\n`);
        }
    }
    const { disabledState } = template.element;
    const defaults = resolveProps(template, {});
    for (const combo of combos) {
        const selector = `.${template.id}${dims.map(dim => `[data-${dim}="${combo[dim]}"]`).join('')}`;
        const base = previewOf(template, binding, combo, variables, defaults, 'default');
        for (const u of base.unresolved) problems.push({ ...u, ...combo });
        if (Object.keys(base.vars).length) blocks.push(`${selector} {\n${declarations(base.vars)}}\n`);
        for (const state of [...Object.keys(template.persistentStates), ...Object.keys(template.previewStates)]) {
            const pseudo = template.statePseudo[state];
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
            // A wrapper focus target reflects the inner control state: the disabled rule matches
            // `:has(:disabled)`, focus matches `:has(:focus-visible)` with a `:focus-within` fallback, and the
            // other states are guarded by `:not(:has(:disabled))`. Plain `:focus`, `:focus-visible` and
            // `:disabled` never match the wrapper, so no dead rule is emitted for them.
            const wrapperTarget = template.focusTarget === 'wrapper';
            const guard = state === disabledState ? '' : wrapperTarget ? ':not(:has(:disabled))' : `:not(${template.statePseudo[disabledState]})`;
            if (!Object.keys(delta).length) continue;
            const sels = !wrapperTarget ? [`${selector}${pseudo}${guard}`]
                : state === disabledState ? [`${selector}:has(:disabled)`]
                : pseudo === ':focus' || pseudo === ':focus-visible' ? [`${selector}:has(:focus-visible)${guard}`, `${selector}:focus-within${guard}`]
                : [`${selector}${pseudo}${guard}`];
            for (const sel of sels) blocks.push(`${sel} {\n${declarations(delta)}}\n`);
        }
    }
    if (template.parts?.some(part => part.spin)) blocks.push(`@keyframes ${SPIN_KEYFRAMES} {\n  to { transform: rotate(360deg); }\n}\n`);
    if (template.interaction?.wave) blocks.push(waveRules(template));
    const stroke = strokeRules(template);
    if (stroke) blocks.push(stroke);
    if (template.interaction) blocks.push(reducedMotion(template));
    return blocks.join('\n');
}

/**
 * @param {Record<string, string>} vars
 */
function declarations(vars) {
    return Object.entries(vars).map(([name, value]) => `  ${name}: ${value};\n`).join('');
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
    const jsx = componentSource(template, name, problems);
    const css = stylesheet(template, binding, variables, problems, master, childrenOf);
    if (problems.length) return { files: null, problems };
    return { files: { [`${name}.jsx`]: jsx, [`${name}.css`]: css }, problems: [] };
}
