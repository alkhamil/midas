// Behavior tab (stage 5). Draws the panel from the models in @midas/builder-core (masterPanel, instancePanel): the rows come from
// the template schema, the bindings and the instance store. Holds no component-specific logic. Edits are read back by the
// caller from the data-bp attributes written here. Markup uses the Design panel's classes (section-heading, cmp-props,
// cmp-prop2, cmp-ctl, cmp-input, vsw, empty-state, small-label, badge), so both tabs look the same.

/** The preview-only states the instance can be shown in, as [state, label]. Preview only; it never changes the document.
 * Disabled is a persistent state (a prop), so it is not listed here: it is shown on the canvas and wins over these. */
export const PREVIEW_STATES = [['default', 'Default'], ['hover', 'Hover'], ['active', 'Active'], ['focus', 'Focus']];

/** The label of a state the preview shows: a preview-only state from PREVIEW_STATES, or a persistent one (disabled) by its name. */
const labelOfState = state => PREVIEW_STATES.find(([id]) => id === state)?.[1] ?? state.replace(/^./, c => c.toUpperCase());

/**
 * Markup for a master, an instance, or a node that has no behavior. `esc` escapes text for HTML.
 * `findings` are the diagnostics of the node, or null while pages are still loading. `preview` (instance) is the resolved
 * preview with the tokens its state overrides. `code` (bound master) is the generator's problems, if any.
 */
export function behaviorPanelHtml({ kind, panel, esc, findings = [], preview, code, autoFix = null }) {
    if (kind === 'none') return empty('Select a component or one of its instances to set its behavior.');
    if (kind === 'master') return masterHtml(panel, esc, findings, code, autoFix);
    return instanceHtml(panel, esc, findings, preview);
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

function masterHtml(panel, esc, findings, code, autoFix = null) {
    const templateRow = row('Template', `<select data-bp="template" aria-label="Template">
        <option value="">None</option>${panel.templates.map(t => `<option value="${esc(t.id)}" ${t.id === panel.templateId ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
    </select>`, esc);
    if (!panel.templateId) return section('Template and binding', templateRow + empty('Choose a template to bind this component.'), esc);
    // The collections the icon slots need, first: the same binding slots as the dimensions, so picking one picks the other.
    const needs = (panel.needs ?? []).map(r => {
        const badge = r.collectionId === null ? '' : `<span class="badge">${r.matched ? 'Auto-matched' : 'Picked manually'}</span>`;
        const control = `<select data-bp="collection" data-bp-prop="${esc(r.dimension)}" aria-label="${esc(r.dimension)} collection">
            <option value="">None</option>${r.options.map(o => `<option value="${esc(o.id)}" ${o.id === r.collectionId ? 'selected' : ''}` + `>${esc(o.name)}</option>`).join('')}
        </select>${badge}`;
        const unmatched = r.collectionId === null ? empty(`No "${r.collection}" collection matched. Pick one.`) : '';
        return row(r.label, control, esc, r.dimension) + unmatched;
    }).join('');
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
        row('Persistent states', `<span class="small-label">${panel.contract.persistentStates.map(s => esc(s)).join(', ') || 'None'}</span>`, esc),
        row('Preview states', `<span class="small-label">${panel.contract.previewStates.map(s => esc(s)).join(', ') || 'None'}</span>`, esc),
        row('Events', `<span class="small-label">${panel.contract.events.map(e => esc(e.name) + (e.exposeAsTrigger ? ' (trigger)' : '')).join(', ')}</span>`, esc),
    ].join('');
    const generate = `<button class="wide-button full-width" data-bp-action="generate" ${code?.problems.length ? 'disabled' : ''}>Generate code</button>`;
    return section('Template and binding', templateRow, esc)
        + block('Collections', needs + collections + bindTokensRow(findings, esc), esc)
        + section('Contract (read-only)', contract, esc)
        + section('Code', generate, esc)
        + diagnosticsSection(findings, code?.problems ?? [], esc, null, autoFix);
}

function instanceHtml(panel, esc, findings, preview) {
    if (!panel.templateId) return empty('This component has no template. Bind the main component first.');
    const variable = panel.rows.filter(r => r.kind === 'variable').map(r => {
        const name = esc(r.prop);
        const control = `<select data-bp="value" data-bp-kind="variable" data-bp-prop="${name}" aria-label="${name}" ${r.disabled ? 'disabled' : ''}>
                <option value="">None</option>${r.options.map(o => `<option value="${esc(o.id)}" ${o.id === r.value ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
            </select>`;
        return row(r.label, control, esc, r.prop) + (r.hint ? note(r.hint, esc) : '');
    }).join('');
    const literal = panel.rows.filter(r => r.kind === 'literal' || r.kind === 'icon');
    const props = literal.filter(r => !r.slot).map(r => literalRow(r, esc)).join('');
    const slots = literal.filter(r => r.slot).map(r => literalRow(r, esc)).join('');
    const state = preview ? `<select data-bp="preview" aria-label="Preview state">${PREVIEW_STATES.map(([id, label]) => `<option value="${id}" ${id === preview.state ? 'selected' : ''}>${label}</option>`).join('')}</select>` : '';
    return block('Collections', variable, esc)
        + block('Props', props, esc)
        + block('Slots', slots, esc)
        + (preview ? section('Preview', row('State', state, esc) + (preview.state === 'default' ? '' : `<div class="badge">Previewing: ${esc(labelOfState(preview.state))}</div>`), esc) : '')
        + diagnosticsSection(findings, [], esc, preview);
}

/**
 * The Diagnostics section: the node's findings, the generator's reasons (master), and the missing state tokens of the
 * previewed state (instance). Null findings means pages are still loading; nothing is reported then.
 */
/** The Auto Fix button: shown only while at least one fixable diagnostic exists. */
function autoFixRow(autoFix, esc) {
    if (!autoFix || !autoFix.fixable) return '';
    return `<button class="wide-button full-width" data-bp-action="auto-fix">Auto Fix (${esc(String(autoFix.count))})</button>`;
}

function diagnosticsSection(findings, problems, esc, preview = null, autoFix = null) {
    if (findings === null) return section('Diagnostics', empty('Diagnostics appear when all pages are loaded.'), esc);
    const all = [...findings, ...codeFindings(problems), ...(preview ? stateFindings(preview.unresolved, preview.stateTokens) : [])];
    const rows = all.length ? findingRows(all, esc) + autoFixRow(autoFix, esc) : empty('No issues');
    return section('Diagnostics', rows, esc);
}

/** The Bind tokens action: enabled while a master layer has a mapped property that is not bound to its token (unbound-token). */
function bindTokensRow(findings, esc) {
    const unbound = (findings ?? []).filter(f => f.code === 'unbound-token').length;
    const label = unbound ? `Bind tokens (${unbound} unbound)` : 'Bind tokens (all bound)';
    return `<button class="wide-button full-width" data-bp-action="bind-tokens" ${unbound ? '' : 'disabled'}>${esc(label)}</button>`;
}

/** A row for a literal prop. Only the types the schema knows get a control; anything else gets none (no stubs).
 * A prop whose collections are missing on the master is disabled, with the message naming them. */
function literalRow(r, esc) {
    const name = esc(r.prop), label = r.label ?? labelOf(r.prop);
    const hint = r.hint ? `<div class="small-label">${esc(r.hint)}</div>` : '';
    if (r.kind === 'icon')
        return row(label, `<button class="cmp-input" data-bp-action="icon" data-bp-prop="${name}" data-bp-value="${esc(r.value ?? '')}" aria-label="${name}">${r.name ? esc(r.name) : 'Choose icon'}</button>`, esc, r.prop);
    if (r.type === 'boolean')
        return row(label, `<label class="vsw"><input type="checkbox" role="switch" data-bp="value" data-bp-kind="literal" data-bp-type="boolean" data-bp-prop="${name}" aria-label="${name}" ${r.value ? 'checked' : ''}${r.disabled ? ' disabled' : ''}></label><span class="vsw-spacer"></span>`, esc, r.prop) + hint;
    if (r.type === 'enum')
        return row(label, `<select data-bp="value" data-bp-kind="literal" data-bp-type="enum" data-bp-prop="${name}" aria-label="${name}"${r.disabled ? ' disabled' : ''}>
                ${r.options.map(o => `<option value="${esc(o.id)}" ${o.id === r.value ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
            </select>`, esc, r.prop) + hint;
    if (r.type === 'string')
        return row(label, `<input class="cmp-input" type="text" data-bp="value" data-bp-kind="literal" data-bp-type="string" data-bp-prop="${name}" value="${esc(r.value)}"${r.disabled ? ' disabled' : ''}>`, esc, r.prop) + hint;
    return '';
}

/** One row per finding: its severity badge, then its one-line message (the only part that may wrap). */
export function findingRows(findings, esc) {
    return findings.map(f => `<div class="cmp-prop2"><span><span class="badge">${f.severity === 'error' ? 'Error' : f.severity === 'info' ? 'Note' : 'Warning'}</span></span><div class="cmp-ctl"><span class="small-label">${esc(f.message)}</span></div></div>`).join('');
}

/** The generator's reasons as error findings, one per refused token, naming the modes it was refused in. */
export function codeFindings(problems) {
    return problems.map(p => {
        const label = p.token ?? p.slot ?? p.event ?? p.dimension ?? 'component';
        const at = [p.variant && `variant ${p.variant}`, p.size && `size ${p.size}`].filter(Boolean).join(', ');
        return { severity: 'error', message: `Code: ${label}${at ? ` in ${at}` : ''} (${p.reason}).` };
    });
}

/** The state tokens of the previewed state that do not resolve, as error findings. Other unresolved tokens are reported elsewhere. */
export function stateFindings(unresolved, stateTokens) {
    return unresolved.filter(u => stateTokens.includes(u.token)).map(u => ({ severity: 'error', message: `Preview: token "${u.token}" is missing (${u.reason}).` }));
}

/** The files a generated component downloads as, in order. Nothing when the generator refused. */
export function codeDownloads(result) {
    return result.files ? Object.entries(result.files).map(([name, text]) => ({ name, text })) : [];
}

