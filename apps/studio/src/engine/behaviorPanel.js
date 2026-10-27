// Behavior tab (stage 5). Draws the panel from the models in @midas/builder-core (masterPanel, instancePanel): the rows come from
// the template schema, the bindings and the instance store. Holds no component-specific logic. Edits are read back by the
// caller from the data-bp attributes written here.

/** Markup for a master, an instance, or a node that has no behavior. `esc` escapes text for HTML. */
export function behaviorPanelHtml({ kind, panel, esc }) {
    if (kind === 'none') return section('Behavior', '<p class="bp-note">Select a component or one of its instances to set its behavior.</p>', esc);
    if (kind === 'master') return masterHtml(panel, esc);
    return instanceHtml(panel, esc);
}

function section(title, body, esc) {
    return `<section class="inspector-section bp"><div class="section-heading"><span>${esc(title)}</span></div>${body}</section>`;
}

function masterHtml(panel, esc) {
    const template = `<label class="field full-width"><span>Template</span><select data-bp="template" aria-label="Template">
        <option value="">None</option>${panel.templates.map(t => `<option value="${esc(t.id)}" ${t.id === panel.templateId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select></label>`;
    if (!panel.templateId) return section('Behavior', template + '<p class="bp-note">Choose a template to bind this component.</p>', esc);
    const rows = panel.rows.map(row => {
        const note = row.collectionId === null ? `No "${esc(row.collection)}" collection matched. Pick one.`
            : row.matched ? 'Auto-matched' : 'Picked manually';
        return `<label class="field full-width"><span>${esc(row.prop)}</span><select data-bp="collection" data-bp-prop="${esc(row.prop)}" aria-label="${esc(row.prop)} collection">
            <option value="">— not bound —</option>${row.options.map(o => `<option value="${esc(o.id)}" ${o.id === row.collectionId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
        </select><small class="bp-note">${note}</small></label>`;
    }).join('');
    const contract = `<div class="bp-contract"><div class="bp-note">Contract (read-only)</div>
        <ul>${panel.contract.props.map(p => `<li>${esc(p.name)} · ${esc(p.type)} · default ${esc(String(p.default))}</li>`).join('')}</ul>
        <div class="bp-note">States: ${panel.contract.states.map(s => esc(s)).join(', ')}</div>
        <div class="bp-note">Events: ${panel.contract.events.map(e => esc(e.name) + (e.exposeAsTrigger ? ' (trigger)' : '')).join(', ')}</div>
    </div>`;
    return section('Behavior', template + rows + contract, esc);
}

function instanceHtml(panel, esc) {
    if (!panel.templateId) return section('Behavior', '<p class="bp-note">This component has no template. Bind the main component first.</p>', esc);
    const rows = panel.rows.map(row => {
        const name = esc(row.prop);
        if (row.kind === 'variable') {
            return `<label class="field full-width"><span>${esc(row.label)}</span><select data-bp="value" data-bp-kind="variable" data-bp-prop="${name}" aria-label="${name}" ${row.disabled ? 'disabled' : ''}>
                <option value="">— none —</option>${row.options.map(o => `<option value="${esc(o.id)}" ${o.id === row.value ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
            </select>${row.hint ? `<small class="bp-note">${esc(row.hint)}</small>` : ''}</label>`;
        }
        if (row.type === 'boolean') {
            return `<label class="field"><span>${name}</span><input type="checkbox" data-bp="value" data-bp-kind="literal" data-bp-type="boolean" data-bp-prop="${name}" ${row.value ? 'checked' : ''}></label>`;
        }
        if (row.type === 'enum') {
            return `<label class="field full-width"><span>${name}</span><select data-bp="value" data-bp-kind="literal" data-bp-type="enum" data-bp-prop="${name}" aria-label="${name}">
                ${row.options.map(o => `<option value="${esc(o.id)}" ${o.id === row.value ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
            </select></label>`;
        }
        // Only the types the schema knows get a control; anything else gets none (no stubs).
        if (row.type !== 'string') return '';
        return `<label class="field full-width"><span>${name}</span><input type="text" data-bp="value" data-bp-kind="literal" data-bp-type="string" data-bp-prop="${name}" value="${esc(row.value)}"></label>`;
    }).join('');
    return section('Behavior', rows, esc);
}
