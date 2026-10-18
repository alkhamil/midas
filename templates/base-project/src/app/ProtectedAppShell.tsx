import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, Outlet, useLocation, useNavigate } from 'react-router';
import { AppShell } from '@midas/ui-cms';
import { filterNavItems, resolveNavLabel } from '../shared/utils/navigation';
import { appLayout } from './generated/layout';
import { generatedPages } from './generated/pages';
import { navItems } from './navigation';
import { RequireAuth, useAuth } from './providers';

/** App shell terproteksi: guard session + menu (disaring permission) + user/logout dari auth. */
function ProtectedAppShell() {
  const { user, permissions, logout } = useAuth();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Menu bersarang (induk → anak) diteruskan apa adanya ke Sidebar library; `flat` dipakai untuk mencari item aktif.
  const items = useMemo(
    () =>
      filterNavItems(navItems, permissions).map((item) => ({
        label: resolveNavLabel(item, t),
        path: item.path,
        icon: item.icon,
        children: item.children?.map((child) => ({ label: resolveNavLabel(child, t), path: child.path })),
      })),
    [permissions, t],
  );
  const flat = useMemo(() => items.flatMap((item) => [...(item.path ? [{ label: item.label, path: item.path }] : []), ...(item.children ?? [])]), [items]);
  const current = [...flat].sort((a, b) => b.path.length - a.path.length).find((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(`${i.path}/`)));
  // Judul & breadcrumb dari konfigurasi Code Builder; halaman bawaan memakai label menu.
  const page = generatedPages.find((p) => matchPath({ path: p.path, end: true }, pathname));
  return (
    <RequireAuth>
      <AppShell
        navItems={items}
        activePath={pathname}
        onNavigate={navigate}
        user={user ? { name: user.name, roleName: user.role } : null}
        title={page?.title ?? current?.label}
        breadcrumbs={page?.breadcrumbs}
        appName={appLayout.appName}
        userMenu={[{ label: t('auth.logout'), danger: true, onClick: logout }]}
      >
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

export default ProtectedAppShell;
