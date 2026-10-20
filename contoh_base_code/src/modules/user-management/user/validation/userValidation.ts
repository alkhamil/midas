import type { RegisterOptions } from 'react-hook-form';
import type { TFunction } from 'i18next';
import type { FormValues } from '../hooks';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getNameRules(t: TFunction): RegisterOptions<FormValues, 'name'> {
  return {
    required: t('validation.required', { label: t('user.fields.name.label') }),
    minLength: {
      value: 3,
      message: t('validation.minLength', { label: t('user.fields.name.label'), count: 3 }),
    },
    maxLength: {
      value: 100,
      message: t('validation.maxLength', { label: t('user.fields.name.label'), count: 100 }),
    },
  };
}

export function getRoleIdRules(t: TFunction): RegisterOptions<FormValues, 'role_id'> {
  return {
    required: t('validation.required', { label: t('user.fields.role.label') }),
  };
}

export function getUsernameRules(t: TFunction): RegisterOptions<FormValues, 'username'> {
  return {
    required: t('validation.required', { label: t('user.fields.username.label') }),
    minLength: {
      value: 3,
      message: t('validation.minLength', { label: t('user.fields.username.label'), count: 3 }),
    },
    maxLength: {
      value: 50,
      message: t('validation.maxLength', { label: t('user.fields.username.label'), count: 50 }),
    },
  };
}

export function getEmailRules(t: TFunction): RegisterOptions<FormValues, 'email'> {
  return {
    required: t('validation.required', { label: t('user.fields.email.label') }),
    maxLength: {
      value: 100,
      message: t('validation.maxLength', { label: t('user.fields.email.label'), count: 100 }),
    },
    pattern: { value: EMAIL_PATTERN, message: t('validation.email') },
  };
}

export function getPasswordRules(t: TFunction): RegisterOptions<FormValues, 'password'> {
  return {
    required: t('validation.required', { label: t('user.fields.password.label') }),
    minLength: {
      value: 6,
      message: t('validation.minLength', { label: t('user.fields.password.label'), count: 6 }),
    },
  };
}
