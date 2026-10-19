// Properties Inspector Code Builder: properti node yang diklik di Live DOM Renderer (props komponen dari mapping
// library, teks, perilaku, binding data) serta layout aplikasi (sidebar/topbar) dan entity module.
// Semua perubahan disimpan sebagai konfigurasi di project (`screens[].nodes`, `layout`, `entity`) — desain tidak diubah.
import { useEffect, useState } from 'react';
import { Select } from './Select.jsx';
import { autoAction, behaviorOf, camelCase, fieldBinding, FIELD_TYPES, filterFields, formItemOf, isNumericField, parseRules, relationOf, ROLE_LABEL, ROW_ACTIONS, tableModel, titleCase, withRule } from '@midas/builder-core';

function Row({ label, hint, reset, children }) {
    return (
        <label className="cb-prop">
            <span className="cb-prop-label" title={hint}>{label}{reset && <button type="button" className="cb-prop-reset" title="Reset to the design value" onClick={reset}>↺</button>}</span>
            <span className="cb-prop-control">{children}</span>
        </label>
    );
}

function Section({ title, children, aside }) {
    return <section className="cb-insp-section"><header><b>{title}</b>{aside}</header>{children}</section>;
}

const Check = ({ checked, onChange, children }) => <label className="cb-check"><input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />{children}</label>;

// ------------------------------------------------------------------ props komponen

function propControl(def, value, set) {
    if (def.type === 'boolean') return <input type="checkbox" checked={!!value} onChange={e => set(e.target.checked)} />;
    if (def.type === 'enum') {
        const options = [...new Set(Object.values(def.values || {}).concat(value != null ? [value] : []).map(String))];
        if (options.length) return <Select value={value ?? ''} onChange={e => set(e.target.value)}>{value == null && <option value="" />}{options.map(o => <option key={o}>{o}</option>)}</Select>;
    }
    return <input value={value ?? ''} onChange={e => set(e.target.value)} />;
}

function ComponentProps({ node, cfg, setCfg }) {
    const defs = node.propDefs.filter(d => d.name !== 'testId');
    if (!defs.length) return <p className="small-label">This component has no configurable properties.</p>;
    const overridden = name => Object.hasOwn(cfg.props || {}, name);
    const set = (def, value) => setCfg(c => {
        const props = { ...c.props };
        if (value === node.baseProps[def.name]) delete props[def.name];
        else props[def.name] = value;
        return { ...c, props };
    });
    return defs.map(d => {
        const value = node.props[d.name];
        return (
            <Row key={d.name} label={d.name === 'children' ? 'Text' : d.label || titleCase(d.name)} hint={`prop \`${d.name}\``}
                reset={overridden(d.name) ? () => setCfg(c => { const props = { ...c.props }; delete props[d.name]; return { ...c, props }; }) : null}>
                {propControl(d, value, v => set(d, v))}
            </Row>
        );
    });
}

// ------------------------------------------------------------------ validasi & relasi (level field entity)

/** Baris aturan: judul + keterangan di kiri, saklar di kanan. */
function RuleToggle({ title, hint, checked, onChange }) {
    return (
        <label className={`cb-rule ${checked ? 'on' : ''}`}>
            <span className="cb-rule-text"><b>{title}</b>{hint && <small>{hint}</small>}</span>
            <input type="checkbox" role="switch" className="cb-switch" checked={!!checked} onChange={e => onChange(e.target.checked)} />
        </label>
    );
}

/** Aturan validasi sebuah field entity — dipakai di editor Data module dan di tab Validasi komponen form. */
function FieldRules({ field, onChange }) {
    const r = parseRules(field);
    const num = isNumericField(field);
    const text = ['string', 'text', 'password'].includes(field.type);
    const set = (key, value) => onChange(withRule(field, key, value));
    let regexError = '';
    if (r.pattern) { try { new RegExp(r.pattern); } catch (e) { regexError = 'Invalid regex pattern'; } }
    const active = [r.required && 'Required', r.min !== '' && `min ${r.min}`, r.max !== '' && `max ${r.max}`, r.email && 'Email', r.pattern && 'Pattern', r.noEmoticon && 'No emoji'].filter(Boolean);
    const unit = num ? '' : 'chars';
    return (
        <div className="cb-rules">
            <div className="cb-rule-summary">
                {active.length ? active.map(a => <span key={a} className="cb-chip">{a}</span>) : <span className="small-label">No rules yet — the field may be left empty.</span>}
            </div>
            {field.type !== 'boolean' && <RuleToggle title="Required" hint="Cannot be empty when saved" checked={r.required} onChange={on => set('required', on)} />}
            {(num || text) && (
                <div className="cb-rule-group">
                    <div className="cb-rule-title">{num ? 'Value range' : 'Text length'}</div>
                    <div className="cb-minmax">
                        <label><span>Minimum</span><div className="cb-unit"><input type="number" placeholder="—" value={r.min} onChange={e => set('min', e.target.value)} />{unit && <em>{unit}</em>}</div></label>
                        <label><span>Maximum</span><div className="cb-unit"><input type="number" placeholder="—" value={r.max} onChange={e => set('max', e.target.value)} />{unit && <em>{unit}</em>}</div></label>
                    </div>
                </div>
            )}
            {text && (
                <div className="cb-rule-group">
                    <div className="cb-rule-title">Format</div>
                    {field.type !== 'password' && <RuleToggle title="Email format" hint="Example: name@company.com" checked={r.email} onChange={on => set('email', on)} />}
                    <RuleToggle title="No emoji" hint="Rejects emoji in the input" checked={r.noEmoticon} onChange={on => set('noEmoticon', on)} />
                    <label className="cb-regex"><span>Pattern (regex)</span>
                        <input className={regexError ? 'invalid' : ''} placeholder="^[A-Z]{3}[0-9]+$" spellCheck={false} value={r.pattern} onChange={e => set('pattern', e.target.value)} />
                        {regexError && <small className="cb-error">{regexError}</small>}
                    </label>
                </div>
            )}
            {!num && !text && field.type === 'boolean' && <p className="small-label">Yes/no fields have no validation rules.</p>}
        </div>
    );
}

/** Relasi ke module lain: module tujuan + field yang jadi label opsi (nilai tersimpan = id baris). */
function RelationPicker({ field, modules, onChange }) {
    const rel = relationOf(field, modules);
    const targets = modules.filter(m => m.entity?.fields?.length);
    const labelFields = (rel?.module.entity?.fields || []).filter(f => f.type !== 'password');
    const moduleId = typeof field.relation === 'object' ? field.relation.moduleId : rel?.module.id || '';
    const pickModule = id => {
        const m = modules.find(x => x.id === id);
        const first = (m?.entity?.fields || []).find(f => f.name === 'name') || (m?.entity?.fields || []).find(f => f.type === 'string') || m?.entity?.fields?.[0];
        onChange({ ...field, relation: id ? { moduleId: id, labelField: first?.name } : undefined });
    };
    return (
        <>
            <Row label="Target module" hint="Select options are loaded from this module's data">
                <Select value={moduleId} onChange={e => pickModule(e.target.value)}>
                    <option value="">— choose a module —</option>
                    {targets.map(m => <option key={m.id} value={m.id}>{m.label} ({m.name})</option>)}
                </Select>
            </Row>
            {rel && (
                <Row label="Display field" hint="Target module field used as the option text">
                    <Select value={rel.labelField} onChange={e => onChange({ ...field, relation: { moduleId: rel.module.id, labelField: e.target.value } })}>
                        {labelFields.map(f => <option key={f.name} value={f.name}>{f.label || titleCase(f.name)}</option>)}
                    </Select>
                </Row>
            )}
            {!targets.length && <p className="cb-error">No other module has entity fields yet.</p>}
            {rel && <p className="small-label">Nilai tersimpan: id baris {rel.module.label}. Opsi diambil dari <code>use{rel.module.name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}List</code>.</p>}
        </>
    );
}

// ------------------------------------------------------------------ perilaku

function ActionEditor({ node, cfg, setCfg, screen, module, screens }) {
    const auto = autoAction(module, screen, node.props.children ?? node.props.label ?? node.props.actionLabel);
    const cur = cfg.action || null;
    const eff = cur || auto;
    const targets = screens.filter(s => !s.role.startsWith('edit') && s.role !== 'view');
    const label = a => ({ none: 'None', navigate: 'Go to screen', submit: 'Submit form', back: 'Go back' })[a];
    return (
        <>
            <Row label="On click" hint={cur ? '' : `Automatic from the button text: ${label(auto.type)}`}>
                <Select value={cur?.type || ''} onChange={e => setCfg(c => ({ ...c, action: e.target.value ? { type: e.target.value, ...(e.target.value === 'navigate' ? { screenId: targets[0]?.id } : {}) } : undefined }))}>
                    <option value="">Automatic ({label(auto.type)})</option>
                    {['none', 'navigate', 'submit', 'back'].map(t => <option key={t} value={t}>{label(t)}</option>)}
                </Select>
            </Row>
            {eff.type === 'navigate' && (
                <Row label="Target">
                    <Select value={eff.screenId || ''} onChange={e => setCfg(c => ({ ...c, action: { type: 'navigate', screenId: e.target.value } }))}>
                        {targets.map(s => <option key={s.id} value={s.id}>{s.module.label} · {s.name} ({ROLE_LABEL[s.role]})</option>)}
                    </Select>
                </Row>
            )}
            {eff.type === 'submit' && screen.role !== 'create' && screen.role !== 'edit' && <p className="cb-error">Submit form only applies to Create/Edit screens.</p>}
        </>
    );
}

/** Properties tab of a Table: columns (header text, width, order), empty text, action header, page size. */
function TableProps({ cfg, setCfg, entity }) {
    const model = tableModel(entity, cfg);
    const fields = entity?.fields || [];
    if (!fields.length) return <Section title="Columns"><p className="cb-error">This module has no entity fields yet — table columns follow the fields. Add them in the Module data section.</p></Section>;
    const names = model.columns.map(c => c.key);
    const t = cfg.table || {};
    const patch = p => setCfg(c => ({ ...c, table: { ...c.table, ...p } }));
    const setCols = cols => patch({ columns: cols });
    const move = (i, d) => { const n = [...names]; [n[i], n[i + d]] = [n[i + d], n[i]]; setCols(n); };
    const setMap = (key, name, value) => patch({ [key]: { ...(t[key] || {}), [name]: value || undefined } });
    return (
        <>
            <Section title="Columns">
                <div className="cb-colrows">
                    {model.columns.map((c, i) => (
                        <div key={c.key} className="cb-colrow">
                            <input aria-label={`Header of ${c.key}`} value={t.headers?.[c.key] ?? ''} placeholder={c.header} onChange={e => setMap('headers', c.key, e.target.value)} />
                            <input aria-label={`Width of ${c.key}`} className="narrow" type="number" min="40" placeholder="auto" value={t.widths?.[c.key] ?? ''} onChange={e => setMap('widths', c.key, Number(e.target.value) || undefined)} />
                            <button type="button" disabled={i === 0} aria-label="Move up" onClick={() => move(i, -1)}>↑</button>
                            <button type="button" disabled={i === names.length - 1} aria-label="Move down" onClick={() => move(i, 1)}>↓</button>
                            <button type="button" aria-label="Remove column" onClick={() => setCols(names.filter(x => x !== c.key))}>×</button>
                        </div>
                    ))}
                </div>
                <p className="small-label">Header text · width in px (empty = auto). Field: {model.columns.map(c => c.key).join(', ') || '—'}</p>
                {fields.filter(f => !names.includes(f.name) && f.type !== 'password').length > 0 && (
                    <Select value="" onChange={e => e.target.value && setCols([...names, e.target.value])}>
                        <option value="">＋ Add column…</option>
                        {fields.filter(f => !names.includes(f.name) && f.type !== 'password').map(f => <option key={f.name} value={f.name}>{f.label || titleCase(f.name)}</option>)}
                    </Select>
                )}
            </Section>
            <Section title="Table">
                <Row label="Empty text"><input value={t.emptyText ?? ''} placeholder={model.emptyText} onChange={e => patch({ emptyText: e.target.value || undefined })} /></Row>
                <Row label="Action header"><input value={t.actionHeader ?? ''} placeholder={model.actionHeader} onChange={e => patch({ actionHeader: e.target.value || undefined })} /></Row>
                <Row label="Default page size"><Select value={String(model.pageSize)} onChange={e => patch({ pageSize: Number(e.target.value) === 10 ? undefined : Number(e.target.value) })}>{[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}</Select></Row>
            </Section>
        </>
    );
}

/** Data tab of a Table: row actions, confirmation dialogs, soft delete. */
function TableData({ cfg, setCfg, entity, module, actions }) {
    const model = tableModel(entity, cfg);
    const patch = p => setCfg(c => ({ ...c, table: { ...c.table, ...p } }));
    const labels = { view: 'View', edit: 'Edit', delete: 'Delete', restore: 'Restore' };
    const avail = model.softDelete ? ROW_ACTIONS : ROW_ACTIONS.filter(a => a !== 'restore');
    const dialogs = module.screens.filter(s => s.role === 'dialog');
    return (
        <>
            <Section title="Row actions">
                <div className="cb-checks">
                    {avail.map(a => <Check key={a} checked={model.rowActions.includes(a)} onChange={on => patch({ rowActions: avail.filter(x => (x === a ? on : model.rowActions.includes(x))) })}>{labels[a]}</Check>)}
                </div>
                <RuleToggle title="Ask for confirmation" hint="Delete and Restore open a confirm dialog first" checked={model.confirm} onChange={on => patch({ skipConfirm: on ? undefined : true })} />
                <p className="small-label">
                    {dialogs.length ? <>Dialog texts come from the design: {dialogs.map(d => d.name).join(', ')}.</> : <>No dialog designed yet — default texts are used. Register a frame with the Dialog component as a <b>Dialog</b> screen to use your own.</>}
                </p>
            </Section>
            <Section title="Soft delete">
                <RuleToggle title="Deleted rows can be restored" hint="Delete marks the row as deleted; the filter dialog gets “Show deleted” and rows show a Restore action" checked={!!model.softDelete} onChange={on => actions.setEntity({ softDelete: on || undefined })} />
            </Section>
        </>
    );
}

/** Data tab of a FilterToolbar: which fields appear in the filter dialog. */
function FilterData({ cfg, setCfg, entity }) {
    const fields = (entity?.fields || []).filter(f => f.type !== 'password');
    const chosen = filterFields(entity, cfg).map(f => f.name);
    const toggle = (name, on) => setCfg(c => ({ ...c, filter: { fields: fields.map(f => f.name).filter(n => (n === name ? on : chosen.includes(n))) } }));
    return (
        <Section title="Filter dialog">
            <p className="small-label">The Filter button opens a dialog with these fields. Search always covers every column.</p>
            <div className="cb-checks">{fields.map(f => <Check key={f.name} checked={chosen.includes(f.name)} onChange={on => toggle(f.name, on)}>{f.label || titleCase(f.name)}</Check>)}</div>
            {!fields.length && <p className="cb-error">This module has no entity fields yet.</p>}
        </Section>
    );
}

/** Layout tab of a form field: 12-column grid span and FormItem label layout (same options as the base project's FormItem). */
function FieldLayout({ node, cfg, setCfg }) {
    const fi = formItemOf(node);
    const patch = p => setCfg(c => ({ ...c, form: { ...c.form, ...p } }));
    const switchField = node.exportName === 'SwitchField';
    return (
        <Section title="Form layout">
            <Row label="Width" hint="Columns of the 12-column form grid">
                <Select value={String(cfg.form?.span ?? '')} onChange={e => patch({ span: Number(e.target.value) || undefined })}>
                    <option value="">Auto (from the design)</option>
                    {[[12, 'Full width (12)'], [9, '3/4 (9)'], [8, '2/3 (8)'], [6, 'Half (6)'], [4, 'Third (4)'], [3, 'Quarter (3)']].map(([n, l]) => <option key={n} value={n}>{l}</option>)}
                </Select>
            </Row>
            {!switchField && (
                <>
                    <Row label="Label position">
                        <Select value={fi.layout} onChange={e => patch({ layout: e.target.value === 'vertical' ? undefined : e.target.value })}>
                            <option value="vertical">Above the field (vertical)</option>
                            <option value="horizontal">Beside the field (horizontal)</option>
                        </Select>
                    </Row>
                    {fi.layout === 'horizontal' && (
                        <>
                            <Row label="Label width">
                                <Select value={String(fi.labelWidth)} onChange={e => patch({ labelWidth: Number(e.target.value) === 256 ? undefined : Number(e.target.value) })}>
                                    {[160, 200, 256, 320].map(n => <option key={n} value={n}>{n}px{n === 256 ? ' (default)' : ''}</option>)}
                                </Select>
                            </Row>
                            <Row label="Align">
                                <Select value={fi.align} onChange={e => patch({ align: e.target.value === 'start' ? undefined : e.target.value })}>
                                    <option value="start">Top</option>
                                    <option value="center">Center</option>
                                </Select>
                            </Row>
                        </>
                    )}
                    <Row label="Tooltip" hint="Info icon next to the label"><input placeholder="optional" value={cfg.form?.tooltip ?? ''} onChange={e => patch({ tooltip: e.target.value || undefined })} /></Row>
                </>
            )}
        </Section>
    );
}

function FieldBinding({ node, cfg, setCfg, entity, modules, setFields, part = 'all' }) {
    const fields = entity?.fields || [];
    const bound = fieldBinding(entity, node);
    const edit = (name, next) => setFields(fields.map(f => (f.name === name ? next : f)));
    const create = () => {
        const label = String(node.props.label ?? node.name ?? 'Field');
        let name = camelCase(label) || 'field';
        while (fields.some(f => f.name === name)) name += '2';
        setFields([...fields, { name, label, type: DEFAULT_TYPE[node.exportName] || 'string', required: false, sortable: false, filterable: false, ...(node.exportName === 'SelectField' ? { options: ['opsi1', 'opsi2'] } : {}) }]);
        setCfg(c => ({ ...c, field: name }));
    };
    if (part === 'rules') return bound ? <FieldRules field={bound} onChange={next => edit(bound.name, next)} /> : <p className="small-label">Bind the component to a data field first (Data tab) to set validation.</p>;
    return (
        <>
            <Row label="Data field" hint="The entity field this component fills">
                <Select value={cfg.field || ''} onChange={e => setCfg(c => ({ ...c, field: e.target.value || undefined }))}>
                    <option value="">{bound ? `Automatic (${bound.name})` : 'Not bound'}</option>
                    {fields.map(f => <option key={f.name} value={f.name}>{f.label || titleCase(f.name)} · {f.type}</option>)}
                </Select>
            </Row>
            {!bound && <button type="button" className="wide-button" onClick={create}>＋ Create a field from this component</button>}
            {bound && node.exportName === 'SelectField' && (
                <>
                    <Row label="Option source">
                        <Select value={bound.type === 'relation' ? 'relation' : 'enum'} onChange={e => edit(bound.name, e.target.value === 'relation' ? { ...bound, type: 'relation', options: undefined } : { ...bound, type: 'enum', relation: undefined, options: bound.options?.length ? bound.options : ['opsi1', 'opsi2'] })}>
                            <option value="enum">Fixed options</option>
                            <option value="relation">Relation to another module</option>
                        </Select>
                    </Row>
                    {bound.type === 'relation'
                        ? <RelationPicker field={bound} modules={modules} onChange={next => edit(bound.name, next)} />
                        : <Row label="Options"><input placeholder="active, inactive" value={(bound.options || []).join(', ')} onChange={e => edit(bound.name, { ...bound, options: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /></Row>}
                </>
            )}
        </>
    );
}

// ------------------------------------------------------------------ layout aplikasi

function SidebarInspector({ layout, lib, setLayout, modules }) {
    const iconNames = Array.isArray(lib?.iconNames) ? lib.iconNames : [];
    const items = layout.items;
    const slim = i => ({ moduleId: i.moduleId, label: i.label, icon: i.icon, hidden: i.hidden || undefined });
    // The saved list is flat (top-level entries, then each parent's children); a parent's own page is not a separate entry.
    const flatten = list => list.flatMap(i => [slim(i), ...(i.children || []).filter(c => c.moduleId !== i.moduleId).map(slim)]);
    const patch = (moduleId, change) => setLayout(l => ({ ...l, items: flatten(items).map(i => (i.moduleId === moduleId ? { ...i, ...change } : i)) }));
    // Reorder among siblings: top-level entries (parentId null) or the children of one parent.
    const move = (parentId, idx, d) => setLayout(l => {
        const next = items.map(i => ({ ...i, children: i.children ? i.children.filter(c => c.moduleId !== i.moduleId) : undefined }));
        const list = parentId ? next.find(i => i.moduleId === parentId).children : next;
        [list[idx], list[idx + d]] = [list[idx + d], list[idx]];
        return { ...l, items: flatten(next) };
    });
    const defaultLabel = id => modules.find(m => m.id === id)?.label;
    const entry = ({ it, idx, count, parentId }) => (
        <div key={it.moduleId} className={`cb-menu-item ${it.hidden ? 'off' : ''} ${parentId ? 'child' : ''}`}>
            <div className="cb-menu-top">
                <input aria-label="Label menu" value={it.label} placeholder={defaultLabel(it.moduleId)} onChange={e => patch(it.moduleId, { label: e.target.value })} />
                <button type="button" disabled={idx === 0} aria-label="Move up" onClick={() => move(parentId, idx, -1)}>↑</button>
                <button type="button" disabled={idx === count - 1} aria-label="Move down" onClick={() => move(parentId, idx, 1)}>↓</button>
            </div>
            <div className="cb-menu-bottom">
                {parentId ? null : iconNames.length > 0
                    ? <Select aria-label="Ikon" value={it.icon} onChange={e => patch(it.moduleId, { icon: e.target.value })}>{[...new Set([it.icon, ...iconNames])].map(n => <option key={n}>{n}</option>)}</Select>
                    : <input aria-label="Ikon" value={it.icon} onChange={e => patch(it.moduleId, { icon: e.target.value })} />}
                <Check checked={!it.hidden} onChange={on => patch(it.moduleId, { hidden: on ? undefined : true })}>Visible</Check>
                {it.path ? <code>{it.path}</code> : <span className="small-label">Group</span>}
            </div>
        </div>
    );
    return (
        <>
            <Section title="Sidebar">
                <Row label="App name"><input value={layout.appName} onChange={e => setLayout(l => ({ ...l, appName: e.target.value }))} /></Row>
            </Section>
            <Section title="Menu">
                <p className="small-label">One menu per module; a module with a parent appears under it (Parent → Child). The order here is the order in the sidebar.</p>
                {items.map((it, i) => {
                    const kids = (it.children || []).filter(c => c.moduleId !== it.moduleId);
                    return (
                        <div key={it.moduleId}>
                            {entry({ it, idx: i, count: items.length, parentId: null })}
                            {kids.map((c, k) => entry({ it: c, idx: k, count: kids.length, parentId: it.moduleId }))}
                        </div>
                    );
                })}
                {!items.length && <p className="small-label">No modules yet.</p>}
            </Section>
        </>
    );
}

function TopbarInspector({ layout, setLayout, title, crumbs, screen, setScreen }) {
    return (
        <>
            <Section title="This page">
                <Row label="Title" hint="Shown in the topbar. Leave empty for automatic (Add/Edit/Detail + module name)">
                    <input value={screen.title || ''} placeholder={title} onChange={e => setScreen({ title: e.target.value || undefined })} />
                </Row>
                <Row label="Breadcrumb" hint="Built automatically from the module and page type"><input value={crumbs.map(c => c.label).join(' / ')} disabled /></Row>
            </Section>
            <Section title="User">
                <Row label="Name"><input value={layout.userName} onChange={e => setLayout(l => ({ ...l, userName: e.target.value }))} /></Row>
                <Row label="Role"><input value={layout.userRole} onChange={e => setLayout(l => ({ ...l, userRole: e.target.value }))} /></Row>
                <p className="small-label">In the app, the name and role come from the login session; these values are for preview only.</p>
            </Section>
        </>
    );
}

// ------------------------------------------------------------------ entity module

export function EntityEditor({ module: m, modules = [], onChange }) {
    const fields = m.entity?.fields || [];
    const [openIdx, setOpenIdx] = useState(null);
    const set = (i, patch) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    return (
        <Section title="Module data" aside={<span className="cb-badge">{fields.length} {fields.length === 1 ? "field" : "fields"}</span>}>
            <p className="small-label">Entity <b>{m.label}</b> — used for table columns, forms, types, and mock data.</p>
            {fields.map((f, i) => (
                <div key={i} className={`cb-field-card ${openIdx === i ? 'open' : ''}`}>
                    <div className="cb-field-top">
                        <input aria-label="Field name" className={/^[a-z][A-Za-z0-9]*$/.test(f.name) ? '' : 'invalid'} value={f.name} onChange={e => set(i, { name: e.target.value })} />
                        <Select aria-label="Tipe" value={f.type} onChange={e => set(i, { type: e.target.value })}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</Select>
                        <button type="button" aria-label="Field options" onClick={() => setOpenIdx(openIdx === i ? null : i)}>⋯</button>
                        <button type="button" aria-label="Remove field" onClick={() => onChange(fields.filter((_, j) => j !== i))}>×</button>
                    </div>
                    {openIdx === i && (
                        <div className="cb-field-more">
                            <Row label="Label"><input placeholder={titleCase(f.name)} value={f.label || ''} onChange={e => set(i, { label: e.target.value || undefined })} /></Row>
                            <div className="cb-checks">
                                {[['sortable', 'Sortir'], ['filterable', 'Filter']].map(([k, l]) => <Check key={k} checked={f[k]} onChange={on => set(i, { [k]: on })}>{l}</Check>)}
                            </div>
                            <div className="cb-subhead">Validation</div>
                            <FieldRules field={f} onChange={next => onChange(fields.map((x, j) => (j === i ? next : x)))} />
                            {f.type === 'enum' && <Row label="Options"><input placeholder="active, inactive" value={(f.options || []).join(', ')} onChange={e => set(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></Row>}
                            {f.type === 'relation' && <RelationPicker field={f} modules={modules} onChange={next => onChange(fields.map((x, j) => (j === i ? next : x)))} />}
                        </div>
                    )}
                </div>
            ))}
            <button type="button" className="wide-button" onClick={() => { onChange([...fields, { name: `field${fields.length + 1}`, type: 'string', required: false, sortable: false, filterable: false }]); setOpenIdx(fields.length); }}>＋ Add field</button>
        </Section>
    );
}

// ------------------------------------------------------------------ Inspector

export function Inspector({ selected, tree, node, screen, module, screens, entity, layout, lib, modules, title, crumbs = [], actions }) {
    const cfg = node?.cfg || {};
    const setCfg = fn => actions.setNode(selected, fn);
    if (selected === '__sidebar') return <div className="cb-insp"><Header kind="Layout" name="Sidebar" /><SidebarInspector layout={layout} lib={lib} modules={modules} setLayout={actions.setLayout} /></div>;
    if (selected === '__topbar') return <div className="cb-insp"><Header kind="Layout" name="Topbar" /><TopbarInspector layout={layout} setLayout={actions.setLayout} title={title} crumbs={crumbs} screen={screen} setScreen={actions.setScreen} /></div>;
    if (!node) {
        return (
            <div className="cb-insp">
                <Header kind={ROLE_LABEL[screen.role]} name={screen.name} />
                <Section title="How to use"><p className="small-label">Click a component in the preview to edit its properties. Click the sidebar or topbar to edit the app layout. Changes are saved automatically and carried into the generated code.</p></Section>
                <EntityEditor module={module} modules={modules} onChange={actions.setFields} />
            </div>
        );
    }
    const behavior = node.kind === 'component' ? behaviorOf(node.exportName) : null;
    const hide = node !== tree && <Section title="Visibility"><Check checked={cfg.hidden} onChange={on => setCfg(c => ({ ...c, hidden: on || undefined }))}>Hide in the app</Check></Section>;
    const tabs = [];
    if (node.kind === 'component' && behavior !== 'table') tabs.push(['Properties', <Section key="p" title="Properties"><ComponentProps node={node} cfg={cfg} setCfg={setCfg} /></Section>]);
    if (node.kind === 'text') tabs.push(['Properties', (
        <Section key="t" title="Text content">
            <textarea rows={3} value={node.text} onChange={e => setCfg(c => ({ ...c, text: e.target.value === node.designText ? undefined : e.target.value }))} />
            {cfg.text !== undefined && <button type="button" className="cb-link" onClick={() => setCfg(c => ({ ...c, text: undefined }))}>↺ Reset to the design text</button>}
        </Section>
    )]);
    if (node.kind === 'box' || node.kind === 'unsupported') tabs.push(['Properties', node.kind === 'unsupported' ? <Section key="u" title="Unsupported"><p className="cb-error">{node.reason}</p></Section> : <Section key="b" title="Frame"><p className="small-label">{node.children?.length || 0} elements inside this frame. Select an element in the preview or the Layers list to edit its properties.</p></Section>]);
    if (behavior === 'action') tabs.push(['Behavior', <Section key="a" title="On click"><ActionEditor node={node} cfg={cfg} setCfg={setCfg} screen={screen} module={module} screens={screens} /></Section>]);
    if (behavior === 'table') {
        tabs.unshift(['Properties', <TableProps key="tp" cfg={cfg} setCfg={setCfg} entity={entity} />]);
        tabs.push(['Actions', <TableData key="td" cfg={cfg} setCfg={setCfg} entity={entity} module={module} actions={actions} />]);
    }
    if (behavior === 'field') {
        tabs.push(['Data', <Section key="f" title="Data"><FieldBinding node={node} cfg={cfg} setCfg={setCfg} entity={entity} modules={modules} setFields={actions.setFields} part="data" /></Section>]);
        tabs.push(['Layout', <FieldLayout key="lay" node={node} cfg={cfg} setCfg={setCfg} />]);
        tabs.push(['Validation', <Section key="v" title="Validation"><FieldBinding node={node} cfg={cfg} setCfg={setCfg} entity={entity} modules={modules} setFields={actions.setFields} part="rules" /></Section>]);
    }
    if (behavior === 'filter') tabs.push(['Data', <FilterData key="fl" cfg={cfg} setCfg={setCfg} entity={entity} />]);
    return (
        <div className="cb-insp">
            <Header kind={node.kind === 'component' ? node.exportName : node.kind === 'text' ? 'Text' : node.kind === 'box' ? 'Frame' : 'Unsupported'} name={node.name} onReveal={() => actions.reveal(selected)} />
            <Tabs tabs={tabs} id={selected} hide={hide} />
        </div>
    );
}

/** Tab bar segmented bila ada lebih dari satu grup (Properti / Data / Validasi / Perilaku). */
function Tabs({ tabs, id, hide }) {
    const [active, setActive] = useState(0);
    useEffect(() => setActive(0), [id]);
    const names = tabs.map(t => t[0]);
    const idx = Math.min(active, names.length - 1);
    return (
        <>
            {names.length > 1 && (
                <div className="cb-tabs" role="tablist">
                    {names.map((n, i) => <button key={n} type="button" role="tab" aria-selected={i === idx} className={i === idx ? 'on' : ''} onClick={() => setActive(i)}>{n}</button>)}
                </div>
            )}
            {tabs[idx]?.[1]}
            {idx === 0 && hide}
        </>
    );
}

function Header({ kind, name, onReveal }) {
    return (
        <div className="cb-insp-head">
            <span className="cb-badge">{kind}</span>
            <b title={name}>{name}</b>
            {onReveal && <button type="button" className="cb-link" onClick={onReveal} title="Show this layer on the canvas">◎</button>}
        </div>
    );
}
