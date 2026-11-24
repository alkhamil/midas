import { DEFAULT_SIZE_MODE, SIZE_MODES, roleLadder } from './size-modes.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Pagination (the Figma Pagination, from antd's Pagination): an optional Selection item (the rows-per-page Compact Select and the "Showing" text) and the
// Navigation (first, previous, the page numbers, next, last). Position (Start, Mid, End) picks which page numbers show: each position is its own set of
// layers, made only while its position holds (no hidden layer). The page numbers are the design's own, not a count: the current page is a fixed layer
// (filled with the current colour). First and previous are dimmed on Start, next and last on End. Size sets the cell, the icons, the text and the gaps.

/** The page numbers of each position, in order: `*` marks the current page, `…` an ellipsis (Figma's Start, Mid and End). */
const POSITION_PAGES = {
    start: ['1*', '2', '3', '4', '…', '10'],
    mid: ['1', '…', '4', '5*', '6', '…', '10'],
    end: ['1', '…', '7', '8', '9', '10*'],
};

/** The layers of one page cell: a frame (shown only at its position) holding its text, the text stays the design's. */
function pageLayers(position, entries) {
    return entries.flatMap((entry, k) => {
        const id = `${position}-${k}`;
        const label = entry.replace('*', '');
        const holder = { id, kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', parent: 'pages', managed: true, shownWhen: { prop: 'position', is: position } };
        const text = { id: `${id}-text`, kind: 'text', parent: id, managed: true, optional: true, typography: 'page', defaultText: label, shownWhen: { prop: 'position', is: position } };
        return [holder, text];
    });
}

/** The display of one page cell: the cell box, the current page's fill, the text's colour (the ellipsis is the secondary one). */
function pageDisplay(position, entries) {
    return Object.fromEntries(entries.flatMap((entry, k) => {
        const id = `${position}-${k}`;
        const current = entry.endsWith('*');
        const ellipsis = entry === '…';
        return [
            [id, { size: 'cell', radius: 'radius', ...(current ? { fill: 'page-current' } : {}) }],
            [`${id}-text`, { fill: current ? 'page-current-fg' : ellipsis ? 'fg-secondary' : 'fg', typography: 'pageTypography' }],
        ];
    }));
}

/** The hover of each page number (the ellipsis is not a number, so it takes none): the current page takes its own colour. */
const PAGE_PRESS = Object.entries(POSITION_PAGES).flatMap(([position, entries]) => entries.map((entry, k) => ({ entry, slot: `${position}-${k}` })))
    .filter(({ entry }) => entry !== '…')
    .map(({ entry, slot }) => ({ slot, hoverFill: entry.endsWith('*') ? 'page-current-hover' : 'page-hover' }));
const PAGE_ANATOMY = Object.entries(POSITION_PAGES).flatMap(([position, entries]) => pageLayers(position, entries));

/** @type {TemplateSchema} */
export const PAGINATION = {
    id: 'antd-pagination',
    name: 'Pagination',
    primarySlot: 'rowsText',
    sampleProps: { position: 'start', rowsText: 'Showing 1-10 of 100 results' },
    // A row of controls with no disabled state of its own: no disabled attribute, rule or guard.
    element: { tag: 'nav', attrs: { 'aria-label': 'Pagination' }, blockClickProps: [] },
    anatomy: [
        // The Selection item: the Compact Select (its value and chevron) and the "Showing" text. Its switch is the Show rows per page prop: off, none of it is a layer.
        { id: 'selection', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', fill: true, managed: true, shownWhen: { prop: 'showRowsPerPage', is: true } },
        { id: 'select', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center', parent: 'selection', managed: true, shownWhen: { prop: 'showRowsPerPage', is: true } },
        { id: 'selectValue', kind: 'text', parent: 'select', managed: true, optional: true, typography: 'text', defaultText: '10', shownWhen: { prop: 'showRowsPerPage', is: true } },
        { id: 'selectIcon', kind: 'icon', parent: 'select', managed: true, alwaysVisible: true },
        { id: 'rowsText', kind: 'text', parent: 'selection', managed: true, optional: true, typography: 'text', shownWhen: { prop: 'showRowsPerPage', is: true } },
        // The Navigation's groups sit in the root row (the root's gap is the 12px between them): a group holds its buttons, a button its icon.
        { id: 'navPrev', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
        { id: 'btnFirst', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', parent: 'navPrev' },
        { id: 'first', kind: 'icon', parent: 'btnFirst', managed: true, alwaysVisible: true },
        { id: 'btnPrev', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', parent: 'navPrev' },
        { id: 'prev', kind: 'icon', parent: 'btnPrev', managed: true, alwaysVisible: true },
        { id: 'pages', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
        ...PAGE_ANATOMY,
        { id: 'navNext', kind: 'frame', layout: 'horizontal', primaryAlign: 'start', counterAlign: 'center' },
        { id: 'btnNext', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', parent: 'navNext' },
        { id: 'next', kind: 'icon', parent: 'btnNext', managed: true, alwaysVisible: true },
        { id: 'btnLast', kind: 'frame', layout: 'horizontal', primaryAlign: 'center', counterAlign: 'center', parent: 'navNext' },
        { id: 'last', kind: 'icon', parent: 'btnLast', managed: true, alwaysVisible: true },
    ],
    icons: [
        { slot: 'selectIcon', component: 'selectIcon', label: 'Rows icon', role: 'chevronDown', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { slot: 'first', component: 'firstIcon', label: 'First icon', role: 'chevronsLeft', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { slot: 'prev', component: 'prevIcon', label: 'Previous icon', role: 'chevronLeft', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { slot: 'next', component: 'nextIcon', label: 'Next icon', role: 'chevronRight', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
        { slot: 'last', component: 'lastIcon', label: 'Last icon', role: 'chevronsRight', tokens: { colour: 'fg', disabledColour: 'fg-disabled', size: 'iconSize' } },
    ],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    // The Figma row is 1200 wide; the Selection item fills it, so the Navigation sits at its end.
    rootWidth: 1200,
    props: {
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true },
        // Start, Mid, End: the page numbers shown (and the arrows dimmed at the first or last page).
        position: { source: 'literal', type: 'enum', options: ['start', 'mid', 'end'], labels: { start: 'Start', mid: 'Mid', end: 'End' }, control: 'segmented', default: 'start' },
        // Show rows per page: the Selection item is a layer while on, and none while off.
        showRowsPerPage: { source: 'literal', type: 'boolean', default: true },
        // Derived (never in the panel): the row fills its width while the Selection item is on, and hugs its content while it is off.
        fillWidth: { source: 'literal', type: 'boolean', default: true, derived: { when: { prop: 'showRowsPerPage', is: true } }, node: { key: 'root', field: 'widthSizing', values: { true: 'fill', false: 'hug' } } },
        rowsText: { source: 'literal', type: 'string', default: 'Showing 1-10 of 100 results', node: { key: 'rowsText', field: 'text' }, visibleIf: { prop: 'showRowsPerPage', is: true }, remembered: true },
        // The icons: the role glyph until the designer picks another (as Icon Button's icon does).
        selectIcon: { source: 'literal', type: 'iconComponent', default: null },
        firstIcon: { source: 'literal', type: 'iconComponent', default: null },
        prevIcon: { source: 'literal', type: 'iconComponent', default: null },
        nextIcon: { source: 'literal', type: 'iconComponent', default: null },
        lastIcon: { source: 'literal', type: 'iconComponent', default: null },
        // Derived (never in the panel): the first and previous arrows are dimmed at the Start position, the next and last at the End one.
        atStart: { source: 'literal', type: 'boolean', default: false, derived: { when: { prop: 'position', is: 'start' } }, nodes: [{ key: 'btnFirst', field: 'opacity', values: { true: 0.4, false: 1 } }, { key: 'btnPrev', field: 'opacity', values: { true: 0.4, false: 1 } }] },
        atEnd: { source: 'literal', type: 'boolean', default: false, derived: { when: { prop: 'position', is: 'end' } }, nodes: [{ key: 'btnNext', field: 'opacity', values: { true: 0.4, false: 1 } }, { key: 'btnLast', field: 'opacity', values: { true: 0.4, false: 1 } }] },
    },
    tokens: {
        fromSize: ['cell', 'iconSize', 'radius', 'gap', 'gapSmall', 'paddingX', 'paddingY', 'borderWidth', 'textTypography', 'pageTypography', 'bg', 'fg', 'fg-secondary', 'fg-disabled', 'border', 'page-current', 'page-current-fg', 'page-hover', 'page-current-hover'],
    },
    tokenKinds: {
        cell: 'length', iconSize: 'length', radius: 'length', gap: 'length', gapSmall: 'length', paddingX: 'length', paddingY: 'length', borderWidth: 'length',
        textTypography: 'typography', pageTypography: 'typography',
        bg: 'color', fg: 'color', 'fg-secondary': 'color', 'fg-disabled': 'color', border: 'color', 'page-current': 'color', 'page-current-fg': 'color', 'page-hover': 'color', 'page-current-hover': 'color',
    },
    tokenRoles: {
        cell: roleLadder(['height-xs', 'height-sm', 'height', 'height-lg', 'height-xl']),
        iconSize: roleLadder(['icon-xs', 'icon-sm', 'icon-md', 'icon-lg', 'icon-xl']),
        radius: roleLadder(['radius-xs', 'radius-sm', 'radius', 'radius-lg', 'radius-xl']),
        gap: roleLadder(['gap-xs', 'gap-sm', 'gap', 'gap-lg', 'gap-xl']),
        gapSmall: roleLadder(['gap-xs', 'gap-xs', 'gap-xs', 'gap-sm', 'gap']),
        paddingX: roleLadder(['padding-x-xs', 'padding-x-sm', 'button-padding-x-md', 'button-padding-x-lg', 'button-padding-x-xl']),
        paddingY: roleLadder(['padding-y-xs', 'padding-y-sm', 'gap-lg', 'gap-lg', 'gap-xl']),
        borderWidth: 'border-width',
        textTypography: roleLadder(['text-xs', 'text-sm', 'text-base', 'text-base', 'text-lg']),
        pageTypography: roleLadder(['text-xs-medium', 'text-sm-medium', 'text-base-medium', 'text-base-medium', 'text-lg-medium']),
        bg: 'bg',
        fg: 'fg',
        'fg-disabled': 'fg-disabled',
        'fg-secondary': 'fg-secondary',
        border: 'border',
        'page-current': 'preset-primary-solid',
        'page-current-fg': 'bg',
        'page-hover': 'bg-subtle',
        'page-current-hover': 'preset-primary-text',
    },
    // The arrows dimmed at their end (Start for first and previous, End for next and last): a marker the arrows' hover and click follow.
    persistentStates: {
        atStart: { prop: 'atStart', tokens: {}, marker: true },
        atEnd: { prop: 'atEnd', tokens: {}, marker: true },
    },
    previewStates: {},
    statePseudo: { atStart: '[data-at-start]', atEnd: '[data-at-end]' },
    // Hover: each number and each arrow takes a fill on hover, except a dimmed arrow (blockedBy, which takes no hover and no click). The current page takes its own.
    press: [
        ...PAGE_PRESS,
        { slot: 'btnFirst', hoverFill: 'page-hover', blockedBy: 'atStart' },
        { slot: 'btnPrev', hoverFill: 'page-hover', blockedBy: 'atStart' },
        { slot: 'btnNext', hoverFill: 'page-hover', blockedBy: 'atEnd' },
        { slot: 'btnLast', hoverFill: 'page-hover', blockedBy: 'atEnd' },
    ],
    parts: [],
    playOnly: [],
    display: {
        root: { fill: 'bg', gap: 'gap', paddingX: 'paddingX', paddingY: 'paddingY' },
        selection: { gap: 'gap' },
        select: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY', gap: 'gapSmall' },
        selectValue: { fill: 'fg', typography: 'textTypography' },
        selectIcon: { size: 'iconSize' },
        rowsText: { fill: 'fg', typography: 'textTypography' },
                navPrev: { gap: 'gapSmall' },
        navNext: { gap: 'gapSmall' },
        pages: { gap: 'gapSmall' },
        btnFirst: { size: 'cell', radius: 'radius' },
        btnPrev: { size: 'cell', radius: 'radius' },
        btnNext: { size: 'cell', radius: 'radius' },
        btnLast: { size: 'cell', radius: 'radius' },
        first: { size: 'iconSize' },
        prev: { size: 'iconSize' },
        next: { size: 'iconSize' },
        last: { size: 'iconSize' },
        ...pageDisplay('start', POSITION_PAGES.start),
        ...pageDisplay('mid', POSITION_PAGES.mid),
        ...pageDisplay('end', POSITION_PAGES.end),
    },
    events: [],
};
