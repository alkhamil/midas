export { default as RoleListPage } from './pages/RoleListPage';
export { default as RoleCreatePage } from './pages/RoleCreatePage';
export { default as RoleViewPage } from './pages/RoleViewPage';
export { default as RoleEditPage } from './pages/RoleEditPage';
import { addModuleLocales } from '../../../shared/i18n';
import enRoleLocale from './i18n/en.json';
import idRoleLocale from './i18n/id.json';

addModuleLocales({ en: [enRoleLocale], id: [idRoleLocale] });
