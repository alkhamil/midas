import { useEffect, useState, type ReactNode } from 'react';
import { sidebarDefaults, type SidebarProps as DesignProps } from '../../generated/props';
import { AltArrowDownIcon, AltArrowUpIcon, DoubleAltArrowLeftIcon, DoubleAltArrowRightIcon } from '../../generated/icons';
import { cx } from '../../internal/cx';

export interface NavItem {
  label: string;
  /** Tujuan menu. Boleh kosong untuk induk yang hanya mengelompokkan `children`. */
  path?: string;
  icon?: ReactNode;
  /** Sub-menu satu tingkat (mis. Master Data → Region). Induk menampilkan chevron dan membuka/menutup anaknya. */
  children?: NavItem[];
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

const isActive = (path: string | undefined, active?: string) => !!path && !!active && (path === '/' ? active === '/' : active === path || active.startsWith(`${path}/`));

const keyOf = (item: NavItem) => item.path ?? item.label;
const holdsActive = (item: NavItem, active?: string) => !!item.children?.some(c => isActive(c.path, active));

/** Navigasi utama berlatar gelap. Terlipat: menu jadi ikon saja. Menu bersarang: induk (chevron) membuka sub-menunya. */
export function Sidebar(props: SidebarProps) {
  const { collapsed, groups, items, activePath, onNavigate, onToggle, appName = 'CMS Admin', logo, testId } = { ...sidebarDefaults, ...props };
  // Grup terbuka: semua (groups = expanded) atau hanya yang memuat halaman aktif; klik induk mengubahnya.
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(items.filter(i => i.children?.length).map(i => [keyOf(i), groups === 'expanded' || holdsActive(i, activePath)])));
  useEffect(() => {
    setOpen(prev => {
      const next = { ...prev };
      for (const i of items) if (i.children?.length && holdsActive(i, activePath)) next[keyOf(i)] = true;
      return next;
    });
  }, [activePath, items]);
  const go = (e: React.MouseEvent, path?: string) => {
    if (onNavigate && path) {
      e.preventDefault();
      onNavigate(path);
    }
  };
  return (
    <aside data-testid={testId} className={cx('flex h-full shrink-0 flex-col gap-1 bg-sidebar px-3 pb-3 text-sidebar-foreground transition-[width] duration-200', collapsed ? 'w-[72px]' : 'w-64')}>
      <div className={cx('flex h-[72px] items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
        {!collapsed && (
          <div className="flex min-w-0 items-center gap-2.5">
            {logo ?? <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">{appName.charAt(0)}</span>}
            <span className="truncate text-base font-semibold text-white">{appName}</span>
          </div>
        )}
        <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded-md border border-sidebar-foreground/40 hover:bg-white/10">
          {collapsed ? <DoubleAltArrowRightIcon className="h-3.5 w-3.5" /> : <DoubleAltArrowLeftIcon className="h-3.5 w-3.5" />}
        </button>
      </div>
      <nav aria-label="Main menu" className="flex flex-col gap-1">
        {items.map(item => {
          const kids = item.children ?? [];
          const rowCls = (active: boolean, child = false) =>
            cx(
              'flex h-10 w-full items-center gap-3 rounded-lg text-sm transition-colors',
              collapsed ? 'justify-center' : child ? 'pl-11 pr-3' : 'px-3',
              active ? 'bg-primary font-medium text-primary-foreground' : child ? 'font-normal hover:bg-white/10' : 'font-medium hover:bg-white/10',
            );
          const icon = <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>;
          if (kids.length) {
            const key = keyOf(item);
            const expanded = !!open[key] && !collapsed;
            const within = holdsActive(item, activePath);
            const first = kids[0]?.path;
            return (
              <div key={key} className="flex flex-col gap-1">
                <button
                  type="button"
                  title={collapsed ? item.label : undefined}
                  aria-expanded={collapsed ? undefined : expanded}
                  aria-haspopup={collapsed ? undefined : 'true'}
                  onClick={e => (collapsed ? go(e, first) : setOpen(o => ({ ...o, [key]: !o[key] })))}
                  className={cx(rowCls(false), within && 'font-semibold text-white', collapsed && within && 'bg-white/10')}
                >
                  {icon}
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                      {expanded ? <AltArrowUpIcon className="h-4 w-4 shrink-0" /> : <AltArrowDownIcon className="h-4 w-4 shrink-0" />}
                    </>
                  )}
                </button>
                {expanded &&
                  kids.map(child => {
                    const active = isActive(child.path, activePath);
                    return (
                      <a key={keyOf(child)} href={child.path} aria-current={active ? 'page' : undefined} onClick={e => go(e, child.path)} className={rowCls(active, true)}>
                        <span className="truncate">{child.label}</span>
                      </a>
                    );
                  })}
              </div>
            );
          }
          const active = isActive(item.path, activePath);
          return (
            <a key={keyOf(item)} href={item.path} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} onClick={e => go(e, item.path)} className={rowCls(active)}>
              {icon}
              {!collapsed && <span className="truncate">{item.label}</span>}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
