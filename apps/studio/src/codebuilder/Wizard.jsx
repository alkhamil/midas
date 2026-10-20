// "New module" wizard: Page → Module → Screens → Fields → Review. Each step needs only what the design cannot tell us:
// the page comes from the flagged pages, the screens are guessed from the frame names, the fields from the form frames.
import { useEffect, useMemo, useState } from 'react';
import { CRUD_ROLES, inferFields, kebabCase, ROLE_LABEL } from '@midas/builder-core';
import { EntityEditor } from './Inspector.jsx';
import { FrameChoiceList, useFrameChoices } from './frames.jsx';
import { Select } from './Select.jsx';

const NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const dirOf = (modules, parentId, name) => {
    const parts = [name];
    for (let c = modules.find(x => x.id === parentId), n = 0; c && n < 20; c = modules.find(x => x.id === c.parentId), n++) parts.unshift(c.name);
    return parts.join('/');
};

export function ModuleWizard({ pages, modules, ctx, pageFrames, currentPage, onFlagPage, onCancel, onCreate }) {
    const flagged = useMemo(() => pages.filter(p => p.codeBuilder), [pages]);
    const [step, setStep] = useState(0);
    const [pageId, setPageId] = useState(() => (flagged.some(p => p.id === currentPage) ? currentPage : flagged[0]?.id || ''));
    useEffect(() => { if (!flagged.some(p => p.id === pageId)) setPageId(flagged.some(p => p.id === currentPage) ? currentPage : flagged[0]?.id || ''); }, [flagged]); // eslint-disable-line react-hooks/exhaustive-deps
    const page = pages.find(p => p.id === pageId);
    const usedBy = modules.find(m => m.pageId === pageId);

    // ---- module info (re-derived from the page until edited)
    const [label, setLabel] = useState('');
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [permissionKey, setPermissionKey] = useState('');
    const [advanced, setAdvanced] = useState(false);
    const [touched, setTouched] = useState(false);
    useEffect(() => {
        if (touched || !page) return;
        setLabel(page.name);
        setName(kebabCase(page.name));
        // A page nested under another module's page makes the module a child of that module (Master Data → Region).
        setParentId(modules.find(m => page.parentId && m.pageId === page.parentId)?.id || '');
    }, [pageId, page?.name]); // eslint-disable-line react-hooks/exhaustive-deps
    const taken = modules.some(m => m.name === name && (m.parentId || '') === parentId);
    const nameOk = NAME_RE.test(name) && !taken;

    // ---- screens
    const candidates = useMemo(() => (pageId ? pageFrames(pageId) : []), [pageFrames, pageId]);
    const frames = useFrameChoices(candidates, []);
    const roles = new Set(frames.entries.map(s => s.role));
    const hasCrud = [...roles].some(r => CRUD_ROLES.includes(r));
    const steps = hasCrud ? ['Page', 'Module', 'Screens', 'Fields', 'Review'] : ['Page', 'Module', 'Screens', 'Review'];
    const current = steps[step];

    // ---- fields (read from the form frames once, then editable)
    const [fields, setFields] = useState([]);
    const [fieldsTouched, setFieldsTouched] = useState(false);
    const formFrameIds = useMemo(() => [...new Set(frames.entries.filter(s => s.role === 'create' || s.role === 'edit').map(s => s.frameId))], [frames.entries]);
    useEffect(() => {
        if (current === 'Fields' && !fieldsTouched) setFields(inferFields(ctx, formFrameIds, modules));
    }, [current, formFrameIds]); // eslint-disable-line react-hooks/exhaustive-deps

    const canNext = current === 'Page' ? !!pageId : current === 'Module' ? nameOk && !!label.trim() : current === 'Screens' ? frames.clash.size === 0 : true;
    const create = () => onCreate({
        pageId, label: label.trim() || name, name, parentId: parentId || null, ...(permissionKey ? { permissionKey } : {}),
        screens: frames.entries,
        entity: { fields: hasCrud ? fields : [], ...(roles.has('dialog') && frames.entries.some(s => s.purpose === 'restore') ? { softDelete: true } : {}) },
    });

    return (
        <div className="cb-form cb-wizard">
            <div className="cb-wiz-head">
                <b>New module</b>
                <span className="small-label">Step {step + 1} of {steps.length} · {current}</span>
            </div>
            <ol className="cb-steps" aria-label="Steps">
                {steps.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} title={s} />)}
            </ol>

            {current === 'Page' && (
                <>
                    <p className="small-label">Which page is this module built from? Only pages flagged “Use in Code Builder” are listed.</p>
                    {flagged.map(p => (
                        <label key={p.id} className={`cb-pick ${p.id === pageId ? 'on' : ''}`}>
                            <input type="radio" name="wiz-page" checked={p.id === pageId} onChange={() => { setPageId(p.id); setTouched(false); }} />
                            <span>{p.name}</span>
                            {modules.some(m => m.pageId === p.id) && <small>already a module</small>}
                        </label>
                    ))}
                    {!flagged.length && <small className="cb-hint">No flagged pages yet. Flag a page below, or right-click it in the Pages list and choose “Use in Code Builder”.</small>}
                    {pages.filter(p => !p.codeBuilder && !p.folder && !/^library\b/i.test(p.name)).length > 0 && (
                        <details className="cb-more">
                            <summary>Flag another page</summary>
                            {pages.filter(p => !p.codeBuilder && !/^library\b/i.test(p.name)).map(p => (
                                <div key={p.id} className="cb-flag-row"><span title={p.name}>{p.name}</span><button type="button" className="cb-pill" onClick={() => { onFlagPage(p.id); setPageId(p.id); setTouched(false); }}>Flag</button></div>
                            ))}
                        </details>
                    )}
                </>
            )}

            {current === 'Module' && (
                <>
                    <label>Label<input autoFocus value={label} onChange={e => { setLabel(e.target.value); setTouched(true); if (!advanced) setName(kebabCase(e.target.value)); }} /></label>
                    <label>Parent menu<Select value={parentId} onChange={e => { setParentId(e.target.value); setTouched(true); }}>
                        <option value="">— none (top-level menu) —</option>
                        {modules.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </Select></label>
                    <div className="cb-path" title="URL path in the generated app">URL <code>/{dirOf(modules, parentId, name)}</code></div>
                    {usedBy && <small className="cb-hint">Page “{page?.name}” already sources the module “{usedBy.label}”.</small>}
                    {!NAME_RE.test(name) && <small className="cb-error">Folder name: lowercase letters and hyphens, e.g. user-management.</small>}
                    {taken && <small className="cb-error">Another module at this level already uses “{name}”.</small>}
                    <button type="button" className="cb-link" onClick={() => setAdvanced(a => !a)}>{advanced ? 'Hide' : 'Show'} folder name and permission key</button>
                    {advanced && (
                        <>
                            <label>Folder name<input className={nameOk ? '' : 'invalid'} value={name} onChange={e => { setName(e.target.value); setTouched(true); }} /></label>
                            <label>Permission key<input placeholder={name} value={permissionKey} onChange={e => setPermissionKey(e.target.value)} /></label>
                        </>
                    )}
                </>
            )}

            {current === 'Screens' && (
                <>
                    {candidates.length
                        ? <p className="small-label">Frames on “{page?.name}”. The role of each is guessed from its name; change it or skip a frame.</p>
                        : <p className="small-label">“{page?.name}” has no frames yet. Draw them on the page, or continue to create an empty module.</p>}
                    <FrameChoiceList candidates={candidates} choices={frames.choices} setChoice={frames.setChoice} clash={frames.clash} />
                </>
            )}

            {current === 'Fields' && (
                <>
                    <p className="small-label">Read from the form frames in the design. Adjust names, types and rules.</p>
                    {!fields.length && <small className="cb-hint">No form fields were found in the design. Add the fields here.</small>}
                    <EntityEditor module={{ entity: { fields } }} modules={modules} onChange={f => { setFields(f); setFieldsTouched(true); }} />
                </>
            )}

            {current === 'Review' && (
                <dl className="cb-review">
                    <dt>Module</dt><dd>{label.trim() || name}</dd>
                    <dt>Page</dt><dd>{page?.name}</dd>
                    <dt>Folder</dt><dd className="cb-mono-wrap">src/modules/{dirOf(modules, parentId, name)}</dd>
                    <dt>URL</dt><dd className="cb-mono-wrap">/{dirOf(modules, parentId, name)}</dd>
                    <dt>Screens</dt>
                    <dd>{frames.entries.length ? frames.entries.map((s, i) => <span key={i} className={`cb-role r-${s.role}`} title={s.name}>{ROLE_LABEL[s.role]}{s.purpose ? ` · ${s.purpose}` : ''}</span>) : 'none yet'}</dd>
                    {hasCrud && <><dt>Fields</dt><dd>{fields.length ? fields.map(f => f.label || f.name).join(', ') : 'none'}</dd></>}
                    {frames.entries.some(s => s.purpose === 'restore') && <><dt>Delete</dt><dd>Soft delete (restore dialog found)</dd></>}
                </dl>
            )}

            <div className="cb-form-actions">
                <button type="button" className="wide-button" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>{step === 0 ? 'Cancel' : 'Back'}</button>
                {step < steps.length - 1
                    ? <button type="button" className="wide-button primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
                    : <button type="button" className="wide-button primary" onClick={create}>Create module</button>}
            </div>
        </div>
    );
}
