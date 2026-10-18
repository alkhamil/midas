// Page generation: one React page per screen (list / create / edit / view / custom).
// Forms use the base project's FormGroup + FormItem (react-hook-form) on a 12-column grid, list pages get a filter
// dialog, pagination, confirm dialogs for delete/restore, and form pages guard against leaving with unsaved changes.
import { activeRules, fieldLabelOf } from '../validate.js';
import { autoAction, detailField, fieldBinding, filterFields, formItemOf, pascalCase, relationOf, screenPath, tableModel, titleCase } from '../model.js';
import { CRUD_ROLES, camelCase, kebabCase } from '../screen.js';
import { FLUID_COMPONENTS, fluid, labelWidthClass, moduleDir, q, styleLit, GEN_HEADER } from './util.js';

const ROLE_PAGE = { list: 'List', create: 'Create', edit: 'Edit', view: 'View' };
/** Page component name: `<Module><Role>Page` for CRUD roles, the screen name for custom screens. */
export const pageNameOf = (mod, screen) => (ROLE_PAGE[screen.role] ? `${pascalCase(mod.name)}${ROLE_PAGE[screen.role]}Page` : `${pascalCase(screen.name)}Page`.replace(/^(\d)/, 'P$1'));

const DIALOG_DEFAULTS = {
    delete: { title: 'Delete this item?', message: 'This action cannot be undone.', cancelLabel: 'Cancel', confirmLabel: 'Delete', tone: 'danger' },
    restore: { title: 'Restore this item?', message: 'It will be available again.', cancelLabel: 'Cancel', confirmLabel: 'Restore', tone: 'primary' },
    discard: { title: 'Discard changes?', message: 'You have unsaved changes. They will be lost if you leave this page.', cancelLabel: 'Stay', confirmLabel: 'Discard', tone: 'danger' },
};

/** Dialog texts from the module's registered dialog screen (design) with the given purpose; falls back to defaults. */
export function dialogTexts(mod, trees, purpose) {
    const s = mod.screens.find(x => x.role === 'dialog' && x.purpose === purpose);
    const find = n => (n ? (n.kind === 'component' && n.exportName === 'Dialog' ? n : (n.children || []).map(find).find(Boolean)) : null);
    const node = s && find(trees.get(s.id)?.tree);
    return { ...DIALOG_DEFAULTS[purpose], ...(node ? Object.fromEntries(['title', 'message', 'cancelLabel', 'confirmLabel', 'tone'].filter(k => node.props[k] != null).map(k => [k, node.props[k]])) : {}) };
}

const hasAnyRule = f => {
    const r = activeRules(f, 'create');
    return r.required || r.min !== null || r.max !== null || r.email || !!r.pattern || r.noEmoticon;
};

/** react-hook-form `rules` object literal for a field (messages come from the base project's `validation.*` i18n keys). */
function rulesCode(f, mode) {
    const label = q(fieldLabelOf(f));
    const r = activeRules(f, mode);
    const parts = [];
    const validate = [];
    if (r.required) parts.push(`required: t('validation.required', { label: ${label} })`);
    if (r.numeric) {
        if (r.min !== null) parts.push(`min: { value: ${r.min}, message: t('validation.minValue', { label: ${label}, count: ${r.min} }) }`);
        if (r.max !== null) parts.push(`max: { value: ${r.max}, message: t('validation.maxValue', { label: ${label}, count: ${r.max} }) }`);
    }
    else {
        if (r.max !== null) parts.push(`maxLength: { value: ${r.max}, message: t('validation.maxLength', { label: ${label}, count: ${r.max} }) }`);
        if (r.min !== null) parts.push(`minLength: { value: ${r.min}, message: t('validation.minLength', { label: ${label}, count: ${r.min} }) }`);
        if (r.email) parts.push("pattern: { value: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/, message: t('validation.email') }");
        if (r.pattern) validate.push(`pattern: (v: unknown) => !v || new RegExp(${q(r.pattern)}).test(String(v)) || t('validation.pattern', { label: ${label} })`);
        if (r.noEmoticon) validate.push("noEmoticon: (v: unknown) => !v || !hasEmoticon(String(v)) || t('validation.noEmoticon')");
    }
    if (validate.length) parts.push(`validate: { ${validate.join(', ')} }`);
    return parts.length ? `{{ ${parts.join(', ')} }}` : null;
}

class PageBuilder {
    constructor(gctx, mod, screen, tree) {
        Object.assign(this, { gctx, mod, screen, tree, ctx: gctx });
        this.ui = new Set();
        this.locale = {};
        this.keys = 0;
        this.role = screen.role;
        this.isForm = screen.role === 'create' || screen.role === 'edit';
        this.needNavigate = false;
        this.usesForm = false; // bound fields → FormGroup
        this.usesRecord = false; // detail value bindings on view screens
        this.usesTable = false;
        this.usesFilterToolbar = false;
        this.usesEmoticon = false;
        this.relations = new Map(); // field name → relation (select options from the target module)
        this.screenKey = ROLE_PAGE[screen.role] ? screen.role : camelCase(screen.name);
    }

    get fields() { return this.mod.entity?.fields || []; }
    get entity() { return this.mod.entity || { fields: [] }; }

    t(text) {
        const key = `t${++this.keys}`;
        this.locale[key] = text;
        return `t('${this.mod.name.replace(/-/g, '_')}.${this.screenKey}.${key}')`;
    }

    /** Relation readable through the target module's generated queries; otherwise null (sample options). */
    relTarget(f) {
        const rel = relationOf(f, this.gctx.modules);
        if (!rel || !rel.module.entity?.fields?.length || !rel.module.screens.some(s => CRUD_ROLES.includes(s.role))) return null;
        return rel;
    }

    /** `navigate(...)` call for "go back": the module's list page when there is one (reliable with the unsaved-changes guard), else history back. */
    back() {
        const list = this.mod.screens.find(s => s.role === 'list');
        return list ? `navigate(${q(screenPath(this.gctx.modules, this.mod, list))})` : 'navigate(-1)';
    }

    effectiveAction(node) {
        return node.cfg?.action || autoAction(this.mod, this.screen, node.props.children ?? node.props.label ?? node.props.actionLabel);
    }

    pathOf(screenId, id) {
        for (const m of this.gctx.modules) {
            const s = m.screens.find(x => x.id === screenId);
            if (s) return screenPath(this.gctx.modules, m, s).replace(':id', id ? `\${${id}}` : ':id');
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

    // ---------------------------------------------------------------- tree → JSX

    emit(node, pad, parent = null) {
        if (node.kind === 'text') return `${pad}<p style={${styleLit(node.style)}}>{${this.t(node.text)}}</p>`;
        if (node.kind === 'formgrid') return this.grid(node, pad);
        if (node.kind === 'box') {
            const style = parent ? fluid(node.style, parent.style) : (({ width: _w, ...r }) => r)(node.style);
            const bound = this.role === 'view' ? this.detailValue(node) : null;
            const kids = node.children.map((c, i) => (bound && i === 1 ? this.detailJsx(c, bound, `${pad}  `) : this.emit(c, `${pad}  `, { ...node, style }))).filter(Boolean);
            return kids.length ? `${pad}<div style={${styleLit(style)}}>\n${kids.join('\n')}\n${pad}</div>` : `${pad}<div style={${styleLit(style)}} />`;
        }
        if (node.kind === 'unsupported') return `${pad}{/* ${node.name}: ${node.reason} */}`;
        const body = this.component(node);
        const boxStyle = fluid(node.box, parent?.style, FLUID_COMPONENTS.has(node.exportName));
        const box = Object.entries(boxStyle || {}).filter(([, v]) => v !== undefined);
        return box.length ? `${pad}<div style={${styleLit(boxStyle)}}>\n${body.split('\n').map(l => `${pad}  ${l}`).join('\n')}\n${pad}</div>` : `${pad}${body}`;
    }

    /** 12-column form grid. */
    grid(node, pad) {
        const items = node.children.map(c => {
            const span = node.spans[c.nodeId] || 12;
            return `${pad}  <div style={{ gridColumn: 'span ${span} / span ${span}' }}>\n${this.field(c, `${pad}    `)}\n${pad}  </div>`;
        });
        return `${pad}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', columnGap: '${node.colGap}px', rowGap: '${node.rowGap}px', alignSelf: 'stretch' }}>\n${items.join('\n')}\n${pad}</div>`;
    }

    /** One form field: FormItem (label + layout + rules) around the library component. */
    field(node, pad) {
        const f = fieldBinding({ fields: this.fields }, node);
        if (!f || !(this.isForm || this.role === 'view')) return `${pad}${this.component(node)}`;
        this.usesForm = true;
        const name = node.exportName;
        this.ui.add(name);
        const fi = formItemOf(node);
        const disabled = this.role === 'view' ? ['disabled'] : [];
        const common = this.attrs(node, ['label', 'value', 'options', 'error', 'checked', 'name', 'onChange', 'disabled']);
        const props = [];
        const rules = this.role === 'view' ? null : rulesCode(f, this.role);
        if (rules && /hasEmoticon/.test(rules)) this.usesEmoticon = true;
        let body;
        if (name === 'SwitchField') {
            body = `<SwitchField ${[...common, `label={${this.t(String(node.props.label ?? fieldLabelOf(f)))}}`, 'checked={Boolean(field.value)}', 'onCheckedChange={field.onChange}', ...disabled].join(' ')} />`;
        }
        else {
            let options = '';
            if (name === 'SelectField') {
                const rel = f.type === 'relation' ? this.relTarget(f) : null;
                if (rel) { this.relations.set(f.name, rel); options = `options={${f.name}Options}`; }
                else if (f.type === 'relation') options = `options={[${[1, 2, 3].map(i => `{ label: ${q(`${titleCase(f.name)} ${i}`)}, value: ${q(String(i))} }`).join(', ')}]}`;
                else options = `options={[${(f.options || []).map(o => `{ label: ${q(titleCase(o))}, value: ${q(o)} }`).join(', ')}]}`;
            }
            body = `<${name} {...field} ${[...common, options, `id=${q(f.name)}`, 'label={undefined}', 'error={fieldState.error?.message}', ...disabled].filter(Boolean).join(' ')} />`;
        }
        const label = name === 'SwitchField' ? null : this.t(String(node.props.label ?? fieldLabelOf(f)));
        props.push(`name=${q(f.name)}`);
        if (label) props.push(`label={${label}}`);
        if (fi.layout === 'horizontal') props.push('layout="horizontal"', `labelWidth="${labelWidthClass(fi.labelWidth)}"`, ...(fi.align === 'center' ? ['align="center"'] : []));
        if (fi.tooltip) props.push(`labelTooltip=${q(fi.tooltip)}`);
        if (rules) props.push(`rules=${rules}`);
        return `${pad}<FormItem ${props.join(' ')}>\n${pad}  {({ ${name === 'SwitchField' ? 'field' : 'field, fieldState'} }) => (\n${pad}    ${body}\n${pad}  )}\n${pad}</FormItem>`;
    }

    // ---------------------------------------------------------------- detail screens (view): bind value texts to the record

    detailValue(node) { return detailField(node, this.fields); }

    detailJsx(node, f, pad) {
        this.usesRecord = true;
        const value = f.type === 'boolean' ? `record?.${f.name} ? 'Active' : 'Inactive'` : `String(record?.${f.name} ?? '')`;
        if (node.kind === 'text') return `${pad}<p style={${styleLit(node.style)}}>{${value}}</p>`;
        this.ui.add('Badge');
        const variant = f.type === 'boolean' ? `record?.${f.name} ? 'success' : 'neutral'` : "'neutral'";
        const inner = `<Badge variant={${variant}}>{${value}}</Badge>`;
        const box = Object.entries(node.box || {}).filter(([, v]) => v !== undefined);
        return box.length ? `${pad}<div style={${styleLit(node.box)}}>${inner}</div>` : `${pad}${inner}`;
    }

    // ---------------------------------------------------------------- components

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
        if (name === 'Table' && this.role === 'list' && this.fields.length) return this.table(node);
        if (name === 'Table') return wrap({ skip: ['columns', 'data', 'rowKey'], attrs: ['columns={[]}', 'data={[]}', 'rowKey={(_row, index) => index}'] });
        if (name === 'FilterToolbar' && this.role === 'list') {
            this.usesFilterToolbar = true;
            return wrap({ attrs: ['searchValue={search}', 'onSearchChange={(v) => { setSearch(v); setPage(1); }}', 'onFilterClick={openFilter}'] });
        }
        if (name === 'SectionHeader') {
            const a = this.effectiveAction(node);
            if (a.type === 'back') { this.needNavigate = true; return wrap({ skip: ['onAction'], attrs: [`onAction={() => ${this.back()}}`] }); }
            if (a.type === 'navigate' && a.screenId) {
                const p = this.pathOf(a.screenId, null);
                if (p && !p.includes(':id')) { this.needNavigate = true; return wrap({ skip: ['onAction'], attrs: [`onAction={() => navigate(${q(p)})}`] }); }
            }
            return wrap();
        }
        if (name === 'Button' || name === 'IconButton') {
            const a = this.effectiveAction(node);
            if (a.type === 'submit' && this.isForm) return wrap({ attrs: ['type="submit"', 'disabled={save.isPending}'] });
            if (a.type === 'back') { this.needNavigate = true; return wrap({ attrs: ['type="button"', `onClick={() => ${this.back()}}`] }); }
            if (a.type === 'navigate' && a.screenId) {
                const p = this.pathOf(a.screenId, null);
                if (p && !p.includes(':id')) { this.needNavigate = true; return wrap({ attrs: [`onClick={() => navigate(${q(p)})}`] }); }
            }
            return wrap();
        }
        return wrap();
    }

    table(node) {
        const t = tableModel(this.entity, node.cfg);
        this.usesTable = true;
        this.tableModel = t;
        const attrs = this.attrs(node, ['columns', 'data', 'rowKey', 'renderAction', 'totalRecords', 'page', 'pageSize', 'onPageChange', 'emptyText', 'actionHeader']);
        const acts = [];
        for (const a of t.rowActions) {
            if (a === 'delete') {
                this.needDelete = true;
                const click = t.confirm ? "setPending({ kind: 'delete', id: row.id })" : 'remove.mutate(row.id)';
                const btn = `<IconButton action="delete" onClick={() => ${click}} />`;
                acts.push(t.softDelete ? `{!row.deletedAt && ${btn}}` : btn);
            }
            else if (a === 'restore') {
                if (!t.softDelete) continue;
                this.needRestore = true;
                const click = t.confirm ? "setPending({ kind: 'restore', id: row.id })" : 'restoreRow.mutate(row.id)';
                acts.push(`{row.deletedAt && <IconButton action="restore" onClick={() => ${click}} />}`);
            }
            else {
                const target = this.mod.screens.find(s => s.role === a);
                if (!target) continue;
                this.needNavigate = true;
                acts.push(`<IconButton action="${a}" onClick={() => navigate(\`${this.pathOf(target.id, 'row.id')}\`)} />`);
            }
        }
        if (acts.length) this.ui.add('IconButton');
        return [
            `<Table${attrs.length ? ` ${attrs.join(' ')}` : ''}`,
            `  columns={columns} data={rows} rowKey={(row) => row.id} totalRecords={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} emptyText=${q(t.emptyText)} actionHeader=${q(t.actionHeader)}`,
            ...(acts.length ? [`  renderAction={(row) => (<div className="flex gap-1">${acts.join('')}</div>)}`] : []),
            '/>',
        ].join('\n');
    }
}

/** Source of one page. */
export function pageFile(gctx, mod, screen, tree) {
    const b = new PageBuilder(gctx, mod, screen, tree);
    const E = pascalCase(mod.name);
    const dirSegs = moduleDir(gctx.modules, mod).split('/').length;
    const sharedRel = '../'.repeat(dirSegs + 2);
    const jsx = b.emit(tree, '      ');
    const hasEntity = b.fields.length > 0;
    const isList = b.role === 'list' && b.usesTable;
    const editing = b.role === 'edit' && hasEntity;
    const viewRecord = b.role === 'view' && (b.usesForm || b.usesRecord);
    const formPage = (b.isForm && hasEntity) || (b.role === 'view' && b.usesForm);
    const needRecord = editing || viewRecord;
    const lines = [], body = [], imports = [], extraDialogs = [];
    const react = new Set(), rr = new Set(), apiHooks = [], typeNames = [];
    const relImports = new Map();
    const relLines = [];
    const useRel = (rel, varName) => {
        const hook = `use${pascalCase(rel.module.name)}List`;
        relImports.set(`${'../'.repeat(dirSegs + 1)}${moduleDir(gctx.modules, rel.module)}/api/queries`, hook);
        relLines.push(`  const ${varName} = ${hook}({ page: 1, size: 1000, search: '' }).data?.rows ?? [];`);
    };
    const navigate = b.needNavigate || formPage;
    if (navigate) rr.add('useNavigate');

    // ---------------------------------------------------------------- list screens
    if (isList) {
        const tm = b.tableModel;
        react.add('useState');
        apiHooks.push(`use${E}List`);
        typeNames.push(E, `${E}Filters`);
        lines.push('  const [page, setPage] = useState(1);', b.usesFilterToolbar ? "  const [search, setSearch] = useState('');" : "  const search = '';");
        lines.push(`  const [filters, setFilters] = useState<${E}Filters>({});`);
        const ffields = filterFields(b.entity, b.tree.cfg);
        const hasFilter = b.usesFilterToolbar && (ffields.length > 0 || tm.softDelete);
        const confirms = [];
        if (b.needDelete) { apiHooks.push(`useDelete${E}`); lines.push(`  const remove = useDelete${E}();`); if (tm.confirm) confirms.push('delete'); }
        if (b.needRestore) { apiHooks.push(`useRestore${E}`); lines.push(`  const restoreRow = useRestore${E}();`); if (tm.confirm) confirms.push('restore'); }
        if (confirms.length) lines.push("  const [pending, setPending] = useState<{ kind: 'delete' | 'restore'; id: string } | null>(null);");
        lines.push(`  const { data } = use${E}List({ page, size: PAGE_SIZE, search, filters });`, '  const rows = data?.rows ?? [];', '  const total = data?.total ?? 0;');
        // relation columns resolve ids to labels with the target module's list
        const relCols = new Map();
        for (const c of tm.columns) {
            if (c.type !== 'relation') continue;
            const rel = b.relTarget(b.fields.find(f => f.name === c.key));
            if (rel) { relCols.set(c.key, rel); useRel(rel, `${c.key}Rel`); }
        }
        lines.push(...relLines.splice(0));
        const cols = tm.columns.map(c => {
            const rel = relCols.get(c.key);
            const w = c.width ? `, width: ${c.width}` : c.type === 'boolean' ? ', width: 120' : c.type === 'enum' ? ', width: 140' : '';
            let render = '';
            if (rel) render = `, render: (r) => String(${c.key}Rel.find((o) => o.id === r.${c.key})?.${rel.labelField} ?? r.${c.key})`;
            else if (c.type === 'boolean') { b.ui.add('Badge'); render = `, render: (r) => <Badge variant={r.${c.key} ? 'success' : 'neutral'}>{r.${c.key} ? 'Active' : 'Inactive'}</Badge>`; }
            else if (c.type === 'enum') { b.ui.add('Badge'); render = `, render: (r) => <Badge variant="neutral">{String(r.${c.key})}</Badge>`; }
            return `    { key: ${q(c.key)}, header: ${q(c.header)}${w}${render} },`;
        });
        lines.push(`  const columns: Column<${E}>[] = [\n${cols.join('\n')}\n  ];`);
        body.push(`const PAGE_SIZE = ${tm.pageSize};`, '');
        // confirm dialogs
        for (const kind of confirms) {
            const d = dialogTexts(mod, gctx.trees, kind);
            b.ui.add('Dialog');
            const act = kind === 'delete' ? 'remove' : 'restoreRow';
            extraDialogs.push(`      <Dialog
        open={pending?.kind === '${kind}'}
        onClose={() => setPending(null)}
        onConfirm={() => { if (pending) ${act}.mutate(pending.id); setPending(null); }}
        tone="${d.tone}"
        title={${b.t(d.title)}}
        message={${b.t(d.message)}}
        cancelLabel={${b.t(d.cancelLabel)}}
        confirmLabel={${b.t(d.confirmLabel)}}
      />`);
        }
        // filter dialog
        if (hasFilter) {
            b.ui.add('Dialog'); b.ui.add('Button');
            lines.push(`  const [filterOpen, setFilterOpen] = useState(false);`, `  const [draft, setDraft] = useState<${E}Filters>({});`, '  const openFilter = () => { setDraft(filters); setFilterOpen(true); };');
            const fieldsJsx = ffields.map(f => {
                const set = `onChange={(e) => setDraft((d) => ({ ...d, ${f.name}: e.target.value }))}`;
                const label = q(fieldLabelOf(f));
                const all = `{ label: ${b.t('All')}, value: '' }`;
                if (f.type === 'enum' || f.type === 'relation' || f.type === 'boolean') {
                    b.ui.add('SelectField');
                    let opts;
                    if (f.type === 'enum') opts = (f.options || []).map(o => `{ label: ${q(titleCase(o))}, value: ${q(o)} }`).join(', ');
                    else if (f.type === 'boolean') opts = `{ label: ${b.t('Yes')}, value: 'true' }, { label: ${b.t('No')}, value: 'false' }`;
                    else {
                        const rel = b.relTarget(f);
                        if (rel) { useRel(rel, `${f.name}FilterRel`); lines.push(...relLines.splice(0)); opts = null; }
                        else opts = [1, 2, 3].map(i => `{ label: ${q(`${titleCase(f.name)} ${i}`)}, value: ${q(String(i))} }`).join(', ');
                    }
                    const optionsExpr = opts === null ? `[${all}, ...${f.name}FilterRel.map((r) => ({ label: String(r.${relationOf(f, gctx.modules)?.labelField} ?? ''), value: r.id }))]` : `[${all}${opts ? `, ${opts}` : ''}]`;
                    return `          <SelectField label=${label} value={draft.${f.name} ?? ''} options={${optionsExpr}} ${set} />`;
                }
                b.ui.add('TextField');
                return `          <TextField label=${label} value={draft.${f.name} ?? ''} ${set} />`;
            });
            if (tm.softDelete) {
                b.ui.add('SwitchField');
                fieldsJsx.push(`          <SwitchField label={${b.t('Show deleted')}} checked={draft.showDeleted === 'true'} onCheckedChange={(on) => setDraft((d) => ({ ...d, showDeleted: on ? 'true' : '' }))} />`);
            }
            extraDialogs.push(`      <Dialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={${b.t('Filters')}}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDraft({}); setFilters({}); setPage(1); setFilterOpen(false); }}>{${b.t('Reset')}}</Button>
            <Button onClick={() => { setFilters(draft); setPage(1); setFilterOpen(false); }}>{${b.t('Apply')}}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
${fieldsJsx.join('\n')}
        </div>
      </Dialog>`);
        }
        if (b.usesFilterToolbar && !hasFilter) lines.push('  const openFilter = () => {};');
    }

    // ---------------------------------------------------------------- form / detail screens
    if (needRecord) {
        rr.add('useParams');
        apiHooks.push(`use${E}Detail`);
        lines.push("  const { id = '' } = useParams();", `  const { data: record } = use${E}Detail(id);`);
    }
    if (needRecord && !formPage) lines.push(`  if (!record) return <div data-testid="${kebabCase(mod.name)}-${b.role}-page" />;`);
    if (formPage) {
        const input = `${E}Input`;
        typeNames.push(input);
        const defaults = b.fields.map(f => `${f.name}: ${f.type === 'boolean' ? 'false' : f.type === 'number' ? '0' : f.type === 'enum' ? q(f.options?.[0] ?? '') : "''"}`).join(', ');
        if (!needRecord) body.push(`const DEFAULTS: ${input} = { ${defaults} };`, '');
        for (const [name, rel] of b.relations) {
            useRel(rel, `${name}Rel`);
            relLines.push(`  const ${name}Options = ${name}Rel.map((r) => ({ label: String(r.${rel.labelField} ?? ''), value: r.id }));`);
        }
        lines.push(...relLines.splice(0));
        if (b.isForm) {
            react.add('useRef');
            apiHooks.push(b.role === 'create' ? `useCreate${E}` : `useUpdate${E}`);
            lines.push(`  const save = ${b.role === 'create' ? `useCreate${E}()` : `useUpdate${E}()`};`, '  const bypassGuard = useRef(false);');
            lines.push(`  const onSubmit = async (values: ${input}) => {`, b.role === 'create' ? '    await save.mutateAsync(values);' : '    await save.mutateAsync({ id, input: values });', '    bypassGuard.current = true;', `    ${b.back()};`, '  };');
        }
        if (needRecord) lines.push(`  if (!record) return <div data-testid="${kebabCase(mod.name)}-${b.role}-page" />;`, '  const { id: _id, ...recordInput } = record;');
        // The unsaved-changes dialog texts come from the module's "discard" dialog design.
        if (b.isForm) {
            const d = dialogTexts(mod, gctx.trees, 'discard');
            extraDialogs.push(`        <LeaveGuard bypass={bypassGuard} title={${b.t(d.title)}} message={${b.t(d.message)}} cancelLabel={${b.t(d.cancelLabel)}} confirmLabel={${b.t(d.confirmLabel)}} />`);
        }
    }

    // ---------------------------------------------------------------- imports
    const ui = new Set(b.ui);
    const uiList = [...ui].sort();
    if (isList) uiList.push('type Column');
    if (react.size) imports.push(`import { ${[...react].sort().join(', ')} } from 'react';`);
    imports.push("import { useTranslation } from 'react-i18next';");
    if (rr.size) imports.push(`import { ${[...rr].join(', ')} } from 'react-router';`);
    if (uiList.length) imports.push(`import { ${uiList.join(', ')} } from '@midas/ui-cms';`);
    if (formPage) imports.push(`import { FormGroup, FormItem } from '${sharedRel}shared/components/form';`);
    if (formPage && b.isForm) imports.push(`import LeaveGuard from '${sharedRel}shared/components/LeaveGuard';`);
    if (b.usesEmoticon) imports.push(`import { hasEmoticon } from '${sharedRel}shared/utils';`);
    if (apiHooks.length) imports.push(`import { ${[...new Set(apiHooks)].join(', ')} } from '../api/queries';`);
    for (const [path, hook] of relImports) imports.push(`import { ${hook} } from '${path}';`);
    if (hasEntity && (isList || formPage || needRecord)) imports.push(`import type { ${[...new Set(typeNames)].join(', ')} } from '../types';`);

    // ---------------------------------------------------------------- render
    const tid = `"${kebabCase(mod.name)}-${b.role}-page"`;
    const name = pageNameOf(mod, screen);
    let out;
    if (formPage) {
        const defaultValues = needRecord ? 'recordInput' : 'DEFAULTS';
        const guard = extraDialogs.join('\n');
        out = [
            `    <FormGroup<${E}Input> key={${needRecord ? 'record.id' : "'new'"}} defaultValues={${defaultValues}} onSubmit={${b.isForm ? 'onSubmit' : '() => {}'}} testId=${tid} mode="onSubmit">`,
            '      {() => (',
            '        <>',
            ...(guard ? [guard] : []),
            jsx,
            '        </>',
            '      )}',
            '    </FormGroup>',
        ];
    }
    else out = [`    <div data-testid=${tid}>`, jsx, ...extraDialogs, '    </div>'];
    const code = [GEN_HEADER.trim(), ...imports, '', ...body, `function ${name}() {`, '  const { t } = useTranslation();', ...(navigate ? ['  const navigate = useNavigate();'] : []), ...lines, '  return (', ...out, '  );', '}', '', `export default ${name};`, ''].join('\n');
    return { name, code, locale: b.locale, key: b.screenKey, hasEntity };
}
