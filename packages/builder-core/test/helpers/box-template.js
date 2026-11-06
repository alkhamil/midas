// A form-control-like schema for the engine tests of the box group, the attribute states and the parented icon slot. It is a trimmed Checkbox: a box
// (a group frame that draws the border) holding one managed icon, a managed label, and checked / disabled states that swap token variables. The real
// templates are registered separately; the engine tests must not depend on them.
import { TEMPLATES, createTemplateRegistry } from '../../src/behavior-engine/registry.js';
import { applyBasePlan, planFromSnapshot } from '../../src/base-tokens/importer.js';
import { BASE_SNAPSHOT } from '../../src/index.js';
import { applyTemplateToFrame, instanceOf, masterLayersByKey } from '../../src/behavior-engine/template-master.js';
import { planAutoFix, applyAutoFix } from '../../src/behavior-engine/auto-fix.js';
import { planBindTokens, applyBindTokens } from '../../src/behavior-engine/bind-tokens.js';
import { setMasterTemplate } from '../../src/behavior-engine/panel.js';

const ICON = { colour: 'check-fg', disabledColour: 'glyph-fg-disabled', size: 'indicatorSize' };

/** @type {import('../../src/templates/schema.js').TemplateSchema} */
export const BOXY = {
    id: 'boxy',
    name: 'Boxy',
    isControl: true,
    primarySlot: 'label',
    element: { tag: 'label', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [
        { id: 'box', kind: 'frame', layout: 'horizontal' },
        { id: 'check', kind: 'icon', optional: true, managed: true, parent: 'box' },
        { id: 'label', kind: 'text', optional: true, managed: true, typography: 'label', shownWhen: { all: [{ prop: 'hasLabel', is: true }, { prop: 'label', empty: false }] } },
    ],
    icons: [{ show: 'checked', slot: 'check', component: 'checkIcon', label: 'Check icon', tokens: ICON }],
    props: {
        variant: { source: 'variable', collection: 'Variant', modes: ['default'], defaultMode: 'default' },
        checked: { source: 'literal', type: 'boolean', default: false },
        checkIcon: { source: 'literal', type: 'iconComponent', default: null, visibleIf: { prop: 'checked', is: true }, remembered: true },
        hasLabel: { source: 'literal', type: 'boolean', default: true },
        label: { source: 'literal', type: 'string', default: 'Boxy', node: { key: 'label', field: 'text' }, visibleIf: { prop: 'hasLabel', is: true }, remembered: true },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromVariant: ['box-bg', 'box-border', 'box-bg-checked', 'box-border-checked', 'box-bg-disabled', 'box-border-disabled', 'boxSize', 'boxRadius', 'borderWidth', 'indicatorSize', 'gap', 'labelTypography', 'check-fg', 'glyph-fg-disabled', 'fg', 'fg-disabled'] },
    tokenKinds: {
        'box-bg': 'color', 'box-border': 'color', 'box-bg-checked': 'color', 'box-border-checked': 'color', 'box-bg-disabled': 'color', 'box-border-disabled': 'color',
        boxSize: 'length', boxRadius: 'length', borderWidth: 'length', indicatorSize: 'length', gap: 'length', labelTypography: 'typography',
        'check-fg': 'color', 'glyph-fg-disabled': 'color', fg: 'color', 'fg-disabled': 'color',
    },
    tokenRoles: {
        'box-bg': 'bg', 'box-border': 'border', 'box-bg-checked': 'brand', 'box-border-checked': 'brand', 'box-bg-disabled': 'bg-disabled', 'box-border-disabled': 'border',
        boxSize: 'box-size', boxRadius: 'radius-sm', borderWidth: 'border-width', indicatorSize: 'indicator-size', gap: 'gap', labelTypography: 'text-base',
        'check-fg': 'bg', 'glyph-fg-disabled': 'fg-disabled', fg: 'fg', 'fg-disabled': 'fg-disabled',
    },
    // Checked swaps the box colours; disabled is declared last, so it wins over checked.
    persistentStates: {
        checked: { prop: 'checked', tokens: { 'box-bg': 'box-bg-checked', 'box-border': 'box-border-checked' } },
        disabled: { prop: 'disabled', tokens: { 'box-bg': 'box-bg-disabled', 'box-border': 'box-border-disabled', fg: 'fg-disabled' } },
    },
    previewStates: {},
    statePseudo: { checked: '[data-checked]', disabled: ':disabled' },
    parts: [],
    playOnly: [],
    display: {
        root: { gap: 'gap' },
        box: { fill: 'box-bg', stroke: 'box-border', strokeWidth: 'borderWidth', radius: 'boxRadius', size: 'boxSize' },
        check: { size: 'indicatorSize' },
        label: { fill: 'fg', typography: 'labelTypography' },
    },
    sampleProps: { label: 'Boxy label' },
    events: [],
};

let seq = 0;
export const uid = () => `b${++seq}`;

/** The variables, binding, master frame and created layers of a template over the bundled base, completed by Auto Fix (what Generate Design System does). */
export function modelFor(template) {
    if (!TEMPLATES.has(template.id)) TEMPLATES.set(template.id, createTemplateRegistry([template]).get(template.id));
    const variables = { collections: [], items: [] };
    applyBasePlan(variables, planFromSnapshot(BASE_SNAPSHOT), uid);
    const binding = setMasterTemplate(template.id, variables.collections);
    const frame = { id: `m-${template.id}`, name: template.name, type: 'frame', parentId: null, component: true, fills: [], x: 0, y: 0, w: 160, h: 32, behavior: binding };
    const out = applyTemplateToFrame(template, { frame, children: [], binding, variables, idOf: key => `${template.id}-${key}` });
    const layers = out.created;
    const layersOf = () => masterLayersByKey(template, frame, [frame, ...layers]);
    const fix = planAutoFix({ template, binding: frame.behavior, variables, layers: layersOf() });
    if (fix.fixable) applyAutoFix(variables, frame.behavior, fix, uid);
    applyBindTokens(layersOf(), planBindTokens({ template, binding: frame.behavior, layers: layersOf(), variables }).ops);
    return { template, variables, binding: frame.behavior, frame, created: layers };
}

export const instanceFor = (model, props) => instanceOf(model.template, model.frame, model.created, props, { id: key => `i-${key}-${++seq}` });
