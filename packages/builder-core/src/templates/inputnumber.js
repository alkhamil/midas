import { INPUT_BASE as INPUT } from './input-base.js';
import { inputFamily, CLEAR, COUNT } from './input-family.js';

/** @typedef {import('./schema.js').TemplateSchema} TemplateSchema */

// InputNumber: the Input for numbers (antd InputNumber). min, max, step and precision are props; a stepper of two stacked arrows sits at the end of the box while
// `controls` is on and its position is right. The stepper is a container of the anatomy holding two built-in glyphs (stepUp, stepDown), made with it and removed with it;
// there is no icon to pick. An arrow whose limit the value has reached takes the disabled arrow colour (a colour token, never a hidden layer). A click on an arrow in Play steps
// the value by `step` within the limits; the export reports the press (`onStep`). The clear icon and the counter are out of scope.
// The arrows follow the container: they are made only while its whole condition holds (see holderAllows), though they name just `controls` (a glyph is shown by on/off states).
// The arrows rest in the secondary text colour (antd tertiary is not a base role), so the disabled arrow colour reads as different.
// antd shows the stepper only on hover; a hover-only layer would be a hidden one, so the stepper is always drawn while controls is on.

const STEPPER_SHOWN = { all: [{ prop: 'controls', is: true }, { prop: 'controlsPosition', is: 'right' }] };

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
            { id: 'stepper', kind: 'frame', layout: 'vertical', primaryAlign: 'center', counterAlign: 'center', managed: true, shownWhen: STEPPER_SHOWN },
            { id: 'stepUp', kind: 'glyph', glyph: 'chevronUp', parent: 'stepper', optional: true, managed: true, shownWhen: { prop: 'controls', is: true } },
            { id: 'stepDown', kind: 'glyph', glyph: 'chevronDown', parent: 'stepper', optional: true, managed: true, shownWhen: { prop: 'controls', is: true } },
        ],
        props: {
            min: { source: 'literal', type: 'number', decimal: true, default: null, atMost: 'max' },
            max: { source: 'literal', type: 'number', decimal: true, default: null },
            step: { source: 'literal', type: 'number', decimal: true, default: 1 },
            precision: { source: 'literal', type: 'number', default: null },
            controls: { source: 'literal', type: 'boolean', default: true },
            controlsPosition: { source: 'literal', type: 'enum', options: ['right', 'none'], default: 'right', control: 'segmented', visibleIf: { prop: 'controls', is: true } },
            // True while the value has reached a limit: it recolours the arrow, and is read from the value, never stored.
            atMin: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'min', cmp: 'lte' } },
            atMax: { source: 'literal', type: 'boolean', default: false, derived: { value: 'value', limit: 'max', cmp: 'gte' } },
        },
        // The arrows are drawn at the clear icon's size (the icon size minus 2), so two of them stack inside the box.
        tokens: { fromSize: ['stepIconSize'], fromVariant: ['step-up-fg', 'step-down-fg', 'step-fg-disabled'] },
        tokenKinds: { stepIconSize: 'length', 'step-up-fg': 'color', 'step-down-fg': 'color', 'step-fg-disabled': 'color' },
        tokenRoles: {
            stepIconSize: { xs: 'clear-icon-xs', sm: 'clear-icon-sm', md: 'clear-icon-md', lg: 'clear-icon-lg', xl: 'clear-icon-xl', default: 'clear-icon-md' },
            'step-up-fg': 'clear-hover', 'step-down-fg': 'clear-hover', 'step-fg-disabled': 'fg-disabled',
        },
        display: { stepUp: { fill: 'step-up-fg', size: 'stepIconSize' }, stepDown: { fill: 'step-down-fg', size: 'stepIconSize' } },
        // A limit recolours its arrow; disabled recolours both and is declared last, so it wins.
        persistentStates: {
            controls: { prop: 'controls', tokens: {}, marker: true },
            atMin: { prop: 'atMin', tokens: { 'step-down-fg': 'step-fg-disabled' } },
            atMax: { prop: 'atMax', tokens: { 'step-up-fg': 'step-fg-disabled' } },
            disabled: { prop: 'disabled', tokens: { ...INPUT.persistentStates.disabled.tokens, 'step-up-fg': 'step-fg-disabled', 'step-down-fg': 'step-fg-disabled' } },
        },
        statePseudo: { controls: '[data-controls]', atMin: '[data-at-min]', atMax: '[data-at-max]' },
        control: { ...Object.fromEntries(Object.entries(INPUT.control).filter(([k]) => !['count', 'maxlength', 'minlength'].includes(k))), number: { min: 'min', max: 'max', step: 'step', precision: 'precision' } },
        press: [{ slot: 'stepUp', step: 1 }, { slot: 'stepDown', step: -1 }],
    },
});
