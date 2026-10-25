// The Data window of a List State: a spreadsheet-like grid for its columns (name, type, header, options) and sample rows, with import
// (CSV / JSON), generated rows and CSV export. Only draws; the rules (inference, generation, column edits) are in builder-core
// (collection.js, columns.js).
import { columnLabel, schemaOf } from './behavior.js';

export const COLUMN_TYPES = [['string', 'Text'], ['number', 'Number'], ['boolean', 'Yes / no'], ['option', 'Option'], ['date', 'Date']];
const typeOf = f => COLUMN_TYPES.some(t => t[0] === f.type) ? f.type : 'string';

/** One cell editor by the type of its column. */
function cell(esc, f, v, i) {
    const a = `data-dw-cell="${i}|${esc(f.key)}" aria-label="${esc(columnLabel(f))}, row ${i + 1}"`;
    switch (f.type) {
        case 'boolean': return `<input type="checkbox" ${a} ${v ? 'checked' : ''}>`;
        case 'number': return `<input type="number" step="any" ${a} value="${esc(v ?? 0)}">`;
        case 'date': return `<input type="date" ${a} value="${esc(v ?? '')}">`;
        case 'option': return `<select ${a}>${[...new Set([...(f.options || []), ...(v && !(f.options || []).includes(v) ? [v] : [])])].map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}${!(f.options || []).length && !v ? '<option value=""></option>' : ''}</select>`;
        case 'color': return `<input type="color" ${a} value="${esc(String(v || '#d9d9d9').slice(0, 7))}">`;
        default: return `<input type="text" ${a} value="${esc(v ?? '')}" spellcheck="false">`;
    }
}

/** The body of the window. `ui` = { import: null | { kind: 'csv' | 'json', text, keep, append, note }, generate: number }. */
export function dataWindowHtml({ esc }, v, ui) {
    const schema = schemaOf(v), rows = Array.isArray(v.initial) ? v.initial : [];
    const head = schema.map((f, c) => `<th class="dw-col" data-dw-col="${esc(f.key)}">
        <div class="dw-name"><input data-dw-f="rename" data-dw-key="${esc(f.key)}" value="${esc(f.key)}" spellcheck="false" aria-label="Column name" title="${esc(f.key)}">
            <span class="dw-move"><button type="button" data-dw-act="move-left" data-dw-key="${esc(f.key)}" ${c === 0 ? 'disabled' : ''} title="Move left" aria-label="Move column left">‹</button><button type="button" data-dw-act="move-right" data-dw-key="${esc(f.key)}" ${c === schema.length - 1 ? 'disabled' : ''} title="Move right" aria-label="Move column right">›</button><button type="button" data-dw-act="del-col" data-dw-key="${esc(f.key)}" ${schema.length < 2 ? 'disabled' : ''} title="Remove column" aria-label="Remove column ${esc(f.key)}">×</button></span></div>
        <select data-dw-f="type" data-dw-key="${esc(f.key)}" aria-label="Type of ${esc(f.key)}">${COLUMN_TYPES.map(([id, l]) => `<option value="${id}" ${typeOf(f) === id ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <input data-dw-f="label" data-dw-key="${esc(f.key)}" value="${esc(f.label || '')}" placeholder="Header: ${esc(f.key)}" spellcheck="false" aria-label="Header text of ${esc(f.key)}" title="The header a table shows (empty = the column name)">
        ${f.type === 'option' ? `<input data-dw-f="options" data-dw-key="${esc(f.key)}" value="${esc((f.options || []).join(', '))}" placeholder="draft, sent, paid" spellcheck="false" aria-label="Options of ${esc(f.key)}" title="The values this column can take, separated by commas">` : ''}</th>`).join('');
    const body = rows.map((r, i) => `<tr><td class="dw-n">${i + 1}</td>${schema.map(f => `<td>${cell(esc, f, r?.[f.key], i)}</td>`).join('')}<td class="dw-x"><button type="button" data-dw-act="del-row" data-dw-i="${i}" title="Remove row" aria-label="Remove row ${i + 1}">×</button></td></tr>`).join('');
    const imp = ui.import;
    const importHtml = imp ? `<div class="dw-import"><div class="dw-tabs" role="tablist"><button type="button" role="tab" class="${imp.kind === 'csv' ? 'on' : ''}" data-dw-act="import-kind" data-dw-kind="csv">CSV</button><button type="button" role="tab" class="${imp.kind === 'json' ? 'on' : ''}" data-dw-act="import-kind" data-dw-kind="json">JSON</button><span class="dw-sp"></span><label class="dw-file">Choose file…<input type="file" accept="${imp.kind === 'csv' ? '.csv,.tsv,text/csv' : '.json,application/json'}" data-dw-file hidden></label></div>
        <textarea data-dw-text rows="5" spellcheck="false" placeholder="${imp.kind === 'csv' ? 'name,email,role\nAna,ana@mail.com,Admin' : '[{&quot;name&quot;: &quot;Ana&quot;, &quot;role&quot;: &quot;Admin&quot;}]'}" aria-label="Paste ${imp.kind.toUpperCase()}">${esc(imp.text || '')}</textarea>
        <div class="dw-opts"><label><input type="radio" name="dw-cols" data-dw-opt="keep" value="0" ${imp.keep ? '' : 'checked'}> Use the file’s columns</label><label><input type="radio" name="dw-cols" data-dw-opt="keep" value="1" ${imp.keep ? 'checked' : ''}> Keep my columns</label><label><input type="checkbox" data-dw-opt="append" ${imp.append ? 'checked' : ''}> Add to the rows I have</label></div>
        ${imp.note ? `<p class="dw-note ${imp.ok ? '' : 'bad'}">${esc(imp.note)}</p>` : ''}
        <div class="dw-importbar"><button type="button" class="vw-btn" data-dw-act="import-apply">Import</button><button type="button" class="vw-btn ghost" data-dw-act="import-close">Cancel</button></div></div>` : '';
    return `<div class="dw-bar">
        <button type="button" class="vw-btn ghost" data-dw-act="add-row">+ Row</button><button type="button" class="vw-btn ghost" data-dw-act="add-col">+ Column</button>
        <span class="dw-gen"><button type="button" class="vw-btn ghost" data-dw-act="generate">Generate</button><input type="number" min="1" max="500" data-dw-n value="${esc(ui.generate)}" aria-label="How many rows to generate"><span>rows</span></span>
        <button type="button" class="vw-btn ghost" data-dw-act="clear" title="Remove every row">Clear</button><button type="button" class="vw-btn ghost" data-dw-act="import-open">Import…</button><button type="button" class="vw-btn ghost" data-dw-act="export">Export CSV</button></div>
        ${importHtml}
        <div class="dw-grid"><table><thead><tr><th class="dw-n">#</th>${head}<th class="dw-x"></th></tr></thead><tbody>${body || `<tr><td colspan="${schema.length + 2}" class="dw-empty">No rows yet. Add one, import a file, or generate some.</td></tr>`}</tbody></table></div>
        <div class="dw-foot">${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${schema.length} ${schema.length === 1 ? 'column' : 'columns'} · this is the initial data: Preview starts from it and its Reset puts it back</div>`;
}
