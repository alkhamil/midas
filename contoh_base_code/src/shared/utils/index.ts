export {
  mapSubmitError,
  isConnectionError,
  NETWORK_ERROR_MESSAGE,
  splitFieldErrors,
  getErrorStateType,
} from './submitError';
export type { ErrorPageType } from './submitError';
export { hasEmoticon, WITHOUT_EMOTICON_MESSAGE } from './validators';
export {
  XLSX_MIME,
  buildWorkbook,
  downloadArrayBuffer,
  downloadBlob,
  downloadWorkbook,
  readWorkbookRows,
} from './excel';
export type { ExcelCell, WorkbookRows } from './excel';
export { sanitizeSvg } from './svg';
import type { NavItemType, SubItem } from '../types/navigation';

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${hh}:${mm}`;
}

export function formatDateRange(value: string): string {
  if (!value) return '-';
  const [start, end] = value.split(',');
  if (start && end) return `${formatDate(start)} - ${formatDate(end)}`;
  return start ? formatDate(start) : '-';
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Buang tag HTML → teks polos (untuk sel tabel/detail nilai editor). */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatNumber(value: number): string {
  return value.toLocaleString('id-ID');
}

export function formatCurrency(value: number, currency = 'IDR'): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function parseCurrency(value: string): number {
  return Number(value.replace(/\./g, ''));
}

export function getStoredPermissions(): string[] {
  try {
    const raw = localStorage.getItem('permissions');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function normalizePermissions(raw: string[]): string[] {
  const result: string[] = [];
  for (const entry of raw ?? []) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    if (trimmed.includes(':')) {
      const [module, actions] = trimmed.split(':');
      for (const action of (actions ?? '').split(',')) {
        if (action) result.push(`${module}.${action.trim()}`);
      }
    } else {
      result.push(trimmed);
    }
  }
  return result;
}

export function createUuid(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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

export function getFirstAccessiblePath(items: NavItemType[], permissions: string[]): string {
  const filtered = filterNavItems(items, permissions);
  for (const item of filtered) {
    if (item.path) return item.path;
    const childPath = item.children?.[0]?.path;
    if (childPath) return childPath;
  }
  return '/';
}
