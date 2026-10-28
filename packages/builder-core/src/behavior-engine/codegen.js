// Code generator (stage 8). Pure: a template, its master's binding, the document's variables and a component name in; a React
// component (JSX) and its stylesheet out. Both come from the schema and the same resolver the preview uses, so the same inputs
// give the same text. If any token is unresolved for any mode, nothing is written: the result has no files and lists the reasons.
import { previewOf } from './preview.js';
import { variableProps } from './registry.js';
import { SLOT_OF_PLACEMENT } from './anatomy.js';

/** The DOM handler each schema event is written to. */
const DOM_EVENT = { onClick: 'onClick', onHover: 'onMouseEnter', onFocus: 'onFocus', onBlur: 'onBlur' };
/** The CSS pseudo-class each state is written as. Only these states get a stylesheet block. */
const PSEUDO = { hover: ':hover', active: ':active', disabled: ':disabled' };
/** The placement each managed slot shows for: `iconStart` -> `start`. */
const PLACEMENT_OF_SLOT = Object.fromEntries(Object.entries(SLOT_OF_PLACEMENT).map(([placement, slot]) => [slot, placement]));

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
    for (const slot of template.anatomy) {
        if (slot.kind === 'text') {
            if (!template.props[slot.id]) problems.push({ slot: slot.id, reason: 'no-prop' });
            children.push(`<span className="${template.id}-${slot.id}">{${slot.id}}</span>`);
        }
        else if (slot.managed && PLACEMENT_OF_SLOT[slot.id]) {
            for (const prop of ['hasIcon', 'iconPlacement', 'icon']) if (!template.props[prop]) problems.push({ slot: slot.id, prop, reason: 'no-prop' });
            children.push(`{hasIcon && iconPlacement === "${PLACEMENT_OF_SLOT[slot.id]}" && <span className="${template.id}-${slot.id}">{icon}</span>}`);
        }
        else problems.push({ slot: slot.id, reason: 'unsupported-slot' });
    }
    const dims = variableProps(template).map(([prop]) => prop);
    const attrs = [
        'type="button"',
        `className="${template.id}"`,
        ...dims.map(dim => `data-${dim}={${dim}}`),
        'disabled={disabled}',
        ...(template.props.fullWidth ? ['style={fullWidth ? { width: "100%" } : undefined}'] : []),
        ...template.events.map(event => `${DOM_EVENT[event.name]}={${event.name === 'onClick' ? 'blocked ? undefined : onClick' : event.name}}`),
    ];
    const indent = (/** @type {string} */ text, /** @type {number} */ n) => text.split('\n').map(line => ' '.repeat(n) + line).join('\n');
    return [
        `export function ${name}({ ${params.join(', ')} }) {`,
        '  const blocked = disabled || loading;',
        '  return (',
        '    <button',
        ...attrs.map(attr => `      ${attr}`),
        '    >',
        ...children.map(child => indent(child, 6)),
        '    </button>',
        '  );',
        '}',
        '',
    ].join('\n');
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
    const blocks = [];
    for (const combo of combos) {
        const selector = `.${template.id}${dims.map(dim => `[data-${dim}="${combo[dim]}"]`).join('')}`;
        const base = previewOf(template, binding, combo, variables, 'default');
        for (const u of base.unresolved) problems.push({ ...u, ...combo });
        if (Object.keys(base.vars).length) blocks.push(`${selector} {\n${declarations(base.vars)}}\n`);
        for (const [state, pseudo] of Object.entries(PSEUDO)) {
            if (!template.states.includes(state)) continue;
            const changed = previewOf(template, binding, combo, variables, state).vars;
            const delta = Object.fromEntries(Object.entries(changed).filter(([name, value]) => base.vars[name] !== value));
            if (Object.keys(delta).length) blocks.push(`${selector}${pseudo} {\n${declarations(delta)}}\n`);
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
