import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { selectFieldDefaults, type SelectFieldProps as DesignProps } from '../../generated/props';
import { AltArrowDownIcon } from '../../generated/icons';
import { controlClass, FieldShell } from '../../internal/FieldShell';
import { cx } from '../../internal/cx';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export type SelectFieldProps = DesignProps & {
  options?: SelectOption[];
  error?: string;
  value?: string;
  name?: string;
  id?: string;
  className?: string;
  /** Called with an event-like object (`{ target: { value, name } }`) so it works with react-hook-form's `field.onChange`. */
  onChange?: (event: { target: { value: string; name?: string } }) => void;
  onBlur?: () => void;
};

/**
 * Dropdown list with a label — the design's select (trigger + menu), not the browser's native <select>.
 * Keyboard: ArrowUp/ArrowDown move, Enter/Space choose, Escape closes. The menu is positioned under the field.
 */
export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(function SelectField(props, ref) {
  const { label, placeholder, disabled, options = [], error, value = '', name, onChange, onBlur, testId, className, id: idProp } = { ...selectFieldDefaults, ...props };
  const generated = useId();
  const id = idProp ?? generated;
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => button.current as HTMLButtonElement);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const openMenu = () => {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex(o => o.value === value)));
    setOpen(true);
  };
  const choose = (o: SelectOption) => {
    if (o.disabled) return;
    onChange?.({ target: { value: o.value, name } });
    setOpen(false);
    button.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return openMenu();
      const d = e.key === 'ArrowDown' ? 1 : -1;
      let i = active;
      for (let n = 0; n < options.length; n++) {
        i = (i + d + options.length) % options.length;
        if (!options[i].disabled) break;
      }
      setActive(i);
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      if (options[active]) choose(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <FieldShell id={id} label={label} error={error} className={className}>
      <div ref={root} className="relative">
        <button
          ref={button}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-menu`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          data-testid={testId}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          onBlur={() => { if (!open) onBlur?.(); }}
          className={cx(controlClass(error, disabled), 'flex h-10 items-center justify-between gap-2 text-left', open && 'border-primary ring-2 ring-primary/30')}
        >
          <span className={cx('truncate', !selected && 'text-muted-foreground')}>{selected ? selected.label : placeholder}</span>
          <AltArrowDownIcon className={cx('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        {name && <input type="hidden" name={name} value={value} />}
        {open && (
          <ul id={`${id}-menu`} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-background py-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
            {options.map((o, i) => {
              const on = o.value === value;
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={on}
                  aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => choose(o)}
                  className={cx('flex h-9 cursor-pointer items-center px-3 text-sm', on ? 'bg-primary/10 font-medium text-primary' : 'text-foreground', i === active && !on && 'bg-muted', o.disabled && 'cursor-not-allowed opacity-50')}
                >
                  {o.label}
                </li>
              );
            })}
            {!options.length && <li className="px-3 py-2 text-sm text-muted-foreground">No options</li>}
          </ul>
        )}
      </div>
    </FieldShell>
  );
});
