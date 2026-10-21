// Tab Behavior Code Builder: state mapping (nilai state dibaca dari variable collection), interaction
// (trigger + action), dan perilaku input field. Modelnya sama dengan tab Behavior di inspector desain
// (@midas/builder-core), supaya Design, Preview, dan kode hasil generate memakai satu bahasa.
import { useState } from 'react';
import { Select } from './Select.jsx';
import { normalizeInputBehavior, normalizeInteractions, normalizeStateMapping, STATE_LABEL, STATE_PROPS, statesFor, TYPE_LABEL, componentTypeOf } from '@midas/builder-core';

/** Tipe komponen dari namanya (Code Builder memakai nama export komponen). */
function typeOf(node) {
    return componentTypeOf(node.exportName || node.name || '');
}

function Row({ label, hint, children }) {
    return (
        <label className="cb-prop">
            <span className="cb-prop-label" title={hint}>{label}</span>
            <span className="cb-prop-control">{children}</span>
        </label>
    );
}

function Section({ title, children, aside }) {
    return <section className="cb-insp-section"><header><b>{title}</b>{aside}</header>{children}</section>;
}

/** Pemilih nilai gaya: variable (collection + variable) atau nilai manual. */
function StyleValue({ label, value, collections, items, onChange }) {
    const collId = value?.collectionId || '', varId = value?.variableId || '', manual = value?.value ?? '';
    const list = collId ? items.filter(i => i.collectionId === collId) : [];
    return (
        <div className="cb-prop cb-bh-value">
            {label && <span className="cb-prop-label">{label}</span>}
            <span className="cb-prop-control">
                <Select
                    aria-label="Collection"
                    value={collId}
                    onChange={e => onChange(e.target.value ? { collectionId: e.target.value, variableId: undefined, value: undefined } : { collectionId: undefined, variableId: undefined, value: manual })}
                >
                    <option value="">Manual value</option>
                    {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                {collId
                    ? (
                        <Select aria-label="Variable" value={varId} onChange={e => onChange({ collectionId: collId, variableId: e.target.value || undefined })}>
                            <option value="">— choose a variable —</option>
                            {list.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </Select>
                    )
                    : <input placeholder="#4338CA or 12" value={manual} onChange={e => onChange({ value: e.target.value || undefined })} />}
            </span>
        </div>
    );
}

/** Baris state mapping: state → properti → (collection + variable | nilai manual). */
function StateRows({ cfg, setCfg, vars, collections, type }) {
    const mapping = normalizeStateMapping(cfg.stateMapping);
    const items = [...vars.values()];
    const states = statesFor(type);
    const setRow = (state, prop, next) => setCfg(c => {
        const m = normalizeStateMapping(c.stateMapping);
        const row = { ...(m[state] || {}) };
        const cur = row[prop];
        if (next === null) delete row[prop];
        else row[prop] = { ...(cur || {}), ...next };
        m[state] = row;
        return { ...c, stateMapping: m };
    });
    const rename = (state, from, to) => setCfg(c => {
        const m = normalizeStateMapping(c.stateMapping);
        const row = { ...(m[state] || {}) };
        const val = from ? row[from] : undefined;
        if (from) delete row[from];
        if (to) row[to] = val || {};
        m[state] = row;
        return { ...c, stateMapping: m };
    });
    return states.map(state => {
        const props = Object.keys(mapping[state] || {});
        const prop = props[0] || 'fill';
        const value = mapping[state]?.[prop] || null;
        const unused = STATE_PROPS.map(p => p.id).filter(p => p !== prop);
        return (
            <div key={state} className="cb-bh-state">
                <div className="cb-bh-state-head"><b>{STATE_LABEL[state] || state}</b>
                    {props.length > 0 && <button type="button" className="cb-link" onClick={() => setRow(state, prop, null)}>Remove</button>}
                </div>
                <Row label="Property">
                    <Select aria-label="Property" value={prop} onChange={e => rename(state, prop, e.target.value)}>
                        {STATE_PROPS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </Select>
                </Row>
                <StyleValue
                    collections={collections}
                    items={items}
                    value={value}
                    onChange={next => setRow(state, prop, next)}
                />
                {unused.length > 0 && (
                    <Row label="Add property">
                        <Select aria-label="Add property" value="" onChange={e => e.target.value && rename(state, prop, e.target.value)}>
                            <option value="">—</option>
                            {unused.map(p => <option key={p} value={p}>{STATE_PROPS.find(x => x.id === p).label}</option>)}
                        </Select>
                    </Row>
                )}
            </div>
        );
    });
}

/** Interaction: trigger + action + target layar. */
function InteractionRows({ cfg, setCfg, screens }) {
    const list = normalizeInteractions(cfg.interactions);
    const [adding, setAdding] = useState(false);
    const patch = (i, change) => setCfg(c => {
        const items = normalizeInteractions(c.interactions);
        items[i] = { ...items[i], ...change };
        return { ...c, interactions: items };
    });
    const patchAction = (i, change) => setCfg(c => {
        const items = normalizeInteractions(c.interactions);
        items[i] = { ...items[i], action: { ...items[i].action, ...change } };
        return { ...c, interactions: items };
    });
    const remove = i => setCfg(c => ({ ...c, interactions: normalizeInteractions(c.interactions).filter((_, k) => k !== i) }));
    const add = type => setCfg(c => ({ ...c, interactions: [...normalizeInteractions(c.interactions), { id: `i${Date.now().toString(36)}`, trigger: 'onClick', action: { type } }] }));
    const triggers = [['onClick', 'On click'], ['onHover', 'On hover'], ['onFocus', 'On focus'], ['onBlur', 'On blur'], ['onChange', 'On change'], ['onSubmit', 'On submit']];
    const actions = [['navigate', 'Navigate to screen'], ['submit', 'Submit form'], ['back', 'Go back'], ['open-dialog', 'Open dialog']];
    return (
        <>
            {list.map((it, i) => (
                <div key={it.id} className="cb-bh-state">
                    <div className="cb-bh-state-head"><b>Interaction {i + 1}</b><button type="button" className="cb-link" onClick={() => remove(i)}>Delete</button></div>
                    <Row label="When">
                        <Select aria-label="Trigger" value={it.trigger} onChange={e => patch(i, { trigger: e.target.value })}>
                            {triggers.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                    </Row>
                    <Row label="Do">
                        <Select aria-label="Action" value={it.action.type} onChange={e => patchAction(i, { type: e.target.value })}>
                            {actions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                    </Row>
                    {it.action.type === 'navigate' && (
                        <Row label="Go to screen">
                            <Select aria-label="Target screen" value={it.action.targetFrameId || ''} onChange={e => patchAction(i, { targetFrameId: e.target.value || undefined })}>
                                <option value="">— none —</option>
                                {screens.map(s => <option key={s.id} value={s.id}>{s.module.label} · {s.name}</option>)}
                            </Select>
                        </Row>
                    )}
                    {it.action.type === 'open-dialog' && (
                        <Row label="Dialog screen">
                            <Select aria-label="Dialog screen" value={it.action.targetFrameId || ''} onChange={e => patchAction(i, { targetFrameId: e.target.value || undefined })}>
                                <option value="">— none —</option>
                                {screens.filter(s => s.role === 'dialog').map(s => <option key={s.id} value={s.id}>{s.module.label} · {s.name}</option>)}
                            </Select>
                        </Row>
                    )}
                </div>
            ))}
            {!list.length && <p className="small-label">No interaction yet. Add one so this component reacts.</p>}
            {adding
                ? (
                    <div className="cb-bh-add">
                        <Select aria-label="Action to add" value="" onChange={e => { if (e.target.value) { add(e.target.value); setAdding(false); } }}>
                            <option value="">Choose an action…</option>
                            {actions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </Select>
                        <button type="button" className="cb-link" onClick={() => setAdding(false)}>Cancel</button>
                    </div>
                )
                : <button type="button" className="wide-button" onClick={() => setAdding(true)}>＋ Add interaction</button>}
        </>
    );
}

/** Input field: label, area typeable, error. */
function InputBehaviorRows({ cfg, setCfg, layers }) {
    const ib = normalizeInputBehavior(cfg.inputBehavior) || { label: { exists: true }, typeable: {}, error: {}, validation: {} };
    const texts = layers.filter(l => l.kind === 'text');
    const set = change => setCfg(c => ({ ...c, inputBehavior: normalizeInputBehavior({ ...normalizeInputBehavior(c.inputBehavior), ...change }) }));
    const setLabel = change => set({ label: { ...ib.label, ...change } });
    const setTypeable = change => set({ typeable: { ...ib.typeable, ...change } });
    const setError = change => set({ error: { ...ib.error, ...change } });
    const setValidation = change => set({ validation: { ...ib.validation, ...change } });
    return (
        <>
            <Section title="Label">
                <p className="small-label">An input is often a group: label text, input box, hint text. Say which part is which.</p>
                <Row label="Has a label">
                    <Select aria-label="Has a label" value={ib.label.exists === false ? 'false' : 'true'} onChange={e => setLabel({ exists: e.target.value === 'true' })}>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                    </Select>
                </Row>
                {ib.label.exists !== false && (
                    <Row label="Label layer">
                        <Select aria-label="Label layer" value={ib.label.reference?.layerId || ''} onChange={e => setLabel({ reference: { type: 'layer', layerId: e.target.value || undefined } })}>
                            <option value="">— none —</option>
                            {texts.map(l => <option key={l.nodeId} value={l.nodeId}>{l.name}</option>)}
                        </Select>
                    </Row>
                )}
            </Section>
            <Section title="Typeable area">
                <p className="small-label">Which layer receives the typing? The rest stays read-only.</p>
                <Row label="Typeable layer">
                    <Select aria-label="Typeable layer" value={ib.typeable.frameId || ''} onChange={e => setTypeable({ frameId: e.target.value || undefined })}>
                        <option value="">— none —</option>
                        {texts.map(l => <option key={l.nodeId} value={l.nodeId}>{l.name}</option>)}
                    </Select>
                </Row>
                <label className="cb-check">
                    <input type="checkbox" checked={!!ib.validation.required} onChange={e => setValidation({ required: e.target.checked })} /> Required
                </label>
            </Section>
            <Section title="Error handling">
                <Row label="Error frame">
                    <Select aria-label="Error frame" value={ib.error.frameId || ''} onChange={e => setError({ frameId: e.target.value || undefined })}>
                        <option value="">— none —</option>
                        {layers.map(l => <option key={l.nodeId} value={l.nodeId}>{l.name}</option>)}
                    </Select>
                </Row>
                <Row label="Hint text">
                    <input placeholder="This field is required" value={ib.error.hintText || ''} onChange={e => setError({ hintText: e.target.value || undefined })} />
                </Row>
            </Section>
        </>
    );
}

/** Tab Behavior Code Builder untuk sebuah node yang dipilih. */
export function BehaviorPanel({ node, cfg, setCfg, vars, collections, screens, extra }) {
    if (!node || node.kind !== 'component') return null;
    const type = typeOf(node);
    const layers = node.children || [];
    return (
        <>
            <Section title="Component">
                <p className="small-label"><b>{node.exportName}</b> · {TYPE_LABEL[type] || type}</p>
            </Section>
            <Section title="State mapping">
                <p className="small-label">Where do the states get their values? Every state reads from a variable collection, or from a manual value.</p>
                <StateRows cfg={cfg} setCfg={setCfg} vars={vars} collections={collections} type={type} />
            </Section>
            {type === 'input' && <InputBehaviorRows cfg={cfg} setCfg={setCfg} layers={layers} />}
            <Section title="Interaction">
                <InteractionRows cfg={cfg} setCfg={setCfg} screens={screens} />
                {extra}
            </Section>
        </>
    );
}
