// The press actions of a template (its `press` list): a click on a glyph of the template either turns a state of the root on or off (a password shown) or steps the
// control's number (a number input's arrows). Pure over element-like objects, so a DOM-less test drives it; Play calls applyPress on a click, and nothing here reads a
// template: the glyph carries what it does in data attributes (see dom-tree.js).

/** The root attributes that say a stepped value has reached a limit. The stylesheet recolours the arrow with them, and the schema's persistent states use the same names. */
export const AT_MIN_ATTR = 'data-at-min';
export const AT_MAX_ATTR = 'data-at-max';

/** The digits after the decimal point of a number, as a plain decimal. */
const decimalsOf = n => { const s = String(n); const e = /e-(\d+)$/.exec(s); return e ? +e[1] : (s.split('.')[1] ?? '').length; };

/**
 * The value after one step, as text: the current value (0 when empty or not a number) plus or minus the step, held within the limits, written with the precision
 * (or, with none, with as many decimals as the value and the step have, so 0.1 + 0.2 is 0.3).
 * @param {string} current
 * @param {1 | -1} direction
 * @param {{ min: number | null, max: number | null, step: number, precision: number | null }} limits
 * @returns {string}
 */
export function stepValue(current, direction, { min, max, step, precision }) {
    const parsed = current.trim() === '' ? NaN : Number(current);
    const from = Number.isFinite(parsed) ? parsed : 0;
    const places = precision ?? Math.max(decimalsOf(from), decimalsOf(step));
    let next = Number((from + direction * step).toFixed(places));
    if (max !== null) next = Math.min(next, max);
    if (min !== null) next = Math.max(next, min);
    return next.toFixed(precision ?? decimalsOf(next));
}

const numberOf = text => (text === null || text === '' ? null : Number.isFinite(Number(text)) ? Number(text) : null);

/**
 * A click in Play. Finds the pressable glyph under the target and runs its action on the root it sits in; nothing happens while the control is disabled.
 * @param {{ closest(sel: string): any }} target
 * @returns {boolean} whether the click was a press that ran
 */
export function applyPress(target) {
    const glyph = target.closest?.('[data-press]');
    const root = glyph?.closest('[data-press-root]');
    if (!glyph || !root) return false;
    // A dismiss takes the root out: a disabled element does not dismiss; the exit runs, then the root is hidden (at once under reduced motion, see the stylesheet).
    if (glyph.getAttribute('data-press') === 'dismiss') {
        if (root.hasAttribute('aria-disabled') || root.hasAttribute('disabled')) return false;
        root.setAttribute('data-dismissed', '');
        root.addEventListener?.('transitionend', e => { if (e.target === root) root.style.display = 'none'; });
        return true;
    }
    // A disabled element does not copy, expand or toggle.
    if (root.hasAttribute('aria-disabled')) return false;
    // A copy puts the text of the slot it names on the clipboard.
    if (glyph.getAttribute('data-press') === 'copy') {
        const text = root.querySelector(`.${glyph.getAttribute('data-press-copy')}`)?.textContent ?? '';
        globalThis.navigator?.clipboard?.writeText(text);
        return true;
    }
    const input = root.querySelector('input,textarea');
    if (input?.hasAttribute('disabled')) return false;
    const write = (name, on) => (on ? root.setAttribute(name, '') : root.removeAttribute(name));
    if (glyph.getAttribute('data-press') === 'toggle') {
        const attr = glyph.getAttribute('data-press-attr');
        const on = !root.hasAttribute(attr);
        write(attr, on);
        // A masked input shows its text while the state is on.
        for (const el of root.querySelectorAll('[data-mask-unless]')) el.type = root.hasAttribute(el.getAttribute('data-mask-unless')) ? 'text' : 'password';
        return true;
    }
    // The resize grip drags (see startResizeDrag); only an arrow steps.
    if (glyph.getAttribute('data-press') !== 'step' || !input) return false;
    const min = numberOf(input.getAttribute('data-num-min')), max = numberOf(input.getAttribute('data-num-max'));
    const next = stepValue(String(input.value ?? ''), Number(glyph.getAttribute('data-press-step')) === -1 ? -1 : 1, { min, max, step: numberOf(input.getAttribute('data-num-step')) ?? 1, precision: numberOf(input.getAttribute('data-num-precision')) });
    input.value = next;
    input.setAttribute('data-committed', next);
    write(AT_MIN_ATTR, min !== null && Number(next) <= min);
    write(AT_MAX_ATTR, max !== null && Number(next) >= max);
    return true;
}

/**
 * A number input losing focus (Play): the typed text commits as commitNumber says (a valid number, clamped and rounded; anything else is discarded for the last committed value),
 * and the root says whether a limit is reached.
 * @param {any} input the number input; it carries its limits (data-num-*) and the last committed value (data-committed)
 * @returns {string} the value it holds now
 */
export function blurNumber(input) {
    const root = input.closest?.('[data-press-root]');
    const min = numberOf(input.getAttribute('data-num-min')), max = numberOf(input.getAttribute('data-num-max'));
    const next = commitNumber(String(input.value ?? ''), input.getAttribute('data-committed') ?? '', { min, max, precision: numberOf(input.getAttribute('data-num-precision')) });
    input.value = next;
    input.setAttribute('data-committed', next);
    const write = (name, on) => (on ? root?.setAttribute(name, '') : root?.removeAttribute(name));
    write(AT_MIN_ATTR, next !== '' && min !== null && Number(next) <= min);
    write(AT_MAX_ATTR, next !== '' && max !== null && Number(next) >= max);
    return next;
}

/**
 * The value a number input holds after it loses focus. The typed text commits when it is a number: clamped to the limits and written with the precision; an empty
 * field is a valid empty value. Anything else is discarded and the last committed value comes back (empty when nothing was committed before). Self-contained, so the
 * export embeds its source and runs the same logic as Play.
 * @param {string} typed
 * @param {string} committed the last committed valid value
 * @param {{ min: number | null, max: number | null, precision: number | null }} limits
 * @returns {string}
 */
export function commitNumber(typed, committed, { min, max, precision }) {
    const text = String(typed).trim();
    if (text === '') return '';
    const n = Number(text);
    if (!Number.isFinite(n)) return committed;
    let next = n;
    if (max !== null) next = Math.min(next, max);
    if (min !== null) next = Math.max(next, min);
    const places = precision !== null ? precision : (String(next).split('.')[1] ?? '').length;
    return next.toFixed(places);
}

/**
 * The height range of a text area inside its box: the box's computed min and max height (the tokens, as the browser resolved them) less the chrome around the field
 * (padding, the footer row), so the box stays within its own limits.
 * @param {{ minHeight: string, maxHeight: string }} box computed style of the box
 * @param {number} boxHeight
 * @param {number} fieldHeight
 * @returns {{ min: number, max: number }}
 */
export function resizeLimits({ minHeight, maxHeight }, boxHeight, fieldHeight) {
    const chrome = boxHeight - fieldHeight;
    const px = text => (Number.isFinite(parseFloat(text)) ? parseFloat(text) : null);
    const min = px(minHeight), max = px(maxHeight);
    return { min: Math.max(0, (min ?? 0) - chrome), max: max === null ? Infinity : max - chrome };
}

/** The height a drag of `dy` px gives a field that was `height` tall, held within the limits. Vertical only. */
export const resizeHeight = (height, dy, { min, max }) => Math.min(max, Math.max(min, height + dy));

/**
 * The start of a drag on a text area's resize handle. The field's own computed min and max height (its rows, as the tokens give them) bound the drag. Null while the field is disabled.
 * `move(y)` sets the field's height from the pointer's y.
 * @param {{ querySelector(sel: string): any }} box
 * @param {number} startY
 * @param {(el: any) => { minHeight: string, maxHeight: string }} computedOf the computed style of the field
 * @returns {{ move(y: number): void } | null}
 */
export function startResizeDrag(box, startY, computedOf) {
    const field = box.querySelector('textarea');
    if (!field || field.hasAttribute('disabled')) return null;
    const from = field.offsetHeight, range = resizeLimits(computedOf(field), from, from);
    return { move: y => { field.style.height = `${resizeHeight(from, y - startY, range)}px`; } };
}

/**
 * A click on the padding of a text box focuses its field, so the whole box acts as the field. A click on the field itself, on a pressable glyph (the resize handle has its
 * own behaviour) or on a disabled field does nothing here.
 * @param {{ closest(sel: string): any }} target
 * @returns {boolean} whether the field took the focus
 */
export function forwardFocus(target) {
    const box = target.closest?.('[data-field-box]');
    if (!box || target.closest('input,textarea,[data-press]')) return false;
    const field = box.querySelector('input,textarea');
    if (!field || field.hasAttribute('disabled')) return false;
    field.focus();
    return true;
}
