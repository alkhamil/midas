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
    /** A managed icon slot that is on every instance: its icon def has no `show` switch and the slot is not optional. */
    alwaysVisible?: boolean;
}

/** A test on the resolved props: `prop` resolves to `is`, a string `prop` is or is not empty, or every test of `all` holds. */
export type Condition =
    | { prop: string; is: boolean | string }
    | { prop: string; empty: boolean }
    | { all: Condition[] };

/** The condition under which a prop is shown. */
export type VisibleIf = Condition;

/** A prop whose value is a mode of a variable collection (a dimension, locked by the schema). */
export interface VariableProp {
    source: 'variable';
    /** Declared collection the prop binds to; the resolved name is always "<Template> <Name>". */
    collection: string;
    /** The modes Auto Fix creates when the collection is missing (by mode id). Existing collections only gain the modes they lack. */
    modes?: string[];
    /** A standard scale (the Size modes): diagnostics report a mode that is missing or renamed in the template's collection. */
    standard?: boolean;
    /** The mode a new instance takes until its own mode is picked; one of the modes. */
    defaultMode?: string;
    /** How the root is drawn in one mode, by mode id: its border style. Modes without a rule are solid. */
    styles?: Record<string, { borderStyle: 'solid' | 'dashed' | 'dotted' }>;
    visibleIf?: VisibleIf;
}

/** The node a literal prop writes: `key` is `root` or an anatomy slot, `field` the node field (see display.js NODE_FIELDS). */
export interface NodeField {
    key: string;
    field: string;
}

/**
 * A content slot a template declares: a frame of the component that instances fill with their own layers (Figma's slot property: the names and
 * settings are the same, so the generator writes them into it). The id is the slot's prop name in the generated code.
 */
export interface SlotDef {
    id: string;
    name: string;
    description?: string;
    /** The fewest layers the slot should hold (0 or more) and the most it may (1 or more); a warning when broken. */
    min?: number;
    max?: number;
    /** Template ids the slot takes: an instance of a master bound to one of them. With `onlyAccepts` it takes only those. */
    accepts?: string[];
    onlyAccepts?: boolean;
    /** Display the slot while it is empty; off, an empty slot takes no space. */
    showEmpty?: boolean;
    /** Layers put into the slot fill its counter axis. */
    fillCounter?: boolean;
    /** The auto layout of the slot frame. */
    layout: 'horizontal' | 'vertical';
    /** The slot frame fills the width it is given: the cross axis of a vertical parent, what is left of the row in a horizontal one. */
    fill?: boolean;
    /** The name of a number prop: Play and the export draw that many copies of the slot's content (the canvas draws it once). */
    repeat?: string;
}

/** A text or control slot drawn as an input: the schema names the slot and the props that fill it. Data only: the engine renders it, the canvas keeps the text layer. */
export interface ControlDef {
    slot: string;
    value: string;
    placeholder?: string;
    readonly?: string;
    maxlength?: string;
    minlength?: string;
    count?: string;
    /** The value layer is hidden while the value is empty (the placeholder that shows in its place takes its space and no more). */
    hideWhenEmpty?: boolean;
    /** The reverse: the placeholder layer is hidden while the value is not empty, so the value wins over the placeholder. */
    hidePlaceholderWhenFilled?: boolean;
}

/** Dimensions a literal prop needs: the variable props whose collections must be bound on the master (data only). */
export interface RequiresCols { requires?: string[] }

/** A prop whose value is a literal stored on the instance. */
export type LiteralProp =
    | ({ source: 'literal'; type: 'boolean'; default: boolean; node?: NodeField; visibleIf?: VisibleIf; exclusiveWith?: string; clearsPreview?: boolean; /** Backfills an empty text prop with `text` when this toggle turns on (never overwrites, never removed on turn-off). */ fillEmpty?: { prop: string; text: string } } & RequiresCols)
    | ({ source: 'literal'; type: 'string'; default: string; node?: NodeField; visibleIf?: VisibleIf } & RequiresCols)
    | ({ source: 'literal'; type: 'number'; default: number | null; atMost?: string; visibleIf?: VisibleIf } & RequiresCols)
    | ({ source: 'literal'; type: 'enum'; options: string[]; default: string; slots?: Record<string, string | string[]>; control?: 'segmented'; visibleIf?: VisibleIf } & RequiresCols)
    | ({ source: 'literal'; type: 'iconComponent'; default: null; visibleIf?: VisibleIf } & RequiresCols);

export type PropDef = VariableProp | LiteralProp;

/** Which base role a token fills, per dimension mode. A plain role holds for every mode; a map names the role per
 * mode id (matched case-insensitively, `default` is the fallback). A `./token` value (`./status-border`) is a
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
    element: ElementDef;
    /** The primary text part: the anatomy id of the text or control slot a fresh instance shows and the text content prop edits. */
    primarySlot?: string;
    anatomy: AnatomySlot[];
    /** The managed icon slots; absent or empty for a template with none. */
    icons?: IconSlotDef[];
    control?: ControlDef;
    /** The box that owns interaction visuals when the element itself cannot take them: `wrapper` reflects the
     * inner control focus and disabled state onto the root (only with a `control`). */
    focusTarget?: 'wrapper';
    /** Interaction behaviour, antd parity: `focus` is the ring kind (`halo` switches the ring on focus as well as
     * focus-visible, `outline` on focus-visible only), `wave` shows the click wave. Data only. */
    interaction?: { focus: 'outline' | 'halo'; wave: boolean };
    props: Record<string, PropDef>;
    tokens: TokenGroups;
    tokenKinds: Record<string, TokenKind>;
    /** The base role of every token variable, for Auto Fix. Tokens without an entry resolve by their own name. */
    tokenRoles?: TokenRoles;
    persistentStates: Record<string, PersistentState>;
    /** Preview-only states: the base colour tokens each one replaces. */
    previewStates: Record<string, Record<string, string>>;
    /** The cross-axis alignment a new master is created with (start, center or end). The node's own alignment decides after that. */
    rootAlign?: 'start' | 'center' | 'end';
    /** The auto layout direction a new master is created with (horizontal when absent). Like `rootAlign` it only seeds a new master: the node's own layout decides after that. */
    rootLayout?: 'horizontal' | 'vertical';
    /** The main-axis alignment a new master is created with (start when absent); a default the node owns, like `rootAlign`. */
    rootPrimaryAlign?: 'start' | 'center' | 'end';
    /** The fixed width in px a new master is created with (the Input's 343): a default the node owns, not a variable. Absent: the master hugs. */
    rootWidth?: number;
    /** The content slots: frames of the component that instances fill with their own layers. Not the icon slots (`icons`). */
    slots?: SlotDef[];
    /** The CSS pseudo-class each state is written as. */
    statePseudo: Record<string, string>;
    /** Which token drives which property of which node (root, or an anatomy slot). */
    display: Record<string, Record<string, string>>;
    events: EventDef[];
}
