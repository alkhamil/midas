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
        .replace(/<\?xml[^>]*>|<!--[\s\S]*?-->|<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
        .trim();
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

/** Semua ikon di snapshot (urut nama), dengan nama export unik. */
export function collectIcons(snapshot: LibrarySnapshot): { icons: IconSource[]; warnings: string[] } {
    const warnings: string[] = [];
    const icons: IconSource[] = [];
    const used = new Map<string, string>();
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
        let exportName = iconExportName(name);
        if (used.has(exportName))
            exportName = iconExportName(`${category}-${name}`);
        if (used.has(exportName)) {
            warnings.push(`Ikon ${c.name} bentrok dengan ${used.get(exportName)} — dilewati`);
            continue;
        }
        used.set(exportName, c.name);
        icons.push({ name: icons.some(i => i.name === name) ? `${category}-${name}` : name, category, exportName, styles });
    }
    icons.sort((a, b) => a.name.localeCompare(b.name));
    return { icons, warnings };
}

const HEADER = (what: string) => `// ${what}\n// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan \`npx @midas/cli sync\` untuk memperbarui.\n`;
const q = (s: string) => JSON.stringify(s);

/** File `src/generated/icons/*` untuk Library Kit. */
export function iconFiles(icons: IconSource[], dir: string): Record<string, string> {
    const styles = [...new Set(icons.flatMap(i => Object.keys(i.styles)))].sort();
    const defaultStyle = styles.includes('outline') ? 'outline' : styles[0] ?? 'default';
    const files: Record<string, string> = {};
    files[`${dir}/createIcon.tsx`] = `${HEADER('Pembuat komponen ikon.')}import type { SVGProps } from 'react';

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
        files[`${dir}/${i.exportName}.ts`] = `${HEADER(`Ikon "${i.category}/${i.name}".`)}import { createIcon } from './createIcon';\n\n// PURE: ikon yang tidak dipakai bisa dibuang bundler aplikasi (tree-shaking).\nexport const ${i.exportName} = /* @__PURE__ */ createIcon(${q(i.name)}, ${JSON.stringify(i.styles, null, 2)});\n`;
    files[`${dir}/registry.ts`] = `${HEADER('Semua ikon berdasarkan nama — dipakai <Icon name>. Mengimpor file ini memuat semua ikon.')}${icons.map(i => `import { ${i.exportName} } from './${i.exportName}';`).join('\n')}

export const iconRegistry = {
${icons.map(i => `  ${q(i.name)}: ${i.exportName},`).join('\n')}
} as const;

export type IconName = keyof typeof iconRegistry;
// Literal (bukan Object.keys) supaya registry tidak ikut terbundel bila tidak dipakai.
export const iconNames: IconName[] = [${icons.map(i => q(i.name)).join(', ')}];
`;
    files[`${dir}/Icon.tsx`] = `${HEADER('Ikon berdasarkan nama. Untuk bundle kecil, impor ikon bernama (mis. ArrowLeftIcon) langsung.')}import type { IconProps } from './createIcon';
import { iconRegistry, type IconName } from './registry';

export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Component = iconRegistry[name];
  return Component ? <Component {...props} /> : null;
}
`;
    files[`${dir}/index.ts`] = `${HEADER(`${icons.length} ikon dalam gaya: ${styles.join(', ') || '-'}.`)}export * from './createIcon';
export * from './registry';
export { Icon } from './Icon';
${icons.map(i => `export { ${i.exportName} } from './${i.exportName}';`).join('\n')}
`;
    return files;
}
