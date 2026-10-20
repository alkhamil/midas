export { default as SettingsPage } from './pages/SettingsPage';
export { SettingsProvider, useAppSettings } from './store';
export { BrandIcon, BRAND_ICONS } from './brandIcons';
export { SettingsPermissions } from './permissions';
import { addModuleLocales } from '../../shared/i18n';
import enSettingsLocale from './i18n/en.json';
import idSettingsLocale from './i18n/id.json';

addModuleLocales({ en: [enSettingsLocale], id: [idSettingsLocale] });
