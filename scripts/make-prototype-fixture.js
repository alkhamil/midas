// Builds the prototype test document: the Behavior fixture's Button master, plus a Flow page with four frames (Home, Details, Confirm,
// Done) whose Button instances carry click, hover and after-delay interactions. `buildInvalidPrototypeFixture` is the same document
// with one destination that does not exist, for the validator. Run `node scripts/make-prototype-fixture.js` to write the file.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BEHAVIOR_DATA_VERSION } from '../packages/builder-core/src/behavior-engine/data.js';
import { buildBehaviorFixture } from './make-behavior-fixture.js';
const solid = (color, opacity = 1) => (color === 'none' ? [] : [{ type: 'solid', color, opacity, visible: true }]);

const here = dirname(fileURLToPath(import.meta.url));
export const PROTOTYPE_FIXTURE_PATH = resolve(here, 'fixtures/prototype-fixture.midas');

const PRIMARY = { id: 'c-variant', mode: 'primary' };
const DANGER = { id: 'c-variant', mode: 'danger' };
const SIZE = { id: 'c-size', mode: 'lg' };
const instant = { type: 'instant', durationMs: 0 };

/**
 * A Button instance of the fixture master, inside a frame, with its props, Appearance modes and interactions.
 * @param {string} id
 * @param {string} parentId the frame it sits in
 * @param {string} name
 * @param {Record<string, unknown>} props
 * @param {{ id: string, mode: string }} variant
 * @param {any[]} [interactions]
 */
function button(id, parentId, name, props, variant, interactions = []) {
    return {
        id, name, type: 'frame', parentId, x: 0, y: 0, w: 136, h: 48, isInstance: true, sourceId: 'main', version: 0,
        layoutSizingH: 'hug', layoutSizingV: 'hug', fills: solid('#0058CA'), radius: 8,
        behavior: { version: BEHAVIOR_DATA_VERSION, props: { label: name, disabled: false, hasIcon: false, ...props } },
        varModes: { [variant.id]: variant.mode, [SIZE.id]: SIZE.mode },
        ...(interactions.length ? { prototype: { version: 1, interactions } } : {}),
    };
}

/** A top-level frame, as a node: an auto layout column that holds its buttons. */
function screen(id, name, x) {
    return { id, name, type: 'frame', parentId: null, x, y: 0, w: 375, h: 667, layout: 'vertical', gap: 16, padding: 24, fills: solid('#ffffff'), clip: true, version: 0 };
}

/** A navigate-to interaction. */
const navigate = (id, destinationId, trigger = { type: 'on-click' }, transition = instant) => ({ id, trigger, action: { type: 'navigate-to', destinationId, transition } });

/**
 * The flow document. `broken` points one destination at a frame that does not exist.
 * @param {{ broken?: boolean }} [options]
 */
export function buildPrototypeFixture({ broken = false } = {}) {
    const doc = buildBehaviorFixture();
    doc.name = 'Prototype fixture';
    const nodes = [
        screen('frame-home', 'Home', 0),
        button('home-next', 'frame-home', 'Next', {}, PRIMARY, [navigate('home-next-go', 'frame-details', { type: 'on-click' }, { type: 'slide-in', direction: 'left', durationMs: 300, easing: 'ease-out' })]),
        button('home-delete', 'frame-home', 'Delete', {}, DANGER, [navigate('home-delete-go', 'frame-confirm', { type: 'mouse-enter' }, { type: 'dissolve', durationMs: 200, easing: 'linear' })]),
        button('home-off', 'frame-home', 'Unavailable', { disabled: true }, PRIMARY, [navigate('home-off-go', 'frame-details')]),
        screen('frame-details', 'Details', 480),
        button('details-back', 'frame-details', 'Back', {}, DANGER, [{ id: 'details-back-go', trigger: { type: 'on-click' }, action: { type: 'back' } }]),
        button('details-continue', 'frame-details', 'Continue', {}, PRIMARY, [navigate('details-continue-go', broken ? 'frame-missing' : 'frame-confirm', { type: 'on-click' }, { type: 'push', direction: 'top', durationMs: 250, easing: 'ease-in-out' })]),
        // A fixed-size layer wider than a phone frame: clipped by default, scrolled when the frame's Scroll behaviour opens the horizontal axis.
        { id: 'details-bar', name: 'Wide bar', type: 'rect', parentId: 'frame-details', x: 0, y: 0, w: 600, h: 40, layoutSizingH: 'fixed', layoutSizingV: 'fixed', fills: solid('#f59e0b'), version: 0 },
        screen('frame-confirm', 'Confirm', 960),
        button('confirm-done', 'frame-confirm', 'Done', {}, PRIMARY, [navigate('confirm-done-go', 'frame-done')]),
        button('confirm-cancel', 'frame-confirm', 'Cancel', {}, DANGER, [navigate('confirm-cancel-go', 'frame-home', { type: 'on-click' }, { type: 'dissolve', durationMs: 150, easing: 'linear' })]),
        screen('frame-done', 'Done', 1440),
        button('done-home', 'frame-done', 'Back home', {}, PRIMARY, [navigate('done-home-go', 'frame-home', { type: 'after-delay', delayMs: 1200 })]),
    ];
    doc.pages.push({
        id: 'page-flow', name: 'Flow', nodes,
        prototype: { version: 1, flows: [{ id: 'flow-main', name: 'Main', startFrameId: 'frame-home' }] },
    });
    return doc;
}

/** The same document with one destination that does not exist (for the validator's destination-missing code). */
export const buildInvalidPrototypeFixture = () => buildPrototypeFixture({ broken: true });

// Run directly: write the fixture file (the directory is created if missing).
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    mkdirSync(dirname(PROTOTYPE_FIXTURE_PATH), { recursive: true });
    writeFileSync(PROTOTYPE_FIXTURE_PATH, JSON.stringify(buildPrototypeFixture(), null, 2) + '\n');
    console.log(`Wrote ${PROTOTYPE_FIXTURE_PATH}`);
}
