// Library Kit (spec §3.3): file yang dibangkitkan otomatis dari satu versi library —
// token tema dari Variables, tipe props + manifest dari component mapping.
// Hasilnya deterministik untuk versi yang sama, sehingga `midas sync` aman diulang.
import { collectIcons, iconFiles } from './icons.js';
import { camelCase, type ComponentMapping, type LibrarySnapshot, type PropMapping } from './library.js';

export interface KitFiles {
    [path: string]: string;
}

interface VarCollection { id: string; name: string; modes: { id: string; name: string }[] }
interface VarItem { id: string; collectionId: string; name: string; type: string; values: Record<string, unknown>; description?: string }

export interface KitInput {
    packageName: string;
    version: string;
    libraryName: string;
    publishedAt: Date;
    snapshot: LibrarySnapshot;
    mappings: ComponentMapping[];
}

export const GENERATED_DIR = 'src/generated';
const HEADER = (what: string) => `// ${what}\n// Dibangkitkan oleh Midas dari library — JANGAN diedit manual; jalankan \`npx @midas/cli sync\` untuk memperbarui.\n`;

/** "color/primary-foreground" → "primaryForeground"; "radius/sm" → "radiusSm". */
export function tokenKey(name: string, type: string): string {
    const parts = name.split('/').map(s => s.trim()).filter(Boolean);
    if (type === 'color' && parts.length > 1 && /^colou?rs?$/i.test(parts[0]))
        parts.shift();
    return camelCase(parts.join(' '));
}
const cssVar = (key: string) => `--theme-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;
const themeName = (mode: string) => camelCase(mode).replace(/[A-Z]/g, c => `-${c.toLowerCase()}`) || 'default';

function cssValue(type: string, v: unknown): string | null {
    if (v === undefined || v === null)
        return null;
    if (type === 'color')
        return typeof v === 'string' ? v : null;
    if (type === 'number')
        return typeof v === 'number' && Number.isFinite(v) ? (v === 0 ? '0' : `${v}px`) : null;
    if (type === 'string')
        return typeof v === 'string' ? v : null;
    if (type === 'boolean')
        return typeof v === 'boolean' ? String(v) : null;
    return null; // effect: belum didukung sebagai token CSS
}

interface Tokens {
    themes: string[];
    keys: { key: string; type: string; name: string; description: string }[];
    values: Record<string, Record<string, string>>;
    warnings: string[];
}

/**
 * Hitung nilai token per tema. Tema = gabungan nama mode dari collection yang punya >1 mode
 * (mis. Light/Dark); collection satu mode berlaku untuk semua tema.
 */
export function buildTokens(snapshot: LibrarySnapshot): Tokens {
    const allCollections = (snapshot.variables?.collections ?? []) as VarCollection[];
    const known = new Set(allCollections.filter(c => Array.isArray(c?.modes) && c.modes.length).map(c => c.id));
    // Variable tanpa nama / collection valid diabaikan (data lama atau rusak).
    const items = ((snapshot.variables?.items ?? []) as VarItem[]).filter(i => typeof i?.name === 'string' && known.has(i.collectionId) && i.values && typeof i.values === 'object');
    const byId = new Map(items.map(i => [i.id, i]));
    const collections = allCollections.filter(c => known.has(c.id));
    const collById = new Map(collections.map(c => [c.id, c]));
    const themes: string[] = [];
    for (const c of collections)
        if (c.modes.length > 1)
            for (const m of c.modes)
                if (!themes.includes(themeName(m.name)))
                    themes.push(themeName(m.name));
    if (!themes.length)
        themes.push('light');
    const warnings: string[] = [];
    const modeFor = (c: VarCollection, theme: string) => c.modes.find(m => themeName(m.name) === theme) ?? c.modes[0];
    const resolve = (item: VarItem, theme: string, depth = 0): unknown => {
        const c = collById.get(item.collectionId);
        if (!c || depth > 20)
            return undefined;
        const v = item.values[modeFor(c, theme).id] ?? item.values[c.modes[0].id];
        if (v && typeof v === 'object' && 'alias' in (v as object)) {
            const target = byId.get(String((v as { alias: unknown }).alias));
            return target ? resolve(target, theme, depth + 1) : undefined;
        }
        return v;
    };
    const keys: Tokens['keys'] = [];
    const values: Tokens['values'] = Object.fromEntries(themes.map(t => [t, {}]));
    const seen = new Map<string, string>();
    for (const item of items) {
        if (item.type === 'effect') {
            warnings.push(`Variable "${item.name}" (effect) belum didukung sebagai token CSS`);
            continue;
        }
        const key = tokenKey(item.name, item.type);
        if (!key)
            continue;
        if (seen.has(key)) {
            warnings.push(`Variable "${item.name}" menghasilkan nama token "${key}" yang sama dengan "${seen.get(key)}" — dilewati`);
            continue;
        }
        seen.set(key, item.name);
        keys.push({ key, type: item.type, name: item.name, description: item.description ?? '' });
        for (const t of themes) {
            const v = cssValue(item.type, resolve(item, t));
            if (v !== null)
                values[t][key] = v;
        }
    }
    return { themes, keys, values, warnings };
}

const q = (s: string) => JSON.stringify(s);
const indent = (s: string, n = 2) => s.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n');

function themeTs(t: Tokens): string {
    const iface = t.keys.map(k => `${k.description ? `  /** ${k.description.replace(/\*\//g, '* /')} */\n` : ''}  ${k.key}: string;`).join('\n');
    const themes = t.themes.map(th => `  ${q(th)}: {\n${t.keys.filter(k => t.values[th][k.key] !== undefined).map(k => `    ${k.key}: ${q(t.values[th][k.key])},`).join('\n')}\n  },`).join('\n');
    return `${HEADER('Token tema dari Variables design system.')}
export type ThemeName = ${t.themes.map(q).join(' | ')};

export interface ThemeTokens {
${iface || '  // Belum ada Variables di library.'}
}

export const themeNames: ThemeName[] = [${t.themes.map(q).join(', ')}];
export const defaultTheme: ThemeName = ${q(t.themes[0])};

export const themes: Record<ThemeName, Partial<ThemeTokens>> = {
${themes}
};

/** \`primaryForeground\` → \`--theme-primary-foreground\` */
export function toVarName(key: string): string {
  return \`--theme-\${key.replace(/[A-Z]/g, (c) => \`-\${c.toLowerCase()}\`)}\`;
}

/** Terapkan tema ke dokumen: set \`data-theme\` + CSS variables. */
export function applyTheme(name: ThemeName, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = name;
  for (const [key, value] of Object.entries(themes[name] ?? {}) as [string, string | undefined][]) {
    if (value !== undefined) root.style.setProperty(toVarName(key), value);
  }
}
`;
}

function tokensCss(t: Tokens): string {
    const block = (sel: string, th: string) => `${sel} {\n${t.keys.filter(k => t.values[th][k.key] !== undefined).map(k => `  ${cssVar(k.key)}: ${t.values[th][k.key]};`).join('\n')}\n}`;
    const blocks = t.themes.map((th, i) => block(i === 0 ? `:root,\n[data-theme="${th}"]` : `[data-theme="${th}"]`, th));
    return `/* Token tema dari Variables design system. Dibangkitkan oleh Midas — JANGAN diedit manual. */\n\n${blocks.join('\n\n')}\n`;
}

/** Pemetaan token ke utility Tailwind CSS v4 (`bg-primary`, `rounded-md`, …). */
function tailwindCss(t: Tokens): string {
    const lines = t.keys.map(k => {
        if (k.type === 'color')
            return `  --color-${cssVar(k.key).slice('--theme-'.length)}: var(${cssVar(k.key)});`;
        if (k.type === 'number' && /^radius/.test(k.key))
            return `  --radius-${cssVar(k.key).slice('--theme-radius-'.length) || 'default'}: var(${cssVar(k.key)});`;
        return null;
    }).filter(Boolean);
    return `/* Utility Tailwind v4 dari token tema. Dibangkitkan oleh Midas — JANGAN diedit manual. */\n@theme inline {\n${lines.join('\n')}\n}\n`;
}

function propType(p: PropMapping): string {
    if (p.type === 'enum')
        return [...new Set(Object.values(p.values ?? {}))].map(q).join(' | ') || 'string';
    if (p.type === 'boolean')
        return 'boolean';
    if (p.type === 'node')
        return 'ReactNode';
    return 'string';
}

/** Nilai default prop dari desain: varian pertama untuk enum, nilai default component property. */
function propDefaults(m: ComponentMapping, snapshot: LibrarySnapshot): Record<string, unknown> {
    const comp = snapshot.components.find(c => c.id === m.componentKey);
    const root = comp?.nodes.find(n => n.id === comp.id);
    const firstVariant = comp?.nodes.find(n => n.parentId === comp.id && n.component);
    const out: Record<string, unknown> = {};
    for (const p of m.propsMap.props) {
        if (p.source === 'variant') {
            const v = firstVariant?.variant?.[p.key];
            if (v !== undefined && p.values?.[v] !== undefined)
                out[p.name] = p.type === 'boolean' ? p.values[v] === 'true' : p.values[v];
        }
        else if (p.type === 'string' || p.type === 'boolean') {
            const d = root?.cprops?.find(c => c.id === p.key)?.default;
            if (p.type === 'string' && typeof d === 'string')
                out[p.name] = d;
            if (p.type === 'boolean' && typeof d === 'boolean')
                out[p.name] = d;
        }
    }
    return out;
}

function propsTs(m: ComponentMapping, defaults: Record<string, unknown>): string {
    const usesNode = m.propsMap.props.some(p => p.type === 'node');
    const fields = m.propsMap.props.map(p => `  /** ${p.label} (${p.source}) */\n  ${p.name}?: ${propType(p)};`).join('\n');
    return `${HEADER(`Kontrak props ${m.exportName} dari komponen desain "${m.componentName}".`)}${usesNode ? "import type { ReactNode } from 'react';\n" : ''}
export interface ${m.exportName}Props {
${fields}${fields ? '\n' : ''}  /** \`data-testid\` untuk test otomatis. */
  testId?: string;
}

/** Nilai default dari desain. */
export const ${camelCase(m.exportName)}Defaults = ${JSON.stringify(defaults, null, 2)} as const satisfies Partial<${m.exportName}Props>;
`;
}

export function buildManifest(input: KitInput, tokens = buildTokens(input.snapshot), icons = collectIcons(input.snapshot)) {
    return {
        package: input.packageName,
        version: input.version,
        library: input.libraryName,
        publishedAt: input.publishedAt.toISOString(),
        themes: tokens.themes,
        tokens: tokens.keys.map(k => ({ key: k.key, cssVar: cssVar(k.key), type: k.type, variable: k.name })),
        components: input.mappings.map(m => ({
            exportName: m.exportName,
            componentKey: m.componentKey,
            componentName: m.componentName,
            props: m.propsMap.props.map(p => ({ name: p.name, type: p.type, source: p.source, label: p.label, ...(p.values ? { values: [...new Set(Object.values(p.values))] } : {}) })),
            defaults: propDefaults(m, input.snapshot),
        })),
        icons: icons.icons.map(i => ({ name: i.name, category: i.category, exportName: i.exportName, styles: Object.keys(i.styles) })),
        warnings: [...tokens.warnings, ...icons.warnings],
    };
}

/** Semua file Library Kit, relatif ke root repo paket. */
export function buildKit(input: KitInput): KitFiles {
    const tokens = buildTokens(input.snapshot);
    const icons = collectIcons(input.snapshot);
    const manifest = buildManifest(input, tokens, icons);
    const files: KitFiles = {
        [`${GENERATED_DIR}/theme.ts`]: themeTs(tokens),
        [`${GENERATED_DIR}/tokens.css`]: tokensCss(tokens),
        [`${GENERATED_DIR}/tailwind-theme.css`]: tailwindCss(tokens),
        [`${GENERATED_DIR}/manifest.json`]: JSON.stringify(manifest, null, 2) + '\n',
    };
    for (const m of input.mappings)
        files[`${GENERATED_DIR}/props/${m.exportName}.ts`] = propsTs(m, manifest.components.find(c => c.exportName === m.exportName)!.defaults);
    files[`${GENERATED_DIR}/props/index.ts`] = `${HEADER('Semua kontrak props komponen library.')}\n${input.mappings.map(m => `export * from './${m.exportName}';`).join('\n')}\n`;
    Object.assign(files, iconFiles(icons.icons, `${GENERATED_DIR}/icons`));
    files[`${GENERATED_DIR}/index.ts`] = `${HEADER(`Library Kit ${input.packageName}@${input.version}.`)}\nexport * from './theme';\nexport * from './props';\nexport * from './icons';\n`;
    files[`${GENERATED_DIR}/README.md`] = `# Library Kit — ${input.packageName}@${input.version}\n\nFolder ini dibangkitkan oleh Midas dari library **${input.libraryName}** dan ditimpa setiap \`npx @midas/cli sync\`. Jangan diedit manual: ubah desain di Midas, publish versi baru, lalu sync.\n\n- \`theme.ts\`, \`tokens.css\`, \`tailwind-theme.css\` — token tema dari Variables\n- \`props/\` — kontrak props setiap komponen (dipakai komponen di \`src/components\`)\n- \`icons/\` — ${manifest.icons.length} ikon React dari design system (\`ArrowLeftIcon\`, \`<Icon name>\`), warna ikut \`currentColor\`\n- \`manifest.json\` — daftar komponen + props untuk Properties Inspector Code Builder\n${manifest.warnings.length ? `\n## Peringatan\n\n${manifest.warnings.map(w => `- ${w}`).join('\n')}\n` : ''}`;
    return files;
}

/** Token & ikon yang hilang dibanding manifest versi sebelumnya — juga breaking change (kode bisa memakainya). */
export function kitBreakingChanges(previousManifest: unknown, snapshot: LibrarySnapshot): string[] {
    return [...tokenBreakingChanges(previousManifest, snapshot), ...iconBreakingChanges(previousManifest, snapshot)];
}

export function tokenBreakingChanges(previousManifest: unknown, snapshot: LibrarySnapshot): string[] {
    const prev = (previousManifest ?? {}) as { tokens?: { key: string }[] };
    const tokens = new Set(buildTokens(snapshot).keys.map(k => k.key));
    return (prev.tokens ?? []).filter(t => !tokens.has(t.key)).map(t => `Token ${t.key} dihapus`);
}

export function iconBreakingChanges(previousManifest: unknown, snapshot: LibrarySnapshot): string[] {
    const prev = (previousManifest ?? {}) as { icons?: { name: string; styles: string[] }[] };
    const out: string[] = [];
    const icons = new Map(collectIcons(snapshot).icons.map(i => [i.name, new Set(Object.keys(i.styles))]));
    for (const i of prev.icons ?? []) {
        const now = icons.get(i.name);
        if (!now) {
            out.push(`Ikon ${i.name} dihapus`);
            continue;
        }
        for (const st of i.styles)
            if (!now.has(st))
                out.push(`Ikon ${i.name}: gaya ${st} dihapus`);
    }
    return out;
}
