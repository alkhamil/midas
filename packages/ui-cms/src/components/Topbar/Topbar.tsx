import type { ReactNode } from 'react';
import { topbarDefaults, type TopbarProps as DesignProps } from '../../generated/props';
import { cx } from '../../internal/cx';
import { Avatar } from '../Avatar/Avatar';

export interface Crumb {
  label: string;
  /** Bila diisi, crumb jadi tautan (dipanggil lewat `onNavigate`). */
  path?: string;
}

export type TopbarProps = DesignProps & {
  /** Jejak halaman di atas judul, mis. Beranda / User / Tambah. */
  breadcrumbs?: Crumb[];
  onNavigate?: (path: string) => void;
  /** Konten tambahan sebelum info pengguna, mis. tombol keluar. */
  children?: ReactNode;
  className?: string;
};

/** Bilah atas aplikasi: breadcrumb + judul halaman di kiri, pengguna + avatar di kanan. */
export function Topbar(props: TopbarProps) {
  const { title, breadcrumb, userName, userRole, breadcrumbs: crumbsProp, onNavigate, children, testId, className } = { ...topbarDefaults, ...props };
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
          <>
            <div className="text-right">
              <p className="text-sm font-medium leading-5">{userName}</p>
              {userRole && <p className="text-xs leading-4 text-muted-foreground">{userRole}</p>}
            </div>
            <Avatar size="md" name={userName} />
          </>
        )}
      </div>
    </header>
  );
}
