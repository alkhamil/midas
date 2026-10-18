import { AppShell } from '@midas/ui-base';
import { navItems } from './navigation';
import { RequireAuth, useAuth } from './providers';

const APP_NAME = 'Midas App';

/** App shell terproteksi: guard session + user/permissions/logout dari auth. */
function ProtectedAppShell() {
  const { user, permissions, logout } = useAuth();
  return (
    <RequireAuth>
      <AppShell
        navItems={navItems}
        permissions={permissions}
        user={user ? { name: user.name, roleName: user.role } : null}
        onLogout={logout}
        appName={APP_NAME}
      />
    </RequireAuth>
  );
}

export default ProtectedAppShell;
