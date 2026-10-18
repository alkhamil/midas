import { useId, type ButtonHTMLAttributes } from 'react';
import { switchFieldDefaults, type SwitchFieldProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';

export type SwitchFieldProps = DesignProps & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof DesignProps | 'onChange' | 'children' | 'role'>;

/** Saklar on/off yang langsung berlaku, mis. status aktif. */
export function SwitchField(props: SwitchFieldProps) {
  const { label, disabled, checked = false, onCheckedChange, testId, className, id: idProp, ...rest } = { ...switchFieldDefaults, ...props };
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <div className={cx('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        role="switch"
        id={id}
        data-testid={testId}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cx(
          'relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-border',
        )}
        {...rest}
      >
        <span className={cx('inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[20px]' : 'translate-x-[2px]')} />
      </button>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
    </div>
  );
}
