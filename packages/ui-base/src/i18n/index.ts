// Teks bawaan komponen (en/id). Aplikasi mendaftarkannya sekali; terjemahan milik aplikasi
// dengan kunci yang sama tetap menang (tidak ditimpa).
import type { i18n as I18n } from 'i18next';
import en from './en.json';
import id from './id.json';

export const uiLocales = { en, id } as const;

export function registerUiLocales(i18n: I18n, namespace = 'translation'): void {
  for (const [lng, resources] of Object.entries(uiLocales))
    i18n.addResourceBundle(lng, namespace, resources, true, false);
}
