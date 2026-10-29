// Code generator (stage 8). Pure: a template, its master's binding, the document's variables and a component name in; a React
// component (JSX) and its stylesheet out. Both come from the schema and the same resolver the preview uses, so the same inputs
// give the same text. If any token is unresolved for any mode, nothing is written: the result has no files and lists the reasons.
import { previewOf } from './preview.js';
import { variableProps } from './registry.js';
import { resolveProps } from './instance-props.js';
import { NODE_PROPERTIES, iconOnlyValuesOf, targetKindOf } from './display.js';
import { placementsOfSlot } from './anatomy.js';
import { cssVarOf } from './tokens.js';

/** The DOM handler each schema event is written to. */
const DOM_EVENT = { onClick: 'onClick', onHover: 'onMouseEnter', onFocus: 'onFocus', onBlur: 'onBlur' };
/** The width a boolean prop writes when it is true and the node fills its container. */
const FILL_WIDTH = 'width: "100%"';

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
    const { show, placement, component } = template.icon;
    const iconOnlyValues = iconOnlyValuesOf(template);
    const children = [];
    for (const slot of template.anatomy) {
        if (slot.kind === 'text') {
            if (!template.props[slot.id]) problems.push({ slot: slot.id, reason: 'no-prop' });
            const label = `<span className="${template.id}-${slot.id}">{${slot.id}}</span>`;
            children.push(iconOnlyValues.length ? `{!iconOnly && ${label}}` : label);
        }
        else if (slot.managed && placementsOfSlot(template, slot.id).length) {
            const tests = placementsOfSlot(template, slot.id).map(value => `${placement} === "${value}"`);
            const cond = tests.length === 1 ? tests[0] : `(${tests.join(' || ')})`;
            children.push(`{${show} && ${cond} && <span className="${template.id}-${slot.id}">{${component}}</span>}`);
        }
        else problems.push({ slot: slot.id, reason: 'unsupported-slot' });
    }
    const { tag, attrs: tagAttrs, disabledState, blockClickProps } = template.element;
    const disabledProp = template.persistentStates[disabledState].prop;
    const widthProps = Object.entries(template.props).filter(([, def]) => def.source === 'literal' && def.node?.field === 'layoutSizingH').map(([prop]) => prop);
    if (widthProps.length > 1) problems.push({ reason: 'several-width-props', props: widthProps });
    const dims = variableProps(template).map(([prop]) => prop);
    const attrs = [
        ...Object.entries(tagAttrs).map(([key, value]) => `${key}="${value}"`),
        iconOnlyValues.length ? `className={iconOnly ? "${template.id} ${template.id}-icon-only" : "${template.id}"}` : `className="${template.id}"`,
        ...dims.map(dim => `data-${dim}={${dim}}`),
        `disabled={${disabledProp}}`,
        ...widthProps.map(prop => `style={${prop} ? { ${FILL_WIDTH} } : undefined}`),
        ...template.events.map(event => `${DOM_EVENT[event.name]}={${event.name === 'onClick' ? 'blocked ? undefined : onClick' : event.name}}`),
    ];
    const indent = (/** @type {string} */ text, /** @type {number} */ n) => text.split('\n').map(line => ' '.repeat(n) + line).join('\n');
    return [
        `export function ${name}({ ${params.join(', ')} }) {`,
        `  const blocked = ${blockClickProps.join(' || ') || 'false'};`,
        ...(iconOnlyValues.length ? [`  const iconOnly = ${show} && (${iconOnlyValues.map(value => `${placement} === "${value}"`).join(' || ')});`] : []),
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
 * One rule per node the display mapping styles from a token: each mapped property is written to its CSS property, reading the
 * token's custom property. Literal sources (width, text) are not CSS and are written by the component.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
function displayRules(template) {
    const tokens = Object.values(template.tokens).flat();
    return Object.entries(template.display).map(([key, props]) => {
        const kind = targetKindOf(template, key);
        // The root lays its label and its icon slots out in a row, centred on the cross axis.
        const decls = key === 'root' ? ['  display: inline-flex;\n', '  align-items: center;\n'] : [];
        if (key === 'root' && template.outline) {
            decls.push(`  outline: ${template.outline.width}px solid var(${cssVarOf(template.id, 'outline-color')});\n`, `  outline-offset: ${template.outline.offset}px;\n`);
        }
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
function stylesheet(template, binding, variables, problems) {
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
    const blocks = displayRules(template);
    // An icon-only instance has no label padding: its icon is the whole content, and the minimum width keeps it square.
    if (iconOnlyValuesOf(template).length) blocks.push(`.${template.id}-icon-only {\n  padding-inline: 0;\n}\n`);
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
 * @returns {{ files: Record<string, string> | null, problems: Record<string, unknown>[] }}
 */
export function generateComponent(template, binding, variables, name) {
    if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) throw new Error(`"${name}" is not a component name`);
    /** @type {any[]} */
    const problems = [];
    const jsx = componentSource(template, name, problems);
    const css = stylesheet(template, binding, variables, problems);
    if (problems.length) return { files: null, problems };
    return { files: { [`${name}.jsx`]: jsx, [`${name}.css`]: css }, problems: [] };
}
