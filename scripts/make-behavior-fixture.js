// Builds the Behavior manual-test document: scripts/fixtures/behavior-fixture.midas. Run `node scripts/make-behavior-fixture.js`,
// then open the file with Import file on the home screen (or import it into a workspace). A saved copy reopens lazily,
// because it has more than three pages. The node defaults below mirror node() in apps/studio/src/engine/midas.js: keep them in step.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';
import { iconSlotBindings } from '../packages/builder-core/src/behavior-engine/icon-slot.js';
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

const ids = { variant: 'c-variant', variantLegacy: 'c-variant-b', size: 'c-size' };
const modes = { primary: { id: 'primary', name: 'Primary' }, danger: { id: 'danger', name: 'Danger' }, sm: { id: 'sm', name: 'Small' }, lg: { id: 'lg', name: 'Large' } };

/**
 * The variable bindings a master (and its instances, which get them copied by sync) holds: the root and its label bound to the
 * Button variables of one Variant set. `suffix` picks the Variant items of that set.
 */
const bindings = suffix => ({
    root: { fill: `i-bg${suffix}`, stroke: `i-border${suffix}`, radius: 'i-radius', padH: 'i-px', padV: 'i-py', gap: 'i-gap' },
    label: { fill: `i-fg${suffix}`, fontSize: 'i-fs', lineHeight: 'i-lh' },
});

/** A Button master: a root auto layout frame with its label, bound to the template, or unbound when `binding` is null. */
function master(id, name, x, binding, vars, y = 0) {
    const root = node('frame', {
        id, name, x, y, w: 136, h: 48, component: true, layout: 'horizontal', gap: 6, padding: 12, layoutSizingH: 'hug',
        layoutSizingV: 'hug', fills: solid('#0058CA'), radius: 8, ...(binding ? { behavior: { version: BEHAVIOR_DATA_VERSION, ...binding }, vars: vars.root } : {}),
    });
    const label = node('text', { id: `${id}-label`, name: 'Label', parentId: id, text: 'Button', w: 80, h: 24, fills: solid('#ffffff'), fontSize: 14, ...(binding ? { vars: vars.label } : {}) });
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
    const plan = iconSlotBindings({ fg: 'i-fg-v', fgDisabled: 'i-fg-disabled-v', size: 'i-icon', disabled, layers });
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
    const label = node('text', { id: `${id}-label`, name: 'Label', parentId: id, text: props.label, w: 80, h: 24, fills: solid('#ffffff'), fontSize: 14, vars: vars.label, sourceId: `${sourceId}-label` });
    const icon = props.hasIcon ? props.iconPlacement : null;
    if (!icon) return [root, label];
    const slot = `icon${icon[0].toUpperCase()}${icon.slice(1)}`, slotId = `${id}-icon-${icon}`;
    const nested = props.icon ? iconInstance(slotId, props.icon, components, props.disabled === true) : null;
    const iconLayer = node('frame', {
        id: slotId, name: slot, parentId: id, w: 16, h: 16, clip: !!nested,
        ...(nested
            ? { layout: 'horizontal', padding: 0, padT: 0, padR: 0, padB: 0, padL: 0, fills: [], vars: nested.slotVars }
            : { fills: solid('#8c8297'), layout: 'none' }),
        behavior: { version: BEHAVIOR_DATA_VERSION, slot },
    });
    const kids = icon === 'start' ? [iconLayer, label] : [label, iconLayer];
    return [root, ...kids, ...(nested ? nested.nodes : [])];
}

const collection = (id, name, modeList) => ({ id, name, modes: modeList });
const color = (id, name, collectionId, values) => ({ id, name, type: 'color', collectionId, values });
const number = (id, name, collectionId, values) => ({ id, name, type: 'number', collectionId, values });

/**
 * The variables. Variant and Size are bound to the main master. Variant B is bound to the legacy master, which has no
 * `button/bg-hover` value in Danger: that is the one deliberate error. The `card/` group sits in Variant too, to show that Button
 * never reads another component's variables. The icon size follows the font size of each Size mode (+2 px).
 */
function variables() {
    const variantTokens = (suffix, vals) => [
        color(`i-bg${suffix}`, 'button/bg', ids.variant, vals.bg), color(`i-bg-hover${suffix}`, 'button/bg-hover', ids.variant, vals.bgHover),
        color(`i-bg-active${suffix}`, 'button/bg-active', ids.variant, vals.bgActive), color(`i-bg-disabled${suffix}`, 'button/bg-disabled', ids.variant, vals.bgDisabled),
        color(`i-fg${suffix}`, 'button/fg', ids.variant, vals.fg), color(`i-fg-disabled${suffix}`, 'button/fg-disabled', ids.variant, vals.fgDisabled),
        color(`i-border${suffix}`, 'button/border', ids.variant, vals.border), color(`i-border-focus${suffix}`, 'button/border-focus', ids.variant, vals.borderFocus),
    ];
    const sizeTokens = [
        number('i-fs', 'button/fontSize', ids.size, { sm: 14, lg: 18 }), number('i-lh', 'button/lineHeight', ids.size, { sm: 20, lg: 27 }),
        number('i-px', 'button/paddingX', ids.size, { sm: 12, lg: 16 }), number('i-py', 'button/paddingY', ids.size, { sm: 6, lg: 8 }),
        number('i-gap', 'button/gap', ids.size, { sm: 6, lg: 8 }), number('i-radius', 'button/radius', ids.size, { sm: 6, lg: 8 }),
        number('i-icon', 'button/icon-size', ids.size, { sm: 16, lg: 20 }),
    ];
    const full = variantTokens('-v', {
        bg: { primary: '#4338ca', danger: '#dc2626' }, bgHover: { primary: '#3730a3', danger: '#b91c1c' },
        bgActive: { primary: '#312e81', danger: '#991b1b' }, bgDisabled: { primary: '#a5b4fc', danger: '#fca5a5' },
        fg: { primary: '#ffffff', danger: '#fde68a' }, fgDisabled: { primary: '#e0e7ff', danger: '#fee2e2' },
        border: { primary: '#4338ca', danger: '#dc2626' }, borderFocus: { primary: '#818cf8', danger: '#f87171' },
    });
    // Variant B: no bg-hover value in Danger.
    const legacy = variantTokens('-b', {
        bg: { primary: '#4338ca', danger: '#dc2626' }, bgHover: { primary: '#3730a3' },
        bgActive: { primary: '#312e81', danger: '#991b1b' }, bgDisabled: { primary: '#a5b4fc', danger: '#fca5a5' },
        fg: { primary: '#ffffff', danger: '#ffffff' }, fgDisabled: { primary: '#e0e7ff', danger: '#fee2e2' },
        border: { primary: '#4338ca', danger: '#dc2626' }, borderFocus: { primary: '#818cf8', danger: '#f87171' },
    }).map(item => ({ ...item, collectionId: ids.variantLegacy }));
    const card = [
        color('i-card-bg-v', 'card/bg', ids.variant, { primary: '#ffffff', danger: '#fff1f1' }),
        color('i-card-fg-v', 'card/fg', ids.variant, { primary: '#20202a', danger: '#20202a' }),
    ];
    return {
        collections: [
            collection(ids.variant, 'Variant', [modes.primary, modes.danger]),
            collection(ids.variantLegacy, 'Variant B', [modes.primary, modes.danger]),
            collection(ids.size, 'Size', [modes.sm, modes.lg]),
        ],
        items: [...full, ...legacy, ...card, ...sizeTokens],
    };
}

const BOUND = { templateId: 'button', variables: { variant: ids.variant, size: ids.size } };
const LEGACY = { templateId: 'button', variables: { variant: ids.variantLegacy, size: ids.size } };

/** The fixture document. Five pages, so a lazy open applies (more than three pages). */
export function buildBehaviorFixture() {
    const icons = [...iconComponent('icon-check', 'check', 800, true), ...iconComponent('icon-arrow', 'arrow', 1000, false)];
    const page1 = [
        ...master('main', 'Button', 0, BOUND, bindings('-v')),
        ...instance('inst-start', 'Save', 200, 'main', { hasIcon: true, iconPlacement: 'start', icon: 'icon-check', label: 'Save' }, { [ids.variant]: 'primary', [ids.size]: 'sm' }, bindings('-v'), icons),
        ...instance('inst-plain', 'Cancel', 400, 'main', { hasIcon: false, label: 'Cancel' }, { [ids.variant]: 'danger', [ids.size]: 'lg' }, bindings('-v'), icons),
        ...master('unbound', 'Unbound', 600, null, { root: {}, label: {} }, 0),
        ...master('legacy', 'Button (legacy)', 0, LEGACY, bindings('-b'), 240),
        ...icons,
    ];
    // The master's root has a stroke, so the Focus preview (border) is visible on the canvas; instances copy it.
    page1[0].strokeWidth = 2;
    const page2 = instance('inst-cross', 'Next', 0, 'main', { hasIcon: true, iconPlacement: 'end', icon: 'icon-arrow', label: 'Next' }, { [ids.variant]: 'primary', [ids.size]: 'sm' }, bindings('-v'), icons);
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
