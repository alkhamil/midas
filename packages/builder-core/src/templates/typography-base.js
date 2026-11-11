import { DEFAULT_SIZE_MODE, SIZE_MODES } from './size-modes.js';

// The Typography family (Text, Title, Paragraph, Link) is one base: the Type colours, the text style props (italic, underline, strikethrough, code, mark, disabled), the
// code and mark box, and the managed label. Each template is this base plus what it adds or swaps, never a copy (as inputFamily() is for the Input). Ant Design structure only.

/** The Type modes: the text colours antd's Typography takes. */
export const TEXT_TYPES = ['default', 'secondary', 'success', 'warning', 'danger'];

/** The Type colour roles, one per Type mode. */
export const TYPE_COLOURS = { default: 'fg', secondary: 'fg-secondary', success: 'success', warning: 'warning', danger: 'danger' };

/** The text style of each Size mode and its strong one (Typography is a composite variable: the Size mode holds it). */
export const TEXT_STYLES = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-xl', default: 'text-base' };
export const STRONG_STYLES = { xs: 'text-xs-strong', sm: 'text-sm-strong', md: 'text-base-strong', lg: 'text-lg-strong', xl: 'text-xl-strong', default: 'text-base-strong' };

/** The Level modes of a Title and the heading style of each. */
export const TITLE_LEVELS = ['h1', 'h2', 'h3', 'h4', 'h5'];
export const HEADING_STYLES = { h1: 'heading-1', h2: 'heading-2', h3: 'heading-3', h4: 'heading-4', h5: 'heading-5', default: 'heading-1' };

/**
 * The pieces every Typography template shares. `dimension` is how the text style is picked: `size` (the five Size modes, with a strong style) or `level` (a Title's heading levels,
 * which are heavy already: no strong).
 * @param {{ dimension: 'size' | 'level' }} options
 */
export function typographyBase({ dimension }) {
    const bySize = dimension === 'size';
    const group = bySize ? 'fromSize' : 'fromLevel';
    const props = {
        type: { source: 'variable', collection: 'Type', modes: TEXT_TYPES, defaultMode: 'default' },
        ...(bySize
            ? { size: { source: 'variable', collection: 'Size', modes: SIZE_MODES, defaultMode: DEFAULT_SIZE_MODE, standard: true } }
            : { level: { source: 'variable', collection: 'Level', modes: TITLE_LEVELS, defaultMode: 'h1' } }),
    };
    const literal = {
        label: { source: 'literal', type: 'string', default: 'Text', node: { key: 'label', field: 'text' } },
        ...(bySize ? { strong: { source: 'literal', type: 'boolean', default: false } } : {}),
        italic: { source: 'literal', type: 'boolean', default: false, node: { key: 'label', field: 'fontStyle' } },
        underline: { source: 'literal', type: 'boolean', default: false, node: { key: 'label', field: 'textDecoration', flag: 'underline' } },
        // antd calls this prop `delete`, which is a reserved word in the component the export writes as a parameter.
        strikethrough: { source: 'literal', type: 'boolean', default: false, node: { key: 'label', field: 'textDecoration', flag: 'line-through' } },
        code: { source: 'literal', type: 'boolean', default: false },
        mark: { source: 'literal', type: 'boolean', default: false },
        disabled: { source: 'literal', type: 'boolean', default: false },
    };
    return {
        anatomy: { label: { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { prop: 'label', empty: false } } },
        props,
        literal,
        tokens: {
            // The Type mode holds every colour, and the code span's box: its fill, border, padding and radius beside the plain ones the states swap.
            fromType: ['fg', 'fg-disabled', 'bg', 'bg-code', 'bg-mark', 'border', 'border-code', 'borderWidth', 'borderWidth-code', 'paddingX', 'paddingX-code', 'paddingY', 'paddingY-code', 'radius', 'radius-code'],
            [group]: bySize ? ['labelTypography', 'strongTypography'] : ['labelTypography'],
        },
        tokenKinds: {
            fg: 'color', 'fg-disabled': 'color', bg: 'color', 'bg-code': 'color', 'bg-mark': 'color', border: 'color', 'border-code': 'color',
            borderWidth: 'length', 'borderWidth-code': 'length', paddingX: 'length', 'paddingX-code': 'length', paddingY: 'length', 'paddingY-code': 'length', radius: 'length', 'radius-code': 'length',
            labelTypography: 'typography', ...(bySize ? { strongTypography: 'typography' } : {}),
        },
        tokenRoles: {
            fg: TYPE_COLOURS,
            'fg-disabled': 'fg-disabled',
            bg: 'transparent',
            'bg-code': 'code-bg',
            'bg-mark': 'mark-bg',
            border: 'transparent',
            'border-code': 'border',
            borderWidth: 'border-width-none',
            'borderWidth-code': 'border-width',
            paddingX: 'padding-none',
            'paddingX-code': 'text-code-padding',
            paddingY: 'padding-none',
            'paddingY-code': 'text-code-padding-y',
            radius: 'radius-none',
            'radius-code': 'radius-sm',
            labelTypography: bySize ? TEXT_STYLES : HEADING_STYLES,
            ...(bySize ? { strongTypography: STRONG_STYLES } : {}),
        },
        // Markers say a data attribute and swap tokens; none is the state the instance is in. The last declared that is on wins a shared token (mark's fill over code's),
        // and disabled is declared last so its colour wins.
        persistentStates: {
            code: { prop: 'code', tokens: { bg: 'bg-code', border: 'border-code', borderWidth: 'borderWidth-code', paddingX: 'paddingX-code', paddingY: 'paddingY-code', radius: 'radius-code' }, marker: true },
            mark: { prop: 'mark', tokens: { bg: 'bg-mark' }, marker: true },
            ...(bySize ? { strong: { prop: 'strong', tokens: { labelTypography: 'strongTypography' }, marker: true } } : {}),
            disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } },
        },
        statePseudo: { code: '[data-code]', mark: '[data-mark]', ...(bySize ? { strong: '[data-strong]' } : {}), disabled: ':disabled' },
        display: {
            root: { fill: 'bg', stroke: 'border', strokeWidth: 'borderWidth', radius: 'radius', paddingX: 'paddingX', paddingY: 'paddingY' },
            label: { fill: 'fg', typography: 'labelTypography' },
        },
    };
}
