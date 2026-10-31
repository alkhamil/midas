// Component code from the design: a React component for any component (set) of a library, written from its nodes.
//
// The visual side comes straight from the design: every variant is rendered from its node tree (auto layout → flex, fills and
// strokes → styles that use the library's theme tokens, text bound to a text property → a prop, a boolean property → show/hide,
// nested instances → the other generated components, icons → the generated icon components). The result is static markup;
// interactive behaviour is not in a design, so it comes from the standard kit (an `implementation` of "standard:<Name>").
import { iconSvg } from './icon-svg.js';
import { camelCase, cssVarOf, screenTree } from './screen.js';
import { tailwindClasses } from './tailwind.js';

const q = s => JSON.stringify(s);
const indent = n => '  '.repeat(n);
const clean = style => Object.fromEntries(Object.entries(style || {}).filter(([, v]) => v !== undefined && v !== null));

/**
 * @param {object} opts
 * @param {object} opts.ctx            makeContext() over the library's component nodes (+ variables), self library
 * @param {{ componentKey: string, componentName: string, exportName: string, propsMap: { props: object[] } }} opts.mapping
 * @param {'generated'|'inline'} [opts.types]  `generated`: props type and defaults from ../../generated/props; `inline`: declared here
 * @param {(key: string) => string | null} opts.iconOf   component key → icon export name (an icon component), else null
 * @param {string} [opts.importPrefix]  import path of the generated icon/props layer from the component file
 * @param {(exportName: string) => string} [opts.resolveImport]  import path of another generated component (default `./<Name>`)
 * @param {Set<string>} [opts.iconNames]  export names that are icon components: their instances get `size` and the colour of the layer
 * @param {{ layers: Set<string>, tag: 'input' | 'textarea' }} [opts.inputs]  layers that become a real <input> / <textarea> (the field of a text input); it takes `inputProps`
 * @param {Set<string>} [opts.slot]  components whose instances inside this one become `children` (the field of a form item): `{children ?? <the instance of the design />}`
 * @param {boolean} [opts.tailwind]  write the styles as Tailwind classes (the library package), not as inline `style` (a project's own code)
 * @param {Set<string>} [opts.colors]  names of the theme's colour tokens: a colour bound to one is written as a theme utility (`bg-primary`)
 * @param {Set<string>} [opts.classes]  collects every Tailwind class the component uses (what the stylesheet is compiled for)
 * @returns {{ source: string, dts: string, warnings: string[], components: string[], icons: string[] }}
 */
export function generateComponent({ ctx, mapping, types = 'generated', iconOf = () => null, importPrefix = '../..', resolveImport = null, iconNames = null, tailwind = false, colors = new Set(), classes = new Set(), inputs = null, slot = null }) {
    const root = ctx.byId.get(mapping.componentKey);
    if (!root) throw new Error(`component ${mapping.componentName} not found in the snapshot`);
    const name = mapping.exportName;
    const props = mapping.propsMap.props;
    let usesInput = false, usesSlot = false;
    const warnings = [], issues = [], components = new Set(), icons = new Set();
    const styleLiteral = style => JSON.stringify(clean(style));
    /** The attribute that carries a style: Tailwind classes, or an inline style. */
    const styleAttr = style => (tailwind ? `className=${q(cls(style))}` : `style={${styleLiteral(style)}}`);
    /** The Tailwind classes of a style, as the value of a className; every class is recorded for the stylesheet. */
    const cls = style => { const c = tailwindClasses(clean(style), { colors }); for (const x of c) classes.add(x); return c.join(' '); };
    const byName = new Map(props.map(p => [`${p.source}:${p.key}`, p]));
    const variantProps = props.filter(p => p.source === 'variant');
    const textProp = cpropId => byName.get(`text:${cpropId}`)?.name ?? null;
    const boolProp = cpropId => byName.get(`boolean:${cpropId}`)?.name ?? null;
    const swapProp = cpropId => byName.get(`swap:${cpropId}`)?.name ?? null;
    const boolDefault = cpropId => byName.get(`boolean:${cpropId}`)?.def;
    // A free vector layer (an arrow, an arc) is drawn as an inline SVG in its own colours (theme tokens when bound to them).
    const paintOf = (n, key) => {
        const raw = key === 'stroke' ? n.stroke : n.fill;
        if (!raw || raw === 'none') return null;
        const item = ctx.vars.get(key === 'stroke' ? n.vars?.stroke : n.vars?.['fills.0']);
        return item ? `var(${cssVarOf(item)}, ${raw})` : raw;
    };
    const vectorJsx = (layer, node, pad) => {
        const svg = iconSvg([{ id: 'r', w: layer.w, h: layer.h }, { ...layer, id: 'v', parentId: 'r', x: 0, y: 0 }], 'r');
        const fill = paintOf(layer, 'fill'), stroke = paintOf(layer, 'stroke');
        const parts = svg.parts.map(p => {
            const a = { ...p.attrs };
            if (a.fill !== 'none' && fill) a.fill = fill;
            if (a.stroke && stroke) a.stroke = stroke;
            return `${pad}  <${p.tag} ${Object.entries(a).map(([k, v]) => (typeof v === 'number' ? `${k}={${v}}` : `${k}=${q(v)}`)).join(' ')} />`;
        });
        return `${pad}<svg width={${Math.round(layer.w)}} height={${Math.round(layer.h)}} viewBox="0 0 ${svg.width} ${svg.height}" ${styleAttr(node.box)} aria-hidden="true">\n${parts.join('\n')}\n${pad}</svg>`;
    };
    // An icon instance: its size, and the colour its vector layer carries (a theme token when bound to one).
    const iconAttrs = inst => {
        let color = null;
        const queue = [...(ctx.kids.get(inst.id) || [])];
        for (let n = queue.shift(); n && !color; n = queue.shift()) {
            if (n.type === 'path' || n.type === 'rect' || n.type === 'ellipse') {
                const item = ctx.vars.get(n.vars?.['fills.0']);
                color = item ? `var(${cssVarOf(item)}, ${n.fill})` : (n.fill && n.fill !== 'none' ? n.fill : null);
            }
            else queue.push(...(ctx.kids.get(n.id) || []));
        }
        return ` size={${Math.round(inst.w)}}${color ? ` ${styleAttr({ color })}` : ''}`;
    };

    const owned = id => { // the library component (set) a main component node belongs to
        const n = ctx.byId.get(id);
        return n?.variant ? ctx.byId.get(n.parentId) : n;
    };

    const emit = (node, depth, isRoot) => {
        const pad = indent(depth);
        const src = node.nodeId ? ctx.byId.get(node.nodeId) : null;
        let jsx = '';
        if (node.kind === 'box') {
            const kids = node.children.map(c => emit(c, depth + 1, false)).filter(Boolean);
            // A root that hugs its content (no width in the design) sits in the flow like an inline element, not stretched over the page
            if (tailwind && isRoot && !node.style?.width && node.style?.display === 'flex') node.style = { ...node.style, display: 'inline-flex' };
            const attrs = isRoot
                ? ` data-testid={testId} ${tailwind ? `className={${q(cls(node.style))} + (className ? \` \${className}\` : '')} style={style}` : `className={className} style={{ ...${styleLiteral(node.style)}, ...style }}`} {...rest}`
                : ` ${styleAttr(node.style)}`;
            jsx = kids.length ? `${pad}<div${attrs}>\n${kids.join('\n')}\n${pad}</div>` : `${pad}<div${attrs} />`;
        }
        else if (node.kind === 'text') {
            const bound = src?.propBind?.text ? textProp(src.propBind.text) : null;
            if (tailwind && inputs?.layers.has(src?.name)) {
                // The text of a field is a real input: same look as the layer, and what the person types goes through `inputProps`
                usesInput = true;
                const reset = { background: 'transparent', border: '0', outline: 'none', padding: '0', margin: '0', minWidth: '0', fontFamily: 'inherit', ...(inputs.tag === 'textarea' ? { resize: 'none', height: '100%', width: '100%' } : {}) };
                const c = `${cls(node.style)} ${cls(reset)} mds:placeholder:text-muted-foreground`;
                classes.add('mds:placeholder:text-muted-foreground');
                jsx = `${pad}<${inputs.tag} className=${q(c)} {...inputProps} />`;
            }
            else
                jsx = `${pad}<span ${styleAttr(node.style)}>{${bound ?? q(node.text ?? '')}}</span>`;
        }
        else if (node.kind === 'component') {
            const attrs = Object.entries(node.props || {}).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}={${q(v)}}`).join('');
            components.add(node.exportName);
            jsx = `${pad}<${node.exportName}${attrs}${iconNames?.has(node.exportName) && src ? iconAttrs(src) : ''} />`;
            if (slot?.has(node.exportName) && !isRoot) { usesSlot = true; jsx = `${pad}{children ?? (\n${jsx}\n${pad})}`; }
        }
        else if (node.kind === 'unsupported') {
            const main = src?.isInstance ? ctx.byId.get(src.sourceId) : null;
            const key = main ? owned(main.id)?.id : null;
            const icon = key ? iconOf(key) : null;
            if (icon) {
                icons.add(icon);
                jsx = `${pad}<${icon} size={${Math.round(src.w)}} />`;
            }
            else if (src && ['path', 'rect', 'ellipse'].includes(src.type) && src.visible !== false) {
                jsx = vectorJsx(src, node, pad);
            }
            else {
                warnings.push(`${src?.name || node.name || 'layer'}: ${node.reason}`);
                jsx = `${pad}{/* not generated: ${String(node.reason || node.name || '').replace(/\*\//g, '* /')} */}`;
            }
        }
        const vis = src?.propBind?.visible ? boolProp(src.propBind.visible) : null;
        const swap = node.kind === 'component' && src?.propBind?.swap ? swapProp(src.propBind.swap) : null;
        if (!jsx || (!vis && !swap)) return jsx;
        // A slot (instance swap) shows what was passed, else the design's own instance; a boolean property shows or hides the layer.
        let expr = swap ? `${swap} ?? (\n${jsx}\n${pad})` : null;
        if (vis) expr = `${boolDefault(src.propBind.visible) === false ? vis : `${vis} !== false`} && (${expr ?? `\n${jsx}\n${pad}`})`;
        return `${pad}{${expr}}`;
    };

    // ---- variants
    const variantNodes = root.componentSet ? [...(ctx.kids.get(root.id) || [])].filter(n => n.component && n.visible !== false) : [root];
    if (!variantNodes.length) throw new Error(`component ${mapping.componentName} has no variants`);
    const bodies = variantNodes.map(v => {
        const { tree, issues: found } = screenTree(ctx, v.id, {}, { component: true });
        for (const i of found) if (!issues.some(x => x.nodeName === i.nodeName && x.message === i.message)) issues.push(i); // the same layer in every variant is one issue
        const key = variantProps.map(p => v.variant?.[p.key] ?? '').join('|');
        return { key, jsx: emit(tree, 3, true) };
    });
    const single = !root.componentSet;

    // ---- props handled by the design (destructured), the rest goes to the root element
    const handled = [...new Set(props.map(p => p.name))];
    const all = [...handled, 'testId', 'className', 'style', ...(usesInput ? ['inputProps'] : []), ...(usesSlot ? ['children'] : [])].filter((n, i, a) => a.indexOf(n) === i);
    const defaults = `${camelCase(name)}Defaults`;
    const typesBlock = types === 'generated'
        ? `import { ${defaults}, type ${name}Props as DesignProps } from '${importPrefix}/generated/props';\n`
        : '';
    const importLines = [
        `import type { HTMLAttributes, ReactElement } from 'react';`,
        types === 'generated' ? typesBlock.trimEnd() : null,
        icons.size ? `import { ${[...icons].sort().join(', ')} } from '${importPrefix}/generated/icons';` : null,
        ...[...components].filter(c => c !== name).sort().map(c => `import { ${c} } from '${resolveImport ? resolveImport(c) : `./${c}`}';`),
    ].filter(Boolean).join('\n');

    const slotType = usesSlot ? "  /** What the design shows as the field: put your own control here. */\n  children?: import('react').ReactNode;\n" : '';
    const inputType = slotType + (usesInput ? `  inputProps?: import('react').${inputs.tag === 'textarea' ? 'TextareaHTMLAttributes<HTMLTextAreaElement>' : 'InputHTMLAttributes<HTMLInputElement>'};\n` : '');
    const inlineType = types === 'inline'
        ? `interface DesignProps {\n${props.map(p => `  ${p.name}?: ${p.type === 'enum' ? Object.values(p.values || {}).map(q).join(' | ') || 'string' : p.type === 'boolean' ? 'boolean' : p.type === 'node' ? 'import(\'react\').ReactNode' : 'string'};`).join('\n')}\n${inputType}  testId?: string;\n}\n`
        : '';
    // The design's own values: the first variant of every property, the text and the on/off of the component properties.
    const inlineDefaults = types === 'inline' ? `const ${defaults}: Partial<DesignProps> = { ${props.filter(p => p.def !== undefined && p.type !== 'node').map(p => `${p.name}: ${typeof p.def === 'string' ? q(p.def) : JSON.stringify(p.def)}`).join(', ')} };\n` : '';
    const reverse = variantProps.map(p => `  ${p.name}: ${q(Object.fromEntries(Object.entries(p.values || {}).map(([design, code]) => [code, design])))},`).join('\n');
    const variantsBlock = single ? '' : `\n  const variants: Record<string, () => ReactElement> = {\n${bodies.map(b => `    ${q(b.key)}: () => (\n${b.jsx}\n    ),`).join('\n')}\n  };\n  const key = [${variantProps.map(p => `DESIGN.${p.name}[String(${p.name} ?? '')] ?? ''`).join(', ')}].join('|');\n  const render = variants[key] ?? Object.values(variants)[0];\n  return render();`;
    const body = single ? `\n  return (\n${bodies[0].jsx.replace(/^ {6}/gm, '    ')}\n  );` : variantsBlock;
    const source = `// Generated by Midas from the design component "${mapping.componentName}" — static markup; edit the design, not this file.
${importLines}

${inlineType}export type ${name}Props = DesignProps & Omit<HTMLAttributes<HTMLDivElement>, keyof DesignProps>;
${inlineDefaults}${variantProps.length ? `\n/** Code value → design value of each variant property. */\nconst DESIGN: Record<string, Record<string, string>> = {\n${reverse}\n};\n` : ''}
/** ${mapping.componentName} (from the design). */
export function ${name}(props: ${name}Props): ReactElement {
  const { ${all.join(', ')}, ...rest } = { ...${defaults}, ...props } as ${name}Props;
  void [${all.filter(n => !['testId', 'className', 'style', 'inputProps', 'children'].includes(n)).join(', ')}];${body}
}
`;
    const dts = `import type { HTMLAttributes, ReactElement } from 'react';
${types === 'generated' ? `import type { ${name}Props as DesignProps } from '${importPrefix}/generated/props';\n` : ''}${inlineType.replace(/^interface/, 'interface')}export type ${name}Props = DesignProps & Omit<HTMLAttributes<HTMLDivElement>, keyof DesignProps>;
export declare function ${name}(props: ${name}Props): ReactElement;
${types === 'inline' ? 'export {};\n' : ''}`; // `export {}`: the file's own helper types (DesignProps) stay private
    // Rectangles, ellipses and vectors are drawn as inline SVG above, so they are not a problem.
    const open = issues.filter(i => !/A free (Rectangle|Ellipse|Vector) is not generated/.test(i.message));
    return { source, dts, warnings, issues: open, components: [...components], icons: [...icons] };
}
