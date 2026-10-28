// Play events (pure). The DOM runtime maps its mouse events to player events and turns the player's `schedule` effects into timers
// through these functions. The engine itself starts no timers and binds no listeners.
import { TRANSITIONS } from './data.js';

/** The DOM mouse event each pointer trigger listens to. */
const TRIGGER_OF_DOM = { click: 'on-click', mouseenter: 'mouse-enter', mouseleave: 'mouse-leave', mousedown: 'mouse-down', mouseup: 'mouse-up' };

/**
 * The player event a DOM mouse event on a node means, or null for a DOM event Play does not listen to.
 * @param {string} domType
 * @param {string} nodeId
 * @returns {{ type: 'pointer', nodeId: string, trigger: string } | null}
 */
export function eventFromDom(domType, nodeId) {
    if (!Object.hasOwn(TRIGGER_OF_DOM, domType)) return null;
    return { type: 'pointer', nodeId, trigger: TRIGGER_OF_DOM[domType] };
}

/**
 * Whether a layer is disabled for pointer interactions: the layer itself, or a layer it sits in, is a disabled Button. A disabled
 * layer triggers nothing: no on-click, mouse, hover or press interaction. After-delay is not pointer driven and is not affected.
 * @param {{ attrs?: Record<string, string | boolean> }} node the layer
 * @param {{ attrs?: Record<string, string | boolean> }[]} ancestors the layers it sits in, outermost first
 * @returns {boolean}
 */
export function isDisabledTarget(node, ancestors) {
    return [...ancestors, node].some(d => d.attrs?.disabled === true);
}

/**
 * The CSS a transition applies: its duration and easing, and the state the entering frame starts from (null for an instant change).
 * A moving transition enters from its direction's edge: `left` starts at -100% on x, `top` at -100% on y, and so on.
 * @param {{ type: string, durationMs?: number, direction?: string, easing?: string }} transition
 * @returns {{ durationMs: number, easing: string, from: Record<string, string> | null }}
 */
export function transitionCss(transition) {
    if (!TRANSITIONS.includes(transition.type)) throw new Error(`Unknown transition "${transition.type}".`);
    const durationMs = transition.durationMs ?? 0;
    const easing = transition.easing ?? 'linear';
    if (transition.type === 'instant') return { durationMs: 0, easing: 'linear', from: null };
    if (transition.type === 'dissolve') return { durationMs, easing, from: { opacity: '0' } };
    const offset = { left: ['translateX', '-100%'], right: ['translateX', '100%'], top: ['translateY', '-100%'], bottom: ['translateY', '100%'] }[transition.direction];
    if (!offset) throw new Error(`Transition "${transition.type}" needs a direction.`);
    return { durationMs, easing, from: { transform: `${offset[0]}(${offset[1]})` } };
}

/**
 * The timers a navigation's effects ask for. Each has a key (node and interaction), so the runtime can cancel it on a frame change.
 * @param {any[]} effects
 * @returns {{ key: string, nodeId: string, interactionId: string, delayMs: number }[]}
 */
export function timersFor(effects) {
    return effects
        .filter(e => e.type === 'schedule')
        .map(e => ({ key: `${e.nodeId}|${e.interactionId}`, nodeId: e.nodeId, interactionId: e.interactionId, delayMs: e.delayMs }));
}
