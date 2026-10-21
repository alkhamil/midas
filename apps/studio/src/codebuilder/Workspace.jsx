// Ruang kerja satu screen: pratinjau Live DOM Renderer (dengan layout aplikasi) di tengah, outline layer di kiri,
// dan Properties Inspector di kanan. Menutupi canvas + panel kanan Design selama screen dibuka.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { activeNavPath, breadcrumbsOf, findTreeNode, pageTitle, ROLE_LABEL, screenTree } from '@midas/builder-core';
import { cssUrlOf, loadBundle } from './loader.js';
import { Inspector } from './Inspector.jsx';
import { LiveFrame } from './Renderer.jsx';
import { Select } from './Select.jsx';

function Outline({ tree, selected, onSelect, onToggle, hiddenOf }) {
    const row = (n, depth) => (
        <li key={n.nodeId}>
            <div className={`cb-ol-row ${selected === n.nodeId ? 'active' : ''} ${hiddenOf(n.nodeId) ? 'off' : ''} k-${n.kind}`} style={{ paddingLeft: 8 + depth * 12 }} onClick={() => onSelect(n.nodeId)}>
                <span className="cb-ol-kind">{n.kind === 'component' ? '◆' : n.kind === 'text' ? 'T' : n.kind === 'box' ? '▢' : n.kind === 'formgrid' ? '▦' : '⚠'}</span>
                <span className="cb-ol-name">{n.kind === 'component' ? n.exportName : n.name}</span>
                {depth > 0 && <button type="button" className="cb-ol-eye" title={hiddenOf(n.nodeId) ? 'Show' : 'Hide'} onClick={e => { e.stopPropagation(); onToggle(n.nodeId); }}>{hiddenOf(n.nodeId) ? '○' : '●'}</button>}
            </div>
            {n.children?.length > 0 && <ul>{n.children.map(c => row(c, depth + 1))}</ul>}
        </li>
    );
    return <ul className="cb-outline">{row(tree, 0)}</ul>;
}

export function Workspace({ screen, tree, ctx, library, entity, layout, title, module, screens, modules, actions, onClose, onReveal, onGenerate, onSwitch }) {
    const [zoom, setZoom] = useState('fit');
    const [lib, setLib] = useState(null);
    const [err, setErr] = useState(null);
    const [selected, setSelected] = useState(null);
    const [runtime, setRuntime] = useState([]);
    useEffect(() => {
        setLib(null);
        setErr(null);
        if (!library?.bundleUrl) return setErr(`Bundle ${library ? `${library.packageName}@${library.version}` : 'library'} is not available yet. Run \`npm run bundle\` (midas bundle) in the package repo.`);
        loadBundle(library.bundleUrl).then(setLib, e => setErr(e.message));
    }, [library?.bundleUrl]);
    useEffect(() => { setSelected(null); setRuntime([]); }, [screen.id]);
    const onError = useCallback((nodeId, e) => setRuntime(r => (r.some(x => x.nodeId === nodeId) ? r : [...r, { nodeId, message: e.message }])), []);

    // Outline memuat semua node, termasuk yang disembunyikan lewat konfigurasi.
    const full = useMemo(() => {
        const nodes = Object.fromEntries(Object.entries(screen.nodes || {}).map(([k, v]) => [k, { ...v, hidden: undefined }]));
        return screenTree(ctx, screen.frameId, nodes).tree;
    }, [ctx, screen.frameId, screen.nodes]);
    const node = selected && !selected.startsWith('__') ? findTreeNode(tree.tree, selected) : null;
    const hiddenOf = id => !!screen.nodes?.[id]?.hidden;
    const toggle = id => actions.setNode(screen.id, id, c => ({ ...c, hidden: c.hidden ? undefined : true }));
    const pageTitleText = pageTitle(module, screen);
    const crumbs = useMemo(() => breadcrumbsOf(modules, module, screen), [modules, module, screen]);
    const shell = useMemo(() => ({ layout, title: pageTitleText, breadcrumbs: crumbs, activePath: activeNavPath(layout, modules, module) }), [layout, pageTitleText, crumbs, module, modules]);

    // Menutupi seluruh area editor di bawah header (rail, panel kiri, canvas, panel kanan): ruang untuk pratinjau + inspector.
    const view = useRef(null);
    useEffect(() => {
        const area = document.getElementById('canvas-area');
        const place = () => {
            const r = area.getBoundingClientRect();
            Object.assign(view.current.style, { top: `${r.top}px`, left: '0px' });
        };
        place();
        // Canvas memakai wheel untuk zoom/pan dan membatalkan scroll bawaan; overlay ini berada di dalam #canvas-area.
        const stop = e => e.stopPropagation();
        const node = view.current;
        node.addEventListener('wheel', stop, { passive: true });
        const ro = new ResizeObserver(place);
        ro.observe(area);
        window.addEventListener('resize', place);
        return () => { ro.disconnect(); window.removeEventListener('resize', place); node.removeEventListener('wheel', stop); };
    }, []);

    const all = [...tree.issues, ...runtime.map(r => ({ ...r, severity: 'error', message: `Render error: ${r.message}` }))];
    const inspectorActions = {
        setNode: (id, fn) => actions.setNode(screen.id, id, fn),
        setLayout: actions.setLayout,
        setFields: fields => actions.setFields(module.id, fields),
        setEntity: patch => actions.setEntity(module.id, patch),
        setScreen: patch => actions.setScreen(screen.id, patch),
        reveal: id => onReveal(id),
    };
    return (
        <div className="cb-screen-view" ref={view}>
            <div className="cb-screen-bar">
                <button className="cb-back" onClick={onClose} title="Back to canvas">← Canvas</button>
                <span className={`cb-role r-${screen.role}`}>{ROLE_LABEL[screen.role]}</span>
                <Select className="cb-screen-switch" aria-label="Choose screen" value={screen.id} onChange={e => onSwitch(e.target.value)}>
                    {modules.map(m => (
                        <optgroup key={m.id} label={m.label}>
                            {screens.filter(x => x.module.id === m.id).map(x => <option key={x.id} value={x.id}>{x.name} ({ROLE_LABEL[x.role]})</option>)}
                        </optgroup>
                    ))}
                </Select>
                <span className="small-label">src/modules/{module.name}</span>
                <span className="cb-spacer" />
                <label className="cb-zoom">Zoom
                    <Select value={zoom} onChange={e => setZoom(e.target.value)}>
                        <option value="fit">Fit</option>
                        {[50, 75, 100].map(z => <option key={z} value={z}>{z}%</option>)}
                    </Select>
                </label>
                <button className="wide-button" onClick={() => onReveal(screen.frameId)}>Open frame on canvas</button>
                <button className="wide-button" onClick={onGenerate}>Generate code…</button>
            </div>
            <div className="cb-screen-body">
                <aside className="cb-left">
                    <div className="cb-left-head">Layers</div>
                    <div className="cb-left-body">
                        <div className={`cb-ol-row layout ${selected === '__sidebar' ? 'active' : ''}`} onClick={() => setSelected('__sidebar')}><span className="cb-ol-kind">▤</span><span className="cb-ol-name">Sidebar</span></div>
                        <div className={`cb-ol-row layout ${selected === '__topbar' ? 'active' : ''}`} onClick={() => setSelected('__topbar')}><span className="cb-ol-kind">▭</span><span className="cb-ol-name">Topbar</span></div>
                        {full && <Outline tree={full} selected={selected} onSelect={setSelected} onToggle={toggle} hiddenOf={hiddenOf} />}
                    </div>
                    {all.length > 0 && (
                        <div className="cb-left-issues">
                            <div className="cb-left-head">{all.length} issues</div>
                            {all.map((i, k) => <button key={k} className={`cb-issue ${i.severity}`} title={i.message} onClick={() => i.nodeId && setSelected(i.nodeId)}><span className="cb-issue-dot" />{i.nodeName ? `${i.nodeName}: ` : ''}{i.message}</button>)}
                        </div>
                    )}
                </aside>
                {err ? <div className="cb-empty cb-grow"><b>Live DOM Renderer</b><p className="small-label">{err}</p></div>
                    : !lib ? <div className="cb-empty cb-grow"><p className="small-label">Memuat {library.packageName}@{library.version}…</p></div>
                        : tree.tree ? <LiveFrame tree={tree.tree} lib={lib} cssUrl={cssUrlOf(library.bundleUrl)} selectedId={selected} onPick={setSelected} onError={onError} entity={entity} modules={modules} shell={screen.role === 'dialog' ? null : shell} zoom={zoom} vars={ctx.vars} />
                            : <div className="cb-empty cb-grow"><p className="small-label">{tree.issues[0]?.message}</p></div>}
                <aside className="cb-right">
                    <Inspector selected={selected} tree={tree.tree} node={node} screen={screen} module={module} screens={screens} entity={entity} layout={layout} lib={lib} modules={modules} title={pageTitleText} crumbs={crumbs} actions={inspectorActions} vars={ctx.vars} collections={ctx.collections} />
                </aside>
            </div>
        </div>
    );
}

