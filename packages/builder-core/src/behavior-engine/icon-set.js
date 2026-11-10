// The built-in icon set (data) and its planning (pure). Every icon slot of every template takes the file's default icon, the first component named Icon/<name>
// (see createdIconDefaults), so a file with no icon has empty slots. The Design System bundle creates what the file lacks from this set: one icon per role the
// registry's schemas ask for. A template that needs an icon of its own adds it here (a name, a role and a vector path); nothing in the bundle names a template.
import { iconDefsOf } from './anatomy.js';
import { normalizeVectorGeometry } from '../geometry/vector-bounds.js';

/** The file convention for an icon component's name. */
export const ICON_PREFIX = 'Icon/';

/** The size of an icon component's box and of its path space, in px. */
const SIZE = 24;
/** The control distance of a bezier circle, for a radius of 10: radius times 0.5523. */
const K = 5.523;
const at = (x, y, inX, inY, outX, outY) => ({ x, y, in: { x: inX, y: inY }, out: { x: outX, y: outY } });

/**
 * The icons the bundle creates. `role` is the need they fill (`default`: the icon every slot takes until the designer chooses one), `points` the closed outline
 * in a 24 x 24 space (bezier handles absolute), filled so the foreground colour binds to it.
 * An entry may add `contours` (further sub-paths, each { points, closed }) and a `fillRule` ('evenodd'); both are optional.
 * @type {{ name: string, role: string, closed: boolean, points: { x: number, y: number, in?: { x: number, y: number }, out?: { x: number, y: number } }[], contours?: { points: { x: number, y: number, in?: { x: number, y: number }, out?: { x: number, y: number } }[], closed: boolean }[], fillRule?: 'evenodd' }[]}
 */
export const ICON_SET = [
    // A disc: neutral for a button's icon and for the clear icon, which takes the same default.
    { name: 'circle', role: 'default', closed: true, points: [at(12, 2, 12 - K, 2, 12 + K, 2), at(22, 12, 22, 12 - K, 22, 12 + K), at(12, 22, 12 + K, 22, 12 - K, 22), at(2, 12, 2, 12 + K, 2, 12 - K)] },
    // A close cross: one closed polygon of straight edges (no handles), the close of a dismissible element (Tag).
    { name: 'close', role: 'close', closed: true, points: [[5.293, 6.707], [6.707, 5.293], [12, 10.586], [17.293, 5.293], [18.707, 6.707], [13.414, 12], [18.707, 17.293], [17.293, 18.707], [12, 13.414], [6.707, 18.707], [5.293, 17.293], [10.586, 12]].map(([x, y]) => ({ x, y })) },
    // The solar eye glyph (CC BY 4.0), converted losslessly: every sub-path with its handles, the even-odd fill rule.
    {
        name: 'eye', role: 'eyeOn', closed: true, fillRule: 'evenodd',
        points: [
            { x: 12, y: 8.25, in: { x: 14.0711, y: 8.25 }, out: { x: 9.92893, y: 8.25 } },
            { x: 8.25, y: 12, in: { x: 8.25, y: 9.92893 }, out: { x: 8.25, y: 14.0711 } },
            { x: 12, y: 15.75, in: { x: 9.92893, y: 15.75 }, out: { x: 14.0711, y: 15.75 } },
            { x: 15.75, y: 12, in: { x: 15.75, y: 14.0711 }, out: { x: 15.75, y: 9.92893 } },
        ],
        contours: [
            { points: [
            { x: 9.75, y: 12, in: { x: 9.75, y: 13.2426 }, out: { x: 9.75, y: 10.7574 } },
            { x: 12, y: 9.75, in: { x: 10.7574, y: 9.75 }, out: { x: 13.2426, y: 9.75 } },
            { x: 14.25, y: 12, in: { x: 14.25, y: 10.7574 }, out: { x: 14.25, y: 13.2426 } },
            { x: 12, y: 14.25, in: { x: 13.2426, y: 14.25 }, out: { x: 10.7574, y: 14.25 } },
        ], closed: true },
            { points: [
            { x: 12, y: 3.25, in: { x: 16.5141, y: 3.25 }, out: { x: 7.48587, y: 3.25 } },
            { x: 2.68057, y: 8.24686, in: { x: 4.44529, y: 5.9542 } },
            { x: 2.64874, y: 8.2882, out: { x: 2.24964, y: 8.80653 } },
            { x: 1.63269, y: 9.8484, in: { x: 1.88206, y: 9.28392 }, out: { x: 1.36564, y: 10.4529 } },
            { x: 1.25, y: 12, in: { x: 1.25, y: 11.1117 }, out: { x: 1.25, y: 12.8883 } },
            { x: 1.63269, y: 14.1516, in: { x: 1.36564, y: 13.5471 }, out: { x: 1.88206, y: 14.7161 } },
            { x: 2.64875, y: 15.7118, in: { x: 2.24964, y: 15.1935 } },
            { x: 2.68057, y: 15.7531, out: { x: 4.44529, y: 18.0458 } },
            { x: 12, y: 20.75, in: { x: 7.48587, y: 20.75 }, out: { x: 16.5141, y: 20.75 } },
            { x: 21.3194, y: 15.7531, in: { x: 19.5547, y: 18.0458 } },
            { x: 21.3512, y: 15.7118, out: { x: 21.7504, y: 15.1935 } },
            { x: 22.3673, y: 14.1516, in: { x: 22.1179, y: 14.7161 }, out: { x: 22.6344, y: 13.5471 } },
            { x: 22.75, y: 12, in: { x: 22.75, y: 12.8883 }, out: { x: 22.75, y: 11.1117 } },
            { x: 22.3673, y: 9.8484, in: { x: 22.6344, y: 10.4529 }, out: { x: 22.1179, y: 9.28391 } },
            { x: 21.3512, y: 8.28818, in: { x: 21.7504, y: 8.80652 } },
            { x: 21.3194, y: 8.24686, out: { x: 19.5547, y: 5.9542 } },
        ], closed: true },
            { points: [
            { x: 3.86922, y: 9.1618, in: { x: 3.43063, y: 9.73159 }, out: { x: 5.49864, y: 7.04492 } },
            { x: 12, y: 4.75, in: { x: 8.15036, y: 4.75 }, out: { x: 15.8496, y: 4.75 } },
            { x: 20.1308, y: 9.1618, in: { x: 18.5014, y: 7.04492 }, out: { x: 20.5694, y: 9.73159 } },
            { x: 20.9952, y: 10.4545, in: { x: 20.8263, y: 10.0721 }, out: { x: 21.1532, y: 10.812 } },
            { x: 21.25, y: 12, in: { x: 21.25, y: 11.2489 }, out: { x: 21.25, y: 12.7511 } },
            { x: 20.9952, y: 13.5455, in: { x: 21.1532, y: 13.188 }, out: { x: 20.8263, y: 13.9279 } },
            { x: 20.1308, y: 14.8382, in: { x: 20.5694, y: 14.2684 }, out: { x: 18.5014, y: 16.9551 } },
            { x: 12, y: 19.25, in: { x: 15.8496, y: 19.25 }, out: { x: 8.15036, y: 19.25 } },
            { x: 3.86922, y: 14.8382, in: { x: 5.49864, y: 16.9551 }, out: { x: 3.43064, y: 14.2684 } },
            { x: 3.00476, y: 13.5455, in: { x: 3.17374, y: 13.9279 }, out: { x: 2.84684, y: 13.188 } },
            { x: 2.75, y: 12, in: { x: 2.75, y: 12.7511 }, out: { x: 2.75, y: 11.2489 } },
            { x: 3.00476, y: 10.4545, in: { x: 2.84684, y: 10.812 }, out: { x: 3.17374, y: 10.0721 } },
        ], closed: true },
        ],
    },
    // The solar eye-off glyph (CC BY 4.0), converted losslessly: every sub-path with its handles, the even-odd fill rule.
    {
        name: 'eyeOff', role: 'eyeOff', closed: true, fillRule: 'evenodd',
        points: [
            { x: 22.2954, y: 6.31065, out: { x: 22.6761, y: 6.47382 } },
            { x: 22.6893, y: 7.29545, in: { x: 22.8524, y: 6.91473 } },
            { x: 21.9999, y: 7.00001, out: { x: 22.6893, y: 7.29545 } },
            { x: 22.6893, y: 7.29545, in: { x: 22.6894, y: 7.29527 } },
            { x: 22.6886, y: 7.29713 },
            { x: 22.6875, y: 7.29961 },
            { x: 22.6843, y: 7.30697 },
            { x: 22.6736, y: 7.33105, out: { x: 22.6646, y: 7.35118 } },
            { x: 22.6352, y: 7.41508, in: { x: 22.6518, y: 7.3794 }, out: { x: 22.6019, y: 7.48643 } },
            { x: 22.4888, y: 7.71416, in: { x: 22.5533, y: 7.58776 }, out: { x: 22.3599, y: 7.96681 } },
            { x: 21.9084, y: 8.73647, in: { x: 22.1675, y: 8.32069 }, out: { x: 21.4828, y: 9.41951 } },
            { x: 20.0619, y: 11.1302, in: { x: 20.8724, y: 10.2777 } },
            { x: 21.0303, y: 12.0985, out: { x: 21.3231, y: 12.3914 } },
            { x: 21.0303, y: 13.1592, in: { x: 21.3231, y: 12.8663 }, out: { x: 20.7374, y: 13.4521 } },
            { x: 19.9696, y: 13.1592, in: { x: 20.2625, y: 13.4521 } },
            { x: 18.969, y: 12.1586, out: { x: 18.3093, y: 12.7113 } },
            { x: 16.695, y: 13.6562, in: { x: 17.5528, y: 13.23 } },
            { x: 17.6286, y: 15.091, out: { x: 17.8545, y: 15.4382 } },
            { x: 17.409, y: 16.1286, in: { x: 17.7562, y: 15.9027 }, out: { x: 17.0618, y: 16.3546 } },
            { x: 16.3713, y: 15.909, in: { x: 16.5972, y: 16.2562 } },
            { x: 15.2821, y: 14.2352, out: { x: 14.5028, y: 14.4897 } },
            { x: 12.7499, y: 14.7246, in: { x: 13.659, y: 14.6626 } },
            { x: 12.7499, y: 16.5, out: { x: 12.7499, y: 16.9142 } },
            { x: 11.9999, y: 17.25, in: { x: 12.4141, y: 17.25 }, out: { x: 11.5857, y: 17.25 } },
            { x: 11.2499, y: 16.5, in: { x: 11.2499, y: 16.9142 } },
            { x: 11.2499, y: 14.7246, out: { x: 10.3689, y: 14.6645 } },
            { x: 8.78982, y: 14.2584, in: { x: 9.54909, y: 14.5002 } },
            { x: 7.71575, y: 15.9091, out: { x: 7.48984, y: 16.2563 } },
            { x: 6.67807, y: 16.1287, in: { x: 7.02526, y: 16.3546 }, out: { x: 6.33089, y: 15.9028 } },
            { x: 6.45847, y: 15.091, in: { x: 6.23257, y: 15.4382 } },
            { x: 7.37089, y: 13.6888, out: { x: 6.5065, y: 13.2667 } },
            { x: 5.07842, y: 12.1983, in: { x: 5.74381, y: 12.7502 } },
            { x: 4.11744, y: 13.1592, out: { x: 3.82455, y: 13.4521 } },
            { x: 3.05678, y: 13.1592, in: { x: 3.34968, y: 13.4521 }, out: { x: 2.76389, y: 12.8664 } },
            { x: 3.05678, y: 12.0986, in: { x: 2.76389, y: 12.3915 } },
            { x: 3.98055, y: 11.1748, out: { x: 3.15599, y: 10.3151 } },
            { x: 2.10277, y: 8.75468, in: { x: 2.53525, y: 9.44656 }, out: { x: 1.83984, y: 8.33404 } },
            { x: 1.51388, y: 7.7197, in: { x: 1.6446, y: 7.97566 }, out: { x: 1.44848, y: 7.59164 } },
            { x: 1.36537, y: 7.41665, in: { x: 1.3991, y: 7.48895 }, out: { x: 1.3485, y: 7.38048 } },
            { x: 1.32641, y: 7.33149, in: { x: 1.33553, y: 7.35189 } },
            { x: 1.31562, y: 7.3071 },
            { x: 1.31238, y: 7.29966 },
            { x: 1.31129, y: 7.29714 },
            { x: 1.31088, y: 7.29619, out: { x: 1.31081, y: 7.29602 } },
            { x: 1.99992, y: 7.00001, in: { x: 1.31056, y: 7.29545 } },
            { x: 1.31088, y: 7.29619, out: { x: 1.14772, y: 6.91547 } },
            { x: 1.70448, y: 6.31065, in: { x: 1.32376, y: 6.47382 }, out: { x: 2.08489, y: 6.14762 } },
            { x: 2.68888, y: 6.70363, in: { x: 2.52539, y: 6.32356 }, out: { x: 2.68894, y: 6.70376 } },
            { x: 2.68888, y: 6.70363, in: { x: 2.68882, y: 6.7035 } },
            { x: 2.68983, y: 6.70582 },
            { x: 2.69591, y: 6.71953, out: { x: 2.7018, y: 6.73273 } },
            { x: 2.72472, y: 6.78249, in: { x: 2.7114, y: 6.75392 }, out: { x: 2.75139, y: 6.83965 } },
            { x: 2.84976, y: 7.03748, in: { x: 2.79296, y: 6.92626 }, out: { x: 2.96345, y: 7.2601 } },
            { x: 3.37472, y: 7.95961, in: { x: 3.13762, y: 7.58028 }, out: { x: 3.85033, y: 8.72048 } },
            { x: 5.55561, y: 10.6216, in: { x: 4.57157, y: 9.7071 }, out: { x: 6.42151, y: 11.4263 } },
            { x: 8.75165, y: 12.6558, in: { x: 7.48259, y: 12.1676 }, out: { x: 9.70614, y: 13.023 } },
            { x: 11.9999, y: 13.25, in: { x: 10.7854, y: 13.25 }, out: { x: 13.2416, y: 13.25 } },
            { x: 15.3124, y: 12.6308, in: { x: 14.342, y: 13.0128 }, out: { x: 16.5738, y: 12.1343 } },
            { x: 18.4866, y: 10.582, in: { x: 17.6277, y: 11.3883 }, out: { x: 19.4562, y: 9.67198 } },
            { x: 20.6354, y: 7.94321, in: { x: 20.1668, y: 8.69517 }, out: { x: 20.869, y: 7.56832 } },
            { x: 21.1525, y: 7.03268, in: { x: 21.0405, y: 7.25228 }, out: { x: 21.2085, y: 6.92296 } },
            { x: 21.2757, y: 6.78125, in: { x: 21.2494, y: 6.83758 }, out: { x: 21.2888, y: 6.7531 } },
            { x: 21.3041, y: 6.71925, in: { x: 21.2983, y: 6.73224 } },
            { x: 21.31, y: 6.70577 },
            { x: 21.3106, y: 6.70457, out: { x: 21.3106, y: 6.70447 } },
            { x: 21.3106, y: 6.70457, in: { x: 21.3105, y: 6.70467 } },
        ],
        contours: [
            { points: [
            { x: 22.2954, y: 6.31065, out: { x: 21.9147, y: 6.14753 } },
            { x: 21.3106, y: 6.70457, in: { x: 21.4738, y: 6.32405 } },
        ], closed: true },
            { points: [
            { x: 2.68888, y: 6.70363, in: { x: 2.68882, y: 6.7035 }, out: { x: 2.68894, y: 6.70376 } },
        ], closed: true },
        ],
    },
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
 * What the bundle does for the icons in this file: the set's icons to create, and those already there. An icon is there when a component of that name exists
 * (never replaced, a designer's or an imported one included), and a role with a default icon already in the file needs none of its own.
 * @param {{ pages: { nodes?: any[] }[] }} input
 * @param {typeof ICON_SET} [set]
 */
export function planIcons({ pages, roles }, set = ICON_SET) {
    const names = new Set(pages.flatMap(p => (p.nodes ?? []).filter(n => n.component === true).map(n => n.name)));
    const haveDefault = defaultIconOf(pages) !== null;
    const create = [], present = [];
    for (const entry of set) {
        // With a roles list (iconRolesOf of the registry), an icon no template asks for yet is left out of the plan.
        if (roles !== undefined && !roles.includes(entry.role)) continue;
        (names.has(ICON_PREFIX + entry.name) || (entry.role === 'default' && haveDefault) ? present : create).push(entry);
    }
    return { create, present };
}

/**
 * An icon's nodes: the component frame and its vector path, as the engine's icon slots expect them (an auto layout frame, a filled path in its tight box). `idOf(key)` gives each an id.
 * @param {typeof ICON_SET[number]} entry
 * @param {(key: string) => string} idOf
 */
export function iconNodes(entry, idOf) {
    // The vector is the tight box of its outline, placed at that offset in the frame (see normalizeVectorGeometry).
    const tight = normalizeVectorGeometry({ points: entry.points, contours: entry.contours, closed: entry.closed }, 1, 1);
    const id = idOf(`${ICON_PREFIX}${entry.name}`), pathId = idOf(`${ICON_PREFIX}${entry.name}/path`);
    const root = { id, name: ICON_PREFIX + entry.name, type: 'frame', parentId: null, x: 0, y: 0, w: SIZE, h: SIZE, component: true, layout: 'horizontal', gap: 0, padding: 0, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: [], clip: false, stroke: '#000000', strokeWidth: 0, radius: 0, opacity: 1, visible: true, locked: false, rotation: 0, version: 0 };
    const path = {
        id: pathId, name: entry.name, type: 'path', parentId: id, x: tight.dx, y: tight.dy, w: tight.w, h: tight.h, pathW: tight.w, pathH: tight.h, closed: entry.closed,
        // The glyph follows its frame by Scale, out of the flow: an instance sized to a slot (the icon size) scales it with the frame, uniformly (the frame is square), and it stays tight.
        layoutPositioning: 'absolute', constraintH: 'scale', constraintV: 'scale', layoutSizingH: 'fixed', layoutSizingV: 'fixed',
        points: tight.points, ...(tight.contours ? { contours: tight.contours } : {}), ...(entry.fillRule ? { fillRule: entry.fillRule } : {}),
        fills: [{ type: 'solid', color: '#20202a', opacity: 1, visible: true }], stroke: '#20202a', strokeWidth: 0,
        rotation: 0, opacity: 1, visible: true, locked: false, clip: false, radius: 0, version: 0,
    };
    return [root, path];
}

/**
 * The file's glyph for each role of the set: the id of the component named Icon/<name> for each ICON_SET entry with that role, when the file has it.
 * A role the file has no glyph for is absent (a slot asking for it falls back to the file's default icon).
 * @param {{ nodes?: any[] }[]} pages
 * @returns {Record<string, string>}
 */
export function roleIconsOf(pages) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const entry of ICON_SET) {
        if (out[entry.role] !== undefined) continue;
        for (const page of pages) {
            const icon = (page.nodes ?? []).find(n => n.component === true && n.name === ICON_PREFIX + entry.name);
            if (icon) { out[entry.role] = icon.id; break; }
        }
    }
    return out;
}
