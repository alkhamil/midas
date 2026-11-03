/**
 * Applies a descriptor's style to an element. A custom property (`--name`) goes through setProperty, which is the only way to set one on element.style (the
 * template's rules read them: a FormItem's gap and label width); every other property is assigned.
 * @param {{ style: any }} el
 * @param {Record<string, string> | undefined} style
 */
export function applyStyle(el, style) {
    for (const [key, value] of Object.entries(style ?? {})) {
        if (key.startsWith('--')) el.style.setProperty(key, value);
        else el.style[key] = value;
    }
}
