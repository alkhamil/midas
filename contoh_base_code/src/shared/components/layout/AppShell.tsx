import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useMatches } from 'react-router';
import Sidebar from './Sidebar';
import PageHeader, { type BreadcrumbItem } from './PageHeader';
import AvatarUser, { type AvatarUserData } from './AvatarUser';
import PageContent from './PageContent';
import { type NavItemType } from '../../types/navigation';
import { filterNavItems, resolveNavLabel } from '../../utils';
import { useMediaQuery, useSessionStorage } from '../../hooks';

interface AppShellProps {
  navItems: NavItemType[];
  permissions?: string[];
  user: AvatarUserData | null;
  onLogout?: () => void;
  settingsPath?: string;
  logo?: ReactNode;
  appName?: string;
  /** Judul header; default diselesaikan otomatis dari navigasi & pathname. */
  title?: string;
  /** Konten tambahan di header (mis. pemilih bahasa), sebelum avatar user. */
  headerExtra?: ReactNode;
}

function AppShell({
  navItems: allNavItems,
  permissions = [],
  user,
  onLogout,
  settingsPath,
  logo,
  appName,
  title: titleOverride,
  headerExtra,
}: AppShellProps) {
  const { t } = useTranslation();
  const isNarrowScreen = useMediaQuery('(max-width: 1023px)');
  const [storedCollapsed, setStoredCollapsed] = useSessionStorage<boolean | null>(
    'sidebar-collapsed',
    null,
  );
  const sidebarCollapsed = storedCollapsed ?? isNarrowScreen;
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const location = useLocation();
  const matches = useMatches();
  const navItems = filterNavItems(allNavItems, permissions);

  // Route yang jatuh ke catch-all (`path="*"`) tidak boleh memakai judul menu
  // hasil pencocokan prefix pathname.
  const isNotFoundRoute = matches.some(
    (match) => (match.handle as { notFound?: boolean } | undefined)?.notFound === true,
  );

  function findActiveParent() {
    for (const item of navItems) {
      if (item.children) {
        const match = item.children.some(
          (child) =>
            location.pathname === child.path || location.pathname.startsWith(child.path + '/'),
        );
        if (match) return item;
      } else if (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)) {
        return item;
      }
    }
    return null;
  }

  const parent = isNotFoundRoute ? null : findActiveParent();

  const title =
    titleOverride ??
    (isNotFoundRoute
      ? t('error.notFoundTitle', { defaultValue: 'Page Not Found' })
      : parent
        ? resolveNavLabel(parent, t)
        : '');
  const fromHandles: BreadcrumbItem[] = isNotFoundRoute
    ? []
    : matches.flatMap(
        (match) =>
          (match.handle as { breadcrumb?: BreadcrumbItem[] } | undefined)?.breadcrumb ?? [],
      ).map((item) => ({
        ...item,
        label: item.labelKey ? t(item.labelKey, { defaultValue: item.label }) : item.label,
      }));
  // Halaman dinamis (useRoutes dalam) tak menyumbang handle breadcrumb —
  // fallback ke label menu aktif agar breadcrumb tetap tampil.
  const breadcrumb: BreadcrumbItem[] =
    fromHandles.length > 0
      ? fromHandles
      : parent
        ? [{ label: resolveNavLabel(parent, t) }]
        : [];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        items={allNavItems}
        permissions={permissions}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onToggle={() => setStoredCollapsed(!sidebarCollapsed)}
        onMobileClose={() => setMobileSidebarOpen(false)}
        logo={logo}
        appName={appName}
      />

      <div
        id="main-content"
        className={`
          relative flex min-w-0 flex-1 flex-col bg-surface transition-all duration-300
          ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}
        `}
      >
        <PageHeader
          title={title}
          breadcrumb={breadcrumb.length > 0 ? breadcrumb : undefined}
          onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        >
          <div className="flex items-center gap-2">
            {headerExtra}
            <AvatarUser user={user} onLogout={onLogout} settingsPath={settingsPath} />
          </div>
        </PageHeader>
        <PageContent>
          <Outlet />
        </PageContent>
      </div>
    </div>
  );
}

export default AppShell;
