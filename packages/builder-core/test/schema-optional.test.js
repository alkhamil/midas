// Parts of the schema a template does not need: a template with no managed icon slot lists no `icons` and no focus `outline`, and a template says which
// way its master lays its layers out (`rootLayout`, seeding a new master as `rootAlign` seeds the alignment). FormItem and a Custom schema are such
// templates. A managed icon slot still needs its definition, and Button and Input keep theirs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateSchema } from '../src/behavior-engine/validate-schema.js';
import { applyTemplateToFrame } from '../src/behavior-engine/template-master.js';
import { BUTTON } from '../src/templates/button.js';
import { buttonModel } from '../../../scripts/button-model.mjs';

/** A template with a label and nothing else of Button's: no icon slot, no outline, a vertical master. */
const SIMPLE = {
    id: 'simple', name: 'Simple',
    element: { tag: 'div', attrs: {}, disabledState: 'disabled', blockClickProps: [] },
    anatomy: [{ id: 'label', kind: 'text', typography: 'label' }],
    icons: [],
    rootLayout: 'vertical',
    props: {
        size: BUTTON.props.size,
        label: { source: 'literal', type: 'string', default: 'Label', node: { key: 'label', field: 'text' } },
        disabled: { source: 'literal', type: 'boolean', default: false },
    },
    tokens: { fromSize: ['labelTypography', 'gap', 'fg', 'fg-disabled'] },
    tokenKinds: { labelTypography: 'typography', gap: 'length', fg: 'color', 'fg-disabled': 'color' },
    tokenRoles: { labelTypography: BUTTON.tokenRoles.labelTypography, gap: 'gap', fg: 'fg', 'fg-disabled': 'fg-disabled' },
    persistentStates: { disabled: { prop: 'disabled', tokens: { fg: 'fg-disabled' } } },
    previewStates: {},
    statePseudo: { disabled: ':disabled' },
    display: { root: { gap: 'gap' }, label: { fill: 'fg', typography: 'labelTypography' } },
    events: [],
};

test('a template with no managed icon slot needs no icons list and no outline', () => {
    assert.deepEqual(validateTemplateSchema(SIMPLE), []);
    assert.deepEqual(validateTemplateSchema({ ...SIMPLE, icons: undefined }), [], 'no list at all is no icon slot');
});

test('a managed icon slot still needs its definition, and a malformed outline is still refused', () => {
    const managed = { ...SIMPLE, anatomy: [...SIMPLE.anatomy, { id: 'start', kind: 'icon', optional: true, managed: true }] };
    assert.match(validateTemplateSchema(managed).join('\n'), /managed anatomy slot "start" has no icon def/);
    assert.match(validateTemplateSchema({ ...SIMPLE, outline: { width: -1, offset: 1 } }).join('\n'), /outline width must be a number of px, 0 or more/);
    assert.match(validateTemplateSchema({ ...SIMPLE, icons: 'x' }).join('\n'), /icons must be a list/);
    assert.deepEqual(validateTemplateSchema(BUTTON), []);
});

test('rootLayout is horizontal or vertical', () => {
    assert.deepEqual(validateTemplateSchema({ ...SIMPLE, rootLayout: 'horizontal' }), []);
    assert.match(validateTemplateSchema({ ...SIMPLE, rootLayout: 'grid' }).join('\n'), /rootLayout "grid" must be horizontal or vertical/);
});

test('a new master takes the template\'s rootLayout; a frame that already has an auto layout keeps its own, and a template without one lays out horizontally', () => {
    const model = buttonModel({ colors: ['primary'], variantModes: ['solid'] });
    const run = (template, frame) => {
        applyTemplateToFrame(template, { frame, children: [], binding: { variables: { size: model.ids.size } }, variables: { collections: model.collections, items: model.items }, idOf: key => key });
        return frame.layout;
    };
    assert.equal(run(SIMPLE, { id: 'f', name: 'F', type: 'frame', parentId: null, fills: [] }), 'vertical');
    assert.equal(run(SIMPLE, { id: 'f', name: 'F', type: 'frame', parentId: null, fills: [], layout: 'horizontal' }), 'horizontal');
    assert.equal(run({ ...SIMPLE, rootLayout: undefined }, { id: 'f', name: 'F', type: 'frame', parentId: null, fills: [] }), 'horizontal');
});
