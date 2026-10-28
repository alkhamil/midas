// A published library → a React package. The design is the source of code: every component (set) becomes a React component whose
// props come from its variants and component properties, icons become SVG components, Variables become CSS custom properties.
//
// Pure (no I/O): returns the files of the package. The server compiles `src/` to `dist/` and packs it (apps/server/src/lib/package.ts).
import { generateComponent } from './component-codegen.js';
import { iconSvg, isIconComponent } from './icon-svg.js';
import { pascalCase } from './model.js';
import { camelCase, cssVarOf, kebabCase, makeContext } from './screen.js';
import { colorTokens, tailwindPreset, tailwindTheme } from './tailwind.js';

const RESERVED = new Set(['children', 'className', 'style', 'key', 'ref', 'testId', 'id']);
const LIBRARY = 'library'; // library id and file id of the context: the components are looked up as the library's own
const isInternal = name => /^[_.]/.test(String(name).trim());
const lastSegment = name => String(name).split('/').map(s => s.trim()).filter(Boolean).pop() || String(name);
const lit = v => JSON.stringify(v);

function unique(name, taken) {
    let n = name, i = 2;
    while (taken.has(n)) n = `${name}${i++}`;
    taken.add(n);
    return n;
}

/** The code value of a design value: "With shortcuts" → "with-shortcuts". */
const valueName = v => kebabCase(String(v)) || String(v);
const YES = new Set(['yes', 'true', 'on']), NO = new Set(['no', 'false', 'off']);

/**
 * The props of a component: one per variant property (a union of its values, or a boolean for Yes/No), and one per component
 * property (text → string, boolean → boolean, instance swap → ReactNode). `def` is the design's own value.
 * @param {object} holder  the component set, or the main component
 * @param {object[]} kids  the children of `holder`
 */
export function buildPropsMap(holder, kids = []) {
    const props = [], taken = new Set(RESERVED);
    const axes = [];
    for (const v of holder.componentSet ? kids.filter(n => n.component && n.variant) : [])
        for (const [key, value] of Object.entries(v.variant || {})) {
            let a = axes.find(x => x.key === key);
            if (!a) axes.push(a = { key, values: [] });
            if (!a.values.includes(value)) a.values.push(value);
        }
    for (const a of axes) {
        const name = unique(camelCase(a.key), taken), lower = a.values.map(v => String(v).toLowerCase());
        if (a.values.length === 2 && lower.some(v => YES.has(v)) && lower.some(v => NO.has(v))) {
            const on = a.values.find(v => YES.has(String(v).toLowerCase())), off = a.values.find(v => v !== on);
            props.push({ source: 'variant', key: a.key, name, type: 'boolean', label: a.key, values: { [on]: 'true', [off]: 'false' }, def: a.values[0] === on });
        }
        else {
            const codes = new Set(), values = Object.fromEntries(a.values.map(v => [v, unique(valueName(v), codes)]));
            props.push({ source: 'variant', key: a.key, name, type: 'enum', label: a.key, values, def: values[a.values[0]] });
        }
    }
    for (const c of holder.cprops || []) {
        const name = unique(camelCase(c.name), taken);
        if (c.type === 'text') props.push({ source: 'text', key: c.id, name, type: 'string', label: c.name, def: String(c.def ?? '') });
        else if (c.type === 'boolean') props.push({ source: 'boolean', key: c.id, name, type: 'boolean', label: c.name, def: c.def !== false });
        else if (c.type === 'instance') props.push({ source: 'swap', key: c.id, name, type: 'node', label: c.name });
    }
    return { props };
}

/** `:root` and `[data-theme="…"]` blocks of the library's Variables: the first mode of a collection is the default, the others are themes. */
export function tokensCss(variables) {
    const items = (variables?.items || []).filter(i => !i.hidden && ['color', 'number', 'string'].includes(i.type));
    const collections = new Map((variables?.collections || []).map(c => [c.id, c]));
    const byId = new Map((variables?.items || []).map(i => [i.id, i]));
    const valueIn = (item, mode, depth = 0) => {
        const coll = collections.get(item.collectionId);
        const m = coll?.modes.find(x => x.name === mode) || coll?.modes[0];
        let v = m ? item.values?.[m.id] : undefined;
        v ??= Object.values(item.values || {})[0];
        if (v && typeof v === 'object' && v.alias) { const t = byId.get(v.alias); return t && depth < 20 ? valueIn(t, mode, depth + 1) : undefined; }
        return v;
    };
    const css = (item, v) => (v == null || typeof v === 'object' ? null : item.type === 'number' ? `${v}px` : item.type === 'string' && /\s/.test(String(v)) ? lit(v) : String(v));
    const block = (selector, entries) => (entries.length ? `${selector} {\n${entries.map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n}\n` : '');
    const seen = new Set(), root = [];
    for (const i of items) {
        const coll = collections.get(i.collectionId), v = css(i, valueIn(i, coll?.modes[0]?.name));
        const name = cssVarOf(i);
        if (v != null && !seen.has(name)) { seen.add(name); root.push([name, v]); }
    }
    const themes = new Map();
    for (const i of items) {
        const coll = collections.get(i.collectionId);
        for (const m of coll?.modes.slice(1) || []) {
            const v = css(i, valueIn(i, m.name)), t = kebabCase(m.name);
            if (v != null && !['off', 'on', 'none'].includes(t)) (themes.get(t) || themes.set(t, []).get(t)).push([cssVarOf(i), v]);
        }
    }
    return `/* Theme tokens of the library (Variables). The first mode of a collection is the default; the other modes switch with data-theme. */\n${block(':root', root)}${[...themes].map(([t, e]) => `\n${block(`[data-theme="${t}"]`, e)}`).join('')}`;
}

const CREATE_ICON = `import { createElement, forwardRef } from 'react';
import type { SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { size?: number | string };
type Part = { tag: 'path' | 'rect' | 'ellipse'; attrs: Record<string, string | number> };

/** An icon component from SVG parts. It draws in \`currentColor\`, so the colour follows the text colour (or \`color\` / \`style\`). */
export function createIcon(displayName: string, width: number, height: number, parts: Part[]) {
    const Icon = forwardRef<SVGSVGElement, IconProps>(({ size = 24, ...rest }, ref) =>
        createElement('svg', { ref, width: size, height: size, viewBox: \`0 0 \${width} \${height}\`, fill: 'currentColor', 'aria-hidden': true, focusable: false, ...rest },
            parts.map((p, i) => createElement(p.tag, { key: i, ...p.attrs }))));
    Icon.displayName = displayName;
    return Icon;
}
`;
const CREATE_ICON_DTS = `import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & { size?: number | string };
export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;
export declare function createIcon(displayName: string, width: number, height: number, parts: { tag: 'path' | 'rect' | 'ellipse'; attrs: Record<string, string | number> }[]): IconComponent;
`;

/**
 * What to do about a problem the generator met. The first matching rule wins; `kind` says whether the design only needs polish
 * ('design': it still becomes code) or something could not be written as code ('code').
 */
const FIXES = [
    [/does not use a Variable/, 'design', 'Bind this colour to a Variable (pick it from the colour field) so it follows the theme instead of staying a fixed hex.'],
    [/without auto layout/, 'design', 'Turn on auto layout for this frame, so its children can be written as a flex layout.'],
    [/free (Rectangle|Ellipse|Line|Image|Boolean|Vector|\w+) is not generated/, 'code', 'Turn this shape into a component (an icon goes on the Icons page) or use an image asset; a loose shape cannot be written as code.'],
    [/Main component not found/, 'code', 'The component this instance comes from is not in the library. Publish that component too (select it in the list), or detach the instance.'],
    [/not in the project's library version/, 'code', 'Select that component in the publish list so it ships along with this one, or detach the instance.'],
    [/from another library/, 'code', 'A component from another library cannot be used inside this library. Copy it into this file, or detach the instance.'],
    [/no variants/, 'code', 'Add at least one variant to the component set, or make it a plain component.'],
];
const fixFor = message => { const hit = FIXES.find(([re]) => re.test(message)); return hit ? { kind: hit[1], fix: hit[2] } : { kind: 'code', fix: 'Check this component in the design and publish again. If it looks right, report it: the generator could not handle it.' }; };

const GEN = '// Generated by Midas from the design — static markup; edit the design, not this file.\n';

/**
 * @param {{ components: { id: string, name: string, set?: boolean, hidden?: boolean, nodes: object[] }[], variables?: object }} snapshot
 *        a library version, as published
 * @param {{ packageName?: string, version?: string, libraryName?: string, onProgress?: (e: { phase: string, current?: number, total?: number, name?: string }) => void }} [opts]
 * @returns {{ files: Record<string, string>, components: object[], icons: object[], issues: object[], warnings: string[], packageName: string, version: string }}
 *          `issues`: { level, kind, component, layer?, nodeId?, message, fix } — what the design needs (kind 'design') or what could not become code (kind 'code').
 */
export function libraryPackage(snapshot, opts = {}) {
    const packageName = opts.packageName || '@midas/ui', version = opts.version || '1.0.0', libraryName = opts.libraryName || packageName;
    const issues = [], progress = opts.onProgress || (() => {});
    const addIssue = (component, level, message, layer, nodeId) => {
        const hint = fixFor(message);
        // A design tip that repeats in every variant (a layered spinner, say) is one issue that says how many places it is in.
        const same = hint.kind === 'design' && issues.find(i => i.kind === 'design' && i.component === component && i.message === message);
        if (same) { same.count = (same.count || 1) + 1; return; }
        issues.push({ level, ...hint, component, ...(layer ? { layer } : {}), ...(nodeId ? { nodeId } : {}), message });
    };
    const comps = snapshot.components.filter(c => !c.hidden);
    const nodes = comps.flatMap(c => c.nodes);

    // ---- names
    const iconComps = comps.filter(isIconComponent), uiComps = comps.filter(c => !iconComps.includes(c));
    const taken = new Set(), exportOf = new Map();
    for (const c of uiComps) exportOf.set(c.id, unique(pascalCase(lastSegment(c.name)), taken));
    const iconTaken = new Set();
    for (const c of iconComps) {
        // "Outline / Arrows / Arrow Left" → ArrowLeftIcon; the same name in another style or category gets its folder in front.
        const parts = String(c.name).split('/').map(s => s.trim()).filter(Boolean);
        let name = `${pascalCase(parts.at(-1))}Icon`;
        for (let k = 2; iconTaken.has(name) && k <= parts.length; k++) name = `${parts.slice(-k).map(pascalCase).join('')}Icon`;
        exportOf.set(c.id, unique(name, iconTaken));
    }
    const iconNames = new Set(iconComps.map(c => exportOf.get(c.id)));
    progress({ phase: 'analyze', components: uiComps.length, icons: iconComps.length });

    // ---- the context over every node of the library, and each component's props
    const kidsOf = new Map();
    for (const n of nodes) if (n.parentId) (kidsOf.get(n.parentId) || kidsOf.set(n.parentId, []).get(n.parentId)).push(n);
    const rootOf = c => c.nodes.find(n => n.id === c.id);
    const mappings = comps.map(c => ({
        componentKey: c.id, componentName: c.name, exportName: exportOf.get(c.id),
        propsMap: iconNames.has(exportOf.get(c.id)) ? { props: [] } : buildPropsMap(rootOf(c), kidsOf.get(c.id) || []),
    }));
    const ctx = makeContext({ nodes, variables: snapshot.variables, mappings, libraryId: LIBRARY, fileId: LIBRARY });
    const resolveImport = name => (iconNames.has(name) ? `../icons/${name}` : `./${name}`);

    // ---- components
    const files = {}, components = [];
    const colors = new Set(colorTokens(snapshot.variables).keys()), classes = new Set();
    const uiMappings = mappings.filter(m => !iconNames.has(m.exportName));
    uiMappings.forEach((m, i) => {
        progress({ phase: 'components', current: i + 1, total: uiMappings.length, name: m.componentName });
        let out;
        try {
            out = generateComponent({ ctx, mapping: m, types: 'inline', iconNames, resolveImport, tailwind: true, colors, classes });
        }
        catch (e) {
            addIssue(m.componentName, 'error', e.message);
            out = { source: `${GEN}import type { ReactElement } from 'react';\nexport type ${m.exportName}Props = Record<string, never>;\nexport function ${m.exportName}(): ReactElement | null {\n  return null;\n}\n`, dts: `import type { ReactElement } from 'react';\nexport type ${m.exportName}Props = Record<string, never>;\nexport declare function ${m.exportName}(): ReactElement | null;\n`, warnings: [], issues: [] };
        }
        for (const i of out.issues) if (i.severity !== 'info') addIssue(m.componentName, i.severity === 'error' ? 'error' : 'warning', i.message, i.nodeName, i.nodeId);
        files[`src/components/${m.exportName}.tsx`] = out.source;
        files[`dist/components/${m.exportName}.d.ts`] = out.dts;
        components.push({ key: m.componentKey, name: m.componentName, exportName: m.exportName, internal: isInternal(m.componentName), props: m.propsMap.props.map(({ source, key, ...p }) => p) });
    });

    // ---- icons
    const icons = [];
    iconComps.forEach((c, i) => {
        if (i % 25 === 0 || i === iconComps.length - 1) progress({ phase: 'icons', current: i + 1, total: iconComps.length, name: c.name });
        const name = exportOf.get(c.id), svg = iconSvg(c.nodes, c.id);
        for (const w of svg.warnings) addIssue(c.name, 'warning', w);
        files[`src/icons/${name}.ts`] = `${GEN}import { createIcon } from './createIcon';\n\nexport const ${name} = createIcon(${lit(name)}, ${svg.width}, ${svg.height}, ${lit(svg.parts)});\n`;
        files[`dist/icons/${name}.d.ts`] = `import type { IconComponent } from './createIcon';\nexport declare const ${name}: IconComponent;\n`;
        icons.push({ key: c.id, name: c.name, exportName: name });
    });
    const exported = components.filter(c => !c.internal);
    const compIndex = exported.map(c => `export { ${c.exportName} } from './${c.exportName}';\nexport type { ${c.exportName}Props } from './${c.exportName}';`).join('\n');
    const compDts = exported.map(c => `export * from './${c.exportName}';`).join('\n');
    const iconIndex = icons.map(i => `export { ${i.exportName} } from './${i.exportName}';`).join('\n');
    files['src/components/index.ts'] = `${GEN}${compIndex}\n`;
    files['dist/components/index.d.ts'] = `${compDts}\n`;
    files['src/icons/createIcon.ts'] = CREATE_ICON;
    files['dist/icons/createIcon.d.ts'] = CREATE_ICON_DTS;
    files['src/icons/index.ts'] = `${GEN}export { createIcon } from './createIcon';\nexport type { IconProps } from './createIcon';\n${iconIndex}\n`;
    files['dist/icons/index.d.ts'] = `export * from './createIcon';\n${icons.map(i => `export * from './${i.exportName}';`).join('\n')}\n`;
    files['src/index.ts'] = `${GEN}export * from './components';\nexport * from './icons';\n`;
    files['dist/index.d.ts'] = `export * from './components';\nexport * from './icons';\n`;

    // ---- tokens, package.json, README
    progress({ phase: 'tokens', total: (snapshot.variables?.items || []).length });
    const tokens = tokensCss(snapshot.variables);
    files['src/tokens.css'] = tokens;
    files['dist/tokens.css'] = tokens;
    // Tailwind: the stylesheet of the components is compiled from `classes` (the server does it, dist/styles.css); the theme is for a project with its own Tailwind
    const themeCss = tailwindTheme(snapshot.variables);
    files['dist/tailwind.theme.css'] = themeCss;
    files['dist/tailwind.preset.cjs'] = tailwindPreset(snapshot.variables);
    files['package.json'] = `${JSON.stringify({
        name: packageName, version, description: `${libraryName} — React components generated by Midas from the design.`, type: 'module', license: 'UNLICENSED',
        sideEffects: ['**/*.css'], main: './dist/index.js', module: './dist/index.js', types: './dist/index.d.ts',
        exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './styles.css': './dist/styles.css', './tokens.css': './dist/tokens.css', './tailwind.theme.css': './dist/tailwind.theme.css', './tailwind.preset': './dist/tailwind.preset.cjs', './package.json': './package.json' },
        files: ['dist', 'src', 'README.md'], peerDependencies: { react: '>=18', 'react-dom': '>=18' },
    }, null, 2)}\n`;
    const propLine = p => `  - \`${p.name}\` — ${p.type === 'enum' ? Object.values(p.values).map(v => `\`"${v}"\``).join(' | ') : p.type === 'node' ? 'ReactNode' : p.type}${p.def !== undefined && p.type !== 'node' ? ` (default ${lit(p.def)})` : ''}`;
    files['README.md'] = `# ${packageName}

${libraryName}: ${exported.length} components and ${icons.length} icons, generated by Midas from the design (version ${version}).

\`\`\`tsx
import '${packageName}/tokens.css';
import '${packageName}/styles.css';
import { ${exported[0]?.exportName || 'Button'} } from '${packageName}';
\`\`\`

No Tailwind is needed in your project: \`styles.css\` is already compiled (every class has the \`mds:\` prefix, so it never clashes with a Tailwind of your own).
\`tokens.css\` holds the theme tokens as CSS custom properties; set \`data-theme="dark"\` on an ancestor to switch themes.
Components are static markup drawn from the design; every one accepts \`className\`, \`style\` and \`testId\`.

### With Tailwind in your project

Import \`styles.css\` before Tailwind, so your own classes win over the components' (\`<Button className="px-6" />\`). To write \`bg-primary\`, \`text-muted-foreground\`... with the library's colours:

\`\`\`css
@import '${packageName}/styles.css';
@import 'tailwindcss';
@import '${packageName}/tokens.css';
@import '${packageName}/tailwind.theme.css';   /* Tailwind 4 */
\`\`\`

Tailwind 3: \`presets: [require('${packageName}/tailwind.preset')]\` in \`tailwind.config.js\`.

## Components

${exported.map(c => `### ${c.exportName}\n${c.props.map(propLine).join('\n') || '  _no props_'}`).join('\n\n')}

## Icons

${icons.length ? icons.map(i => `\`${i.exportName}\``).join(' · ') : '_none_'} — every icon takes \`size\` and draws in the current text colour.
`;
    const warnings = issues.filter(i => i.kind === 'code').map(i => `${i.component}: ${i.layer ? `${i.layer}: ` : ''}${i.message}`);
    return { files, components, icons, issues, warnings, packageName, version, classes: [...classes].sort(), themeCss };
}
