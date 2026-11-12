// The Size modes every component collection has: one shared definition for every template, in scale order. A new instance takes the
// default mode (md) until its Size is picked.

export const SIZE_MODES = ['xs', 'sm', 'md', 'lg', 'xl'];

/** The Size mode a new instance takes until its Size is picked. */
export const DEFAULT_SIZE_MODE = 'md';

/**
 * A `tokenRoles` map over the five Size modes from five pixel values (xs to xl): each step reads the shared `space-<px>` role, and `default` is the default mode's.
 * @param {number[]} values
 * @returns {Record<string, string>}
 */
export function spaceLadder(values) {
    return roleLadder(values.map(px => `space-${px}`));
}

/**
 * A `tokenRoles` map over the five Size modes from five role names (xs to xl); `default` is the default mode's.
 * @param {string[]} roles
 * @returns {Record<string, string>}
 */
export function roleLadder(roles) {
    return Object.fromEntries([...SIZE_MODES.map((mode, i) => [mode, roles[i]]), ['default', roles[SIZE_MODES.indexOf(DEFAULT_SIZE_MODE)]]]);
}
