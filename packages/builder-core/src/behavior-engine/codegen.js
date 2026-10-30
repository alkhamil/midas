// Code generator (stage 8). Pure: a template, its master's binding, the document's variables and a component name in; a React
// component (JSX) and its stylesheet out. Both come from the schema and the same resolver the preview uses, so the same inputs
// give the same text. If any token is unresolved for any mode, nothing is written: the result has no files and lists the reasons.
import { previewOf } from './preview.js';
import { variableProps } from './registry.js';
import { resolveProps } from './instance-props.js';
import { NODE_PROPERTIES, iconOnlyValuesOf, targetKindOf } from './display.js';
import { controlOf, placementsOfDef, slotDefsOf } from './anatomy.js';
import { cssVarOf } from './tokens.js';
import { rootLayoutOf, labelLayoutOf } from './layout.js';
import { labelEntryOf } from './layers.js';

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
    const iconOnlyValues = iconOnlyValuesOf(template);
    const children = [];
    for (const slot of template.anatomy) {
        if (slot.kind === 'text') {
            if (!template.props[slot.id]) problems.push({ slot: slot.id, reason: 'no-prop' });
            const control = controlOf(template);
            // A control slot is an input holding the value prop (and the placeholder beside it), not a span.
            const label = control && control.slot === slot.id
                ? `<input className="${template.id}-${slot.id}" value={${control.value}}${control.placeholder ? ` placeholder={${control.placeholder}}` : ''} />`
                : `<span className="${template.id}-${slot.id}">{${slot.id}}</span>`;
            children.push(iconOnlyValues.length ? `{!iconOnly && ${label}}` : label);
        }
        else if (slot.managed) {
            const defs = slotDefsOf(template, slot.id);
            if (!defs.length) problems.push({ slot: slot.id, reason: 'unsupported-slot' });
            else for (const def of defs) {
                const tests = placementsOfDef(template, def, slot.id).map(value => `${def.placement} === "${value}"`);
                const cond = tests.length === 1 ? tests[0] : tests.length ? `(${tests.join(' || ')})` : null;
                children.push(cond
                    ? `{${def.show} && ${cond} && <span className="${template.id}-${slot.id}">{${def.component}}</span>}`
                    : `{${def.show} && <span className="${template.id}-${slot.id}">{${def.component}}</span>}`);
            }
        }
        else problems.push({ slot: slot.id, reason: 'unsupported-slot' });
    }
    const { tag, attrs: tagAttrs, disabledState, blockClickProps } = template.element;
    const disabledProp = template.persistentStates[disabledState].prop;
    const dims = variableProps(template).map(([prop]) => prop);
    const attrs = [
        ...Object.entries(tagAttrs).map(([key, value]) => `${key}="${value}"`),
        iconOnlyValues.length ? `className={iconOnly ? "${template.id} ${template.id}-icon-only" : "${template.id}"}` : `className="${template.id}"`,
        ...dims.map(dim => `data-${dim}={${dim}}`),
        `disabled={${disabledProp}}`,
        ...template.events.map(event => `${DOM_EVENT[event.name]}={${event.name === 'onClick' ? 'blocked ? undefined : onClick' : event.name}}`),
    ];
    const indent = (/** @type {string} */ text, /** @type {number} */ n) => text.split('\n').map(line => ' '.repeat(n) + line).join('\n');
    return [
        `export function ${name}({ ${params.join(', ')} }) {`,
        `  const blocked = ${blockClickProps.join(' || ') || 'false'};`,
        ...(iconOnlyValues.length ? [`  const iconOnly = ${template.icons.filter(def => def.placement).map(def => `${def.show} && (${(template.props[def.placement].iconOnly ?? []).map(value => `${def.placement} === "${value}"`).join(' || ')})`).join(' || ')};`] : []),
        '  return (',
        `    <${tag}`,
        ...attrs.map(attr => `      ${attr}`),
        '    >',
        ...children.map(child => indent(child, 6)),
        `    </${tag}>`,
        '  );',
        '}',
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
            ? ['  display: inline-flex;\n', ...cssDecls(rootLayoutOf(master))]
            : kind === 'text' ? cssDecls(labelLayoutOf(entry?.node, entry?.parent ?? master)) : [];
        if (key === 'root' && template.outline) {
            decls.push(`  outline: ${template.outline.width}px solid var(${cssVarOf(template.id, 'outline-color')});\n`, `  outline-offset: ${template.outline.offset}px;\n`);
        }
        if (key === 'root') decls.push('  border-width: 1px;\n', '  border-style: solid;\n');
        for (const [prop, source] of Object.entries(props)) {
            const css = NODE_PROPERTIES[kind][prop].css;
            if (!css || !tokens.includes(source)) continue;
            for (const name of [css].flat()) decls.push(`  ${name}: var(${cssVarOf(template.id, source)});\n`);
        }
        if (!decls.length) return '';
        const selector = key === 'root' ? `.${template.id}` : `.${template.id}-${key}`;
        return `${selector} {\n${decls.join('')}}\n`;
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
    // An icon-only instance has no label padding: its icon is the whole content, and the minimum width keeps it square.
    if (iconOnlyValuesOf(template).length) blocks.push(`.${template.id}-icon-only {\n  padding-inline: 0;\n}\n`);
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
            // A disabled element shows only its disabled style: the other states never apply to it.
            const guard = state === disabledState ? '' : `:not(${template.statePseudo[disabledState]})`;
            if (Object.keys(delta).length) blocks.push(`${selector}${pseudo}${guard} {\n${declarations(delta)}}\n`);
        }
    }
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
