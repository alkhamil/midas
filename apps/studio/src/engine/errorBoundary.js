// A floating window whose render throws shows the error and a Retry button instead of staying blank. Pure.
const escape = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** The message of whatever was thrown. */
export const errorMessage = err => String(err?.message || err || 'Unknown error');

/** Body of an error view: what failed, the message, Retry (`data-eb-retry`). The caller keeps its own title bar / close button. */
export function errorBoundaryHtml(what, err) {
    return `<div class="eb" role="alert"><div class="eb-title">${escape(what)} could not be shown</div><div class="eb-msg">${escape(errorMessage(err))}</div><button class="vw-btn eb-retry" data-eb-retry>Retry</button></div>`;
}

/** Runs `render`; when it throws, calls `onError(err)` instead of propagating. → true when it rendered. */
export function guarded(render, onError) {
    try { render(); return true; }
    catch (err) { try { console.error(err); } catch { } onError(err); return false; }
}
