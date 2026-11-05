import { ICON_TOKENS } from './icon-slots.js';
import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

// The clear icon: a managed slot shown while Allow Clear is on. It is drawn but hidden while the value is empty, so Play can show it as the value is typed.
const CLEAR_ICON = { show: 'allowClear', slot: 'clear', component: 'clearIcon', label: 'Clear icon', hideWhenEmpty: 'value', cursor: 'pointer', tokens: { ...ICON_TOKENS, colour: 'placeholder', size: 'clearIconSize', hoverColour: 'clear-hover' } };

// The prefix and the suffix are the Input's only side slots, as in antd. Each is on with its own switch and holds Text or an Icon: the
// kind enum maps `icon` to the managed icon slot (and `text` to none), so the text layer shows for Text and the icon slot for Icon.
const PREFIX_ICON = { show: 'hasPrefix', placement: 'prefixKind', slot: 'prefixIcon', component: 'prefixIcon', label: 'Prefix icon', tokens: ICON_TOKENS };
const SUFFIX_ICON = { show: 'hasSuffix', placement: 'suffixKind', slot: 'suffixIcon', component: 'suffixIcon', label: 'Suffix icon', tokens: ICON_TOKENS };
/** The condition a side's content shows under: its switch is on and its kind is `kind`. */
const sideShown = (side, kind) => ({ all: [{ prop: `has${side}`, is: true }, { prop: `${side.toLowerCase()}Kind`, is: kind }] });

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

/** @type {TemplateSchema} */
export const INPUT = {
    id: 'input',
    name: 'Input',
    // The primary text part: the control the value prop writes.
    primarySlot: 'label',
    // The element the component is written as. `disabledState` is the persistent state that disables it.
    element: { tag: 'span', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    // The prefix (start side) and the suffix (end side): each holds Text (the text layer, shown while its text is not empty) or an Icon
    // (a managed icon slot, swappable like Button's). Only one of the two shows for a side; the clear icon sits before the suffix.
    anatomy: [
        { id: 'prefixIcon', kind: 'icon', optional: true, managed: true },
        { id: 'prefixText', kind: 'text', optional: true, typography: 'addon', shownWhen: { all: [...sideShown('Prefix', 'text').all, { prop: 'prefixText', empty: false }] } },
        { id: 'label', kind: 'control', typography: 'value', fill: true },
        { id: 'clear', kind: 'icon', optional: true, managed: true },
        { id: 'suffixText', kind: 'text', optional: true, typography: 'addon', shownWhen: { all: [...sideShown('Suffix', 'text').all, { prop: 'suffixText', empty: false }] } },
        { id: 'suffixIcon', kind: 'icon', optional: true, managed: true },
    ],
    // The managed icon slots: the prefix icon, the suffix icon and the clear icon.
    icons: [PREFIX_ICON, SUFFIX_ICON, CLEAR_ICON],
    // The control: the label slot drawn as an input holding the value prop (and the placeholder beside it). `count` is the prop that
    // shows the character counter (with `maxlength`). `hidePlaceholderWhenFilled`: the value wins, so the placeholder layer is hidden while
    // the value is not empty (it also needs its own text to show: see its part). `hideWhenEmpty`: the
    // value layer is hidden while the value is empty, so the placeholder that shows in its place takes its space and no more.
    control: { slot: 'label', value: 'value', placeholder: 'placeholder', readonly: 'readOnly', maxlength: 'maxLength', minlength: 'minLength', count: 'showCount', hideWhenEmpty: true, hidePlaceholderWhenFilled: true },
    // The focus outline: its width is the outline-width token (it counts the border) and it is drawn with no gap from
    // the border's inner edge; its colour is the outline-color token (transparent until focus).
    // The box that owns interaction visuals: the root wrapper reflects the inner control focus and disabled
    // state (`:has()` selectors in the stylesheet). Only a template with a control sets one.
    focusTarget: 'wrapper',
    interaction: { focus: 'halo', wave: false },
    outline: { offset: 0 },
    // A new Input is left aligned and centred, and a fixed 343px wide; the node owns both after that.
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    rootWidth: 343,
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['outlined', 'filled', 'borderless'] },
        status: { source: 'variable', collection: 'Status', modes: ['default', 'error', 'warning'] },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        // `node` is the node field the prop writes (see display.js NODE_FIELDS). The value writes the canvas text layer.
        value: { source: 'literal', type: 'string', default: '', node: { key: 'label', field: 'text' } },
        placeholder: { source: 'literal', type: 'string', default: '', node: { key: 'placeholder', field: 'text' } },
        // The limits are whole numbers, and null for no limit. minLength is never above maxLength (see instance-props.js).
        maxLength: { source: 'literal', type: 'number', default: null },
        minLength: { source: 'literal', type: 'number', default: null, atMost: 'maxLength' },
        allowClear: { source: 'literal', type: 'boolean', default: false },
        clearIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'allowClear', is: true }, remembered: true },
        showCount: { source: 'literal', type: 'boolean', default: false },
        // Each side: a switch, the kind of content it holds, and that content. The text and the icon of a side are remembered while the
        // switch is off or the other kind is chosen (`remembered`), so switching back restores them.
        hasPrefix: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
        prefixKind: { source: 'literal', type: 'enum', options: ['text', 'icon'], default: 'text', slots: { icon: 'prefixIcon' }, control: 'segmented', visibleIf: { prop: 'hasPrefix', is: true }, remembered: true },
        prefixText: { source: 'literal', type: 'string', default: '', node: { key: 'prefixText', field: 'text' }, visibleIf: sideShown('Prefix', 'text'), remembered: true },
        prefixIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: sideShown('Prefix', 'icon'), remembered: true },
        hasSuffix: { source: 'literal', type: 'boolean', default: false, requires: ['variant', 'size'] },
        suffixKind: { source: 'literal', type: 'enum', options: ['text', 'icon'], default: 'text', slots: { icon: 'suffixIcon' }, control: 'segmented', visibleIf: { prop: 'hasSuffix', is: true }, remembered: true },
        suffixText: { source: 'literal', type: 'string', default: '', node: { key: 'suffixText', field: 'text' }, visibleIf: sideShown('Suffix', 'text'), remembered: true },
        suffixIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: sideShown('Suffix', 'icon'), remembered: true },
        disabled: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'readOnly', fillEmpty: { prop: 'placeholder', text: 'Enter text input' } },
        readOnly: { source: 'literal', type: 'boolean', default: false, exclusiveWith: 'disabled', fillEmpty: { prop: 'value', text: 'Text input' } },
    },
    tokens: {
        fromSize: ['height', 'valueTypography', 'addonTypography', 'placeholderTypography', 'countTypography', 'paddingX', 'paddingY', 'gap', 'radius', 'iconSize', 'clearIconSize', 'borderWidth', 'outlineWidth'],
        fromVariant: ['bg', 'fg', 'border', 'placeholder', 'clear-hover', 'bg-hover', 'border-hover', 'border-focus', 'bg-disabled', 'fg-disabled', 'outline-color', 'outline-color-active'],
        fromStatus: ['status-border', 'status-border-hover', 'status-border-focus', 'status-outline'],
    },
    // The kind of value each token holds: `length` is a number in px, `ratio` a unitless number, `color` a CSS colour string.
    tokenKinds: {
        height: 'length', paddingX: 'length', paddingY: 'length', gap: 'length', radius: 'length', iconSize: 'length', clearIconSize: 'length', borderWidth: 'length', outlineWidth: 'length',
        valueTypography: 'typography', addonTypography: 'typography', placeholderTypography: 'typography', countTypography: 'typography',
        bg: 'color', fg: 'color', border: 'color', placeholder: 'color', 'clear-hover': 'color', 'bg-hover': 'color', 'border-hover': 'color', 'border-focus': 'color',
        'bg-disabled': 'color', 'fg-disabled': 'color', 'outline-color': 'color', 'outline-color-active': 'color',
        'status-border': 'color', 'status-border-hover': 'color', 'status-border-focus': 'color', 'status-outline': 'color',
    },
    // Which base role each token fills, per dimension mode (matched case-insensitively, `default` is the fallback).
    // A value with a slash is another token variable of this template, followed through the bound collection.
    tokenRoles: {
        height: { xs: 'height-xs', sm: 'height-sm', md: 'height', lg: 'height-lg', xl: 'height-xl', default: 'height' },
        valueTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        addonTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        placeholderTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        countTypography: {         xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' },
        paddingX: { xs: 'padding-x-xs', sm: 'padding-x-sm', md: 'input-padding-x-md', lg: 'input-padding-x-lg', xl: 'input-padding-x-xl', default: 'input-padding-x-md' },
        paddingY: { xs: 'padding-y-xs', sm: 'padding-y-sm', md: 'button-padding-y-md', lg: 'button-padding-y-lg', xl: 'button-padding-y-xl', default: 'button-padding-y-md' },
        gap: 'gap-xs',
        borderWidth: 'border-width',
        outlineWidth: 'outline-width',
        radius: { xs: 'radius-xs', sm: 'radius-sm', md: 'radius', lg: 'radius-lg', xl: 'radius-xl', default: 'radius' },
        iconSize: { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', default: 'icon-md' },
        // The clear icon is the icon size minus 2 (derived in the base data, antd-sizes.json: clearIconSize*).
        clearIconSize: { xs: 'clear-icon-xs', sm: 'clear-icon-sm', md: 'clear-icon-md', lg: 'clear-icon-lg', xl: 'clear-icon-xl', default: 'clear-icon-md' },
        bg: { outlined: 'bg', filled: 'bg-subtle', borderless: 'transparent', default: 'bg' },
        fg: 'fg',
        border: { outlined: './status-border', filled: 'transparent', borderless: 'transparent', default: './status-border' },
        placeholder: 'placeholder',
        // The clear icon's hover colour: placeholder to secondary text, as antd.
        'clear-hover': 'clear-hover',
        'bg-hover': { outlined: 'bg', filled: 'bg-subtle', borderless: 'transparent', default: 'bg' },
        'border-hover': { outlined: './status-border-hover', filled: 'transparent', borderless: 'transparent', default: './status-border-hover' },
        'border-focus': { outlined: './status-border-focus', filled: 'transparent', borderless: 'transparent', default: './status-border-focus' },
        'bg-disabled': 'bg-disabled', 'fg-disabled': 'fg-disabled', 'outline-color': 'outline-transparent', 'outline-color-active': { outlined: './status-outline', filled: './status-outline', borderless: './status-outline', default: './status-outline' },
        'status-border': { default: 'border', error: 'error', warning: 'warning' },
        'status-border-hover': { default: 'border-hover', error: 'error-hover', warning: 'warning-hover' },
        'status-border-focus': { default: 'border-focus', error: 'error', warning: 'warning' },
        'status-outline': { default: 'outline', error: 'danger-outline', warning: 'warning-outline' },
    },
    // Persistent: stored on the instance and drawn on the canvas. `tokens` says which base token the state replaces.
    persistentStates: {
        disabled: { prop: 'disabled', tokens: { bg: 'bg-disabled', fg: 'fg-disabled' } },
        // Read only is non-interactive too and draws the disabled look: it is the disabled state turned on by its own prop.
        readOnly: { prop: 'readOnly', as: 'disabled', tokens: {} },
    },
    // Preview only: studio-side, colours only. Never written to the document.
    previewStates: {
        hover: { bg: 'bg-hover', border: 'border-hover' },
        focus: { border: 'border-focus', 'outline-color': 'outline-color-active' },
        'focus-visible': { 'outline-color': 'outline-color-active' },
    },
    // The CSS pseudo-class each state is written as.
    statePseudo: { disabled: ':disabled', hover: ':hover', focus: ':focus', 'focus-visible': ':focus-visible' },
    // The parts the canvas draws beside the value: each is a node in the master and in every instance, shown by its own condition.
    // The text part `count` shows the value's length (see counterLabel). Play renders each part from its node.
    parts: [
        { id: 'placeholder', kind: 'text', fill: true, shownWhen: { prop: 'placeholder', empty: false }, typography: 'placeholder' },
        { id: 'count', kind: 'text', shownWhen: { prop: 'showCount', is: true }, text: { counter: { value: 'value', max: 'maxLength' } }, typography: 'count' },
    ],
    // What Play draws without a node, and why. The static end state of each is on the canvas through the props above.
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
        { id: 'focus-halo', reason: 'focus ring follows keyboard focus; the canvas shows the rest state' },
        { id: 'caret', reason: 'the text caret exists only in the live input' },
        { id: 'typing', reason: 'typing changes the value live; the canvas shows the Value prop' },
        { id: 'clear-hover', reason: 'hover has no static canvas visual' },
        { id: 'validation', reason: 'validation has no static visual; error state comes with FormItem rules' },
    ],
    // Which token drives which property of which node (root, an anatomy slot or a part). Literal props write their node field (see props).
    display: {
        root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', height: 'height', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gap' },
        label: { fill: 'fg', typography: 'valueTypography', placeholder: 'placeholder' },
        prefixText: { fill: 'fg', typography: 'addonTypography' },
        suffixText: { fill: 'fg', typography: 'addonTypography' },
        placeholder: { fill: 'placeholder', typography: 'placeholderTypography' },
        clear: { size: 'clearIconSize' },
        count: { fill: 'placeholder', typography: 'countTypography' },
        prefixIcon: { size: 'iconSize' },
        suffixIcon: { size: 'iconSize' },
    },
    events: [
        { name: 'onFocus', exposeAsTrigger: false },
        { name: 'onBlur', exposeAsTrigger: false },
    ],
};
