import type { ReactNode } from 'react';

export interface SubItem {
  label: string;
  /** Kunci i18n namespace `general` untuk label; fallback ke `label`. */
  labelKey?: string;
  path: string;
  permissionKey?: string;
}

export interface NavItemType {
  label: string;
  labelKey?: string;
  path?: string;
  icon?: ReactNode;
  children?: SubItem[];
  permissionKey?: string;
}
