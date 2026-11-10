/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// Divider (antd Divider): a rule that splits content. Horizontal it is a line, or a line, a text and a line (the text sits at the start, the centre or the end);
// vertical it is one line and has no text. Every rule is a vector line node (`kind: 'line'`), so its stroke colour and width come from tokens and its dash from the Style
// mode (solid, dashed, dotted: the Variant style mechanism, written on the line layers). The text is a managed layer: made while Text is on, removed when it is off.
// Placement shortens one side: the side before the text is a short line at the start, the side after it at the end, and both fill equally at the centre; a short side is
// as long as its token, the other fills the rest of the row, so the root resizes cleanly. Plain swaps the text's typography (a marker state: it is written on the layer, not
// a state the instance is in), the Size mode sets the space around the divider (antd marginXS, margin, marginLG). Ant Design structure only.


const SIZE_MODES = ['small', 'middle', 'large'];

/** The rules draw the colour and the width of the line, whatever its length. */
const RULE = { stroke: 'lineColor', strokeWidth: 'lineWidth' };

/** @type {TemplateSchema} */
export const DIVIDER = {
    id: 'antd-divider',
    name: 'Divider',
    primarySlot: 'label',
    // A non-interactive element: no disabled state.
    element: { tag: 'div', attrs: { role: 'separator' }, blockClickProps: [] },
    anatomy: [
        { id: 'lineBefore', kind: 'line', axis: 'horizontal', fill: true, optional: true, managed: true, shownWhen: { all: [{ prop: 'isVertical', is: false }, { prop: 'shortBefore', is: false }] } },
        { id: 'lineBeforeShort', kind: 'line', axis: 'horizontal', optional: true, managed: true, shownWhen: { prop: 'shortBefore', is: true } },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'hasText', is: true }, { prop: 'label', empty: false }] } },
        { id: 'lineAfter', kind: 'line', axis: 'horizontal', fill: true, optional: true, managed: true, shownWhen: { all: [{ prop: 'hasText', is: true }, { prop: 'shortAfter', is: false }] } },
        { id: 'lineAfterShort', kind: 'line', axis: 'horizontal', optional: true, managed: true, shownWhen: { prop: 'shortAfter', is: true } },
        { id: 'lineVertical', kind: 'line', axis: 'vertical', optional: true, managed: true, shownWhen: { prop: 'isVertical', is: true } },
    ],
    icons: [],
    rootLayout: 'horizontal',
    rootAlign: 'center',
    rootPrimaryAlign: 'start',
    rootWidth: 343,
    props: {
        lineStyle: { source: 'variable', collection: 'Style', modes: ['solid', 'dashed', 'dotted'], defaultMode: 'solid', styles: { dashed: { borderStyle: 'dashed' }, dotted: { borderStyle: 'dotted' } } },
        size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: 'large' },
        orientation: { source: 'literal', type: 'enum', options: ['horizontal', 'vertical'], default: 'horizontal', control: 'segmented' },
        // The text props apply to a horizontal divider only: a vertical one has none, so they hide and resolve to their defaults (the text layer goes).
        hasText: { source: 'literal', type: 'boolean', default: false, visibleIf: { prop: 'orientation', is: 'horizontal' } },
        label: { source: 'literal', type: 'string', default: 'Text', node: { key: 'label', field: 'text' }, visibleIf: { all: [{ prop: 'orientation', is: 'horizontal' }, { prop: 'hasText', is: true }] }, remembered: true },
        placement: { source: 'literal', type: 'enum', options: ['start', 'center', 'end'], default: 'center', control: 'segmented', visibleIf: { all: [{ prop: 'orientation', is: 'horizontal' }, { prop: 'hasText', is: true }] } },
        plain: { source: 'literal', type: 'boolean', default: false, visibleIf: { all: [{ prop: 'orientation', is: 'horizontal' }, { prop: 'hasText', is: true }] } },
        // Read from the props above, never stored: which rules exist.
        isVertical: { source: 'literal', type: 'boolean', default: false, derived: { when: { prop: 'orientation', is: 'vertical' } } },
        shortBefore: { source: 'literal', type: 'boolean', default: false, derived: { when: { all: [{ prop: 'hasText', is: true }, { prop: 'placement', is: 'start' }] } } },
        shortAfter: { source: 'literal', type: 'boolean', default: false, derived: { when: { all: [{ prop: 'hasText', is: true }, { prop: 'placement', is: 'end' }] } } },
    },
    tokens: {
        fromLineStyle: ['lineColor', 'lineWidth'],
        fromSize: ['spaceY', 'textGap', 'shortLength', 'verticalLength', 'labelColor', 'labelTypography', 'plainTypography'],
    },
    tokenKinds: {
        lineColor: 'color', lineWidth: 'length', labelColor: 'color', labelTypography: 'typography', plainTypography: 'typography',
        spaceY: 'length', textGap: 'length', shortLength: 'length', verticalLength: 'length',
    },
    tokenRoles: {
        lineColor: 'border',
        lineWidth: 'border-width',
        // The space above and below the divider (antd margin: marginXS, margin, marginLG).
        spaceY: { small: 'divider-space-sm', middle: 'divider-space-md', large: 'divider-space-lg', default: 'divider-space-lg' },
        textGap: 'divider-space-md',
        shortLength: 'divider-short',
        verticalLength: 'divider-vertical-height',
        labelColor: 'fg',
        labelTypography: 'text-lg-strong',
        plainTypography: 'text-base',
    },
    // A marker: plain swaps the text's typography. It says a data attribute and swaps a token; it is never the state the instance is in.
    persistentStates: { plain: { prop: 'plain', tokens: { labelTypography: 'plainTypography' }, marker: true } },
    previewStates: {},
    statePseudo: { plain: '[data-plain]' },
    parts: [],
    playOnly: [],
    display: {
        root: { paddingY: 'spaceY', gap: 'textGap' },
        lineBefore: { ...RULE },
        lineBeforeShort: { ...RULE, width: 'shortLength' },
        label: { fill: 'labelColor', typography: 'labelTypography' },
        lineAfter: { ...RULE },
        lineAfterShort: { ...RULE, width: 'shortLength' },
        lineVertical: { ...RULE, height: 'verticalLength' },
    },
    events: [],
};
