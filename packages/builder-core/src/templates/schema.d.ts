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

/** The node a literal prop writes: `key` is `root` or an anatomy slot, `field` the node field (see display.js NODE_FIELDS). */
export interface NodeField {
    key: string;
    field: string;
}

/** A prop whose value is a literal stored on the instance. */
export type LiteralProp =
    | { source: 'literal'; type: 'boolean'; default: boolean; node?: NodeField; visibleIf?: VisibleIf }
    | { source: 'literal'; type: 'string'; default: string; node?: NodeField; visibleIf?: VisibleIf }
    | { source: 'literal'; type: 'enum'; options: string[]; default: string; slots?: Record<string, string>; visibleIf?: VisibleIf }
    | { source: 'literal'; type: 'iconComponent'; default: null; visibleIf?: VisibleIf };

export type PropDef = VariableProp | LiteralProp;

/** Token groups: `from<Dimension>` holds the tokens that draw from the variable prop of that name. */
export interface TokenGroups {
    [group: string]: string[];
}

export type TokenKind = 'length' | 'ratio' | 'color';

/** The element a component is written as, and what stops it reacting. */
export interface ElementDef {
    tag: string;
    attrs: Record<string, string>;
    /** The persistent state that disables the element. */
    disabledState: string;
    /** Props that stop onClick from running. */
    blockClickProps: string[];
}

/** The managed icon slot: the props that show it, place it and choose its icon, and the tokens that colour and size it. */
export interface IconSlotDef {
    show: string;
    placement: string;
    component: string;
    tokens: { colour: string; disabledColour: string; size: string };
}

/** A persistent state: the boolean prop that turns it on, and the base tokens it replaces. */
export interface PersistentState {
    prop: string;
    tokens: Record<string, string>;
}

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
    /** Variable name prefix of the component's tokens, e.g. `button` for `button/bg`. */
    group: string;
    element: ElementDef;
    anatomy: AnatomySlot[];
    icon: IconSlotDef;
    props: Record<string, PropDef>;
    tokens: TokenGroups;
    tokenKinds: Record<string, TokenKind>;
    persistentStates: Record<string, PersistentState>;
    /** Preview-only states: the base colour tokens each one replaces. */
    previewStates: Record<string, Record<string, string>>;
    /** The CSS pseudo-class each state is written as. */
    statePseudo: Record<string, string>;
    /** Which token drives which property of which node (root, or an anatomy slot). */
    display: Record<string, Record<string, string>>;
    events: EventDef[];
}
