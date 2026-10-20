export { default as UserListPage } from './pages/UserListPage';
export { default as UserCreatePage } from './pages/UserCreatePage';
export { default as UserViewPage } from './pages/UserViewPage';
export { default as UserEditPage } from './pages/UserEditPage';
import { addModuleLocales } from '../../../shared/i18n';
import enUserLocale from './i18n/en.json';
import idUserLocale from './i18n/id.json';

addModuleLocales({ en: [enUserLocale], id: [idUserLocale] });
