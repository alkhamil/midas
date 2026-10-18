import type { ButtonHTMLAttributes } from 'react';
import { iconButtonDefaults, type IconButtonProps as DesignProps } from '../../generated/props';
import { EyeIcon, PenIcon, TrashBinIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';

export type IconButtonProps = DesignProps & {
  /** Teks untuk pembaca layar & tooltip bawaan browser. Default mengikuti `action`. */
  label?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof DesignProps | 'children'>;

const actions = {
  view: { Icon: EyeIcon, label: 'Lihat', tone: 'text-muted-foreground hover:text-foreground' },
  edit: { Icon: PenIcon, label: 'Ubah', tone: 'text-muted-foreground hover:text-foreground' },
  delete: { Icon: TrashBinIcon, label: 'Hapus', tone: 'text-danger hover:opacity-80' },
} as const;

/** Aksi baris tabel: lihat, ubah, hapus. Hanya ikon, jadi `label` wajib terbaca oleh pembaca layar. */
export function IconButton(props: IconButtonProps) {
  const { action, label, testId, className, type = 'button', ...rest } = { ...iconButtonDefaults, ...props };
  const a = actions[action];
  return (
    <button
      type={type}
      data-testid={testId}
      aria-label={label ?? a.label}
      title={label ?? a.label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
        a.tone,
        className,
      )}
      {...rest}
    >
      <a.Icon className="h-4 w-4" />
    </button>
  );
}
