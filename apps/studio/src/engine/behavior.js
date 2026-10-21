// Model perilaku (tab "Behavior") Midas: dipakai bersama oleh inspector desain, live preview dan Code Builder.
// Implementasi canonical ada di @midas/builder-core supaya semua sisi memakai model yang sama.
export {
    ACTIONS, ACTION_MAP, componentTypeOf, FRAME_ROLES, FRAME_ROLE_MAP, getPath, isStateCollection,
    normalizeInputBehavior, normalizeInteractions, normalizeStateMapping, POSITIONS, setPath, STATE_LABEL,
    INPUT_TYPES, STATE_HINT, STATE_MODE_NAMES, STATE_ORDER, modeForState, pickedModeId, STATE_PROPS, STATE_PROP_MAP, stateCollectionsOf, stateOfMode, statesFor,
    styleValue, TARGET_ROLES, TRIGGERS, TYPE_LABEL, overridesFor, stateChain, variableValueInMode,
} from '@midas/builder-core';
