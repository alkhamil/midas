// Model perilaku (tab "Behavior") Midas: dipakai bersama oleh inspector desain, live preview dan Code Builder.
// Implementasi canonical ada di @midas/builder-core supaya semua sisi memakai model yang sama.
export {
    ACTIONS, ACTION_MAP, componentTypeOf, FRAME_ROLES, FRAME_ROLE_MAP, getPath, isStateCollection,
    interactionsForNode, normalizeInputBehavior, normalizeInteractions, normalizeStateMapping, POSITIONS, setPath, STATE_LABEL,
    INPUT_TYPES, PLACEMENTS, DROPDOWN_SIZES, normalizePlacement, actionPlacement, SELECT_MODES, VALIDATION_TRIGGERS, effectiveState, normalizeAction, clickPick, offsetXY, splitOverlayParts, TRANSITIONS, TRANSITION_MAP, VARIANT_TRANSITIONS, placeOverlayPos, isOverlayRoot, overlayRootOf, canReparentOverlay, MOTION_EASINGS, MOTION_EASING_MAP, MOTION_DEFAULTS, resolveMotion, stateLabel, statesIn, STATE_HINT, STATE_MODE_NAMES, STATE_ORDER, modeForState, pickedModeId, STATE_PROPS, STATE_PROP_MAP, stateCollectionsOf, stateOfMode, stateOfModeId, statesFor,
    styleValue, TARGET_ROLES, TRIGGERS, TYPE_LABEL, overridesFor, stateChain, variableValueInMode, SCROLL_OVERFLOWS, SCROLL_POSITIONS, normalizeScroll,
} from '@midas/builder-core';
