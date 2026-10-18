// Generator kode Code Builder (spec §6): config project + pohon screen → file sumber React/TypeScript untuk
// base project. Murni (tanpa I/O) supaya jalan di Studio (unduh zip) dan CLI (`midas generate`).
//
// Hasil: { files: { 'src/…': isi }, warnings: [] }. Berisi module (`src/modules/<path>`) dan file
// `src/app/generated/*` (route, menu, locale, layout) yang diimpor base project — jadi regenerate aman:
// file hasil generate tidak pernah bercampur dengan kode tulisan tangan.
import { autoAction, breadcrumbsOf, fieldBinding, pageTitle, sampleValue, isNumericField, parseRules, pascalCase, relationOf, resolveLayout, screenPath, tableModel, titleCase } from './model.js';
import { CRUD_ROLES, camelCase, kebabCase, screenTree } from './screen.js';

const q = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const lit = v => (typeof v === 'string' ? q(v) : JSON.stringify(v));
const iconComponent = name => `${pascalCase(name)}Icon`;
const tsType = f => ({ number: 'number', boolean: 'boolean' }[f.type] || (f.type === 'enum' && f.options?.length ? f.options.map(q).join(' | ') : 'string'));
const GEN_HEADER = '// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.\n';

function styleLit(style) {
    const entries = Object.entries(style || {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
    return `{ ${entries.map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} }`;
}

const FLUID_COMPONENTS = new Set(['Table', 'FilterToolbar', 'SectionHeader', 'Card', 'StatCard', 'Alert']);
/**
 * Lebar piksel dari desain (mis. 1096px untuk tabel) diganti perilaku fluid supaya halaman responsif:
 * di dalam baris → flex 1, di dalam kolom → rentang penuh. Elemen kecil (tombol, field) tetap ukuran desain.
 */
function fluid(style, parentStyle, always = false) {
    const px = parseFloat(style?.width);
    if (!style || !(px >= 480 || (always && px))) return style;
    const { width: _w, flexShrink: _f, ...rest } = style;
    return parentStyle?.flexDirection === 'row' ? { ...rest, flex: '1 1 0', minWidth: 0 } : { ...rest, alignSelf: 'stretch' };
}

/** Folder module relatif ke `src/modules` (module bersarang mengikuti parent). */
const moduleDir = (modules, m) => {
    const byId = new Map(modules.map(x => [x.id, x]));
    const parts = [];
    for (let c = m, n = 0; c && n < 20; c = c.parentId ? byId.get(c.parentId) : null, n++) parts.unshift(c.name);
    return parts.join('/');
};

class PageBuilder {
    constructor(ctx, mod, screen, tree) {
        Object.assign(this, { ctx, mod, screen, tree });
        this.ui = new Set();
        this.rr = new Set();
        this.locale = {};
        this.keys = 0;
        this.state = [];
        this.hasForm = screen.role === 'create' || screen.role === 'edit';
        this.needNavigate = false;
        this.usesValues = false;
        this.usesSearch = false;
        this.usesTable = false;
        this.relations = new Map(); // nama field → { rel, hook } untuk select relasi
        this.hasRules = (mod.entity?.fields || []).some(f => hasAnyRule(f));
    }

    t(text) {
        const key = `t${++this.keys}`;
        this.locale[key] = text;
        return `t('${this.mod.name.replace(/-/g, '_')}.${this.screenKey}.${key}')`;
    }

    get fields() { return this.mod.entity?.fields || []; }

    /** Relasi field yang bisa dibaca lewat query module tujuan (hasil generate); selain itu null → opsi contoh. */
    relTarget(f) {
        const rel = relationOf(f, this.ctx.modules);
        if (!rel || !rel.module.entity?.fields?.length || !rel.module.screens.some(s => CRUD_ROLES.includes(s.role))) return null;
        return rel;
    }

    effectiveAction(node) {
        const a = node.cfg?.action;
        if (a) return a;
        return autoAction(this.mod, this.screen, node.props.children ?? node.props.label ?? node.props.actionLabel);
    }

    pathOf(screenId, id) {
        for (const m of this.ctx.modules) {
            const s = m.screens.find(x => x.id === screenId);
            if (s) return screenPath(this.ctx.modules, m, s).replace(':id', id ? `\${${id}}` : ':id');
        }
        return null;
    }

    attrs(node, skip = []) {
        const out = [];
        for (const [k, v] of Object.entries(node.props)) {
            if (k === 'children' || skip.includes(k) || v === undefined) continue;
            if (typeof v === 'string') out.push(`${k}=${/["\n{}<>]/.test(v) ? `{${q(v)}}` : `"${v}"`}`);
            else if (v === true) out.push(k);
            else out.push(`${k}={${JSON.stringify(v)}}`);
        }
        return out;
    }

    emit(node, pad, parent = null) {
        if (node.kind === 'text') return `${pad}<p style={${styleLit(node.style)}}>{${this.t(node.text)}}</p>`;
        if (node.kind === 'box') {
            const style = parent ? fluid(node.style, parent.style) : (({ width: _w, ...r }) => r)(node.style);
            const kids = node.children.map(c => this.emit(c, `${pad}  `, { ...node, style })).filter(Boolean);
            return kids.length ? `${pad}<div style={${styleLit(style)}}>\n${kids.join('\n')}\n${pad}</div>` : `${pad}<div style={${styleLit(style)}} />`;
        }
        if (node.kind === 'unsupported') return `${pad}{/* ${node.name}: ${node.reason} */}`;
        const body = this.component(node);
        const boxStyle = fluid(node.box, parent?.style, FLUID_COMPONENTS.has(node.exportName));
        const box = Object.entries(boxStyle || {}).filter(([, v]) => v !== undefined);
        return box.length ? `${pad}<div style={${styleLit(boxStyle)}}>\n${body.split('\n').map(l => `${pad}  ${l}`).join('\n')}\n${pad}</div>` : `${pad}${body}`;
    }

    component(node) {
        const { exportName: name } = node;
        this.ui.add(name);
        const label = node.props.children != null ? this.t(String(node.props.children)) : null;
        const wrap = (extra = [], children = label ? `{${label}}` : null) => {
            const extraNames = (extra.attrs || []).map(x => x.split(/[=\s]/)[0]);
            const a = [...this.attrs(node, [...(extra.skip || []), ...extraNames]), ...(extra.attrs || [])];
            const open = `<${name}${a.length ? ` ${a.join(' ')}` : ''}`;
            return children ? `${open}>${children}</${name}>` : `${open} />`;
        };
        if (name === 'Table' && this.screen.role === 'list' && this.fields.length) return this.table(node);
        if (name === 'Table') return wrap({ skip: ['columns', 'data', 'rowKey'], attrs: ['columns={[]}', 'data={[]}', 'rowKey={(_row, index) => index}'] });
        if (name === 'FilterToolbar' && this.screen.role === 'list') {
            this.usesSearch = true;
            return wrap({ attrs: ['searchValue={search}', 'onSearchChange={(v) => { setSearch(v); setPage(1); }}'] });
        }
        if (name === 'SectionHeader') {
            // Tombol aksi header: navigasi / kembali (submit form tetap lewat tombol Simpan di form).
            const a = this.effectiveAction(node);
            if (a.type === 'back') { this.needNavigate = true; return wrap({ skip: ['onAction'], attrs: ['onAction={() => navigate(-1)}'] }); }
            if (a.type === 'navigate' && a.screenId) {
                const p = this.pathOf(a.screenId, null);
                if (p && !p.includes(':id')) { this.needNavigate = true; return wrap({ skip: ['onAction'], attrs: [`onAction={() => navigate(${q(p)})}`] }); }
            }
            return wrap();
        }
        if (name === 'Button' || name === 'IconButton') {
            const a = this.effectiveAction(node);
            if (a.type === 'submit') return wrap({ attrs: ['type="submit"', 'disabled={saving}'] });
            if (a.type === 'back') { this.needNavigate = true; return wrap({ attrs: ['type="button"', 'onClick={() => navigate(-1)}'] }); }
            if (a.type === 'navigate' && a.screenId) {
                const p = this.pathOf(a.screenId, null);
                if (p && !p.includes(':id')) { this.needNavigate = true; return wrap({ attrs: [`onClick={() => navigate(${q(p)})}`] }); }
            }
            return wrap();
        }
        const f = this.hasForm || this.screen.role === 'view' ? fieldBinding({ fields: this.fields }, node) : null;
        if (f && ['TextField', 'TextAreaField', 'PasswordField'].includes(name)) {
            this.usesValues = true;
            return wrap({ skip: ['value', 'error'], attrs: [`value={String(values.${f.name} ?? '')}`, `onChange={(e) => setField(${q(f.name)}, e.target.value)}`, ...this.errAttr(f), ...(this.screen.role === 'view' ? ['readOnly'] : [])] });
        }
        if (f && name === 'SelectField') {
            this.usesValues = true;
            let opts;
            const rel = f.type === 'relation' ? this.relTarget(f) : null;
            if (rel) {
                this.relations.set(f.name, rel);
                opts = `${f.name}Options`;
            }
            else if (f.type === 'relation') opts = `[${[1, 2, 3].map(i => `{ label: ${q(`${titleCase(f.name)} ${i}`)}, value: ${q(String(i))} }`).join(', ')}]`;
            else opts = `[${(f.options || []).map(o => `{ label: ${q(titleCase(o))}, value: ${q(o)} }`).join(', ')}]`;
            return wrap({ skip: ['options', 'value', 'error'], attrs: [`options={${rel ? opts : opts}}`, `value={String(values.${f.name} ?? '')}`, `onChange={(e) => setField(${q(f.name)}, e.target.value)}`, ...this.errAttr(f)] });
        }
        if (f && name === 'SwitchField') {
            this.usesValues = true;
            return wrap({ skip: ['checked'], attrs: [`checked={Boolean(values.${f.name})}`, `onCheckedChange={(v) => setField(${q(f.name)}, v)}`] });
        }
        return wrap();
    }

    /** Atribut pesan error validasi (hanya form create/edit di module yang punya aturan). */
    errAttr(f) {
        if (!(this.hasForm && this.hasRules && hasAnyRule(f))) return [];
        this.usesErrors = true;
        return [`error={errors.${f.name}}`];
    }

    table(node) {
        const t = tableModel({ fields: this.fields }, node.cfg);
        this.usesTable = true;
        this.tableModel = t;
        const attrs = this.attrs(node, ['columns', 'data', 'rowKey', 'renderAction', 'totalRecords', 'page', 'pageSize', 'onPageChange']);
        const acts = t.rowActions.map(a => {
            if (a === 'delete') { this.needDelete = true; return `<IconButton action="delete" onClick={() => onDelete(row.id)} />`; }
            const target = this.mod.screens.find(s => s.role === a);
            if (!target) return null;
            this.needNavigate = true;
            return `<IconButton action=${q(a).replace(/'/g, '"')} onClick={() => navigate(\`${this.pathOf(target.id, 'row.id')}\`)} />`;
        }).filter(Boolean);
        if (acts.length) this.ui.add('IconButton');
        return [
            `<Table${attrs.length ? ` ${attrs.join(' ')}` : ''}`,
            '  columns={columns} data={rows} rowKey={(row) => row.id} totalRecords={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage}',
            ...(acts.length ? [`  renderAction={(row) => (<div className="flex gap-1">${acts.join('')}</div>)}`] : []),
            '/>',
        ].join('\n');
    }
}

const hasAnyRule = f => {
    const r = parseRules(f);
    return (r.required && !['boolean', 'number'].includes(f.type)) || r.min !== '' || r.max !== '' || r.email || !!r.pattern || r.noEmoticon;
};

const ROLE_PAGE = { list: 'List', create: 'Create', edit: 'Edit', view: 'View' };
/** Nama komponen halaman: `<Module><Role>Page` untuk CRUD, nama screen untuk custom. */
export const pageNameOf = (mod, screen) => (ROLE_PAGE[screen.role] ? `${pascalCase(mod.name)}${ROLE_PAGE[screen.role]}Page` : `${pascalCase(screen.name)}Page`.replace(/^(\d)/, 'P$1'));

/** Isi file halaman satu screen. */
function pageFile(ctx, mod, screen, tree) {
    const b = new PageBuilder(ctx, mod, screen, tree);
    b.screenKey = ROLE_PAGE[screen.role] ? screen.role : camelCase(screen.name);
    const E = pascalCase(mod.name);
    const jsx = b.emit(tree, '      ');
    const hasEntity = b.fields.length > 0;
    const isList = screen.role === 'list' && b.usesTable;
    const record = (screen.role === 'edit' && hasEntity) || (screen.role === 'view' && b.usesValues);
    const form = b.hasForm && hasEntity;
    const values = form || record;
    const navigate = b.needNavigate || form;
    const react = [...(values ? ['useState'] : []), ...(record ? ['useEffect'] : []), ...(isList ? ['useState'] : [])];
    const imports = [];
    if (react.length) imports.push(`import { ${[...new Set(react)].sort().join(', ')} } from 'react';`);
    imports.push("import { useTranslation } from 'react-i18next';");
    const rr = [...(navigate ? ['useNavigate'] : []), ...(record ? ['useParams'] : [])];
    if (rr.length) imports.push(`import { ${rr.join(', ')} } from 'react-router';`);
    const ui = new Set(b.ui);
    if (isList) {
        for (const c of b.tableModel.columns) if (c.type === 'boolean' || c.type === 'enum') ui.add('Badge');
    }
    const uiList = [...ui].sort();
    if (isList) uiList.push('type Column');
    if (uiList.length) imports.push(`import { ${uiList.join(', ')} } from '@midas/ui-cms';`);
    const body = [], lines = [];
    // Query module tujuan untuk relasi (opsi select di form, label kolom di list).
    const dirSegs = moduleDir(ctx.modules, mod).split('/').length;
    const relImports = new Map(); // path import → nama hook
    const relLines = [];
    const useRel = (rel, varName) => {
        const hook = `use${pascalCase(rel.module.name)}List`;
        relImports.set(`${'../'.repeat(dirSegs + 1)}${moduleDir(ctx.modules, rel.module)}/api/queries`, hook);
        relLines.push(`  const ${varName} = ${hook}({ page: 1, size: 1000, search: '' }).data?.rows ?? [];`);
    };
    if (isList) {
        const hooks = [`use${E}List`, ...(b.needDelete ? [`useDelete${E}`] : [])];
        imports.push(`import { ${hooks.join(', ')} } from '../api/queries';`, `import type { ${E} } from '../types';`);
        const relCols = new Map();
        for (const c of b.tableModel.columns) {
            if (c.type !== 'relation') continue;
            const rel = b.relTarget(b.fields.find(f => f.name === c.key));
            if (rel) { relCols.set(c.key, rel); useRel(rel, `${c.key}Rel`); }
        }
        const cols = b.tableModel.columns.map(c => {
            const rel = relCols.get(c.key);
            if (rel) return `  { key: ${q(c.key)}, header: ${q(c.header)}, render: (r) => String(${c.key}Rel.find((o) => o.id === r.${c.key})?.${rel.labelField} ?? r.${c.key}) },`;
            const w = c.type === 'boolean' ? ', width: 120' : c.type === 'enum' ? ', width: 140' : '';
            const render = c.type === 'boolean' ? `, render: (r) => <Badge variant={r.${c.key} ? 'success' : 'neutral'}>{r.${c.key} ? 'Aktif' : 'Nonaktif'}</Badge>`
                : c.type === 'enum' ? `, render: (r) => <Badge variant="neutral">{String(r.${c.key})}</Badge>` : '';
            return `  { key: ${q(c.key)}, header: ${q(c.header)}${w}${render} },`;
        });
        const colsCode = `const columns: Column<${E}>[] = [\n${cols.join('\n')}\n];`;
        body.push(`const PAGE_SIZE = ${b.tableModel.pageSize};`);
        if (!relCols.size) body.push(colsCode, '');
        else body.push('');
        lines.push('  const [page, setPage] = useState(1);', b.usesSearch ? "  const [search, setSearch] = useState('');" : "  const search = '';");
        lines.push(`  const { data } = use${E}List({ page, size: PAGE_SIZE, search });`, '  const rows = data?.rows ?? [];', '  const total = data?.total ?? 0;');
        if (relCols.size) lines.push(...relLines.splice(0), ...colsCode.split('\n').map(l => `  ${l}`));
        if (b.needDelete) lines.push(`  const remove = useDelete${E}();`, "  const onDelete = (id: string) => { if (window.confirm(t('common.confirmDelete', { defaultValue: 'Hapus data ini?' }))) remove.mutate(id); };");
    }
    if (values) {
        const input = `${E}Input`;
        const defaults = b.fields.map(f => `${f.name}: ${f.type === 'boolean' ? 'false' : f.type === 'number' ? '0' : f.type === 'enum' ? q(f.options?.[0] ?? '') : "''"}`).join(', ');
        const hooks = screen.role === 'create' ? [`useCreate${E}`] : screen.role === 'edit' ? [`use${E}Detail`, `useUpdate${E}`] : [`use${E}Detail`];
        imports.push(`import type { ${input} } from '../types';`, `import { ${hooks.join(', ')} } from '../api/queries';`);
        for (const [name, rel] of b.relations) {
            useRel(rel, `${name}Rel`);
            relLines.push(`  const ${name}Options = ${name}Rel.map((r) => ({ label: String(r.${rel.labelField} ?? ''), value: r.id }));`);
        }
        lines.push(...relLines.splice(0));
        if (form && b.hasRules) {
            imports.push(`import { validate${E}, type ${E}Errors } from '../validation/${camelCase(mod.name)}Validation';`);
            lines.push(`  const [${b.usesErrors ? 'errors' : ''}, setErrors] = useState<${E}Errors>({});`);
        }
        lines.push(`  const [values${b.usesValues || record ? ', setValues' : ''}] = useState<${input}>({ ${defaults} });`);
        if (b.usesValues) {
            const clear = form && b.hasRules ? ' setErrors((e) => ({ ...e, [key]: undefined }));' : '';
            lines.push(`  const setField = <K extends keyof ${input}>(key: K, value: ${input}[K]) => {`, '    setValues((v) => ({ ...v, [key]: value }));' + clear, '  };');
        }
        if (record) {
            lines.push("  const { id = '' } = useParams();", `  const { data: record } = use${E}Detail(id);`);
            lines.push('  useEffect(() => { if (record) { const { id: _id, ...rest } = record; setValues(rest); } }, [record]);');
        }
        if (screen.role === 'create') lines.push(`  const save = useCreate${E}();`);
        if (screen.role === 'edit') lines.push(`  const save = useUpdate${E}();`);
    }
    if (navigate) lines.unshift('  const navigate = useNavigate();');
    if (form) {
        const check = b.hasRules ? [`    const found = validate${E}(values, ${q(screen.role)});`, '    setErrors(found);', '    if (Object.keys(found).length) return;'] : [];
        lines.push('  const saving = save.isPending;', '  const onSubmit = (e: React.FormEvent) => {', '    e.preventDefault();', ...check,
            screen.role === 'edit' ? '    save.mutate({ id, input: values }, { onSuccess: () => navigate(-1) });' : '    save.mutate(values, { onSuccess: () => navigate(-1) });', '  };');
    }
    for (const [path, hook] of relImports) imports.push(`import { ${hook} } from '${path}';`);
    const tid = `"${kebabCase(mod.name)}-${screen.role}-page"`;
    const wrap = form ? [`    <form onSubmit={onSubmit} data-testid=${tid}>`, '    </form>'] : [`    <div data-testid=${tid}>`, '    </div>'];
    const name = pageNameOf(mod, screen);
    const code = [GEN_HEADER.trim(), ...imports, '', ...body, `function ${name}() {`, '  const { t } = useTranslation();', ...lines, '  return (', wrap[0], jsx, wrap[1], '  );', '}', '', `export default ${name};`, ''].join('\n');
    return { name, code, locale: b.locale, key: b.screenKey };
}

function typesFile(mod) {
    const E = pascalCase(mod.name);
    const fields = mod.entity.fields;
    return `${GEN_HEADER}export interface ${E} {\n  id: string;\n${fields.map(f => `  ${f.name}${f.required ? '' : '?'}: ${tsType(f)};`).join('\n')}\n}\n\nexport type ${E}Input = Omit<${E}, 'id'>;\n\nexport interface ${E}ListParams {\n  page: number;\n  size: number;\n  search?: string;\n}\n`;
}

/** `validation/<module>Validation.ts`: aturan field (required/min/max/email/pattern/withoutemoticon) → pesan i18n `validation.*`. */
function validationFile(mod, sharedRel) {
    const E = pascalCase(mod.name);
    const out = [];
    let usesEmoticon = false, usesMode = false;
    for (const f of mod.entity.fields) {
        const r = parseRules(f);
        const label = q(f.label || titleCase(f.name));
        const v = `values.${f.name}`;
        const checks = [];
        const textual = !isNumericField(f) && f.type !== 'boolean';
        if (r.required && textual) {
            const guard = f.type === 'password' ? " && mode === 'create'" : '';
            if (guard) usesMode = true;
            checks.push(`if (isEmpty(${v})${guard}) errors.${f.name} = t('validation.required', { label: ${label} });`);
        }
        const rest = [];
        if (r.min !== '' && isFinite(Number(r.min))) rest.push(isNumericField(f)
            ? `if (Number(${v}) < ${Number(r.min)}) errors.${f.name} = t('validation.minValue', { label: ${label}, count: ${Number(r.min)} });`
            : `if (String(${v}).length < ${Number(r.min)}) errors.${f.name} = t('validation.minLength', { label: ${label}, count: ${Number(r.min)} });`);
        if (r.max !== '' && isFinite(Number(r.max))) rest.push(isNumericField(f)
            ? `if (Number(${v}) > ${Number(r.max)}) errors.${f.name} = t('validation.maxValue', { label: ${label}, count: ${Number(r.max)} });`
            : `if (String(${v}).length > ${Number(r.max)}) errors.${f.name} = t('validation.maxLength', { label: ${label}, count: ${Number(r.max)} });`);
        if (r.email && textual) rest.push(`if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(${v}))) errors.${f.name} = t('validation.email');`);
        if (r.pattern && textual) rest.push(`if (!new RegExp(${q(r.pattern)}).test(String(${v}))) errors.${f.name} = t('validation.pattern', { label: ${label} });`);
        if (r.noEmoticon && textual) { usesEmoticon = true; rest.push(`if (hasEmoticon(String(${v}))) errors.${f.name} = t('validation.noEmoticon');`); }
        if (!checks.length && !rest.length) continue;
        const body = [...checks, ...(rest.length ? [`${checks.length ? 'else {' : `if (!isEmpty(${v})) {`}`, ...rest.map(l => `  ${l}`), '}'] : [])];
        // else-if berantai: tiap aturan menimpa pesan sebelumnya; yang terakhir (paling spesifik) menang.
        out.push(...body.map(l => `  ${l}`));
    }
    return `${GEN_HEADER}import { t } from 'i18next';
${usesEmoticon ? `import { hasEmoticon } from '${sharedRel}shared/utils';\n` : ''}import type { ${E}Input } from '../types';

export type ${E}Errors = Partial<Record<keyof ${E}Input, string>>;

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/** Validasi form ${mod.label}; mengembalikan pesan error per field (kosong = valid). */
export function validate${E}(values: ${E}Input, ${usesMode ? 'mode' : '_mode'}: 'create' | 'edit'): ${E}Errors {
  const errors: ${E}Errors = {};
${out.join('\n')}
  return errors;
}
`;
}

function sampleLit(fields, n, modName) {
    const rows = Array.from({ length: n }, (_, i) => {
        const o = Object.fromEntries(fields.map(f => [f.name, sampleOf(f, i, modName)]));
        return `  { id: '${i + 1}', ${Object.entries(o).map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} },`;
    });
    return rows.join('\n');
}
function sampleOf(f, i, modName) {
    if (f.type === 'enum') return f.options?.[i % f.options.length] ?? '';
    if (f.type === 'number') return (i + 1) * 10;
    if (f.type === 'boolean') return i % 3 !== 2;
    if (f.type === 'password') return '';
    if (f.type === 'relation') return String((i % 3) + 1);
    if (f.type === 'date') return `2026-0${(i % 9) + 1}-15`;
    if (f.type === 'datetime') return `2026-0${(i % 9) + 1}-15T09:00:00`;
    return sampleValue(f, i, modName);
}

function apiFiles(mod, sharedRel) {
    const E = pascalCase(mod.name);
    const endpoint = `/api/v1/${kebabCase(mod.name)}`;
    const mock = `${GEN_HEADER}import type { ${E}, ${E}Input, ${E}ListParams } from '../types';

/** Saklar sumber data: \`true\` = mock lokal tanpa backend. Ubah ke \`false\` bila endpoint sudah tersedia. */
export const USE_MOCK = { list: true, detail: true, create: true, update: true, remove: true };

let store: ${E}[] = [
${sampleLit(mod.entity.fields, 5, mod.name)}
];
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150));

export async function mockList(params: ${E}ListParams): Promise<{ rows: ${E}[]; total: number }> {
  const q = (params.search ?? '').trim().toLowerCase();
  const all = q ? store.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : store;
  return delay({ rows: all.slice((params.page - 1) * params.size, params.page * params.size), total: all.length });
}
export async function mockDetail(id: string): Promise<${E}> {
  const row = store.find((r) => r.id === id);
  if (!row) throw new Error('Data tidak ditemukan');
  return delay({ ...row });
}
export async function mockCreate(input: ${E}Input): Promise<${E}> {
  const row = { id: String(Date.now()), ...input } as ${E};
  store = [row, ...store];
  return delay(row);
}
export async function mockUpdate(id: string, input: ${E}Input): Promise<${E}> {
  store = store.map((r) => (r.id === id ? ({ ...r, ...input } as ${E}) : r));
  return mockDetail(id);
}
export async function mockRemove(id: string): Promise<void> {
  store = store.filter((r) => r.id !== id);
  return delay(undefined);
}
`;
    const service = `${GEN_HEADER}import api from '${sharedRel}shared/lib/api';
import type { ApiDetail, ApiList, ApiResponse } from '${sharedRel}shared/types';
import type { ${E}, ${E}Input, ${E}ListParams } from '../types';

const BASE = '${endpoint}';

export async function list(params: ${E}ListParams): Promise<{ rows: ${E}[]; total: number }> {
  const { data } = await api.get<ApiResponse<ApiList<${E}>>>(BASE, { params });
  const out = data.response_output!.list;
  return { rows: out.content, total: out.pagination?.total_elements ?? out.content.length };
}
export async function detail(id: string): Promise<${E}> {
  const { data } = await api.get<ApiResponse<ApiDetail<${E}>>>(\`\${BASE}/\${id}\`);
  return data.response_output!.detail;
}
export async function create(input: ${E}Input): Promise<${E}> {
  const { data } = await api.post<ApiResponse<ApiDetail<${E}>>>(BASE, input);
  return data.response_output!.detail;
}
export async function update(id: string, input: ${E}Input): Promise<${E}> {
  const { data } = await api.put<ApiResponse<ApiDetail<${E}>>>(\`\${BASE}/\${id}\`, input);
  return data.response_output!.detail;
}
export async function remove(id: string): Promise<void> {
  await api.delete(\`\${BASE}/\${id}\`);
}
`;
    const resolver = `${GEN_HEADER}import { USE_MOCK, mockCreate, mockDetail, mockList, mockRemove, mockUpdate } from './mock';
import * as service from './service';

export const list = USE_MOCK.list ? mockList : service.list;
export const detail = USE_MOCK.detail ? mockDetail : service.detail;
export const create = USE_MOCK.create ? mockCreate : service.create;
export const update = USE_MOCK.update ? mockUpdate : service.update;
export const remove = USE_MOCK.remove ? mockRemove : service.remove;
`;
    const queries = `${GEN_HEADER}import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ${E}Input, ${E}ListParams } from '../types';
import * as resolver from './resolver';

const KEY = ${q(kebabCase(mod.name))};

export const use${E}List = (params: ${E}ListParams) => useQuery({ queryKey: [KEY, 'list', params], queryFn: () => resolver.list(params) });
export const use${E}Detail = (id: string) => useQuery({ queryKey: [KEY, 'detail', id], queryFn: () => resolver.detail(id), enabled: !!id });

export function useCreate${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: ${E}Input) => resolver.create(input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useUpdate${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { id: string; input: ${E}Input }) => resolver.update(v.id, v.input), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
export function useDelete${E}() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => resolver.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) });
}
`;
    return { 'api/mock.ts': mock, 'api/service.ts': service, 'api/resolver.ts': resolver, 'api/queries.ts': queries };
}

/**
 * @param {{ name: string, config: object }} project
 * @param {Map<string, {tree: object|null}>} trees screenId → hasil screenTree (dengan override node)
 */
export function generateProject(project, trees) {
    const { modules } = project.config;
    const files = {}, warnings = [];
    const ctx = { modules };
    const locales = { en: {} }; // nama module → folder (id memakai folder yang sama)
    const imports = [], routes = [], pages = [];
    const layout = resolveLayout(project.config);

    for (const mod of modules) {
        if (!mod.screens.length) { warnings.push(`Module ${mod.name} dilewati: belum punya screen`); continue; }
        const dir = moduleDir(modules, mod);
        const base = `src/modules/${dir}/`;
        const sharedRel = '../'.repeat(dir.split('/').length + 2);
        const crud = mod.screens.some(s => CRUD_ROLES.includes(s.role));
        if (crud && !mod.entity?.fields?.length) { warnings.push(`Module ${mod.name} dilewati: CRUD tanpa field entity`); continue; }
        const E = pascalCase(mod.name);
        const pageExports = [], localeEn = {};
        const used = new Set();
        if (crud) {
            files[`${base}types/index.ts`] = typesFile(mod);
            for (const [p, c] of Object.entries(apiFiles(mod, sharedRel))) files[base + p] = c;
            if (mod.entity.fields.some(hasAnyRule)) files[`${base}validation/${camelCase(mod.name)}Validation.ts`] = validationFile(mod, sharedRel);
            files[`${base}api/index.ts`] = `${GEN_HEADER}export * from './queries';\n`;
        }
        const ns = mod.name.replace(/-/g, '_');
        for (const s of mod.screens) {
            const t = trees.get(s.id)?.tree;
            if (!t) { warnings.push(`Screen ${s.name} dilewati: frame tidak ditemukan`); continue; }
            const page = pageFile(ctx, mod, s, t);
            let name = page.name;
            while (used.has(name)) name += '2';
            used.add(name);
            files[`${base}pages/${name}.tsx`] = page.code;
            localeEn[page.key] = page.locale;
            pageExports.push({ name, screen: s });
        }
        const json = JSON.stringify({ [ns]: localeEn }, null, 2) + '\n';
        files[`${base}i18n/en.json`] = json;
        files[`${base}i18n/id.json`] = json;
        files[`${base}index.ts`] = `${GEN_HEADER}${pageExports.map(p => `export { default as ${p.name} } from './pages/${p.name}';`).join('\n')}\n`;
        locales.en[mod.name] = dir;
        if (pageExports.length) imports.push(`import * as ${E}Module from '../../modules/${dir}';`);
        for (const p of pageExports) {
            pages.push(`  { path: ${q(screenPath(modules, mod, p.screen))}, title: ${q(pageTitle(mod, p.screen))}, breadcrumbs: ${JSON.stringify(breadcrumbsOf(modules, mod, p.screen)).replace(/"/g, "'")} },`);
            const route = screenPath(modules, mod, p.screen).slice(1);
            routes.push(route ? `  { path: ${q(route)}, element: <${E}Module.${p.name} /> },` : `  { index: true, element: <${E}Module.${p.name} /> },`);
        }
    }

    const localeImports = Object.values(locales.en).flatMap((dir, i) => [
        `import en${i} from '../../modules/${dir}/i18n/en.json';`, `import id${i} from '../../modules/${dir}/i18n/id.json';`,
    ]);
    const n = Object.keys(locales.en).length;
    files['src/app/generated/locales.ts'] = `${GEN_HEADER}${localeImports.join('\n')}${n ? '\n\n' : ''}export const generatedLocales = {\n  en: [${Array.from({ length: n }, (_, i) => `en${i}`).join(', ')}],\n  id: [${Array.from({ length: n }, (_, i) => `id${i}`).join(', ')}],\n};\n`;
    // Beranda bawaan base project dipakai bila tidak ada module `dashboard` hasil generate.
    const ownHome = routes.some(r => r.includes('index: true'));
    if (!ownHome) {
        imports.unshift("import { DashboardPage } from '../../modules/dashboard';");
        routes.unshift('  { index: true, element: <DashboardPage /> },');
    }
    files['src/app/generated/routes.tsx'] = `${GEN_HEADER}import type { RouteObject } from 'react-router';\n${imports.join('\n')}\n\nexport const generatedRoutes: RouteObject[] = [\n${routes.join('\n')}\n];\n`;
    const iconNames = [...new Set(layout.items.map(i => iconComponent(i.icon)))];
    const navItems = layout.items.filter(i => !i.hidden).map(i => `  { label: ${q(i.label)}, path: ${q(i.path)}, icon: <${iconComponent(i.icon)} className="h-5 w-5" />, permissionKey: ${q(i.permissionKey)} },`);
    if (!ownHome) {
        iconNames.unshift('WidgetIcon');
        navItems.unshift("  { label: 'Dashboard', labelKey: 'nav.dashboard', path: '/', icon: <WidgetIcon className=\"h-5 w-5\" /> },");
    }
    files['src/app/generated/navigation.tsx'] = `${GEN_HEADER}${iconNames.length ? `import { ${[...new Set(iconNames)].join(', ')} } from '@midas/ui-cms';\n` : ''}import type { NavItemType } from '../../shared/types/navigation';\n\nexport const generatedNavItems: NavItemType[] = [\n${navItems.join('\n')}\n];\n`;
    files['src/app/generated/pages.ts'] = `${GEN_HEADER}export interface PageMeta {\n  path: string;\n  title: string;\n  breadcrumbs: { label: string; path?: string }[];\n}\n\n/** Judul & breadcrumb topbar per route (pola path react-router). */\nexport const generatedPages: PageMeta[] = [\n${pages.join('\n')}\n];\n`;
    files['src/app/generated/layout.ts'] = `${GEN_HEADER}export const appLayout = { appName: ${q(layout.appName)} };\n`;
    return { files, warnings, layout };
}

/** Pohon semua screen project (dengan override properti per node) dari konteks dokumen. */
export function buildTrees(config, ctx) {
    return new Map(config.modules.flatMap(m => m.screens.map(s => [s.id, screenTree(ctx, s.frameId, s.nodes || {})])));
}
