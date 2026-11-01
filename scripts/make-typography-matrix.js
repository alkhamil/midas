// The typography parity fixture: a Button and an Input instance at each of the five Size modes (xs to xl), each with its text bound to
// its typography variable. Every master and instance is built by the part generator (scripts/generated-part.mjs). Play and the canvas
// draw the same instances; test:browser compares their text. Run: node scripts/make-typography-matrix.js (writes
// scripts/fixtures/typography-matrix.midas).
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUTTON } from '../packages/builder-core/src/templates/button.js';
import { INPUT } from '../packages/builder-core/src/templates/input.js';
import { diagnoseDocument } from '../packages/builder-core/src/behavior-engine/diagnostics.js';
import { buttonModel } from './button-model.mjs';
import { inputModel } from './input-model.mjs';
import { generatedInstance, generatedMaster } from './generated-part.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const MATRIX_PATH = resolve(here, 'fixtures/typography-matrix.midas');
const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'].map(id => ({ id, name: id }));

const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];
const COMMON = { rotation: 0, fills: solid('#0058CA'), stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0 };
const TEXT = { text: '', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', w: 120, h: 24 };
const FRAME = { fills: solid('#ffffff'), w: 400, h: 300, clip: true };

/** A plain node as the editor stores it (the matrix frame and the two plain texts, which are not template parts). */
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
const variables = { collections: [...button.collections, ...input.collections], items: [...button.items, ...input.items] };

const BUTTON_MASTER = generatedMaster({
    template: BUTTON,
    frame: node('frame', {
        id: 'btn', name: 'Button', x: 40, y: 40, w: 136, h: 32, component: true, layout: 'horizontal', gap: 6, padding: 12,
        strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'fixed', counterAlign: 'center', fills: solid('#ffffff'), radius: 8,
    }),
    binding: button.binding, variables,
});

const INPUT_MASTER = generatedMaster({
    template: INPUT,
    frame: node('frame', {
        id: 'inp', name: 'Input', x: 420, y: 40, w: 200, h: 40, component: true, layout: 'horizontal', gap: 8, padding: 12,
        strokeWidth: 1, strokeAlign: 'inside', layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), radius: 8,
    }),
    binding: input.binding, variables,
});

/** The Button instances, one per size, each with its label and its Size mode. */
function buttonInstances() {
    return SIZES.flatMap((size, i) => generatedInstance({
        template: BUTTON, master: BUTTON_MASTER, props: { label: 'Simpan', hasIcon: false, loading: false, disabled: false }, id: `b-${size.id}`,
        varModes: { [button.ids.variant]: 'solid', [button.ids.color]: 'primary', [button.ids.size]: size.id }, x: 40, y: 40 + i * 100, parentId: 'm-frame',
    }));
}

/** The Input instances, one per size, each with its value and its Size mode. */
function inputInstances() {
    return SIZES.flatMap((size, i) => generatedInstance({
        template: INPUT, master: INPUT_MASTER, props: { value: 'Kopi Kita', placeholder: '' }, id: `i-${size.id}`,
        varModes: { [input.ids.variant]: 'outlined', [input.ids.status]: 'default', [input.ids.size]: size.id }, x: 320, y: 40 + i * 100, parentId: 'm-frame',
    }));
}

/**
 * Two plain text layers in the matrix frame, not template parts: nothing is attached to them, so the Design panel shows None.
 * The second has its own Size mode (Large), so one attached style resolves to a different size on each.
 */
function plainTexts() {
    const plain = (id, y, varModes) => node('text', { id, name: id, parentId: 'm-frame', text: 'Plain text', x: 440, y, w: 160, h: 24, autoW: false, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: solid('#18181b'), fontSize: 14, varModes });
    return [plain('plain-a', 40, undefined), plain('plain-b', 120, { [button.ids.size]: 'lg' })];
}

/** The matrix document: the Button and Input masters on the Components page, the instances in one top-level frame. */
export function buildMatrixFile() {
    const frame = node('frame', { id: 'm-frame', name: 'Matrix', x: 0, y: 0, w: 640, h: 560, fills: solid('#ffffff'), clip: true });
    return {
        format: 'midas', version: 1, name: 'Typography matrix', pageId: 'page-matrix',
        pages: [
            { id: 'page-components', name: 'Components', nodes: [...BUTTON_MASTER, ...INPUT_MASTER] },
            { id: 'page-matrix', name: 'Matrix', nodes: [frame, ...buttonInstances(), ...inputInstances(), ...plainTexts()] },
        ],
        tokens: { colors: [], typography: [] }, assets: {},
        variables,
    };
}

// Run directly: validate, then write the fixture.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const doc = buildMatrixFile();
    const found = diagnoseDocument(doc);
    if (found.length) throw new Error(`typography matrix has ${found.length} diagnostic(s): ${found.slice(0, 3).map(e => e.message).join('; ')}`);
    writeFileSync(MATRIX_PATH, JSON.stringify(doc, null, 1) + '\n');
    console.log(`Wrote ${MATRIX_PATH} (0 diagnostics)`);
}
