/**
 * Locale per modul (`<modul>/i18n/<lang>.json`) digabung ke namespace `general` saat startup.
 * Modul hasil generate Code Builder mendaftarkan locale-nya sendiri dari `index.ts` modul.
 */
import { addModuleLocales } from '../shared/i18n';
import enLogin from '../modules/auth/login/i18n/en.json';
import idLogin from '../modules/auth/login/i18n/id.json';
import enDashboard from '../modules/dashboard/i18n/en.json';
import idDashboard from '../modules/dashboard/i18n/id.json';

addModuleLocales({
  en: [enLogin, enDashboard],
  id: [idLogin, idDashboard],
});
