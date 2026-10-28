// Template schema: pure data describing a React component contract (Ant Design-structured).
// Engine logic never lives in a template. See docs/behavior-spec.md.

/** Anatomy slot: one named position in the rendered structure, in render order. */
export interface AnatomySlot {
    id: string;
    /** `text` holds a label; `icon` holds an icon component. */
    kind: 'text' | 'icon';
    /** Optional slots may be absent on an instance. */
    optional?: boolean;
    /** Managed slots are inserted and removed by Behavior from the instance's props. */
    managed?: boolean;
}

/** Condition on another prop: the prop is shown only while `prop` resolves to `is`. */
export interface VisibleIf {
    prop: string;
    is: boolean | string;
}

/** A prop whose value is a mode of a variable collection (a dimension, locked by the schema). */
export interface VariableProp {
    source: 'variable';
    /** Name of the variable collection the prop is auto-matched to (case-insensitive). */
    collection: string;
    visibleIf?: VisibleIf;
}

/** A prop whose value is a literal stored on the instance. */
export type LiteralProp =
    | { source: 'literal'; type: 'boolean'; default: boolean; visibleIf?: VisibleIf }
    | { source: 'literal'; type: 'string'; default: string; visibleIf?: VisibleIf }
    | { source: 'literal'; type: 'enum'; options: string[]; default: string; visibleIf?: VisibleIf }
    | { source: 'literal'; type: 'iconComponent'; default: null; visibleIf?: VisibleIf };

export type PropDef = VariableProp | LiteralProp;

export interface TokenGroups {
    fromSize: string[];
    fromVariant: string[];
}

/** Per state, the base tokens it overrides, each with the token that replaces it (`{ bg: 'bg-hover' }`). */
export type StateTokens = Record<string, Record<string, string>>;

export interface EventDef {
    name: string;
    /** Payload type name, when the event carries one. */
    payload?: string;
    /** `true` makes the event a Prototype trigger later. */
    exposeAsTrigger: boolean;
}

export interface TemplateSchema {
    id: string;
    name: string;
    anatomy: AnatomySlot[];
    props: Record<string, PropDef>;
    tokens: TokenGroups;
    states: string[];
    stateTokens?: StateTokens;
    /** Which token or literal prop drives which property of which node (root, or an anatomy slot). */
    display: Record<string, Record<string, string>>;
    events: EventDef[];
}
