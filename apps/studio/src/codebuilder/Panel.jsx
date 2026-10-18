// Panel Code Builder (spec §4.2–4.3): project → module → screen (frame + role), field entity, Issues,
// dan Live DOM Renderer untuk screen yang dibuka. Data project disimpan di server (/api/builder-projects).
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { builderApi, libraryApi } from '../storage.js';
import { cleanNodeCfg, CRUD_ROLES, kebabCase, makeContext, projectIssues, resolveLayout, ROLE_LABEL, screenTree } from '@midas/builder-core';
import { GenerateDialog } from './Generate.jsx';
import { EntityEditor } from './Inspector.jsx';
import { Workspace } from './Workspace.jsx';

const ROLES = ['list', 'create', 'edit', 'view', 'custom'];
const uid = p => `${p}-${Math.random().toString(36).slice(2, 10)}`;
const LAST_KEY = fileId => `midas-builder-project:${fileId}`;

/** Versi dokumen: render ulang panel saat canvas berubah (event dari engine). */
function useDocTick() {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const on = () => setTick(t => t + 1);
        window.addEventListener('midas:change', on);
        return () => window.removeEventListener('midas:change', on);
    }, []);
    return tick;
}

export function CodeBuilderPanel({ bridge, canvasHost }) {
    const tick = useDocTick();
    const fileId = bridge.fileId();
    const [projects, setProjects] = useState(null);
    const [project, setProject] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('');
    const [form, setForm] = useState(null); // 'project' | 'module' | { screenFor } | { editModule }
    const [open, setOpen] = useState(() => new Set());
    const [screenId, setScreenId] = useState(null);
    const saveTimer = useRef(null), pending = useRef(null), latest = useRef(null);
    latest.current = project;

    const load = useCallback(async () => {
        setError(null);
        try {
            const list = await builderApi.list(fileId);
            setProjects(list);
            const last = localStorage.getItem(LAST_KEY(fileId));
            const pick = list.find(p => p.id === last) || list[0];
            setProject(pick ? await builderApi.get(pick.id) : null);
            setScreenId(null);
        }
        catch (e) {
            setError(e.message);
        }
    }, [fileId]);
    useEffect(() => { load(); }, [load]);

    // Simpan (debounce). Konflik 409 → pakai versi server dan beri tahu.
    const flush = useCallback(async () => {
        const next = pending.current;
        if (!next) return;
        pending.current = null;
        setStatus('Menyimpan…');
        try {
            const saved = await builderApi.save(next.id, { version: next.version, name: next.name, config: next.config });
            setProject(p => (p?.id === saved.id ? { ...saved, config: pending.current?.config ?? saved.config } : p));
            if (pending.current) pending.current.version = saved.version;
            setStatus('Tersimpan');
        }
        catch (e) {
            if (e.status === 409 && e.body?.project) {
                setProject(e.body.project);
                setStatus('Project diubah di tempat lain — versi terbaru dimuat');
            }
            else setStatus(`Gagal menyimpan: ${e.message}`);
        }
    }, []);
    const update = useCallback(change => {
        setProject(p => {
            const next = { ...p, ...change(p) };
            pending.current = { id: next.id, version: pending.current?.version ?? p.version, name: next.name, config: next.config };
            clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(flush, 500);
            return next;
        });
    }, [flush]);
    const updateModules = fn => update(p => ({ config: { ...p.config, modules: fn(p.config.modules) } }));
    // Konfigurasi node screen (Properties Inspector): `fn` menerima konfigurasi lama dan mengembalikan yang baru.
    const setNode = useCallback((screenId, nodeId, fn) => update(p => ({
        config: {
            ...p.config,
            modules: p.config.modules.map(m => ({
                ...m,
                screens: m.screens.map(s => {
                    if (s.id !== screenId) return s;
                    const nodes = { ...s.nodes };
                    const next = cleanNodeCfg(fn(nodes[nodeId] || {}));
                    if (Object.keys(next).length) nodes[nodeId] = next;
                    else delete nodes[nodeId];
                    return { ...s, nodes };
                }),
            })),
        },
    })), [update]);
    const setLayout = useCallback(fn => update(p => {
        const resolved = resolveLayout(p.config);
        const labelOf = id => p.config.modules.find(m => m.id === id)?.label;
        const base = { appName: resolved.appName, userName: resolved.userName, userRole: resolved.userRole, items: resolved.items.map(({ moduleId, label, icon, hidden }) => ({ moduleId, label, icon, hidden: hidden || undefined })) };
        const next = fn(base);
        // Label yang sama dengan label module tidak disimpan sebagai override (supaya ikut berubah bila module diganti nama).
        return { config: { ...p.config, layout: { ...next, items: next.items.map(i => ({ ...i, label: i.label && i.label !== labelOf(i.moduleId) ? i.label : undefined })) } } };
    }), [update]);
    const setFields = useCallback((moduleId, fields) => update(p => ({ config: { ...p.config, modules: p.config.modules.map(m => (m.id === moduleId ? { ...m, entity: { fields } } : m)) } })), [update]);

    // ---------------------------------------------------------------- dokumen & issues
    const pages = useMemo(() => bridge.pages(), [tick, bridge]);
    const docNodes = useMemo(() => bridge.nodes(), [tick, bridge]);
    const [mappings, setMappings] = useState([]);
    const [mapped, setMapped] = useState(false); // mapping versi library sudah dimuat (sebelumnya semua komponen tampak "tidak ada")
    const lib = project?.library;
    useEffect(() => {
        setMappings([]);
        setMapped(false);
        if (lib?.id && lib.version && !lib.missing) builderApi.mappings(lib.id, lib.version).then(m => { setMappings(m); setMapped(true); }, () => { setMappings([]); setMapped(true); });
        else setMapped(true);
    }, [lib?.id, lib?.version, lib?.missing]);
    const ctx = useMemo(() => makeContext({ nodes: docNodes, variables: bridge.variables(), mappings, libraryId: lib?.id, fileId }), [docNodes, mappings, lib?.id, fileId, bridge]);
    const screens = useMemo(() => (project?.config.modules || []).flatMap(m => m.screens.map(s => ({ ...s, module: m }))), [project]);
    const trees = useMemo(() => new Map(screens.map(s => [s.id, screenTree(ctx, s.frameId, s.nodes)])), [screens, ctx]);
    const issues = useMemo(() => {
        if (!project) return [];
        const out = projectIssues(project, { byId: ctx.byId, pages });
        if (mapped) for (const s of screens) for (const i of trees.get(s.id).issues) out.push({ ...i, screenId: s.id, message: `${s.name}: ${i.message}` });
        return out;
    }, [project, ctx, pages, screens, trees, mapped]);

    if (error) return <div className="cb-panel"><p className="cb-error">{error}</p><button className="wide-button" onClick={load}>Coba lagi</button></div>;
    if (!projects) return <div className="cb-panel"><p className="small-label">Memuat project…</p></div>;

    const selectProject = async id => {
        await flush();
        localStorage.setItem(LAST_KEY(fileId), id);
        setProject(await builderApi.get(id));
        setScreenId(null);
    };
    const activeScreen = screens.find(s => s.id === screenId);
    const selection = bridge.selection();
    const layout = resolveLayout(project?.config || { modules: [] });
    const allModules = project?.config.modules || [];

    return (
        <div className="cb-panel">
            <div className="cb-head">
                <select className="cb-select" value={project?.id || ''} onChange={e => selectProject(e.target.value)} aria-label="Code Builder project">
                    {!project && <option value="">Belum ada project</option>}
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <button className="icon-button small" title="Project baru" aria-label="Project baru" onClick={() => setForm('project')}>＋</button>
            </div>
            {form === 'project' && <ProjectForm fileName={bridge.fileName()} bridge={bridge} onCancel={() => setForm(null)} onCreate={async body => {
                const p = await builderApi.create({ ...body, fileId });
                localStorage.setItem(LAST_KEY(fileId), p.id);
                setProjects(list => [{ ...p, modules: 0, screens: 0 }, ...list]);
                setProject(p);
                setForm(null);
            }} />}
            {!project && form !== 'project' && (
                <div className="cb-empty"><b>Code Builder</b><p className="small-label">Buat project untuk mendaftarkan frame di file ini sebagai screen aplikasi.</p><button className="wide-button" onClick={() => setForm('project')}>Buat project</button></div>
            )}
            {project && (
                <>
                    <LibraryLine project={project} onChange={(libraryId, libraryVersion) => builderApi.save(project.id, { version: pending.current?.version ?? project.version, libraryId, libraryVersion }).then(setProject, e => setStatus(e.message))} />
                    <div className="cb-section-head"><span>Modules</span><button className="cb-link" onClick={() => setForm('module')}>＋ Module</button></div>
                    {form === 'module' && <ModuleForm pages={pages} modules={project.config.modules} currentPage={bridge.currentPageId()} onCancel={() => setForm(null)} onSave={m => {
                        updateModules(list => [...list, { id: uid('mod'), screens: [], entity: { fields: [] }, ...m }]);
                        setOpen(s => new Set(s).add(m.name));
                        setForm(null);
                    }} />}
                    {!project.config.modules.length && form !== 'module' && <p className="small-label cb-pad">Belum ada module. Satu module bersumber dari satu page (mis. page User).</p>}
                    <ModuleTree
                        modules={project.config.modules} pages={pages} open={open} setOpen={setOpen} screenId={screenId} issues={issues}
                        onOpenScreen={id => setScreenId(id)} onReveal={id => bridge.reveal(id)}
                        form={form} setForm={setForm} selection={selection} byId={ctx.byId}
                        onUpdate={(id, fn) => updateModules(list => list.map(m => (m.id === id ? { ...m, ...fn(m) } : m)))}
                        onRemove={id => updateModules(list => list.filter(m => m.id !== id && m.parentId !== id))}
                    />
                    <IssuesList issues={issues} onReveal={id => bridge.reveal(id)} onOpenScreen={setScreenId} />
                    <button className="wide-button primary cb-generate" onClick={() => setForm('generate')}>Generate kode…</button>
                    <div className="cb-foot"><span className="small-label">{status}</span><button className="cb-link danger" onClick={async () => {
                        if (!confirm(`Hapus project "${project.name}"? Frame di desain tidak ikut terhapus.`)) return;
                        await builderApi.remove(project.id);
                        localStorage.removeItem(LAST_KEY(fileId));
                        load();
                    }}>Hapus project</button></div>
                </>
            )}
            {activeScreen && canvasHost && createPortal(
                <Workspace
                    screen={activeScreen} tree={trees.get(activeScreen.id)} ctx={ctx} library={lib} entity={activeScreen.module.entity} layout={layout}
                    title={layout.items.find(i => i.moduleId === rootOf(allModules, activeScreen.module).id)?.label || activeScreen.module.label}
                    module={activeScreen.module} screens={screens} modules={allModules}
                    actions={{ setNode, setLayout, setFields }} onGenerate={() => setForm('generate')}
                    onClose={() => setScreenId(null)} onReveal={id => { setScreenId(null); bridge.reveal(id); }}
                />,
                canvasHost,
            )}
            {form === 'generate' && project && <GenerateDialog project={project} ctx={ctx} onClose={() => setForm(null)} />}
        </div>
    );
}

function ProjectForm({ fileName, bridge, onCancel, onCreate }) {
    const [name, setName] = useState(fileName || 'Project');
    const [libs, setLibs] = useState(null);
    const [libraryId, setLibraryId] = useState('');
    const [versions, setVersions] = useState([]);
    const [version, setVersion] = useState('');
    const [err, setErr] = useState(null);
    useEffect(() => { bridge.libraries().then(l => { setLibs(l); if (l[0]) setLibraryId(l[0].id); }, () => setLibs([])); }, [bridge]);
    useEffect(() => {
        if (!libraryId) return setVersions([]);
        libraryApi.history(libraryId).then(r => { setVersions(r.versions); setVersion(r.versions[0]?.version || ''); }, () => setVersions([]));
    }, [libraryId]);
    return (
        <form className="cb-form" onSubmit={async e => {
            e.preventDefault();
            try {
                await onCreate({ name: name.trim(), libraryId: libraryId || null, libraryVersion: libraryId ? version || null : null });
            }
            catch (x) {
                setErr(x.message);
            }
        }}>
            <b>Project baru</b>
            <label>Nama<input value={name} onChange={e => setName(e.target.value)} required /></label>
            <label>Library<select value={libraryId} onChange={e => setLibraryId(e.target.value)}>
                <option value="">— pilih nanti —</option>
                {(libs || []).map(l => <option key={l.id} value={l.id}>{l.packageName || l.name}</option>)}
            </select></label>
            {libraryId && <label>Versi<select value={version} onChange={e => setVersion(e.target.value)}>
                {versions.map(v => <option key={v.version} value={v.version}>{v.version}{v.codeStatus === 'ready' ? '' : ` (kode ${v.codeStatus})`}</option>)}
            </select></label>}
            {err && <p className="cb-error">{err}</p>}
            <div className="cb-form-actions"><button type="button" className="wide-button" onClick={onCancel}>Batal</button><button className="wide-button primary">Buat</button></div>
        </form>
    );
}

function LibraryLine({ project, onChange }) {
    const lib = project.library;
    const [edit, setEdit] = useState(false);
    const [versions, setVersions] = useState([]);
    useEffect(() => { if (edit && lib?.id) libraryApi.history(lib.id).then(r => setVersions(r.versions), () => {}); }, [edit, lib?.id]);
    if (!lib) return <p className="small-label cb-pad">Library belum dipilih.</p>;
    return (
        <div className="cb-lib">
            <span className="cb-mono" title={lib.name}>{lib.packageName}@{lib.version}</span>
            <span className={`cb-badge ${lib.bundleUrl ? 'ok' : 'warn'}`} title={lib.bundleUrl ? 'Bundle tersedia untuk Live DOM Renderer' : 'Bundle belum diunggah'}>{lib.bundleUrl ? 'bundle' : 'tanpa bundle'}</span>
            {edit
                ? <select className="cb-select small" value={lib.version} onChange={e => { onChange(lib.id, e.target.value); setEdit(false); }}>{versions.map(v => <option key={v.version}>{v.version}</option>)}</select>
                : <button className="cb-link" onClick={() => setEdit(true)}>Ganti versi</button>}
        </div>
    );
}

function ModuleForm({ pages, modules, currentPage, initial, onCancel, onSave }) {
    const usable = pages.filter(p => !p.folder);
    const [pageId, setPageId] = useState(initial?.pageId || (usable.some(p => p.id === currentPage) ? currentPage : usable[0]?.id || ''));
    const pageName = usable.find(p => p.id === pageId)?.name || '';
    const [label, setLabel] = useState(initial?.label || pageName);
    const [name, setName] = useState(initial?.name || kebabCase(pageName));
    const [touched, setTouched] = useState(!!initial);
    const [parentId, setParentId] = useState(initial?.parentId || '');
    const [permissionKey, setPermissionKey] = useState(initial?.permissionKey || '');
    const valid = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name);
    const taken = modules.some(m => m.id !== initial?.id && m.name === name && (m.parentId || '') === parentId);
    return (
        <form className="cb-form" onSubmit={e => {
            e.preventDefault();
            if (!valid || taken) return;
            onSave({ pageId, label: label.trim() || name, name, parentId: parentId || null, ...(permissionKey ? { permissionKey } : {}) });
        }}>
            <b>{initial ? 'Ubah module' : 'Module baru'}</b>
            <label>Page sumber<select value={pageId} onChange={e => {
                setPageId(e.target.value);
                const n = usable.find(p => p.id === e.target.value)?.name || '';
                if (!touched) { setLabel(n); setName(kebabCase(n)); }
            }}>{usable.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label>Label<input value={label} onChange={e => { setLabel(e.target.value); if (!touched) setName(kebabCase(e.target.value)); }} /></label>
            <label>Nama folder (kebab-case)<input className={valid && !taken ? '' : 'invalid'} value={name} onChange={e => { setName(e.target.value); setTouched(true); }} /></label>
            {!valid && <small className="cb-error">Huruf kecil & tanda hubung, mis. user-management</small>}
            {taken && <small className="cb-error">Nama sudah dipakai di level ini</small>}
            <label>Parent<select value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">— tidak ada —</option>
                {modules.filter(m => m.id !== initial?.id).map(m => <option key={m.id} value={m.id}>{m.label} ({m.name})</option>)}
            </select></label>
            <label>Permission key<input placeholder={name} value={permissionKey} onChange={e => setPermissionKey(e.target.value)} /></label>
            <div className="cb-form-actions"><button type="button" className="wide-button" onClick={onCancel}>Batal</button><button className="wide-button primary" disabled={!valid || taken}>Simpan</button></div>
        </form>
    );
}

function ModuleTree({ modules, parentId = null, depth = 0, ...rest }) {
    const list = modules.filter(m => (m.parentId || null) === parentId);
    return list.map(m => (
        <div key={m.id}>
            <ModuleRow module={m} modules={modules} depth={depth} {...rest} />
            <ModuleTree modules={modules} parentId={m.id} depth={depth + 1} {...rest} />
        </div>
    ));
}

function ModuleRow({ module: m, modules, depth, pages, open, setOpen, screenId, issues, onOpenScreen, onReveal, form, setForm, selection, byId, onUpdate, onRemove }) {
    const isOpen = open.has(m.name);
    const crud = m.screens.some(s => CRUD_ROLES.includes(s.role));
    const count = issues.filter(i => i.moduleId === m.id || m.screens.some(s => s.id === i.screenId)).length;
    const pageName = pages.find(p => p.id === m.pageId)?.name || 'page hilang';
    const editing = form?.editModule === m.id, registering = form?.screenFor === m.id, fields = form?.fieldsFor === m.id;
    return (
        <div className="cb-module" style={{ '--depth': depth }}>
            <div className="cb-module-row" onClick={() => setOpen(s => { const n = new Set(s); n.has(m.name) ? n.delete(m.name) : n.add(m.name); return n; })}>
                <span className="cb-caret">{isOpen ? '▾' : '▸'}</span>
                <span className="cb-module-name" title={`${m.name} · page ${pageName}`}>{m.label}</span>
                <span className="cb-badge">{m.screens.length ? (crud ? 'CRUD' : 'custom') : 'kosong'}</span>
                {count > 0 && <span className="cb-badge warn" title={`${count} issue`}>{count}</span>}
            </div>
            {isOpen && (
                <div className="cb-module-body">
                    <div className="small-label cb-mono">src/modules/{m.name} · page {pageName}</div>
                    {m.screens.map(s => (
                        <div key={s.id} className={`cb-screen ${screenId === s.id ? 'active' : ''}`}>
                            <span className={`cb-role r-${s.role}`}>{ROLE_LABEL[s.role]}</span>
                            <button className="cb-screen-name" title="Buka di Live DOM Renderer" onClick={() => onOpenScreen(s.id)}>{s.name}{!byId.has(s.frameId) && ' ⚠'}</button>
                            <button className="icon-button small" title="Tampilkan frame di canvas" aria-label="Tampilkan frame" onClick={() => onReveal(s.frameId)}>◎</button>
                            <button className="icon-button small" title="Lepas screen" aria-label="Lepas screen" onClick={() => onUpdate(m.id, mm => ({ screens: mm.screens.filter(x => x.id !== s.id) }))}>×</button>
                        </div>
                    ))}
                    {registering
                        ? <ScreenForm module={m} selection={selection} onCancel={() => setForm(null)} onSave={s => { onUpdate(m.id, mm => ({ screens: [...mm.screens, { id: uid('scr'), ...s }] })); setForm(null); }} />
                        : <button className="cb-link" onClick={() => setForm({ screenFor: m.id })}>＋ Register frame</button>}
                    {crud && (fields
                        ? <><EntityEditor module={m} onChange={f => onUpdate(m.id, () => ({ entity: { fields: f } }))} /><button className="cb-link" onClick={() => setForm(null)}>Selesai</button></>
                        : <button className="cb-link" onClick={() => setForm({ fieldsFor: m.id })}>Entity fields ({m.entity?.fields?.length || 0})</button>)}
                    {editing
                        ? <ModuleForm pages={pages} modules={modules} initial={m} onCancel={() => setForm(null)} onSave={v => { onUpdate(m.id, () => v); setForm(null); }} />
                        : <div className="cb-row-actions"><button className="cb-link" onClick={() => setForm({ editModule: m.id })}>Ubah</button><button className="cb-link danger" onClick={() => confirm(`Hapus module ${m.name}?`) && onRemove(m.id)}>Hapus</button></div>}
                </div>
            )}
        </div>
    );
}

function ScreenForm({ module: m, selection, onCancel, onSave }) {
    const frame = selection.length === 1 && selection[0].top ? selection[0] : null;
    const onPage = frame && frame.pageId === m.pageId;
    const used = new Set(m.screens.map(s => s.role).filter(r => CRUD_ROLES.includes(r)));
    const [role, setRole] = useState(() => ROLES.find(r => !used.has(r)) || 'custom');
    const [name, setName] = useState('');
    return (
        <form className="cb-form" onSubmit={e => {
            e.preventDefault();
            if (frame && onPage) onSave({ frameId: frame.id, pageId: frame.pageId, role, name: name.trim() || frame.name });
        }}>
            <b>Register frame</b>
            {!frame && <p className="small-label">Pilih satu frame teratas di canvas (page sumber module ini).</p>}
            {frame && !onPage && <p className="cb-error">Frame "{frame.name}" bukan dari page sumber module.</p>}
            {frame && onPage && <p className="small-label">Frame: <b>{frame.name}</b></p>}
            <label>Role<select value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r} disabled={used.has(r)}>{ROLE_LABEL[r]}{used.has(r) ? ' (sudah ada)' : ''}</option>)}
            </select></label>
            <label>Nama screen<input placeholder={frame?.name || ''} value={name} onChange={e => setName(e.target.value)} /></label>
            <div className="cb-form-actions"><button type="button" className="wide-button" onClick={onCancel}>Batal</button><button className="wide-button primary" disabled={!frame || !onPage}>Register</button></div>
        </form>
    );
}

function IssuesList({ issues, onReveal, onOpenScreen }) {
    const [open, setOpen] = useState(true);
    const errors = issues.filter(i => i.severity === 'error').length;
    return (
        <div className="cb-issues">
            <button className="cb-section-head" onClick={() => setOpen(o => !o)}>
                <span>{open ? '▾' : '▸'} Issues</span>
                <span className={`cb-badge ${issues.length ? (errors ? 'err' : 'warn') : 'ok'}`}>{issues.length}</span>
            </button>
            {open && (issues.length
                ? issues.map((i, k) => (
                    <button key={k} className={`cb-issue ${i.severity}`} title={i.message} onClick={() => (i.nodeId ? onReveal(i.nodeId) : i.screenId && onOpenScreen(i.screenId))}>
                        <span className="cb-issue-dot" />{i.message}
                    </button>
                ))
                : <p className="small-label cb-pad">Tidak ada issue.</p>)}
        </div>
    );
}

const rootOf = (modules, m) => {
    let c = m;
    for (let n = 0; c.parentId && n < 20; n++) c = modules.find(x => x.id === c.parentId) || c;
    return c;
};
