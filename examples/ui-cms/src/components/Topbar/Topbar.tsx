import { useEffect, useRef, useState, type ReactNode } from 'react';
import { topbarDefaults, type TopbarProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';
import { LogoutIcon } from '../../generated/icons';
import { Avatar } from '../Avatar/Avatar';

export interface Crumb {
  label: string;
  /** Bila diisi, crumb jadi tautan (dipanggil lewat `onNavigate`). */
  path?: string;
}

export interface UserMenuItem {
  label: string;
  onClick: () => void;
  /** Destructive styling, e.g. Sign out. */
  danger?: boolean;
  icon?: ReactNode;
}

export type TopbarProps = DesignProps & {
  /** Items of the user menu opened from the avatar (e.g. Sign out). Without items the avatar is not clickable. */
  userMenu?: UserMenuItem[];
  /** Jejak halaman di atas judul, mis. Beranda / User / Tambah. */
  breadcrumbs?: Crumb[];
  onNavigate?: (path: string) => void;
  /** Konten tambahan sebelum info pengguna, mis. tombol keluar. */
  children?: ReactNode;
  className?: string;
};

/** Bilah atas aplikasi: breadcrumb + judul halaman di kiri, pengguna + avatar di kanan. */
export function Topbar(props: TopbarProps) {
  const { title, breadcrumb, menu, userName, userRole, breadcrumbs: crumbsProp, userMenu = [], onNavigate, children, testId, className } = { ...topbarDefaults, ...props };
  // `menu: 'open'` (the design's Open variant) starts with the user menu open.
  const [open, setOpen] = useState(menu === 'open');
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', key); };
  }, [open]);
  // `breadcrumb` (teks dari desain, dipisah "/") dipakai bila `breadcrumbs` tidak diberikan.
  const breadcrumbs: Crumb[] = crumbsProp ?? (breadcrumb ? breadcrumb.split('/').map(l => ({ label: l.trim() })) : []);
  return (
    <header data-testid={testId} className={cx('flex h-[72px] shrink-0 items-center justify-between border-b border-border bg-background px-6', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-lg font-semibold leading-7 text-foreground">{title}</h2>
        {breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs leading-4 text-muted-foreground">
            {breadcrumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {c.path && i < breadcrumbs.length - 1 ? (
                  <a href={c.path} className="hover:text-foreground" onClick={e => { if (onNavigate) { e.preventDefault(); onNavigate(c.path!); } }}>{c.label}</a>
                ) : (
                  <span aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {userName && (
          <div ref={root} className="relative">
            <button
              type="button"
              aria-haspopup={userMenu.length ? 'menu' : undefined}
              aria-expanded={userMenu.length ? open : undefined}
              disabled={!userMenu.length}
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-3 rounded-lg p-1 text-left enabled:hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default"
            >
              <span className="text-right">
                <span className="block text-sm font-medium leading-5">{userName}</span>
                {userRole && <span className="block text-xs leading-4 text-muted-foreground">{userRole}</span>}
              </span>
              <Avatar size="md" name={userName} />
            </button>
            {open && userMenu.length > 0 && (
              <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-[220px] rounded-lg border border-border bg-background py-1 shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium leading-5 text-foreground">{userName}</p>
                  {userRole && <p className="text-xs leading-4 text-muted-foreground">{userRole}</p>}
                </div>
                <div className="my-1 h-px bg-border" />
                {userMenu.map(item => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    onClick={() => { setOpen(false); item.onClick(); }}
                    className={cx('flex h-9 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted', item.danger ? 'text-danger' : 'text-foreground')}
                  >
                    {item.icon ?? (item.danger ? <LogoutIcon className="h-4 w-4" /> : null)}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
