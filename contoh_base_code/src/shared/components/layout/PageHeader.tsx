import { type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { Menu } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  /** General-namespace key for the label; falls back to `label`. */
  labelKey?: string;
  path?: string;
}

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
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mt-0.5 flex items-center gap-1 text-xs">
            {breadcrumb.map((item, i) => (
              <span key={item.label} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">/</span>}
                {item.path ? (
                  <NavLink to={item.path} className="text-primary hover:underline">
                    {item.label}
                  </NavLink>
                ) : (
                  <span className="text-muted-foreground">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>

      {actions && <div className="ml-4 flex items-center gap-2">{actions}</div>}
      {children && <div className="ml-4 flex items-center">{children}</div>}
    </header>
  );
}

export default PageHeader;
