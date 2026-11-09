// Colour presets: the Color modes a template declares for its presets (a Tag, a Badge). Each preset is one base Primitives palette, named the same:
// primary, secondary, tertiary, info, danger, warning, success, neutral. A preset has four uses, each a role of roles.json that derives a Semantic alias
// to one palette step. The palettes are the base's; a new palette is added to Primitives first, then a preset may name it. Data only.

/** The presets, in the order their modes are listed: the eight base palettes. */
export const COLOR_PRESETS = ['primary', 'secondary', 'tertiary', 'info', 'danger', 'warning', 'success', 'neutral'];

/** The uses of a preset and the palette step each reads: the subtle fill, the border, the solid fill and the text. */
export const PRESET_USES = { subtle: 50, border: 200, solid: 500, text: 600 };

/** The role of one preset's use, as roles.json names it. */
export const presetRole = (preset, use) => `preset-${preset}-${use}`;

/**
 * A `tokenRoles` entry for one use of every preset: each Color mode maps to that preset's role of the use.
 * @param {keyof typeof PRESET_USES} use
 * @returns {Record<string, string>}
 */
export const presetRoleMap = use => Object.fromEntries(COLOR_PRESETS.map(preset => [preset, presetRole(preset, use)]));
