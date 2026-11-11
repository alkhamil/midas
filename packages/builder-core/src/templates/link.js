import { TYPE_COLOURS, typographyBase } from './typography-base.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Link (antd Typography.Link): Text that is an anchor. The element is an `a` and its `href` is a text prop: Play and the export write it (the canvas has none), and a click in
// Play stays in Play. Everything of Text, with the link colour for the default Type. Hover, focus and pressed recolour the text by tokens (a Type's own hover and pressed
// colours); the canvas is static. A disabled link has no href, takes the disabled colour and does not hover. Ant Design structure only; every value is a token.

const base = typographyBase({ dimension: 'size' });

/** The colour of the text while hovered, and while pressed, per Type mode (a role each). */
const HOVER = { default: 'link-hover', secondary: 'fg', success: 'success-hover', warning: 'warning-hover', danger: 'danger-hover' };
const PRESSED = { default: 'link-active', secondary: 'fg', success: 'success-hover', warning: 'warning-hover', danger: 'danger-active' };

/** @type {TemplateSchema} */
export const LINK = {
    id: 'antd-link',
    name: 'Link',
    primarySlot: 'label',
    sampleProps: { label: 'Link' },
    element: { tag: 'a', attrs: {}, hrefProp: 'href', disabledState: 'disabled', blockClickProps: [] },
    anatomy: [base.anatomy.label],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: { ...base.props, ...base.literal, label: { ...base.literal.label, default: 'Link' }, href: { source: 'literal', type: 'string', default: '' } },
    tokens: { ...base.tokens, fromType: [...base.tokens.fromType, 'fg-hover', 'fg-pressed'] },
    tokenKinds: { ...base.tokenKinds, 'fg-hover': 'color', 'fg-pressed': 'color' },
    tokenRoles: { ...base.tokenRoles, fg: { ...TYPE_COLOURS, default: 'link' }, 'fg-hover': HOVER, 'fg-pressed': PRESSED },
    persistentStates: base.persistentStates,
    // Hover, focus and pressed change the text colour only (a preview state changes colour tokens).
    previewStates: { hover: { fg: 'fg-hover' }, focus: { fg: 'fg-hover' }, active: { fg: 'fg-pressed' } },
    statePseudo: { ...base.statePseudo, hover: ':hover', focus: ':focus-visible', active: ':active' },
    parts: [],
    playOnly: [
        { id: 'hover', reason: 'pointer state; the canvas shows the rest state and the Preview panel shows hover' },
        { id: 'focus', reason: 'keyboard focus; the canvas shows the rest state and the Preview panel shows focus' },
        { id: 'active', reason: 'pointer press; the canvas shows the rest state and the Preview panel shows active' },
    ],
    display: base.display,
    events: [],
};
