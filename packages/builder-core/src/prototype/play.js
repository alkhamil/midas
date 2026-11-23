// Play and editing helpers (pure). The Play overlay and the Prototype panel use these: the player context read from a document, the
// destinations a navigate-to can name, and the default interaction a new one starts from.
import { MOVING_TRANSITIONS, OVERLAY_PLACEMENTS } from './data.js';
import { resolveMode } from '../behavior-engine/modes.js';
import { actionsOf, branchIndex, conditionPatch, defaultCondition, defaultVariableOf, listOf, withBranch, withList } from './conditional.js';

/**
 * What the player reads from a document: the interactions of a node, the frame a node sits in, the nodes of a frame, and a variable's
 * value on a node. The value follows the node's mode for the variable's collection, the same rule Appearance uses.
 * @param {{ pages: { id: string, name: string, nodes?: any[], varModes?: Record<string, string> }[], variables?: { collections?: any[], items?: any[] } }} data
 * @returns {{ interactionsOf: (nodeId: string) => any[], frameOf: (nodeId: string) => string | null, nodesOf: (frameId: string) => { id: string, interactions: any[] }[], valueOf: (nodeId: string, variableId: string) => any }}
 */
export function playContext({ pages, variables = {} }) {
    const nodes = pages.flatMap(p => p.nodes || []);
    const byId = new Map(nodes.map(n => [n.id, n]));
    const pageOf = new Map();
    for (const p of pages) for (const n of p.nodes || []) pageOf.set(n.id, p);
    // The top-level frame a layer sits in (the layer itself when it is one), worked out once per layer: a navigation asks for many.
    const topById = new Map();
    const topOf = id => {
        if (topById.has(id)) return topById.get(id);
        let n = byId.get(id);
        while (n?.parentId && byId.get(n.parentId) && !byId.get(n.parentId).isSection) n = byId.get(n.parentId);
        const top = n?.id ?? null;
        topById.set(id, top);
        return top;
    };
    // The layers of each frame, indexed once.
    const layersOf = new Map();
    for (const n of nodes) {
        const top = topOf(n.id);
        if (top == null || top === n.id) continue;
        const list = layersOf.get(top);
        if (list) list.push(n);
        else layersOf.set(top, [n]);
    }
    const collections = variables.collections ?? [], items = variables.items ?? [];
    const itemById = new Map(items.map(v => [v.id, v]));
    return {
        interactionsOf: id => byId.get(id)?.prototype?.interactions ?? [],
        frameOf: id => (byId.get(id)?.parentId ? topOf(id) : null),
        nodesOf: frameId => (layersOf.get(frameId) ?? []).map(n => ({ id: n.id, interactions: n.prototype?.interactions ?? [] })),
        valueOf: (nodeId, variableId) => {
            const node = byId.get(nodeId), item = itemById.get(variableId);
            const collection = item && collections.find(c => c.id === item.collectionId);
            if (!node || !collection) return undefined;
            const page = pageOf.get(nodeId);
            return item.values?.[resolveMode(collection, node, byId, page?.varModes)];
        },
    };
}

/** A top-level frame of a page: a frame with no parent, or one directly in a section. Same rule as the validator. */
function isTopLevelFrameIn(page) {
    const sections = new Set((page.nodes || []).filter(x => x.isSection).map(x => x.id));
    return n => n.type === 'frame' && (!n.parentId || sections.has(n.parentId));
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
    return { id, trigger: { type: 'on-click' }, actions: [navigateTo(destinationId)] };
}

/**
 * The top-level frame that holds a node: the node itself when it is one, else the nearest ancestor that is. Null when the node sits
 * outside every frame (a loose node on the page) or is not on the page.
 */
function topLevelFrameOf(page, id) {
    const byId = new Map((page.nodes || []).map(n => [n.id, n]));
    const topLevel = isTopLevelFrameIn(page);
    let node = byId.get(id);
    for (let steps = 0; node && steps <= byId.size; steps++) {
        if (topLevel(node)) return node.id;
        node = byId.get(node.parentId);
    }
    return null;
}

/**
 * The frame Play starts on: the top-level frame that holds the selection (a selected child starts its frame; a selected frame starts
 * itself), else the first flow of the active page, else the first top-level frame of the active page. A selection overrides the flow
 * start marker. Null when the page has no top-level frame.
 * @param {{ id: string, nodes?: any[], prototype?: any }[]} pages
 * @param {string} activePageId
 * @param {string | null} selectedId the first selected node
 * @returns {string | null}
 */
export function playStartOf(pages, activePageId, selectedId) {
    const page = pages.find(p => p.id === activePageId);
    if (!page) return null;
    const selectedFrame = selectedId ? topLevelFrameOf(page, selectedId) : null;
    if (selectedFrame) return selectedFrame;
    const flow = page.prototype?.flows?.[0];
    if (flow) return flow.startFrameId;
    return (page.nodes || []).find(isTopLevelFrameIn(page))?.id ?? null;
}

/** Triggers that hold while the pointer is over or down. Navigation and back cannot run on them. */
const CONTINUOUS = ['while-hovering', 'while-pressing'];
/** Actions that change the frame or the overlays on it: a continuous trigger cannot run them (decision 15). */
const NAVIGATING = ['navigate-to', 'back', 'open-overlay', 'close-overlay'];

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

/**
 * The fields the editor shows for a transition type. Instant takes none; dissolve takes duration and easing; the moving ones add direction.
 * @param {string} type
 * @returns {{ direction: boolean, duration: boolean, easing: boolean }}
 */
export function transitionFieldsOf(type) {
    return { direction: MOVING_TRANSITIONS.includes(type), duration: type !== 'instant', easing: type !== 'instant' };
}

/** A navigate-to with an instant transition: what a new navigation starts from. */
export const navigateTo = destinationId => ({ type: 'navigate-to', destinationId, transition: { type: 'instant', durationMs: 0 } });

/**
 * The action an edit of one field of an action makes: the action with the field changed. A new action starts from its defaults; a
 * navigate-to needs a destination (`firstDestination`), and throws when there is none. A conditional starts with one branch on the first
 * boolean, number or string variable (`variables`), and cannot sit inside another conditional (`nested`). `trigger` is the trigger of the
 * interaction the action sits in: a continuous trigger cannot run a navigation, a back, an overlay or a close.
 * @param {any} action
 * @param {string} field
 * @param {string} value
 * @param {{ trigger?: any, firstDestination?: string, variables?: { id: string, type: string }[], nested?: boolean }} context
 * @returns {any} the new action
 */
export function actionPatch(action, field, value, context) {
    const transition = action?.transition;
    const withTransition = transition => ({ ...action, transition });
    switch (field) {
        case 'action':
            return actionOfType(value, context);
        case 'destination':
            return { ...action, destinationId: value };
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
        case 'variable': {
            if (action?.type !== 'set-variable') throw new Error('Only Set variable has a variable.');
            const variable = (context.variables ?? []).find(v => v.id === value);
            if (!variable) throw new Error('Choose a boolean, number or string variable.');
            return { type: 'set-variable', variableId: variable.id, value: valueOfType(variable.type, '') };
        }
        case 'value': {
            if (action?.type !== 'set-variable') throw new Error('Only Set variable has a value.');
            const variable = (context.variables ?? []).find(v => v.id === action.variableId);
            if (!variable) throw new Error('The variable is missing.');
            return { ...action, value: valueOfType(variable.type, value) };
        }
        case 'placement':
            if (action?.type !== 'open-overlay') throw new Error('Only an overlay has a placement.');
            if (!OVERLAY_PLACEMENTS.includes(value)) throw new Error(`Placement must be one of ${OVERLAY_PLACEMENTS.join(', ')}.`);
            return { ...action, placement: value };
        case 'close-outside':
            if (action?.type !== 'open-overlay') throw new Error('Only an overlay closes on outside clicks.');
            return { ...action, closeOnOutside: value === 'true' };
        default:
            throw new Error(`Unknown field "${field}".`);
    }
}

/**
 * The action a type choice makes, from its defaults. Throws when the type cannot run on the interaction's trigger or needs something the
 * document does not have.
 * @param {string} type
 * @param {{ trigger?: any, firstDestination?: string, variables?: { id: string, type: string }[], nested?: boolean }} context
 */
function actionOfType(type, { trigger, firstDestination, variables = [], nested = false }) {
    const continuous = CONTINUOUS.includes(trigger);
    const needFrame = () => {
        if (!firstDestination) throw new Error('There is no top-level frame to navigate to.');
    };
    switch (type) {
        case 'navigate-to':
            if (continuous) throw new Error('While hovering and while pressing cannot navigate or go back.');
            needFrame();
            return navigateTo(firstDestination);
        case 'conditional': {
            if (nested) throw new Error('A conditional cannot sit inside a conditional.');
            if (continuous) throw new Error('While hovering and while pressing cannot navigate or go back.');
            needFrame();
            const variable = defaultVariableOf(variables);
            if (!variable) throw new Error('There is no boolean, number or string variable to compare.');
            return { type: 'conditional', branches: [{ condition: defaultCondition(variable), actions: [navigateTo(firstDestination)] }] };
        }
        case 'back':
            if (continuous) throw new Error('While hovering and while pressing cannot navigate or go back.');
            return { type: 'back' };
        case 'open-link':
            return { type: 'open-link', url: 'https://example.com' };
        case 'open-overlay':
            if (continuous) throw new Error('While hovering and while pressing cannot open an overlay.');
            needFrame();
            return { type: 'open-overlay', destinationId: firstDestination, placement: 'center', closeOnOutside: true, transition: { type: 'instant', durationMs: 0 } };
        case 'set-variable': {
            const variable = defaultVariableOf(variables);
            if (!variable) throw new Error('There is no boolean, number or string variable to set.');
            return { type: 'set-variable', variableId: variable.id, value: valueOfType(variable.type, '') };
        }
        case 'close-overlay':
            if (continuous) throw new Error('While hovering and while pressing cannot close an overlay.');
            return { type: 'close-overlay' };
        default:
            throw new Error(`The action "${type}" is not available yet.`);
    }
}

/**
 * The patch an edit of one field of an interaction makes, for editInteraction. `trigger` and `delay` change the interaction; any other field
 * changes the action at `index` in its list (see actionPatch). A trigger that cannot run an action it holds is refused.
 * @param {{ trigger: any, actions: any[] }} interaction
 * @param {string} field
 * @param {string} value
 * @param {{ index?: number, firstDestination?: string, variables?: { id: string, type: string }[] }} context
 * @returns {{ trigger?: any, actions?: any[] }}
 */
export function interactionPatch(interaction, field, value, context = {}) {
    if (field === 'trigger') {
        if (CONTINUOUS.includes(value) && interaction.actions.flatMap(a => [a, ...actionsOf(a)]).some(a => NAVIGATING.includes(a?.type))) throw new Error('While hovering and while pressing cannot navigate or go back.');
        return { trigger: value === 'after-delay' ? { type: 'after-delay', delayMs: 500 } : { type: value } };
    }
    if (field === 'delay') return { trigger: { type: 'after-delay', delayMs: wholeNumber(value, 1, 'Delay') } };
    const j = Number(context.index ?? 0);
    if (!interaction.actions[j]) throw new Error('The action is missing.');
    const next = actionPatch(interaction.actions[j], field, value, { ...context, trigger: interaction.trigger?.type });
    return { actions: interaction.actions.map((a, k) => (k === j ? next : a)) };
}

/**
 * The conditional action after one field of a part inside it changed: a condition field of the branch at `at` (`b<i>`), or a field of the
 * action at `index` in the list at `at` (a branch, or `e` for the else). `context` is as for actionPatch, with the trigger of the interaction.
 * @param {any} action the conditional
 * @param {string} field
 * @param {string} value
 * @param {string} at
 * @param {string | number} index
 * @param {{ trigger?: any, firstDestination?: string, variables?: { id: string, type: string }[] }} context
 * @returns {any} the conditional, changed
 */
export function nestedPatch(action, field, value, at, index, context) {
    if (field.startsWith('cond-')) {
        const branch = action.branches[branchIndex(at)];
        const condition = conditionPatch(branch.condition, field, value, id => context.variables?.find(v => v.id === id));
        return withBranch(action, at, { ...branch, condition });
    }
    const list = listOf(action, at), j = Number(index);
    const patched = actionPatch(list[j], field, value, { ...context, nested: true });
    return withList(action, at, list.map((a, k) => (k === j ? patched : a)));
}

/**
 * A value of a variable's type from the text a panel field holds: a boolean is true or false, a number a finite number, a string the text itself.
 * An empty text is the type's starting value.
 * @param {string} type
 * @param {string} text
 */
function valueOfType(type, text) {
    if (type === 'boolean') return text === 'true';
    if (type === 'number') {
        if (text === '') return 0;
        const n = Number(text);
        if (!Number.isFinite(n)) throw new Error('The value must be a number.');
        return n;
    }
    return text;
}

/**
 * How a destination is named in a picker: its name alone on the page the link is on, and "page / name" on another page, so two frames
 * with one name stay apart.
 * @param {{ name: string, page: string }} destination
 * @param {string} currentPage the name of the page the link is on
 */
export function destinationLabel(destination, currentPage) {
    return destination.page === currentPage ? destination.name : `${destination.page} / ${destination.name}`;
}
