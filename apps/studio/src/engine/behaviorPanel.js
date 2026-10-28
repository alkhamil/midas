// Behavior tab (stage 5). Draws the panel from the models in @midas/builder-core (masterPanel, instancePanel): the rows come from
// the template schema, the bindings and the instance store. Holds no component-specific logic. Edits are read back by the
// caller from the data-bp attributes written here. Markup uses the Design panel's classes (section-heading, cmp-props,
// cmp-prop2, cmp-ctl, cmp-input, vsw, empty-state, small-label, badge), so both tabs look the same.

/** The props that drive the managed icon slots. They are grouped under Slots. The icon picker is deferred, so `icon` has no row. */
const SLOT_PROPS = new Set(['hasIcon', 'iconPlacement']);

/** Markup for a master, an instance, or a node that has no behavior. `esc` escapes text for HTML. */
export function behaviorPanelHtml({ kind, panel, esc }) {
    if (kind === 'none') return empty('Select a component or one of its instances to set its behavior.');
    if (kind === 'master') return masterHtml(panel, esc);
    return instanceHtml(panel, esc);
}

/** A Design section: the section header, then rows in the Design grid. */
function section(title, rows, esc) {
    return `<section class="inspector-section"><div class="section-heading"><span>${esc(title)}</span></div><div class="cmp-props">${rows}</div></section>`;
}

/** A section with rows, or nothing when there are none. */
function block(title, rows, esc) {
    return rows ? section(title, rows, esc) : '';
}

/** A label beside its control, as the Design panel's instance props. `title` is the full name when the label is shortened. */
function row(label, control, esc, title = label) {
    return `<div class="cmp-prop2"><span title="${esc(title)}">${esc(label)}</span><div class="cmp-ctl">${control}</div></div>`;
}

/** A prop name as a label: `hasIcon` -> `Has icon`. */
const labelOf = name => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());

/** The Design panel's empty state. `html` is already escaped where it holds a name. */
function empty(html) {
    return `<div class="empty-state">${html}</div>`;
}

/** A small line under a row. */
function note(text, esc) {
    return `<div class="small-label">${esc(text)}</div>`;
}

function masterHtml(panel, esc) {
    const templateRow = row('Template', `<select data-bp="template" aria-label="Template">
        <option value="">None</option>${panel.templates.map(t => `<option value="${esc(t.id)}" ${t.id === panel.templateId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select>`, esc);
    if (!panel.templateId) return section('Template and binding', templateRow + empty('Choose a template to bind this component.'), esc);
    const collections = panel.rows.map(r => {
        const badge = r.collectionId === null ? '' : `<span class="badge">${r.matched ? 'Auto-matched' : 'Picked manually'}</span>`;
        const control = `<select data-bp="collection" data-bp-prop="${esc(r.prop)}" aria-label="${esc(r.prop)} collection">
            <option value="">None</option>${r.options.map(o => `<option value="${esc(o.id)}" ${o.id === r.collectionId ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
        </select>${badge}`;
        const unmatched = r.collectionId === null ? empty(`No "${esc(r.collection)}" collection matched. Pick one.`) : '';
        return row(r.collection, control, esc, r.prop) + unmatched;
    }).join('');
    const contract = [
        ...panel.contract.props.map(p => row(labelOf(p.name), `<span class="small-label">${esc(p.type)} · default ${esc(String(p.default))}</span>`, esc, p.name)),
        row('States', `<span class="small-label">${panel.contract.states.map(s => esc(s)).join(', ')}</span>`, esc),
        row('Events', `<span class="small-label">${panel.contract.events.map(e => esc(e.name) + (e.exposeAsTrigger ? ' (trigger)' : '')).join(', ')}</span>`, esc),
    ].join('');
    return section('Template and binding', templateRow, esc) + block('Collections', collections, esc) + section('Contract (read-only)', contract, esc);
}

function instanceHtml(panel, esc) {
    if (!panel.templateId) return empty('This component has no template. Bind the main component first.');
    const variable = panel.rows.filter(r => r.kind === 'variable').map(r => {
        const name = esc(r.prop);
        const control = `<select data-bp="value" data-bp-kind="variable" data-bp-prop="${name}" aria-label="${name}" ${r.disabled ? 'disabled' : ''}>
                <option value="">None</option>${r.options.map(o => `<option value="${esc(o.id)}" ${o.id === r.value ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
            </select>`;
        return row(r.label, control, esc, r.prop) + (r.hint ? note(r.hint, esc) : '');
    }).join('');
    const literal = panel.rows.filter(r => r.kind === 'literal');
    const props = literal.filter(r => !SLOT_PROPS.has(r.prop)).map(r => literalRow(r, esc)).join('');
    const slots = literal.filter(r => SLOT_PROPS.has(r.prop)).map(r => literalRow(r, esc)).join('');
    return block('Collections', variable, esc) + block('Props', props, esc) + block('Slots', slots, esc);
}

/** A row for a literal prop. Only the types the schema knows get a control; anything else gets none (no stubs). */
function literalRow(r, esc) {
    const name = esc(r.prop), label = labelOf(r.prop);
    if (r.type === 'boolean')
        return row(label, `<label class="vsw"><input type="checkbox" role="switch" data-bp="value" data-bp-kind="literal" data-bp-type="boolean" data-bp-prop="${name}" aria-label="${name}" ${r.value ? 'checked' : ''}></label><span class="vsw-spacer"></span>`, esc, r.prop);
    if (r.type === 'enum')
        return row(label, `<select data-bp="value" data-bp-kind="literal" data-bp-type="enum" data-bp-prop="${name}" aria-label="${name}">
                ${r.options.map(o => `<option value="${esc(o.id)}" ${o.id === r.value ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
            </select>`, esc, r.prop);
    if (r.type === 'string')
        return row(label, `<input class="cmp-input" type="text" data-bp="value" data-bp-kind="literal" data-bp-type="string" data-bp-prop="${name}" value="${esc(r.value)}">`, esc, r.prop);
    return '';
}
