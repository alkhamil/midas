// The export gives the fill flex to the value/label part only: count, prefix and
// suffix hug their content, as on the canvas and in Play (the display rules used to
// copy the label's flex onto every text part, so they filled the row in the export).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateComponent } from '../src/behavior-engine/codegen.js';
import { TEMPLATES } from '../src/behavior-engine/registry.js';
import { applyTemplateToFrame } from '../src/behavior-engine/template-master.js';
import { inputModel } from '../../../scripts/input-model.mjs';

const input = TEMPLATES.get('input');
const model = inputModel({});
const variables = { collections: model.collections, items: model.items };

/** The Input stylesheet from real generator-built master layers, as the browser test reads it. */
function css() {
    let n = 0;
    const idOf = () => `c${++n}`;
    const frame = { id: 'master', name: 'Input', type: 'frame', parentId: null, fills: [] };
    const made = applyTemplateToFrame(input, { frame, children: [], binding: model.binding, variables, idOf });
    const master = { ...frame, ...made.frame };
    const childrenOf = id => made.created.filter(c => c.parentId === id);
    return generateComponent(input, model.binding, variables, 'Input', master, childrenOf).files['Input.css'];
}

const blockOf = (sheet, cls) => new RegExp(`\\.${cls} \\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';

test('only the value part fills the row in the export; count, prefix and suffix hug', () => {
    const sheet = css();
    assert.match(blockOf(sheet, 'input-label'), /flex: 1 1 0;/, 'the value takes the free row');
    for (const cls of ['input-count', 'input-prefixText', 'input-suffixText']) {
        assert.doesNotMatch(blockOf(sheet, cls), /flex: 1/, `${cls} takes no free row`);
        assert.match(blockOf(sheet, cls), /flex-shrink: 0;/, `${cls} never squeezes`);
    }
});

test('no Size mode overrides the text-part sizing in the export (xs to xl)', () => {
    const sheet = css();
    const modes = variables.collections.find(c => c.id === model.binding.variables.size).modes;
    assert.deepEqual(modes.map(m => m.name).sort(), ['lg', 'md', 'sm', 'xl', 'xs']);
    for (const mode of modes) {
        const block = new RegExp(`\\[data-size="${mode.id}"\\][^{]*\\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';
        assert.ok(block.length > 0, `${mode.name} has a token block`);
        assert.doesNotMatch(block, /flex/, `${mode.name} sets no flex`);
    }
});
