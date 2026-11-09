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
    if (!input) return false;
    const min = numberOf(input.getAttribute('data-num-min')), max = numberOf(input.getAttribute('data-num-max'));
    const next = stepValue(String(input.value ?? ''), Number(glyph.getAttribute('data-press-step')) === -1 ? -1 : 1, { min, max, step: numberOf(input.getAttribute('data-num-step')) ?? 1, precision: numberOf(input.getAttribute('data-num-precision')) });
    input.value = next;
    write(AT_MIN_ATTR, min !== null && Number(next) <= min);
    write(AT_MAX_ATTR, max !== null && Number(next) >= max);
    return true;
}
