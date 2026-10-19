// Panel Code Builder (spec §4.2–4.3): project → module → screen (frame + role), field entity, Issues,
// dan Live DOM Renderer untuk screen yang dibuka. Data project disimpan di server (/api/builder-projects).
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { builderApi, libraryApi } from '../storage.js';
import { cleanNodeCfg, CRUD_ROLES, kebabCase, makeContext, projectIssues, resolveLayout, ROLE_LABEL, screenTree, suggestScreens } from '@midas/builder-core';
import { GenerateDialog } from './Generate.jsx';
import { EntityEditor } from './Inspector.jsx';
import { confirmDialog } from '../confirm.js';
import { Select } from './Select.jsx';
import { Workspace } from './Workspace.jsx';

const ROLES = ['list', 'create', 'edit', 'view', 'custom', 'dialog'];
const PURPOSES = [['delete', 'Delete confirmation'], ['restore', 'Restore confirmation'], ['discard', 'Discard changes']];
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
        setStatus('Saving…');
        try {
            const saved = await builderApi.save(next.id, { version: next.version, name: next.name, config: next.config });
            setProject(p => (p?.id === saved.id ? { ...saved, config: pending.current?.config ?? saved.config } : p));
            if (pending.current) pending.current.version = saved.version;
            setStatus('Saved');
        }
        catch (e) {
            if (e.status === 409 && e.body?.project) {
                setProject(e.body.project);
                setStatus('Project changed elsewhere — latest version loaded');
            }
            else setStatus(`Save failed: ${e.message}`);
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
        // Saved as one flat list (top-level entries, then each parent's children): the order among siblings is what matters.
        const slim = ({ moduleId, label, icon, hidden }) => ({ moduleId, label, icon, hidden: hidden || undefined });
        const base = { appName: resolved.appName, userName: resolved.userName, userRole: resolved.userRole, items: resolved.items.flatMap(i => [slim(i), ...(i.children || []).filter(c => c.moduleId !== i.moduleId).map(slim)]) };
        const next = fn(base);
        // Label yang sama dengan label module tidak disimpan sebagai override (supaya ikut berubah bila module diganti nama).
        return { config: { ...p.config, layout: { ...next, items: next.items.map(i => ({ ...i, label: i.label && i.label !== labelOf(i.moduleId) ? i.label : undefined })) } } };
    }), [update]);
    const setScreen = useCallback((screenId, patch) => update(p => ({ config: { ...p.config, modules: p.config.modules.map(m => ({ ...m, screens: m.screens.map(s => (s.id === screenId ? { ...s, ...patch } : s)) })) } })), [update]);
    const setEntity = useCallback((moduleId, patch) => update(p => ({ config: { ...p.config, modules: p.config.modules.map(m => (m.id === moduleId ? { ...m, entity: { fields: [], ...m.entity, ...cleanNodeCfg(patch) } } : m)) } })), [update]);
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
    if (!projects) return <div className="cb-panel"><p className="small-label">Loading projects…</p></div>;

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
                <Select className="cb-select" value={project?.id || ''} onChange={e => selectProject(e.target.value)} aria-label="Code Builder project">
                    {!project && <option value="">No projects yet</option>}
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <button className="icon-button small" title="New project" aria-label="New project" onClick={() => setForm('project')}>＋</button>
            </div>
            {form === 'project' && <ProjectForm fileName={bridge.fileName()} bridge={bridge} onCancel={() => setForm(null)} onCreate={async body => {
                const p = await builderApi.create({ ...body, fileId });
                localStorage.setItem(LAST_KEY(fileId), p.id);
                setProjects(list => [{ ...p, modules: 0, screens: 0 }, ...list]);
                setProject(p);
                setForm(null);
            }} />}
            {!project && form !== 'project' && (
                <div className="cb-empty"><b>Code Builder</b><p className="small-label">Create a project to register frames in this file as app screens.</p><button className="wide-button" onClick={() => setForm('project')}>Create project</button></div>
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
                    {!project.config.modules.length && form !== 'module' && <p className="small-label cb-pad">No modules yet. Each module comes from one page (e.g. the User page).</p>}
                    <ModuleTree
                        modules={project.config.modules} pages={pages} open={open} setOpen={setOpen} screenId={screenId} issues={issues}
                        onOpenScreen={id => setScreenId(id)} onReveal={id => bridge.reveal(id)}
                        form={form} setForm={setForm} selection={selection} byId={ctx.byId} pageFrames={bridge.pageFrames}
                        onUpdate={(id, fn) => updateModules(list => list.map(m => (m.id === id ? { ...m, ...fn(m) } : m)))}
                        onRemove={id => updateModules(list => list.filter(m => m.id !== id && m.parentId !== id))}
                    />
                    <IssuesList issues={issues} onReveal={id => bridge.reveal(id)} onOpenScreen={setScreenId} />
                    <button className="wide-button primary cb-generate" onClick={() => setForm('generate')}>Generate code…</button>
                    <div className="cb-foot"><span className="small-label">{status}</span><button className="cb-link danger" onClick={async () => {
                        if (!(await confirmDialog({ title: `Delete project "${project.name}"?`, message: 'Frames in the design are not deleted.', confirmLabel: 'Delete', danger: true }))) return;
                        await builderApi.remove(project.id);
                        localStorage.removeItem(LAST_KEY(fileId));
                        load();
                    }}>Delete project</button></div>
                </>
            )}
            {activeScreen && canvasHost && createPortal(
                <Workspace
                    screen={activeScreen} tree={trees.get(activeScreen.id)} ctx={ctx} library={lib} entity={{ ...activeScreen.module.entity, moduleName: activeScreen.module.name }} layout={layout}
                    title={layout.items.find(i => i.moduleId === rootOf(allModules, activeScreen.module).id)?.label || activeScreen.module.label}
                    module={activeScreen.module} screens={screens} modules={allModules}
                    actions={{ setNode, setLayout, setFields, setScreen, setEntity }} onSwitch={setScreenId} onGenerate={() => setForm('generate')}
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
            <b>New project</b>
            <label>Name<input value={name} onChange={e => setName(e.target.value)} required /></label>
            <label>Library<Select value={libraryId} onChange={e => setLibraryId(e.target.value)}>
                <option value="">— choose later —</option>
                {(libs || []).map(l => <option key={l.id} value={l.id}>{l.packageName || l.name}</option>)}
            </Select></label>
            {libraryId && <label>Version<Select value={version} onChange={e => setVersion(e.target.value)}>
                {versions.map(v => <option key={v.version} value={v.version}>{v.version}{v.codeStatus === 'ready' ? '' : ` (code ${v.codeStatus})`}</option>)}
            </Select></label>}
            {err && <p className="cb-error">{err}</p>}
            <div className="cb-form-actions"><button type="button" className="wide-button" onClick={onCancel}>Cancel</button><button className="wide-button primary">Create</button></div>
        </form>
    );
}

function LibraryLine({ project, onChange }) {
    const lib = project.library;
    const [edit, setEdit] = useState(false);
    const [versions, setVersions] = useState([]);
    useEffect(() => { if (edit && lib?.id) libraryApi.history(lib.id).then(r => setVersions(r.versions), () => {}); }, [edit, lib?.id]);
    if (!lib) return <p className="small-label cb-pad">No library selected yet.</p>;
    return (
        <div className="cb-lib">
            <span className="cb-mono" title={lib.name}>{lib.packageName}@{lib.version}</span>
            <span className={`cb-badge ${lib.bundleUrl ? 'ok' : 'warn'}`} title={lib.bundleUrl ? 'Bundle available for the Live DOM Renderer' : 'Bundle not uploaded yet'}>{lib.bundleUrl ? 'bundle' : 'no bundle'}</span>
            {edit
                ? <Select className="cb-select small" value={lib.version} onChange={e => { onChange(lib.id, e.target.value); setEdit(false); }}>{versions.map(v => <option key={v.version}>{v.version}</option>)}</Select>
                : <button className="cb-link" onClick={() => setEdit(true)}>Change version</button>}
        </div>
    );
}

function ModuleForm({ pages, modules, currentPage, initial, onCancel, onSave }) {
    // Only pages flagged "Use in Code Builder" (page context menu) are module sources; a module being edited keeps its own page.
    const usable = pages.filter(p => p.codeBuilder || p.id === initial?.pageId);
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
            <b>{initial ? 'Edit module' : 'New module'}</b>
            <label>Source page<Select value={pageId} disabled={!usable.length} onChange={e => {
                setPageId(e.target.value);
                const n = usable.find(p => p.id === e.target.value)?.name || '';
                if (!touched) { setLabel(n); setName(kebabCase(n)); }
            }}>{usable.length ? usable.map(p => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">No flagged pages</option>}</Select></label>
            {!usable.length && <small className="cb-hint">Flag a page first: right-click it in the Pages list and choose “Use in Code Builder”.</small>}
            <label>Label<input value={label} onChange={e => { setLabel(e.target.value); if (!touched) setName(kebabCase(e.target.value)); }} /></label>
            <label>Folder name (kebab-case)<input className={valid && !taken ? '' : 'invalid'} value={name} onChange={e => { setName(e.target.value); setTouched(true); }} /></label>
            {!valid && <small className="cb-error">Huruf kecil & tanda hubung, mis. user-management</small>}
            {taken && <small className="cb-error">Name already used at this level</small>}
            <label>Parent<Select value={parentId} onChange={e => setParentId(e.target.value)}>
                <option value="">— none —</option>
                {modules.filter(m => m.id !== initial?.id).map(m => <option key={m.id} value={m.id}>{m.label} ({m.name})</option>)}
            </Select></label>
            <label>Permission key<input placeholder={name} value={permissionKey} onChange={e => setPermissionKey(e.target.value)} /></label>
            <div className="cb-form-actions"><button type="button" className="wide-button" onClick={onCancel}>Cancel</button><button className="wide-button primary" disabled={!valid || taken || !pageId}>Save</button></div>
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

const Chevron = ({ open }) => <svg className={`cb-chev ${open ? 'open' : ''}`} width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 7 5 3 8.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const RevealIcon = () => <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="3.2" /><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15" /></svg>;
const CloseIcon = () => <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m2.5 2.5 7 7m0-7-7 7" /></svg>;

/** `src/modules/<parent>/<child>`: the folder the generator writes the module to. */
const moduleDir = (modules, m) => {
    const parts = [];
    for (let c = m, n = 0; c && n < 20; c = modules.find(x => x.id === c.parentId), n++) parts.unshift(c.name);
    return `src/modules/${parts.join('/')}`;
};

function ModuleRow({ module: m, modules, depth, pages, open, setOpen, screenId, issues, onOpenScreen, onReveal, form, setForm, selection, byId, pageFrames, onUpdate, onRemove }) {
    const isOpen = open.has(m.name);
    const crud = m.screens.some(s => CRUD_ROLES.includes(s.role));
    const count = issues.filter(i => i.moduleId === m.id || m.screens.some(s => s.id === i.screenId)).length;
    const pageName = pages.find(p => p.id === m.pageId)?.name || 'page hilang';
    const editing = form?.editModule === m.id, registering = form?.screenFor === m.id, fields = form?.fieldsFor === m.id;
    return (
        <div className="cb-module" style={{ '--depth': depth }}>
            <div className="cb-module-row" onClick={() => setOpen(s => { const n = new Set(s); n.has(m.name) ? n.delete(m.name) : n.add(m.name); return n; })}>
                <span className="cb-caret"><Chevron open={isOpen} /></span>
                <span className="cb-module-name" title={`${m.label} · ${moduleDir(modules, m)}`}>{m.label}</span>
                <span className="cb-badge">{m.screens.length ? (crud ? 'CRUD' : 'custom') : modules.some(c => c.parentId === m.id) ? 'group' : 'empty'}</span>
                {count > 0 && <span className="cb-badge warn" title={`${count} issue`}>{count}</span>}
            </div>
            {isOpen && (
                <div className="cb-module-body">
                    <dl className="cb-module-meta">
                        <dt>Folder</dt><dd className="cb-mono-wrap">{moduleDir(modules, m)}</dd>
                        <dt>Page</dt><dd>{pageName}</dd>
                    </dl>
                    {m.screens.map(s => (
                        <div key={s.id} className={`cb-screen ${screenId === s.id ? 'active' : ''}`}>
                            <span className={`cb-role r-${s.role}`} title={s.role === 'dialog' && s.purpose ? `Dialog · ${s.purpose}` : ROLE_LABEL[s.role]}>{ROLE_LABEL[s.role]}</span>
                            <button className="cb-screen-name" title={`${s.name} — open in the Live DOM Renderer`} onClick={() => onOpenScreen(s.id)}>{s.name}{!byId.has(s.frameId) && ' ⚠'}</button>
                            <span className="cb-screen-actions">
                                <button className="cb-icon-btn" title="Show frame on the canvas" aria-label="Show frame" onClick={() => onReveal(s.frameId)}><RevealIcon /></button>
                                <button className="cb-icon-btn danger" title="Unregister screen" aria-label="Unregister screen" onClick={() => onUpdate(m.id, mm => ({ screens: mm.screens.filter(x => x.id !== s.id) }))}><CloseIcon /></button>
                            </span>
                        </div>
                    ))}
                    {registering && <FrameRegistrar module={m} pageFrames={pageFrames} selection={selection} onCancel={() => setForm(null)} onAdd={list => { onUpdate(m.id, mm => ({ screens: [...mm.screens, ...list.map(s => ({ id: uid('scr'), ...s }))] })); setForm(null); }} />}
                    {fields && <><EntityEditor module={m} modules={modules} onChange={f => onUpdate(m.id, () => ({ entity: { fields: f } }))} /><button className="cb-pill" onClick={() => setForm(null)}>Done</button></>}
                    {editing && <ModuleForm pages={pages} modules={modules} initial={m} onCancel={() => setForm(null)} onSave={v => { onUpdate(m.id, () => v); setForm(null); }} />}
                    {!registering && !fields && !editing && (
                        <div className="cb-module-actions">
                            <button className="cb-pill primary" onClick={() => setForm({ screenFor: m.id })}>＋ Register frame</button>
                            {crud && <button className="cb-pill" onClick={() => setForm({ fieldsFor: m.id })}>Entity fields <b>{m.entity?.fields?.length || 0}</b></button>}
                            <span className="cb-spacer" />
                            <button className="cb-pill" onClick={() => setForm({ editModule: m.id })}>Edit</button>
                            <button className="cb-pill danger" onClick={async () => (await confirmDialog({ title: `Delete module ${m.name}?`, message: 'Its screens and entity fields are removed from the project. Frames in the design are not deleted.', confirmLabel: 'Delete', danger: true })) && onRemove(m.id)}>Delete</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// What a frame can be registered as. "form" is one frame used for both the create and the edit screen.
const FRAME_CHOICES = [['list', 'List'], ['form', 'Create + Edit'], ['create', 'Create'], ['edit', 'Edit'], ['view', 'View'], ['dialog:delete', 'Dialog · Delete'], ['dialog:restore', 'Dialog · Restore'], ['dialog:discard', 'Dialog · Discard'], ['custom', 'Custom page'], ['skip', 'Skip']];
const choiceOf = list => (!list.length ? 'skip' : list.length === 2 ? 'form' : list[0].role === 'dialog' ? `dialog:${list[0].purpose}` : list[0].role);
const screensOf = (choice, name, frame) => {
    if (choice === 'skip') return [];
    const base = { frameId: frame.id, pageId: frame.pageId, name };
    if (choice === 'form') return [{ ...base, role: 'create' }, { ...base, role: 'edit' }];
    if (choice.startsWith('dialog:')) return [{ ...base, role: 'dialog', purpose: choice.slice(7) }];
    return [{ ...base, role: choice }];
};
const rolesOfChoice = choice => (choice === 'form' ? ['create', 'edit'] : choice.startsWith('dialog:') ? [choice] : choice === 'skip' || choice === 'custom' ? [] : [choice]);

/**
 * Register frames in one go: the module's source page lists every top-level frame that is not registered yet, with the
 * screen each one probably is (guessed from its name). Adjust where needed, then add them all.
 */
function FrameRegistrar({ module: m, pageFrames, selection, onCancel, onAdd }) {
    const [manual, setManual] = useState(false);
    const registered = useMemo(() => new Set(m.screens.map(s => s.frameId)), [m.screens]);
    const candidates = useMemo(() => pageFrames(m.pageId).filter(f => !registered.has(f.id)), [pageFrames, m.pageId, registered]);
    // Defaults follow the names, but a role the module already has (or an earlier row takes) starts as Skip.
    const initial = useMemo(() => {
        const used = new Set(m.screens.map(s => (s.role === 'dialog' ? `dialog:${s.purpose}` : s.role)));
        return Object.fromEntries(candidates.map(f => {
            let choice = choiceOf(suggestScreens(f.name));
            const taken = rolesOfChoice(choice).filter(r => used.has(r));
            if (taken.length) choice = choice === 'form' && taken.length === 1 ? (taken[0] === 'create' ? 'edit' : 'create') : 'skip';
            rolesOfChoice(choice).forEach(r => used.add(r));
            return [f.id, choice];
        }));
    }, [candidates, m.screens]);
    const [choices, setChoices] = useState(initial);
    useEffect(() => setChoices(initial), [initial]);
    const clash = useMemo(() => {
        const seen = new Set(), dup = new Set();
        for (const f of candidates) for (const r of rolesOfChoice(choices[f.id] || 'skip')) { if (seen.has(r)) dup.add(r); seen.add(r); }
        return dup;
    }, [candidates, choices]);
    const clean = f => String(f.name || '').replace(/^page\s*[·:-]\s*/i, '').trim() || f.name;
    const entries = candidates.flatMap(f => screensOf(choices[f.id] || 'skip', clean(f), f));
    if (manual) return <ScreenForm module={m} selection={selection} onCancel={() => setManual(false)} onSave={s => onAdd([s])} />;
    return (
        <div className="cb-form cb-registrar">
            <b>Register frames</b>
            {candidates.length
                ? <p className="small-label">Frames on this module's page that are not registered yet. Roles are guessed from the names.</p>
                : <p className="small-label">Every frame on this module's page is already registered. Draw a new frame on the page, then reopen this.</p>}
            {candidates.map(f => (
                <div key={f.id} className="cb-reg-row">
                    <span className="cb-reg-name" title={f.name}>{clean(f)}</span>
                    <Select aria-label={`Role of ${f.name}`} value={choices[f.id] || 'skip'} onChange={e => setChoices(c => ({ ...c, [f.id]: e.target.value }))}>
                        {FRAME_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </Select>
                </div>
            ))}
            {clash.size > 0 && <small className="cb-error">Two frames share the {[...clash].map(r => r.replace('dialog:', 'dialog ')).join(', ')} role — a module has one of each.</small>}
            <div className="cb-form-actions">
                <button type="button" className="wide-button" onClick={onCancel}>Cancel</button>
                <button type="button" className="wide-button primary" disabled={!entries.length || clash.size > 0} onClick={() => onAdd(entries)}>{entries.length ? `Add ${candidates.filter(f => (choices[f.id] || 'skip') !== 'skip').length} frame${candidates.filter(f => (choices[f.id] || 'skip') !== 'skip').length > 1 ? 's' : ''}` : 'Add'}</button>
            </div>
            <button type="button" className="cb-link" onClick={() => setManual(true)}>Pick a frame on the canvas instead…</button>
        </div>
    );
}

function ScreenForm({ module: m, selection, onCancel, onSave }) {
    const frame = selection.length === 1 && selection[0].type === 'frame' ? selection[0] : null;
    const onPage = frame && frame.pageId === m.pageId;
    const used = new Set(m.screens.map(s => s.role).filter(r => CRUD_ROLES.includes(r)));
    const [role, setRole] = useState(() => ROLES.find(r => !used.has(r) && r !== 'dialog') || 'custom');
    const usedPurposes = new Set(m.screens.filter(s => s.role === 'dialog').map(s => s.purpose));
    const [purpose, setPurpose] = useState(() => PURPOSES.find(([p]) => !usedPurposes.has(p))?.[0] || 'delete');
    const [name, setName] = useState('');
    return (
        <form className="cb-form" onSubmit={e => {
            e.preventDefault();
            if (frame && onPage) onSave({ frameId: frame.id, pageId: frame.pageId, role, ...(role === 'dialog' ? { purpose } : {}), name: name.trim() || frame.name });
        }}>
            <b>Register frame</b>
            {!frame && <p className="small-label">Select one top-level frame on the canvas (this module's source page).</p>}
            {frame && !onPage && <p className="cb-error">Frame "{frame.name}" is not from this module's source page.</p>}
            {frame && onPage && <p className="small-label">Frame: <b>{frame.name}</b></p>}
            <label>Role<Select value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r} value={r} disabled={used.has(r)}>{ROLE_LABEL[r]}{used.has(r) ? ' (already used)' : ''}</option>)}
            </Select></label>
            {role === 'dialog' && <label>Dialog for<Select value={purpose} onChange={e => setPurpose(e.target.value)}>
                {PURPOSES.map(([p, l]) => <option key={p} value={p} disabled={usedPurposes.has(p)}>{l}{usedPurposes.has(p) ? ' (already used)' : ''}</option>)}
            </Select></label>}
            {role === 'dialog' && <p className="small-label">The frame should contain a Dialog component: its title, message and button labels are used by the app.</p>}
            <label>Screen name<input placeholder={frame?.name || ''} value={name} onChange={e => setName(e.target.value)} /></label>
            <div className="cb-form-actions"><button type="button" className="wide-button" onClick={onCancel}>Cancel</button><button className="wide-button primary" disabled={!frame || !onPage}>Register</button></div>
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
                : <p className="small-label cb-pad">No issues.</p>)}
        </div>
    );
}

const rootOf = (modules, m) => {
    let c = m;
    for (let n = 0; c.parentId && n < 20; n++) c = modules.find(x => x.id === c.parentId) || c;
    return c;
};
