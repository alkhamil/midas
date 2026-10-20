import type { HTMLAttributes } from 'react';
import { avatarDefaults, type AvatarProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';

export type AvatarProps = DesignProps & {
  /** Nama lengkap: huruf pertamanya menjadi inisial bila `initial` kosong. */
  name?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, keyof DesignProps>;

const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm' } as const;

/** Inisial pengguna dalam lingkaran. */
export function Avatar(props: AvatarProps) {
  const { size, initial, name, testId, className, ...rest } = { ...avatarDefaults, ...props };
  const letter = (initial || name?.trim().charAt(0) || 'U').toUpperCase();
  return (
    <span
      data-testid={testId}
      title={name}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-primary/12 font-bold text-primary', sizes[size], className)}
      {...rest}
    >
      {letter}
    </span>
  );
}
