import { type ReactNode } from 'react';
import { HamburgerMenuIcon as Menu } from '../../generated/icons';
import Breadcrumb, { type BreadcrumbItem } from './Breadcrumb';

export type { BreadcrumbItem };

interface PageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  onMenuToggle?: () => void;
  /** Konten sisi kanan (mis. `<AvatarUser />`). */
  children?: ReactNode;
  testId?: string;
}

function PageHeader({
  title,
  breadcrumb,
  actions,
  onMenuToggle,
  children,
  testId,
}: PageHeaderProps) {
  return (
    <header
      data-testid={testId}
      className="flex h-16 shrink-0 items-center border-b border-border bg-background px-4 lg:px-6"
    >
      {onMenuToggle && (
        <button onClick={onMenuToggle} className="mr-4 md:hidden" aria-label="Toggle menu">
          <Menu className="h-6 w-6" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        {breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} className="mt-0.5" />}
      </div>

      {actions && <div className="ml-4 flex items-center gap-2">{actions}</div>}
      {children && <div className="ml-4 flex items-center">{children}</div>}
    </header>
  );
}

export default PageHeader;
