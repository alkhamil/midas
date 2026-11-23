// Prototype player (pure). A state machine over the flow: it takes an event (a pointer trigger on a node, a timer, back, restart) and
// returns the new state and the effects the runtime must carry out. It starts no timers and touches no DOM: after-delay interactions
// come back as `schedule` effects, and the runtime answers with a `timer` event when the delay has passed.
//
// State: { current: frameId, history: frameId[], overlays: { frameId, anchorId, placement, closeOnOutside }[], variables: { [variableId]: value } }.
// The history holds the frames to go back to, last one on top; the overlays are the open frames, last one on top; an overlay is not a history step
// (decision 15). The variables are the values Set variable has written in this Play session (decision 17): they override the document's values,
// they are kept across navigation, and restart puts them back to the document's.
// Effects: navigate { from, to, transition } · open-link { url } · schedule { nodeId, interactionId, delayMs } · open-overlay { ...overlay, transition }
// · close-overlay { frameId }.
// A conditional runs the actions of its branch that holds when the trigger fires; variable values come from the state, then the context.
import { chooseBranch } from './conditional.js';

/** The interaction triggers a pointer event starts. `mouse-enter` also starts while-hovering, `mouse-down` also while-pressing. */
const STARTS = { 'on-click': ['on-click'], 'mouse-enter': ['mouse-enter', 'while-hovering'], 'mouse-down': ['mouse-down', 'while-pressing'], 'mouse-up': ['mouse-up'], 'mouse-leave': ['mouse-leave'] };
const INSTANT = { type: 'instant', durationMs: 0 };

/**
 * @typedef {{ frameId: string, anchorId: string, placement: string, closeOnOutside: boolean }} Overlay
 * @typedef {{ current: string, history: string[], overlays: Overlay[], variables: Record<string, any> }} PlayerState
 * @typedef {{ interactionsOf: (nodeId: string) => any[], frameOf: (nodeId: string) => string | null, nodesOf: (frameId: string) => { id: string, interactions: any[] }[], valueOf: (nodeId: string, variableId: string) => any }} PlayerContext
 */

/**
 * The state a player starts in: on the start frame, with nothing behind it, nothing open and no variable written.
 * @param {string} startFrameId
 * @returns {PlayerState}
 */
export function createPlayer(startFrameId) {
    return { current: startFrameId, history: [], overlays: [], variables: {} };
}

/**
 * The next state and effects for one event.
 * @param {PlayerState} state
 * @param {{ type: 'pointer', nodeId: string, trigger: string } | { type: 'timer', nodeId: string, interactionId: string } | { type: 'back' } | { type: 'navigate', frameId: string } | { type: 'restart', startFrameId: string }} event
 * @param {PlayerContext} ctx
 * @returns {{ state: PlayerState, effects: any[] }}
 */
export function respond(state, event, ctx) {
    if (event.type === 'restart') return moveTo(state, { current: event.startFrameId, history: [], overlays: [], variables: {} }, ctx, INSTANT);
    if (event.type === 'back') return backOf(state, ctx);
    if (event.type === 'navigate') {
        if (event.frameId === state.current) return { state, effects: [] };
        return moveTo(state, { current: event.frameId, history: [...state.history, state.current], overlays: [] }, ctx, INSTANT);
    }
    if (event.type === 'timer') {
        if (ctx.frameOf(event.nodeId) !== state.current) return { state, effects: [] };
        const interaction = ctx.interactionsOf(event.nodeId).find(i => i.id === event.interactionId && i.trigger?.type === 'after-delay');
        return interaction ? runAction(state, interaction.action, ctx, event.nodeId) : { state, effects: [] };
    }
    // A click outside the topmost overlay closes it, when that overlay closes on outside clicks. The click then runs the node's own interactions.
    const outside = event.trigger === 'on-click' ? closeOutside(state, event.nodeId, ctx) : { state, effects: [] };
    const interactions = ctx.interactionsOf(event.nodeId);
    const starts = interactions.filter(i => (STARTS[event.trigger] ?? []).includes(i.trigger?.type));
    let next = outside.state;
    const effects = [...outside.effects];
    for (const interaction of starts) {
        const result = runAction(next, interaction.action, ctx, event.nodeId);
        next = result.state;
        effects.push(...result.effects);
    }
    return { state: next, effects };
}

/**
 * Runs one action in order. A conditional runs the actions of its chosen branch, with the variable values of the node it sits on.
 * The caller has checked the trigger.
 * @param {PlayerState} state
 * @param {any} action
 * @param {PlayerContext} ctx
 * @param {string} nodeId the node the action's interaction belongs to
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function runAction(state, action, ctx, nodeId) {
    if (action?.type === 'conditional') {
        let next = state;
        const effects = [];
        for (const nested of chooseBranch(action, variableId => valueIn(state, ctx, nodeId, variableId))) {
            const result = runAction(next, nested, ctx, nodeId);
            next = result.state;
            effects.push(...result.effects);
        }
        return { state: next, effects };
    }
    if (action?.type === 'navigate-to') return moveTo(state, { current: action.destinationId, history: [...state.history, state.current], overlays: [] }, ctx, action.transition);
    if (action?.type === 'back') return backOf(state, ctx);
    if (action?.type === 'open-link') return { state, effects: [{ type: 'open-link', url: action.url }] };
    if (action?.type === 'open-overlay') return openOverlay(state, action, nodeId);
    if (action?.type === 'close-overlay') return closeTop(state);
    if (action?.type === 'set-variable') return { state: { ...state, variables: { ...state.variables, [action.variableId]: action.value } }, effects: [] };
    return { state, effects: [] };
}

/**
 * A variable's value at this point of the session: what Set variable wrote, else the value the document gives the node.
 * @param {PlayerState} state
 * @param {PlayerContext} ctx
 * @param {string} nodeId
 * @param {string} variableId
 */
function valueIn(state, ctx, nodeId, variableId) {
    return Object.hasOwn(state.variables, variableId) ? state.variables[variableId] : ctx.valueOf(nodeId, variableId);
}

/**
 * Opens an overlay on top of the others, anchored to the node that holds the interaction. A frame already open changes nothing.
 * @param {PlayerState} state
 * @param {any} action
 * @param {string} nodeId
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function openOverlay(state, action, nodeId) {
    if (state.overlays.some(o => o.frameId === action.destinationId)) return { state, effects: [] };
    /** @type {Overlay} */
    const overlay = { frameId: action.destinationId, anchorId: nodeId, placement: action.placement, closeOnOutside: action.closeOnOutside };
    return { state: { ...state, overlays: [...state.overlays, overlay] }, effects: [{ type: 'open-overlay', ...overlay, transition: action.transition ?? INSTANT }] };
}

/**
 * Closes the topmost overlay. Nothing when none is open.
 * @param {PlayerState} state
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function closeTop(state) {
    const top = state.overlays[state.overlays.length - 1];
    if (!top) return { state, effects: [] };
    return { state: { ...state, overlays: state.overlays.slice(0, -1) }, effects: [{ type: 'close-overlay', frameId: top.frameId }] };
}

/**
 * A click on a layer that is not in the topmost overlay closes it, when it closes on outside clicks (one overlay per click).
 * @param {PlayerState} state
 * @param {string} nodeId
 * @param {PlayerContext} ctx
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function closeOutside(state, nodeId, ctx) {
    const top = state.overlays[state.overlays.length - 1];
    if (!top || !top.closeOnOutside || ctx.frameOf(nodeId) === top.frameId) return { state, effects: [] };
    return closeTop(state);
}

/**
 * Moves to another state and reports the navigation, plus the after-delay interactions of the arriving frame as schedules. The variables
 * written so far stay unless the move gives its own (restart).
 * @param {PlayerState} from the state before the move
 * @param {Omit<PlayerState, 'variables'> & { variables?: Record<string, any> }} to the state after the move
 * @param {PlayerContext} ctx
 * @param {any} transition
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function moveTo(from, to, ctx, transition) {
    const next = { ...to, variables: to.variables ?? from.variables };
    const effects = [{ type: 'navigate', from: from.current, to: next.current, transition: transition ?? INSTANT }];
    for (const node of ctx.nodesOf(next.current)) {
        for (const interaction of node.interactions) {
            if (interaction.trigger?.type === 'after-delay') effects.push({ type: 'schedule', nodeId: node.id, interactionId: interaction.id, delayMs: interaction.trigger.delayMs });
        }
    }
    return { state: next, effects };
}

/**
 * Back: the topmost overlay closes first (decision 15); otherwise the frame on top of the history stack, or nothing when the stack is empty.
 * @param {PlayerState} state
 * @param {PlayerContext} ctx
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function backOf(state, ctx) {
    if (state.overlays.length) return closeTop(state);
    if (!state.history.length) return { state, effects: [] };
    const previous = state.history[state.history.length - 1];
    return moveTo(state, { current: previous, history: state.history.slice(0, -1), overlays: [] }, ctx, INSTANT);
}
