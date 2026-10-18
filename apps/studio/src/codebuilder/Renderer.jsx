// Live DOM Renderer (spec §4.3): screen dirender dengan komponen asli dari bundle library project, di dalam
// iframe supaya CSS library (Tailwind preflight, token) tidak bocor ke Studio. React tetap milik Studio
// (lihat loader.js), jadi root React dibuat langsung di dokumen iframe.
import { Component, createContext, createElement as h, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { activeRules, detailField, fieldBinding, fieldLabelOf, formItemOf, pascalCase, previewDataProps, relationSampleOptions, tableModel, titleCase } from '@midas/builder-core';

class Boundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error) {
        this.props.onError?.(this.props.nodeId, error);
    }
    render() {
        if (!this.state.error) return this.props.children;
        return h('div', { className: 'midas-broken', title: String(this.state.error?.message || this.state.error) }, `${this.props.name}: ${this.state.error?.message || 'failed to render'}`);
    }
}

const FIELD_ATTRS = ['label', 'value', 'options', 'error', 'checked', 'name', 'onChange'];

/** Look-alike of the base project's FormItem (label above / beside the field, required asterisk, tooltip). Inline styles
 *  only: the iframe has just the library's compiled CSS, not the app's Tailwind classes. */
function FormItemBox({ label, required, fi, children }) {
    const labelEl = label && h('label', { style: { fontSize: 14, fontWeight: 500, lineHeight: '20px', color: 'var(--theme-foreground)' } },
        label,
        required && h('span', { style: { marginLeft: 2, color: 'var(--theme-danger)' } }, '*'),
        fi.tooltip && h('span', { title: fi.tooltip, style: { marginLeft: 4, cursor: 'help', color: 'var(--theme-muted-foreground)' } }, 'ⓘ'));
    if (fi.layout === 'horizontal')
        return h('div', { style: { display: 'flex', gap: 16, alignItems: fi.align === 'center' ? 'center' : 'flex-start' } },
            h('div', { style: { width: fi.labelWidth, flexShrink: 0 } }, labelEl), h('div', { style: { flex: 1, minWidth: 0 } }, children));
    return h('div', null, label && h('div', { style: { marginBottom: 6 } }, labelEl), children);
}

function FieldItem({ node, rc }) {
    const { lib, entity, modules, ix } = rc;
    const f = fieldBinding(entity, node);
    const Comp = lib[node.exportName];
    if (!f || typeof Comp === 'undefined') return h(RenderNode, { node, rc });
    const fi = formItemOf(node);
    const isSwitch = node.exportName === 'SwitchField';
    const live = ix?.fieldProps ? ix.fieldProps(node, f) : null;
    const options = node.exportName === 'SelectField' ? (f.type === 'relation' ? (ix?.relOptions ? ix.relOptions(f) : relationSampleOptions(f, modules)) : (f.options || []).map(o => ({ label: titleCase(o), value: o }))) : undefined;
    const base = Object.fromEntries(Object.entries(node.props).filter(([k]) => !FIELD_ATTRS.includes(k)));
    const label = String(node.props.label ?? fieldLabelOf(f));
    const props = isSwitch ? { ...base, label, checked: live ? !!live.value : false, onCheckedChange: live?.onChange } : { ...base, label: undefined, options, ...(live ? { value: live.value ?? '', onChange: live.onChange, onBlur: live.onBlur, error: live.error } : {}) };
    const body = h(Boundary, { nodeId: node.nodeId, name: node.exportName, onError: rc.onError }, h(Comp, props));
    const data = { 'data-node': node.nodeId, 'data-name': node.name || '' };
    return h('div', { ...data, className: 'midas-component' },
        isSwitch ? body : h(FormItemBox, { label, required: activeRules(f, ix?.mode || 'create').required, fi }, body));
}

function FormGrid({ node, rc }) {
    return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', columnGap: node.colGap, rowGap: node.rowGap, alignSelf: 'stretch' } },
        node.children.map(c => h('div', { key: c.nodeId, style: { gridColumn: `span ${node.spans[c.nodeId] || 12} / span ${node.spans[c.nodeId] || 12}` } }, h(FieldItem, { node: c, rc }))));
}

/** Detail row on a view screen: the value text / badge shows the record's value (interactive preview only). */
function detailValueNode(node, rc, f, child) {
    const record = rc.ix?.record;
    if (!record) return child;
    const value = f.type === 'boolean' ? (record[f.name] ? 'Active' : 'Inactive') : String(record[f.name] ?? '');
    if (child.kind === 'text') return { ...child, text: value };
    return { ...child, props: { ...child.props, label: value, children: value, ...(f.type === 'boolean' ? { variant: record[f.name] ? 'success' : 'neutral' } : {}) } };
}

function RenderNode({ node, rc }) {
    const { lib, preview, entity, modules, ix } = rc;
    const data = { 'data-node': node.nodeId, 'data-name': node.name || '' };
    if (node.kind === 'text') return h('p', { ...data, style: node.style }, node.text);
    if (node.kind === 'formgrid') return h(FormGrid, { node, rc });
    if (node.kind === 'box') {
        const bound = ix?.role === 'view' ? detailField(node, entity?.fields || []) : null;
        return h('div', { ...data, style: node.style }, node.children.map((c, i) => h(RenderNode, { key: c.nodeId, node: bound && i === 1 ? detailValueNode(node, rc, bound, c) : c, rc })));
    }
    if (node.kind === 'component') {
        const Comp = lib[node.exportName];
        if (typeof Comp !== 'function' && typeof Comp !== 'object')
            return h('div', { ...data, className: 'midas-missing', style: node.box }, `${node.exportName} is not in the bundle`);
        const name = node.exportName;
        const isTable = name === 'Table';
        const t = isTable ? tableModel(entity, node.cfg) : null;
        // Row actions follow the Table configuration (and soft delete: restore for deleted rows, delete otherwise).
        const renderAction = t?.rowActions.length && typeof lib.IconButton === 'function'
            ? row => h('div', { className: 'flex gap-1' }, t.rowActions
                .filter(a => (a === 'restore' ? t.softDelete && row.deletedAt : a === 'delete' ? !(t.softDelete && row.deletedAt) : true))
                .map(a => h(lib.IconButton, { key: a, action: a, onClick: ix ? () => ix.rowAction(a, row) : undefined })))
            : undefined;
        let props = { ...preview[name], ...previewDataProps(node, entity, { renderAction }, modules), ...node.props };
        // Interactive preview: buttons, search, filter, pagination and row actions really work.
        if (ix) {
            if (name === 'Button' || name === 'IconButton') props = { ...props, onClick: () => ix.press(node) };
            else if (name === 'SectionHeader') props = { ...props, onAction: () => ix.press(node) };
            else if (name === 'FilterToolbar') props = { ...props, searchValue: ix.search, onSearchChange: ix.setSearch, onFilterClick: ix.openFilter };
            else if (isTable && entity?.fields?.length && props.columns?.length)
                props = { ...props, data: ix.pageRows, totalRecords: ix.total, page: ix.page, pageSize: t.pageSize, onPageChange: ix.setPage };
        }
        const body = h(Comp, props);
        return h('div', { ...data, className: 'midas-component', style: node.box },
            h(Boundary, { nodeId: node.nodeId, name, onError: rc.onError }, body));
    }
    return h('div', { ...data, className: 'midas-unsupported', style: node.box, title: node.reason }, node.name || 'Unsupported');
}

/** Provider router & i18n dari bundle (`__midasRuntime`), bila library memakainya. */
function useRuntime(lib) {
    const ref = useRef(null);
    if (!ref.current || ref.current.lib !== lib) {
        const rt = lib.__midasRuntime || {};
        let i18n = null;
        if (rt.i18next && rt.initReactI18next) {
            i18n = rt.i18next.createInstance();
            i18n.use(rt.initReactI18next).init({ lng: 'id', fallbackLng: 'en', resources: {}, interpolation: { escapeValue: false }, initImmediate: false });
            lib.registerUiLocales?.(i18n);
        }
        ref.current = { lib, rt, i18n };
    }
    return ref.current;
}

/** Kerangka aplikasi (sidebar + topbar) dari layout project, memakai AppShell library. */
function Shell({ shell, lib, height, children }) {
    if (!shell || typeof lib.AppShell !== 'function') return children;
    const items = shell.layout.items.filter(i => !i.hidden).map(i => {
        const Icon = lib[`${pascalCase(i.icon)}Icon`];
        return { label: i.label, path: i.path, icon: Icon ? h(Icon, { className: 'h-5 w-5' }) : undefined };
    });
    return h('div', { className: 'cb-shell', style: { height } },
        h(lib.AppShell, { navItems: items, activePath: shell.activePath, onNavigate: shell.onNavigate, title: shell.title, breadcrumbs: shell.breadcrumbs, userMenu: [{ label: 'Sign out', danger: true, onClick: shell.onSignOut || (() => {}) }], appName: shell.layout.appName, user: { name: shell.layout.userName, roleName: shell.layout.userRole } }, children));
}

// Router dibuat sekali; isi halaman dialirkan lewat context supaya perubahan props (pencarian, navigasi preview)
// tidak membuat ulang router — input yang sedang diketik tidak kehilangan fokus.
const SlotCtx = createContext(null);
const Slot = () => useContext(SlotCtx);

function Screen({ tree, lib, entity, modules, ix, shell, shellHeight, onError }) {
    const { rt, i18n } = useRuntime(lib);
    const content = h(Fragment, null, h(Shell, { shell, lib, height: shellHeight }, h(RenderNode, { node: tree, rc: { lib, preview: lib.midasPreview || {}, entity, modules, ix, onError } })), ix?.overlay);
    let el = content;
    // Data router (bukan MemoryRouter biasa) supaya hook seperti useMatches di AppShell bekerja.
    const router = useMemo(() => (rt.createMemoryRouter ? rt.createMemoryRouter([{ path: '*', element: h(Slot) }]) : null), [rt, lib]);
    if (router && rt.RouterProvider) el = h(SlotCtx.Provider, { value: content }, h(rt.RouterProvider, { router }));
    else if (rt.MemoryRouter) el = h(rt.MemoryRouter, null, el);
    if (i18n && rt.I18nextProvider) el = h(rt.I18nextProvider, { i18n }, el);
    return el;
}

const FRAME_CSS = `
html,body{margin:0;background:transparent}
body{font-family:var(--font-sans, Inter, ui-sans-serif, system-ui, sans-serif);color:var(--theme-foreground)}
[data-node]{transition:outline-color .12s}
body.picking [data-node]:hover{outline:1px dashed #9747FF;outline-offset:-1px;cursor:pointer}
[data-node].midas-selected,aside.midas-selected,header.midas-selected{outline:2px solid #0D99FF !important;outline-offset:-2px}
body.picking aside:hover,body.picking header:hover{outline:1px dashed #9747FF;outline-offset:-1px;cursor:pointer}
.cb-shell .h-screen{height:100% !important}
.midas-hidden-mark{display:none}
.midas-component{display:flex;flex-direction:column}
.midas-component>*{max-width:100%}
.midas-unsupported,.midas-missing,.midas-broken{box-sizing:border-box;border:1px dashed #E5484D;background:repeating-linear-gradient(45deg,#E5484D0d 0 6px,transparent 6px 12px);color:#C62828;font:11px/1.3 Inter,system-ui,sans-serif;padding:4px;overflow:hidden}
`;

/**
 * Iframe berisi screen. `tree` dari screenTree(), `lib` = modul bundle, `cssUrl` = CSS bundle.
 * Klik elemen → onPick(nodeId). Lebar frame diskalakan agar muat di area (`fit`).
 */
export function LiveFrame({ tree, lib, cssUrl, selectedId, onPick, onError, entity, modules, shell, zoom = 'fit', interactive = null }) {
    const iframe = useRef(null), root = useRef(null), wrap = useRef(null);
    const [ready, setReady] = useState(false);
    const [scale, setScale] = useState(1);
    const [height, setHeight] = useState(600);
    const frameW = parseFloat(tree?.style?.width) || 1440;
    const useShell = !!shell && typeof lib.AppShell === 'function';
    // Dengan shell: lebar = sidebar 256 + padding konten 48; tinggi = topbar 64 + padding + isi frame.
    const width = frameW + (useShell ? 256 + 48 : 0);
    const shellHeight = useShell ? (parseFloat(tree?.style?.minHeight) || 600) + 64 + 48 : undefined;

    useEffect(() => {
        const doc = iframe.current.contentDocument;
        doc.open();
        doc.write(`<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${cssUrl}"><style>${FRAME_CSS}</style></head><body class="${interactive ? '' : 'picking'}"><div id="root"></div></body></html>`);
        doc.close();
        const link = doc.querySelector('link');
        const done = () => setReady(true);
        link.addEventListener('load', done);
        link.addEventListener('error', done);
        root.current = createRoot(doc.getElementById('root'));
        return () => {
            const r = root.current;
            root.current = null;
            setTimeout(() => r?.unmount());
        };
    }, [cssUrl]);

    useEffect(() => {
        if (!ready || !root.current || !tree) return;
        root.current.render(h(Screen, { tree, lib, entity, modules, ix: interactive, shell: useShell ? shell : null, shellHeight, onError }));
    }, [ready, tree, lib, onError, entity, modules, interactive, shell, useShell, shellHeight]);

    // Klik di iframe → node terdekat.
    useEffect(() => {
        const doc = iframe.current?.contentDocument;
        if (!doc || interactive) return;
        const onClick = e => {
            const el = e.target.closest?.('[data-node]');
            const layout = !el && (e.target.closest?.('aside') ? '__sidebar' : e.target.closest?.('header') ? '__topbar' : null);
            if (!el && !layout) return;
            e.preventDefault();
            e.stopPropagation();
            onPick?.(el ? el.getAttribute('data-node') : layout);
        };
        doc.addEventListener('click', onClick, true);
        return () => doc.removeEventListener('click', onClick, true);
    }, [ready, onPick, interactive]);

    useEffect(() => {
        const doc = iframe.current?.contentDocument;
        if (!doc) return;
        doc.querySelectorAll('.midas-selected').forEach(el => el.classList.remove('midas-selected'));
        if (selectedId === '__sidebar') doc.querySelector('aside')?.classList.add('midas-selected');
        else if (selectedId === '__topbar') doc.querySelector('header')?.classList.add('midas-selected');
        else if (selectedId) doc.querySelector(`[data-node="${CSS.escape(selectedId)}"]`)?.classList.add('midas-selected');
    });

    // Skala & tinggi: muat lebar area, tinggi mengikuti isi.
    useEffect(() => {
        const measure = () => {
            const w = wrap.current?.clientWidth || width;
            setScale(zoom === 'fit' ? Math.min(1, (w - 32) / width) : Number(zoom) / 100);
            const body = iframe.current?.contentDocument?.body;
            if (body) setHeight(shellHeight || Math.max(body.scrollHeight, 200));
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (wrap.current) ro.observe(wrap.current);
        const body = iframe.current?.contentDocument?.body;
        if (body) ro.observe(body);
        return () => ro.disconnect();
    }, [ready, width, tree, shellHeight, zoom]);

    return h('div', { className: 'cb-live-wrap', ref: wrap },
        h('div', { className: 'cb-live-stage', style: { width: width * scale, height: height * scale } },
            h('iframe', { ref: iframe, title: 'Live DOM Renderer', className: 'cb-live-iframe', style: { width, height, transform: `scale(${scale})` } })),
        !ready && h('div', { className: 'cb-live-loading' }, 'Loading library components…'));
}
