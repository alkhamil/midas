import { type ReactNode } from 'react';
import { CheckCircleIcon as CircleCheck, CloseCircleIcon as CircleX, DangerTriangleIcon as TriangleAlert, InfoCircleIcon as Info } from '../../generated/icons';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  message: string | ReactNode;
  testId?: string;
}

const variantConfig: Record<
  AlertVariant,
  { bg: string; text: string; border: string; Icon: typeof CircleCheck }
> = {
  success: {
    bg: 'bg-success/15',
    text: 'text-success',
    border: 'border-success',
    Icon: CircleCheck,
  },
  error: {
    bg: 'bg-danger/15',
    text: 'text-danger',
    border: 'border-danger',
    Icon: CircleX,
  },
  warning: {
    bg: 'bg-warning/15',
    text: 'text-warning',
    border: 'border-warning',
    Icon: TriangleAlert,
  },
  info: {
    bg: 'bg-info/15',
    text: 'text-info',
    border: 'border-info',
    Icon: Info,
  },
};

function Alert({ variant, message, testId }: AlertProps) {
  const { bg, text, border, Icon } = variantConfig[variant];

  return (
    <div
      data-testid={testId}
      className={[
        'flex items-center rounded-lg border p-3 text-sm font-medium gap-2',
        bg,
        text,
        border,
      ].join(' ')}
    >
      {Icon && <Icon className="h-5 w-5 shrink-0" />}
      <span className="flex-1 text-left">{message}</span>
    </div>
  );
}

export default Alert;
