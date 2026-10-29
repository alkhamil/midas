// Behaviour of the components of a library package.
//
// The components generated from the design are pictures of every variant: a Select "Open" and a Select "Closed" are two drawings picked by
// the `state` prop. This layer makes them work: it keeps the state (hover, pressed, focus, open, checked, the typed text...), picks the
// variant that matches, and gives the component the props a developer expects (`value`, `onValueChange`, `disabled`, `onClick`...).
// The look stays the design's; nothing here draws anything except the option list of a Select.
//
// Every exported component of the package goes through `behaviorFor`: a component that has a hand-made kit below gets it (when the
// design has the props the kit needs), any other component with a `state` property gets hover / pressed / focus / disabled, and the rest
// stays as drawn. The files are plain TSX next to the generated components (src/behavior/), compiled with them.

const NAME = /__NAME__/g;
const VIEW = /__VIEW__/g;

/** Shared helpers of every wrapper (src/behavior/runtime.tsx). */
export const RUNTIME = `import { useState } from 'react';
import type { FocusEvent, KeyboardEvent, MouseEvent } from 'react';

/** A value that is controlled when \`value\` is given, and kept here otherwise. */
export function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void): [T, (next: T) => void] {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  return [controlled ? value : inner, next => { if (!controlled) setInner(next); onChange?.(next); }];
}

type Mouse = (e: MouseEvent<HTMLDivElement>) => void;
type Focus = (e: FocusEvent<HTMLDivElement>) => void;
export interface StateHandlers { onMouseEnter?: Mouse; onMouseLeave?: Mouse; onMouseDown?: Mouse; onMouseUp?: Mouse; onFocus?: Focus; onBlur?: Focus }

/**
 * The State of the design that matches what the pointer and the keyboard are doing: pressed, hover, focus, or default; disabled and
 * loading win. \`values\` are the State values the design has; \`forced\` (the \`state\` prop) wins over everything.
 */
export function useVisualState(values: readonly string[], o: { disabled?: boolean; busy?: boolean; forced?: string }, user: StateHandlers = {}) {
  const [hover, setHover] = useState(false), [down, setDown] = useState(false), [focus, setFocus] = useState(false);
  const has = (v: string) => values.includes(v);
  const state = o.forced ?? (o.disabled && has('disabled') ? 'disabled' : o.busy && has('loading') ? 'loading' : down && has('pressed') ? 'pressed' : hover && has('hover') ? 'hover' : focus && has('focus') ? 'focus' : 'default');
  const live = !o.disabled;
  const handlers: StateHandlers = {
    onMouseEnter: e => { if (live) setHover(true); user.onMouseEnter?.(e); },
    onMouseLeave: e => { setHover(false); setDown(false); user.onMouseLeave?.(e); },
    onMouseDown: e => { if (live) setDown(true); user.onMouseDown?.(e); },
    onMouseUp: e => { setDown(false); user.onMouseUp?.(e); },
    onFocus: e => { if (live) setFocus(true); user.onFocus?.(e); },
    onBlur: e => { setFocus(false); setDown(false); user.onBlur?.(e); },
  };
  return { state, handlers };
}

/** What makes an element act like a button: focusable, Enter and Space click it, and nothing happens while it is blocked. */
export function activate(onClick: ((e: MouseEvent<HTMLDivElement>) => void) | undefined, blocked: boolean | undefined, role = 'button', onKey?: string[]) {
  return {
    role, tabIndex: blocked ? -1 : 0, 'aria-disabled': blocked || undefined,
    onClick: (e: MouseEvent<HTMLDivElement>) => { if (blocked) { e.preventDefault(); return; } onClick?.(e); },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => { if (!blocked && (e.key === 'Enter' || e.key === ' ' || onKey?.includes(e.key))) { e.preventDefault(); e.currentTarget.click(); } },
  };
}

/** The index of the direct child of \`root\` that holds \`target\`, or -1. */
export function childIndex(root: HTMLElement, target: EventTarget | null): number {
  return Array.prototype.findIndex.call(root.children, (c: Element) => c.contains(target as Node));
}
`;

const RUNTIME_DTS = `export {};\n`;

const imp = (extra = '') => `import { createElement } from 'react';
import type { ChangeEvent, KeyboardEvent, MouseEvent, ReactElement } from 'react';
import { __NAME__ as View, type __NAME__Props as ViewProps } from '../components/__NAME__';
import { activate, childIndex, useControllable, useVisualState, type StateHandlers } from './runtime';
${extra}`;
const dtsHead = `import type { ChangeEvent, ReactElement } from 'react';
import type { __NAME__Props as ViewProps } from '../components/__NAME__';
`;
const STATES = `const STATES = __STATES__ as readonly string[];\n`;

/** Prop descriptions for the documentation and the README: { name, type, values?, def?, label? }. */
const P = {
  disabled: { name: 'disabled', type: 'boolean', label: 'Not clickable', def: false },
  state: values => ({ name: 'state', type: 'enum', label: 'Shows a state (hover, pressed...) by force; it follows the pointer by itself', values: Object.fromEntries(values.map(v => [v, v])), def: 'default' }),
};

// ---- Generic: any component with a State property gets hover / pressed / focus / disabled
const GENERIC = {
  types: `export type __NAME__Props = ViewProps & { disabled?: boolean };`,
  body: `
export function __NAME__(props: __NAME__Props): ReactElement {
  const { disabled, state: forced, ...rest } = props;
  const v = useVisualState(STATES, { disabled, forced }, rest as StateHandlers);
  return createElement(View, { ...rest, ...v.handlers, state: v.state } as ViewProps);
}
`,
};

// ---- Button, icon button and link: pressable
const pressable = (role, { loading }) => ({
  types: `export type __NAME__Props = Omit<ViewProps, 'state'> & {
  /** Not clickable. */
  disabled?: boolean;${loading ? '\n  /** Shows the spinner and is not clickable while the action runs. */\n  loading?: boolean;' : ''}
  /** Shows a state by force; it follows the pointer and the keyboard by itself. */
  state?: ViewProps['state'];
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
};`,
  body: `
export function __NAME__(props: __NAME__Props): ReactElement {
  const { disabled, ${loading ? 'loading, ' : ''}state: forced, onClick, ...rest } = props;
  const blocked = !!(disabled${loading ? ' || loading' : ''});
  const v = useVisualState(STATES, { disabled, busy: ${loading ? 'loading' : 'false'}, forced }, rest as StateHandlers);
  return createElement(View, { ...rest, ...v.handlers, ...activate(onClick, blocked, '${role}'), ${loading ? "'aria-busy': loading || undefined, " : ''}state: v.state } as ViewProps);
}
`,
  meta: (c, values) => [...c.props.filter(p => p.name !== 'state'), P.disabled, ...(loading ? [{ name: 'loading', type: 'boolean', label: 'Busy: shows the spinner, not clickable', def: false }] : []), P.state(values)],
  fits: c => has(c, 'state'),
});

// ---- Checkbox
const CHECKBOX = {
  types: `export type CheckboxProps = Omit<ViewProps, 'state' | 'checked'> & {
  /** Checked, unchecked or "indeterminate". Give it to control the checkbox; leave it out and the checkbox keeps its own. */
  checked?: boolean | 'indeterminate';
  defaultChecked?: boolean | 'indeterminate';
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  state?: ViewProps['state'];
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
};`,
  body: `
export function Checkbox(props: CheckboxProps): ReactElement {
  const { checked, defaultChecked = false, onCheckedChange, disabled, state: forced, onClick, ...rest } = props;
  const [value, set] = useControllable<boolean | 'indeterminate'>(checked, defaultChecked, v => onCheckedChange?.(v === true));
  const v = useVisualState(STATES, { disabled, forced }, rest as StateHandlers);
  const act = activate(e => { set(value === true ? false : true); onClick?.(e); }, disabled, 'checkbox', ['Enter']);
  return createElement(View, { ...rest, ...v.handlers, ...act, 'aria-checked': value === 'indeterminate' ? 'mixed' : value, state: v.state, checked: value === 'indeterminate' ? 'indeterminate' : value ? 'checked' : 'unchecked' } as ViewProps);
}
`,
  meta: (c, values) => [P.state(values), { name: 'checked', type: 'boolean', label: 'Checked (or "indeterminate")', def: false }, { name: 'defaultChecked', type: 'boolean', label: 'Checked at the start, when not controlled', def: false }, ...c.props.filter(p => p.name === 'label'), P.disabled],
  fits: c => has(c, 'state') && has(c, 'checked'),
};

// ---- Radio (alone, or in a RadioGroup)
const RADIO = {
  types: `export type RadioProps = Omit<ViewProps, 'state' | 'selected'> & {
  /** Selected. Inside a RadioGroup the group decides, from \`value\`. */
  checked?: boolean;
  defaultChecked?: boolean;
  /** What this radio stands for in a RadioGroup. */
  value?: string;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  state?: ViewProps['state'];
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
};
export type RadioGroupProps = { value?: string; defaultValue?: string; onValueChange?: (value: string) => void; children?: ReactNode; className?: string; style?: CSSProperties };
export declare function RadioGroup(props: RadioGroupProps): ReactElement;`,
  body: `
const GroupContext = createContext<{ value: string | undefined; set: (v: string) => void } | null>(null);

/** Radios that share one choice: \`<RadioGroup value={v} onValueChange={setV}><Radio value="a" label="A" /><Radio value="b" label="B" /></RadioGroup>\`. */
export function RadioGroup({ value, defaultValue, onValueChange, children, className, style }: RadioGroupProps): ReactElement {
  const [v, set] = useControllable<string | undefined>(value, defaultValue, next => { if (next !== undefined) onValueChange?.(next); });
  return createElement(GroupContext.Provider, { value: { value: v, set: n => set(n) } }, createElement('div', { role: 'radiogroup', className, style }, children));
}

export function Radio(props: RadioProps): ReactElement {
  const { checked, defaultChecked = false, value, onCheckedChange, disabled, state: forced, onClick, ...rest } = props;
  const group = useContext(GroupContext);
  const [own, setOwn] = useControllable<boolean>(group ? undefined : checked, defaultChecked, v => onCheckedChange?.(v));
  const on = group ? group.value === value : own;
  const v = useVisualState(STATES, { disabled, forced }, rest as StateHandlers);
  const act = activate(e => { if (group) { if (value !== undefined) group.set(value); } else setOwn(true); onClick?.(e); }, disabled, 'radio');
  return createElement(View, { ...rest, ...v.handlers, ...act, 'aria-checked': on, state: v.state, selected: on } as ViewProps);
}
`,
  imports: `import { createContext, useContext } from 'react';\nimport type { CSSProperties, ReactNode } from 'react';`,
  meta: (c, values) => [P.state(values), { name: 'checked', type: 'boolean', label: 'Selected', def: false }, { name: 'value', type: 'string', label: 'What it stands for inside a RadioGroup' }, ...c.props.filter(p => p.name === 'label'), P.disabled],
  fits: c => has(c, 'state') && has(c, 'selected'),
  extraExports: ['RadioGroup'],
};

// ---- Switch
const SWITCH = {
  types: `export type SwitchProps = Omit<ViewProps, 'state' | 'checked'> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  state?: ViewProps['state'];
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
};`,
  body: `
export function Switch(props: SwitchProps): ReactElement {
  const { checked, defaultChecked = false, onCheckedChange, disabled, state: forced, onClick, ...rest } = props;
  const [on, set] = useControllable<boolean>(checked, defaultChecked, onCheckedChange);
  const v = useVisualState(STATES, { disabled, forced }, rest as StateHandlers);
  const act = activate(e => { set(!on); onClick?.(e); }, disabled, 'switch');
  return createElement(View, { ...rest, ...v.handlers, ...act, 'aria-checked': on, state: v.state, checked: on } as ViewProps);
}
`,
  meta: (c, values) => [P.state(values), { name: 'checked', type: 'boolean', label: 'On', def: false }, { name: 'defaultChecked', type: 'boolean', label: 'On at the start, when not controlled', def: false }, ...c.props.filter(p => ['label', 'showLabel'].includes(p.name)), P.disabled],
  fits: c => has(c, 'state') && has(c, 'checked'),
};

// ---- Segmented control
const SEGMENTED = {
  types: `export type SegmentedControlProps = Omit<ViewProps, 'selected'> & {
  /** The chosen segment, "1" to "3". Give it to control the segments. */
  value?: ViewProps['selected'];
  defaultValue?: ViewProps['selected'];
  onValueChange?: (value: NonNullable<ViewProps['selected']>) => void;
};`,
  body: `
export function SegmentedControl(props: SegmentedControlProps): ReactElement {
  const { value, defaultValue = '1', onValueChange, onClick, onKeyDown, ...rest } = props;
  const [current, set] = useControllable<NonNullable<ViewProps['selected']>>(value, defaultValue, onValueChange);
  const count = 3;
  return createElement(View, {
    ...rest, selected: current, role: 'radiogroup', tabIndex: 0,
    onClick: (e: MouseEvent<HTMLDivElement>) => { const i = childIndex(e.currentTarget, e.target); if (i >= 0 && i < count) set(String(i + 1) as typeof current); onClick?.(e); },
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      const i = Number(current) - 1, next = e.key === 'ArrowRight' ? Math.min(count - 1, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : i;
      if (next !== i) { e.preventDefault(); set(String(next + 1) as typeof current); }
      onKeyDown?.(e);
    },
  } as ViewProps);
}
`,
  meta: (c) => [{ name: 'value', type: 'enum', label: 'The chosen segment', values: { 1: '1', 2: '2', 3: '3' }, def: '1' }, { name: 'defaultValue', type: 'enum', label: 'The chosen segment at the start, when not controlled', values: { 1: '1', 2: '2', 3: '3' }, def: '1' }, ...c.props.filter(p => p.name !== 'selected')],
  fits: c => has(c, 'selected'),
};

// ---- Accordion
const ACCORDION = {
  types: `export type AccordionProps = Omit<ViewProps, 'state'> & {
  /** Open. Give it to control the accordion. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};`,
  body: `
export function Accordion(props: AccordionProps): ReactElement {
  const { open, defaultOpen = false, onOpenChange, onClick, ...rest } = props;
  const [isOpen, set] = useControllable<boolean>(open, defaultOpen, onOpenChange);
  return createElement(View, {
    ...rest, state: isOpen ? 'open' : 'closed', 'aria-expanded': isOpen,
    onClick: (e: MouseEvent<HTMLDivElement>) => { if (childIndex(e.currentTarget, e.target) === 0) set(!isOpen); onClick?.(e); },
  } as ViewProps);
}
`,
  meta: c => [{ name: 'open', type: 'boolean', label: 'Open', def: false }, { name: 'defaultOpen', type: 'boolean', label: 'Open at the start, when not controlled', def: false }, ...c.props.filter(p => p.name !== 'state')],
  fits: c => has(c, 'state') && c.props.find(p => p.name === 'state')?.values && Object.values(c.props.find(p => p.name === 'state').values).includes('open'),
};

// ---- Text inputs: the text of the field is a real <input> / <textarea> (the generated component renders it, see `inputs`)
const textField = (tag, { rows }) => ({
  inputs: { layers: new Set(['Value', 'Placeholder']), tag },
  types: `export type __NAME__Props = Omit<ViewProps, 'state' | 'value' | 'value2' | 'inputProps' | 'onChange' | 'placeholder'> & {
  /** The text. Give it to control the field; leave it out and the field keeps its own. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: ChangeEvent<HTML${tag === 'input' ? 'Input' : 'TextArea'}Element>) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** Shows the error look. */
  invalid?: boolean;${tag === 'input' ? "\n  type?: 'text' | 'email' | 'tel' | 'url' | 'search' | 'number';" : ''}
  name?: string;
  id?: string;
  maxLength?: number;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
  /** Shows a state by force; it follows the pointer and the keyboard by itself. */
  state?: ViewProps['state'];
};`,
  body: `
export function __NAME__(props: __NAME__Props): ReactElement {
  const { value, defaultValue = '', onValueChange, onChange, placeholder, disabled, readOnly, invalid, ${tag === 'input' ? "type = 'text', " : ''}name, id, maxLength, autoComplete, autoFocus, required, state: forced, onClick, ...rest } = props;
  const [text, set] = useControllable<string>(value, defaultValue, onValueChange);
  const v = useVisualState(STATES, { disabled, forced: forced ?? (readOnly ? 'read-only' : invalid ? 'error' : undefined) }, rest as StateHandlers);
  const clearable = (rest as { clearable?: boolean }).clearable;
  return createElement(View, {
    ...rest, ...v.handlers, state: v.state, value: 'filled', value2: text,
    ...(maxLength !== undefined ? { count: text.length + '/' + maxLength } : {}),
    onClick: (e: MouseEvent<HTMLDivElement>) => {
      const root = e.currentTarget, target = e.target as Element;
      const icons = root.querySelectorAll('svg');
      if (clearable && text && icons.length && icons[icons.length - 1].contains(target)) { set(''); onClick?.(e); return; }
      root.querySelector<HTML${tag === 'input' ? 'Input' : 'TextArea'}Element>('${tag}')?.focus();
      onClick?.(e);
    },
    inputProps: { value: text, placeholder, disabled, readOnly, name, id, maxLength, autoComplete, autoFocus, required, ${tag === 'input' ? 'type, ' : `rows: ${rows}, `}'aria-invalid': invalid || undefined, onChange: e => { set(e.target.value); onChange?.(e); } },
  } as ViewProps);
}
`,
  meta: (c, values) => [{ name: 'value', type: 'string', label: 'The text' }, { name: 'defaultValue', type: 'string', label: 'The text at the start, when not controlled', def: '' }, { name: 'placeholder', type: 'string', label: 'Shown while the field is empty', def: 'Placeholder' }, P.disabled, { name: 'readOnly', type: 'boolean', label: 'Can be read, not changed', def: false }, { name: 'invalid', type: 'boolean', label: 'Shows the error look', def: false }, ...c.props.filter(p => !['state', 'value', 'value2', 'placeholder'].includes(p.name) && p.type !== 'node'), P.state(values)],
  fits: c => has(c, 'state') && has(c, 'value2'),
});

// ---- Password input: the eye shows and hides the text
const PASSWORD = {
  inputs: { layers: new Set(['Value', 'Dots']), tag: 'input' },
  types: `export type PasswordInputProps = Omit<ViewProps, 'state' | 'value' | 'visibility' | 'inputProps' | 'onChange'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  id?: string;
  autoComplete?: string;
  state?: ViewProps['state'];
};`,
  body: `
export function PasswordInput(props: PasswordInputProps): ReactElement {
  const { value, defaultValue = '', onValueChange, onChange, placeholder, disabled, invalid, name, id, autoComplete = 'current-password', state: forced, onClick, ...rest } = props;
  const [text, set] = useControllable<string>(value, defaultValue, onValueChange);
  const [shown, setShown] = useState(false);
  const v = useVisualState(STATES, { disabled, forced: forced ?? (invalid ? 'error' : undefined) }, rest as StateHandlers);
  return createElement(View, {
    ...rest, ...v.handlers, state: v.state, visibility: shown ? 'shown' : 'hidden', value: text,
    onClick: (e: MouseEvent<HTMLDivElement>) => {
      const icons = e.currentTarget.querySelectorAll('svg');
      if (!disabled && icons.length && icons[icons.length - 1].contains(e.target as Node)) setShown(s => !s);
      else e.currentTarget.querySelector('input')?.focus();
      onClick?.(e);
    },
    inputProps: { value: text, placeholder, disabled, name, id, autoComplete, type: shown ? 'text' : 'password', 'aria-invalid': invalid || undefined, onChange: e => { set(e.target.value); onChange?.(e); } },
  } as ViewProps);
}
`,
  imports: `import { useState } from 'react';`,
  meta: (c, values) => [{ name: 'value', type: 'string', label: 'The text' }, { name: 'defaultValue', type: 'string', label: 'The text at the start, when not controlled', def: '' }, { name: 'placeholder', type: 'string', label: 'Shown while the field is empty' }, P.disabled, { name: 'invalid', type: 'boolean', label: 'Shows the error look', def: false }, ...c.props.filter(p => ['size'].includes(p.name)), P.state(values)],
  fits: c => has(c, 'state') && has(c, 'visibility'),
};

// ---- Number input: minus and plus
const NUMBER = {
  inputs: { layers: new Set(['Value']), tag: 'input' },
  types: `export type NumberInputProps = Omit<ViewProps, 'state' | 'value' | 'inputProps' | 'onChange'> & {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  id?: string;
  state?: ViewProps['state'];
};`,
  body: `
export function NumberInput(props: NumberInputProps): ReactElement {
  const { value, defaultValue = 0, onValueChange, min, max, step = 1, disabled, invalid, name, id, state: forced, onClick, ...rest } = props;
  const [n, set] = useControllable<number>(value, defaultValue, onValueChange);
  const [draft, setDraft] = useState<string | null>(null);
  const v = useVisualState(STATES, { disabled, forced: forced ?? (invalid ? 'error' : undefined) }, rest as StateHandlers);
  const clamp = (x: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, x));
  const change = (x: number) => { if (!Number.isNaN(x)) set(clamp(x)); };
  return createElement(View, {
    ...rest, ...v.handlers, state: v.state, value: String(n),
    onClick: (e: MouseEvent<HTMLDivElement>) => {
      const i = childIndex(e.currentTarget, e.target);
      if (!disabled && i === 0) change(n - step);
      else if (!disabled && i === e.currentTarget.children.length - 1) change(n + step);
      onClick?.(e);
    },
    inputProps: {
      value: draft ?? String(n), disabled, name, id, inputMode: 'decimal', 'aria-invalid': invalid || undefined,
      onChange: e => { setDraft(e.target.value); const x = Number(e.target.value); if (e.target.value.trim() !== '' && !Number.isNaN(x)) set(clamp(x)); },
      onBlur: () => setDraft(null),
      onKeyDown: e => { if (e.key === 'ArrowUp') { e.preventDefault(); change(n + step); setDraft(null); } if (e.key === 'ArrowDown') { e.preventDefault(); change(n - step); setDraft(null); } },
    },
  } as ViewProps);
}
`,
  imports: `import { useState } from 'react';`,
  meta: (c, values) => [{ name: 'value', type: 'string', label: 'The number' }, { name: 'defaultValue', type: 'string', label: 'The number at the start, when not controlled', def: '0' }, { name: 'min', type: 'string', label: 'Smallest value' }, { name: 'max', type: 'string', label: 'Largest value' }, { name: 'step', type: 'string', label: 'What minus and plus change', def: '1' }, P.disabled, { name: 'invalid', type: 'boolean', label: 'Shows the error look', def: false }, ...c.props.filter(p => ['size'].includes(p.name)), P.state(values)],
  fits: c => has(c, 'state') && has(c, 'value') && !has(c, 'visibility') && !has(c, 'value2') && c.name === 'Number Input',
};

// ---- Select: the field opens a list of options
const SELECT = {
  types: `export type SelectOption = string | { value: string; label: string; disabled?: boolean };
export type SelectProps = Omit<ViewProps, 'state' | 'value' | 'value2' | 'mode' | 'selectedText' | 'chip1' | 'chip2' | 'onChange'> & {
  /** What can be chosen: strings, or { value, label }. */
  options?: SelectOption[];
  /** The chosen value. Give it to control the select. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  name?: string;
  /** Shows a state by force; it follows the pointer, the keyboard and the list by itself. */
  state?: ViewProps['state'];
};`,
  body: `
const norm = (o: SelectOption) => (typeof o === 'string' ? { value: o, label: o } : o);

export function Select(props: SelectProps): ReactElement {
  const { options = [], value, defaultValue, onValueChange, placeholder = 'Select an option', disabled, invalid, name, state: forced, onClick, onKeyDown, className, style, clearable, searchable, ...rest } = props;
  const list = options.map(norm);
  const [chosen, set] = useControllable<string | undefined>(value, defaultValue, v => { if (v !== undefined) onValueChange?.(v); });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const shown = searchable && query ? list.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : list;
  const current = list.find(o => o.value === chosen);
  const v = useVisualState(STATES, { disabled, forced: forced ?? (open ? 'focus' : invalid ? 'error' : undefined) }, rest as StateHandlers);
  useEffect(() => {
    if (!open) return;
    const place = () => setRect(box.current?.getBoundingClientRect() ?? null);
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node) && !listRef.current?.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    place();
    document.addEventListener('mousedown', away);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);
  const pick = (o: { value: string; disabled?: boolean }) => { if (o.disabled) return; set(o.value); setOpen(false); setQuery(''); };
  const toggle = () => { if (disabled) return; setOpen(o => !o); setActive(Math.max(0, shown.findIndex(o => o.value === chosen))); };
  return createElement('div', { ref: box, className: 'mds:relative mds:inline-block', style: { display: 'inline-block', position: 'relative' } },
    createElement(View, {
      ...rest, ...v.handlers, className, style, placeholder, searchable, clearable, state: v.state, value: current ? 'filled' : 'empty', value2: current?.label ?? '',
      role: 'combobox', tabIndex: disabled ? -1 : 0, 'aria-expanded': open, 'aria-haspopup': 'listbox', 'aria-disabled': disabled || undefined,
      onClick: (e: MouseEvent<HTMLDivElement>) => {
        const icons = e.currentTarget.querySelectorAll('svg');
        if (clearable && current && icons.length > 1 && icons[icons.length - 2].contains(e.target as Node)) { set(undefined); onValueChange?.(''); }
        else toggle();
        onClick?.(e);
      },
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.key === 'Escape') { setOpen(false); setQuery(''); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) toggle(); else setActive(a => Math.min(shown.length - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
        else if ((e.key === 'Enter' || e.key === ' ') && !(searchable && open && e.key === ' ')) { e.preventDefault(); if (open && shown[active]) pick(shown[active]); else toggle(); }
        else if (searchable && open && e.key.length === 1) { setQuery(q => q + e.key); setActive(0); }
        else if (searchable && open && e.key === 'Backspace') setQuery(q => q.slice(0, -1));
        onKeyDown?.(e);
      },
    } as unknown as ViewProps),
    name ? createElement('input', { type: 'hidden', name, value: chosen ?? '' }) : null,
    open && rect ? createPortal(createElement('ul', { ref: listRef, role: 'listbox', 'data-theme': box.current?.closest('[data-theme]')?.getAttribute('data-theme') ?? undefined, style: { position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width, zIndex: 1000 }, className: 'mds:[margin:0] mds:[padding:4px] mds:[list-style:none] mds:[min-width:100%] mds:[max-height:240px] mds:overflow-auto mds:bg-surface mds:[border-style:solid] mds:[border-width:1px] mds:border-border mds:[border-radius:8px] mds:[box-shadow:0_8px_24px_rgba(15,23,42,0.12)] mds:[box-sizing:border-box]' },
      searchable && query ? createElement('li', { className: 'mds:[padding:4px_8px] mds:[font-size:12px] mds:text-muted-foreground' }, 'Search: ' + query) : null,
      shown.length ? shown.map((o, i) => createElement('li', {
        key: o.value, role: 'option', 'aria-selected': o.value === chosen, 'aria-disabled': o.disabled || undefined,
        className: 'mds:[padding:8px_12px] mds:[font-size:14px] mds:[line-height:20px] mds:[border-radius:6px] mds:[cursor:pointer] mds:text-foreground ' + (i === active ? 'mds:bg-muted ' : '') + (o.value === chosen ? 'mds:[font-weight:600] ' : '') + (o.disabled ? 'mds:text-muted-foreground' : ''),
        onMouseEnter: () => setActive(i), onMouseDown: (e: MouseEvent) => e.preventDefault(), onClick: () => pick(o),
      }, o.label)) : createElement('li', { className: 'mds:[padding:8px_12px] mds:[font-size:14px] mds:text-muted-foreground' }, 'No options'),
    ), document.body) : null);
}
`,
  imports: `import { useEffect, useRef, useState } from 'react';\nimport { createPortal } from 'react-dom';`,
  meta: (c, values) => [{ name: 'options', type: 'node', ts: 'SelectOption[]', label: 'What can be chosen: strings, or { value, label }', demo: ['Option A', 'Option B', 'Option C'] }, { name: 'value', type: 'string', label: 'The chosen value' }, { name: 'defaultValue', type: 'string', label: 'The chosen value at the start, when not controlled' }, { name: 'placeholder', type: 'string', label: 'Shown while nothing is chosen', def: 'Select an option' }, P.disabled, { name: 'invalid', type: 'boolean', label: 'Shows the error look', def: false }, ...c.props.filter(p => ['size', 'searchable', 'clearable', 'showLeadingIcon', 'showPrefixAddon', 'prefixAddon', 'showSuffixAddon', 'suffixAddon'].includes(p.name)), P.state(values)],
  fits: c => has(c, 'state') && has(c, 'value2') && has(c, 'mode'),
  docOptions: ['Option A', 'Option B', 'Option C'],
};

// ---- Form item: the label, the hint and the error around a control that you put inside
const FORMITEM = {
  slot: new Set(['TextField', 'Textarea', 'Select']),
  types: `export type FormItemProps = Omit<ViewProps, 'state'> & {
  /** Shows the error message and the error look. */
  invalid?: boolean;
  disabled?: boolean;
  state?: ViewProps['state'];
};`,
  body: `
export function FormItem(props: FormItemProps): ReactElement {
  const { invalid, disabled, state, ...rest } = props;
  return createElement(View, { ...rest, state: state ?? (invalid ? 'error' : disabled ? 'disabled' : 'default') } as ViewProps);
}
`,
  meta: (c, values) => [...c.props.filter(p => !['state', 'control'].includes(p.name) && p.type !== 'node'), { name: 'invalid', type: 'boolean', label: 'Shows the error message', def: false }, P.disabled, { name: 'children', type: 'node', label: 'The control: <TextField />, <Select />...' }],
  fits: c => has(c, 'state') && has(c, 'control'),
};

// ---- Side navbar: the toggle on its edge collapses and expands it
const SIDENAV = {
  types: `export type SideNavbarProps = Omit<ViewProps, 'state'> & {
  /** Only the icons are shown. Give it to control the sidebar. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** The height of the sidebar, for example "100vh". The design is a fixed height; the panel follows this one. */
  height?: number | string;
};`,
  body: `
export function SideNavbar(props: SideNavbarProps): ReactElement {
  const { collapsed, defaultCollapsed = false, onCollapsedChange, height, onClick, className, style, ...rest } = props;
  const [shut, set] = useControllable<boolean>(collapsed, defaultCollapsed, onCollapsedChange);
  return createElement(View, {
    ...rest, state: shut ? 'collapsed' : 'expanded', 'aria-expanded': !shut,
    className: height === undefined ? className : 'mds:[&>:first-child]:[height:100%]' + (className ? ' ' + className : ''),
    style: height === undefined ? style : { ...style, height },
    onClick: (e: MouseEvent<HTMLDivElement>) => {
      const i = childIndex(e.currentTarget, e.target);
      if (i > 0 && i === e.currentTarget.children.length - 1) set(!shut);   // the toggle is the last layer
      onClick?.(e);
    },
  } as ViewProps);
}
`,
  meta: c => [{ name: 'collapsed', type: 'boolean', label: 'Only the icons are shown', def: false }, { name: 'height', type: 'string', label: 'Height of the sidebar, such as 100vh' }, { name: 'defaultCollapsed', type: 'boolean', label: 'Collapsed at the start, when not controlled', def: false }, ...c.props.filter(p => p.name !== 'state')],
  fits: c => has(c, 'state') && stateValues(c).includes('collapsed'),
};

// ---- Top bar: the user opens the menu
const TOPBAR = {
  types: `export type TopBarMenuItem = 'profile' | 'settings' | 'logout';
export type TopBarProps = Omit<ViewProps, 'showUserMenu'> & {
  /** The user menu is open. Give it to control it. */
  userMenuOpen?: boolean;
  defaultUserMenuOpen?: boolean;
  onUserMenuOpenChange?: (open: boolean) => void;
  /** An item of the user menu was chosen. */
  onMenuSelect?: (item: TopBarMenuItem) => void;
};`,
  body: `
const MENU_ITEMS: Record<number, TopBarMenuItem> = { 2: 'profile', 3: 'settings', 5: 'logout' };
const MENU_OVER = 'mds:relative mds:[&>:nth-child(2)]:absolute mds:[&>:nth-child(2)]:[top:64px] mds:[&>:nth-child(2)]:[right:16px] mds:[&>:nth-child(2)]:z-50';

export function TopBar(props: TopBarProps): ReactElement {
  const { userMenuOpen, defaultUserMenuOpen = false, onUserMenuOpenChange, onMenuSelect, onClick, className, ...rest } = props;
  const [open, set] = useControllable<boolean>(userMenuOpen, defaultUserMenuOpen, onUserMenuOpenChange);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!(e.target as Element).closest?.('[data-mds-topbar="' + id + '"]')) set(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  });
  return createElement(View, {
    ...rest, showUserMenu: open, 'data-mds-topbar': id,
    // the menu opens over the page, under the user, and does not push the page down
    className: MENU_OVER + (className ? ' ' + className : ''),
    onClick: (e: MouseEvent<HTMLDivElement>) => {
      const bar = e.currentTarget.children[0], menu = e.currentTarget.children[1];
      if (bar?.children[1]?.contains(e.target as Node)) set(!open);
      else if (menu?.contains(e.target as Node)) {
        const item = MENU_ITEMS[childIndex(menu as HTMLElement, e.target) as number];
        if (item) { onMenuSelect?.(item); set(false); }
      }
      onClick?.(e);
    },
  } as unknown as ViewProps);
}
`,
  imports: `import { useEffect, useId } from 'react';`,
  meta: c => [{ name: 'userMenuOpen', type: 'boolean', label: 'The user menu is open', def: false }, { name: 'defaultUserMenuOpen', type: 'boolean', label: 'Open at the start, when not controlled', def: false }, ...c.props.filter(p => p.name !== 'showUserMenu')],
  fits: c => has(c, 'showUserMenu'),
};

const has = (c, name) => c.props.some(p => p.name === name);
const stateValues = c => Object.values(c.props.find(p => p.name === 'state')?.values || {});

const KITS = {
  Button: pressable('button', { loading: true }),
  IconButton: pressable('button', { loading: true }),
  Link: pressable('link', { loading: false }),
  Checkbox: CHECKBOX,
  Radio: RADIO,
  Switch: SWITCH,
  SegmentedControl: SEGMENTED,
  Accordion: ACCORDION,
  TextField: textField('input', {}),
  Textarea: textField('textarea', { rows: 3 }),
  PasswordInput: PASSWORD,
  NumberInput: NUMBER,
  Select: SELECT,
  FormItem: FORMITEM,
  SideNavbar: SIDENAV,
  TopBar: TOPBAR,
};

/**
 * The behaviour of one component: a hand-made kit when there is one that fits the design's props, else hover / pressed / focus for a
 * component with a `state` property, else nothing (the component stays as drawn).
 * @param {{ name: string, exportName: string, props: object[] }} c
 * @returns {null | { kit: 'kit' | 'generic', inputs?: { layers: Set<string>, tag: 'input' | 'textarea' }, files: Record<string, string>, props: object[], extraExports: string[] }}
 */
export function behaviorFor(c) {
  const kit = KITS[c.exportName];
  const generic = has(c, 'state') && stateValues(c).includes('default');
  const mine = kit && (kit.fits ? kit.fits(c) : true);
  const use = mine ? kit : generic ? { ...GENERIC, meta: (cc, values) => [...cc.props.filter(p => p.name !== 'state'), P.disabled, P.state(values)] } : null;
  if (!use) return null;
  const values = stateValues(c);
  const fill = s => s.replace(NAME, c.exportName).replace(VIEW, c.exportName).replace('__STATES__', JSON.stringify(values));
  const types = fill(use.types), body = fill(use.body);
  const tsx = `// Generated by Midas: the behaviour of ${c.name} (state, keyboard, props). The look is the design's.\n${fill(imp(use.imports || ''))}${values.length ? fill(STATES) : ''}${types.replace(/^export declare function .*$/gm, '').trimEnd()}\n${body}`;
  const dts = `${fill(dtsHead)}${use.types.includes('ReactNode') ? "import type { CSSProperties, ReactNode } from 'react';\n" : ''}${use.types.includes('MouseEvent') ? "import type { MouseEvent } from 'react';\n" : ''}${types}${types.includes('declare function') ? '' : ''}\nexport declare function ${c.exportName}(props: ${c.exportName}Props): ReactElement;\n`;
  return {
    kit: mine ? 'kit' : 'generic', inputs: use.inputs, slot: use.slot, extraExports: use.extraExports || [],
    files: { [`src/behavior/${c.exportName}.tsx`]: tsx, [`dist/behavior/${c.exportName}.d.ts`]: dts },
    props: use.meta ? use.meta(c, values) : c.props,
  };
}

export { RUNTIME_DTS };
