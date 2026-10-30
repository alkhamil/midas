// Builds a single-page example of a Button component bound to the template: scripts/fixtures/button-example.midas. Run
// `node scripts/make-button-example.js`, then open the file with Import file on the home screen. The variables are the Button model
// in scripts/button-model.mjs (Color, Variant and Size collections, named `button/<token>`).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';
import { buttonModel } from './button-model.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const EXAMPLE_PATH = resolve(here, 'fixtures/button-example.midas');

const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];

/** A node as the editor stores it: the defaults the fixtures use, then the given props. */
function node(type, props) {
    const base = {
        name: type[0].toUpperCase() + type.slice(1), parentId: null, x: 0, y: 0, w: 160, h: 100, rotation: 0, fills: [], stroke: '#000000',
        strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0,
    };
    const byType = type === 'text'
        ? { text: '', fontFamily: 'Inter', fontSize: 14, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.4, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', fills: solid('#ffffff') }
        : {};
    return { ...base, ...byType, type, ...props };
}

const model = buttonModel();
const BOUND = { version: BEHAVIOR_DATA_VERSION, templateId: 'button', variables: model.binding.variables };

/** The Button master: a root auto layout frame bound to the template, with its label. The bindings are the ones the template expects. */
function master() {
    const root = node('frame', {
        id: 'button', name: 'Button', x: 0, y: 0, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#4338ca'), radius: 8, clip: true, behavior: BOUND,
        vars: { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' },
    });
    const label = node('text', {
        id: 'button-label', name: 'Label', parentId: 'button', text: 'Button', w: 80, h: 24, fills: solid('#ffffff'), fontSize: 14,
        vars: { 'fills.0': 'v-fg', fontSize: 's-fontSize', lineHeight: 's-lineHeight' },
    });
    return [root, label];
}

/** An instance of the master, with its prop values and Appearance modes. It copies the master's bindings, as sync does. */
function instance() {
    const root = node('frame', {
        id: 'button-save', name: 'Save', x: 200, y: 0, w: 136, h: 48, isInstance: true, sourceId: 'button', layout: 'horizontal', gap: 6,
        padding: 12, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#4338ca'), radius: 8, clip: true,
        behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: 'Save', hasIcon: false, loading: false, disabled: false } },
        varModes: { [model.ids.variant]: 'solid', [model.ids.color]: 'primary', [model.ids.size]: 'lg' },
        vars: { 'fills.0': 'v-bg', stroke: 'v-border', radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' },
    });
    const label = node('text', {
        id: 'button-save-label', name: 'Label', parentId: 'button-save', text: 'Save', w: 80, h: 24, fills: solid('#ffffff'), fontSize: 14,
        sourceId: 'button-label', vars: { 'fills.0': 'v-fg', fontSize: 's-fontSize', lineHeight: 's-lineHeight' },
    });
    return [root, label];
}

/** The example document: one page, the Button master, and one instance of it. */
export function buildButtonExample() {
    return {
        format: 'midas', version: 1, name: 'Button example', pageId: 'page-components',
        pages: [{ id: 'page-components', name: 'Components', nodes: [...master(), ...instance()] }],
        tokens: { colors: [], typography: [] }, assets: {},
        variables: { collections: model.collections, items: model.items },
    };
}

// Run directly: write the example (the directory is created if missing).
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    mkdirSync(dirname(EXAMPLE_PATH), { recursive: true });
    writeFileSync(EXAMPLE_PATH, JSON.stringify(buildButtonExample(), null, 2) + '\n');
    console.log(`Wrote ${EXAMPLE_PATH}`);
}
