import type { NavItemType, SubItem } from '../types/navigation';

type TranslateFn = (key: string, opts?: { defaultValue?: string }) => string;

/** Cek satu permission key; wildcard `'*'` meloloskan semua key. */
export function hasPermissionKey(permissions: string[], key: string): boolean {
  return permissions.includes('*') || permissions.includes(key);
}

const allowed = (item: SubItem | NavItemType, permissions: string[]) => !item.permissionKey || hasPermissionKey(permissions, item.permissionKey);

/** Item menu yang boleh dilihat user; induk tanpa anak yang lolos ikut disembunyikan. */
export function filterNavItems(items: NavItemType[], permissions: string[]): NavItemType[] {
  return items
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((child) => allowed(child, permissions));
        return children.length > 0 ? { ...item, children } : null;
      }
      return allowed(item, permissions) ? item : null;
    })
    .filter((item): item is NavItemType => item !== null);
}

/** Label tampilan lewat `labelKey` (i18n), fallback ke `label`. */
export function resolveNavLabel(item: Pick<NavItemType, 'label' | 'labelKey'> | Pick<SubItem, 'label' | 'labelKey'>, t: TranslateFn): string {
  return item.labelKey ? t(item.labelKey, { defaultValue: item.label }) : item.label;
}
