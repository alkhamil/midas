// The built-in icon set (data) and its planning (pure). Every icon slot of every template takes the file's default icon, the first component named Icon/<name>
// (see createdIconDefaults), so a file with no icon has empty slots. The Design System bundle creates what the file lacks from this set: one icon per role the
// registry's schemas ask for. A template that needs an icon of its own adds it here (a name, a role and a vector path); nothing in the bundle names a template.
import { iconDefsOf } from './anatomy.js';

/** The file convention for an icon component's name. */
export const ICON_PREFIX = 'Icon/';

/** The size of an icon component's box and of its path space, in px. */
const SIZE = 24;
/** The control distance of a bezier circle, for a radius of 10: radius times 0.5523. */
const K = 5.523;
/** The control distance of a bezier circle of radius 12: radius times 0.5523. */
const K12 = 6.6276;
const at = (x, y, inX, inY, outX, outY) => (inX === undefined ? { x, y } : { x, y, in: { x: inX, y: inY }, out: { x: outX, y: outY } });

/**
 * The icons the bundle creates. `role` is the need they fill (`default`: the icon every slot takes until the designer chooses one), `points` the closed outline
 * in a 24 x 24 space (bezier handles absolute), filled so the foreground colour binds to it.
 * @type {{ name: string, role: string, closed: boolean, points: { x: number, y: number, in?: { x: number, y: number }, out?: { x: number, y: number } }[] }[]}
 */
export const ICON_SET = [
    // A disc: neutral for a button's icon and for the clear icon, which takes the same default.
    { name: 'circle', role: 'default', closed: true, points: [at(12, 2, 12 - K, 2, 12 + K, 2), at(22, 12, 22, 12 - K, 22, 12 + K), at(12, 22, 12 + K, 22, 12 - K, 22), at(2, 12, 2, 12 + K, 2, 12 - K)] },
    // The Checkbox's glyphs: the checkmark of a checked box and the square of an indeterminate one, each the icon its slot starts with.
    { name: 'check', role: 'check', closed: true, points: [at(2.5, 12.5), at(5, 10), at(9.5, 14.5), at(19, 5), at(21.5, 7.5), at(9.5, 19.5)] },
    { name: 'square', role: 'indeterminate', closed: true, points: [at(0, 0), at(24, 0), at(24, 24), at(0, 24)] },
    // The Radio's dot: a full-bleed disc, which its 8px slot draws as the dot.
    { name: 'dot', role: 'dot', closed: true, points: [at(12, 0, 12 - K12, 0, 12 + K12, 0), at(24, 12, 24, 12 - K12, 24, 12 + K12), at(12, 24, 12 + K12, 24, 12 - K12, 24), at(0, 12, 0, 12 + K12, 0, 12 - K12)] },
];

/**
 * The icon roles a set of templates asks for, in order: one per icon def that holds an icon component (a def says its role, `default` when it says none).
 * @param {{ icons?: any[] }[]} templates
 * @returns {string[]}
 */
export function iconRolesOf(templates) {
    const roles = [];
    for (const template of templates) {
        for (const def of iconDefsOf(template)) {
            const role = def.role ?? 'default';
            if (def.component && !roles.includes(role)) roles.push(role);
        }
    }
    return roles;
}

/**
 * The file's default icon: the id of the first component named Icon/<name>, on any page and at any depth (the Design System page keeps its icons in a section).
 * Null when the file has none. The one definition the editor and the bundle read.
 * @param {{ nodes?: any[] }[]} pages
 * @returns {string | null}
 */
export function defaultIconOf(pages) {
    for (const page of pages) {
        const icon = (page.nodes ?? []).find(n => n.component === true && typeof n.name === 'string' && n.name.startsWith(ICON_PREFIX));
        if (icon) return icon.id;
    }
    return null;
}

/**
 * The icon each role starts with in this file: a function from a role to the id of the file's component named for it (the set's entry of that role), else the
 * default icon, else null. The one definition the editor and the bundle read, as for the default icon.
 * @param {{ nodes?: any[] }[]} pages
 * @param {typeof ICON_SET} [set]
 * @returns {(role: string) => string | null}
 */
export function iconResolverOf(pages, set = ICON_SET) {
    const byName = new Map();
    for (const page of pages) for (const n of page.nodes ?? []) if (n.component === true && typeof n.name === 'string' && !byName.has(n.name)) byName.set(n.name, n.id);
    const fallback = defaultIconOf(pages);
    return role => {
        const entry = set.find(e => e.role === role);
        return (entry && byName.get(ICON_PREFIX + entry.name)) ?? fallback;
    };
}

/**
 * What the bundle does for the icons in this file: the set's icons to create, and those already there. An icon is there when a component of that name exists
 * (never replaced, a designer's or an imported one included), and a role with a default icon already in the file needs none of its own.
 * @param {{ pages: { nodes?: any[] }[] }} input
 * @param {typeof ICON_SET} [set]
 */
export function planIcons({ pages }, set = ICON_SET) {
    const names = new Set(pages.flatMap(p => (p.nodes ?? []).filter(n => n.component === true).map(n => n.name)));
    const haveDefault = defaultIconOf(pages) !== null;
    const create = [], present = [];
    for (const entry of set) {
        (names.has(ICON_PREFIX + entry.name) || (entry.role === 'default' && haveDefault) ? present : create).push(entry);
    }
    return { create, present };
}

/**
 * An icon's nodes: the component frame and its vector path, as the engine's icon slots expect them (an auto layout frame, a filled path). `idOf(key)` gives each an id.
 * @param {typeof ICON_SET[number]} entry
 * @param {(key: string) => string} idOf
 */
export function iconNodes(entry, idOf) {
    const id = idOf(`${ICON_PREFIX}${entry.name}`), pathId = idOf(`${ICON_PREFIX}${entry.name}/path`);
    const root = { id, name: ICON_PREFIX + entry.name, type: 'frame', parentId: null, x: 0, y: 0, w: SIZE, h: SIZE, component: true, layout: 'horizontal', gap: 0, padding: 0, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: [], clip: false, stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, rotation: 0, version: 0 };
    const path = {
        id: pathId, name: entry.name, type: 'path', parentId: id, x: 0, y: 0, w: SIZE, h: SIZE, pathW: SIZE, pathH: SIZE, closed: entry.closed,
        // The path fills its frame, so in an instance sized to a slot (the icon size) it scales with it; a fixed path would stay SIZE px and show a corner of the outline.
        layoutSizingH: 'fill', layoutSizingV: 'fill',
        points: structuredClone(entry.points), fills: [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }], stroke: '#20202a', strokeWidth: 0,
        rotation: 0, opacity: 1, visible: true, locked: false, clip: false, radius: 0, version: 0,
    };
    return [root, path];
}
