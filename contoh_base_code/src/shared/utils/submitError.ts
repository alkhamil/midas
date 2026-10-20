import type { SubmitResult } from '../types/form';

export interface ApiErrorItem {
  field?: string;
  message?: string;
  value?: string;
}

export interface EnvelopeErrorShape {
  response?: {
    status?: number;
    data?: {
      response_schema?: { response_code?: string; response_message?: string };
      response_output?: {
        errors?: ApiErrorItem[];
      } | null;
    };
  };
}

export function isConnectionError(err: unknown): boolean {
  return !(err as EnvelopeErrorShape)?.response;
}

export type ErrorPageType = '403' | '404' | '500';

/**
 * Tentukan halaman error berdasarkan status HTTP respons BE:
 * 403 → Forbidden, 404 → Not Found, selain itu (termasuk 400) → General Error.
 */
export function getErrorStateType(err: unknown): ErrorPageType {
  const status = (err as EnvelopeErrorShape)?.response?.status;
  if (status === 403) return '403';
  if (status === 404) return '404';
  return '500';
}

export const NETWORK_ERROR_MESSAGE = 'Oops! Something went wrong, please try again later.';

export function mapSubmitError(err: unknown, defaultToastMessage: string): SubmitResult {
  const envelopeErr = err as EnvelopeErrorShape;

  if (isConnectionError(err)) {
    return { success: false, toastMessage: NETWORK_ERROR_MESSAGE };
  }

  const data = envelopeErr?.response?.data;
  const { response_message } = data?.response_schema ?? {};

  // Kontrak: field error selalu di response_output.errors.
  const errors = data?.response_output?.errors;
  if (errors && errors.length) {
    const fieldErrors: Record<string, string> = {};
    for (const errorItem of errors) {
      if (errorItem.field)
        fieldErrors[errorItem.field] = errorItem.message ?? errorItem.value ?? '';
    }
    if (Object.keys(fieldErrors).length) {
      return { success: false, fieldErrors };
    }
  }

  return { success: false, toastMessage: response_message ?? defaultToastMessage };
}

export interface SplitFieldErrorsResult {
  fieldErrors: Record<string, string>;
  unknownMessage?: string;
}

/**
 * Pisahkan field error yang dikenal form (di-return sebagai `fieldErrors`)
 * dari yang tidak dikenal (dijadikan toast, karena `setError` pada field yang
 * tidak dirender akan menyembunyikan pesan).
 */
export function splitFieldErrors(
  fieldErrors: Record<string, string>,
  resolveField: (field: string) => string | undefined,
): SplitFieldErrorsResult {
  const known: Record<string, string> = {};
  let unknownMessage: string | undefined;
  for (const [field, message] of Object.entries(fieldErrors)) {
    const resolved = resolveField(field);
    if (resolved) {
      known[resolved] = message;
    } else {
      unknownMessage ??= message;
    }
  }
  return { fieldErrors: known, unknownMessage };
}
