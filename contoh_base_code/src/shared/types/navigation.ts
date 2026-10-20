import { type ReactNode } from 'react';

export interface SubItem {
  label: string;
  /** General-namespace key for the label; falls back to `label`. */
  labelKey?: string;
  path: string;
  permissionKey?: string;
}

export interface NavItemType {
  label: string;
  /** General-namespace key for the label; falls back to `label`. */
  labelKey?: string;
  path?: string;
  icon: ReactNode;
  children?: SubItem[];
  permissionKey?: string;
}
