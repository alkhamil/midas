// Icon slot bindings (pure). A managed icon slot is a frame that holds the icon component the instance chose. The slot's width and
// height follow the size variable, and the icon's colour follows the foreground variable of the variant (the disabled one while the
// instance is disabled). The engine writes these bindings with each sync of the instance; nothing here writes to a document.

/** The variable the icon colour follows, and the one used while the instance is disabled. */
export const ICON_COLOUR_VARIABLE = 'button/fg';
export const ICON_DISABLED_COLOUR_VARIABLE = 'button/fg-disabled';
export const ICON_SIZE_VARIABLE = 'button/icon-size';

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
 * in `missing` and nothing is bound in its place (never the plain colour while disabled).
 * @param {{
 *   fg: string | null, fgDisabled: string | null, size: string | null, disabled: boolean,
 *   layers: { id: string, fillIndexes: number[], stroke: boolean }[]
 * }} input
 * @returns {{ slot: Record<string, string>, layers: { id: string, vars: Record<string, string> }[], missing: string[] }}
 */
export function iconSlotBindings({ fg, fgDisabled, size, disabled, layers }) {
    const missing = [];
    const colour = disabled ? fgDisabled : fg;
    if (disabled && !fgDisabled) missing.push(ICON_DISABLED_COLOUR_VARIABLE);
    else if (!disabled && !fg) missing.push(ICON_COLOUR_VARIABLE);
    if (!size) missing.push(ICON_SIZE_VARIABLE);
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
