// Colour presets: the Color modes a template declares for its presets (a Tag, a Badge). A preset reads the palette its name maps to (an existing
// base palette is reused; a palette the base does not hold yet is named, and Auto Fix reports its roles as needs value). Each preset has four uses,
// each a role of roles.json that aliases one step of the palette through a Semantic item. Data only: the engine resolves the roles.

/** The presets, in the order their modes are listed. */
export const COLOR_PRESETS = ['default', 'primary', 'success', 'warning', 'danger', 'red', 'orange', 'gold', 'green', 'cyan', 'blue', 'purple'];

/** The palette each preset reads: an existing base palette, or the name of one the base does not hold yet (orange, purple). */
export const PRESET_PALETTE = {
    default: 'neutral', primary: 'primary', success: 'success', warning: 'warning', danger: 'danger',
    red: 'danger', orange: 'orange', gold: 'warning', green: 'success', cyan: 'tertiary', blue: 'info', purple: 'purple',
};

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
