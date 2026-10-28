// Play and editing helpers (pure). The Play overlay and the Prototype panel use these: the fit and zoom of a frame, the player context
// read from a document, the destinations a navigate-to can name, and the default interaction a new one starts from.
import { MOVING_TRANSITIONS } from './data.js';

/** The zoom levels the Play overlay steps through. */
export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2];

/**
 * The scale that fits a frame's width to the viewport. Fit never enlarges: a frame narrower than the viewport keeps its size.
 * Frames taller than the viewport scroll vertically, so only the width decides.
* @param {number} frameW
 * @param {number} viewW
 */
export function fitScale(frameW, viewW) {
    if (!(viewW > 0) || !(frameW > 0)) return 1;
    return Math.min(1, viewW / frameW);
}

/**
 * The next zoom level in a direction, or the same level at either end.
 * @param {number} current
 * @param {'in' | 'out'} direction
 */
export function zoomStep(current, direction) {
    if (direction === 'in') return ZOOM_STEPS.find(z => z > current) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
    const below = ZOOM_STEPS.filter(z => z < current);
    return below.length ? below[below.length - 1] : ZOOM_STEPS[0];
}

/**
 * What the player reads from a document: the interactions of a node, the frame a node sits in, and the nodes of a frame.
 * @param {{ id: string, name: string, nodes?: any[] }[]} pages
 * @returns {{ interactionsOf: (nodeId: string) => any[], frameOf: (nodeId: string) => string | null, nodesOf: (frameId: string) => { id: string, interactions: any[] }[] }}
 */
export function playContext(pages) {
    const nodes = pages.flatMap(p => p.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    /** The top-level frame a layer sits in: the layer itself when it is one. */
    const topOf = id => {
        let n = byId.get(id);
        while (n?.parentId && byId.get(n.parentId) && !byId.get(n.parentId).isSection) n = byId.get(n.parentId);
        return n?.id ?? null;
    };
    return {
        interactionsOf: id => byId.get(id)?.prototype?.interactions ?? [],
        frameOf: id => (byId.get(id)?.parentId ? topOf(id) : null),
        nodesOf: frameId => nodes.filter(n => n.id !== frameId && topOf(n.id) === frameId).map(n => ({ id: n.id, interactions: n.prototype?.interactions ?? [] })),
    };
}

/** A top-level frame of a page: a frame with no parent, or one directly in a section. Same rule as the validator. */
function isTopLevelFrameIn(page) {
    const nodes = page.nodes || [];
    return n => n.type === 'frame' && (!n.parentId || nodes.find(x => x.id === n.parentId)?.isSection);
}

/**
 * The frames a navigate-to can name: every top-level frame on every page, with the name of its page.
 * @param {{ name: string, nodes?: any[] }[]} pages
 * @returns {{ id: string, name: string, page: string }[]}
 */
export function destinationOptions(pages) {
    return pages.flatMap(p => (p.nodes || [])
        .filter(isTopLevelFrameIn(p))
        .map(n => ({ id: n.id, name: n.name, page: p.name })));
}

/**
 * An interaction id that the node does not have yet.
 * @param {string[]} taken the ids the node already has
 */
export function nextInteractionId(taken) {
    for (let n = taken.length + 1; ; n++) {
        const id = `i${n.toString(36)}`;
        if (!taken.includes(id)) return id;
    }
}

/**
 * The interaction a new one starts from: an on-click navigate-to with an instant transition.
 * @param {string} id
 * @param {string} destinationId
 */
export function defaultNavigate(id, destinationId) {
    return { id, trigger: { type: 'on-click' }, action: { type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } } };
}

/**
 * The frame Play starts on: the first flow of the active page, else the selected top-level frame, else the first top-level frame of
 * the active page. Null when the page has no top-level frame.
 * @param {{ id: string, nodes?: any[], prototype?: any }[]} pages
 * @param {string} activePageId
 * @param {string | null} selectedId
 * @returns {string | null}
 */
export function playStartOf(pages, activePageId, selectedId) {
    const page = pages.find(p => p.id === activePageId);
    if (!page) return null;
    const topLevel = (page.nodes || []).filter(isTopLevelFrameIn(page));
    const flow = page.prototype?.flows?.[0];
    if (flow) return flow.startFrameId;
    if (topLevel.some(n => n.id === selectedId)) return selectedId;
    return topLevel[0]?.id ?? null;
}

/** Triggers that hold while the pointer is over or down. Navigation and back cannot run on them. */
const CONTINUOUS = ['while-hovering', 'while-pressing'];
/** Actions that change the frame. */
const NAVIGATING = ['navigate-to', 'back'];

/**
 * A whole number from an edited field, at least `min`. Anything else is refused, so an invalid value is never written.
 * @param {string} value
 * @param {number} min
 * @param {string} label
 */
function wholeNumber(value, min, label) {
    const n = Number(value);
    if (String(value).trim() === '' || !Number.isInteger(n) || n < min) throw new Error(`${label} must be a whole number${min > 0 ? ' above zero' : ' of zero or more'}.`);
    return n;
}

/** The transition types that move the frame, and so take a direction. */

/**
 * The fields the editor shows for a transition type. Instant takes none; dissolve takes duration and easing; the moving ones add direction.
 * @param {string} type
 * @returns {{ direction: boolean, duration: boolean, easing: boolean }}
 */
export function transitionFieldsOf(type) {
    return { direction: MOVING_TRANSITIONS.includes(type), duration: type !== 'instant', easing: type !== 'instant' };
}

/**
 * The patch an edit of one field makes to an interaction, for editInteraction. A new action or trigger starts from its defaults; a
 * navigate-to needs a destination (`firstDestination`), and throws when there is none. Actions not yet supported throw.
 * @param {{ trigger: any, action: any }} interaction
 * @param {'trigger' | 'delay' | 'action' | 'destination' | 'transition' | 'duration' | 'direction' | 'easing'} field
 * @param {string} value
 * @param {{ firstDestination?: string }} context
 * @returns {{ trigger?: any, action?: any }}
 */
export function interactionPatch(interaction, field, value, { firstDestination }) {
    const transition = interaction.action?.transition;
    const withTransition = transition => ({ action: { ...interaction.action, transition } });
    switch (field) {
        case 'trigger':
            if (CONTINUOUS.includes(value) && NAVIGATING.includes(interaction.action?.type)) throw new Error('While hovering and while pressing cannot navigate or go back.');
            return { trigger: value === 'after-delay' ? { type: 'after-delay', delayMs: 500 } : { type: value } };
        case 'delay':
            return { trigger: { type: 'after-delay', delayMs: wholeNumber(value, 1, 'Delay') } };
        case 'action':
            if (value === 'navigate-to' && CONTINUOUS.includes(interaction.trigger?.type)) throw new Error('While hovering and while pressing cannot navigate or go back.');
            if (value === 'navigate-to') {
                if (!firstDestination) throw new Error('There is no top-level frame to navigate to.');
                return { action: { type: 'navigate-to', destinationId: firstDestination, transition: { type: 'instant', durationMs: 0 } } };
            }
            if (value === 'back') return { action: { type: 'back' } };
            if (value === 'open-link') return { action: { type: 'open-link', url: 'https://example.com' } };
            throw new Error(`The action "${value}" is not available yet.`);
        case 'destination':
            return { action: { ...interaction.action, destinationId: value } };
        case 'transition': {
            if (value === 'instant') return withTransition({ type: 'instant', durationMs: 0 });
            const fields = transitionFieldsOf(value);
            return withTransition({
                type: value,
                durationMs: transition?.durationMs ?? 300,
                easing: transition?.easing ?? 'ease-out',
                ...(fields.direction ? { direction: transition?.direction ?? 'left' } : {}),
            });
        }
        case 'duration':
            if (!transition) throw new Error('Choose a transition first.');
            return withTransition({ ...transition, durationMs: wholeNumber(value, 0, 'Duration') });
        case 'direction':
            if (!transition) throw new Error('Choose a transition first.');
            return withTransition({ ...transition, direction: value });
        case 'easing':
            if (!transition) throw new Error('Choose a transition first.');
            return withTransition({ ...transition, easing: value });
        default:
            throw new Error(`Unknown field "${field}".`);
    }
}
