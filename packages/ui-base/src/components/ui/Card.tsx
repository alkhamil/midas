import { type ReactNode, useState } from 'react';
import { AltArrowDownIcon as ChevronDown } from '../../generated/icons';

interface CardProps {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  /** Baris aksi bawah dengan divider (mis. tombol form). */
  footer?: ReactNode;
  className?: string;
  testId?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Ikon toggle custom saat `collapsible` (default chevron yang ikut berputar). */
  toggleIcon?: ReactNode;
  /** Varian ringkas untuk panel sempit (mis. drawer properti): judul + padding kecil. */
  size?: 'sm' | 'md';
}

function Card({
  children,
  title,
  actions,
  footer,
  className = '',
  testId,
  collapsible = false,
  defaultOpen = true,
  toggleIcon,
  size = 'md',
}: CardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const compact = size === 'sm';

  // Divider header hanya tampil saat body terbuka — saat collapsed disembunyikan
  // agar tidak ada garis yatim di bawah header.
  const showDivider = !collapsible || open;
  const headerClass = [
    'flex flex-row w-full items-center justify-between',
    showDivider ? 'border-b border-border' : 'border-b border-transparent',
    compact ? 'px-3 py-2' : 'px-[var(--theme-card-padding-x)] py-[var(--theme-card-padding-y)]',
    collapsible ? 'cursor-pointer' : '',
  ].join(' ');

  const headerProps = collapsible ? { onClick: () => setOpen((prev) => !prev) } : {};

  return (
    <div
      data-testid={testId}
      className={`rounded-xl border border-border bg-background shadow-sm ${className}`}
    >
      {(title || actions) &&
        (collapsible ? (
          <button className={headerClass} {...headerProps}>
            <div
              className="flex flex-row w-full justify-between items-center gap-2"
              aria-expanded={open}
            >
              <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-foreground`}>{title}</h3>
              <div>
                {toggleIcon ?? (
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-270' : 'rotate-90'}`}
                  />
                )}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </button>
        ) : (
          <div className={headerClass}>
            {title && <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-foreground`}>{title}</h3>}
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        ))}
      {open && (
        <div className={`min-w-0 ${compact ? 'px-3 py-2' : 'px-[var(--theme-card-padding-x)] py-[var(--theme-card-padding-y)]'}`}>
          {children}
        </div>
      )}
      {open && footer && (
        <div className={`flex items-center justify-end gap-2 border-t border-border ${compact ? 'px-3 py-2' : 'px-[var(--theme-card-padding-x)] py-[var(--theme-card-padding-y)]'}`}>
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
