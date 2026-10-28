// Prototype data (pure): the vocabulary of interactions and flows. A node's interactions live under `node.prototype`, a page's flow
// starting points under `page.prototype`. Both carry a version; a different version is refused, never repaired. New action types
// (overlay, dropdown, conditional, variables) are added to ACTION_TYPES with their own fields; the structure does not change.

export const PROTOTYPE_VERSION = 1;

/** The events an interaction starts on. `after-delay` also needs a delay (`trigger.delayMs`, above zero). */
export const TRIGGERS = ['on-click', 'mouse-enter', 'mouse-leave', 'mouse-down', 'mouse-up', 'while-hovering', 'while-pressing', 'after-delay'];

export const ACTION_TYPES = ['navigate-to', 'back', 'open-link'];

/** Figma's transitions. `slide-in` and `push` move in a direction; `instant` and `dissolve` do not. */
export const TRANSITIONS = ['instant', 'dissolve', 'slide-in', 'push'];
export const DIRECTIONS = ['left', 'right', 'top', 'bottom'];
export const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

/** The transitions that need a direction. */
export const MOVING_TRANSITIONS = ['slide-in', 'push'];

export const LINK_PROTOCOLS = ['http:', 'https:'];

/** A frame's Scroll behavior: the axes its content may scroll on. `none` clips on both axes and is the default (not stored). */
export const OVERFLOWS = ['none', 'horizontal', 'vertical', 'both'];
