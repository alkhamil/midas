import { typographyBase } from './typography-base.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Paragraph (antd Typography.Paragraph): a block of text that wraps in its width. Everything of Text, and: ellipsis (the text is clamped to its rows)
// with an optional expand control (a text that a click turns into the whole text, while Play and the export keep the state), and copyable (a copy icon, an icon slot the
// designer picks, that puts the text on the clipboard). The expand control and the copy icon are layers made while their prop is on and removed while it is off. Both take a
// hover colour (Play and the export; the canvas is static). Editable is not built. Ant Design structure only; every value is a token.

const base = typographyBase({ dimension: 'size' });

const ICON_SIZES = { xs: 'icon-xs', sm: 'icon-sm', md: 'icon-md', lg: 'icon-lg', xl: 'icon-xl', default: 'icon-md' };
const HAS_ELLIPSIS = { prop: 'ellipsis', is: true };
const EXPANDER_SHOWN = { all: [HAS_ELLIPSIS, { prop: 'expandable', is: true }] };

/** @type {TemplateSchema} */
export const PARAGRAPH = {
    id: 'antd-paragraph',
    name: 'Paragraph',
    primarySlot: 'label',
    sampleProps: { label: 'Ant Design, a design language for background applications, is refined by Ant UED Team.' },
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { ...base.anatomy.label, fill: true },
        // The expand control: a text in a box, made while ellipsis has rows and expandable is on.
        { id: 'expander', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'start', managed: true, shownWhen: EXPANDER_SHOWN },
        { id: 'expandText', kind: 'text', parent: 'expander', optional: true, managed: true, typography: 'label', shownWhen: { all: [HAS_ELLIPSIS, { prop: 'expandable', is: true }, { prop: 'expandText', empty: false }] } },
        // The copy control: an icon in a box, made while copyable is on.
        { id: 'copier', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'copyable', is: true } },
        { id: 'copy', kind: 'icon', parent: 'copier', optional: true, managed: true },
    ],
    icons: [
        { show: 'copyable', slot: 'copy', component: 'copyIcon', role: 'copy', tokens: { colour: 'copyFg', disabledColour: 'copyFg', size: 'iconSize', hoverColour: 'copyHover' } },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    rootWidth: 343,
    props: {
        ...base.props,
        ...base.literal,
        label: { ...base.literal.label, default: 'Ant Design, a design language for background applications, is refined by Ant UED Team.' },
        // Ellipsis clamps the text to its rows.
        ellipsis: { source: 'literal', type: 'boolean', default: false, node: { key: 'label', field: 'textTruncate' } },
        rows: { source: 'literal', type: 'number', default: 2, node: { key: 'label', field: 'maxLines' }, visibleIf: HAS_ELLIPSIS },
        expandable: { source: 'literal', type: 'boolean', default: false, visibleIf: HAS_ELLIPSIS },
        expandText: { source: 'literal', type: 'string', default: 'Expand', node: { key: 'expandText', field: 'text' }, visibleIf: EXPANDER_SHOWN, remembered: true },
        copyable: { source: 'literal', type: 'boolean', default: false },
        copyIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'copyable', is: true }, remembered: true },
    },
    tokens: {
        ...base.tokens,
        fromType: [...base.tokens.fromType, 'linkFg', 'linkHover', 'copyFg', 'copyHover'],
        fromSize: [...base.tokens.fromSize, 'iconSize', 'gap'],
    },
    tokenKinds: { ...base.tokenKinds, linkFg: 'color', linkHover: 'color', copyFg: 'color', copyHover: 'color', iconSize: 'length', gap: 'length' },
    tokenRoles: { ...base.tokenRoles, linkFg: 'link', linkHover: 'link-hover', copyFg: 'fg-secondary', copyHover: 'link-hover', iconSize: ICON_SIZES, gap: 'gap-sm' },
    persistentStates: base.persistentStates,
    previewStates: {},
    statePseudo: base.statePseudo,
    // A click on the expand control turns the clamp off (and on again); a click on the copy icon copies the text.
    press: [
        { slot: 'expander', toggleState: 'expanded', expand: true, glyph: 'expandText', hoverFill: 'linkHover' },
        { slot: 'copier', copy: 'label' },
    ],
    parts: [],
    playOnly: [],
    display: {
        ...base.display,
        root: { ...base.display.root, gap: 'gap' },
        expandText: { fill: 'linkFg', typography: 'labelTypography' },
        copy: { size: 'iconSize' },
    },
    events: [],
};
