/**
 * Locale per modul (`<modul>/i18n/<lang>.json`) digabung ke namespace
 * `general` saat startup. Key tetap sama — modul hanya mengatur file
 * wording miliknya sendiri. File ini milik lapis `app` supaya arah
 * dependensi (`app` → `modules`, `shared` ↛ `modules`) terjaga.
 */
import { addModuleLocales } from '../shared/i18n';
import enGenerator from '../modules/generator/i18n/en.json';
import idGenerator from '../modules/generator/i18n/id.json';
import enLogin from '../modules/auth/login/i18n/en.json';
import idLogin from '../modules/auth/login/i18n/id.json';
import enDashboard from '../modules/dashboard/i18n/en.json';
import idDashboard from '../modules/dashboard/i18n/id.json';
// user/role mendaftarkan locale-nya mandiri dari index modul masing-masing.

addModuleLocales({
  en: [enGenerator, enLogin, enDashboard],
  id: [idGenerator, idLogin, idDashboard],
});
