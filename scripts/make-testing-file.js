// Builds testing.midas: a Button component with its variables, plus test instances.
// Run `node scripts/make-testing-file.js`, then open testing.midas with Import file
// on the home screen. The build fails if the document has diagnostics errors.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';
import { iconSlotBindings, iconSlotTargets } from '../packages/builder-core/src/behavior-engine/icon-slot.js';
import { BUTTON } from '../packages/builder-core/src/templates/button.js';
import { INPUT } from '../packages/builder-core/src/templates/input.js';
import { assertBehaviorData } from '../packages/builder-core/src/behavior-engine/document-check.js';
import { diagnoseDocument } from '../packages/builder-core/src/behavior-engine/diagnostics.js';
import { buttonModel } from './button-model.mjs';
import { inputModel } from './input-model.mjs';

const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity: 1, visible: true }]);

const here = dirname(fileURLToPath(import.meta.url));
export const TESTING_PATH = resolve(here, '../testing.midas');

const COMMON = {
    rotation: 0, fills: solid('#0058CA'), stroke: '#000000',
    strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0,
};
const TEXT = {
    text: 'Type something', fontFamily: 'Inter', fontSize: 24, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.35,
    letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', fills: solid('#20202a'), w: 240, h: 44,
};
const FRAME = { fills: solid('#ffffff'), w: 400, h: 300, clip: true };

/** A node as the editor stores it. */
function node(type, props) {
    const name = type[0].toUpperCase() + type.slice(1);
    return {
        name, parentId: null, x: 0, y: 0, w: 160, h: 100, ...COMMON,
        ...(type === 'text' ? TEXT : {}), ...(type === 'frame' ? FRAME : {}), type, ...props,
    };
}

const model = buttonModel({ sizeModes: [{ id: 'sm', name: 'Small' }, { id: 'lg', name: 'Large' }] });
const ids = model.ids;

const bindings = {
    root: { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' },
    label: { 'fills.0': 'v-fg', fontSize: 's-fontSize', lineHeight: 's-lineHeight' },
};

/** The Button master: bound root auto layout frame with its label. */
function master() {
    const root = node('frame', {
        id: 'btn', name: 'Button', x: 40, y: 40, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12, strokeWidth: 1, strokeAlign: 'inside',
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#4338ca'), radius: 8,
        behavior: { version: BEHAVIOR_DATA_VERSION, ...model.binding }, vars: bindings.root,
    });
    const label = node('text', {
        id: 'btn-label', name: 'Label', parentId: 'btn', text: 'Button', w: 80, h: 24, autoW: true,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), fontSize: 14, vars: bindings.label,
    });
    return [root, label];
}

/** An icon component in the file, for the Button icon slots. */
function iconComponent(id, name, x, filled) {
    const root = node('frame', { id, name: `Icon/${name}`, x, y: 40, w: 24, h: 24, component: true, fills: [], clip: false });
    const path = node('path', {
        id: `${id}-path`, name, parentId: id, w: 24, h: 24, pathW: 24, pathH: 24, closed: filled,
        points: filled ? [{ x: 4, y: 4 }, { x: 20, y: 12 }, { x: 4, y: 20 }] : [{ x: 4, y: 12 }, { x: 20, y: 12 }],
        fills: filled ? solid('#20202a') : [], stroke: '#20202a', strokeWidth: filled ? 0 : 2,
    });
    return [root, path];
}

/** The nested instance a managed slot holds, with the engine's icon slot bindings. */
function iconInstance(slotId, componentId, components, disabled, template, fg, fgDisabled, size) {
    const copies = components.filter(c => c.id === componentId || c.parentId === componentId);
    const map = new Map(copies.map(c => [c.id, `${slotId}-ic-${c.id}`]));
    const layers = copies.map(c => ({
        id: map.get(c.id), fillIndexes: (c.fills || []).flatMap((f, i) => (f.visible !== false ? [i] : [])), stroke: !!c.stroke && c.strokeWidth > 0,
    }));
    const names = Object.fromEntries(Object.entries(iconSlotTargets(template)).map(([role, target]) => [role, target.name]));
    const plan = iconSlotBindings({ fg, fgDisabled, size, disabled, names, layers });
    const nodes = copies.map(c => {
        const bound = plan.layers.find(l => l.id === map.get(c.id)).vars;
        const isRoot = c.id === componentId;
        return {
            ...c, id: map.get(c.id), parentId: isRoot ? slotId : map.get(c.parentId), component: false, isInstance: isRoot, sourceId: c.id,
            overrides: {}, version: 0, ...(isRoot ? { x: 0, y: 0, layoutSizingH: 'fill', layoutSizingV: 'fill' } : {}),
            ...(Object.keys(bound).length ? { vars: bound } : {}),
        };
    });
    return { nodes, slotVars: plan.slot };
}

const MODES = (variant, color, size) => ({ [ids.variant]: variant, [ids.color]: color, [ids.size]: size });

/** A Button instance with its label and managed icon slots (start, end, or both). */
function instance(id, name, x, y, props, varModes, components) {
    const root = node('frame', {
        id, name, x, y, w: 136, h: 48, isInstance: true, sourceId: 'btn', layout: 'horizontal', gap: 6, padding: 12, strokeWidth: 1, strokeAlign: 'inside',
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#4338ca'), radius: 8,
        behavior: { version: BEHAVIOR_DATA_VERSION, props }, varModes, vars: bindings.root,
    });
    const label = node('text', {
        id: `${id}-label`, name: 'Label', parentId: id, text: props.label, w: 80, h: 24, autoW: true,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), fontSize: 14, vars: bindings.label, sourceId: 'btn-label',
    });
    const placement = props.hasIcon ? props.iconPlacement : null;
    if (!placement) return [root, label];
    const picks = placement === 'both'
        ? [['iconStart', props.icon, 'start'], ['iconEnd', props.iconEnd, 'end']]
        : placement === 'start'
            ? [['iconStart', props.icon, 'start']]
            : [['iconEnd', props.iconEnd, 'end']];
    const slots = [], copies = [];
    for (const [slot, componentId, side] of picks) {
        const slotId = `${id}-icon-${side}`;
        const nested = componentId ? iconInstance(slotId, componentId, components, props.disabled === true, BUTTON, 'v-fg', 'v-fg-disabled', 's-iconSize') : null;
        slots.push(node('frame', {
            id: slotId, name: slot, parentId: id, w: 16, h: 16, clip: !!nested,
            ...(nested
                ? { layout: 'horizontal', padding: 0, gap: 0, padT: 0, padR: 0, padB: 0, padL: 0, fills: [], vars: nested.slotVars }
                : { fills: solid('#8c8297'), layout: 'none' }),
            behavior: { version: BEHAVIOR_DATA_VERSION, slot },
        }));
        if (nested) copies.push(...nested.nodes);
    }
    const at = side => slots.find(l => l.id === `${id}-icon-${side}`);
    return [root, at('start'), label, at('end')].filter(Boolean).concat(copies);
}

const imodel = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size' }, prefix: 'in-' });
const iids = imodel.ids;

const ibindings = {
    root: { 'fills.0': 'in-v-bg', stroke: 'in-v-border', radius: 'in-s-radius', padH: 'in-s-paddingX', padV: 'in-s-paddingY', gap: 'in-s-gap' },
    label: { 'fills.0': 'in-v-fg', fontSize: 'in-s-fontSize', lineHeight: 'in-s-lineHeight' },
};

const IMODES = (variant, status, size) => ({ [iids.variant]: variant, [iids.status]: status, [iids.size]: size });

/** The Input master: bound root auto layout frame with its value text. */
function inputMaster() {
    const root = node('frame', {
        id: 'inp', name: 'Input', x: 420, y: 40, w: 200, h: 40, component: true, layout: 'horizontal', gap: 8, padding: 12, strokeWidth: 1, strokeAlign: 'inside',
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), radius: 8,
        behavior: { version: BEHAVIOR_DATA_VERSION, ...imodel.binding }, vars: ibindings.root,
    });
    const value = node('text', {
        id: 'inp-value', name: 'Value', parentId: 'inp', text: 'Search', w: 120, h: 24, autoW: true,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#18181b'), fontSize: 14, vars: ibindings.label,
    });
    return [root, value];
}

/** An Input instance with its value text and managed prefix/suffix slots. */
function inputInstance(id, name, x, y, props, varModes, components) {
    const root = node('frame', {
        id, name, x, y, w: 200, h: 40, isInstance: true, sourceId: 'inp', layout: 'horizontal', gap: 8, padding: 12, strokeWidth: 1, strokeAlign: 'inside',
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), radius: 8,
        behavior: { version: BEHAVIOR_DATA_VERSION, props }, varModes, vars: ibindings.root,
    });
    const value = node('text', {
        id: `${id}-value`, name: 'Value', parentId: id, text: props.value ?? '', w: 120, h: 24, autoW: true,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#18181b'), fontSize: 14, vars: ibindings.label, sourceId: 'inp-value',
    });
    const placement = props.hasIcon ? props.iconPlacement : null;
    if (!placement) return [root, value];
    const picks = placement === 'both'
        ? [['prefix', props.prefixIcon, 'start'], ['suffix', props.suffixIcon, 'end']]
        : placement === 'start'
            ? [['prefix', props.prefixIcon, 'start']]
            : [['suffix', props.suffixIcon, 'end']];
    const slots = [], copies = [];
    for (const [slot, componentId, side] of picks) {
        const slotId = `${id}-icon-${side}`;
        const nested = componentId ? iconInstance(slotId, componentId, components, props.disabled === true, INPUT, 'in-v-fg', 'in-v-fg-disabled', 'in-s-iconSize') : null;
        slots.push(node('frame', {
            id: slotId, name: slot, parentId: id, w: 16, h: 16, clip: !!nested,
            ...(nested
                ? { layout: 'horizontal', padding: 0, gap: 0, padT: 0, padR: 0, padB: 0, padL: 0, fills: [], vars: nested.slotVars }
                : { fills: solid('#8c8297'), layout: 'none' }),
            behavior: { version: BEHAVIOR_DATA_VERSION, slot },
        }));
        if (nested) copies.push(...nested.nodes);
    }
    const at = side => slots.find(l => l.id === `${id}-icon-${side}`);
    return [root, at('start'), value, at('end')].filter(Boolean).concat(copies);
}

/** The testing document: Components page (master + icons), Testing page (instances). */
export function buildTestingFile() {
    const icons = [...iconComponent('icon-check', 'check', 240, true), ...iconComponent('icon-arrow', 'arrow', 300, false)];
    const components = [...master(), ...inputMaster(), ...icons];
    const testing = [
        ...instance('t-solid', 'Simpan', 40, 40, { hasIcon: false, label: 'Simpan' }, MODES('solid', 'primary', 'sm'), icons),
        ...instance('t-outlined', 'Batal', 40, 120, { hasIcon: false, label: 'Batal' }, MODES('outlined', 'primary', 'sm'), icons),
        ...instance('t-dashed-icon', 'Hapus', 40, 200, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', label: 'Hapus' }, MODES('dashed', 'danger', 'lg'), icons),
        ...instance('t-end-icon', 'Lanjut', 40, 280, { hasIcon: true, iconPlacement: 'end', iconEnd: 'icon-arrow', label: 'Lanjut' }, MODES('solid', 'primary', 'lg'), icons),
        ...instance('t-both', 'Simpan', 40, 360, { hasIcon: true, iconPlacement: 'both', icon: 'icon-check', iconEnd: 'icon-arrow', label: 'Simpan' }, MODES('solid', 'primary', 'sm'), icons),
        ...instance('t-disabled', 'Simpan', 280, 40, { hasIcon: false, label: 'Simpan', disabled: true }, MODES('solid', 'primary', 'sm'), icons),
        ...instance('t-filled', 'Detail', 280, 120, { hasIcon: false, label: 'Detail' }, MODES('filled', 'primary', 'sm'), icons),
        ...instance('t-text', 'Hapus', 280, 200, { hasIcon: false, label: 'Hapus' }, MODES('text', 'danger', 'sm'), icons),
        ...inputInstance('i-outlined', 'Search', 520, 40, { value: 'Hello', placeholder: 'Search' }, IMODES('outlined', 'default', 'middle'), icons),
        ...inputInstance('i-error', 'Error', 520, 120, { hasIcon: true, iconPlacement: 'start', prefixIcon: 'icon-check', value: '', placeholder: 'Search' }, IMODES('outlined', 'error', 'middle'), icons),
        ...inputInstance('i-filled', 'Tags', 520, 200, { value: 'Hi', allowClear: true, showCount: true, maxLength: '20' }, IMODES('filled', 'default', 'middle'), icons),
        ...inputInstance('i-disabled', 'No edit', 520, 280, { value: 'No edit', disabled: true }, IMODES('outlined', 'default', 'middle'), icons),
        ...inputInstance('i-addon', 'Site', 520, 360, { value: 'midas', addonBefore: 'https://', addonAfter: '.com' }, IMODES('borderless', 'default', 'small'), icons),
        // Parity set mirroring the antd size demo: three prefix-icon inputs (large, default, small), one with a
        // value, one disabled, one error. Placeholders are the demo labels, not antd values.
        ...inputInstance('i-size-lg', 'Large', 760, 40, { hasIcon: true, iconPlacement: 'start', prefixIcon: 'icon-check', placeholder: 'large size' }, IMODES('outlined', 'default', 'large'), icons),
        ...inputInstance('i-size-md', 'Default', 760, 120, { hasIcon: true, iconPlacement: 'start', prefixIcon: 'icon-check', placeholder: 'default size' }, IMODES('outlined', 'default', 'middle'), icons),
        ...inputInstance('i-size-sm', 'Small', 760, 200, { hasIcon: true, iconPlacement: 'start', prefixIcon: 'icon-check', placeholder: 'small size' }, IMODES('outlined', 'default', 'small'), icons),
        ...inputInstance('i-value', 'Username', 760, 280, { value: 'Kopi Kita', placeholder: 'Username' }, IMODES('outlined', 'default', 'middle'), icons),
        ...inputInstance('i-state-disabled', 'Off', 760, 360, { value: 'Disabled text', placeholder: 'Disabled', disabled: true }, IMODES('outlined', 'default', 'middle'), icons),
        ...inputInstance('i-state-error', 'Oops', 760, 440, { value: '', placeholder: 'Something wrong' }, IMODES('outlined', 'error', 'middle'), icons),
    ];
    return {
        format: 'midas', version: 1, name: 'Testing', pageId: 'page-testing',
        pages: [
            { id: 'page-components', name: 'Components', nodes: components },
            { id: 'page-testing', name: 'Testing', nodes: testing },
        ],
        tokens: { colors: [], typography: [] }, assets: {},
        variables: { collections: [...model.collections, ...imodel.collections], items: [...model.items, ...imodel.items] },
    };
}

// Run directly: validate, then write testing.midas at the repo root.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const doc = buildTestingFile();
    assertBehaviorData(doc);
    const errors = diagnoseDocument(doc).filter(f => f.severity === 'error');
    if (errors.length) {
        console.error(JSON.stringify(errors, null, 2));
        throw new Error(`testing.midas has ${errors.length} diagnostics error(s)`);
    }
    writeFileSync(TESTING_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log(`Wrote ${TESTING_PATH} (0 errors)`);
}
