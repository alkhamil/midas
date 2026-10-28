// Tailwind for a generated library package.
//
// The components are written with Tailwind classes. Every class carries a prefix (`mds:flex`), so the compiled stylesheet that ships in
// the package (the server runs Tailwind when it builds the package) never clashes with the Tailwind of the project that installs it,
// and that project does not need Tailwind at all. The theme (`tailwindTheme`) maps the library's colour tokens to Tailwind colours, so a
// project that does use Tailwind can write `bg-primary` and get the library's colour; it is the same theme the package is compiled with.
import { cssVarOf } from './screen.js';

export const TAILWIND_PREFIX = 'mds';

// Static utilities that need no theme value. Anything else is written as an arbitrary property: `[gap:12px]`.
const STATIC = {
    display: { flex: 'flex', 'inline-flex': 'inline-flex' },
    flexDirection: { row: 'flex-row', column: 'flex-col' },
    flexWrap: { nowrap: 'flex-nowrap', wrap: 'flex-wrap' },
    justifyContent: { 'flex-start': 'justify-start', 'flex-end': 'justify-end', center: 'justify-center', 'space-between': 'justify-between' },
    alignItems: { 'flex-start': 'items-start', 'flex-end': 'items-end', center: 'items-center', stretch: 'items-stretch' },
    alignSelf: { stretch: 'self-stretch' },
    flexShrink: { 0: 'shrink-0' },
    boxSizing: { 'border-box': 'box-border' },
    position: { relative: 'relative', absolute: 'absolute' },
    whiteSpace: { nowrap: 'whitespace-nowrap', 'pre-wrap': 'whitespace-pre-wrap' },
    textAlign: { left: 'text-left', right: 'text-right', center: 'text-center' },
    overflow: { hidden: 'overflow-hidden' },
};
// A colour property whose value is a token of the theme: `background: var(--theme-primary, #123)` → `bg-primary`.
const COLOR_UTILITY = { background: 'bg', backgroundColor: 'bg', color: 'text', borderColor: 'border' };
const kebab = s => s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);

/** `--theme-primary` of `var(--theme-primary, #123)`: the token a colour value is bound to. */
const tokenOf = value => /^var\(\s*--theme-([a-z0-9-]+)\s*(?:,[^)]*)?\)$/.exec(String(value))?.[1] ?? null;

/** The value as it goes inside `[prop:value]`: no spaces (an underscore stands for one) and no quotes. */
const arbitrary = value => String(value).trim().replace(/['"]/g, '').replace(/\s+/g, '_');

/**
 * The Tailwind classes of one style object (what the generator would have written as `style={…}`).
 * @param {Record<string, string | number | undefined | null>} style
 * @param {{ colors?: Set<string> }} [opts]  `colors`: names of the theme's colour tokens (`primary`, `border-strong`)
 * @returns {string[]} class names, with the prefix
 */
export function tailwindClasses(style, { colors = new Set() } = {}) {
    const out = [];
    for (const [key, raw] of Object.entries(style || {})) {
        if (raw === undefined || raw === null || raw === '') continue;
        const value = String(raw);
        const utility = COLOR_UTILITY[key];
        const token = utility ? tokenOf(value) : null;
        if (token && colors.has(token)) out.push(`${utility}-${token}`);
        else if (STATIC[key]?.[value]) out.push(STATIC[key][value]);
        else out.push(`[${kebab(key)}:${arbitrary(value)}]`);
    }
    return out.map(c => `${TAILWIND_PREFIX}:${c}`);
}

/** The colour tokens of the library: the names Tailwind gets as colours (`--theme-primary` → `primary`). */
export function colorTokens(variables) {
    const colors = new Map();
    for (const i of variables?.items || []) {
        if (i.hidden || i.type !== 'color') continue;
        const v = cssVarOf(i);
        if (v.startsWith('--theme-')) colors.set(v.slice('--theme-'.length), v);
    }
    return colors;
}

/**
 * The Tailwind theme of the library as CSS (Tailwind v4 `@theme`): its colour tokens, as `--color-<name>: var(--theme-<name>)`.
 * Used to compile the package, and shipped for a project that has its own Tailwind (`@import '<pkg>/tailwind.theme.css'`).
 * @param {{ reset?: boolean }} [opts]  `reset`: drop Tailwind's own colours, so only the library's tokens are available
 */
export function tailwindTheme(variables, { reset = true } = {}) {
    const lines = [...colorTokens(variables)].map(([name, v]) => `  --color-${name}: var(${v});`);
    return `/* The library's colour tokens as Tailwind colours (bg-primary, text-muted-foreground, border-border). Needs tokens.css. */\n@theme {\n${reset ? '  --color-*: initial;\n' : ''}${lines.join('\n')}\n}\n`;
}

/** The Tailwind v3 preset with the same colours, for a project still on Tailwind 3: `presets: [require('<pkg>/tailwind.preset.cjs')]`. */
export function tailwindPreset(variables) {
    const colors = Object.fromEntries([...colorTokens(variables)].map(([name, v]) => [name, `var(${v})`]));
    return `// The library's colour tokens as Tailwind colours (bg-primary, text-muted-foreground). Needs tokens.css.\nmodule.exports = {\n  theme: { colors: ${JSON.stringify(colors, null, 4).replace(/\n/g, '\n  ')} },\n};\n`;
}
