// Icon slot bindings (pure). A managed icon slot is a frame that holds the icon component the instance chose. The slot's width and
// height follow the size variable, and the icon's colour follows the foreground variable of the variant (the disabled one while the
// instance is disabled). The engine writes these bindings with each sync of the instance; nothing here writes to a document.

import { variableNameOf } from './tokens.js';
import { dimensionOfGroup } from './validate-schema.js';

/**
 * The variables an icon slot follows, from the template's icon tokens: for each of colour, disabled colour and size, the variable
 * name, and the variable prop (dimension) whose collection holds it.
 * @param {import('../templates/schema.js').TemplateSchema} template
 * @returns {Record<'colour' | 'disabledColour' | 'size', { name: string, dimension: string | null }>}
 */
export function iconSlotTargets(template) {
    const dimensionOf = token => {
        const group = Object.keys(template.tokens).find(g => template.tokens[g].includes(token));
        return group ? dimensionOfGroup(group, template.props) : null;
    };
    const { tokens } = template.icon;
    return Object.fromEntries(['colour', 'disabledColour', 'size'].map(role => [role, { name: variableNameOf(template, tokens[role]), dimension: dimensionOf(tokens[role]) }]));
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
