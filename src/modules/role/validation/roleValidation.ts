// Dibangkitkan oleh Midas Code Builder — jangan diedit manual; ubah desain/konfigurasi lalu generate ulang.
import { t } from 'i18next';
import type { RoleInput } from '../types';

export type RoleErrors = Partial<Record<keyof RoleInput, string>>;

const isEmpty = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/** Validasi form Role; mengembalikan pesan error per field (kosong = valid). */
export function validateRole(values: RoleInput, _mode: 'create' | 'edit'): RoleErrors {
  const errors: RoleErrors = {};
  if (isEmpty(values.name)) errors.name = t('validation.required', { label: 'Nama role' });
  if (isEmpty(values.status)) errors.status = t('validation.required', { label: 'Status' });
  return errors;
}
