import type { ReactNode } from 'react';
import { sidebarDefaults, type SidebarProps as DesignProps } from '../../generated/props';
import { DoubleAltArrowLeftIcon, DoubleAltArrowRightIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';

export interface NavItem {
  label: string;
  path: string;
  icon?: ReactNode;
}

export type SidebarProps = DesignProps & {
  items: NavItem[];
  /** Path yang sedang aktif (item dengan path ini atau turunannya disorot). */
  activePath?: string;
  /** Dipanggil saat item diklik; kalau diisi, navigasi bawaan <a> dibatalkan (pakai router aplikasi). */
  onNavigate?: (path: string) => void;
  onToggle?: () => void;
  appName?: string;
  logo?: ReactNode;
};

const isActive = (path: string, active?: string) => !!active && (path === '/' ? active === '/' : active === path || active.startsWith(`${path}/`));

/** Navigasi utama berlatar gelap. Terlipat: menu jadi ikon saja. */
export function Sidebar(props: SidebarProps) {
  const { collapsed, items, activePath, onNavigate, onToggle, appName = 'CMS Admin', logo, testId } = { ...sidebarDefaults, ...props };
  return (
    <aside data-testid={testId} className={cx('flex h-full shrink-0 flex-col gap-1 bg-sidebar px-3 pb-3 text-sidebar-foreground transition-[width] duration-200', collapsed ? 'w-[72px]' : 'w-64')}>
      <div className={cx('flex h-[72px] items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2.5">
            {logo ?? <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">{appName.charAt(0)}</span>}
            <span className="truncate text-base font-semibold text-white">{appName}</span>
          </div>
        )}
        <button type="button" aria-label={collapsed ? 'Perluas sidebar' : 'Lipat sidebar'} onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-foreground/40 hover:bg-white/10">
          {collapsed ? <DoubleAltArrowRightIcon className="h-3.5 w-3.5" /> : <DoubleAltArrowLeftIcon className="h-3.5 w-3.5" />}
        </button>
      </div>
      <nav aria-label="Menu utama" className="flex flex-col gap-1">
        {items.map(item => {
          const active = isActive(item.path, activePath);
          return (
            <a
              key={item.path}
              href={item.path}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={e => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(item.path);
                }
              }}
              className={cx(
                'flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                collapsed ? 'justify-center' : 'px-3',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-white/10',
              )}
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
