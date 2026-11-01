// Typography editing rules (pure). The editor window and the Design panel write through these, so the rules are tested without
// the studio: a member is a literal or an alias, a weight is a name the family has, a px line height is never a ratio, and attach
// and detach move a node between one typography variable and its own literal fields.
import { TYPOGRAPHY_MEMBERS, WEIGHT_NUMBER } from './typography.js';

/** The style a new typography variable holds in every mode. */
export const DEFAULT_TYPOGRAPHY = { fontFamily: 'Inter', fontSize: 14, fontWeight: 'Regular', lineHeight: 20, letterSpacing: 0 };

/** The text fields a typography variable drives on a node. */
export const TYPOGRAPHY_NODE_FIELDS = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];

/** A line height below this is a ratio (1.5 of the size), not px. Same ceiling as the resolver. */
const RATIO_CEILING = 4;

/** Whether a stored member is an alias to a variable rather than a literal. */
export const isAliasMember = value => !!value && typeof value === 'object' && 'alias' in value;

/**
 * A member set to a literal or to an alias. A literal is checked: a family is text, a size and spacing are numbers, a weight is a
 * name the CSS knows, and a line height is px. Returns { value } or { error } with the message the editor shows.
 * @param {string} member one of the typography members
 * @param {string | number} literal
 * @returns {{ value: string | number } | { error: string }}
 */
export function literalFor(member, literal) {
    const type = TYPOGRAPHY_MEMBERS[member];
    if (type === undefined) return { error: `${member} is not a typography member` };
    if (member === 'fontWeight') {
        return Object.hasOwn(WEIGHT_NUMBER, literal) ? { value: literal } : { error: `"${literal}" is not a weight name` };
    }
    if (type === 'string') {
        const text = String(literal ?? '').trim();
        return text === '' ? { error: 'A font family needs a name' } : { value: text };
    }
    const number = typeof literal === 'number' ? literal : Number(String(literal).trim());
    if (!Number.isFinite(number)) return { error: `${member} needs a number` };
    if (member === 'fontSize' && number <= 0) return { error: 'A font size is above zero' };
    if (member === 'lineHeight') {
        if (number <= 0) return { error: 'A line height is above zero' };
        if (number < RATIO_CEILING) return { error: `A line height of ${number} is a ratio. Enter pixels.` };
    }
    return { value: number };
}

/**
 * A style with one member changed: a literal (checked) or an alias to a variable of the member's type. The rest is kept.
 * @param {Record<string, any>} style the stored value of one mode (members literal or alias)
 * @param {string} member
 * @param {{ literal: string | number } | { alias: string }} next
 * @returns {{ style: Record<string, any> } | { error: string }}
 */
export function setMember(style, member, next) {
    if (!(member in TYPOGRAPHY_MEMBERS)) return { error: `${member} is not a typography member` };
    if (next && 'alias' in next) return { style: { ...style, [member]: { alias: next.alias } } };
    const checked = literalFor(member, next?.literal);
    if ('error' in checked) return { error: checked.error };
    return { style: { ...style, [member]: checked.value } };
}

/** A member back to a literal: the literal it resolves to in the mode (the detach of one field). */
export function unaliasMember(style, member, resolved) {
    if (!isAliasMember(style[member])) return { style };
    if (resolved?.[member] === undefined) return { error: `${member} has no value to keep` };
    return { style: { ...style, [member]: resolved[member] } };
}

/**
 * The weight names a family has, from its numeric weights (the font list gives numbers), in the typography names. A weight with no
 * name is left out; the list is sorted from the thinnest.
 * @param {number[]} numbers
 * @returns {string[]}
 */
export function weightNamesOf(numbers) {
    const byNumber = Object.fromEntries(Object.entries(WEIGHT_NUMBER).map(([name, n]) => [n, name]));
    return [...new Set(numbers.map(n => byNumber[n]).filter(Boolean))].sort((a, b) => WEIGHT_NUMBER[a] - WEIGHT_NUMBER[b]);
}

/**
 * The weight a style keeps when its family changes. If the family has the name, it is kept. Otherwise the nearest name the family
 * has is used and a note says so; a family with no list keeps the name.
 * @param {string} family the family the style is set to
 * @param {string} weight the current weight name
 * @param {string[] | null} available the names the family has, or null when its list is not known
 * @returns {{ weight: string, note: string | null }}
 */
export function weightForFamily(family, weight, available) {
    if (!available || available.length === 0 || available.includes(weight)) return { weight, note: null };
    const target = WEIGHT_NUMBER[weight] ?? WEIGHT_NUMBER.Regular;
    const nearest = [...available].sort((a, b) => Math.abs(WEIGHT_NUMBER[a] - target) - Math.abs(WEIGHT_NUMBER[b] - target))[0];
    return { weight: nearest, note: `${family} has no ${weight}; the weight is ${nearest}.` };
}

/**
 * The compact summary a table cell shows: "Inter 14/20 · Regular". A member that is an alias shows the variable's name in place of its
 * value (`names` gives the name of each aliased member).
 * @param {Record<string, any>} resolved the members as they resolve in the mode
 * @param {Record<string, string>} [names] the variable name of each aliased member
 * @returns {string}
 */
export function summaryOf(resolved, names = {}) {
    const shown = member => (names[member] ? `{${names[member]}}` : String(resolved?.[member] ?? '?'));
    return `${shown('fontFamily')} ${shown('fontSize')}/${shown('lineHeight')} · ${shown('fontWeight')}`;
}

/**
 * The node fields a resolved style writes when it is detached: the family, size and weight name as a CSS number, the line height as
 * the canvas keeps it (a ratio of the size), and the letter spacing.
 * @param {Record<string, string | number>} style a resolved style
 * @returns {Record<string, string | number>}
 */
export function nodeFieldsOf(style) {
    return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: WEIGHT_NUMBER[style.fontWeight],
        lineHeight: style.lineHeight / style.fontSize,
        letterSpacing: style.letterSpacing,
    };
}

/**
 * The variables of a node after attach: the typography binding is set and the per-field text bindings are cleared, since the
 * style now drives those fields.
 * @param {Record<string, string>} vars the node's variable bindings
 * @param {string} itemId the typography variable
 * @returns {Record<string, string>}
 */
export function attachedVars(vars, itemId) {
    const kept = Object.fromEntries(Object.entries(vars ?? {}).filter(([key]) => !TYPOGRAPHY_NODE_FIELDS.includes(key)));
    return { ...kept, typography: itemId };
}

/**
 * The variables of a node after detach: the binding is removed, and the style's resolved values stay on the node as literals.
 * @param {Record<string, string>} vars
 * @returns {Record<string, string>}
 */
export function detachedVars(vars) {
    const { typography, ...rest } = vars ?? {};
    return rest;
}
