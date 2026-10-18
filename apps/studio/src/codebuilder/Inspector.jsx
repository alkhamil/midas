// Properties Inspector Code Builder: properti node yang diklik di Live DOM Renderer (props komponen dari mapping
// library, teks, perilaku, binding data) serta layout aplikasi (sidebar/topbar) dan entity module.
// Semua perubahan disimpan sebagai konfigurasi di project (`screens[].nodes`, `layout`, `entity`) — desain tidak diubah.
import { useState } from 'react';
import { autoAction, behaviorOf, camelCase, fieldBinding, FIELD_TYPES, isNumericField, parseRules, relationOf, ROLE_LABEL, ROW_ACTIONS, tableModel, titleCase, withRule } from '@midas/builder-core';

function Row({ label, hint, reset, children }) {
    return (
        <label className="cb-prop">
            <span className="cb-prop-label" title={hint}>{label}{reset && <button type="button" className="cb-prop-reset" title="Kembalikan ke nilai desain" onClick={reset}>↺</button>}</span>
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
        if (options.length) return <select value={value ?? ''} onChange={e => set(e.target.value)}>{value == null && <option value="" />}{options.map(o => <option key={o}>{o}</option>)}</select>;
    }
    return <input value={value ?? ''} onChange={e => set(e.target.value)} />;
}

function ComponentProps({ node, cfg, setCfg }) {
    const defs = node.propDefs.filter(d => d.name !== 'testId');
    if (!defs.length) return <p className="small-label">Komponen ini tidak punya properti yang bisa diatur.</p>;
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
            <Row key={d.name} label={d.name === 'children' ? 'Teks' : d.label || titleCase(d.name)} hint={`prop \`${d.name}\``}
                reset={overridden(d.name) ? () => setCfg(c => { const props = { ...c.props }; delete props[d.name]; return { ...c, props }; }) : null}>
                {propControl(d, value, v => set(d, v))}
            </Row>
        );
    });
}

// ------------------------------------------------------------------ validasi & relasi (level field entity)

/** Aturan validasi sebuah field entity — dipakai di editor Data module dan di inspector komponen form. */
function FieldRules({ field, onChange }) {
    const r = parseRules(field);
    const num = isNumericField(field);
    const text = !num && field.type !== 'boolean';
    const set = (key, value) => onChange(withRule(field, key, value));
    return (
        <>
            {field.type !== 'boolean' && <Check checked={r.required} onChange={on => set('required', on)}>Wajib diisi</Check>}
            {field.type !== 'boolean' && (num || text) && (
                <div className="cb-minmax">
                    <Row label={num ? 'Nilai min' : 'Panjang min'}><input type="number" value={r.min} onChange={e => set('min', e.target.value)} /></Row>
                    <Row label={num ? 'Nilai maks' : 'Panjang maks'}><input type="number" value={r.max} onChange={e => set('max', e.target.value)} /></Row>
                </div>
            )}
            {text && field.type !== 'password' && (
                <div className="cb-checks">
                    <Check checked={r.email} onChange={on => set('email', on)}>Format email</Check>
                    <Check checked={r.noEmoticon} onChange={on => set('noEmoticon', on)}>Tanpa emoticon</Check>
                </div>
            )}
            {text && <Row label="Pola (regex)" hint="Contoh: ^[A-Z]{3}[0-9]+$"><input placeholder="opsional" value={r.pattern} onChange={e => set('pattern', e.target.value)} /></Row>}
        </>
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
            <Row label="Module tujuan" hint="Opsi select diambil dari data module ini">
                <select value={moduleId} onChange={e => pickModule(e.target.value)}>
                    <option value="">— pilih module —</option>
                    {targets.map(m => <option key={m.id} value={m.id}>{m.label} ({m.name})</option>)}
                </select>
            </Row>
            {rel && (
                <Row label="Tampilkan field" hint="Field module tujuan yang jadi teks opsi">
                    <select value={rel.labelField} onChange={e => onChange({ ...field, relation: { moduleId: rel.module.id, labelField: e.target.value } })}>
                        {labelFields.map(f => <option key={f.name} value={f.name}>{f.label || titleCase(f.name)}</option>)}
                    </select>
                </Row>
            )}
            {!targets.length && <p className="cb-error">Belum ada module lain yang punya field entity.</p>}
            {rel && <p className="small-label">Nilai tersimpan: id baris {rel.module.label}. Opsi diambil dari <code>use{rel.module.name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase())}List</code>.</p>}
        </>
    );
}

// ------------------------------------------------------------------ perilaku

function ActionEditor({ node, cfg, setCfg, screen, module, screens }) {
    const auto = autoAction(module, screen, node.props.children ?? node.props.label);
    const cur = cfg.action || null;
    const eff = cur || auto;
    const targets = screens.filter(s => !s.role.startsWith('edit') && s.role !== 'view');
    const label = a => ({ none: 'Tidak ada', navigate: 'Pindah ke screen', submit: 'Simpan form', back: 'Kembali' })[a];
    return (
        <>
            <Row label="Saat diklik" hint={cur ? '' : `Otomatis dari teks tombol: ${label(auto.type)}`}>
                <select value={cur?.type || ''} onChange={e => setCfg(c => ({ ...c, action: e.target.value ? { type: e.target.value, ...(e.target.value === 'navigate' ? { screenId: targets[0]?.id } : {}) } : undefined }))}>
                    <option value="">Otomatis ({label(auto.type)})</option>
                    {['none', 'navigate', 'submit', 'back'].map(t => <option key={t} value={t}>{label(t)}</option>)}
                </select>
            </Row>
            {eff.type === 'navigate' && (
                <Row label="Tujuan">
                    <select value={eff.screenId || ''} onChange={e => setCfg(c => ({ ...c, action: { type: 'navigate', screenId: e.target.value } }))}>
                        {targets.map(s => <option key={s.id} value={s.id}>{s.module.label} · {s.name} ({ROLE_LABEL[s.role]})</option>)}
                    </select>
                </Row>
            )}
            {eff.type === 'submit' && screen.role !== 'create' && screen.role !== 'edit' && <p className="cb-error">Simpan form hanya berlaku di screen Create/Edit.</p>}
        </>
    );
}

function TableEditor({ cfg, setCfg, entity }) {
    const model = tableModel(entity, cfg);
    const fields = entity?.fields || [];
    if (!fields.length) return <p className="cb-error">Module belum punya field entity — kolom tabel mengikuti field. Tambahkan di bagian Data module.</p>;
    const names = model.columns.map(c => c.key);
    const setCols = cols => setCfg(c => ({ ...c, table: { ...c.table, columns: cols } }));
    const move = (i, d) => { const n = [...names]; [n[i], n[i + d]] = [n[i + d], n[i]]; setCols(n); };
    return (
        <>
            <div className="cb-subhead">Kolom tabel</div>
            <ul className="cb-cols">
                {names.map((n, i) => (
                    <li key={n}>
                        <span>{fields.find(f => f.name === n)?.label || titleCase(n)}</span>
                        <button type="button" disabled={i === 0} aria-label="Naik" onClick={() => move(i, -1)}>↑</button>
                        <button type="button" disabled={i === names.length - 1} aria-label="Turun" onClick={() => move(i, 1)}>↓</button>
                        <button type="button" aria-label="Hapus kolom" onClick={() => setCols(names.filter(x => x !== n))}>×</button>
                    </li>
                ))}
            </ul>
            {fields.filter(f => !names.includes(f.name)).length > 0 && (
                <select value="" onChange={e => e.target.value && setCols([...names, e.target.value])}>
                    <option value="">＋ Tambah kolom…</option>
                    {fields.filter(f => !names.includes(f.name) && f.type !== 'password').map(f => <option key={f.name} value={f.name}>{f.label || titleCase(f.name)}</option>)}
                </select>
            )}
            <div className="cb-subhead">Aksi per baris</div>
            <div className="cb-checks">
                {ROW_ACTIONS.map(a => (
                    <Check key={a} checked={model.rowActions.includes(a)} onChange={on => setCfg(c => ({ ...c, table: { ...c.table, rowActions: ROW_ACTIONS.filter(x => (x === a ? on : model.rowActions.includes(x))) } }))}>{{ view: 'Lihat', edit: 'Ubah', delete: 'Hapus' }[a]}</Check>
                ))}
            </div>
            <Row label="Baris per halaman"><input type="number" min="1" max="200" value={model.pageSize} onChange={e => setCfg(c => ({ ...c, table: { ...c.table, pageSize: Number(e.target.value) || undefined } }))} /></Row>
        </>
    );
}

const DEFAULT_TYPE = { TextField: 'string', TextAreaField: 'text', PasswordField: 'password', SwitchField: 'boolean', SelectField: 'enum' };

/** Binding komponen form ke field entity + validasi + (untuk SelectField) sumber opsi. */
function FieldBinding({ node, cfg, setCfg, entity, modules, setFields }) {
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
    return (
        <>
            <Row label="Field data" hint="Field entity yang diisi komponen ini">
                <select value={cfg.field || ''} onChange={e => setCfg(c => ({ ...c, field: e.target.value || undefined }))}>
                    <option value="">{bound ? `Otomatis (${bound.name})` : 'Tidak terikat'}</option>
                    {fields.map(f => <option key={f.name} value={f.name}>{f.label || titleCase(f.name)} · {f.type}</option>)}
                </select>
            </Row>
            {!bound && <button type="button" className="wide-button" onClick={create}>＋ Buat field dari komponen ini</button>}
            {bound && node.exportName === 'SelectField' && (
                <>
                    <Row label="Sumber opsi">
                        <select value={bound.type === 'relation' ? 'relation' : 'enum'} onChange={e => edit(bound.name, e.target.value === 'relation' ? { ...bound, type: 'relation', options: undefined } : { ...bound, type: 'enum', relation: undefined, options: bound.options?.length ? bound.options : ['opsi1', 'opsi2'] })}>
                            <option value="enum">Pilihan tetap</option>
                            <option value="relation">Relasi ke module lain</option>
                        </select>
                    </Row>
                    {bound.type === 'relation'
                        ? <RelationPicker field={bound} modules={modules} onChange={next => edit(bound.name, next)} />
                        : <Row label="Pilihan"><input placeholder="aktif, nonaktif" value={(bound.options || []).join(', ')} onChange={e => edit(bound.name, { ...bound, options: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} /></Row>}
                </>
            )}
            {bound && <div className="cb-subhead">Validasi · {bound.label || titleCase(bound.name)}</div>}
            {bound && <FieldRules field={bound} onChange={next => edit(bound.name, next)} />}
        </>
    );
}

// ------------------------------------------------------------------ layout aplikasi

function SidebarInspector({ layout, lib, setLayout, modules }) {
    const iconNames = Array.isArray(lib?.iconNames) ? lib.iconNames : [];
    const items = layout.items;
    const patch = (moduleId, change) => setLayout(l => {
        const list = items.map(i => ({ moduleId: i.moduleId, label: i.label, icon: i.icon, hidden: i.hidden || undefined }));
        return { ...l, items: list.map(i => (i.moduleId === moduleId ? { ...i, ...change } : i)) };
    });
    const move = (idx, d) => setLayout(l => {
        const list = items.map(i => ({ moduleId: i.moduleId, label: i.label, icon: i.icon, hidden: i.hidden || undefined }));
        [list[idx], list[idx + d]] = [list[idx + d], list[idx]];
        return { ...l, items: list };
    });
    const defaultLabel = id => modules.find(m => m.id === id)?.label;
    return (
        <>
            <Section title="Sidebar">
                <Row label="Nama aplikasi"><input value={layout.appName} onChange={e => setLayout(l => ({ ...l, appName: e.target.value }))} /></Row>
            </Section>
            <Section title="Menu">
                <p className="small-label">Satu menu per module. Urutan di sini = urutan di sidebar.</p>
                {items.map((it, i) => (
                    <div key={it.moduleId} className={`cb-menu-item ${it.hidden ? 'off' : ''}`}>
                        <div className="cb-menu-top">
                            <input aria-label="Label menu" value={it.label} placeholder={defaultLabel(it.moduleId)} onChange={e => patch(it.moduleId, { label: e.target.value })} />
                            <button type="button" disabled={i === 0} aria-label="Naik" onClick={() => move(i, -1)}>↑</button>
                            <button type="button" disabled={i === items.length - 1} aria-label="Turun" onClick={() => move(i, 1)}>↓</button>
                        </div>
                        <div className="cb-menu-bottom">
                            {iconNames.length > 0
                                ? <select aria-label="Ikon" value={it.icon} onChange={e => patch(it.moduleId, { icon: e.target.value })}>{[...new Set([it.icon, ...iconNames])].map(n => <option key={n}>{n}</option>)}</select>
                                : <input aria-label="Ikon" value={it.icon} onChange={e => patch(it.moduleId, { icon: e.target.value })} />}
                            <Check checked={!it.hidden} onChange={on => patch(it.moduleId, { hidden: on ? undefined : true })}>Tampil</Check>
                            <code>{it.path}</code>
                        </div>
                    </div>
                ))}
                {!items.length && <p className="small-label">Belum ada module.</p>}
            </Section>
        </>
    );
}

function TopbarInspector({ layout, setLayout, title }) {
    return (
        <Section title="Topbar">
            <Row label="Judul" hint="Diambil dari nama menu aktif"><input value={title} disabled /></Row>
            <Row label="Nama pengguna"><input value={layout.userName} onChange={e => setLayout(l => ({ ...l, userName: e.target.value }))} /></Row>
            <Row label="Peran"><input value={layout.userRole} onChange={e => setLayout(l => ({ ...l, userRole: e.target.value }))} /></Row>
            <p className="small-label">Di aplikasi, nama & peran diambil dari sesi login; nilai ini hanya untuk pratinjau.</p>
        </Section>
    );
}

// ------------------------------------------------------------------ entity module

export function EntityEditor({ module: m, modules = [], onChange }) {
    const fields = m.entity?.fields || [];
    const [openIdx, setOpenIdx] = useState(null);
    const set = (i, patch) => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));
    return (
        <Section title="Data module" aside={<span className="cb-badge">{fields.length} field</span>}>
            <p className="small-label">Entity <b>{m.label}</b> — dipakai kolom tabel, form, types, dan data mock.</p>
            {fields.map((f, i) => (
                <div key={i} className={`cb-field-card ${openIdx === i ? 'open' : ''}`}>
                    <div className="cb-field-top">
                        <input aria-label="Nama field" className={/^[a-z][A-Za-z0-9]*$/.test(f.name) ? '' : 'invalid'} value={f.name} onChange={e => set(i, { name: e.target.value })} />
                        <select aria-label="Tipe" value={f.type} onChange={e => set(i, { type: e.target.value })}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
                        <button type="button" aria-label="Opsi field" onClick={() => setOpenIdx(openIdx === i ? null : i)}>⋯</button>
                        <button type="button" aria-label="Hapus field" onClick={() => onChange(fields.filter((_, j) => j !== i))}>×</button>
                    </div>
                    {openIdx === i && (
                        <div className="cb-field-more">
                            <Row label="Label"><input placeholder={titleCase(f.name)} value={f.label || ''} onChange={e => set(i, { label: e.target.value || undefined })} /></Row>
                            <div className="cb-checks">
                                {[['sortable', 'Sortir'], ['filterable', 'Filter']].map(([k, l]) => <Check key={k} checked={f[k]} onChange={on => set(i, { [k]: on })}>{l}</Check>)}
                            </div>
                            <div className="cb-subhead">Validasi</div>
                            <FieldRules field={f} onChange={next => onChange(fields.map((x, j) => (j === i ? next : x)))} />
                            {f.type === 'enum' && <Row label="Pilihan"><input placeholder="aktif, nonaktif" value={(f.options || []).join(', ')} onChange={e => set(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></Row>}
                            {f.type === 'relation' && <RelationPicker field={f} modules={modules} onChange={next => onChange(fields.map((x, j) => (j === i ? next : x)))} />}
                        </div>
                    )}
                </div>
            ))}
            <button type="button" className="wide-button" onClick={() => { onChange([...fields, { name: `field${fields.length + 1}`, type: 'string', required: false, sortable: false, filterable: false }]); setOpenIdx(fields.length); }}>＋ Tambah field</button>
        </Section>
    );
}

// ------------------------------------------------------------------ Inspector

export function Inspector({ selected, tree, node, screen, module, screens, entity, layout, lib, modules, title, actions }) {
    const cfg = node?.cfg || {};
    const setCfg = fn => actions.setNode(selected, fn);
    if (selected === '__sidebar') return <div className="cb-insp"><Header kind="Layout" name="Sidebar" /><SidebarInspector layout={layout} lib={lib} modules={modules} setLayout={actions.setLayout} /></div>;
    if (selected === '__topbar') return <div className="cb-insp"><Header kind="Layout" name="Topbar" /><TopbarInspector layout={layout} setLayout={actions.setLayout} title={title} /></div>;
    if (!node) {
        return (
            <div className="cb-insp">
                <Header kind={ROLE_LABEL[screen.role]} name={screen.name} />
                <Section title="Cara pakai"><p className="small-label">Klik komponen di pratinjau untuk mengatur propertinya. Klik sidebar atau topbar untuk mengatur layout aplikasi. Perubahan tersimpan otomatis dan ikut ke kode yang di-generate.</p></Section>
                <EntityEditor module={module} modules={modules} onChange={actions.setFields} />
            </div>
        );
    }
    const behavior = node.kind === 'component' ? behaviorOf(node.exportName) : null;
    return (
        <div className="cb-insp">
            <Header kind={node.kind === 'component' ? node.exportName : node.kind === 'text' ? 'Teks' : node.kind === 'box' ? 'Frame' : 'Tidak didukung'} name={node.name} onReveal={() => actions.reveal(selected)} />
            {node.kind === 'component' && <Section title="Properti"><ComponentProps node={node} cfg={cfg} setCfg={setCfg} /></Section>}
            {node.kind === 'text' && (
                <Section title="Isi teks">
                    <textarea rows={3} value={node.text} onChange={e => setCfg(c => ({ ...c, text: e.target.value === node.designText ? undefined : e.target.value }))} />
                    {cfg.text !== undefined && <button type="button" className="cb-link" onClick={() => setCfg(c => ({ ...c, text: undefined }))}>↺ Kembalikan teks desain</button>}
                </Section>
            )}
            {behavior === 'action' && <Section title="Perilaku"><ActionEditor node={node} cfg={cfg} setCfg={setCfg} screen={screen} module={module} screens={screens} /></Section>}
            {behavior === 'table' && <Section title="Data tabel"><TableEditor cfg={cfg} setCfg={setCfg} entity={entity} /></Section>}
            {behavior === 'field' && <Section title="Data"><FieldBinding node={node} cfg={cfg} setCfg={setCfg} entity={entity} modules={modules} setFields={actions.setFields} /></Section>}
            {behavior === 'filter' && <Section title="Data"><p className="small-label">Kotak cari memfilter tabel pada screen list.</p></Section>}
            {node.kind === 'unsupported' && <Section title="Tidak didukung"><p className="cb-error">{node.reason}</p></Section>}
            {node !== tree && <Section title="Tampilan"><Check checked={cfg.hidden} onChange={on => setCfg(c => ({ ...c, hidden: on || undefined }))}>Sembunyikan di aplikasi</Check></Section>}
        </div>
    );
}

function Header({ kind, name, onReveal }) {
    return (
        <div className="cb-insp-head">
            <span className="cb-badge">{kind}</span>
            <b title={name}>{name}</b>
            {onReveal && <button type="button" className="cb-link" onClick={onReveal} title="Tampilkan layer ini di canvas">◎</button>}
        </div>
    );
}
