import type { RegisterOptions } from 'react-hook-form';
import type { TFunction } from 'i18next';
import type { FormValues } from '../hooks';

export function getNameRules(t: TFunction): RegisterOptions<FormValues, 'name'> {
  return {
    required: t('validation.required', { label: t('role.fields.name.label') }),
    minLength: {
      value: 3,
      message: t('validation.minLength', { label: t('role.fields.name.label'), count: 3 }),
    },
    maxLength: {
      value: 100,
      message: t('validation.maxLength', { label: t('role.fields.name.label'), count: 100 }),
    },
  };
}

export function getPermissionsRules(t: TFunction): RegisterOptions<FormValues, 'permissions'> {
  return {
    required: t('role.validation.permissionsRequired'),
    validate: (value: string[]) =>
      (value && value.length > 0) || t('role.validation.permissionsRequired'),
  };
}
