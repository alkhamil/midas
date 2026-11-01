// The typography parity fixture: a Button and an Input instance at each of the five Size modes (xs to xl), each with its text
// bound to its typography variable. Play and the canvas draw the same instances; test:browser compares their text.
// Run: node scripts/make-typography-matrix.js (writes scripts/fixtures/typography-matrix.midas).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';
import { diagnoseDocument } from '../packages/builder-core/src/behavior-engine/diagnostics.js';
import { buttonModel } from './button-model.mjs';
import { inputModel } from './input-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const MATRIX_PATH = resolve(here, 'fixtures/typography-matrix.midas');
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'].map(id => ({ id, name: id }));

const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];
const COMMON = { rotation: 0, fills: solid('#0058CA'), stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0 };
const TEXT = { text: '', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', w: 120, h: 24 };
const FRAME = { fills: solid('#ffffff'), w: 400, h: 300, clip: true };

/** A node as the editor stores it (the same shape the testing file uses). */
function node(type, props) {
    const name = type[0].toUpperCase() + type.slice(1);
    return { name, parentId: null, x: 0, y: 0, w: 160, h: 100, ...COMMON, ...(type === 'text' ? TEXT : {}), ...(type === 'frame' ? FRAME : {}), type, ...props };
}

/** Non-text sizing tokens for the five modes, in mode order (xs to xl). The text is the typography token, not these. */
const SIZING = { height: [24, 32, 36, 40, 48], paddingX: [8, 12, 12, 16, 20], paddingY: [2, 6, 8, 8, 10], gap: [4, 6, 6, 8, 10], radius: [4, 6, 6, 8, 10], iconSize: [12, 14, 14, 16, 18] };
const bySize = values => Object.fromEntries(SIZES.map((s, i) => [s.id, values[i]]));
const SIZE_VALUES = Object.fromEntries(Object.entries(SIZING).map(([token, values]) => [token, bySize(values)]));

const button = buttonModel({ sizeModes: SIZES, sizeValues: SIZE_VALUES });
const input = inputModel({ ids: { variant: 'c-input-variant', status: 'c-input-status', size: 'c-input-size', semantic: 'c-input-semantic' }, prefix: 'in-', sizeModes: SIZES, sizeValues: SIZE_VALUES });
const BTN = {
    root: { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' },
    label: { 'fills.0': 'v-fg', typography: 's-labelTypography' },
};
const INP = {
    root: { 'fills.0': 'in-v-bg', stroke: 'in-v-border', radius: 'in-s-radius', padH: 'in-s-paddingX', padV: 'in-s-paddingY', gap: 'in-s-gap', minW: 'in-s-height' },
    label: { 'fills.0': 'in-v-fg', typography: 'in-s-valueTypography' },
};

/** The Button master, then one instance per size with its label. An instance's Size mode is its own varModes entry. */
function buttonNodes() {
    const master = [
        node('frame', { id: 'btn', name: 'Button', x: 40, y: 40, w: 136, h: 32, component: true, layout: 'horizontal', gap: 6, padding: 12, strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'fixed', counterAlign: 'center', fills: solid('#4338ca'), radius: 8, behavior: { version: BEHAVIOR_DATA_VERSION, ...button.binding }, vars: BTN.root }),
        node('text', { id: 'btn-label', name: 'Label', parentId: 'btn', text: 'Button', autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), vars: BTN.label }),
    ];
    const instances = SIZES.flatMap((size, i) => {
        const id = `b-${size.id}`;
        const varModes = { [button.ids.variant]: 'solid', [button.ids.color]: 'primary', [button.ids.size]: size.id };
        return [
            node('frame', { id, name: `Button ${size.name}`, parentId: 'm-frame', x: 40, y: 40 + i * 100, w: 136, h: 32, isInstance: true, sourceId: 'btn', layout: 'horizontal', gap: 6, padding: 12, strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'fixed', counterAlign: 'center', fills: solid('#4338ca'), radius: 8, behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Simpan' } }, varModes, vars: BTN.root }),
            node('text', { id: `${id}-label`, name: 'Label', parentId: id, text: 'Simpan', autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), vars: BTN.label, sourceId: 'btn-label' }),
        ];
    });
    return [...master, ...instances];
}

/** The Input master, then one instance per size with its value text. */
function inputNodes() {
    const master = [
        node('frame', { id: 'inp', name: 'Input', x: 420, y: 40, w: 200, h: 40, component: true, layout: 'horizontal', gap: 8, padding: 12, strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), radius: 8, behavior: { version: BEHAVIOR_DATA_VERSION, ...input.binding }, vars: INP.root }),
        node('text', { id: 'inp-value', name: 'Value', parentId: 'inp', text: 'Search', autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#18181b'), vars: INP.label }),
    ];
    const instances = SIZES.flatMap((size, i) => {
        const id = `i-${size.id}`;
        const varModes = { [input.ids.variant]: 'outlined', [input.ids.status]: 'default', [input.ids.size]: size.id };
        return [
            node('frame', { id, name: `Input ${size.name}`, parentId: 'm-frame', x: 320, y: 40 + i * 100, w: 200, h: 40, isInstance: true, sourceId: 'inp', layout: 'horizontal', gap: 8, padding: 12, strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), radius: 8, behavior: { version: BEHAVIOR_DATA_VERSION, props: { value: 'Kopi Kita' } }, varModes, vars: INP.root }),
            node('text', { id: `${id}-value`, name: 'Value', parentId: id, text: 'Kopi Kita', autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#18181b'), vars: INP.label, sourceId: 'inp-value' }),
        ];
    });
    return [...master, ...instances];
}

/** The matrix document: the Button and Input masters on the Components page, the instances in one top-level frame. */
export function buildMatrixFile() {
    const frame = node('frame', { id: 'm-frame', name: 'Matrix', x: 0, y: 0, w: 640, h: 560, fills: solid('#ffffff'), clip: true });
    const all = [...buttonNodes(), ...inputNodes()];
    const isInstance = n => n.id.startsWith('b-') || n.id.startsWith('i-');
    return {
        format: 'midas', version: 1, name: 'Typography matrix', pageId: 'page-matrix',
        pages: [
            { id: 'page-components', name: 'Components', nodes: all.filter(n => !isInstance(n)) },
            { id: 'page-matrix', name: 'Matrix', nodes: [frame, ...all.filter(isInstance)] },
        ],
        tokens: { colors: [], typography: [] }, assets: {},
        variables: { collections: [...button.collections, ...input.collections], items: [...button.items, ...input.items] },
    };
}

// Run directly: validate, then write the fixture.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const doc = buildMatrixFile();
    const errors = diagnoseDocument(doc).filter(f => f.severity === 'error');
    if (errors.length) throw new Error(`typography matrix has ${errors.length} diagnostics error(s): ${errors.slice(0, 3).map(e => e.message).join('; ')}`);
    writeFileSync(MATRIX_PATH, JSON.stringify(doc, null, 1) + '\n');
    console.log(`Wrote ${MATRIX_PATH}`);
}
