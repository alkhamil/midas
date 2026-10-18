// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { t } from 'i18next';
import type { UserInput } from '../types';

export type UserErrors = Partial<Record<keyof UserInput, string>>;

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/** Validasi form User; mengembalikan pesan error per field (kosong = valid). */
export function validateUser(values: UserInput, _mode: 'create' | 'edit'): UserErrors {
  const errors: UserErrors = {};
  if (isEmpty(values.name)) errors.name = t('validation.required', { label: 'Nama lengkap' });
  if (isEmpty(values.email)) errors.email = t('validation.required', { label: 'Email' });
  if (isEmpty(values.role)) errors.role = t('validation.required', { label: 'Role' });
  if (isEmpty(values.status)) errors.status = t('validation.required', { label: 'Status' });
  return errors;
}
