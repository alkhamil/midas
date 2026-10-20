import { mergeNavItems, navItems, useDynamicNavItems } from './navigation';
import { AppShell } from '../shared/components/layout';
import { RequireAuth, useAuth } from './providers';
import { BrandIcon, SettingsProvider, useAppSettings } from '../modules/settings';

/** Logo sidebar: ikon brand + nama aplikasi dari modul Pengaturan. */
function BrandLogo() {
  const { appName, brandIcon } = useAppSettings();
  return (
    <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <BrandIcon name={brandIcon} className="h-6 w-6 shrink-0" />
      <span className="truncate">{appName}</span>
    </span>
  );
}

/** App shell terproteksi: guard session + user/permissions/logout dari auth. */
function Shell() {
  const { user, permissions, logout } = useAuth();
  const dynamicNavItems = useDynamicNavItems();
  const { appName } = useAppSettings();
  return (
    <RequireAuth>
      <AppShell
        navItems={mergeNavItems(navItems, dynamicNavItems)}
        permissions={permissions}
        user={user ? { name: user.name, roleName: user.role } : null}
        onLogout={logout}
        appName={appName}
        logo={<BrandLogo />}
      />
    </RequireAuth>
  );
}

function ProtectedAppShell() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}

export default ProtectedAppShell;
