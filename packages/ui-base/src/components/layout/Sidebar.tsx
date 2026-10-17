import { useState, useRef, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router';
import { type NavItemType, type SubItem } from '../../internal/types/navigation';
import { filterNavItems, resolveNavLabel } from '../../internal/utils';
import { DoubleAltArrowLeftIcon as ChevronsLeft, DoubleAltArrowRightIcon as ChevronsRight, AltArrowDownIcon as ChevronDown } from '../../generated/icons';

interface SidebarProps {
  items: NavItemType[];
  /** Daftar permission user; item ber-`permissionKey` disaring. Default: tampil semua. */
  permissions?: string[];
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onMobileClose: () => void;
  /** Logo custom di kepala sidebar. Default: inisial `appName`. */
  logo?: ReactNode;
  appName?: string;
  testId?: string;
}

function Sidebar({
  items,
  permissions = [],
  collapsed,
  mobileOpen,
  onToggle,
  onMobileClose,
  logo,
  appName = 'App',
  testId,
}: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navItems = filterNavItems(items, permissions);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [hoverTop, setHoverTop] = useState(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((label: string, el: HTMLElement) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const rect = el.getBoundingClientRect();
    setHoverTop(rect.top);
    setHoveredItem(label);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      setHoveredItem(null);
    }, 200);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  function toggleExpand(label: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function isChildActive(children?: SubItem[]) {
    if (!children) return false;
    return children.some(
      (child) => location.pathname === child.path || location.pathname.startsWith(child.path + '/'),
    );
  }

  function itemClasses(isActive: boolean) {
    return [
      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-primary-foreground text-primary'
        : 'text-primary-foreground hover:bg-primary-foreground hover:text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30',
      collapsed ? 'justify-center px-0' : '',
    ].join(' ');
  }

  const hoveredNavItem = hoveredItem ? navItems.find((n) => n.label === hoveredItem) : null;

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onMobileClose} />
      )}

      <aside
        data-testid={testId ?? 'app-sidebar'}
        className={[
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-primary-foreground/10 transition-all duration-300',
          'bg-primary text-primary-foreground',
          collapsed ? 'md:w-16' : 'md:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        ].join(' ')}
      >
        <div className="relative flex h-22 shrink-0 items-center justify-center p-2">
          {!collapsed &&
            (logo ?? (
              <span className="text-lg font-bold tracking-tight">{appName}</span>
            ))}

          <button
            data-testid="sidebar-toggle"
            onClick={onToggle}
            className={[
              'flex h-7 w-7 items-center justify-center rounded bg-primary-foreground text-primary shadow transition-colors hover:bg-primary-foreground/80 max-md:hidden',
              collapsed ? 'absolute left-1/2 -translate-x-1/2' : 'absolute right-0 translate-x-1/2',
            ].join(' ')}
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 p-2">
          {navItems.map((item) => {
            const hasSubItems = !!(item.children && item.children.length > 0);
            const isExpanded = expandedItems.has(item.label) || isChildActive(item.children);

            return (
              <div
                key={item.label}
                className="relative"
                onMouseEnter={(e) => collapsed && handleMouseEnter(item.label, e.currentTarget)}
                onMouseLeave={() => collapsed && handleMouseLeave()}
              >
                {hasSubItems ? (
                  <button
                    onClick={() => !collapsed && toggleExpand(item.label)}
                    className={itemClasses(false)}
                  >
                    {item.icon}
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{resolveNavLabel(item, t)}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-90'}`}
                        />
                      </>
                    )}
                  </button>
                ) : (
                  <NavLink
                    to={item.path!}
                    end={item.path === '/'}
                    className={({ isActive }) => itemClasses(isActive)}
                  >
                    {item.icon}
                    {!collapsed && <span>{resolveNavLabel(item, t)}</span>}
                  </NavLink>
                )}

                {hasSubItems && isExpanded && !collapsed && (
                  <div className="mt-1 space-y-1">
                    {item.children!.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          [
                            'flex w-full items-center rounded-lg px-3 py-2 pl-11 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary-foreground text-primary'
                              : 'text-primary-foreground hover:bg-primary-foreground hover:text-primary',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/30',
                          ].join(' ')
                        }
                      >
                        {resolveNavLabel(child, t)}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {collapsed && hoveredNavItem && (
        <div
          className="fixed z-50 min-w-40 rounded-lg bg-background py-1 shadow-xl border border-border max-md:hidden"
          style={{ left: 72, top: hoverTop }}
          onMouseEnter={cancelHide}
          onMouseLeave={handleMouseLeave}
        >
          {hoveredNavItem.children ? (
            <>
              <div className="border-b border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {resolveNavLabel(hoveredNavItem, t)}
              </div>
              {hoveredNavItem.children.map((child) => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  className={({ isActive }) =>
                    [
                      'block px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted',
                      isActive ? 'bg-muted font-medium' : '',
                    ].join(' ')
                  }
                >
                  {resolveNavLabel(child, t)}
                </NavLink>
              ))}
            </>
          ) : (
            <NavLink
              to={hoveredNavItem.path!}
              end={hoveredNavItem.path === '/'}
              className={({ isActive }) =>
                [
                  'block px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted',
                  isActive ? 'bg-muted font-medium' : '',
                ].join(' ')
              }
            >
              {resolveNavLabel(hoveredNavItem, t)}
            </NavLink>
          )}
        </div>
      )}
    </>
  );
}

export default Sidebar;
