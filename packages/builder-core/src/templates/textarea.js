import { INPUT } from './input.js';
import { inputFamily, CLEAR } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// TextArea: the Input as a box of wrapped text (antd Input.TextArea). Value, placeholder, status, variant, size, disabled, read only, limit and counter are Input's
// own. It has no sides and no clear icon here, and no fixed height: the box hugs its text and is at least `rows` lines tall (rows x line height + the padding, both tokens);
// autoSize swaps in a min and a max number of rows. The count sits bottom right, on its own line after the text. Resize is none or vertical.

/** What the Input has and a text area does not: the prefix and the suffix (text and icon), the clear icon, the fixed height and the icon size. */
const SIDES = { anatomy: ['prefixIcon', 'prefixText', 'suffixText', 'suffixIcon'], icons: ['prefixIcon', 'suffixIcon'], props: ['hasPrefix', 'prefixKind', 'prefixText', 'prefixIcon', 'hasSuffix', 'suffixKind', 'suffixText', 'suffixIcon'], tokens: ['addonTypography', 'iconSize', 'height'] };

/** @type {TemplateSchema} */
export const TEXTAREA = inputFamily({
    id: 'textarea',
    name: 'TextArea',
    sampleProps: { placeholder: 'Enter text' },
    dropped: {
        anatomy: [...CLEAR.anatomy, ...SIDES.anatomy],
        icons: [...CLEAR.icons, ...SIDES.icons],
        props: [...CLEAR.props, ...SIDES.props],
        tokens: [...CLEAR.tokens, ...SIDES.tokens],
        playOnly: CLEAR.playOnly,
    },
    added: {
        isControl: true,
        // The counter closes the box: a line of its own, filling the width, right aligned.
        anatomyPatch: { count: { fill: true, align: 'right' } },
        props: {
            rows: { source: 'literal', type: 'number', default: 3 },
            autoSize: { source: 'literal', type: 'boolean', default: false },
            minRows: { source: 'literal', type: 'number', default: null, atMost: 'maxRows', visibleIf: { prop: 'autoSize', is: true } },
            maxRows: { source: 'literal', type: 'number', default: null, visibleIf: { prop: 'autoSize', is: true } },
            resize: { source: 'literal', type: 'enum', options: ['none', 'vertical'], default: 'none', control: 'segmented' },
        },
        control: { ...INPUT.control, multiline: { rows: 'rows', autoSize: 'autoSize', minRows: 'minRows', maxRows: 'maxRows', resize: 'resize' } },
        // The box is a column that hugs its height: the text fills its width and wraps.
        rootLayout: 'vertical',
        rootAlign: 'start',
    },
});
