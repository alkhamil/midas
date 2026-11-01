// The managed icon slots a template shares: a start and an end icon, placed by `hasIcon` and `iconPlacement`, each holding an icon prop
// (its icon is remembered while `hasIcon` is off). Button and Input take them the same way, so their definitions live here once.

const TOKENS = { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' };

/** The start and end icon slots, as anatomy entries. */
export const ICON_START = { id: 'iconStart', kind: 'icon', optional: true, managed: true };
export const ICON_END = { id: 'iconEnd', kind: 'icon', optional: true, managed: true };

/** The managed icon slots: `show` turns one on, `placement` picks its slot, `component` is the icon it holds. */
export const ICON_DEFS = [
    { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconStart', component: 'icon', tokens: TOKENS },
    { show: 'hasIcon', placement: 'iconPlacement', slot: 'iconEnd', component: 'iconEnd', tokens: TOKENS },
];

/** The props that place and choose the icons. `requires` is the variable dimensions the switch needs bound. */
export const ICON_PROPS = {
    hasIcon: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
    iconPlacement: { source: 'literal', type: 'enum', options: ['start', 'end', 'both'], default: 'start', slots: { start: 'iconStart', end: 'iconEnd', both: ['iconStart', 'iconEnd'] }, visibleIf: { prop: 'hasIcon', is: true } },
    icon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true }, remembered: true },
    iconEnd: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'hasIcon', is: true }, remembered: true },
};

/** The display mapping of the icon slots: each icon is sized by the icon size token. */
export const ICON_DISPLAY = { iconStart: { size: 'iconSize' }, iconEnd: { size: 'iconSize' } };
