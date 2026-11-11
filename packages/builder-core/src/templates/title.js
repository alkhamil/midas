import { TITLE_LEVELS, typographyBase } from './typography-base.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Title (antd Typography.Title): a heading. Level (h1 to h5) picks its heading style, and its element: an h1 to an h5 (the element follows the Level mode, matched by the mode's
// name). Type picks the colour. Headings are heavy already, so there is no strong. The rest is the Typography base's: italic, underline, strikethrough, code, mark, disabled.

const base = typographyBase({ dimension: 'level' });

/** @type {TemplateSchema} */
export const TITLE = {
    id: 'antd-title',
    name: 'Title',
    primarySlot: 'label',
    sampleProps: { label: 'Title' },
    // The tag is the level's own heading element; a heading has no disabled attribute, so disabled is aria-disabled.
    element: { tag: 'h1', tagBy: { prop: 'level', tags: Object.fromEntries(TITLE_LEVELS.map(level => [level, level])) }, attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [base.anatomy.label],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    props: { ...base.props, ...base.literal, label: { ...base.literal.label, default: 'Title' } },
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
