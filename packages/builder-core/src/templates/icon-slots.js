// The managed icon slots Button has: a start and an end icon, placed by `hasIcon` and `iconPlacement` (start or end, never both), each
// holding an icon prop (its icon is remembered while `hasIcon` is off). Input does not use them: its sides are prefix and suffix.

/** The tokens an icon slot follows: its colour (and the disabled one) and its size. */
export const ICON_TOKENS = { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' };

/** The start and end icon slots, as anatomy entries. */
export const ICON_START = { id: 'iconStart', kind: 'icon', optional: true, managed: true };
export const ICON_END = { id: 'iconEnd', kind: 'icon', optional: true, managed: true };

/** The managed icon slots: `show` turns one on, `placement` picks its slot, `component` is the icon it holds. */
export const ICON_DEFS = [
    { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconStart', component: 'icon', tokens: ICON_TOKENS },
    { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconEnd', component: 'iconEnd', tokens: ICON_TOKENS },
];

/** The props that place and choose the icons. `requires` is the variable dimensions the switch needs bound. */
export const ICON_PROPS = {
    hasIcon: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
    iconPlacement: { source: 'literal', type: 'enum', options: ['start', 'end'], default: 'start', slots: { start: 'iconStart', end: 'iconEnd' }, visibleIf: { prop: 'hasIcon', is: true } },
    icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true }, remembered: true },
    iconEnd: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true }, remembered: true },
};

/** The display mapping of the icon slots: each icon is sized by the icon size token. */
export const ICON_DISPLAY = { iconStart: { size: ICON_TOKENS.size }, iconEnd: { size: ICON_TOKENS.size } };

/**
 * The display mapping of an icon-like part (the Button's spinner), from the same definition as the slots: the arc is drawn in the icon's
 * colour and at the icon's size. The part also holds ICON_TOKENS (`tokens`), so the editor binds it through the function that binds
 * the icon slots, with the disabled colour.
 */
export const ICON_PART_DISPLAY = { stroke: ICON_TOKENS.colour, size: ICON_TOKENS.size };
