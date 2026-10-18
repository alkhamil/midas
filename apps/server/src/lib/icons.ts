// Ikon Library Kit: component set "Icon/<kategori>/<nama>" dengan variant Style → komponen React.
// Warna utama SVG diganti `currentColor` (ikut warna teks), opacity/duotone dipertahankan.
import { ICON_PREFIX, isIconComponent, type LibrarySnapshot } from './library.js';

export interface IconStyleSource {
    viewBox: string;
    /** Isi <svg> (tanpa tag pembungkus) yang sudah memakai currentColor. */
    body: string;
}
export interface IconSource {
    name: string;
    category: string;
    exportName: string;
    styles: Record<string, IconStyleSource>;
}

const words = (s: string) => s.split(/[^A-Za-z0-9]+/).filter(Boolean);
export function iconExportName(name: string): string {
    return `${words(name).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') || 'Unnamed'}Icon`.replace(/^(\d)/, 'Icon$1');
}

function decodeSvg(url: string | undefined): string | null {
    const m = /^data:image\/svg\+xml(;base64)?,(.*)$/s.exec(url ?? '');
    if (!m)
        return null;
    return m[1] ? Buffer.from(m[2], 'base64').toString('utf8') : decodeURIComponent(m[2]);
}

/** Ambil viewBox + isi SVG, dan ganti warna utama dengan currentColor. */
export function normalizeSvg(svg: string): IconStyleSource | null {
    const open = /<svg\b([^>]*)>/i.exec(svg);
    const close = svg.lastIndexOf('</svg>');
    if (!open || close < 0)
        return null;
    const attrs = open[1];
    const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(attrs)?.[1]
        ?? `0 0 ${/\swidth\s*=\s*"([\d.]+)/i.exec(attrs)?.[1] ?? 24} ${/\sheight\s*=\s*"([\d.]+)/i.exec(attrs)?.[1] ?? 24}`;
    let body = svg.slice(open.index + open[0].length, close)
        // Komentar, script, dan metadata (title/desc dari export Midas/Figma akan tampil sebagai tooltip) dibuang.
        .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->|<script[\s\S]*?<\/script>|<title[\s\S]*?<\/title>|<desc[\s\S]*?<\/desc>|<metadata[\s\S]*?<\/metadata>|<defs>\s*<\/defs>/gi, '')
        .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
        .trim();
    // Atribut presentasi di <svg> (mis. stroke="#000" stroke-width="1.5") berlaku untuk semua isi:
    // bawa ke <g> pembungkus supaya tidak hilang. fill="none" di <svg> sudah menjadi default createIcon.
    const PRESENTATION = /\s((?:fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|stroke-opacity|fill-opacity|fill-rule|clip-rule|opacity|color)\s*=\s*"[^"]*")/gi;
    const rootAttrs = [...attrs.matchAll(PRESENTATION)].map(m => m[1]).filter(a => !/^fill\s*=\s*"none"$/i.test(a));
    if (rootAttrs.length)
        body = `<g ${rootAttrs.join(' ')}>${body}</g>`;
    const counts = new Map<string, number>();
    for (const m of body.matchAll(/\s(?:fill|stroke)\s*=\s*"([^"]+)"/gi)) {
        const c = m[1].trim().toLowerCase();
        if (c !== 'none' && c !== 'currentcolor' && !c.startsWith('url('))
            counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (main)
        body = body.replace(/(\s(?:fill|stroke)\s*=\s*")([^"]+)"/gi, (all, pre: string, c: string) => (c.trim().toLowerCase() === main ? `${pre}currentColor"` : all));
    return { viewBox: vb.trim(), body: body.replace(/\s*\n\s*/g, '') };
}

/** Beri nama export unik; nama ikon kembar di kategori berbeda diberi awalan kategori. */
function addIcon(icons: IconSource[], used: Map<string, string>, warnings: string[], label: string, name: string, category: string, styles: Record<string, IconStyleSource>) {
    let exportName = iconExportName(name);
    if (used.has(exportName))
        exportName = iconExportName(`${category}-${name}`);
    if (used.has(exportName)) {
        warnings.push(`Ikon ${label} bentrok dengan ${used.get(exportName)} — dilewati`);
        return;
    }
    used.set(exportName, label);
    icons.push({ name: icons.some(i => i.name === name) ? `${category}-${name}` : name, category, exportName, styles });
}

/** Semua ikon di snapshot (urut nama), dengan nama export unik. */
export function collectIcons(snapshot: LibrarySnapshot): { icons: IconSource[]; warnings: string[] } {
    const warnings: string[] = [];
    const icons: IconSource[] = [];
    const used = new Map<string, string>();
    // Snapshot baru: SVG per gaya sudah diekspor Studio dari layer ikon (vector, shape, gambar SVG).
    if (Array.isArray(snapshot.icons)) {
        for (const i of snapshot.icons) {
            const styles: Record<string, IconStyleSource> = {};
            for (const [style, svg] of Object.entries(i.styles)) {
                const norm = normalizeSvg(svg);
                if (norm)
                    styles[style] = norm;
                else
                    warnings.push(`Ikon ${i.name} (${style}) bukan SVG yang valid — dilewati`);
            }
            if (Object.keys(styles).length)
                addIcon(icons, used, warnings, `${i.category}/${i.name}`, i.name, i.category, styles);
        }
        icons.sort((a, b) => a.name.localeCompare(b.name));
        return { icons, warnings };
    }
    // Snapshot lama: component set "Icon/…" berisi gambar SVG.
    for (const c of snapshot.components.filter(isIconComponent)) {
        const path = c.name.slice(ICON_PREFIX.length).split('/').map(s => s.trim()).filter(Boolean);
        const name = path.pop() ?? '';
        const category = path.join('/') || 'general';
        const byId = new Map(c.nodes.map(n => [n.id, n]));
        const variants = c.set ? c.nodes.filter(n => n.parentId === c.id && n.component) : [byId.get(c.id)!].filter(Boolean);
        const styles: Record<string, IconStyleSource> = {};
        for (const v of variants) {
            const style = String(Object.values(v.variant ?? {})[0] ?? 'default').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
            // node gambar pertama di dalam variant yang berisi SVG
            const stack = [v];
            let svg: string | null = null;
            while (stack.length && !svg) {
                const n = stack.shift()!;
                svg = decodeSvg(snapshot.assets?.[String((n as { assetId?: string }).assetId ?? '')]);
                stack.push(...c.nodes.filter(x => x.parentId === n.id));
            }
            const norm = svg ? normalizeSvg(svg) : null;
            if (norm)
                styles[style] = norm;
            else
                warnings.push(`Ikon ${c.name} (${style}) tidak berisi SVG — dilewati`);
        }
        if (!name || !Object.keys(styles).length)
            continue;
        addIcon(icons, used, warnings, c.name, name, category, styles);
    }
    icons.sort((a, b) => a.name.localeCompare(b.name));
    return { icons, warnings };
}

const HEADER = (what: string) => `// ${what}\n// Generated by Midas from the library — DO NOT edit by hand; run \`npx @midas/cli sync\` to update.\n`;
const q = (s: string) => JSON.stringify(s);

/** File `src/generated/icons/*` untuk Library Kit. */
export function iconFiles(icons: IconSource[], dir: string): Record<string, string> {
    const styles = [...new Set(icons.flatMap(i => Object.keys(i.styles)))].sort();
    const defaultStyle = styles.includes('outline') ? 'outline' : styles[0] ?? 'default';
    const files: Record<string, string> = {};
    files[`${dir}/createIcon.tsx`] = `${HEADER('Icon component factory.')}import type { SVGProps } from 'react';

export type IconStyle = ${styles.length ? styles.map(q).join(' | ') : 'string'};
export const iconStyles: IconStyle[] = [${styles.map(q).join(', ')}];
export const defaultIconStyle: IconStyle = ${q(defaultStyle)};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref' | 'children' | 'dangerouslySetInnerHTML'> {
  /** Gaya ikon dari design system (default ${q(defaultStyle)}). */
  variant?: IconStyle;
  /** Lebar & tinggi (px atau nilai CSS). Default 24. */
  size?: number | string;
  /** Teks aksesibel; tanpa title ikon dianggap dekoratif (aria-hidden). */
  title?: string;
  testId?: string;
}

type IconBody = { viewBox: string; body: string };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export function createIcon(name: string, styles: Partial<Record<IconStyle, IconBody>>) {
  const fallback = (styles[defaultIconStyle] ? defaultIconStyle : Object.keys(styles)[0]) as IconStyle;
  function Icon({ variant = defaultIconStyle, size = 24, title, testId, ...rest }: IconProps) {
    const icon = styles[variant] ?? styles[fallback]!;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={icon.viewBox}
        width={size}
        height={size}
        fill="none"
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        data-icon={name}
        data-testid={testId}
        {...rest}
        dangerouslySetInnerHTML={{ __html: (title ? \`<title>\${escapeHtml(title)}</title>\` : '') + icon.body }}
      />
    );
  }
  Icon.displayName = name;
  Icon.iconName = name;
  Icon.iconStyles = Object.keys(styles) as IconStyle[];
  return Icon;
}
`;
    for (const i of icons)
        files[`${dir}/${i.exportName}.ts`] = `${HEADER(`Icon "${i.category}/${i.name}".`)}import { createIcon } from './createIcon';\n\n// PURE: unused icons can be dropped by the app bundler (tree-shaking).\nexport const ${i.exportName} = /* @__PURE__ */ createIcon(${q(i.name)}, ${JSON.stringify(i.styles, null, 2)});\n`;
    files[`${dir}/registry.ts`] = `${HEADER('All icons by name — used by <Icon name>. Importing this file loads every icon.')}${icons.map(i => `import { ${i.exportName} } from './${i.exportName}';`).join('\n')}

export const iconRegistry = {
${icons.map(i => `  ${q(i.name)}: ${i.exportName},`).join('\n')}
} as const;

export type IconName = keyof typeof iconRegistry;
// Literal (bukan Object.keys) supaya registry tidak ikut terbundel bila tidak dipakai.
export const iconNames: IconName[] = [${icons.map(i => q(i.name)).join(', ')}];
`;
    files[`${dir}/Icon.tsx`] = `${HEADER('Icon by name. For a small bundle, import the named icon (e.g. ArrowLeftIcon) directly.')}import type { IconProps } from './createIcon';
import { iconRegistry, type IconName } from './registry';

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = iconRegistry[name];
  return Component ? <Component {...props} /> : null;
}
`;
    files[`${dir}/index.ts`] = `${HEADER(`${icons.length} icons in style: ${styles.join(', ') || '-'}.`)}export * from './createIcon';
export * from './registry';
export { Icon } from './Icon';
${icons.map(i => `export { ${i.exportName} } from './${i.exportName}';`).join('\n')}
`;
    return files;
}
