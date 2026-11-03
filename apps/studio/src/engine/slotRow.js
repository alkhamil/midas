// The row of a content slot in the instance's Design panel (markup only). The "Add instances" button says what the slot holds; Clear and Reset sit
// beside it as small actions. Clear shows while the slot holds layers. Reset shows while the instance owns the slot (it edited it), so there is
// something to give back: the main component's content is copied in again.
import { slotCountLabel } from '@midas/builder-core';

/**
 * @param {{ slotId: string, count: number, owned: boolean, esc: (text: string) => string, icons: { slot: string, plus: string, clear: string, reset: string } }} input
 *   `icons` are the icons' markup (the caller draws them); `esc` escapes text for HTML
 * @returns {string}
 */
export function slotRowHtml({ slotId, count, owned, esc, icons }) {
    const id = esc(slotId);
    const add = `<button class="cmp-slot add" data-slot-add="${id}" title="Add instances to this slot">${icons.slot}<span>${esc(slotCountLabel(count))}</span><i>${icons.plus}</i></button>`;
    const clear = count > 0 ? `<button class="icon-button small" data-slot-clear="${id}" title="Clear slot" aria-label="Clear slot">${icons.clear}</button>` : '';
    const reset = owned ? `<button class="icon-button small" data-slot-reset="${id}" title="Reset slot" aria-label="Reset slot">${icons.reset}</button>` : '';
    return add + clear + reset;
}
