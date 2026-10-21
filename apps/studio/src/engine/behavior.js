// Model perilaku (tab "Behavior") Midas: dipakai bersama oleh inspector desain, live preview dan Code Builder.
// Implementasi canonical ada di @midas/builder-core supaya semua sisi memakai model yang sama.
export {
    ACTIONS, ACTION_MAP, componentTypeOf, FRAME_ROLES, FRAME_ROLE_MAP, getPath, normalizeInputBehavior,
    normalizeInteractions, normalizeStateMapping, POSITIONS, setPath, STATE_LABEL, STATE_ORDER, STATE_PROPS,
    STATE_PROP_MAP, statesFor, styleValue, TARGET_ROLES, TRIGGERS, TYPE_LABEL, overridesFor, stateChain,
} from '@midas/builder-core';
