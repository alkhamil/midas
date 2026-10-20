import type { RegisterOptions } from 'react-hook-form';
import type { TFunction } from 'i18next';
import type { FormValues } from '../hooks';

export function getTextRules(_t: TFunction): RegisterOptions<FormValues, 'text'> {
  return {};
}

export function getNumberRules(_t: TFunction): RegisterOptions<FormValues, 'number'> {
  return {};
}

export function getTextareaRules(_t: TFunction): RegisterOptions<FormValues, 'textarea'> {
  return {};
}

export function getTextarea2Rules(_t: TFunction): RegisterOptions<FormValues, 'textarea2'> {
  return {};
}

export function getPasswordRules(_t: TFunction): RegisterOptions<FormValues, 'password'> {
  return {};
}

export function getSelectRules(_t: TFunction): RegisterOptions<FormValues, 'select'> {
  return {};
}
