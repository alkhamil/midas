// Typography variables (pure). A typography value is one composite per mode: fontFamily, fontSize, fontWeight, lineHeight and
// letterSpacing, each a literal or an alias to a scalar variable of its type. The whole value may alias another typography
// variable. Colour is not part of it. lineHeight is px only: a ratio is a problem, never a value.
import { variableValue, valueInMode } from './variable-value.js';

/** The members of a typography value, and the variable type each takes. The weight is a name the font family has ("SemiBold"). */
export const TYPOGRAPHY_MEMBERS = { fontFamily: 'string', fontSize: 'number', fontWeight: 'string', lineHeight: 'number', letterSpacing: 'number' };

/** The CSS number of each weight name. A name not here is refused: the CSS has no number for it. */
export const WEIGHT_NUMBER = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };

/** A px line height is at least this; below it the value is a ratio (1.5, say) and is refused. */
const RATIO_CEILING = 4;

/**
 * Follows a typography variable to its resolved style in the modes it is read in. A whole-style alias follows its target; a member
 * alias follows a scalar variable of the member's type. `style` is null when a member is missing or the whole value cannot be
 * reached; `problems` says why (never a guessed value).
 * @param {{ collections: any[], items: any[] } | undefined} variables
 * @param {any} item a typography variable
 * @param {(collection: any) => string | undefined} modeOf the mode a collection is read in
 * @param {number} [depth]
 * @returns {{ style: Record<string, string | number> | null, problems: string[] }}
 */
export function typographyOf(variables, item, modeOf, depth = 0) {
    if (!variables || item?.type !== 'typography') return { style: null, problems: ['not a typography variable'] };
    if (depth > 20) return { style: null, problems: ['alias cycle'] };
    const raw = valueInMode(variables, item, modeOf);
    if (raw === undefined) return { style: null, problems: ['no value in this mode'] };
    if (raw && typeof raw === 'object' && 'alias' in raw) {
        const target = variables.items.find(i => i.id === raw.alias);
        if (!target || target.type !== 'typography') return { style: null, problems: ['style alias is missing or not typography'] };
        return typographyOf(variables, target, modeOf, depth + 1);
    }
    /** @type {Record<string, string | number>} */
    const style = {};
    const problems = [];
    for (const [member, type] of Object.entries(TYPOGRAPHY_MEMBERS)) {
        let value = raw?.[member];
        if (value && typeof value === 'object' && 'alias' in value) {
            const target = variables.items.find(i => i.id === value.alias);
            if (!target || target.type !== type) { problems.push(`${member} alias is missing or not a ${type}`); continue; }
            value = variableValue(variables, target, modeOf, depth + 1);
        }
        if (member === 'fontWeight' && !(value in WEIGHT_NUMBER)) { problems.push(`fontWeight "${value}" is not a known weight`); continue; }
        if (type === 'string' ? typeof value !== 'string' : typeof value !== 'number' || !Number.isFinite(value)) {
            problems.push(`${member} has no ${type} value`);
            continue;
        }
        if (member === 'lineHeight' && value > 0 && value < RATIO_CEILING) { problems.push('lineHeight is a ratio; it must be px'); continue; }
        style[member] = value;
    }
    return problems.length ? { style: null, problems } : { style, problems };
}

/**
 * The CSS declarations of a resolved style: font-family, font-size, font-weight, line-height and letter-spacing, lengths in px.
 * @param {Record<string, string | number>} style
 * @returns {Record<string, string>}
 */
export function typographyCss(style) {
    return {
        'font-family': String(style.fontFamily),
        'font-size': `${style.fontSize}px`,
        'font-weight': String(WEIGHT_NUMBER[style.fontWeight]),
        'line-height': `${style.lineHeight}px`,
        'letter-spacing': `${style.letterSpacing}px`,
    };
}
