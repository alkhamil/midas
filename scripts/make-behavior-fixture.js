// Builds the Behavior manual-test document: scripts/fixtures/behavior-fixture.midas. Run `node scripts/make-behavior-fixture.js`,
// then open the file with Import file on the home screen (or import it into a workspace). A saved copy reopens lazily,
// because it has more than three pages. Every template master and instance is built by the part generator
// (scripts/generated-part.mjs). The document holds one deliberate error (the legacy master's missing hover value in Solid) and one
// master that is not bound, for the diagnostics and Auto Fix manual tests; the test suite checks both.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUTTON } from '../packages/builder-core/src/templates/button.js';
import { buttonModel, BUTTON_VARIANTS } from './button-model.mjs';
import { generatedInstance, generatedMaster, iconComponent, withIcons } from './generated-part.mjs';

const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = resolve(here, 'fixtures/behavior-fixture.midas');
export const CLIPBOARD_PATH = resolve(here, 'fixtures/managed-layer-clipboard.json');

/** A plain frame or text as the editor stores it: the node() defaults, then the given props. Used for layers that are not template parts. */
function node(type, props) {
    const name = type[0].toUpperCase() + type.slice(1);
    const base = { name, parentId: null, x: 0, y: 0, w: 160, h: 100, rotation: 0, fills: solid('#0058CA'), stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0 };
    const byType = type === 'text'
        ? { text: 'Type something', fontFamily: 'Inter', fontSize: 24, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.35, letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', fills: solid('#20202a'), w: 240, h: 44 }
        : type === 'frame' ? { fills: solid('#ffffff'), w: 400, h: 300, clip: true } : {};
    return { ...base, ...byType, type, ...props };
}

const main = buttonModel();
const legacyModel = buttonModel({ ids: { variant: 'c-variant-b' }, prefix: 'b-', shared: main.ids });
const ids = { variant: main.ids.variant, variantLegacy: legacyModel.ids.variant, color: main.ids.color, size: main.ids.size };

/**
 * The variables. Variant, Color and Size are bound to the main master. Variant B is bound to the legacy master, which has no
 * `button/bg-hover` value for Solid: that is the one deliberate error. The `card/` group sits in Variant too, to show that Button never
 * reads another component's variables.
 */
function variables() {
    const card = [
        { id: 'i-card-bg-v', name: 'card/bg', type: 'color', collectionId: ids.variant, values: Object.fromEntries(BUTTON_VARIANTS.map(m => [m, '#ffffff'])) },
        { id: 'i-card-fg-v', name: 'card/fg', type: 'color', collectionId: ids.variant, values: Object.fromEntries(BUTTON_VARIANTS.map(m => [m, '#20202a'])) },
    ];
    // Variant B: no bg-hover value for Solid.
    const legacyItems = legacyModel.items.map(item => (item.id === 'b-v-bg-hover' ? { ...item, values: { ...item.values, solid: undefined } } : item));
    return {
        collections: [...main.collections, legacyModel.collections[0]].map(c => (c.id === ids.variantLegacy ? { ...c, name: 'Variant B' } : c)),
        items: [...main.items, ...legacyItems, ...card],
    };
}

const VARIABLES = variables();

/** The variables without Variant B and its values: the documents that do not carry the legacy master. */
function withoutLegacy(vars) {
    return { collections: vars.collections.filter(c => c.id !== ids.variantLegacy), items: vars.items.filter(i => i.collectionId !== ids.variantLegacy) };
}
const MODES = (variant, color, size) => ({ [ids.variant]: variant, [ids.color]: color, [ids.size]: size });

/** The main master: bound to the Variant, Color and Size collections, with a stroke so the Focus preview is visible on the canvas. */
export const MAIN = generatedMaster({
    template: BUTTON,
    frame: node('frame', { id: 'main', name: 'Button', x: 0, y: 0, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12, layoutSizingH: 'hug', layoutSizingV: 'fixed', strokeWidth: 2, strokeAlign: 'inside', fills: solid('#0058CA'), radius: 8 }),
    binding: main.binding, variables: VARIABLES,
});

/** The legacy master: bound to Variant B, whose Solid hover value is missing (the deliberate error). */
const LEGACY = generatedMaster({
    template: BUTTON,
    frame: node('frame', { id: 'legacy', name: 'Button (legacy)', x: 0, y: 240, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12, layoutSizingH: 'hug', layoutSizingV: 'fixed', strokeWidth: 1, strokeAlign: 'inside', fills: solid('#0058CA'), radius: 8 }),
    binding: legacyModel.binding, variables: VARIABLES,
});

/**
 * An icon component in the file, the icons a Button's icon slot can show. A filled icon has a closed filled path; a stroked icon has an
 * open path with no fill, so its colour is its stroke.
 */
const ICONS = [...iconComponent('icon-check', 'check', 800, true), ...iconComponent('icon-arrow', 'arrow', 1000, false)];

/** An instance of the main master for these props, with its icons (as the props place them). */
function instanceOfMain(id, x, y, props, varModes) {
    const copies = generatedInstance({ template: BUTTON, master: MAIN, props, id, varModes, x, y, name: props.label });
    return withIcons(copies, [{ slot: 'iconStart', component: props.hasIcon && props.iconPlacement !== 'end' ? props.icon : null }, { slot: 'iconEnd', component: props.hasIcon && props.iconPlacement !== 'start' ? props.iconEnd : null }], id, ICONS, BUTTON, props.disabled === true, 'v-fg', 'v-fg-disabled', 's-iconSize');
}

/** The managed-layer clipboard payload: one icon slot copied alone (the paste guard refuses it, naming the layer). */
export function buildManagedLayerClipboard(fixture = buildBehaviorFixture()) {
    const layer = fixture.pages[0].nodes.find(n => n.id === 'inst-start-iconStart');
    return { format: 'midas-clipboard', rootIds: [layer.id], nodes: [layer], assets: {} };
}

/** The fixture document. Five pages, so a lazy open applies (more than three pages). */
export function buildBehaviorFixture({ legacy = true } = {}) {
    const variables = legacy ? VARIABLES : withoutLegacy(VARIABLES);
    const page1 = [
        ...MAIN,
        ...instanceOfMain('inst-start', 200, 120, { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', label: 'Save' }, MODES('solid', 'primary', 'sm')),
        ...instanceOfMain('inst-plain', 400, 120, { hasIcon: false, label: 'Cancel' }, MODES('solid', 'danger', 'lg')),
        ...instanceOfMain('inst-end', 400, 120, { hasIcon: true, iconPlacement: 'end', icon: 'icon-check', iconEnd: 'icon-arrow', label: 'End' }, MODES('solid', 'primary', 'sm')),
        // Not bound and not a template: a plain frame with its own label, for the Behavior tab's bind action.
        node('frame', { id: 'unbound', name: 'Unbound', x: 600, y: 0, w: 136, h: 48, layout: 'horizontal', gap: 6, padding: 12, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#0058CA'), radius: 8 }),
        node('text', { id: 'unbound-label', name: 'Label', parentId: 'unbound', text: 'Button', w: 80, h: 24, autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), fontSize: 14 }),
        ...(legacy ? LEGACY : []),
        ...ICONS,
    ];
    const page2 = instanceOfMain('inst-cross', 0, 120, { hasIcon: true, iconPlacement: 'end', iconEnd: 'icon-arrow', label: 'Next' }, MODES('solid', 'primary', 'sm'));
    const pages = [
        { id: 'page-components', name: 'Components', nodes: page1 },
        { id: 'page-screens', name: 'Screens', nodes: page2 },
        { id: 'page-empty-3', name: 'Empty 3', nodes: [] },
        { id: 'page-empty-4', name: 'Empty 4', nodes: [] },
        { id: 'page-empty-5', name: 'Empty 5', nodes: [] },
    ];
    return {
        format: 'midas', version: 1, name: 'Behavior fixture', pageId: 'page-components', pages,
        tokens: { colors: [], typography: [] }, assets: {}, variables,
    };
}

// Run directly: write the fixture and the clipboard payload (the directory is created if missing).
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
    const fixture = buildBehaviorFixture();
    writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n');
    writeFileSync(CLIPBOARD_PATH, JSON.stringify(buildManagedLayerClipboard(fixture), null, 2) + '\n');
    console.log(`Wrote ${FIXTURE_PATH}`);
    console.log(`Wrote ${CLIPBOARD_PATH}`);
}
