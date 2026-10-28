// Prototype player (pure). A state machine over the flow: it takes an event (a pointer trigger on a node, a timer, back, restart) and
// returns the new state and the effects the runtime must carry out. It starts no timers and touches no DOM: after-delay interactions
// come back as `schedule` effects, and the runtime answers with a `timer` event when the delay has passed.
//
// State: { current: frameId, history: frameId[] } (the frames to go back to, last one on top).
// Effects: navigate { from, to, transition } · open-link { url } · schedule { nodeId, interactionId, delayMs }.

/** The interaction triggers a pointer event starts. `mouse-enter` also starts while-hovering, `mouse-down` also while-pressing. */
const STARTS = { 'on-click': ['on-click'], 'mouse-enter': ['mouse-enter', 'while-hovering'], 'mouse-down': ['mouse-down', 'while-pressing'], 'mouse-up': ['mouse-up'], 'mouse-leave': ['mouse-leave'] };
const INSTANT = { type: 'instant', durationMs: 0 };

/**
 * @typedef {{ current: string, history: string[] }} PlayerState
 * @typedef {{ interactionsOf: (nodeId: string) => any[], frameOf: (nodeId: string) => string | null, nodesOf: (frameId: string) => { id: string, interactions: any[] }[] }} PlayerContext
 */

/**
 * The state a player starts in: on the start frame, with nothing behind it.
 * @param {string} startFrameId
 * @returns {PlayerState}
 */
export function createPlayer(startFrameId) {
    return { current: startFrameId, history: [] };
}

/**
 * The next state and effects for one event.
 * @param {PlayerState} state
 * @param {{ type: 'pointer', nodeId: string, trigger: string } | { type: 'timer', nodeId: string, interactionId: string } | { type: 'back' } | { type: 'navigate', frameId: string } | { type: 'restart', startFrameId: string }} event
 * @param {PlayerContext} ctx
 * @returns {{ state: PlayerState, effects: any[] }}
 */
export function respond(state, event, ctx) {
    if (event.type === 'restart') return moveTo(state, { current: event.startFrameId, history: [] }, ctx, INSTANT);
    if (event.type === 'back') return goBack(state, ctx);
    if (event.type === 'navigate') {
        if (event.frameId === state.current) return { state, effects: [] };
        return moveTo(state, { current: event.frameId, history: [...state.history, state.current] }, ctx, INSTANT);
    }
    if (event.type === 'timer') {
        if (ctx.frameOf(event.nodeId) !== state.current) return { state, effects: [] };
        const interaction = ctx.interactionsOf(event.nodeId).find(i => i.id === event.interactionId && i.trigger?.type === 'after-delay');
        return interaction ? run(state, interaction, ctx) : { state, effects: [] };
    }
    const interactions = ctx.interactionsOf(event.nodeId);
    const starts = interactions.filter(i => (STARTS[event.trigger] ?? []).includes(i.trigger?.type));
    let next = state;
    const effects = [];
    for (const interaction of starts) {
        const result = run(next, interaction, ctx);
        next = result.state;
        effects.push(...result.effects);
    }
    return { state: next, effects };
}

/**
 * Runs one interaction's action. The caller has checked its trigger.
 * @param {PlayerState} state
 * @param {any} interaction
 * @param {PlayerContext} ctx
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function run(state, interaction, ctx) {
    const action = interaction.action;
    if (action?.type === 'navigate-to') return moveTo(state, { current: action.destinationId, history: [...state.history, state.current] }, ctx, action.transition);
    if (action?.type === 'back') return goBack(state, ctx);
    if (action?.type === 'open-link') return { state, effects: [{ type: 'open-link', url: action.url }] };
    return { state, effects: [] };
}

/**
 * Moves to another state and reports the navigation, plus the after-delay interactions of the arriving frame as schedules.
 * @param {PlayerState} from the state before the move
 * @param {PlayerState} to the state after the move
 * @param {PlayerContext} ctx
 * @param {any} transition
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function moveTo(from, to, ctx, transition) {
    const effects = [{ type: 'navigate', from: from.current, to: to.current, transition: transition ?? INSTANT }];
    for (const node of ctx.nodesOf(to.current)) {
        for (const interaction of node.interactions) {
            if (interaction.trigger?.type === 'after-delay') effects.push({ type: 'schedule', nodeId: node.id, interactionId: interaction.id, delayMs: interaction.trigger.delayMs });
        }
    }
    return { state: to, effects };
}

/**
 * Back: the frame on top of the history stack, or nothing when the stack is empty.
 * @param {PlayerState} state
 * @param {PlayerContext} ctx
 * @returns {{ state: PlayerState, effects: any[] }}
 */
function goBack(state, ctx) {
    if (!state.history.length) return { state, effects: [] };
    const previous = state.history[state.history.length - 1];
    return moveTo(state, { current: previous, history: state.history.slice(0, -1) }, ctx, INSTANT);
}
