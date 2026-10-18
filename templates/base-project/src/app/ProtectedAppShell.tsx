import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { AppShell, Button } from '@midas/ui-cms';
import { filterNavItems, resolveNavLabel } from '../shared/utils/navigation';
import { navItems } from './navigation';
import { RequireAuth, useAuth } from './providers';

const APP_NAME = 'Midas App';

/** App shell terproteksi: guard session + menu (disaring permission) + user/logout dari auth. */
function ProtectedAppShell() {
  const { user, permissions, logout } = useAuth();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // Sidebar library datar (label, path, ikon): anak menu diratakan setelah induknya.
  const items = useMemo(
    () =>
      filterNavItems(navItems, permissions).flatMap((item) => [
        ...(item.path ? [{ label: resolveNavLabel(item, t), path: item.path, icon: item.icon }] : []),
        ...(item.children ?? []).map((child) => ({ label: resolveNavLabel(child, t), path: child.path })),
      ]),
    [permissions, t],
  );
  const current = [...items].sort((a, b) => b.path.length - a.path.length).find((i) => (i.path === '/' ? pathname === '/' : pathname === i.path || pathname.startsWith(`${i.path}/`)));
  return (
    <RequireAuth>
      <AppShell
        navItems={items}
        activePath={pathname}
        onNavigate={navigate}
        user={user ? { name: user.name, roleName: user.role } : null}
        title={current?.label}
        appName={APP_NAME}
        topbarExtra={
          <Button variant="ghost" size="sm" onClick={logout}>
            {t('auth.logout')}
          </Button>
        }
      >
        <Outlet />
      </AppShell>
    </RequireAuth>
  );
}

export default ProtectedAppShell;
