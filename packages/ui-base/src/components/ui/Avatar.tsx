interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
  /** Huruf yang ditampilkan; diambil dari `name` bila kosong. */
  initial?: string;
  /** Nama lengkap: huruf pertamanya menjadi inisial. */
  name?: string;
  className?: string;
  testId?: string;
}

const sizeStyles: Record<string, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-11 w-11 text-base',
};

function Avatar({ size = 'md', initial, name, className = '', testId }: AvatarProps) {
  const letter = (initial || name?.trim().charAt(0) || 'U').toUpperCase();
  return (
    <span
      data-testid={testId}
      aria-hidden={!name}
      title={name}
      className={[
        'flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary',
        sizeStyles[size],
        className,
      ].join(' ')}
    >
      {letter}
    </span>
  );
}

export default Avatar;
