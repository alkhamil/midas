// Utilitas yang dipakai komponen (subset dari shared/utils contoh_base_code, tanpa dependency xlsx).
import type { NavItemType, SubItem } from './types/navigation';

/** Jenis halaman error berdasarkan status HTTP (lihat ErrorStatePage / DetailCard). */
export type ErrorPageType = '403' | '404' | '500';

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

export function stripNonAscii(value: string): string {
  return value.replace(/[^\x20-\x7E\n\t]/g, '');
}

/** Cek satu permission key; wildcard `'*'` meloloskan semua key. */
export function hasPermissionKey(permissions: string[], key: string): boolean {
  return permissions.includes('*') || permissions.includes(key);
}

function hasPermission(item: SubItem | NavItemType, permissions: string[]): boolean {
  if (!item.permissionKey) return true;
  return hasPermissionKey(permissions, item.permissionKey);
}

export type TranslateFn = (key: string, opts?: { defaultValue?: string }) => string;

/**
 * Resolve a nav/sub item display label via its `labelKey`,
 * falling back to the stored English `label`.
 */
export function resolveNavLabel(
  item: Pick<NavItemType, 'label' | 'labelKey'> | Pick<SubItem, 'label' | 'labelKey'>,
  t: TranslateFn,
): string {
  if (!item.labelKey) return item.label;
  return t(item.labelKey, { defaultValue: item.label });
}

export function filterNavItems(items: NavItemType[], permissions: string[]): NavItemType[] {
  return items
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((child) => hasPermission(child, permissions));
        return children.length > 0 ? { ...item, children } : null;
      }
      return hasPermission(item, permissions) ? item : null;
    })
    .filter((item): item is NavItemType => item !== null);
}
