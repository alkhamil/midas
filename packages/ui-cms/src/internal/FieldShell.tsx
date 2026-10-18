import type { ReactNode } from 'react';
import { cx } from './cx';

interface FieldShellProps {
  id: string;
  label?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}

/** Label di atas, kontrol di tengah, pesan error di bawah — dipakai semua field berlabel. */
export function FieldShell({ id, label, error, className, children }: FieldShellProps) {
  return (
    <div className={cx('flex w-full flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Kelas kotak input: border, fokus berupa ring primary, error berwarna danger. */
export function controlClass(error?: string, disabled?: boolean): string {
  return cx(
    'w-full rounded-lg border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground',
    'outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
    error ? 'border-danger' : 'border-border',
    disabled && 'cursor-not-allowed opacity-50',
  );
}
