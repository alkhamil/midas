// Logika design system library: pemetaan komponen desain → kontrak kode, semver, dan deteksi breaking change.

export interface SnapshotNode {
    id: string;
    parentId?: string | null;
    name?: string;
    component?: boolean;
    componentSet?: boolean;
    variant?: Record<string, string>;
    /** Component property; nilai default di `def` (engine Midas), `default` pada data lama. */
    cprops?: { id: string; name: string; type: string; def?: unknown; default?: unknown }[];
    [k: string]: unknown;
}
export interface SnapshotComponent {
    id: string;
    name: string;
    set?: boolean;
    nodes: SnapshotNode[];
}
export interface LibrarySnapshot {
    components: SnapshotComponent[];
    variables?: { collections?: unknown[]; items?: unknown[] };
    /** Aset yang dipakai komponen (assetId → data URL), mis. SVG ikon. */
    assets?: Record<string, string>;
    /** Komponen yang dipublish sebagai ikon, dengan SVG per gaya (diekspor Studio saat publish). */
    icons?: SnapshotIcon[];
}

export interface SnapshotIcon {
    componentKey: string;
    name: string;
    category: string;
    /** gaya → SVG lengkap */
    styles: Record<string, string>;
}

/** Penamaan lama ikon (snapshot sebelum `icons` ada): component set "Icon/<kategori>/<nama>". */
export const ICON_PREFIX = 'Icon/';
export const isIconComponent = (c: { name: string }) => c.name.startsWith(ICON_PREFIX);

/** Komponen yang menjadi ikon: dari `snapshot.icons`, atau penamaan lama bila snapshot belum punya `icons`. */
export function iconKeysOf(snapshot: LibrarySnapshot): Set<string> {
    if (Array.isArray(snapshot.icons))
        return new Set(snapshot.icons.map(i => i.componentKey));
    return new Set(snapshot.components.filter(isIconComponent).map(c => c.id));
}

export type PropSource = 'variant' | 'text' | 'boolean' | 'instance' | 'slot';
export type PropType = 'enum' | 'string' | 'boolean' | 'node';
export interface PropMapping {
    source: PropSource;
    /** Nama property variant, atau id component property (`cprops[].id`). */
    key: string;
    label: string;
    /** Nama prop di kode (camelCase). */
    name: string;
    type: PropType;
    /** Untuk enum: nilai desain → nilai kode. */
    values?: Record<string, string>;
}
export interface ComponentMapping {
    componentKey: string;
    componentName: string;
    exportName: string;
    propsMap: { props: PropMapping[] };
}

const words = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean);

export function pascalCase(s: string): string {
    const out = words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
    return /^[A-Z]/.test(out) ? out : `Component${out}`;
}
export function camelCase(s: string): string {
    const p = words(s).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
    const out = p ? p[0].toLowerCase() + p.slice(1) : '';
    return /^[a-z]/.test(out) ? out : `prop${p}`;
}
export function kebabCase(s: string): string {
    return words(s).map(w => w.toLowerCase()).join('-') || 'default';
}
export function packageSlug(s: string): string {
    return kebabCase(s).replace(/^-+|-+$/g, '') || 'library';
}

export const PACKAGE_NAME_RE = /^@midas\/[a-z0-9]+(-[a-z0-9]+)*$/;
export const EXPORT_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
export const PROP_NAME_RE = /^[a-z][A-Za-z0-9]*$/;

const CPROP_TYPES: Record<string, { source: PropSource; type: PropType }> = {
    text: { source: 'text', type: 'string' },
    boolean: { source: 'boolean', type: 'boolean' },
    instance: { source: 'instance', type: 'node' },
    slot: { source: 'slot', type: 'node' },
};

/** Mapping default untuk satu komponen: variant → prop enum, component property → prop sesuai tipenya. */
export function deriveMapping(c: SnapshotComponent): ComponentMapping {
    const root = c.nodes.find(n => n.id === c.id);
    const props: PropMapping[] = [];
    if (c.set) {
        const variants = c.nodes.filter(n => n.parentId === c.id && n.component);
        const keys: string[] = [];
        for (const v of variants)
            for (const k of Object.keys(v.variant ?? {}))
                if (!keys.includes(k))
                    keys.push(k);
        for (const k of keys) {
            const values: Record<string, string> = {};
            for (const v of variants) {
                const x = v.variant?.[k];
                if (x !== undefined)
                    values[x] = kebabCase(x);
            }
            const vals = Object.keys(values);
            const boolLike = vals.length === 2 && vals.every(x => /^(true|false|yes|no|on|off)$/i.test(x));
            props.push(boolLike
                ? { source: 'variant', key: k, label: k, name: camelCase(k), type: 'boolean', values: Object.fromEntries(vals.map(x => [x, String(/^(true|yes|on)$/i.test(x))])) }
                : { source: 'variant', key: k, label: k, name: camelCase(k), type: 'enum', values });
        }
    }
    for (const p of root?.cprops ?? []) {
        const t = CPROP_TYPES[p.type];
        if (t)
            props.push({ source: t.source, key: p.id, label: p.name, name: p.type === 'slot' && !props.some(x => x.name === 'children') ? 'children' : camelCase(p.name), type: t.type });
    }
    const seen = new Set<string>();
    for (const p of props) {
        let name = p.name, i = 2;
        while (seen.has(name))
            name = `${p.name}${i++}`;
        p.name = name;
        seen.add(name);
    }
    return { componentKey: c.id, componentName: c.name, exportName: pascalCase(c.name), propsMap: { props } };
}

/** Mapping default untuk semua komponen, menimpa dengan mapping versi sebelumnya bila komponen/prop sama. */
export function deriveMappings(snapshot: LibrarySnapshot, previous: ComponentMapping[] = [], skip: Set<string> = iconKeysOf(snapshot)): ComponentMapping[] {
    const prev = new Map(previous.map(m => [m.componentKey, m]));
    // Ikon tidak dipetakan sebagai komponen ber-props; Library Kit membangkitkannya terpisah.
    return snapshot.components.filter(c => !skip.has(c.id)).map(c => {
        const d = deriveMapping(c), p = prev.get(c.id);
        if (!p)
            return d;
        const pp = new Map(p.propsMap.props.map(x => [`${x.source}:${x.key}`, x]));
        return {
            ...d,
            exportName: p.exportName,
            propsMap: {
                props: d.propsMap.props.map(x => {
                    const o = pp.get(`${x.source}:${x.key}`);
                    if (!o || o.type !== x.type)
                        return x;
                    return { ...x, name: o.name, values: x.values ? Object.fromEntries(Object.entries(x.values).map(([k, v]) => [k, o.values?.[k] ?? v])) : undefined };
                }),
            },
        };
    });
}

/** Pesan error validasi mapping (nama export/prop tidak valid atau bentrok). */
export function validateMappings(mappings: ComponentMapping[]): string[] {
    const errors: string[] = [];
    const exports = new Map<string, string>();
    for (const m of mappings) {
        if (!EXPORT_NAME_RE.test(m.exportName))
            errors.push(`${m.componentName}: nama export "${m.exportName}" harus PascalCase (mis. Button)`);
        if (exports.has(m.exportName))
            errors.push(`${m.componentName}: nama export "${m.exportName}" sudah dipakai ${exports.get(m.exportName)}`);
        exports.set(m.exportName, m.componentName);
        const names = new Set<string>();
        for (const p of m.propsMap.props) {
            if (!PROP_NAME_RE.test(p.name))
                errors.push(`${m.exportName}.${p.name}: nama prop harus camelCase`);
            if (names.has(p.name))
                errors.push(`${m.exportName}.${p.name}: nama prop dipakai lebih dari sekali`);
            names.add(p.name);
            if (p.type === 'enum')
                for (const [k, v] of Object.entries(p.values ?? {}))
                    if (!v.trim())
                        errors.push(`${m.exportName}.${p.name}: nilai kode untuk "${k}" kosong`);
        }
    }
    return errors;
}

/** Perubahan yang merusak kode pemakai versi sebelumnya — mewajibkan kenaikan versi major. */
export function breakingChanges(prev: ComponentMapping[], next: ComponentMapping[]): string[] {
    const out: string[] = [];
    const nextBy = new Map(next.map(m => [m.componentKey, m]));
    for (const p of prev) {
        const n = nextBy.get(p.componentKey);
        if (!n) {
            out.push(`Komponen ${p.exportName} dihapus`);
            continue;
        }
        if (n.exportName !== p.exportName)
            out.push(`Komponen ${p.exportName} diganti nama menjadi ${n.exportName}`);
        const nProps = new Map(n.propsMap.props.map(x => [`${x.source}:${x.key}`, x]));
        for (const pp of p.propsMap.props) {
            const np = nProps.get(`${pp.source}:${pp.key}`);
            if (!np) {
                out.push(`${p.exportName}: prop ${pp.name} dihapus`);
                continue;
            }
            if (np.name !== pp.name)
                out.push(`${p.exportName}: prop ${pp.name} diganti nama menjadi ${np.name}`);
            if (np.type !== pp.type)
                out.push(`${p.exportName}.${pp.name}: tipe berubah dari ${pp.type} ke ${np.type}`);
            else if (pp.type === 'enum') {
                const nv = new Set(Object.values(np.values ?? {}));
                for (const v of new Set(Object.values(pp.values ?? {})))
                    if (!nv.has(v))
                        out.push(`${p.exportName}.${pp.name}: nilai "${v}" dihapus`);
            }
        }
    }
    return out;
}

// ---- semver (major.minor.patch, tanpa pre-release) ----
export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function parseSemver(v: string): [number, number, number] | null {
    const m = SEMVER_RE.exec(v);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
export function compareSemver(a: string, b: string): number {
    const x = parseSemver(a)!, y = parseSemver(b)!;
    for (let i = 0; i < 3; i++)
        if (x[i] !== y[i])
            return x[i] - y[i];
    return 0;
}
export function bumpSemver(v: string, part: 'major' | 'minor' | 'patch'): string {
    const [M, m, p] = parseSemver(v)!;
    return part === 'major' ? `${M + 1}.0.0` : part === 'minor' ? `${M}.${m + 1}.0` : `${M}.${m}.${p + 1}`;
}
