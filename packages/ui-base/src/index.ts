// Entry paket @midas/ui-base — komponen UI design system "Midas Base".
import './styles/utilities.css';

// Library Kit (dibangkitkan dari desain): token tema + ikon. Kontrak props desain tersedia
// sebagai namespace `designProps` (nama tipenya sama dengan sebagian tipe props komponen).
export * from './generated/theme';
export * from './generated/icons';
export * as designProps from './generated/props';
export { ThemeProvider, useTheme } from './theme/ThemeProvider';

export * from './components/ui';
export * from './components/layout';
export { default as LanguageSwitch } from './internal/LanguageSwitch';
export type { NavItemType, SubItem } from './internal/types/navigation';
export { filterNavItems, hasPermissionKey, resolveNavLabel } from './internal/utils';
export { registerUiLocales, uiLocales } from './i18n';
