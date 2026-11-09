import { INPUT } from './input.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// The Input family (Password, TextArea, InputNumber): each is the Input's schema with a few things dropped and a few added, never a copy of it. The sizes,
// the Variant and Status colours, the states, the managed text (value, prefix, suffix, count), the focus halo and the interaction are Input's own, read from
// INPUT at module load, so a change to the Input reaches the family. `dropped` names what the family member does not have (the clear icon is out of scope for
// all three); `added` is merged over the clone, each map by key and each list at the end (or `before` a slot).

/** The clear icon, as Input declares it: the anatomy slot, the icon def, the props, the display key, the tokens and the play-only note. */
export const CLEAR = { anatomy: ['clear'], icons: ['clear'], props: ['allowClear', 'clearIcon'], tokens: ['clearIconSize', 'clear-hover'], playOnly: ['clear-hover'] };

/** The counter, as Input declares it: a member without a count drops it (the control's `count` flag is its own to leave out). */
export const COUNT = { anatomy: ['count'], icons: [], props: ['showCount'], tokens: ['countTypography'], playOnly: [] };

/**
 * A family member: INPUT without `dropped`, plus `added`.
 * @param {{
 *   id: string, name: string, sampleProps: Record<string, string>,
 *   dropped?: { anatomy?: string[], icons?: string[], props?: string[], tokens?: string[], playOnly?: string[] },
 *   added?: Partial<TemplateSchema> & { anatomyBefore?: Record<string, string>, anatomyPatch?: Record<string, Record<string, unknown>> },
 * }} spec
 * @returns {TemplateSchema}
 */
export function inputFamily({ id, name, sampleProps, dropped = CLEAR, added = {} }) {
    /** @type {any} */
    const out = structuredClone(INPUT);
    const gone = new Set(dropped.tokens ?? []);
    out.id = id;
    out.name = name;
    out.sampleProps = sampleProps;
    out.anatomy = out.anatomy.filter(s => !(dropped.anatomy ?? []).includes(s.id));
    out.icons = out.icons.filter(d => !(dropped.icons ?? []).includes(d.slot));
    for (const prop of dropped.props ?? []) delete out.props[prop];
    for (const key of dropped.anatomy ?? []) delete out.display[key];
    for (const group of Object.keys(out.tokens)) out.tokens[group] = out.tokens[group].filter(t => !gone.has(t));
    for (const table of [out.tokenKinds, out.tokenRoles]) for (const t of gone) delete table[t];
    out.playOnly = out.playOnly.filter(p => !(dropped.playOnly ?? []).includes(p.id));
    const { anatomyBefore = {}, anatomyPatch = {}, anatomy = [], props = {}, tokens = {}, tokenKinds = {}, tokenRoles = {}, display = {}, persistentStates = {}, statePseudo = {}, previewStates = {}, parts = [], playOnly = [], icons = [], ...rest } = added;
    for (const slot of out.anatomy) Object.assign(slot, anatomyPatch[slot.id] ?? {});
    for (const slot of anatomy) {
        const before = anatomyBefore[slot.id];
        const at = before === undefined ? out.anatomy.length : out.anatomy.findIndex(s => s.id === before);
        out.anatomy.splice(at, 0, slot);
    }
    out.icons.push(...icons);
    Object.assign(out.props, props);
    for (const [group, list] of Object.entries(tokens)) out.tokens[group] = [...(out.tokens[group] ?? []), ...list];
    Object.assign(out.tokenKinds, tokenKinds);
    Object.assign(out.tokenRoles, tokenRoles);
    for (const [key, map] of Object.entries(display)) out.display[key] = { ...(out.display[key] ?? {}), ...map };
    Object.assign(out.persistentStates, persistentStates);
    Object.assign(out.statePseudo, statePseudo);
    // A display entry that read a dropped token goes with it (the height, the icon size).
    for (const map of Object.values(out.display)) for (const [prop, token] of Object.entries(map)) if (gone.has(token)) delete map[prop];
    for (const [state, map] of Object.entries(previewStates)) out.previewStates[state] = { ...(out.previewStates[state] ?? {}), ...map };
    out.parts.push(...parts);
    out.playOnly.push(...playOnly);
    return Object.assign(out, rest);
}
