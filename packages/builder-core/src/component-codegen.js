// Component code from the design: a React component for any component (set) of a library, written from its nodes.
//
// The visual side comes straight from the design: every variant is rendered from its node tree (auto layout → flex, fills and
// strokes → styles that use the library's theme tokens, text bound to a text property → a prop, a boolean property → show/hide,
// nested instances → the other generated components, icons → the generated icon components). The result is static markup;
// interactive behaviour is not in a design, so it comes from the standard kit (an `implementation` of "standard:<Name>").
import { camelCase, screenTree } from './screen.js';

const q = s => JSON.stringify(s);
const indent = n => '  '.repeat(n);
const clean = style => Object.fromEntries(Object.entries(style || {}).filter(([, v]) => v !== undefined && v !== null));
const styleLiteral = style => JSON.stringify(clean(style));

/**
 * @param {object} opts
 * @param {object} opts.ctx            makeContext() over the library's component nodes (+ variables), self library
 * @param {{ componentKey: string, componentName: string, exportName: string, propsMap: { props: object[] } }} opts.mapping
 * @param {'generated'|'inline'} [opts.types]  `generated`: props type and defaults from ../../generated/props; `inline`: declared here
 * @param {(key: string) => string | null} opts.iconOf   component key → icon export name (an icon component), else null
 * @param {string} [opts.importPrefix]  import path of the generated icon/props layer from the component file
 * @returns {{ source: string, dts: string, warnings: string[], components: string[], icons: string[] }}
 */
export function generateComponent({ ctx, mapping, types = 'generated', iconOf = () => null, importPrefix = '../..' }) {
    const root = ctx.byId.get(mapping.componentKey);
    if (!root) throw new Error(`component ${mapping.componentName} not found in the snapshot`);
    const name = mapping.exportName;
    const props = mapping.propsMap.props;
    const warnings = [], components = new Set(), icons = new Set();
    const byName = new Map(props.map(p => [`${p.source}:${p.key}`, p]));
    const variantProps = props.filter(p => p.source === 'variant');
    const textProp = cpropId => byName.get(`text:${cpropId}`)?.name ?? null;
    const boolProp = cpropId => byName.get(`boolean:${cpropId}`)?.name ?? null;

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
            const attrs = isRoot ? ` data-testid={testId} className={className} style={{ ...${styleLiteral(node.style)}, ...style }} {...rest}` : ` style={${styleLiteral(node.style)}}`;
            jsx = kids.length ? `${pad}<div${attrs}>\n${kids.join('\n')}\n${pad}</div>` : `${pad}<div${attrs} />`;
        }
        else if (node.kind === 'text') {
            const bound = src?.propBind?.text ? textProp(src.propBind.text) : null;
            jsx = `${pad}<span style={${styleLiteral(node.style)}}>{${bound ?? q(node.text ?? '')}}</span>`;
        }
        else if (node.kind === 'component') {
            const attrs = Object.entries(node.props || {}).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}={${q(v)}}`).join('');
            components.add(node.exportName);
            jsx = `${pad}<${node.exportName}${attrs} />`;
        }
        else if (node.kind === 'unsupported') {
            const main = src?.isInstance ? ctx.byId.get(src.sourceId) : null;
            const key = main ? owned(main.id)?.id : null;
            const icon = key ? iconOf(key) : null;
            if (icon) {
                icons.add(icon);
                jsx = `${pad}<${icon} size={${Math.round(src.w)}} />`;
            }
            else {
                warnings.push(`${src?.name || node.name || 'layer'}: ${node.reason}`);
                jsx = `${pad}{/* not generated: ${String(node.reason || node.name || '').replace(/\*\//g, '* /')} */}`;
            }
        }
        const vis = src?.propBind?.visible ? boolProp(src.propBind.visible) : null;
        return vis && jsx ? `${pad}{${vis} !== false && (\n${jsx}\n${pad})}` : jsx;
    };

    // ---- variants
    const variantNodes = root.componentSet ? [...(ctx.kids.get(root.id) || [])].filter(n => n.component && n.visible !== false) : [root];
    if (!variantNodes.length) throw new Error(`component ${mapping.componentName} has no variants`);
    const bodies = variantNodes.map(v => {
        const { tree } = screenTree(ctx, v.id, {}, { component: true });
        const key = variantProps.map(p => v.variant?.[p.key] ?? '').join('|');
        return { key, jsx: emit(tree, 3, true) };
    });
    const single = !root.componentSet;

    // ---- props handled by the design (destructured), the rest goes to the root element
    const handled = [...new Set(props.map(p => p.name))];
    const all = [...handled, 'testId', 'className', 'style'].filter((n, i, a) => a.indexOf(n) === i);
    const defaults = `${camelCase(name)}Defaults`;
    const typesBlock = types === 'generated'
        ? `import { ${defaults}, type ${name}Props as DesignProps } from '${importPrefix}/generated/props';\n`
        : '';
    const importLines = [
        `import type { HTMLAttributes, ReactElement } from 'react';`,
        types === 'generated' ? typesBlock.trimEnd() : null,
        icons.size ? `import { ${[...icons].sort().join(', ')} } from '${importPrefix}/generated/icons';` : null,
        ...[...components].filter(c => c !== name).sort().map(c => `import { ${c} } from './${c}';`),
    ].filter(Boolean).join('\n');

    const inlineType = types === 'inline'
        ? `interface DesignProps {\n${props.map(p => `  ${p.name}?: ${p.type === 'enum' ? Object.values(p.values || {}).map(q).join(' | ') || 'string' : p.type === 'boolean' ? 'boolean' : p.type === 'node' ? 'import(\'react\').ReactNode' : 'string'};`).join('\n')}\n  testId?: string;\n}\n`
        : '';
    const inlineDefaults = types === 'inline' ? `const ${defaults} = {} as Partial<DesignProps>;\n` : '';
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
  void [${all.filter(n => !['testId', 'className', 'style'].includes(n)).join(', ')}];${body}
}
`;
    const dts = `import type { HTMLAttributes, ReactElement } from 'react';
${types === 'generated' ? `import type { ${name}Props as DesignProps } from '${importPrefix}/generated/props';\n` : ''}${inlineType.replace(/^interface/, 'interface')}export type ${name}Props = DesignProps & Omit<HTMLAttributes<HTMLDivElement>, keyof DesignProps>;
export declare function ${name}(props: ${name}Props): ReactElement;
`;
    return { source, dts, warnings, components: [...components], icons: [...icons] };
}
