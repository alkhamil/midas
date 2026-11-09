import { INPUT_BASE as INPUT } from './input-base.js';
import { inputFamily, CLEAR, COUNT } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// InputNumber: the Input for numbers (antd InputNumber). min, max, step and precision are props; a handler column sits attached to the right edge while `controls` is on and its
// position is right: two small chevrons stacked in a column the width of a small control, split by a one pixel divider, rounded at the outer corners only. It is a container of the
// anatomy holding three built-in glyphs (stepUp, stepDivider, stepDown), made with it and removed with it; there is no icon to pick. While it is there the root keeps no padding on
// its end side (the token is none, and a state gives it back without the column), so the column touches the border. An arrow whose limit the value has reached takes the disabled arrow colour (a colour token, never a
// hidden layer). The canvas always draws the column; Play and the export reveal it on hover and focus (`reveal`, antd's 0.2s), never on a disabled control. A click on an arrow in
// Play steps the value by `step` within the limits and a blur commits the typed text as a number (or restores the last committed value); the export reports the press (`onStep`)
// and the commit (`onCommit`). The clear icon and the counter are out of scope.

const STEPPER_SHOWN = { all: [{ prop: 'controls', is: true }, { prop: 'controlsPosition', is: 'right' }] };
/** The column is there: `noStepper` is read from the two props, so the stylesheet, the glyphs and the end padding follow one switch. */
const CONTROLS_ON = { prop: 'noStepper', is: false };

/** @type {TemplateSchema} */
export const INPUTNUMBER = inputFamily({
    id: 'inputnumber',
    name: 'InputNumber',
    sampleProps: { placeholder: 'Enter number' },
    dropped: {
        anatomy: [...CLEAR.anatomy, ...COUNT.anatomy],
        icons: CLEAR.icons,
        props: [...CLEAR.props, ...COUNT.props, 'maxLength', 'minLength'],
        tokens: [...CLEAR.tokens.filter(t => t !== 'clearIconSize'), ...COUNT.tokens],
        playOnly: CLEAR.playOnly,
        // The root's two sides are set apart: the end side loses its padding while the handler column is attached.
        display: { root: ['paddingX'] },
    },
    added: {
        isControl: true,
        anatomy: [
            { id: 'stepper', kind: 'frame', layout: 'vertical', primaryAlign: 'center', counterAlign: 'center', fillV: true, managed: true, shownWhen: CONTROLS_ON },
            { id: 'stepUp', kind: 'glyph', glyph: 'chevronUp', parent: 'stepper', optional: true, managed: true, shownWhen: CONTROLS_ON },
            // The divider is the square glyph stretched to the column's width and a line's thickness.
            { id: 'stepDivider', kind: 'glyph', glyph: 'dash', parent: 'stepper', optional: true, managed: true, shownWhen: CONTROLS_ON },
            { id: 'stepDown', kind: 'glyph', glyph: 'chevronDown', parent: 'stepper', optional: true, managed: true, shownWhen: CONTROLS_ON },
        ],
        props: {
            min: { source: 'literal', type: 'number', decimal: true, default: null, atMost: 'max' },
            max: { source: 'literal', type: 'number', decimal: true, default: null },
            step: { source: 'literal', type: 'number', decimal: true, default: 1 },
            precision: { source: 'literal', type: 'number', default: null },
            controls: { source: 'literal', type: 'boolean', default: true },
            controlsPosition: { source: 'literal', type: 'enum', options: ['right', 'none'], default: 'right', control: 'segmented', visibleIf: { prop: 'controls', is: true } },
            // True while the value has reached a limit: it recolours the arrow, and is read from the value, never stored.
            noStepper: { source: 'literal', type: 'boolean', default: false, derived: { when: { any: [{ prop: 'controls', is: false }, { prop: 'controlsPosition', is: 'none' }] } } },
            atMin: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'min', cmp: 'lte' } },
            atMax: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'max', cmp: 'gte' } },
        },
        // The arrows are small (one clear-icon step below the Size), the column is a small control wide, the divider a border thick; the end padding is the side padding, or none while
        // the column is attached (the Button's zero vertical padding is the zero length of the base data).
        tokens: { fromSize: ['paddingEnd', 'paddingEndSide', 'stepIconSize', 'stepWidth', 'stepGap'], fromVariant: ['step-up-fg', 'step-down-fg', 'step-fg-disabled', 'step-border', 'step-bg'] },
        tokenKinds: {
            paddingEnd: 'length', paddingEndSide: 'length', stepIconSize: 'length', stepWidth: 'length', stepGap: 'length',
            'step-up-fg': 'color', 'step-down-fg': 'color', 'step-fg-disabled': 'color', 'step-border': 'color', 'step-bg': 'color',
        },
        tokenRoles: {
            // None while the column is attached (the Button's zero vertical padding is the base data's zero length); the side padding without it.
            paddingEnd: 'button-padding-y-md',
            paddingEndSide: INPUT.tokenRoles.paddingX,
            stepIconSize: { xs: 'clear-icon-xs', sm: 'clear-icon-xs', md: 'clear-icon-sm', lg: 'clear-icon-md', xl: 'clear-icon-lg', default: 'clear-icon-sm' },
            stepWidth: 'height-sm',
            stepGap: 'gap-xs',
            // The arrows rest in the secondary text colour (antd tertiary is not a base role), so the disabled arrow colour reads as different.
            'step-up-fg': 'clear-hover', 'step-down-fg': 'clear-hover', 'step-fg-disabled': 'fg-disabled', 'step-border': 'border', 'step-bg': 'transparent',
        },
        display: {
            root: { paddingStart: 'paddingX', paddingEnd: 'paddingEnd' },
            stepper: { fill: 'step-bg', radiusEnd: 'radius', width: 'stepWidth', gap: 'stepGap' },
            stepUp: { fill: 'step-up-fg', size: 'stepIconSize' },
            stepDown: { fill: 'step-down-fg', size: 'stepIconSize' },
            stepDivider: { fill: 'step-border', width: 'stepWidth', height: 'borderWidth' },
        },
        // A limit recolours its arrow; disabled recolours both and is declared last, so it wins. `noStepper` is a marker (it is never the state the instance is in) that gives the end
        // padding back when there is no column to attach.
        persistentStates: {
            noStepper: { prop: 'noStepper', tokens: { paddingEnd: 'paddingEndSide' }, marker: true },
            atMin: { prop: 'atMin', tokens: { 'step-down-fg': 'step-fg-disabled' } },
            atMax: { prop: 'atMax', tokens: { 'step-up-fg': 'step-fg-disabled' } },
            disabled: { prop: 'disabled', tokens: { ...INPUT.persistentStates.disabled.tokens, 'step-up-fg': 'step-fg-disabled', 'step-down-fg': 'step-fg-disabled' } },
        },
        statePseudo: { noStepper: '[data-no-stepper]', atMin: '[data-at-min]', atMax: '[data-at-max]' },
        control: { ...Object.fromEntries(Object.entries(INPUT.control).filter(([k]) => !['count', 'maxlength', 'minlength'].includes(k))), number: { min: 'min', max: 'max', step: 'step', precision: 'precision' } },
        press: [{ slot: 'stepUp', step: 1 }, { slot: 'stepDown', step: -1 }],
        // antd shows the handler column on hover and focus only (opacity over motionDurationMid); Play and the export do the same, the canvas draws it always.
        reveal: { slot: 'stepper', duration: '0.2s' },
    },
});
