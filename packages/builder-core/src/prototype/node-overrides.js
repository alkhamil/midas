// What a designer set on an instance's own layers, drawn in Play (pure). A template's stylesheet draws every mapped property from its token; the canvas node is
// the source of truth, so a value the node holds that the token does not give is drawn on the element itself. The rule is the same for every template and every
// property the display mapping names (fill, radius, padding, gap, text colour, typography):
//   - the property is bound to a variable (any collection): Play resolves that variable in the node's own modes;
//   - it is unbound: Play draws the node's raw value (px, hex).
// Either result is drawn inline only when it differs from what the stylesheet already gives, so a layer that follows its token adds nothing.
import { VARIABLE_KEYS, targetKindOf } from '../behavior-engine/display.js';
import { cssVarOf, splitColor, withOpacity } from '../behavior-engine/tokens.js';
import { variableValue } from '../behavior-engine/variable-value.js';
import { typographyCss, typographyOf } from '../behavior-engine/typography.js';
import { displayFills, topColorOf, topOpacityOf } from '../geometry/fills.js';

/** The colour a box's first fill draws, with its opacity: a solid fill only (a gradient or a picture is the fill panel's, drawn elsewhere). */
function boxColorOf(n) {
    const [first] = displayFills(n).filter(f => f.visible !== false);
    if (!first || first.type !== 'solid' || !first.color || first.color === 'none') return undefined;
    return withOpacity(first.color, (first.opacity ?? 1) * 100) ?? first.color;
}

/** The colour of a box's stroke, with its opacity; undefined when it has none. */
function strokeColorOf(n) {
    if (!n.stroke || n.stroke === 'none' || !(n.strokeWidth > 0)) return undefined;
    return withOpacity(n.stroke, (n.strokeOpacity ?? 1) * 100) ?? n.stroke;
}

/** The colour a text layer draws. */
function textColorOf(n) {
    const color = topColorOf(n);
    if (color === 'none') return undefined;
    return withOpacity(color, topOpacityOf(n) * 100) ?? color;
}

const px = v => `${v}px`;
const sideOf = (n, side) => n[side] ?? n.padding;

/**
 * The properties compared per node kind: the display property, the CSS it writes (an object: one value per CSS property), the raw reader of an unbound node, and
 * how the bound variable's value becomes CSS. A `read` returns undefined when the node holds nothing for it.
 * @type {Record<string, Record<string, { read: (n: any) => Record<string, string> | undefined, bound: (value: unknown) => Record<string, string> | undefined, tokenKind: 'color' | 'length' }>>}
 */
const PROPS = {
    frame: {
        fill: { tokenKind: 'color', read: n => { const c = boxColorOf(n); return c === undefined ? undefined : { backgroundColor: c }; }, bound: v => (typeof v === 'string' ? { backgroundColor: v } : undefined) },
        stroke: { tokenKind: 'color', read: n => { const c = strokeColorOf(n); return c === undefined ? undefined : { borderColor: c }; }, bound: v => (typeof v === 'string' ? { borderColor: v } : undefined) },
        radius: { tokenKind: 'length', read: n => (typeof n.radius === 'number' ? { borderRadius: px(n.radius) } : undefined), bound: v => (typeof v === 'number' ? { borderRadius: px(v) } : undefined) },
        paddingX: { tokenKind: 'length', read: n => { const l = sideOf(n, 'padL'), r = sideOf(n, 'padR'); return typeof l === 'number' && typeof r === 'number' ? { paddingLeft: px(l), paddingRight: px(r) } : undefined; }, bound: v => (typeof v === 'number' ? { paddingLeft: px(v), paddingRight: px(v) } : undefined) },
        paddingY: { tokenKind: 'length', read: n => { const t = sideOf(n, 'padT'), b = sideOf(n, 'padB'); return typeof t === 'number' && typeof b === 'number' ? { paddingTop: px(t), paddingBottom: px(b) } : undefined; }, bound: v => (typeof v === 'number' ? { paddingTop: px(v), paddingBottom: px(v) } : undefined) },
        gap: { tokenKind: 'length', read: n => (typeof n.gap === 'number' ? { gap: px(n.gap) } : undefined), bound: v => (typeof v === 'number' ? { gap: px(v) } : undefined) },
    },
    text: {
        fill: { tokenKind: 'color', read: n => { const c = textColorOf(n); return c === undefined ? undefined : { color: c }; }, bound: v => (typeof v === 'string' ? { color: v } : undefined) },
    },
};

/** Whether two CSS values are the same: colours by their rgb and alpha, everything else as text. */
function same(a, b) {
    if (a === b) return true;
    const x = splitColor(String(a)), y = splitColor(String(b));
    return !!x && !!y && x.rgb === y.rgb && x.alpha === y.alpha;
}

/** The font size, weight, line height and spacing a text layer holds, as the members the typography token writes (the family is compared by its first name). */
function nodeTypography(n) {
    if (typeof n.fontSize !== 'number') return undefined;
    const lineHeight = typeof n.lineHeight === 'number' ? (n.lineHeight < 4 ? n.lineHeight * n.fontSize : n.lineHeight) : undefined;
    return { 'font-family': n.fontFamily, 'font-size': px(n.fontSize), 'font-weight': n.fontWeight === undefined ? undefined : String(n.fontWeight), 'line-height': lineHeight === undefined ? undefined : px(+lineHeight.toFixed(3)), 'letter-spacing': px(n.letterSpacing ?? 0) };
}

const CAMEL = { 'font-family': 'fontFamily', 'font-size': 'fontSize', 'font-weight': 'fontWeight', 'line-height': 'lineHeight', 'letter-spacing': 'letterSpacing' };
const firstFamily = f => String(f ?? '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();

/**
 * The inline style of one layer of an instance: what it holds that the template's token for it does not give.
 * @param {{ template: any, key: string, node: any, tokenVars: Record<string, string>, variables: { collections?: any[], items?: any[] }, modeOf: (collection: any) => string | null }} args
 * `tokenVars` are the custom properties the stylesheet gives this instance (previewOf's vars); `modeOf` is the mode a collection is read in for this node.
 * @returns {Record<string, string>}
 */
export function overrideStyleOf({ template, key, node, tokenVars, variables, modeOf }) {
    const kind = targetKindOf(template, key);
    const mapped = template.display?.[key];
    const out = {};
    if (!mapped || (kind !== 'frame' && kind !== 'text')) return out;
    const items = variables?.items ?? [];
    const readMode = collectionId => modeOf((variables?.collections ?? []).find(c => c.id === collectionId)) ?? undefined;
    const boundItem = prop => {
        for (const varKey of VARIABLE_KEYS[prop] ?? []) {
            const item = node.vars?.[varKey] != null ? items.find(i => i.id === node.vars[varKey]) : undefined;
            if (item) return item;
        }
        return undefined;
    };
    for (const [prop, token] of Object.entries(mapped)) {
        const spec = PROPS[kind]?.[prop];
        const gives = tokenVars[cssVarOf(template.id, token)];
        if (spec) {
            const item = boundItem(prop);
            // Bound: the variable's value in the node's modes. Unbound: the node's own value.
            const wanted = item ? spec.bound(variableValue(variables, item, c => readMode(c.id))) : spec.read(node);
            if (!wanted) continue;
            // The token gives a single value; a pair of sides (padding) is the same value on both.
            if (gives !== undefined && Object.values(wanted).every(v => same(v, gives))) continue;
            Object.assign(out, wanted);
            continue;
        }
        if (prop === 'typography' && kind === 'text') {
            const item = boundItem('typography');
            const style = item ? typographyOf(variables, item, c => readMode(c.id)).style : null;
            const wanted = item ? (style ? typographyCss(style) : undefined) : nodeTypography(node);
            if (!wanted) continue;
            const base = cssVarOf(template.id, token);
            for (const [member, value] of Object.entries(wanted)) {
                if (value === undefined) continue;
                const given = tokenVars[`${base}-${member}`];
                const equal = given !== undefined && (member === 'font-family' ? firstFamily(given) === firstFamily(value) : same(value, given));
                if (!equal) out[CAMEL[member]] = member === 'line-height' && !String(value).endsWith('px') ? String(value) : value;
            }
        }
    }
    return out;
}
