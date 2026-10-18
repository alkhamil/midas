import { NavLink } from 'react-router';

export interface BreadcrumbItem {
  label: string;
  /** General-namespace key for the label; falls back to `label`. */
  labelKey?: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
  testId?: string;
}

/** Jejak halaman: item ber-`path` menjadi link (primary), item tanpa `path` = halaman sekarang (abu-abu). */
function Breadcrumb({ items, className = '', testId }: BreadcrumbProps) {
  if (!items.length) return null;
  return (
    <nav data-testid={testId} aria-label="Breadcrumb" className={`flex items-center gap-1 text-xs ${className}`}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-muted-foreground">/</span>}
          {item.path ? (
            <NavLink to={item.path} className="text-primary hover:underline">
              {item.label}
            </NavLink>
          ) : (
            <span className="text-muted-foreground" aria-current={i === items.length - 1 ? 'page' : undefined}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export default Breadcrumb;
