export { default as RegionListPage } from './pages/RegionListPage';
export { default as RegionCreatePage } from './pages/RegionCreatePage';
export { default as RegionViewPage } from './pages/RegionViewPage';
export { default as RegionEditPage } from './pages/RegionEditPage';
import { addModuleLocales } from '../../shared/i18n';
import enRegionLocale from './i18n/en.json';
import idRegionLocale from './i18n/id.json';

addModuleLocales({ en: [enRegionLocale], id: [idRegionLocale] });
