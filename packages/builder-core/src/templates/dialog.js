import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder, spaceLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Dialog (antd Modal structure): a box of a header (the title and a close icon), a body (the description) and a footer (the buttons, in a slot).
// Size is the five Midas steps (padding, gap, icon, typography). The close and the footer are layers made while their props are on, never hidden.
// Opening and closing it is the Prototype's (Fase 2), not this template's. Ant Design structure only.

/** The close is a quiet icon that darkens on hover (Play and the export only). */
const CLOSE_TOKENS = { colour: 'fgSecondary', disabledColour: 'fgSecondary', size: 'closeSize', hoverColour: 'fg' };

/** @type {TemplateSchema} */
export const DIALOG = {
    id: 'antd-dialog',
    name: 'Dialog',
    primarySlot: 'title',
    sampleProps: { title: 'Dialog title' },
    // A container of its own: no disabled state. Its role is the dialog landmark.
    element: { tag: 'div', attrs: { role: 'dialog' }, blockClickProps: [] },
    anatomy: [
        { id: 'header', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', fill: true },
        { id: 'title', name: 'Title', kind: 'text', parent: 'header', optional: true, fill: true, managed: true, typography: 'title', shownWhen: { prop: 'title', empty: false } },
        // The close is an icon in a box of its own: the dismiss press takes the box out.
        { id: 'closer', kind: 'frame', parent: 'header', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: { prop: 'closable', is: true } },
        { id: 'close', kind: 'icon', parent: 'closer', optional: true, managed: true },
        { id: 'body', kind: 'frame', layout: 'vertical', primaryAlign: 'start', counterAlign: 'start', fill: true, managed: true, shownWhen: { prop: 'description', is: true } },
        { id: 'description', kind: 'text', parent: 'body', optional: true, fill: true, managed: true, typography: 'body', shownWhen: { prop: 'descriptionText', empty: false } },
        // The footer aligns its buttons to the end, the way antd's Modal does.
        { id: 'footer', kind: 'frame', layout: 'horizontal', primaryAlign: 'end', counterAlign: 'center', fill: true, managed: true, shownWhen: { prop: 'footer', is: true } },
        // The Footer slot: the box its buttons sit in, hugging them, so the gap between them is its own (Size).
        { id: 'footerBox', kind: 'frame', parent: 'footer', layout: 'horizontal', primaryAlign: 'end', counterAlign: 'center' },
    ],
    icons: [
        { show: 'closable', slot: 'close', component: 'closeIcon', role: 'close', tokens: CLOSE_TOKENS },
    ],
    rootLayout: 'vertical',
    rootAlign: 'start',
    rootPrimaryAlign: 'start',
    // 416 on the canvas: the width is the designer's, set once at bind (a node-owned width, like Input's).
    rootWidth: 416,
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        title: { source: 'literal', type: 'string', default: 'Dialog title', node: { key: 'title', field: 'text' } },
        closable: { source: 'literal', type: 'boolean', default: true },
        closeIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'closable', is: true }, remembered: true },
        // Escape takes the dialog out (Play: the first open dialog; the export: a key listener). The overlay's own outside click is the Prototype's.
        closeOnEsc: { source: 'literal', type: 'boolean', default: true },
        description: { source: 'literal', type: 'boolean', default: true },
        descriptionText: { source: 'literal', type: 'string', default: 'Dialog content goes here.', node: { key: 'description', field: 'text' }, visibleIf: { prop: 'description', is: true }, remembered: true },
        footer: { source: 'literal', type: 'boolean', default: true },
    },
    // The footer's buttons: a Button instance in the footer, seeded with one OK button at the dialog's size.
    slots: [{ id: 'footerContent', name: 'Footer', description: 'Buttons at the end of the footer', holds: 'instance', min: 0, max: 2, accepts: ['button'], onlyAccepts: true, showEmpty: true, layout: 'horizontal', box: 'footerBox', seed: [{ template: 'button', props: { label: 'OK' }, follow: { size: 'size' } }] }],
    tokens: {
        fromSize: ['bg', 'fg', 'fgSecondary', 'shadow', 'padding', 'gap', 'radius', 'iconSize', 'closeSize', 'titleTypography', 'bodyTypography'],
    },
    tokenKinds: {
        bg: 'color', fg: 'color', fgSecondary: 'color', shadow: 'effect',
        padding: 'length', gap: 'length', radius: 'length', iconSize: 'length', closeSize: 'length',
        titleTypography: 'typography', bodyTypography: 'typography',
    },
    // The metrics are the Size ladder (xs to xl): padding, gap, the close icon and the typography. Font and radius follow the same Midas steps as Card and Alert.
    tokenRoles: {
        bg: 'bg',
        fg: 'fg',
        fgSecondary: 'fg-secondary',
        shadow: 'shadow-float',
        padding: spaceLadder([16, 20, 24, 28, 32]),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        radius: roleLadder(['radius-xs', 'radius-sm', 'radius', 'radius-lg', 'radius-xl']),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        // The close is as big as the title's font size at each step (title: 12, 14, 14, 16, 20), so it reads as part of the title line.
        closeSize: roleLadder(['icon-sm', 'icon-md', 'icon-md', 'icon-lg', 'icon-xl']),
        titleTypography: roleLadder(['text-sm-strong', 'text-base-strong', 'text-base-strong', 'text-lg-strong', 'text-xl-strong']),
        bodyTypography: roleLadder(['text-xs', 'text-sm', 'text-sm', 'text-base', 'text-lg']),
    },
    persistentStates: {},
    previewStates: {},
    parts: [],
    playOnly: [],
    press: [{ slot: 'closer', dismiss: true }],
    dismissKey: { key: 'Escape', prop: 'closeOnEsc' },
    display: {
        root: { fill: 'bg', radius: 'radius', shadow: 'shadow', paddingX: 'padding', paddingY: 'padding', gap: 'gap' },
        header: { gap: 'gap' },
        // The gap between the footer's buttons is the Size step, as the header's is.
        footerBox: { gap: 'gap' },
        title: { fill: 'fg', typography: 'titleTypography' },
        description: { fill: 'fgSecondary', typography: 'bodyTypography' },
        close: { size: 'closeSize' },
    },
    events: [],
};
