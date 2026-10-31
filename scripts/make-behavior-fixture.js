// Builds the Behavior manual-test document: scripts/fixtures/behavior-fixture.midas. Run `node scripts/make-behavior-fixture.js`,
// then open the file with Import file on the home screen (or import it into a workspace). A saved copy reopens lazily,
// because it has more than three pages. The node defaults below mirror node() in apps/studio/src/engine/midas.js: keep them in step.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';
import { iconSlotBindings, iconSlotTargets } from '../packages/builder-core/src/behavior-engine/icon-slot.js';
import { BUTTON } from '../packages/builder-core/src/templates/button.js';
import { buttonModel, BUTTON_VARIANTS } from './button-model.mjs';
const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_PATH = resolve(here, 'fixtures/behavior-fixture.midas');
export const CLIPBOARD_PATH = resolve(here, 'fixtures/managed-layer-clipboard.json');

const COMMON = {
    rotation: 0, fills: solid('#0058CA'), stroke: '#000000',
    strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, clip: false, version: 0,
};
const TEXT = {
    text: 'Type something', fontFamily: 'Inter', fontSize: 24, fontWeight: 400, fontStyle: 'normal', lineHeight: 1.35,
    letterSpacing: 0, textAlign: 'left', textDecoration: 'none', textCase: 'none', direction: 'auto', fills: solid('#20202a'), w: 240, h: 44,
};
const FRAME = { fills: solid('#ffffff'), w: 400, h: 300, clip: true };

/** A node as the editor stores it: the node() defaults, then the given props. */
function node(type, props) {
    const name = type[0].toUpperCase() + type.slice(1);
    return {
        name, parentId: null, x: 0, y: 0, w: 160, h: 100, ...COMMON,
        ...(type === 'text' ? TEXT : {}), ...(type === 'frame' ? FRAME : {}), type, ...props,
    };
}

const main = buttonModel();
const legacyModel = buttonModel({ ids: { variant: 'c-variant-b' }, prefix: 'b-', shared: main.ids });
const ids = { variant: main.ids.variant, variantLegacy: legacyModel.ids.variant, color: main.ids.color, size: main.ids.size };

/**
 * The variable bindings a master (and its instances, which get them copied by sync) holds: the root and its label bound to the
 * Button variables of one Variant set. `prefix` picks the Variant items of that set.
 */
const bindings = prefix => ({
    root: { 'fills.0': `${prefix}v-bg`, stroke: `${prefix}v-border`, radius: 's-radius', padH: 's-paddingX', padV: 's-paddingY', gap: 's-gap', minW: 's-height' },
    label: { 'fills.0': `${prefix}v-fg`, fontSize: 's-fontSize', lineHeight: 's-lineHeight' },
});
/** A Button master: a root auto layout frame with its label, bound to the template, or unbound when `binding` is null. */
function master(id, name, x, binding, vars, y = 0) {
    const root = node('frame', {
        id, name, x, y, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12, layoutSizingH: 'hug', strokeWidth: 1, strokeAlign: 'inside',
        layoutSizingV: 'hug', fills: solid('#0058CA'), radius: 8, ...(binding ? { behavior: { version: BEHAVIOR_DATA_VERSION, ...binding }, vars: vars.root } : {}),
    });
    const label = node('text', { id: `${id}-label`, name: 'Label', parentId: id, text: 'Button', w: 80, h: 24, autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), fontSize: 14, ...(binding ? { vars: vars.label } : {}) });
    return [root, label];
}

/**
 * An icon component in the file, the icons a Button's icon slot can show: a root frame named Icon/<name> with one path. A filled
 * icon has a closed filled path; a stroked icon has an open path with no fill, so its colour is its stroke.
 */
function iconComponent(id, name, x, filled) {
    const root = node('frame', { id, name: `Icon/${name}`, x, y: 0, w: 24, h: 24, component: true, fills: [], clip: false });
    const path = node('path', {
        id: `${id}-path`, name, parentId: id, w: 24, h: 24, pathW: 24, pathH: 24, closed: filled,
        points: filled ? [{ x: 4, y: 4 }, { x: 20, y: 12 }, { x: 4, y: 20 }] : [{ x: 4, y: 12 }, { x: 20, y: 12 }],
        fills: filled ? solid('#20202a') : [], stroke: '#20202a', strokeWidth: filled ? 0 : 2,
    });
    return [root, path];
}

/**
 * The nested instance a managed slot holds: a copy of the icon component, sized to fill the slot, with the bindings the icon slot
 * takes (iconSlotBindings), as the editor writes them on each sync. `slot` is the managed slot's own vars (its size).
 */
function iconInstance(slotId, componentId, components, disabled) {
    const copies = components.filter(c => c.id === componentId || c.parentId === componentId);
    const map = new Map(copies.map(c => [c.id, `${slotId}-ic-${c.id}`]));
    const layers = copies.map(c => ({
        id: map.get(c.id), fillIndexes: (c.fills || []).flatMap((f, i) => (f.visible !== false ? [i] : [])), stroke: !!c.stroke && c.strokeWidth > 0,
    }));
    const names = Object.fromEntries(Object.entries(iconSlotTargets(BUTTON)).map(([role, target]) => [role, target.name]));
    const plan = iconSlotBindings({ fg: 'v-fg', fgDisabled: 'v-fg-disabled', size: 's-iconSize', disabled, names, layers });
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

/**
 * An instance of a master: its Appearance modes (`varModes`), its props, its managed icon slot (when hasIcon is on: the slot holds the
 * icon component the props name, as a nested instance), and its label. The instance copies the master's bindings, as sync does.
 */
function instance(id, name, x, sourceId, props, varModes, vars, components) {
    const root = node('frame', {
        id, name, x, y: 120, w: 136, h: 48, isInstance: true, sourceId, layout: 'horizontal', gap: 6, padding: 12,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#0058CA'), radius: 8, behavior: { version: BEHAVIOR_DATA_VERSION, props },
        varModes, vars: vars.root,
    });
    const label = node('text', { id: `${id}-label`, name: 'Label', parentId: id, text: props.label, w: 80, h: 24, autoW: true, layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#ffffff'), fontSize: 14, vars: vars.label, sourceId: `${sourceId}-label` });
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
        const nested = componentId ? iconInstance(slotId, componentId, components, props.disabled === true) : null;
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

/**
 * The variables. Variant, Color and Size are bound to the main master. Variant B is bound to the legacy master, which has no
 * `button/bg-hover` value for Solid: that is the one deliberate error. The `card/` group sits in Variant too, to show that Button
 * never reads another component's variables.
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

const BOUND = main.binding;
const LEGACY = legacyModel.binding;
const MODES = (variant, color, size) => ({ [ids.variant]: variant, [ids.color]: color, [ids.size]: size });

/** The fixture document. Five pages, so a lazy open applies (more than three pages). */
export function buildBehaviorFixture() {
    const icons = [...iconComponent('icon-check', 'check', 800, true), ...iconComponent('icon-arrow', 'arrow', 1000, false)];
    const page1 = [
        ...master('main', 'Button', 0, BOUND, bindings('')),
        ...instance('inst-start', 'Save', 200, 'main', { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', label: 'Save' }, MODES('solid', 'primary', 'sm'), bindings(''), icons),
        ...instance('inst-plain', 'Cancel', 400, 'main', { hasIcon: false, label: 'Cancel' }, MODES('solid', 'danger', 'lg'), bindings(''), icons),
        ...instance('inst-both', 'Both', 400, 'main', { hasIcon: true, iconPlacement: 'both', icon: 'icon-check', iconEnd: 'icon-arrow', label: 'Both' }, MODES('solid', 'primary', 'sm'), bindings(''), icons),
        ...master('unbound', 'Unbound', 600, null, { root: {}, label: {} }, 0),
        ...master('legacy', 'Button (legacy)', 0, LEGACY, bindings('b-'), 240),
        ...icons,
    ];
    // The master's root has a stroke, so the Focus preview (border) is visible on the canvas; instances copy it.
    page1[0].strokeWidth = 2;
    const page2 = instance('inst-cross', 'Next', 0, 'main', { hasIcon: true, iconPlacement: 'end', iconEnd: 'icon-arrow', label: 'Next' }, MODES('solid', 'primary', 'sm'), bindings(''), icons);
    const pages = [
        { id: 'page-components', name: 'Components', nodes: page1 },
        { id: 'page-screens', name: 'Screens', nodes: page2 },
        { id: 'page-empty-3', name: 'Empty 3', nodes: [] },
        { id: 'page-empty-4', name: 'Empty 4', nodes: [] },
        { id: 'page-empty-5', name: 'Empty 5', nodes: [] },
    ];
    return {
        format: 'midas', version: 1, name: 'Behavior fixture', pageId: 'page-components', pages,
        tokens: { colors: [], typography: [] }, assets: {}, variables: variables(),
    };
}

/** The managed-layer clipboard payload: one icon slot copied alone (the paste guard refuses it, naming the layer). */
export function buildManagedLayerClipboard() {
    const layer = node('frame', { id: 'clip-icon-start', name: 'iconStart', parentId: null, x: 0, y: 0, w: 16, h: 16, clip: false, behavior: { version: BEHAVIOR_DATA_VERSION, slot: 'iconStart' } });
    return { format: 'midas-clipboard', rootIds: [layer.id], nodes: [layer], assets: {} };
}

// Run directly: write the fixture and the clipboard payload (the directory is created if missing).
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
    writeFileSync(FIXTURE_PATH, JSON.stringify(buildBehaviorFixture(), null, 2) + '\n');
    writeFileSync(CLIPBOARD_PATH, JSON.stringify(buildManagedLayerClipboard(), null, 2) + '\n');
    console.log(`Wrote ${FIXTURE_PATH}`);
    console.log(`Wrote ${CLIPBOARD_PATH}`);
}
