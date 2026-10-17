import { type ChangeEvent, type InputHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { DangerCircleIcon as CircleAlert, CloseIcon as X } from '../../../generated/icons';
import { stripNonAscii } from '../../../internal/utils';

type PrependProps =
  | { prepend?: ReactNode; prependGroup?: never }
  | { prependGroup?: ReactNode; prepend?: never };

type AppendProps =
  | { append?: ReactNode; appendGroup?: never }
  | { appendGroup?: ReactNode; append?: never };

interface TextFieldOwnProps {
  size?: 'sm' | 'md' | 'lg';
  error?: string;
  isInvalid?: boolean;
  currency?: boolean;
  clearable?: boolean;
  sanitize?: (value: string) => string;
  /** Kelas tambahan untuk elemen `<input>` (mis. padding kiri). */
  inputClassName?: string;
  /** Kelas tambahan untuk addon prepend/append (mis. background). */
  addonClassName?: string;
  'data-testid'?: string;
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> &
  TextFieldOwnProps &
  PrependProps &
  AppendProps;

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

const iconSizeStyles: Record<string, string> = {
  sm: '[&>svg]:h-4 [&>svg]:w-4',
  md: '[&>svg]:h-5 [&>svg]:w-5',
  lg: '[&>svg]:h-5 [&>svg]:w-5',
};

const groupBaseStyles =
  'flex items-center self-stretch bg-muted px-3 text-sm text-muted-foreground border-border';
const groupDisabledStyles =
  'flex items-center self-stretch bg-muted px-3 text-sm text-muted-foreground border-border';
const prependGroupStyles = `${groupBaseStyles} border-r`;
const appendGroupStyles = `${groupBaseStyles} border-l`;
const prependGroupDisabledStyles = `${groupDisabledStyles} border-r`;
const appendGroupDisabledStyles = `${groupDisabledStyles} border-l`;
const addonStyles = 'flex items-center self-stretch px-3';
const prependAddonDisabledStyles = 'border-r border-border bg-muted text-muted-foreground';
const appendAddonDisabledStyles = 'border-l border-border bg-muted text-muted-foreground';

function formatCurrency(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('id-ID');
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      size = 'md',
      error,
      isInvalid,
      prepend,
      prependGroup,
      append,
      appendGroup,
      currency,
      clearable = false,
      sanitize,
      inputClassName = '',
      addonClassName = '',
      className = '',
      disabled,
      readOnly,
      onChange,
      value,
      'data-testid': testId,
      ...rest
    },
    ref,
  ) => {
    const displayValue = currency ? formatCurrency(String(value ?? '')) : value;
    const leftPad = inputClassName ? '' : prepend ? 'pl-0' : prependGroup ? 'pl-3' : '';
    const rightPad = append ? 'pr-0' : appendGroup ? 'pr-3' : '';
    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    function handleChange(e: ChangeEvent<HTMLInputElement>) {
      const cleaned = stripNonAscii(e.target.value);
      if (cleaned !== e.target.value) {
        e.target.value = cleaned;
      }
      if (currency) {
        const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '');
        (onChange as ((value: string) => void) | undefined)?.(raw);
        return;
      }
      if (sanitize) {
        const raw = sanitize(e.target.value);
        if (raw !== e.target.value) {
          e.target.value = raw;
        }
      }
      onChange?.(e);
    }

    function handleClear() {
      handleChange({ target: { value: '' } } as ChangeEvent<HTMLInputElement>);
      if (ref && typeof ref === 'object' && ref.current) {
        ref.current.focus();
      }
    }

    return (
      <div>
        <div
          className={[
            'flex items-center rounded-lg border bg-background transition-colors overflow-auto',
            error || isInvalid
              ? 'border-danger focus-within:border-danger focus-within:ring-2 focus-within:ring-danger/20'
              : 'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30',
            disabled ? 'cursor-not-allowed bg-muted' : '',
            className,
          ].join(' ')}
        >
          {prependGroup && (
            <div className={disabled ? prependGroupDisabledStyles : prependGroupStyles}>
              {prependGroup}
            </div>
          )}
          {prepend && (
            <div
              className={`${addonStyles} ${disabled ? prependAddonDisabledStyles : ''} ${addonClassName}`}
            >
              {prepend}
            </div>
          )}
          <input
            data-testid={testId}
            ref={ref}
            disabled={disabled}
            readOnly={readOnly}
            value={displayValue}
            onChange={handleChange}
            className={[
              'w-full flex-1 border-none bg-transparent outline-none placeholder:text-muted-foreground',
              sizeStyles[size],
              iconSizeStyles[size],
              leftPad,
              rightPad,
              inputClassName,
              disabled ? 'cursor-not-allowed text-muted-foreground disabled:bg-muted' : '',
              readOnly ? 'cursor-default' : '',
            ].join(' ')}
            {...rest}
          />
          {clearable && hasValue && !disabled && !readOnly && (
            <span className="flex items-center pr-3 pl-1">
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear"
                className="flex cursor-pointer items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                tabIndex={-1}
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          )}
          {(error || isInvalid) && (
            <span className="flex items-center pr-3">
              <CircleAlert className="h-3.5 w-3.5" />
            </span>
          )}
          {appendGroup && (
            <div className={disabled ? appendGroupDisabledStyles : appendGroupStyles}>
              {appendGroup}
            </div>
          )}
          {append && (
            <div
              className={`${addonStyles} ${disabled ? appendAddonDisabledStyles : ''} ${addonClassName}`}
            >
              {append}
            </div>
          )}
        </div>
        {error && (
          <p
            data-testid={testId ? `${testId}-error` : undefined}
            className="mt-1 text-xs text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);

TextField.displayName = 'TextField';

export default TextField;
