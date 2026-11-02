// Builds testing.midas: a Button and an Input component with their variables, plus test instances. Every master and instance is built
// by the part generator (scripts/generated-part.mjs). Run `node scripts/make-testing-file.js`, then open testing.midas with Import file
// on the home screen. The build fails if the document has diagnostics errors.
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUTTON } from '../packages/builder-core/src/templates/button.js';
import { INPUT } from '../packages/builder-core/src/templates/input.js';
import { assertBehaviorData } from '../packages/builder-core/src/behavior-engine/document-check.js';
import { diagnoseDocument } from '../packages/builder-core/src/behavior-engine/diagnostics.js';
import { buttonModel } from './button-model.mjs';
import { inputModel } from './input-model.mjs';
import { generatedInstance, generatedMaster, iconComponent, withIcons } from './generated-part.mjs';

const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity: 1, visible: true }]);

const here = dirname(fileURLToPath(import.meta.url));
export const TESTING_PATH = resolve(here, '../testing.midas');

const TEXT = {
    text: 'Type something', fontFamily: 'Inter', fontSize: 24, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.35,
    letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', fills: solid('#20202a'), w: 240, h: 44,
};

/** A plain node as the editor stores it (the icon components and the test frame). */
function node(type, props) {
    const name = type[0].toUpperCase() + type.slice(1);
    return {
        name, parentId: null, x: 0, y: 0, w: 160, h: 100, rotation: 0, fills: solid('#0058CA'), stroke: '#000000',
        strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0,
        ...(type === 'text' ? TEXT : {}), ...(type === 'frame' ? { fills: solid('#ffffff'), w: 400, h: 300, clip: true } : {}), type, ...props,
    };
}

const model = buttonModel();
const ids = model.ids;
// The Input shares the Button's Semantic and Primitives: one of each in the file.
const imodel = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size' }, prefix: 'in-', shared: { semantic: model.ids.semantic, primitives: model.ids.primitives } });
// Items and collections are merged by id: the shared literal and typography items are the same objects in both models.
const byId = list => [...new Map(list.map(x => [x.id, x])).values()];
const variables = { collections: byId([...model.collections, ...imodel.collections]), items: byId([...model.items, ...imodel.items]) };

/** The Button master: a bound auto layout frame with its label, its spinner and its slots. */
const BUTTON_MASTER = generatedMaster({
    template: BUTTON,
    frame: node('frame', {
        id: 'btn', name: 'Button', x: 40, y: 40, w: 136, h: 32, component: true, layout: 'horizontal', gap: 6, padding: 12,
        strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'fixed', fills: solid('#4338ca'), radius: 8,
    }),
    binding: model.binding, variables,
});

/** The Input master: a bound auto layout frame with its value text, placeholder, clear and count. */
const INPUT_MASTER = generatedMaster({
    template: INPUT,
    frame: node('frame', {
        id: 'inp', name: 'Input', x: 420, y: 40, w: 200, h: 40, component: true, layout: 'horizontal', gap: 8, padding: 12,
        strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), radius: 8,
    }),
    binding: imodel.binding, variables,
});

/** A Button instance: its props, its Size, Variant and Color modes, and its icons (start or end, as the props place them). */
function button(id, name, x, y, props, varModes, components) {
    const copies = generatedInstance({ template: BUTTON, master: BUTTON_MASTER, props, id, varModes, x, y });
    const picks = [{ slot: 'iconStart', component: props.hasIcon && props.iconPlacement !== 'end' ? props.icon : null }, { slot: 'iconEnd', component: props.hasIcon && props.iconPlacement !== 'start' ? props.iconEnd : null }];
    return withIcons(copies, picks, id, components, BUTTON, props.disabled === true, 'v-fg', 'v-fg-disabled', 's-iconSize');
}

/** An Input instance: its props, its modes, and its start or end icons (as the props place them). */
function input(id, name, x, y, props, varModes, components) {
    const copies = generatedInstance({ template: INPUT, master: INPUT_MASTER, props, id, varModes, x, y });
    const picks = [{ slot: 'iconStart', component: props.hasIcon && props.iconPlacement !== 'end' ? props.icon : null }, { slot: 'iconEnd', component: props.hasIcon && props.iconPlacement !== 'start' ? props.iconEnd : null }];
    return withIcons(copies, picks, id, components, INPUT, props.disabled === true, 'in-v-fg', 'in-v-fg-disabled', 'in-s-iconSize');
}

const MODES = (variant, color, size) => ({ [ids.variant]: variant, [ids.color]: color, [ids.size]: size });
const IMODES = (variant, status, size) => ({ [imodel.ids.variant]: variant, [imodel.ids.status]: status, [imodel.ids.size]: size });

/** The testing document: Components page (masters and icons), Testing page (instances). */
export function buildTestingFile() {
    const icons = [...iconComponent('icon-check', 'check', 240, true), ...iconComponent('icon-arrow', 'arrow', 300, false)];
    const components = [...BUTTON_MASTER, ...INPUT_MASTER, ...icons];
    const testing = [
        ...button('t-solid', 'Simpan', 40, 40, { hasIcon: false, label: 'Simpan' }, MODES('solid', 'primary', 'sm'), icons),
        ...button('t-outlined', 'Batal', 40, 120, { hasIcon: false, label: 'Batal' }, MODES('outlined', 'primary', 'sm'), icons),
        ...button('t-dashed-icon', 'Hapus', 40, 200, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', label: 'Hapus' }, MODES('dashed', 'danger', 'lg'), icons),
        ...button('t-end-icon', 'Lanjut', 40, 280, { hasIcon: true, iconPlacement: 'end', iconEnd: 'icon-arrow', label: 'Lanjut' }, MODES('solid', 'primary', 'lg'), icons),
        ...button('t-end', 'Simpan', 40, 360, { hasIcon: true, iconPlacement: 'end', icon: 'icon-check', iconEnd: 'icon-arrow', label: 'Simpan' }, MODES('solid', 'primary', 'sm'), icons),
        ...button('t-disabled', 'Simpan', 280, 40, { hasIcon: false, label: 'Simpan', disabled: true }, MODES('solid', 'primary', 'sm'), icons),
        ...button('t-filled', 'Detail', 280, 120, { hasIcon: false, label: 'Detail' }, MODES('filled', 'primary', 'sm'), icons),
        ...button('t-text', 'Hapus', 280, 200, { hasIcon: false, label: 'Hapus' }, MODES('text', 'danger', 'sm'), icons),
        ...button('t-loading', 'Simpan', 280, 280, { hasIcon: false, label: 'Simpan', loading: true }, MODES('solid', 'primary', 'sm'), icons),
        ...input('i-outlined', 'Search', 520, 40, { value: 'Hello', placeholder: 'Search' }, IMODES('outlined', 'default', 'md'), icons),
        ...input('i-error', 'Error', 520, 120, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', value: '', placeholder: 'Search' }, IMODES('outlined', 'error', 'md'), icons),
        ...input('i-filled', 'Tags', 520, 200, { value: 'Hi', allowClear: true, showCount: true, maxLength: 20 }, IMODES('filled', 'default', 'md'), icons),
        ...input('i-disabled', 'No edit', 520, 280, { value: 'No edit', disabled: true }, IMODES('outlined', 'default', 'md'), icons),
        ...input('i-addon', 'Site', 520, 360, { value: 'midas', hasPrefix: true, prefixText: 'https://', hasSuffix: true, suffixText: '.com' }, IMODES('borderless', 'default', 'sm'), icons),
        // Parity set mirroring the antd size demo: three prefix-icon inputs (large, default, small), one with a value, one disabled, one error.
        ...input('i-size-lg', 'Large', 760, 40, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', placeholder: 'large size' }, IMODES('outlined', 'default', 'lg'), icons),
        ...input('i-size-md', 'Default', 760, 120, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', placeholder: 'default size' }, IMODES('outlined', 'default', 'md'), icons),
        ...input('i-size-sm', 'Small', 760, 200, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', placeholder: 'small size' }, IMODES('outlined', 'default', 'sm'), icons),
        ...input('i-value', 'Username', 760, 280, { value: 'Kopi Kita', placeholder: 'Username' }, IMODES('outlined', 'default', 'md'), icons),
        ...input('i-state-disabled', 'Off', 760, 360, { value: 'Disabled text', placeholder: 'Disabled', disabled: true }, IMODES('outlined', 'default', 'md'), icons),
        ...input('i-state-error', 'Oops', 760, 440, { value: '', placeholder: 'Something wrong' }, IMODES('outlined', 'error', 'md'), icons),
    ];
    // One white frame holds the test instances: Play starts from a top-level frame, and the frame is the page the instances sit on.
    const playFrame = node('frame', { id: 't-frame', name: 'Testing', x: 0, y: 0, w: 1000, h: 560, fills: solid('#ffffff'), clip: true });
    const framed = testing.map(n => (n.parentId === null ? { ...n, parentId: playFrame.id } : n));
    return {
        format: 'midas', version: 1, name: 'Testing', pageId: 'page-testing',
        pages: [
            { id: 'page-components', name: 'Components', nodes: components },
            { id: 'page-testing', name: 'Testing', nodes: [playFrame, ...framed] },
        ],
        tokens: { colors: [], typography: [] }, assets: {},
        variables,
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
