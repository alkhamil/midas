// Builds a single-page example of a Button component bound to the template: scripts/fixtures/button-example.midas. Run
// `node scripts/make-button-example.js`, then open the file with Import file on the home screen. The variables are the Button model
// in scripts/button-model.mjs (Color, Variant and Size collections, named `button/<token>`). The master and its instance are built by
// the part generator (scripts/generated-part.mjs).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUTTON } from '../packages/builder-core/src/templates/button.js';
import { diagnoseDocument } from '../packages/builder-core/src/behavior-engine/diagnostics.js';
import { buttonModel } from './button-model.mjs';
import { generatedInstance, generatedMaster } from './generated-part.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const EXAMPLE_PATH = resolve(here, 'fixtures/button-example.midas');

const solid = color => [{ type: 'solid', color, opacity: 1, visible: true }];

/** A frame as the editor stores it: the defaults the fixtures use, then the given props. */
function frame(props) {
    return { name: 'Frame', type: 'frame', parentId: null, x: 0, y: 0, w: 160, h: 100, rotation: 0, fills: [], stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0, ...props };
}

const model = buttonModel();
const variables = { collections: model.collections, items: model.items };

const MASTER = generatedMaster({
    template: BUTTON,
    frame: frame({
        id: 'button', name: 'Button', x: 0, y: 0, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12,
        layoutSizingH: 'hug', layoutSizingV: 'fixed', fills: solid('#4338ca'), radius: 8, clip: true, strokeWidth: 1, strokeAlign: 'inside',
    }),
    binding: model.binding, variables,
});

/** The example document: one page, the Button master, and one instance of it with its props and Appearance modes. */
export function buildButtonExample() {
    const instance = generatedInstance({
        template: BUTTON, master: MASTER, props: { label: 'Save', hasIcon: false, loading: false, disabled: false }, id: 'button-save',
        varModes: { [model.ids.variant]: 'solid', [model.ids.color]: 'primary', [model.ids.size]: 'lg' }, x: 200, y: 0, parentId: null, name: 'Save',
    });
    return {
        format: 'midas', version: 1, name: 'Button example', pageId: 'page-components',
        pages: [{ id: 'page-components', name: 'Components', nodes: [...MASTER, ...instance] }],
        tokens: { colors: [], typography: [] }, assets: {},
        variables,
    };
}

// Run directly: write the example (the directory is created if missing), after checking it has no diagnostics.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    const doc = buildButtonExample();
    const found = diagnoseDocument(doc);
    if (found.length) throw new Error(`button example has ${found.length} diagnostic(s): ${found.slice(0, 3).map(e => e.message).join('; ')}`);
    mkdirSync(dirname(EXAMPLE_PATH), { recursive: true });
    writeFileSync(EXAMPLE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log(`Wrote ${EXAMPLE_PATH} (0 diagnostics)`);
}
