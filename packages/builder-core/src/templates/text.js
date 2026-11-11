import { typographyBase } from './typography-base.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Text (antd Typography.Text): a run of text. Type picks its colour (default, secondary, success, warning, danger) and Size its text style; strong swaps the style for
// its strong one. Italic and the decoration lines (underline, strikethrough) are node fields of the text layer. Code and mark style the root frame itself, with no extra
// layer: code gives it a fill, a border, a padding and a radius (each a token a state swaps in), mark gives it the highlight fill. Disabled takes the disabled colour.
// The label is a managed text layer: made while the text is not empty, removed when it is. The shared pieces are the Typography base's (typography-base.js).

const base = typographyBase({ dimension: 'size' });

/** @type {TemplateSchema} */
export const TEXT = {
    id: 'antd-text',
    name: 'Text',
    primarySlot: 'label',
    sampleProps: { label: 'Text' },
    // A non-interactive span: it has no disabled attribute, so disabled is aria-disabled.
    element: { tag: 'span', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [base.anatomy.label],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: { ...base.props, ...base.literal },
    tokens: base.tokens,
    tokenKinds: base.tokenKinds,
    tokenRoles: base.tokenRoles,
    persistentStates: base.persistentStates,
    previewStates: {},
    statePseudo: base.statePseudo,
    parts: [],
    playOnly: [],
    display: base.display,
    events: [],
};
