import { useState, type ReactNode } from 'react';
import { appShellDefaults, type AppShellProps as DesignProps } from '../../generated/props';
import { Avatar } from '../Avatar/Avatar';
import { Sidebar, type NavItem } from '../Sidebar/Sidebar';

export interface AppShellUser {
  name: string;
  roleName?: string;
}

export type AppShellProps = DesignProps & {
  navItems: NavItem[];
  activePath?: string;
  onNavigate?: (path: string) => void;
  user?: AppShellUser | null;
  /** Judul di topbar (mis. nama halaman). */
  title?: string;
  appName?: string;
  logo?: ReactNode;
  /** Konten tambahan di topbar sebelum info pengguna, mis. tombol keluar. */
  topbarExtra?: ReactNode;
  children?: ReactNode;
};

/** Kerangka aplikasi: Sidebar + topbar (judul & pengguna) + area konten berlatar surface. */
export function AppShell(props: AppShellProps) {
  const { navItems, activePath, onNavigate, user, title, appName, logo, topbarExtra, children, testId } = { ...appShellDefaults, ...props };
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div data-testid={testId} className="flex h-screen min-h-[480px] w-full overflow-hidden bg-surface text-foreground">
      <Sidebar items={navItems} activePath={activePath} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} appName={appName} logo={logo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-6">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          <div className="flex items-center gap-3">
            {topbarExtra}
            {user && (
              <>
                <div className="text-right">
                  <p className="text-sm font-medium leading-5">{user.name}</p>
                  {user.roleName && <p className="text-xs leading-4 text-muted-foreground">{user.roleName}</p>}
                </div>
                <Avatar size="md" name={user.name} />
              </>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
