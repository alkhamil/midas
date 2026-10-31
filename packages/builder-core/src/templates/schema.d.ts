// Template schema: pure data describing a React component contract (Ant Design-structured).
// Engine logic never lives in a template. See docs/behavior-spec.md.

/** Anatomy slot: one named position in the rendered structure, in render order. */
export interface AnatomySlot {
    id: string;
    /** `text` holds a label, `control` a label drawn as an input; `icon` holds an icon component. */
    kind: 'text' | 'control' | 'icon';
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
    /** The modes Auto Fix creates when the collection is missing (by mode id). Existing collections only gain the modes they lack. */
    modes?: string[];
    /** How the root is drawn in one mode, by mode id: its border style. Modes without a rule are solid. */
    styles?: Record<string, { borderStyle: 'solid' | 'dashed' | 'dotted' }>;
    visibleIf?: VisibleIf;
}

/** The node a literal prop writes: `key` is `root` or an anatomy slot, `field` the node field (see display.js NODE_FIELDS). */
export interface NodeField {
    key: string;
    field: string;
}

/** A text or control slot drawn as an input: the schema names the slot and the props that fill it. Data only: the engine renders it, the canvas keeps the text layer. */
export interface ControlDef {
    slot: string;
    value: string;
    placeholder?: string;
    readonly?: string;
    maxlength?: string;
    clear?: string;
    count?: string;
}

/** Dimensions a literal prop needs: the variable props whose collections must be bound on the master (data only). */
export interface RequiresCols { requires?: string[] }

/** A prop whose value is a literal stored on the instance. */
export type LiteralProp =
    | ({ source: 'literal'; type: 'boolean'; default: boolean; node?: NodeField; visibleIf?: VisibleIf } & RequiresCols)
    | ({ source: 'literal'; type: 'string'; default: string; node?: NodeField; visibleIf?: VisibleIf } & RequiresCols)
    | ({ source: 'literal'; type: 'enum'; options: string[]; default: string; slots?: Record<string, string | string[]>; visibleIf?: VisibleIf } & RequiresCols)
    | ({ source: 'literal'; type: 'iconComponent'; default: null; visibleIf?: VisibleIf } & RequiresCols);

export type PropDef = VariableProp | LiteralProp;

/** Which base role a token fills, per dimension mode. A plain role holds for every mode; a map names the role per
 * mode id (matched case-insensitively, `default` is the fallback). A value with a slash (`input/status-border`) is a
 * reference to another token variable of the same template, followed through the bound collection. A role missing
 * from the roles table makes the variable "needs value". */
export type TokenRole = string | Record<string, string>;

/** The role of every token variable: `tokenRoles[token]` is its role or per-mode role map. */
export interface TokenRoles {
    [token: string]: TokenRole;
}

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

/** A managed icon slot: the props that show it and choose its icon, and the tokens that colour and size it. A def with a
 * placement maps each placement value to a managed slot; a def without one names its fixed slot directly. */
export interface IconSlotDef {
    show: string;
    placement?: string;
    slot?: string;
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
    icons: IconSlotDef[];
    control?: ControlDef;
    /** The box that owns interaction visuals when the element itself cannot take them: `wrapper` reflects the
     * inner control focus and disabled state onto the root (only with a `control`). */
    focusTarget?: 'wrapper';
    props: Record<string, PropDef>;
    tokens: TokenGroups;
    tokenKinds: Record<string, TokenKind>;
    /** The base role of every token variable, for Auto Fix. Tokens without an entry resolve by their own name. */
    tokenRoles?: TokenRoles;
    persistentStates: Record<string, PersistentState>;
    /** Preview-only states: the base colour tokens each one replaces. */
    previewStates: Record<string, Record<string, string>>;
    /** The CSS pseudo-class each state is written as. */
    statePseudo: Record<string, string>;
    /** Which token drives which property of which node (root, or an anatomy slot). */
    display: Record<string, Record<string, string>>;
    events: EventDef[];
}
