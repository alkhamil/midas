/**
 * Setup i18n (i18next + react-i18next): namespace `general` (dibundel) +
 * namespace dinamis per modul (`module:{key}`, dari mock store).
 * Node-safe: tidak menyentuh browser API saat import (guard try/catch).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enGeneral from './locales/en/general.json';
import idGeneral from './locales/id/general.json';

export type AppLanguage = 'en' | 'id';

export const APP_LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'id', label: 'ID' },
];

const STORAGE_KEY = 'app_lang';

function detectLanguage(): AppLanguage {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'id' || saved === 'en') return saved;
    }
  } catch {
    // Abaikan: storage tak tersedia (SSR/probe Node).
  }
  return 'en';
}

function applyDocumentLang(lng: AppLanguage): void {
  try {
    if (typeof document !== 'undefined') document.documentElement.lang = lng;
  } catch {
    // Abaikan.
  }
}

if (!i18n.isInitialized) {
  applyDocumentLang(detectLanguage());
  void i18n.use(initReactI18next).init({
    resources: {
      en: { general: enGeneral },
      id: { general: idGeneral },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    defaultNS: 'general',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export function getAppLanguage(): AppLanguage {
  const current = i18n.language?.slice(0, 2);
  return current === 'id' ? 'id' : 'en';
}

/**
 * Daftarkan bundle locale milik modul (`<modul>/i18n/<lang>.json`).
 * Dipanggil dari lapis `app` (agar `shared` tidak import `modules`);
 * aman dipanggil sebelum/sesudah init, sebelum render pertama.
 */
export function addModuleLocales(bundles: Record<AppLanguage, unknown[]>): void {
  for (const [lng, list] of Object.entries(bundles)) {
    for (const bundle of list) {
      i18n.addResourceBundle(lng, 'general', bundle, true, true);
    }
  }
}

export async function setAppLanguage(lng: AppLanguage): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Abaikan.
  }
  applyDocumentLang(lng);
  await i18n.changeLanguage(lng);
}

export default i18n;

// Teks bawaan komponen library (tidak menimpa key milik aplikasi).

// Bahasa yang dipilih lewat LanguageSwitch (library) ikut disimpan & diterapkan ke <html lang>.
i18n.on('languageChanged', (lng) => {
  const value: AppLanguage = lng?.startsWith('id') ? 'id' : 'en';
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Abaikan.
  }
  applyDocumentLang(value);
});
