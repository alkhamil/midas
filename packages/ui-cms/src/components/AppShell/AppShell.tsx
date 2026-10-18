import { useState, type ReactNode } from 'react';
import { appShellDefaults, type AppShellProps as DesignProps } from '../../generated/props';
import { Topbar, type Crumb } from '../Topbar/Topbar';
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
  /** Jejak halaman di topbar. */
  breadcrumbs?: Crumb[];
  logo?: ReactNode;
  /** Konten tambahan di topbar sebelum info pengguna, mis. tombol keluar. */
  topbarExtra?: ReactNode;
  children?: ReactNode;
};

/** Kerangka aplikasi: Sidebar + topbar (judul & pengguna) + area konten berlatar surface. */
export function AppShell(props: AppShellProps) {
  const { navItems, activePath, onNavigate, user, title, breadcrumbs, appName, logo, topbarExtra, children, testId } = { ...appShellDefaults, ...props };
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div data-testid={testId} className="flex h-screen min-h-[480px] w-full overflow-hidden bg-surface text-foreground">
      <Sidebar items={navItems} activePath={activePath} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} appName={appName} logo={logo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} breadcrumbs={breadcrumbs} onNavigate={onNavigate} userName={user?.name} userRole={user?.roleName}>{topbarExtra}</Topbar>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
