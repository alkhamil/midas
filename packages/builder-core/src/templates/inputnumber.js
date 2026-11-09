import { INPUT_BASE as INPUT } from './input-base.js';
import { inputFamily, CLEAR, COUNT } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// InputNumber: the Input for numbers (antd InputNumber). min, max, step and precision are props. The input fills the width. While `controls` is on and its position is right, a handler
// column is pinned to the right edge (out of the flow, so it never adds height: the control is as tall as an Input of the same Size): the full height inside the border, a small control
// wide, a one pixel divider on its inline-start side, and two halves of 50% each split by a one pixel divider, a small Solar chevron centred in each, the outer right corners rounded to
// the radius. The column is a container of the anatomy holding the two halves (containers nest one level), each holding its chevron; there is no icon to pick. An arrow whose limit
// the value has reached takes the disabled arrow colour and its half takes no click (a colour token, never a hidden layer). The canvas always draws the column, static. Play and the
// export reveal it on hover and focus (`reveal`, antd's 0.2s), colour a chevron on the hover and press of its half, and never reveal it on a disabled control. A click on a half in Play
// steps the value by `step` within the limits and a blur commits the typed text as a number (or restores the last committed value); the export reports the press (`onStep`) and the
// commit (`onCommit`). The clear icon and the counter are out of scope.

/** The column is there: `noStepper` is read from the two props, so the stylesheet, the containers and the glyphs follow one switch. */
const CONTROLS_ON = { prop: 'noStepper', is: false };
/** A half: it fills its share of the column and centres its chevron on both axes. */
const HALF = { kind: 'frame', layout: 'vertical', primaryAlign: 'center', counterAlign: 'center', fill: true, fillV: true, parent: 'stepper', managed: true, shownWhen: CONTROLS_ON };

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
    },
    added: {
        isControl: true,
        anatomy: [
            { id: 'stepper', kind: 'frame', layout: 'vertical', counterAlign: 'center', edge: 'right', strokeSides: 'left', managed: true, shownWhen: CONTROLS_ON },
            { id: 'stepUpBox', ...HALF, primaryAlign: 'center' },
            { id: 'stepUp', kind: 'glyph', glyph: 'chevronUp', parent: 'stepUpBox', optional: true, managed: true, shownWhen: CONTROLS_ON },
            // The divider between the halves is the border on top of the lower half.
            { id: 'stepDownBox', ...HALF, strokeSides: 'top' },
            { id: 'stepDown', kind: 'glyph', glyph: 'chevronDown', parent: 'stepDownBox', optional: true, managed: true, shownWhen: CONTROLS_ON },
        ],
        props: {
            min: { source: 'literal', type: 'number', decimal: true, default: null, atMost: 'max' },
            max: { source: 'literal', type: 'number', decimal: true, default: null },
            step: { source: 'literal', type: 'number', decimal: true, default: 1 },
            precision: { source: 'literal', type: 'number', default: null },
            controls: { source: 'literal', type: 'boolean', default: true },
            controlsPosition: { source: 'literal', type: 'enum', options: ['right', 'none'], default: 'right', control: 'segmented', visibleIf: { prop: 'controls', is: true } },
            // True while there is no column: read from the two props above (never stored), so one switch drives the layers.
            noStepper: { source: 'literal', type: 'boolean', default: false, derived: { when: { any: [{ prop: 'controls', is: false }, { prop: 'controlsPosition', is: 'none' }] } } },
            // True while the value has reached a limit: it recolours the arrow and mutes its half, and is read from the value, never stored.
            atMin: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'min', cmp: 'lte' } },
            atMax: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'max', cmp: 'gte' } },
        },
        // The chevrons are small (one clear-icon step below the Size), the column is a small control wide, the dividers a border thick. The arrows rest in the secondary text colour (antd
        // tertiary is not a base role) so the disabled arrow colour reads as different; a hovered half takes the brand colour, a pressed one its active colour.
        tokens: { fromSize: ['stepIconSize', 'stepWidth'], fromVariant: ['step-up-fg', 'step-down-fg', 'step-fg-disabled', 'step-hover-fg', 'step-active-fg', 'step-border', 'step-bg'] },
        tokenKinds: {
            stepIconSize: 'length', stepWidth: 'length',
            'step-up-fg': 'color', 'step-down-fg': 'color', 'step-fg-disabled': 'color', 'step-hover-fg': 'color', 'step-active-fg': 'color', 'step-border': 'color', 'step-bg': 'color',
        },
        tokenRoles: {
            stepIconSize: { xs: 'gap-sm', sm: 'clear-icon-xs', md: 'clear-icon-sm', lg: 'clear-icon-md', xl: 'clear-icon-lg', default: 'clear-icon-sm' },
            stepWidth: 'height-sm',
            'step-up-fg': 'clear-hover', 'step-down-fg': 'clear-hover', 'step-fg-disabled': 'fg-disabled', 'step-hover-fg': 'brand', 'step-active-fg': 'brand-active', 'step-border': 'border', 'step-bg': 'transparent',
        },
        display: {
            stepper: { fill: 'step-bg', radiusEnd: 'radius', width: 'stepWidth', stroke: 'step-border', strokeWidth: 'borderWidth' },
            stepDownBox: { stroke: 'step-border', strokeWidth: 'borderWidth' },
            stepUp: { fill: 'step-up-fg', size: 'stepIconSize' },
            stepDown: { fill: 'step-down-fg', size: 'stepIconSize' },
        },
        // A limit recolours its arrow; disabled recolours both and is declared last, so it wins. `noStepper` is a marker: it only says a data attribute the containers follow.
        persistentStates: {
            noStepper: { prop: 'noStepper', tokens: {}, marker: true },
            atMin: { prop: 'atMin', tokens: { 'step-down-fg': 'step-fg-disabled' } },
            atMax: { prop: 'atMax', tokens: { 'step-up-fg': 'step-fg-disabled' } },
            disabled: { prop: 'disabled', tokens: { ...INPUT.persistentStates.disabled.tokens, 'step-up-fg': 'step-fg-disabled', 'step-down-fg': 'step-fg-disabled' } },
        },
        statePseudo: { noStepper: '[data-no-stepper]', atMin: '[data-at-min]', atMax: '[data-at-max]' },
        control: { ...Object.fromEntries(Object.entries(INPUT.control).filter(([k]) => !['count', 'maxlength', 'minlength'].includes(k))), number: { min: 'min', max: 'max', step: 'step', precision: 'precision' } },
        // A click on a half steps; the half is muted and takes no click at its limit, and colours its chevron on hover and press.
        press: [
            { slot: 'stepUpBox', step: 1, glyph: 'stepUp', hoverFill: 'step-hover-fg', activeFill: 'step-active-fg', blockedBy: 'atMax' },
            { slot: 'stepDownBox', step: -1, glyph: 'stepDown', hoverFill: 'step-hover-fg', activeFill: 'step-active-fg', blockedBy: 'atMin' },
        ],
        // antd shows the handler column on hover and focus only (opacity over motionDurationMid); Play and the export do the same, the canvas draws it always.
        reveal: { slot: 'stepper', duration: '0.2s' },
    },
});
