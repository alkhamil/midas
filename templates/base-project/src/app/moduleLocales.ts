/**
 * Locale per modul (`<modul>/i18n/<lang>.json`) digabung ke namespace `general` saat startup.
 * Locale modul hasil generate Code Builder masuk lewat `generated/locales.ts`.
 */
import { addModuleLocales } from '../shared/i18n';
import { generatedLocales } from './generated/locales';
import enLogin from '../modules/auth/login/i18n/en.json';
import idLogin from '../modules/auth/login/i18n/id.json';
import enDashboard from '../modules/dashboard/i18n/en.json';
import idDashboard from '../modules/dashboard/i18n/id.json';

addModuleLocales({
  en: [enLogin, enDashboard, ...generatedLocales.en],
  id: [idLogin, idDashboard, ...generatedLocales.id],
});
