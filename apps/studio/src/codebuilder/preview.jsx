// Preview app (spec §4.5): live, clickable preview of the Code Builder project. Screens are rendered with the real
// library components inside the app layout; buttons, sidebar, breadcrumbs and row actions navigate between screens,
// the list screens have sample data you can search, filter, page, delete and restore, and forms validate and save. It mirrors
// the generated app (same rules, messages, dialogs and unsaved-changes guard). Nothing here is persisted.
import { createElement as h, Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { activeNavPath, autoAction, breadcrumbsOf, dialogTexts, fieldLabelOf, filterFields, findTreeNode, makeContext, normalizeInteractions, pageTitle, relationOf, resolveLayout, sampleRows, screenPath, screenTree, tableModel, titleCase, validateField, validateValues } from '@midas/builder-core';
import { builderApi } from '../storage.js';
import { cssUrlOf, loadBundle } from './loader.js';
import { LiveFrame } from './Renderer.jsx';

let host = null, root = null;
const LAST_KEY = fileId => `midas-builder-project:${fileId}`;

function close() {
    root?.unmount();
    host?.remove();
    host = root = null;
}

/** Opens the preview for the file's Code Builder project; resolves false when the file has none (caller falls back). */
export async function openAppPreview(bridge) {
    if (host) return true;
    const fileId = bridge.fileId();
    let list;
    try {
        list = await builderApi.list(fileId);
    }
    catch {
        return false;
    }
    const usable = list.filter(p => p.screens > 0);
    if (!usable.length) return false;
    const last = localStorage.getItem(LAST_KEY(fileId));
    const project = await builderApi.get((usable.find(p => p.id === last) || usable[0]).id);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    root.render(<AppPreview bridge={bridge} project={project} onClose={close} />);
    return true;
}

const defaultsOf = fields => Object.fromEntries(fields.map(f => [f.name, f.type === 'boolean' ? false : f.type === 'number' ? 0 : f.type === 'enum' ? (f.options?.[0] ?? '') : '']));
const sameValues = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Row filter shared by search and the filter dialog (same semantics as the generated mock API). */
function matchesFilters(fields, row, filters) {
    for (const [key, value] of Object.entries(filters)) {
        if (!value || key === 'showDeleted') continue;
        const f = fields.find(x => x.name === key);
        const current = row[key];
        if (typeof current === 'boolean' || f?.type === 'enum' || f?.type === 'relation') { if (String(current) !== value) return false; }
        else if (!String(current ?? '').toLowerCase().includes(value.toLowerCase())) return false;
    }
    return true;
}

/** Filter drawer of the list screen (draft values applied on Apply). */
function FilterDialog({ lib, fields, softDelete, filters, relOptions, onApply, onClose }) {
    const [draft, setDraft] = useState(filters);
    const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
    const all = { label: 'All', value: '' };
    const controls = fields.map(f => {
        const label = fieldLabelOf(f);
        if (f.type === 'enum' || f.type === 'relation' || f.type === 'boolean') {
            const opts = f.type === 'enum' ? (f.options || []).map(o => ({ label: titleCase(o), value: o })) : f.type === 'boolean' ? [{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }] : relOptions(f);
            return h(lib.SelectField, { key: f.name, label, value: draft[f.name] ?? '', options: [all, ...opts], onChange: e => set(f.name, e.target.value) });
        }
        return h(lib.TextField, { key: f.name, label, value: draft[f.name] ?? '', onChange: e => set(f.name, e.target.value) });
    });
    if (softDelete) controls.push(h(lib.SwitchField, { key: 'showDeleted', label: 'Show deleted', checked: draft.showDeleted === 'true', onCheckedChange: on => set('showDeleted', on ? 'true' : '') }));
    return h(lib.Drawer, { open: true, onClose, title: 'Filters', secondaryLabel: 'Reset', primaryLabel: 'Apply', onSecondary: () => onApply({}), onPrimary: () => onApply(draft) },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } }, controls));
}

function AppPreview({ bridge, project, onClose }) {
    const [lib, setLib] = useState(null);
    const [mappings, setMappings] = useState(null);
    const [error, setError] = useState(null);
    const [stack, setStack] = useState([]);
    const [rowsByModule, setRowsByModule] = useState(() => new Map());
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({});
    const [page, setPage] = useState(1);
    const [sizeChoice, setSizeChoice] = useState(null); // rows per page picked in the table footer (default: the table's page size, 10)
    const [toast, setToast] = useState('');
    const [dialog, setDialog] = useState(null); // { kind: 'delete' | 'restore' | 'discard' | 'filter', ... }
    const [openDialog, setOpenDialog] = useState(null); // screen dialog yang dibuka oleh interaction
    const [form, setForm] = useState({ values: {}, initial: {}, errors: {}, submitted: false });
    const bypass = useRef(false);
    const library = project.library;

    useEffect(() => {
        if (!library?.bundleUrl) return setError(`Bundle ${library ? `${library.packageName}@${library.version}` : 'library'} is not available yet. Run \`npm run bundle\` (midas bundle) in the package repo.`);
        Promise.all([loadBundle(library.bundleUrl), builderApi.mappings(library.id, library.version)]).then(([l, m]) => { setLib(l); setMappings(m); }, e => setError(e.message));
    }, [library?.bundleUrl]);

    const modules = project.config.modules;
    const layout = useMemo(() => resolveLayout(project.config), [project]);
    const screens = useMemo(() => modules.flatMap(m => m.screens.filter(s => s.role !== 'dialog').map(s => ({ ...s, module: m }))), [modules]);
    const ctx = useMemo(() => mappings && makeContext({ nodes: bridge.nodes(), variables: bridge.variables(), mappings, libraryId: library?.id, fileId: bridge.fileId() }), [mappings, bridge, library?.id]);

    // First screen: the home page (module `dashboard`), otherwise the first menu item's main screen.
    const mainScreenOf = useCallback(m => m.screens.find(s => s.role === 'list') || m.screens.find(s => s.role === 'custom') || m.screens.find(s => s.role !== 'dialog'), []);
    const home = useMemo(() => {
        // The first menu entry that leads somewhere (a parent group has no page of its own; its first child does).
        const entry = layout.items.flatMap(i => [i, ...(i.children || [])]).find(i => i.path);
        const first = entry && modules.find(m => m.id === entry.moduleId);
        return first && mainScreenOf(first);
    }, [layout, modules, mainScreenOf]);
    useEffect(() => { if (home && !stack.length) setStack([{ screenId: home.id }]); }, [home]);

    const current = stack.at(-1);
    const screen = screens.find(s => s.id === current?.screenId);
    const module = screen?.module;
    const entity = module ? { ...module.entity, moduleName: module.name } : null;
    const fields = module?.entity?.fields || [];
    const isForm = screen?.role === 'create' || screen?.role === 'edit';
    const mode = screen?.role === 'edit' ? 'edit' : 'create';
    const trees = useMemo(() => (ctx && screen ? screenTree(ctx, screen.frameId, screen.nodes) : null), [ctx, screen]);
    const dialogTrees = useMemo(() => new Map(ctx && module ? module.screens.filter(s => s.role === 'dialog').map(s => [s.id, screenTree(ctx, s.frameId, s.nodes)]) : []), [ctx, module]);
    // Semua screen dialog (semua module): target interaction "open dialog".
    const allDialogTrees = useMemo(() => {
        const m = new Map();
        if (!ctx) return m;
        for (const mod of modules) for (const s of mod.screens.filter(x => x.role === 'dialog')) m.set(s.id, screenTree(ctx, s.frameId, s.nodes));
        return m;
    }, [ctx, modules]);
    const tableNode = useMemo(() => {
        const find = n => (n ? (n.kind === 'component' && n.exportName === 'Table' ? n : (n.children || []).map(find).find(Boolean)) : null);
        return find(trees?.tree);
    }, [trees]);
    const table = useMemo(() => (tableNode ? tableModel(module?.entity, tableNode.cfg) : null), [tableNode, module]);

    const rowsOf = useCallback(m => rowsByModule.get(m.id) || sampleRows(m.entity?.fields || [], 5, m.name), [rowsByModule]);
    const setRows = (m, fn) => setRowsByModule(map => new Map(map).set(m.id, fn(rowsOf(m))));

    // New screen entry (navigation, restart): reset list state and load the form values.
    const entryKey = `${stack.length}:${current?.screenId}:${current?.recordId ?? ''}:${current?.n ?? 0}`;
    useEffect(() => {
        setSearch(''); setFilters({}); setPage(1); setSizeChoice(null); setDialog(null); bypass.current = false;
        if (!screen) return;
        const record = current?.recordId ? rowsOf(screen.module).find(r => r.id === current.recordId) : null;
        const base = defaultsOf(fields);
        const { id: _id, deletedAt: _d, ...rest } = record || {};
        const values = screen.role === 'create' ? base : { ...base, ...rest };
        setForm({ values, initial: values, errors: {}, submitted: false });
    }, [entryKey]);
    const dirty = isForm && !sameValues(form.values, form.initial);

    // Navigation always passes the unsaved-changes guard.
    const flash = useCallback(text => { setToast(text); setTimeout(() => setToast(''), 1800); }, []);
    const guarded = useCallback(fn => {
        if (dirty && !bypass.current) setDialog({ kind: 'discard', proceed: fn });
        else fn();
    }, [dirty]);
    const go = useCallback((screenId, recordId) => guarded(() => setStack(st => [...st, { screenId, recordId, n: st.length }])), [guarded]);
    const back = useCallback(() => guarded(() => setStack(st => (st.length > 1 ? st.slice(0, -1) : st))), [guarded]);
    const byPath = useCallback(path => {
        for (const s of screens) if (screenPath(modules, s.module, s) === path) return s;
        const it = layout.items.flatMap(i => [i, ...(i.children || [])]).find(i => i.path === path);
        const m = it && modules.find(x => x.id === it.moduleId);
        return m && mainScreenOf(m);
    }, [screens, modules, layout, mainScreenOf]);

    const relOptions = useCallback(f => {
        const rel = relationOf(f, modules);
        if (!rel) return [];
        return rowsOf(rel.module).filter(r => !r.deletedAt).map(r => ({ label: String(r[rel.labelField] ?? ''), value: r.id }));
    }, [modules, rowsOf]);

    // List pipeline: soft delete → search → filters → page.
    const pageSize = sizeChoice ?? (table?.pageSize || 10);
    const visible = useMemo(() => {
        if (!module) return [];
        const q = search.trim().toLowerCase();
        let rows = rowsOf(module);
        if (!(table?.softDelete && filters.showDeleted === 'true') && table?.softDelete) rows = rows.filter(r => !r.deletedAt);
        if (q) rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
        return rows.filter(r => matchesFilters(fields, r, filters));
    }, [module, rowsOf, search, filters, table, fields]);
    const pageRows = visible.slice((page - 1) * pageSize, page * pageSize);

    const submit = useCallback(() => {
        if (!isForm) return;
        const errors = validateValues(fields, form.values, mode);
        setForm(f => ({ ...f, errors, submitted: true }));
        if (Object.keys(errors).length) return;
        if (screen.role === 'create') setRows(module, rows => [{ id: String(Date.now()), ...form.values }, ...rows]);
        else setRows(module, rows => rows.map(r => (r.id === current.recordId ? { ...r, ...form.values } : r)));
        bypass.current = true;
        flash('Saved (preview only)');
        setStack(st => (st.length > 1 ? st.slice(0, -1) : st));
    }, [isForm, fields, form.values, mode, screen, module, current, flash, rowsOf]);

    const dlgFor = purpose => (module ? dialogTexts(module, dialogTrees, purpose) : null);
    const rowActionHandler = (kind, row) => {
        if (kind === 'view' || kind === 'edit') {
            const t = module.screens.find(s => s.role === kind);
            return t ? go(t.id, row.id) : flash(`This module has no ${kind} screen`);
        }
        if (table?.confirm) return setDialog({ kind, row });
        applyRow(kind, row);
    };
    const applyRow = (kind, row) => {
        if (kind === 'delete') setRows(module, rows => (table?.softDelete ? rows.map(r => (r.id === row.id ? { ...r, deletedAt: new Date().toISOString() } : r)) : rows.filter(r => r.id !== row.id)));
        else setRows(module, rows => rows.map(r => (r.id === row.id ? { ...r, deletedAt: null } : r)));
        flash(kind === 'delete' ? 'Deleted (preview only)' : 'Restored (preview only)');
    };

    const ix = useMemo(() => {
        if (!screen) return null;
        const target = role => module.screens.find(s => s.role === role);
        return {
            role: screen.role, mode, record: screen.role === 'view' ? rowsOf(module).find(r => r.id === current.recordId) : null,
            search, setSearch: v => { setSearch(v); setPage(1); }, page, setPage, pageSize, setPageSize: s => { setSizeChoice(s); setPage(1); }, pageRows, total: visible.length,
            openFilter: () => setDialog({ kind: 'filter' }), relOptions,
            rowAction: rowActionHandler,
            fieldProps: (node, f) => ({
                value: form.values[f.name],
                onChange: e => {
                    const v = e && typeof e === 'object' && 'target' in e ? e.target.value : e;
                    setForm(fm => ({ ...fm, values: { ...fm.values, [f.name]: v }, errors: fm.submitted ? { ...fm.errors, [f.name]: validateField(f, v, mode) } : fm.errors }));
                },
                onBlur: undefined, error: form.errors[f.name],
            }),
            press: node => {
                // Interaction dari tab Behavior lebih dulu; baru action bawaan (cfg.action / tebakan).
                const list = normalizeInteractions(node.cfg?.interactions).filter(i => i.trigger === 'onClick');
                if (list.length) {
                    for (const it of list) {
                        const a = it.action;
                        if (a.type === 'navigate' && a.targetFrameId) go(a.targetFrameId);
                        else if (a.type === 'submit') submit();
                        else if (a.type === 'back') back();
                        else if (a.type === 'open-dialog' && a.targetFrameId) setOpenDialog(a.targetFrameId);
                        else if (a.type === 'close-dialog') setOpenDialog(null);
                        else flash('This interaction has no target yet — set one in the Behavior tab');
                    }
                    return;
                }
                const label = node.props.children ?? node.props.label ?? node.props.actionLabel;
                const a = node.cfg?.action || autoAction(module, screen, label);
                if (a.type === 'back') back();
                else if (a.type === 'navigate' && a.screenId) go(a.screenId);
                else if (a.type === 'submit') submit();
                else flash('This button has no action yet — set one in the Behavior tab');
            },
            overlay: lib && dialog && (() => {
                if (dialog.kind === 'filter')
                    return h(FilterDialog, { lib, fields: filterFields(module.entity, trees?.tree?.cfg), softDelete: !!table?.softDelete, filters, relOptions, onClose: () => setDialog(null), onApply: f => { setFilters(f); setPage(1); setDialog(null); } });
                const d = dlgFor(dialog.kind);
                const run = () => {
                    const dd = dialog;
                    setDialog(null);
                    if (dd.kind === 'discard') { bypass.current = true; dd.proceed(); bypass.current = false; setForm(f => ({ ...f, initial: f.values })); }
                    else applyRow(dd.kind, dd.row);
                };
                return h(lib.Dialog, { open: true, onClose: () => setDialog(null), onConfirm: run, tone: d.tone, title: d.title, message: d.message, cancelLabel: d.cancelLabel, confirmLabel: d.confirmLabel });
            })(),
        };
    }, [screen, module, mode, current, search, page, pageSize, pageRows, visible, form, filters, dialog, table, lib, go, back, submit, rowsOf, relOptions]);

    const shell = useMemo(() => screen && ({
        layout,
        title: pageTitle(screen.module, screen),
        breadcrumbs: breadcrumbsOf(modules, screen.module, screen),
        activePath: activeNavPath(layout, modules, screen.module),
        onNavigate: path => { const t = byPath(path); if (t) go(t.id); },
        onSignOut: () => flash('Signed out (preview only)'),
    }), [screen, layout, modules, byPath, go, flash]);
    const path = screen ? screenPath(modules, screen.module, screen).replace(':id', current.recordId ?? ':id') : '';

    useEffect(() => {
        const on = e => e.key === 'Escape' && !dialog && onClose();
        window.addEventListener('keydown', on);
        return () => window.removeEventListener('keydown', on);
    }, [onClose, dialog]);

    return (
        <div className="cb-preview" role="dialog" aria-label="Preview app">
            <div className="cb-preview-bar">
                <button className="cb-back" onClick={back} disabled={stack.length < 2} title="Back">← Back</button>
                <button className="cb-back" onClick={() => { setStack(home ? [{ screenId: home.id, n: Date.now() }] : []); setRowsByModule(new Map()); }} title="Restart the preview and reset sample data">↺ Restart</button>
                <span className="cb-preview-url">{path || '/'}</span>
                <span className="small-label">{project.name} · live preview — nothing is saved{dirty ? ' · unsaved changes' : ''}</span>
                <span className="cb-spacer" />
                <button className="wide-button primary" onClick={onClose}>Close preview</button>
            </div>
            <div className="cb-preview-body">
                {error ? <div className="cb-empty cb-grow"><b>Preview app</b><p className="small-label">{error}</p></div>
                    : !lib || !ctx ? <div className="cb-empty cb-grow"><p className="small-label">Loading library components…</p></div>
                        : trees?.tree ? <LiveFrame tree={trees.tree} lib={lib} cssUrl={cssUrlOf(library.bundleUrl)} interactive={ix} entity={entity} modules={modules} shell={shell} vars={ctx.vars} />
                            : <div className="cb-empty cb-grow"><p className="small-label">{trees?.issues[0]?.message || 'This project has no screens yet.'}</p></div>}
                {openDialog && allDialogTrees.get(openDialog)?.tree && (
                    <div className="cb-preview-modal" onClick={() => setOpenDialog(null)}>
                        <div className="cb-preview-modal-card" onClick={e => e.stopPropagation()}>
                            <LiveFrame tree={allDialogTrees.get(openDialog).tree} lib={lib} cssUrl={cssUrlOf(library.bundleUrl)} interactive={ix} entity={entity} modules={modules} vars={ctx.vars} />
                        </div>
                    </div>
                )}
                {toast && <div className="cb-preview-toast">{toast}</div>}
            </div>
        </div>
    );
}

