// Icon slot bindings (pure). A managed icon slot is a frame that holds the icon component the instance chose. The slot's width and
// height follow the size variable, and the icon's colour follows the foreground variable of the variant (the disabled one while the
// instance is disabled). The engine writes these bindings with each sync of the instance; nothing here writes to a document.

import { variableNameOf } from './tokens.js';

/**
 * The icon naming rule of a template: the name prefix its icon picker matches, or null when it declares none
 * (an explicitly flagged component is still an icon).
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {{ prefix: string } | null}
 */
export function iconRuleOf(template) {
    const match = template?.iconMatch;
    return match && typeof match.prefix === 'string' && match.prefix !== '' ? { prefix: match.prefix } : null;
}

/**
 * Whether a component is offered as an icon: flagged explicitly, or its name matches the template's icon naming rule.
 * Plain layers are never icons.
 * @param {{ component?: boolean, componentSet?: boolean, isIcon?: boolean, name?: string } | null | undefined} node
 * @param {{ prefix: string } | null} rule
 * @returns {boolean}
 */
export function isIconCandidate(node, rule) {
    if (!node || (node.component !== true && node.componentSet !== true)) return false;
    if (node.isIcon === true) return true;
    return !!rule && typeof node.name === 'string' && node.name.startsWith(rule.prefix);
}
import { dimensionOfGroup } from './validate-schema.js';
import { iconDefsOf, slotDefsOf } from './anatomy.js';

/**
 * The variables one managed slot follows, from its def's icon tokens: for each of colour, disabled colour and size, the variable
 * name, and the variable prop (dimension) whose collection holds it.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @param {string} slot the managed slot
 * @returns {Record<'colour' | 'disabledColour' | 'size', { name: string, dimension: string | null }>}
 */
export function iconSlotTargets(template, slot) {
    const def = slotDefsOf(template, slot)[0] ?? iconDefsOf(template)[0];
    const dimensionOf = token => {
        const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(token));
        return group ? dimensionOfGroup(group, template.props) : null;
    };
    const { tokens } = def;
    return Object.fromEntries(['colour', 'disabledColour', 'size'].map(role => [role, { name: variableNameOf(template, tokens[role]), dimension: dimensionOf(tokens[role]) }]));
}

/**
 * The collections one template's icon slots need, as { prop, dimension, collection, variables, role }: for each icon def
 * whose show prop declares `requires`, the required dimensions with the icon variables in them (from the def's tokens).
 * Driven entirely by schema data; no component names.
 * @param {import('../templates/schema.js').TemplateSchema} template
 */
export function iconNeedsOf(template) {
    const out = [];
    for (const def of iconDefsOf(template)) {
        const requires = template.props[def.show]?.requires;
        if (!Array.isArray(requires)) continue;
        for (const dimension of requires) {
            const target = template.props[dimension];
            if (!target || target.source !== 'variable') continue;
            const variables = [];
            let role = null;
            for (const [r, token] of Object.entries(def.tokens ?? {})) {
                const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(token));
                if (group && dimensionOfGroup(group, template.props) === dimension) { variables.push(variableNameOf(template, token)); role ??= r; }
            }
            if (!variables.length) continue;
            out.push({ prop: def.show, dimension, collection: target.collection, variables, role });
        }
    }
    return out;
}

/**
 * The text that says a missing icon variable: its name, the collection it was searched in and the mode the instance has for it.
 * @param {{ name: string, collectionName: string, modeName: string }} input
 * @returns {string}
 */
export function missingIconVariable({ name, collectionName, modeName }) {
    return `${name} in the ${collectionName} collection (mode ${modeName})`;
}

/**
 * Whether a vars key is one the icon slot owns: a fill by index, a stroke, or the slot's width and height. The engine derives these
 * on every sync, so the copy from the icon component never overwrites them.
 * @param {string} key
 */
export function isIconSlotVarKey(key) {
    return /^(fills\.\d+|stroke|w|h)$/.test(key);
}

/**
 * The bindings an icon slot's layers carry. `fg`, `fgDisabled` and `size` are the variable ids (null when the variable is missing).
 * A layer's visible fills bind by index to the colour; a layer with no fill but a stroke binds its stroke. A missing variable is listed
 * in `missing` (by variable name, from `names`) and nothing is bound in its place (never the plain colour while disabled).
 * @param {{
 *   fg: string | null, fgDisabled: string | null, size: string | null, disabled: boolean,
 *   names: { colour: string, disabledColour: string, size: string },
 *   layers: { id: string, fillIndexes: number[], stroke: boolean }[]
 * }} input
 * @returns {{ slot: Record<string, string>, layers: { id: string, vars: Record<string, string> }[], missing: string[] }}
 */
export function iconSlotBindings({ fg, fgDisabled, size, disabled, names, layers }) {
    const missing = [];
    const colour = disabled ? fgDisabled : fg;
    if (disabled && !fgDisabled) missing.push(names.disabledColour);
    else if (!disabled && !fg) missing.push(names.colour);
    if (!size) missing.push(names.size);
    const slot = size ? { w: size, h: size } : {};
    return {
        slot,
        layers: layers.map(layer => {
            /** @type {Record<string, string>} */
            const vars = {};
            if (colour) {
                for (const i of layer.fillIndexes) vars[`fills.${i}`] = colour;
                if (layer.fillIndexes.length === 0 && layer.stroke) vars.stroke = colour;
            }
            return { id: layer.id, vars };
        }),
        missing,
    };
}
