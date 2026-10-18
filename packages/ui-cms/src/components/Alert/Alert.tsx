import type { HTMLAttributes, ReactNode } from 'react';
import { alertDefaults, type AlertProps as DesignProps } from '../../generated/props';
import { CheckCircleIcon, CloseCircleIcon, DangerTriangleIcon, InfoCircleIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';

export type AlertProps = Omit<DesignProps, 'message'> & {
  /** Isi pesan; menerima teks atau elemen. */
  message?: ReactNode;
} & Omit<HTMLAttributes<HTMLDivElement>, 'children' | keyof DesignProps>;

const variants = {
  success: { box: 'border-success bg-success/10', text: 'text-success', Icon: CheckCircleIcon },
  warning: { box: 'border-warning bg-warning/10', text: 'text-warning', Icon: DangerTriangleIcon },
  danger: { box: 'border-danger bg-danger/10', text: 'text-danger', Icon: CloseCircleIcon },
  info: { box: 'border-info bg-info/10', text: 'text-info', Icon: InfoCircleIcon },
} as const;

/** Pesan di dalam halaman atau form. Ikon + warna sesuai jenis. */
export function Alert(props: AlertProps) {
  const { variant, message, testId, className, ...rest } = { ...alertDefaults, ...props };
  const v = variants[variant];
  return (
    <div role="alert" data-testid={testId} className={cx('flex items-start gap-3 rounded-lg border px-4 py-3 text-sm text-foreground', v.box, className)} {...rest}>
      <v.Icon className={cx('mt-0.5 h-5 w-5 shrink-0', v.text)} />
      <div className="min-w-0 flex-1">{message}</div>
    </div>
  );
}
